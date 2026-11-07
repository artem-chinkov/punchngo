import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null } })
after(() => vite.close())

const { SandboxRun } = await vite.ssrLoadModule('/src/game/SandboxRun.ts')
const { defaultBalance } = await vite.ssrLoadModule('/src/combat/balance.ts')
const { inCounterWindow } = await vite.ssrLoadModule('/src/combat/EnemyAI.ts')
const { defaultWorld, route } = await vite.ssrLoadModule('/src/world/route.ts')
const { PerspectiveProjector } = await vite.ssrLoadModule('/src/rendering/PerspectiveProjector.ts')
const { TouchController } = await vite.ssrLoadModule('/src/input/TouchController.ts')

const dt = 1 / 60
const events = (run, kind) => run.combat.events.filter(event => event.kind === kind)
const tick = (run, count) => { for (let index = 0; index < count; index++) run.update(dt, false) }
function until(run, predicate, seconds = 10) {
  for (let index = 0; index < seconds * 60 && !predicate(); index++) tick(run, 1)
  assert.ok(predicate(), 'The expected state was not reached')
}
function atFight() {
  const run = new SandboxRun(structuredClone(defaultBalance), defaultWorld)
  run.start(true)
  return run
}
function counterTarget(run) {
  return run.combat.enemies.find(enemy => inCounterWindow(enemy, run.now, run.combat.balance) &&
    run.combat.canReach(enemy, run.z))
}

test('the camera advances, stops, and enemies grow as they approach in world space', () => {
  const run = new SandboxRun(defaultBalance, defaultWorld)
  run.start()
  tick(run, 60)
  assert.ok(run.z > 0 && run.z < route.stopZ)
  until(run, () => run.phase === 'encounter')
  assert.equal(run.z, route.stopZ)
  const [enemy] = run.combat.enemies
  const projector = new PerspectiveProjector(360, 640, run.z, run.world)
  const distant = projector.project(enemy.x, enemy.z)
  run.combat.punch(run.now, run.z)
  assert.equal(events(run, 'miss').length, 1)
  assert.equal(run.combat.stamina, 88)
  until(run, () => run.phase === 'combat')
  const close = projector.project(enemy.x, enemy.z)
  assert.ok(close.scale > distant.scale && close.y > distant.y)
  assert.equal(run.z, route.stopZ)
  assert.equal(projector.project(0, run.z - 1).visible, false)
  const level = new PerspectiveProjector(360, 640, run.z, { ...run.world, curvature: 0 })
  assert.equal(level.project(0, run.z + 12).x, 180)
  assert.notEqual(projector.project(0, run.z + 12).x, 180)
})

test('third hit alternates hands, splashes two enemies, and adds one combo point', () => {
  const run = atFight()
  run.combat.balance.enemies.thug.windup = 2
  const { combat } = run
  const [thug, quick, brute] = combat.enemies
  until(run, () => combat.enemies.every(enemy => combat.canReach(enemy, run.z)))
  assert.equal(combat.selectTarget(run.now, run.z), thug)
  combat.punch(run.now, run.z)
  assert.equal(combat.strike.hand, 'left')
  tick(run, 18)
  combat.punch(run.now, run.z)
  assert.equal(combat.strike.hand, 'right')
  tick(run, 18)
  combat.punch(run.now, run.z)
  assert.equal(combat.strike.hand, 'left')
  assert.equal(combat.strike.hook, true)
  assert.equal(combat.step, 0)
  assert.equal(combat.combo, 3)
  assert.equal(combat.score, 150)
  assert.equal(thug.hp, 0)
  assert.equal(quick.hp, quick.maxHp - 5)
  assert.equal(brute.hp, brute.maxHp - 5)
  assert.equal(events(run, 'splash').length, 2)
  assert.notEqual(combat.target, thug)
})

