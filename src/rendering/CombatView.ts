import type Phaser from 'phaser'
import type { AssetRegistry } from '../assets/AssetRegistry'
import type { AssetId, Hand, HandPose } from '../assets/ids'
import type { CombatEvent } from '../combat/CombatSystem'
import { inCounterWindow, type Enemy } from '../combat/EnemyAI'
import type { SandboxRun } from '../game/SandboxRun'
import type { PerspectiveProjector } from './PerspectiveProjector'

interface Impact {
  enemy: Enemy
  at: number
  color: number
  radius: number
}

export class CombatView {
  private readonly enemies = new Map<Enemy, Phaser.GameObjects.Image>()
  private readonly fists: Record<Hand, Phaser.GameObjects.Image>
  private readonly handState: Record<Hand, { pose: HandPose; since: number; guard: number }> = {
    left: { pose: 'idle', since: 0, guard: 0 },
    right: { pose: 'idle', since: 0, guard: 0 },
  }
  private lastFistFrame = 0
  private readonly marks: Phaser.GameObjects.Graphics
  private readonly effects: Phaser.GameObjects.Graphics
  private readonly shadows: Phaser.GameObjects.Graphics
  private readonly impacts: Impact[] = []
  private flash?: { at: number; color: number }

  constructor(scene: Phaser.Scene, private readonly assets: AssetRegistry) {
    this.shadows = scene.add.graphics().setDepth(-9998)
    this.marks = scene.add.graphics().setDepth(1)
    this.effects = scene.add.graphics().setDepth(2)
    this.fists = {
      left: assets.image('fist.left').setDepth(3),
      right: assets.image('fist.right').setDepth(3),
    }
  }

  reset(enemies: Enemy[]) {
    for (const image of this.enemies.values()) image.destroy()
    this.enemies.clear()
    this.impacts.length = 0
    this.flash = undefined
    for (const state of Object.values(this.handState)) {
      state.pose = 'idle'
      state.guard = 0
      state.since = this.lastFistFrame
    }
    for (const enemy of enemies) this.enemies.set(enemy, this.assets.image(enemy.type))
  }

  show(event: CombatEvent, now: number) {
    if ('enemy' in event) {
      if (event.kind === 'ko') return
      const color = event.kind === 'counter' ? 0xffdb58 : event.kind === 'splash' ? 0xf59b60 : 0xfff3c5
      this.impacts.push({ enemy: event.enemy, at: now, color, radius: event.kind === 'splash' ? 17 : 27 })
    } else if (event.kind === 'hurt' || event.kind === 'broken' || event.kind === 'block') {
      this.flash = { at: now, color: event.kind === 'block' ? 0x78ceca : 0xd53f37 }
    }
  }

  draw(run: SandboxRun, projector: PerspectiveProjector, visualTime: number, debug: boolean) {
    const { now, combat } = run
    const { width, height } = projector
    this.marks.clear()
    this.effects.clear()
    this.shadows.clear()
    if (debug) this.drawSector(run, projector)

    for (const [enemy, image] of this.enemies) {
      const point = projector.project(enemy.x, enemy.z)
      const elapsed = now - enemy.since
      const dying = enemy.pose === 'defeated'
      const visible = point.visible && (!dying || elapsed < 0.45)
      image.setVisible(visible)
      if (!visible) continue

      const counter = inCounterWindow(enemy, now, combat.balance)
      const moving = enemy.pose === 'approach' || enemy.pose === 'positioning' || enemy.pose === 'withdraw'
      const gait = Math.sin(visualTime * (moving ? 14 : 4) + enemy.lane * 2)
      const flinch = Math.max(0, 1 - (now - enemy.lastHit) / 0.17)
      const attacking = enemy.pose === 'attack' ? Math.sin(Math.min(1, elapsed / 0.18) * Math.PI) : 0
      const winding = enemy.pose === 'telegraph' ? Math.min(1, elapsed * 2) : 0
      const drop = dying ? Math.min(1, elapsed / 0.45) : 0
      const scale = point.scale * 1.15
      this.assets.pose(image, enemy.type, enemy.pose, enemy.pose === 'idle' ? visualTime : elapsed)
      this.assets.place(image, enemy.type, point.x + flinch * 5, point.y + drop * 16,
        scale * (1 + attacking * 0.16), scale * (1 + gait * 0.024 + attacking * 0.18 - drop * 0.72))
      image.setDepth(-point.distance * 10).setAlpha(1 - drop)
        .setRotation(winding * -0.09 + attacking * 0.10 + flinch * 0.12 + drop * 0.25)
      this.shadows.fillStyle(0x41382d, 0.30 * (1 - drop))
        .fillEllipse(point.x, point.y, 68 * scale, 16 * scale)
      if (dying) continue

      const top = point.y - image.displayHeight
      if (combat.target === enemy && run.fighting) {
        this.marks.lineStyle(2, counter ? 0xffe263 : 0xffe6b1, 0.9)
          .strokeEllipse(point.x, point.y + 1, 77 * scale, 19 * scale)
      }
      if (enemy.pose === 'telegraph') this.warning(point.x, top - 16, counter)
      if (enemy.pose === 'stunned') {
        this.marks.fillStyle(0xffdc75)
        for (let i = -1; i <= 1; i++) this.marks.fillCircle(point.x + i * 7, top - 8 - (i === 0 ? 4 : 0), 2)
      }
      if (now - enemy.lastHit < 1.5) {
        this.marks.fillStyle(0x252825).fillRoundedRect(point.x - 23, top + 3, 46, 5, 2)
        this.marks.fillStyle(0xef8460).fillRoundedRect(point.x - 22, top + 4, 44 * enemy.hp / enemy.maxHp, 3, 1)
      }
    }

    for (const impact of this.impacts) {
      const progress = (now - impact.at) / 0.32
      if (progress >= 1) continue
      const point = projector.project(impact.enemy.x, impact.enemy.z)
      if (!point.visible) continue
      const y = point.y - 100 * point.scale
      const radius = impact.radius * (0.46 + progress)
      this.effects.lineStyle(2, impact.color, 1 - progress).strokeCircle(point.x, y, radius * 0.58)
      for (let i = 0; i < 7; i++) {
        const angle = i * 6.283 / 7
        const dx = Math.cos(angle) * radius
        const dy = Math.sin(angle) * radius
        this.effects.lineBetween(point.x + dx * 0.68, y + dy * 0.68, point.x + dx, y + dy)
      }
    }
    while (this.impacts.length && now - this.impacts[0].at >= 0.32) this.impacts.shift()
    if (this.flash && now - this.flash.at < 0.23) {
      this.effects.lineStyle(15, this.flash.color, 0.65 * (1 - (now - this.flash.at) / 0.23))
        .strokeRect(4, 4, width - 8, height - 8)
    }
    this.drawFists(run, width, height, visualTime)
  }

