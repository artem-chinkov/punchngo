export const enemyTypes = ['thug', 'quick', 'brute'] as const
export type EnemyType = typeof enemyTypes[number]
export type Hand = 'left' | 'right'

export type EnemyPose =
  | 'approach' | 'positioning' | 'idle' | 'telegraph' | 'attack'
  | 'recovery' | 'hit' | 'stunned' | 'retreat' | 'defeated'

export type HandPose = 'idle' | 'punch' | 'hook' | 'block' | 'broken'
export type AnimationState = EnemyPose | HandPose
export type AssetId =
  | EnemyType | 'fist.left' | 'fist.right'
  | 'park.tree' | 'park.bench' | 'park.sky' | 'park.ridge.far' | 'park.ridge.near'