test('a counter overrides target lock and its bonus stays on the stunned enemy', () => {
  const run = atFight()
  const { combat } = run
  until(run, () => counterTarget(run) !== undefined)
  const enemy = counterTarget(run)
  combat.target = combat.enemies.find(other => other !== enemy && combat.canReach(other, run.z))
  assert.notEqual(combat.target, enemy)
  const stamina = combat.stamina
  combat.punch(run.now, run.z)
  assert.equal(combat.target, enemy)
  assert.equal(combat.score, 50)
  assert.equal(combat.stamina, stamina - 12 + 8)
  assert.equal(enemy.pose, 'stunned')
  assert.equal(enemy.bonus, true)
  assert.equal(combat.enemies.filter(other => other.bonus).length, 1)
  tick(run, 18)
  const hp = enemy.hp
  combat.punch(run.now, run.z)
  assert.equal(enemy.hp, Math.max(0, hp - 30))
  assert.equal(enemy.bonus, false)
})

test('block protects health, breaks on exhaustion, and combo still expires', () => {
  const run = atFight()
  const { combat } = run
  until(run, () => combat.target !== undefined)
  combat.punch(run.now, run.z)
  assert.equal(combat.combo, 1)
  until(run, () => combat.enemies.some(enemy => enemy.pose === 'telegraph'))
  combat.setBlock(true, run.now)
  assert.equal(combat.step, 0)
  const stamina = combat.stamina
  until(run, () => events(run, 'block').length === 1)
  assert.equal(combat.hp, 100)
  assert.equal(combat.combo, 1)
  assert.ok(combat.stamina <= stamina - 15)
  until(run, () => combat.combo === 0)
  until(run, () => events(run, 'broken').length > 0, 25)
  assert.equal(combat.stamina, 0)
  assert.equal(combat.blocking, false)
  assert.ok(combat.brokenUntil > run.now)
  const strikes = combat.strike
  combat.punch(run.now, run.z)
  assert.equal(combat.strike, strikes)
})

test('the group takes turns and a complete encounter ends in victory at default balance', () => {
  const run = new SandboxRun(defaultBalance, defaultWorld)
  run.start()
  const attackOrder = new Set()
  for (let index = 0; index < 1800 && !run.finished; index++) {
    tick(run, 1)
    const { combat } = run
    const attacking = combat.enemies.filter(enemy => enemy.pose === 'telegraph' || enemy.pose === 'attack')
    assert.ok(attacking.length <= 1)
    if (attacking[0]) attackOrder.add(attacking[0].type)
    if (!run.fighting) continue
    const urgent = counterTarget(run)
    if (urgent || (combat.target && !attacking.length && combat.stamina > 22)) {
      combat.punch(run.now, run.z)
    }
  }
  assert.equal(run.phase, 'victory')
  assert.equal(run.z, route.endZ)
  assert.equal(events(run, 'ko').length, 3)
  assert.ok(events(run, 'counter').length >= 2)
  assert.ok(run.combat.bestCombo >= 5)
  assert.ok(attackOrder.size >= 2)
  assert.ok(run.combat.score >= 500)
  assert.ok(run.combat.hp > 0)
})

test('damage resets combo and an undefended round can end in defeat', () => {
  const run = atFight()
  until(run, () => run.combat.target !== undefined)
  run.combat.punch(run.now, run.z)
  assert.equal(run.combat.combo, 1)
  until(run, () => events(run, 'hurt').length > 0)
  assert.equal(run.combat.combo, 0)
  assert.ok(run.combat.hp < 100)
  until(run, () => run.finished, 30)
  assert.equal(run.phase, 'defeat')
})