  private drawFists(run: SandboxRun, width: number, height: number, visualTime: number) {
    const { combat, now } = run
    const frameDelta = Math.max(0, visualTime - this.lastFistFrame)
    this.lastFistFrame = visualTime
    for (const hand of ['left', 'right'] as const) {
      const image = this.fists[hand]
      const id: AssetId = hand === 'left' ? 'fist.left' : 'fist.right'
      const side = hand === 'left' ? -1 : 1
      const broken = now < combat.brokenUntil || run.phase === 'defeat'
      const strike = combat.strike?.hand === hand ? combat.strike : undefined
      const elapsed = strike ? now - strike.since : 0
      const progress = Math.min(1, elapsed / 0.23)
      const extension = strike ? Math.sin(progress ** 0.66 * Math.PI) : 0
      const guard = combat.blocking && !broken
      const pose: HandPose = broken ? 'broken' : guard ? 'block' : strike ? (strike.hook ? 'hook' : 'punch') : 'idle'
      const state = this.handState[hand]
      if (state.pose !== pose) {
        state.pose = pose
        state.since = visualTime
      }
      state.guard = Math.max(0, Math.min(1, state.guard + (guard ? 1 : -1) * frameDelta * 10))
      const lift = broken ? 0 : state.guard
      const bob = Math.sin(visualTime * (run.moving ? 10 : 4) + side) * (run.moving ? 7 : 2)
      const aim = strike ? strike.targetX * 24 : 0
      const x = width / 2 + side * (104 - 42 * lift) + (aim - side * (strike?.hook ? 136 : 89)) * extension
      const y = height - 111 - 97 * lift + bob - extension * height * 0.29 + (broken ? 91 : 0)
      const scale = 1 + 0.08 * lift - extension * 0.42
      this.assets.pose(image, id, pose, pose === 'punch' || pose === 'hook' ? elapsed : visualTime - state.since)
      this.assets.place(image, id, x, y, scale)
      image.setRotation(side * (0.09 + 0.07 * lift) + extension * side * (strike?.hook ? 0.50 : -0.07))
    }
  }

  private warning(x: number, y: number, counter: boolean) {
    const color = counter ? 0xffdf5a : 0xf25446
    this.marks.fillStyle(0x272926).fillCircle(x, y, 13)
    this.marks.lineStyle(2, color).strokeCircle(x, y, 12)
    this.marks.fillStyle(color).fillRoundedRect(x - 2, y - 7, 4, 9, 2).fillCircle(x, y + 6, 2)
  }

  private drawSector(run: SandboxRun, projector: PerspectiveProjector) {
    const near = 0.75
    const { reach, sector } = run.combat.balance
    const left = projector.project(-reach * sector, run.z + reach)
    const right = projector.project(reach * sector, run.z + reach)
    const base = projector.project(0, run.z + near)
    this.marks.lineStyle(2, 0x67f8e8, 0.8).beginPath()
      .moveTo(base.x, base.y).lineTo(left.x, left.y).lineTo(right.x, right.y)
      .closePath().strokePath()
  }
}
