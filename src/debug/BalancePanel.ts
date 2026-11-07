import { enemyTypes } from '../assets/ids'
import { defaultBalance, type Balance, type EnemyBalance } from '../combat/balance'
import type { SandboxRun } from '../game/SandboxRun'
import { defaultWorld, type WorldSettings } from '../world/route'

const storageKey = 'punchngo.sandbox.balance.v1'
type NumericField<T> = readonly [key: keyof T, label: string, min: number, max: number, step?: number]

const playerFields: NumericField<Omit<Balance, 'enemies'>>[] = [
  ['hp', 'Макс. здоровье', 1, 999], ['stamina', 'Макс. выносливость', 1, 500],
  ['hold', 'Порог блока, с', 0.06, 0.7, 0.01], ['punchCost', 'Цена удара', 0, 150],
  ['hookCost', 'Цена хука', 0, 150], ['punchInterval', 'Интервал удара, с', 0.16, 2, 0.01],
  ['blockDrain', 'Удержание блока / с', 0, 100], ['blockCost', 'Блок обычного удара', 0, 150],
  ['heavyBlockCost', 'Блок сильного удара', 0, 150], ['guardBreak', 'Пробитие блока, с', 0.1, 5, 0.05],
  ['combatRegen', 'Восстановление в бою / с', 0, 100], ['travelRegen', 'Восстановление на ходу / с', 0, 100],
]
const combatFields: typeof playerFields = [
  ['damage', 'Базовый урон', 1, 250], ['reach', 'Дальность удара', 2, 8, 0.05],
  ['sector', 'Наклон границ сектора', 0.3, 1.6, 0.01],
  ['shortWindow', 'Короткая серия, с', 0.2, 4, 0.05], ['comboWindow', 'Длинное комбо, с', 0.25, 8, 0.05],
  ['postComboInterval', 'Пауза после третьего попадания, с', 0.16, 5, 0.01],
  ['hookDamage', 'Множитель хука', 1, 5, 0.05], ['splashDamage', 'Доля урона соседям', 0, 2, 0.05],
  ['splashRadius', 'Радиус хука', 0, 6, 0.05], ['retreatGrace', 'Защита от промаха, с', 0, 2, 0.05],
  ['comboStamina', 'Выносливость при комбо 5+', 0, 50], ['attackGap', 'Пауза между атаками врагов, с', 0.1, 4, 0.01],
  ['combo3', 'Множитель очков 3+', 1, 10, 0.1], ['combo5', 'Множитель очков 5+', 1, 10, 0.1],
  ['combo10', 'Множитель очков 10+', 1, 10, 0.1],
]
const counterFields: typeof playerFields = [
  ['counterWindow', 'Окно, с', 0.05, 1.2, 0.01], ['counterStun', 'Оглушение, с', 0.1, 4, 0.05],
  ['counterBonus', 'Множитель следующего удара', 1, 5, 0.05],
  ['counterStamina', 'Награда выносливостью', 0, 100], ['counterScore', 'Награда очками', 0, 500],
]
const enemyFields: NumericField<EnemyBalance>[] = [
  ['hp', 'Здоровье', 1, 500], ['damage', 'Урон', 1, 150], ['approach', 'Скорость сближения', 0.5, 15, 0.05],
  ['strafe', 'Скорость в сторону', 0.1, 10, 0.05], ['windup', 'Замах, с', 0.2, 4, 0.01],
  ['cooldown', 'Перерыв после атаки, с', 0.2, 8, 0.05],
  ['recoil', 'Отшатывание, с', 0.05, 1, 0.01], ['reward', 'Награда за нокаут', 0, 5000],
]
const worldFields: NumericField<WorldSettings>[] = [
  ['speed', 'Скорость героя', 0.5, 12, 0.05], ['horizon', 'Положение горизонта', 0.22, 0.5, 0.01],
  ['viewDistance', 'Дальность отрисовки', 26, 72], ['curvature', 'Сила поворотов', 0, 2, 0.05],
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function merge<T extends object>(defaults: T, fields: NumericField<T>[], raw: unknown): T {
  const settings = { ...defaults }
  if (isRecord(raw)) {
    for (const [key, , min, max] of fields) {
      const value = raw[String(key)]
      if (typeof value === 'number' && Number.isFinite(value)) {
        settings[key] = Math.max(min, Math.min(max, value)) as T[typeof key]
      }
    }
  }
  return settings
}

function loadSettings() {
  let raw: unknown
  try { raw = JSON.parse(localStorage.getItem(storageKey) ?? '{}') } catch { raw = {} }
  const stored = isRecord(raw) ? raw : {}
  const balance = merge(defaultBalance, [...playerFields, ...combatFields, ...counterFields], stored.balance)
  const enemyValues = isRecord(stored.balance) && isRecord(stored.balance.enemies) ? stored.balance.enemies : {}
  balance.enemies = { ...defaultBalance.enemies }
  for (const type of enemyTypes) {
    balance.enemies[type] = merge(defaultBalance.enemies[type], enemyFields, enemyValues[type])
  }
  const world = merge(defaultWorld, worldFields, stored.world)
  return { balance, world }
}

export class BalancePanel {
  balance: Balance
  world: WorldSettings
  open = false
  invulnerable = false
  zones = false

  private readonly panel: HTMLElement
  private readonly readout: HTMLElement
  private readonly status: HTMLElement
  private readonly form: HTMLFormElement
  private readonly fields = document.createElement('div')
  private readonly launch: HTMLButtonElement
  private applyValues: (() => void)[] = []
  private nextReadout = 0

  constructor(root: HTMLElement, cancelInput: () => void, restart: (atFight: boolean) => void) {
    const { balance, world } = loadSettings()
    this.balance = balance
    this.world = world
    const shell = document.createElement('div')
    shell.innerHTML = `
      <button class="dev-toggle" type="button" aria-expanded="false">DEV</button>
      <section class="dev-panel" aria-label="Панель разработчика" hidden>
        <header><strong>Баланс Sandbox</strong><button type="button" data-close>Закрыть</button></header>
        <p class="dev-status"></p>
        <form>
          <div class="dev-actions">
            <button type="submit">Применить и начать заново</button>
            <button type="submit" data-fight>К схватке</button>
            <button type="button" data-reset>Сбросить</button>
          </div>
          <label class="dev-check"><input type="checkbox" data-invulnerable> Неуязвимость</label>
          <label class="dev-check"><input type="checkbox" data-zones> Зона удара и телеметрия</label>
        </form>
      </section>
      <output class="dev-readout" hidden></output>
    `
    root.append(shell)
    this.launch = shell.querySelector('.dev-toggle')!
    this.panel = shell.querySelector('.dev-panel')!
    this.form = shell.querySelector('form')!
    this.status = shell.querySelector('.dev-status')!
    this.readout = shell.querySelector('.dev-readout')!
    this.form.append(this.fields)
    this.renderFields()
    const toggle = (open: boolean) => {
      cancelInput()
      this.open = open
      this.panel.hidden = !open
      this.launch.setAttribute('aria-expanded', String(open))
      if (open) this.panel.querySelector('button')?.focus()
    }
    this.launch.onclick = () => toggle(!this.open)
    shell.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => {
      toggle(false)
      this.launch.focus()
    }
    this.form.onsubmit = event => {
      event.preventDefault()
      for (const apply of this.applyValues) apply()
      try { localStorage.setItem(storageKey, JSON.stringify({ balance: this.balance, world: this.world })) } catch { /* session only */ }
      this.updateStatus()
      toggle(false)
      restart(event.submitter instanceof HTMLElement && event.submitter.hasAttribute('data-fight'))
    }
    this.form.querySelector<HTMLButtonElement>('[data-reset]')!.onclick = () => {
      this.balance = structuredClone(defaultBalance)
      this.world = { ...defaultWorld }
      try { localStorage.removeItem(storageKey) } catch { /* session only */ }
      this.renderFields()
      restart(false)
    }
    this.form.querySelector<HTMLInputElement>('[data-invulnerable]')!.onchange = event => {
      this.invulnerable = (event.currentTarget as HTMLInputElement).checked
      this.updateStatus()
    }
    this.form.querySelector<HTMLInputElement>('[data-zones]')!.onchange = event => {
      this.zones = (event.currentTarget as HTMLInputElement).checked
    }
  }

  draw(run: SandboxRun, fps: number) {
    this.readout.hidden = !this.zones
    if (!this.zones || performance.now() < this.nextReadout) return
    this.nextReadout = performance.now() + 110
    const { combat, z } = run
    this.readout.textContent = [
      `${Math.round(fps)} FPS · ${run.phase} · Z ${z.toFixed(2)} · цель ${combat.target?.type ?? '—'}`,
      ...combat.enemies.map(enemy => `${enemy.type}  ${enemy.pose}  Z+${(enemy.z - z).toFixed(2)}  X ${enemy.x.toFixed(2)}`),
    ].join('\n')
  }

  private renderFields() {
    this.fields.replaceChildren()
    this.applyValues = []
    this.section('Игрок', this.balance, playerFields)
    this.section('Бой и комбо', this.balance, combatFields)
    this.section('Контратака', this.balance, counterFields)
    this.section('Хулиган', this.balance.enemies.thug, enemyFields)
    this.section('Быстрый хулиган', this.balance.enemies.quick, enemyFields)
    this.section('Громила', this.balance.enemies.brute, enemyFields)
    this.section('Маршрут', this.world, worldFields)
    this.updateStatus()
  }

  private section<T extends object>(title: string, values: T, fields: NumericField<T>[]) {
    const group = document.createElement('details')
    const header = document.createElement('summary')
    header.textContent = title
    group.append(header)
    for (const [key, label, min, max, step = 1] of fields) {
      const row = document.createElement('label')
      row.className = 'dev-field'
      const name = document.createElement('span')
      name.textContent = label
      const input = document.createElement('input')
      input.type = 'number'
      input.inputMode = step < 1 ? 'decimal' : 'numeric'
      input.min = String(min)
      input.max = String(max)
      input.step = 'any'
      input.value = String(values[key])
      input.required = true
      this.applyValues.push(() => { values[key] = input.valueAsNumber as T[typeof key] })
      row.append(name, input)
      group.append(row)
    }
    this.fields.append(group)
  }

  private updateStatus() {
    const custom = JSON.stringify(this.balance) !== JSON.stringify(defaultBalance) ||
      JSON.stringify(this.world) !== JSON.stringify(defaultWorld) || this.invulnerable
    this.status.textContent = custom ? 'Изменённые параметры' : 'Параметры по умолчанию'
    this.launch.textContent = custom ? 'DEV •' : 'DEV'
  }
}
