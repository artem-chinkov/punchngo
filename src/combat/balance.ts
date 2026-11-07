import type { EnemyType } from '../assets/ids'

export interface EnemyBalance {
  hp: number
  damage: number
  approach: number
  strafe: number
  windup: number
  cooldown: number
  recoil: number
  retreatInterval: number
  retreatDistance: number
  retreatHold: number
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
  postComboInterval: number
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
  hp: 100, stamina: 100, hold: 0.18, damage: 15,
  punchCost: 5, hookCost: 20, punchInterval: 0.16, postComboInterval: 0.5, reach: 3, sector: 0.79,
  blockDrain: 0, blockCost: 15, heavyBlockCost: 30, combatRegen: 10, travelRegen: 20, guardBreak: 1,
  shortWindow: 1.2, comboWindow: 2, hookDamage: 1.5, splashDamage: 0.25, splashRadius: 2.1, retreatGrace: 0.35,
  counterWindow: 0.35, counterStun: 1, counterBonus: 1.5, counterStamina: 8, counterScore: 50,
  comboStamina: 3, attackGap: 0.76, combo3: 1.5, combo5: 2, combo10: 3,
  enemies: {
    thug: {
      hp: 300, damage: 12, approach: 1.5, strafe: 1.65, windup: 0.5, cooldown: 1, recoil: 0.5, reward: 100,
      retreatInterval: 4.5, retreatDistance: 0.9, retreatHold: 0.2,
    },
    quick: {
      hp: 150, damage: 8, approach: 5, strafe: 2.6, windup: 0.2, cooldown: 0.2, recoil: 1, reward: 150,
      retreatInterval: 1, retreatDistance: 2, retreatHold: 0,
    },
    brute: {
      hp: 500, damage: 50, approach: 0.5, strafe: 1.15, windup: 1.17, cooldown: 2.65, recoil: 0.05, reward: 250,
      retreatInterval: 7, retreatDistance: 0.5, retreatHold: 0.15,
    },
  },
}
