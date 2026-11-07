import { route } from '../world/route'
import type Phaser from 'phaser'
import type { AssetRegistry } from '../assets/AssetRegistry'
import type { AssetId } from '../assets/ids'
import type { PerspectiveProjector } from './PerspectiveProjector'

interface Prop {
  id: AssetId
  x: number
  z: number
  size: number
  image: Phaser.GameObjects.Image
}

export class ParkView {
  private readonly sky: Phaser.GameObjects.Image
  private readonly farRidge: Phaser.GameObjects.Image
  private readonly nearRidge: Phaser.GameObjects.Image
  private previous?: PerspectiveProjector
  private previousDistance = 0
  private readonly ground: Phaser.GameObjects.Graphics
  private readonly props: Prop[] = []

  constructor(scene: Phaser.Scene, private readonly assets: AssetRegistry) {
    this.sky = assets.image('park.sky').setDepth(-10003)
    this.farRidge = assets.image('park.ridge.far').setDepth(-10002)
    this.nearRidge = assets.image('park.ridge.near').setDepth(-10001)
    this.ground = scene.add.graphics().setDepth(-9999)
    for (let index = 0; index < 39; index++) {
      const side = index % 2 ? -1 : 1
      const bench = index % 7 === 3
      const id = bench ? 'park.bench' : 'park.tree'
      this.props.push({
        id,
        x: side * (bench ? 3.25 : 3.9 + (index % 5) * 0.36),
        z: 3 + index * 2.85,
        size: bench ? 0.68 : 0.90 + (index % 5) * 0.09,
        image: assets.image(id),
      })
    }
  }

  draw(projector: PerspectiveProjector, viewDistance: number) {
    const { width, height, horizon, cameraZ, heading, curvature } = projector
    const previous = this.previous
    if (previous && previous.width === width && previous.height === height &&
      previous.horizon === horizon && previous.cameraZ === cameraZ &&
      previous.curvature === curvature && this.previousDistance === viewDistance) return
    this.previous = projector
    this.previousDistance = viewDistance

    this.assets.place(this.sky, 'park.sky', width / 2 - heading * 10, 0, 1, (horizon + 21) / 265)
    this.assets.place(this.farRidge, 'park.ridge.far', width / 2 - heading * 21, horizon - 43, 1)
    this.assets.place(this.nearRidge, 'park.ridge.near', width / 2 - heading * 28, horizon - 29, 1)

    const ground = this.ground.clear()
    ground.fillStyle(0x57774b).fillRect(0, horizon + 17, width, height - horizon)
    const start = Math.floor(cameraZ)
    for (let z = Math.ceil(cameraZ + viewDistance) - 1; z >= start; z--) {
      const nearZ = Math.max(cameraZ, z)
      const far = projector.project(0, z + 1)
      const near = projector.project(0, nearZ)
      const nearEdge = projector.project(route.halfWidth, nearZ).x - near.x
      const farEdge = projector.project(route.halfWidth, z + 1).x - far.x
      const stripe = Math.floor(z / 3) % 2 === 0
      ground.fillStyle(stripe ? 0x537449 : 0x597a4d).fillRect(0, far.y, width, near.y - far.y + 0.7)
      this.band(near.x, near.y, nearEdge * 1.10, far.x, far.y, farEdge * 1.10, 0x725b42)
      this.band(near.x, near.y, nearEdge * 1.035, far.x, far.y, farEdge * 1.035, 0xe5bd82)
      this.band(near.x, near.y, nearEdge, far.x, far.y, farEdge, stripe ? 0xc29666 : 0xc89e6d)
      if (z % 2 === 0) {
        const fleck = projector.project(Math.sin(z * 17) * 1.8, Math.max(nearZ, z + 0.38))
        ground.fillStyle(0x775b45, 0.40).fillEllipse(fleck.x, fleck.y, 7 * fleck.scale, 2.5 * fleck.scale)
      }
    }

    for (const prop of this.props) {
      const point = projector.project(prop.x, prop.z)
      const visible = point.visible && point.x > -130 && point.x < width + 130
      prop.image.setVisible(visible)
      if (!visible) continue
      this.assets.place(prop.image, prop.id, point.x, point.y, point.scale * prop.size)
      prop.image.setDepth(-point.distance * 10).setAlpha(Math.min(1, (viewDistance - point.distance) / 6))
    }
  }

  private band(nx: number, ny: number, nw: number, fx: number, fy: number, fw: number, color: number) {
    this.ground.fillStyle(color).beginPath()
      .moveTo(nx - nw, ny + 0.5).lineTo(fx - fw, fy).lineTo(fx + fw, fy)
      .lineTo(nx + nw, ny + 0.5).closePath().fillPath()
  }
}
