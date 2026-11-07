import { CombatSystem } from '../combat/CombatSystem'
import type { Balance } from '../combat/balance'
import { route, type WorldSettings } from '../world/route'

export type Phase = 'ready' | 'moving' | 'encounter' | 'combat' | 'exit' | 'victory' | 'defeat'

export class SandboxRun {
  phase: Phase = 'ready'
  now = 0
  z = 0
  readonly combat: CombatSystem

  constructor(balance: Balance, readonly world: WorldSettings) {
    this.combat = new CombatSystem(balance)
  }

  get moving() { return this.phase === 'moving' || this.phase === 'exit' }
  get fighting() { return this.phase === 'encounter' || this.phase === 'combat' }
  get finished() { return this.phase === 'victory' || this.phase === 'defeat' }

  start(atFight = false) {
    this.phase = atFight ? 'encounter' : 'moving'
    this.z = atFight ? route.stopZ : 0
  }

  update(dt: number, invulnerable: boolean) {
    if (this.phase === 'ready' || this.finished) return
    this.now += dt
    if (this.moving) {
      const destination = this.phase === 'moving' ? route.stopZ : route.endZ
      this.z = Math.min(destination, this.z + this.world.speed * dt)
      this.combat.update(this.now, dt, this.z, 'travel')
      if (this.z >= destination) this.phase = this.phase === 'moving' ? 'encounter' : 'victory'
      return
    }
    this.combat.update(this.now, dt, this.z, this.phase === 'encounter' ? 'approach' : 'fight', invulnerable)
    if (this.combat.hp <= 0) this.phase = 'defeat'
    else if (this.combat.defeated) this.phase = 'exit'
    else if (this.phase === 'encounter' &&
      this.combat.enemies.some(enemy => enemy.pose === 'idle' || enemy.pose === 'positioning')) {
      this.phase = 'combat'
    }
  }
}
