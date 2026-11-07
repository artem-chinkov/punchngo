import Phaser from 'phaser'
import { SandboxScene } from './game/SandboxScene'
import './style.css'

const stage = document.querySelector<HTMLElement>('#stage')!
const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: stage,
  width: 360,
  height: 640,
  backgroundColor: '#304d35',
  scale: { mode: Phaser.Scale.NONE },
  fps: { smoothStep: false },
  render: { antialias: true },
  scene: [SandboxScene],
})

const resize = new ResizeObserver(([entry]) => {
  const { width, height } = entry.contentRect
  if (!width || !height) return
  const logicalHeight = Math.round(height * 360 / width)
  if (game.scale.gameSize.height !== logicalHeight) game.scale.resize(360, logicalHeight)
  game.canvas.style.width = '100%'
  game.canvas.style.height = '100%'
})
game.events.once(Phaser.Core.Events.READY, () => resize.observe(stage))
