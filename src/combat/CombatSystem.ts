import type { Hand } from '../assets/ids'
import { createEnemy, EnemyAI, inCounterWindow, setPose, type Enemy } from './EnemyAI'
import type { Balance } from './balance'

export interface Strike {
  hand: Hand
  since: number
  targetX: number
  hook: boolean
}

export type CombatEvent =
  | { kind: 'hit' | 'splash' | 'counter' | 'ko'; enemy: Enemy }
  | { kind: 'miss' | 'tired' | 'block' | 'broken' | 'hurt' }

export class CombatSystem {
  hp: number
  stamina: number
  score = 0
  combo = 0
  bestCombo = 0
  step = 0
  blocking = false
  brokenUntil = 0
  strike?: Strike
  target?: Enemy
  readonly enemies: Enemy[]
  readonly events: CombatEvent[] = []
  private readonly ai: EnemyAI
  private hand: Hand = 'left'
  private comboLeft = 0
  private shortUntil = 0
  private graceUntil = 0
  private nextPunch = 0

  constructor(readonly balance: Balance) {
    this.hp = balance.hp
    this.stamina = balance.stamina
    this.ai = new EnemyAI(balance)
    this.enemies = [
      createEnemy('thug', 0, 23.7, balance),
      createEnemy('quick', -1, 28, balance),
      createEnemy('brute', 1, 25.7, balance),
    ]
  }

  get defeated() { return this.enemies.every(enemy => enemy.hp <= 0) }
  get multiplier() {
    if (this.combo >= 10) return this.balance.combo10
    if (this.combo >= 5) return this.balance.combo5
    if (this.combo >= 3) return this.balance.combo3
    return 1
  }

  canReach(enemy: Enemy, z: number) {
    const distance = enemy.z - z
    return enemy.hp > 0 && distance > 0.7 && distance <= this.balance.reach &&
      Math.abs(enemy.x) <= distance * this.balance.sector
  }

  selectTarget(now: number, z: number) {
    const eligible = this.enemies.filter(enemy => this.canReach(enemy, z))
    const urgent = eligible.find(enemy => inCounterWindow(enemy, now, this.balance))
    if (urgent) return urgent
    if (this.target && eligible.includes(this.target)) return this.target
    return eligible.reduce<Enemy | undefined>((closest, enemy) =>
      !closest || Math.hypot(enemy.x, enemy.z - z) < Math.hypot(closest.x, closest.z - z) ? enemy : closest, undefined)
  }

  update(now: number, dt: number, z: number, phase: 'travel' | 'approach' | 'fight', invulnerable = false) {
    if (now >= this.shortUntil) this.step = 0
    if (this.strike && now - this.strike.since >= 0.23) this.strike = undefined
    if (phase === 'travel') {
      this.stamina = Math.min(this.balance.stamina, this.stamina + this.balance.travelRegen * dt)
      this.blocking = false
      return
    }
    if (this.blocking) {
      this.stamina = Math.max(0, this.stamina - this.balance.blockDrain * dt)
      if (this.stamina === 0) this.breakGuard(now)
    } else if (!this.strike && now >= this.brokenUntil) {
      this.stamina = Math.min(this.balance.stamina, this.stamina + this.balance.combatRegen * dt)
    }
    const defendingAttack = this.blocking && this.enemies.some(enemy => enemy.pose === 'telegraph' || enemy.pose === 'attack')
    if (!defendingAttack) {
      this.comboLeft -= dt
      if (this.comboLeft <= 0) this.combo = 0
    }
    this.ai.update(this.enemies, now, dt, z, phase === 'fight', enemy => this.receive(enemy, now, invulnerable))
    this.target = this.selectTarget(now, z)
  }

  setBlock(active: boolean, now: number) {
    this.blocking = active && now >= this.brokenUntil && this.stamina > 0
    if (this.blocking) {
      this.step = 0
      this.strike = undefined
    }
    if (active && !this.blocking && this.stamina === 0 && now >= this.brokenUntil) this.breakGuard(now)
  }

