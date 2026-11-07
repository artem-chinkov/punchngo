export class TouchController {
  private pointer?: number
  private since = 0
  private held = false

  constructor(private readonly canvas: HTMLCanvasElement,
    private readonly enabled: () => boolean,
    private readonly threshold: () => number,
    private readonly attack: () => void,
    private readonly block: (active: boolean) => void,
  ) {
    canvas.addEventListener('pointerdown', this.down)
    canvas.addEventListener('pointerup', this.up)
    canvas.addEventListener('pointercancel', this.cancelPointer)
    canvas.addEventListener('lostpointercapture', this.cancelPointer)
    canvas.addEventListener('contextmenu', this.preventMenu)
    window.addEventListener('blur', this.cancel)
    document.addEventListener('visibilitychange', this.cancel)
  }

  update(now = performance.now()) {
    if (this.pointer === undefined || this.held || (now - this.since) / 1000 < this.threshold()) return
    this.held = true
    if (this.enabled()) this.block(true)
  }

  cancel = () => {
    const pointer = this.pointer
    this.pointer = undefined
    if (this.held) this.block(false)
    this.held = false
    if (pointer !== undefined && this.canvas.hasPointerCapture(pointer)) this.canvas.releasePointerCapture(pointer)
  }

  destroy() {
    this.cancel()
    this.canvas.removeEventListener('pointerdown', this.down)
    this.canvas.removeEventListener('pointerup', this.up)
    this.canvas.removeEventListener('pointercancel', this.cancelPointer)
    this.canvas.removeEventListener('lostpointercapture', this.cancelPointer)
    this.canvas.removeEventListener('contextmenu', this.preventMenu)
    window.removeEventListener('blur', this.cancel)
    document.removeEventListener('visibilitychange', this.cancel)
  }

  private down = (event: PointerEvent) => {
    if (event.button !== 0 || this.pointer !== undefined || !this.enabled()) return
    event.preventDefault()
    this.pointer = event.pointerId
    this.since = performance.now()
    this.canvas.setPointerCapture(event.pointerId)
  }

  private up = (event: PointerEvent) => {
    if (event.pointerId !== this.pointer) return
    const tap = !this.held && (performance.now() - this.since) / 1000 < this.threshold()
    this.cancel()
    if (tap && this.enabled()) this.attack()
  }

  private cancelPointer = (event: PointerEvent) => {
    if (event.pointerId === this.pointer) this.cancel()
  }

  private preventMenu = (event: MouseEvent) => event.preventDefault()
}