test('touch distinguishes tap, hold, secondary pointers and cancellation', () => {
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  globalThis.window = new EventTarget()
  globalThis.document = new EventTarget()
  class Canvas extends EventTarget {
    capture
    setPointerCapture(id) { this.capture = id }
    hasPointerCapture(id) { return this.capture === id }
    releasePointerCapture() { this.capture = undefined }
  }
  const canvas = new Canvas()
  const actions = []
  let enabled = true
  const input = new TouchController(canvas, () => enabled, () => 0.18,
    () => actions.push('punch'), active => actions.push(active ? 'block' : 'release'))
  const pointer = (type, id = 1) => canvas.dispatchEvent(Object.assign(new Event(type), { pointerId: id, button: 0 }))
  try {
    pointer('pointerdown')
    pointer('pointerup')
    assert.deepEqual(actions, ['punch'])
    pointer('pointerdown')
    pointer('pointerdown', 2)
    pointer('pointerup', 2)
    input.update(performance.now() + 200)
    pointer('pointerup')
    assert.deepEqual(actions, ['punch', 'block', 'release'])
    pointer('pointerdown')
    input.update(performance.now() + 200)
    pointer('pointercancel')
    pointer('pointerup')
    assert.deepEqual(actions, ['punch', 'block', 'release', 'block', 'release'])
    enabled = false
    pointer('pointerdown')
    pointer('pointerup')
    assert.equal(actions.length, 5)
  } finally {
    input.destroy()
    globalThis.window = originalWindow
    globalThis.document = originalDocument
  }
})

test('PNG and atlas entries use the same logical anchor and missing frames fall back', async () => {
  const { AssetRegistry } = await vite.ssrLoadModule('/src/assets/AssetRegistry.ts')
  const { rasterPack } = await vite.ssrLoadModule('/src/assets/rasterPack.ts')
  const queued = []
  const image = {
    texture: { key: 'placeholder:thug' },
    frame: { name: undefined },
    setTexture(key, frame) {
      this.texture.key = key
      this.frame.name = frame
      return this
    },
    setOrigin(...origin) { this.origin = origin; return this },
    setPosition(...position) { this.position = position; return this },
    setDisplaySize(...size) { this.size = size; return this },
  }
  const scene = {
    load: {
      image: (...args) => queued.push(['image', ...args]),
      atlas: (...args) => queued.push(['atlas', ...args]),
    },
    textures: {
      exists: key => key === 'raster:thug' || key === 'raster:park.tree',
      get: () => ({ has: frame => frame === 'idle0' || frame === 'hit0' || frame === 'hit1' }),
    },
  }
  rasterPack.thug = {
    png: '/assets/thug.png', atlas: '/assets/thug.json',
    poses: { idle: ['idle0'], attack: ['hit0', 'hit1'], stunned: ['absent'] },
  }
  rasterPack['park.tree'] = { png: '/assets/tree.png' }
  try {
    const placeholder = new AssetRegistry(scene, 'placeholder')
    const raster = new AssetRegistry(scene, 'raster')
    placeholder.preload()
    assert.deepEqual(queued, [])
    raster.preload()
    assert.deepEqual(queued, [
      ['atlas', 'raster:thug', '/assets/thug.png', '/assets/thug.json'],
      ['image', 'raster:park.tree', '/assets/tree.png'],
    ])

    placeholder.place(image, 'thug', 28, 55, 0.5)
    const layout = [image.origin, image.position, image.size]
    raster.pose(image, 'thug', 'attack', 0.1)
    assert.equal(image.texture.key, 'raster:thug')
    assert.equal(image.frame.name, 'hit1')
    raster.place(image, 'thug', 28, 55, 0.5)
    assert.deepEqual([image.origin, image.position, image.size], layout)
    raster.pose(image, 'thug', 'telegraph', 0)
    assert.equal(image.frame.name, 'idle0')
    raster.pose(image, 'thug', 'stunned', 0)
    assert.equal(image.texture.key, 'placeholder:thug')
    raster.pose(image, 'park.tree', 'idle', 0)
    assert.equal(image.texture.key, 'raster:park.tree')
  } finally {
    delete rasterPack.thug
    delete rasterPack['park.tree']
  }
})