  punch(now: number, z: number) {
    if (this.blocking || now < this.brokenUntil || now < this.nextPunch || this.hp <= 0 || this.defeated) return
    if (now >= this.shortUntil) this.step = 0
    const hook = this.step === 2
    const cost = hook ? this.balance.hookCost : this.balance.punchCost
    if (this.stamina < cost) {
      this.events.push({ kind: 'tired' })
      return
    }
    const target = this.selectTarget(now, z)
    this.strike = { hand: this.hand, since: now, targetX: target?.x ?? 0, hook }
    this.hand = this.hand === 'left' ? 'right' : 'left'
    this.nextPunch = now + (hook && target ? this.balance.postComboInterval : this.balance.punchInterval)
    this.stamina -= cost
    if (!target) {
      this.step = 0
      if (now >= this.graceUntil) this.combo = 0
      this.events.push({ kind: 'miss' })
      return
    }

    this.target = target
    this.step = hook ? 0 : this.step + 1
    this.shortUntil = now + this.balance.shortWindow
    this.combo += 1
    this.bestCombo = Math.max(this.bestCombo, this.combo)
    this.comboLeft = this.balance.comboWindow

    const counter = inCounterWindow(target, now, this.balance)
    const bonus = target.bonus ? this.balance.counterBonus : 1
    const damage = this.balance.damage * (hook ? this.balance.hookDamage : 1) * bonus
    target.bonus = counter
    if (counter) {
      this.stamina = Math.min(this.balance.stamina, this.stamina + this.balance.counterStamina)
      this.score += this.balance.counterScore
    }
    if (this.combo >= 5) this.stamina = Math.min(this.balance.stamina, this.stamina + this.balance.comboStamina)

    this.hit(target, damage, now, counter ? 'counter' : 'hit', hook)
    if (hook) {
      for (const neighbor of this.enemies) {
        if (this.balance.splashDamage > 0 && neighbor !== target && this.canReach(neighbor, z) &&
          Math.hypot(neighbor.x - target.x, neighbor.z - target.z) <= this.balance.splashRadius) {
          this.hit(neighbor, this.balance.damage * this.balance.splashDamage, now, 'splash', false)
        }
      }
    }
    if (target.hp === 0) this.target = this.selectTarget(now, z)
  }

  private hit(enemy: Enemy, amount: number, now: number, kind: 'hit' | 'splash' | 'counter', hook: boolean) {
    enemy.hp = Math.max(0, enemy.hp - amount)
    enemy.lastHit = now
    this.events.push({ kind, enemy })
    if (!enemy.hp) {
      this.ai.interrupt(enemy, now)
      setPose(enemy, 'defeated', now)
      this.score += Math.round(this.balance.enemies[enemy.type].reward * this.multiplier)
      this.events.push({ kind: 'ko', enemy })
    } else if (kind === 'counter') {
      this.ai.interrupt(enemy, now)
      setPose(enemy, 'stunned', now, this.balance.counterStun)
    } else if (hook) {
      this.ai.interrupt(enemy, now)
      setPose(enemy, 'retreat', now, this.balance.enemies[enemy.type].recoil)
      this.graceUntil = now + this.balance.retreatGrace
    } else if (kind === 'splash' || (enemy.pose !== 'telegraph' && enemy.pose !== 'attack' && enemy.pose !== 'stunned')) {
      this.ai.interrupt(enemy, now)
      setPose(enemy, 'hit', now, this.balance.enemies[enemy.type].recoil * (kind === 'splash' ? 0.62 : 1))
    }
  }

  private receive(enemy: Enemy, now: number, invulnerable: boolean) {
    if (this.blocking) {
      const cost = enemy.type === 'brute' ? this.balance.heavyBlockCost : this.balance.blockCost
      this.stamina = Math.max(0, this.stamina - cost)
      this.events.push({ kind: 'block' })
      if (this.stamina === 0) this.breakGuard(now)
      return
    }
    if (invulnerable) return
    this.hp = Math.max(0, this.hp - this.balance.enemies[enemy.type].damage)
    this.combo = 0
    this.step = 0
    this.events.push({ kind: 'hurt' })
  }

  private breakGuard(now: number) {
    this.blocking = false
    this.brokenUntil = now + this.balance.guardBreak
    this.events.push({ kind: 'broken' })
  }
}
