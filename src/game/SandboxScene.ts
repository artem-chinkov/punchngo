import Phaser from 'phaser'
import { AssetRegistry } from '../assets/AssetRegistry'
import { defaultBalance } from '../combat/balance'
import { BalancePanel } from '../debug/BalancePanel'
import { inCounterWindow } from '../combat/EnemyAI'
import { TouchController } from '../input/TouchController'
import { CombatView } from '../rendering/CombatView'
import { ParkView } from '../rendering/ParkView'
import { PerspectiveProjector } from '../rendering/PerspectiveProjector'
import { HUD } from '../ui/HUD'
import { defaultWorld } from '../world/route'
import { SandboxRun } from './SandboxRun'

const step = 1 / 60
const landscape = matchMedia('(orientation: landscape) and (pointer: coarse)')

export class SandboxScene extends Phaser.Scene {
  private assets!: AssetRegistry
  private park!: ParkView
  private combatView!: CombatView
  private run!: SandboxRun
  private touch!: TouchController
  private hud!: HUD
  private debug?: BalancePanel
  private accumulator = 0
  private visualTime = 0

  preload() {
    const mode = new URLSearchParams(location.search).get('assets') === 'raster' ? 'raster' : 'placeholder'
    this.assets = new AssetRegistry(this, mode)
    this.assets.preload()
  }

  create() {
    this.assets.create()
    this.park = new ParkView(this, this.assets)
    this.combatView = new CombatView(this, this.assets)
    const ui = document.querySelector<HTMLElement>('#ui')!
    this.hud = new HUD(ui, () => this.restart())
    if (import.meta.env.DEV && new URLSearchParams(location.search).get('debug') === '1') {
      this.debug = new BalancePanel(ui, () => this.touch.cancel(), atFight => this.restart(atFight))
    }
    this.run = this.newRun()
    this.combatView.reset(this.run.combat.enemies)
    this.touch = new TouchController(this.game.canvas, () => this.canInput(),
      () => this.run.combat.balance.hold,
      () => this.run.combat.punch(this.run.now, this.run.z),
      active => this.run.combat.setBlock(active, this.run.now))
    landscape.addEventListener('change', this.touch.cancel)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      landscape.removeEventListener('change', this.touch.cancel)
      this.touch.destroy()
    })
    this.renderFrame()
  }

  update(_time: number, delta: number) {
    if (landscape.matches) {
      this.accumulator = 0
      return
    }
    if (this.debug?.open || document.hidden) {
      this.accumulator = 0
      this.renderFrame()
      return
    }
    this.touch.update()
    const elapsed = Math.min(delta / 1000, step * 5)
    this.visualTime += elapsed
    this.accumulator += elapsed
    while (this.accumulator >= step) {
      this.run.update(step, this.debug?.invulnerable ?? false)
      this.accumulator -= step
    }
    this.renderFrame()
  }

  private canInput() {
    return this.run.fighting && !landscape.matches && !document.hidden && !this.debug?.open
  }

  private newRun() {
    return new SandboxRun(this.debug?.balance ?? defaultBalance, this.debug?.world ?? defaultWorld)
  }

  private restart(atFight = false) {
    this.touch.cancel()
    this.accumulator = 0
    this.run = this.newRun()
    this.run.start(atFight)
    this.combatView.reset(this.run.combat.enemies)
    this.hud.reset()
    this.renderFrame()
  }

  private renderFrame() {
    const { width, height } = this.scale.gameSize
    const { combat, now, world, z } = this.run
    for (const event of combat.events) {
      this.combatView.show(event, now)
      this.hud.show(event, now)
    }
    combat.events.length = 0
    const projection = new PerspectiveProjector(width, height, z, world)
    this.park.draw(projection, world.viewDistance)
    this.combatView.draw(this.run, projection, this.visualTime, this.debug?.zones ?? false)
    const counterReady = this.run.fighting && !!combat.target && inCounterWindow(combat.target, now, combat.balance)
    this.hud.draw(this.run, counterReady)
    this.debug?.draw(this.run, this.game.loop.actualFps)
  }
}
