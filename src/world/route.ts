export const route = {
  stopZ: 16,
  endZ: 27,
  halfWidth: 2.35,
}

export interface WorldSettings {
  speed: number
  horizon: number
  viewDistance: number
  curvature: number
}

export const defaultWorld: WorldSettings = { speed: 3, horizon: 0.22, viewDistance: 54, curvature: 1 }

export function roadCenter(z: number): number {
  return 3.5 * Math.sin(z / 7) + 1.2 * Math.sin(z / 3.8)
}

export function roadHeading(z: number): number {
  return 3.5 / 7 * Math.cos(z / 7) + 1.2 / 3.8 * Math.cos(z / 3.8)
}
