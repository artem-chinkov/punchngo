import type { EnemyPose, EnemyType } from '../assets/ids'
import { route } from '../world/route'
import type { Balance } from './balance'

export interface Enemy {
  type: EnemyType
  x: number
  z: number
  lane: number
  hp: number
  maxHp: number
  pose: EnemyPose
  since: number
  until: number
  nextAttack: number
  nextWithdrawal?: number
  withdrawalOrigin: number
  lastHit: number
  bonus: boolean
}

export function createEnemy(type: EnemyType, lane: number, z: number, balance: Balance): Enemy {
  const hp = balance.enemies[type].hp
  return { type, x: lane * 2.12, z, lane, hp, maxHp: hp, pose: 'approach',
    since: 0, until: 0, nextAttack: 0, withdrawalOrigin: z, lastHit: -Infinity, bonus: false }
}

export function setPose(enemy: Enemy, pose: EnemyPose, now: number, duration = 0) {
  enemy.pose = pose
  enemy.since = now
  enemy.until = now + duration
}

export function inCounterWindow(enemy: Enemy, now: number, balance: Balance) {
  return enemy.pose === 'telegraph' && now >= enemy.until - balance.counterWindow && now < enemy.until
}

function stepToward(from: number, to: number, amount: number) {
  return from + Math.sign(to - from) * Math.min(Math.abs(to - from), amount)
}

export class EnemyAI {
  private nextAttack = 0
  private lastAttacker?: Enemy

  constructor(private readonly balance: Balance) {}

  interrupt(enemy: Enemy, now: number) {
    if (enemy.pose === 'telegraph' || enemy.pose === 'attack') {
      enemy.nextAttack = now + this.balance.enemies[enemy.type].cooldown
      this.nextAttack = Math.max(this.nextAttack, now + this.balance.attackGap)
    }
  }

  update(enemies: Enemy[], now: number, dt: number, cameraZ: number, fight: boolean, onAttack: (enemy: Enemy) => void) {
    const alive = enemies.filter(enemy => enemy.hp > 0)
    if (alive.length && alive.every(enemy => enemy.lane !== 0)) {
      const nearestCenter = alive.reduce((a, b) => Math.abs(a.x) <= Math.abs(b.x) ? a : b)
      nearestCenter.lane = 0
    }

    for (const enemy of alive) {
      const stats = this.balance.enemies[enemy.type]
      const stance = route.stopZ + 2.13 + Math.abs(enemy.lane) * 0.36
      const pace = enemy.type === 'quick' ? Math.sin(now * 6) * 0.23 : Math.sin(now * 2 + enemy.lane) * 0.09
      if (enemy.pose === 'telegraph') {
        enemy.z = stepToward(enemy.z, cameraZ + 1.88, stats.approach * dt * 0.65)
        if (now >= enemy.until) {
          setPose(enemy, 'attack', now, 0.18)
          enemy.nextAttack = now + stats.cooldown
          this.nextAttack = now + this.balance.attackGap
          onAttack(enemy)
        }
        continue
      }
      if (enemy.pose === 'attack') {
        if (now >= enemy.until) setPose(enemy, 'recovery', now, 0.35)
        continue
      }
      if (enemy.pose === 'retreat') {
        enemy.z = stepToward(enemy.z, stance + 1.10, 7 * dt)
        if (now >= enemy.until) setPose(enemy, 'positioning', now)
        continue
      }
      if (enemy.pose === 'withdraw') {
        if (now >= enemy.until) {
          enemy.z = enemy.withdrawalOrigin
          setPose(enemy, 'positioning', now)
        } else {
          const travel = stats.retreatDistance / stats.approach
          const progress = Math.min(1, (now - enemy.since) / travel, (enemy.until - now) / travel)
          enemy.z = enemy.withdrawalOrigin + stats.retreatDistance * progress ** 2 * (3 - 2 * progress)
        }
        continue
      }
      if (enemy.pose === 'recovery' || enemy.pose === 'hit' || enemy.pose === 'stunned') {
        if (now < enemy.until) continue
        setPose(enemy, 'positioning', now)
      }

      enemy.x = stepToward(enemy.x, enemy.lane * 1.47 + pace, stats.strafe * dt)
      enemy.z = stepToward(enemy.z, stance, stats.approach * dt)
      const pose = Math.abs(enemy.z - stance) > 0.24 ? 'approach'
        : Math.abs(enemy.x - enemy.lane * 1.47) > 0.3 ? 'positioning' : 'idle'
      if (enemy.pose !== pose) setPose(enemy, pose, now)
    }

    if (!fight) return
    this.startWithdrawal(alive, now)

    if (now < this.nextAttack ||
      alive.some(enemy => enemy.pose === 'telegraph' || enemy.pose === 'attack')) return

    const ready = alive.filter(enemy => enemy.pose === 'idle' && enemy.nextAttack <= now &&
      enemy.z - cameraZ <= 2.8)
    const attacker = ready.find(enemy => enemy !== this.lastAttacker) ?? ready[0]
    if (attacker) {
      this.lastAttacker = attacker
      setPose(attacker, 'telegraph', now, this.balance.enemies[attacker.type].windup)
    }
  }

  private startWithdrawal(enemies: Enemy[], now: number) {
    let candidate: Enemy | undefined
    let earliest = Infinity
    for (const enemy of enemies) {
      const stats = this.balance.enemies[enemy.type]
      if (enemy.pose !== 'idle' || stats.retreatInterval <= 0 || stats.retreatDistance <= 0) continue
      enemy.nextWithdrawal ??= now + stats.retreatInterval
      if (enemy.nextWithdrawal <= now && enemy.nextWithdrawal < earliest) {
        candidate = enemy
        earliest = enemy.nextWithdrawal
      }
    }
    if (!candidate || enemies.some(enemy => enemy.pose === 'withdraw')) return

    const stats = this.balance.enemies[candidate.type]
    const duration = 2 * stats.retreatDistance / stats.approach + stats.retreatHold
    candidate.withdrawalOrigin = candidate.z
    candidate.nextWithdrawal = now + stats.retreatInterval
    setPose(candidate, 'withdraw', now, duration)
  }
}
