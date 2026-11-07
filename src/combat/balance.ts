import type { EnemyType } from '../assets/ids'

export interface EnemyBalance {
  hp: number
  damage: number
  approach: number
  strafe: number
  windup: number
  cooldown: number
  recoil: number
  reward: number
}

export interface Balance {
  hp: number
  stamina: number
  hold: number
  damage: number
  punchCost: number
  hookCost: number
  punchInterval: number
  reach: number
  sector: number
  blockDrain: number
  blockCost: number
  heavyBlockCost: number
  combatRegen: number
  travelRegen: number
  guardBreak: number
  shortWindow: number
  comboWindow: number
  hookDamage: number
  splashDamage: number
  splashRadius: number
  retreatGrace: number
  counterWindow: number
  counterStun: number
  counterBonus: number
  counterStamina: number
  counterScore: number
  comboStamina: number
  attackGap: number
  combo3: number
  combo5: number
  combo10: number
  enemies: Record<EnemyType, EnemyBalance>
}

export const defaultBalance: Balance = {
  hp: 100, stamina: 100, hold: 0.18, damage: 20,
  punchCost: 12, hookCost: 18, punchInterval: 0.28, reach: 3.05, sector: 0.79,
  blockDrain: 6, blockCost: 15, heavyBlockCost: 30, combatRegen: 5, travelRegen: 20, guardBreak: 1,
  shortWindow: 1.2, comboWindow: 2, hookDamage: 1.5, splashDamage: 0.25, splashRadius: 2.1, retreatGrace: 0.35,
  counterWindow: 0.35, counterStun: 1, counterBonus: 1.5, counterStamina: 8, counterScore: 50,
  comboStamina: 3, attackGap: 0.76, combo3: 1.5, combo5: 2, combo10: 3,
  enemies: {
    thug: { hp: 56, damage: 12, approach: 3.8, strafe: 1.65, windup: 0.9, cooldown: 2.1, recoil: 0.19, reward: 100 },
    quick: { hp: 38, damage: 8, approach: 5.3, strafe: 2.6, windup: 0.69, cooldown: 1.65, recoil: 0.14, reward: 150 },
    brute: { hp: 110, damage: 24, approach: 3, strafe: 1.15, windup: 1.17, cooldown: 2.65, recoil: 0.22, reward: 250 },
  },
}
