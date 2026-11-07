import type { CombatEvent } from '../combat/CombatSystem'
import type { Phase, SandboxRun } from '../game/SandboxRun'
import { route } from '../world/route'

const hints: Record<Phase, string> = {
  ready: '',
  moving: 'Автоматическое движение',
  encounter: 'Враги приближаются · дождись цели',
  combat: 'Тап — удар · удержание — блок',
  exit: 'Путь свободен',
  victory: '',
  defeat: '',
}

const eventLabels: Partial<Record<CombatEvent['kind'], string>> = {
  counter: 'COUNTER!',
  miss: 'MISS!',
  tired: 'НУЖНА ВЫНОСЛИВОСТЬ',
  block: 'БЛОК',
  broken: 'БЛОК ПРОБИТ',
  hurt: 'ПОЛУЧЕН УРОН',
}

export class HUD {
  private readonly hp: HTMLElement
  private readonly face: HTMLElement
  private readonly progress: HTMLProgressElement
  private readonly score: HTMLElement
  private readonly stamina: HTMLProgressElement
  private readonly staminaText: HTMLElement
  private readonly chain: HTMLElement
  private readonly pips: HTMLElement[]
  private readonly hint: HTMLElement
  private readonly feedback: HTMLElement
  private readonly overlay: HTMLElement
  private readonly heading: HTMLElement
  private readonly description: HTMLElement
  private readonly button: HTMLButtonElement
  private messageUntil = 0
  private lastPhase?: Phase

  constructor(root: HTMLElement, start: () => void) {
    const hud = document.createElement('div')
    hud.className = 'hud'
    hud.innerHTML = `
      <header class="top-bar">
        <div class="hp-group">
          <span class="face" aria-hidden="true"><i></i><b></b></span>
          <div><small>HP</small><strong data-hp></strong></div>
        </div>
        <div class="route"><small>PARK / 01</small><progress aria-label="Пройденный путь" max="1"></progress></div>
        <div class="points"><small>ОЧКИ</small><strong data-score></strong></div>
      </header>
      <div class="feedback"><strong data-combo></strong><b data-feedback></b></div>
      <footer class="bottom-bar">
        <div class="tip" data-hint></div>
        <div class="stamina-label"><span>ВЫНОСЛИВОСТЬ <b data-stamina></b></span><span class="pips" aria-label="Короткая комбинация"><i></i><i></i><i></i></span></div>
        <progress aria-label="Выносливость" data-stamina-meter></progress>
      </footer>
      <div class="round-overlay" hidden>
        <section class="round-card">
          <p class="round-kicker">PARK / COMBAT SANDBOX v0.1</p>
          <h1></h1><p class="round-copy"></p><button type="button"></button>
        </section>
      </div>
    `
    root.append(hud)
    this.hp = hud.querySelector('[data-hp]')!
    this.face = hud.querySelector('.face')!
    this.progress = hud.querySelector('.route progress')!
    this.score = hud.querySelector('[data-score]')!
    this.stamina = hud.querySelector('[data-stamina-meter]')!
    this.staminaText = hud.querySelector('[data-stamina]')!
    this.chain = hud.querySelector('[data-combo]')!
    this.pips = [...hud.querySelectorAll<HTMLElement>('.pips i')]
    this.hint = hud.querySelector('[data-hint]')!
    this.feedback = hud.querySelector('[data-feedback]')!
    this.overlay = hud.querySelector('.round-overlay')!
    this.heading = hud.querySelector('h1')!
    this.description = hud.querySelector('.round-copy')!
    this.button = hud.querySelector('button')!
    this.button.addEventListener('click', start)
  }

  reset() {
    this.lastPhase = undefined
    this.messageUntil = 0
    this.feedback.textContent = ''
  }

  show(event: CombatEvent, now: number) {
    const label = eventLabels[event.kind]
    if (!label) return
    this.feedback.textContent = label
    this.feedback.dataset.kind = event.kind
    this.messageUntil = now + 0.66
  }

  draw(run: SandboxRun, counterReady: boolean) {
    const { combat, phase, now } = run
    const hp = Math.ceil(combat.hp)
    const stamina = Math.floor(combat.stamina + 0.001)
    setText(this.hp, String(hp))
    const face = hp / combat.balance.hp < 0.35 ? 'critical' : hp / combat.balance.hp < 0.7 ? 'hurt' : 'ready'
    if (this.face.dataset.face !== face) this.face.dataset.face = face
    const score = String(combat.score).padStart(4, '0')
    if (this.score.textContent !== score) {
      if (combat.score) this.score.animate([{ color: '#ffce68' }, { color: '#ffefd3' }], { duration: 430 })
      this.score.textContent = score
    }
    this.progress.value = run.z / route.endZ
    this.stamina.max = combat.balance.stamina
    this.stamina.value = combat.stamina
    this.stamina.classList.toggle('broken', now < combat.brokenUntil)
    setText(this.staminaText, String(stamina))
    this.pips.forEach((pip, index) => pip.classList.toggle('lit', index < combat.step))
    this.pips[2].classList.toggle('primed', combat.step === 2)
    setText(this.chain, combat.combo >= 2 && !run.finished ? `${combat.combo} COMBO  ×${combat.multiplier}` : '')
    if (now >= this.messageUntil) setText(this.feedback, '')
    const hint = counterReady ? 'Жёлтый сигнал · тап для контратаки'
      : combat.blocking ? 'Блок поднят · отпусти для удара' : hints[phase]
    setText(this.hint, hint)
    if (phase !== this.lastPhase) {
      this.lastPhase = phase
      this.overlay.hidden = phase !== 'ready' && !run.finished
      if (phase === 'ready') {
        this.heading.textContent = "PUNCH 'N' GO"
        this.description.textContent = 'Одна схватка на парковой аллее. Тап — удар. Удержание — блок. Жёлтый сигнал — момент для контратаки.'
        this.button.textContent = 'Начать'
      } else if (run.finished) {
        this.heading.textContent = phase === 'victory' ? 'Путь свободен' : 'Нокаут'
        this.description.textContent = `Очки: ${combat.score} · Лучшее комбо: ${combat.bestCombo}`
        this.button.textContent = 'Сыграть ещё'
      }
    }
  }
}

function setText(element: HTMLElement, text: string) {
  if (element.textContent !== text) element.textContent = text
}
