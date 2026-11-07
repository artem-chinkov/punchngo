import type Phaser from 'phaser'
import type { AssetId, EnemyType } from './ids'

type Graphics = Phaser.GameObjects.Graphics
const ink = 0x20272a
const palette: Record<EnemyType, [number, number, number, number]> = {
  thug: [0xbd4b38, 0xef7a55, 0xd98b62, 0x24373c],
  quick: [0x227e88, 0x58c6bb, 0xe7b483, 0x263341],
  brute: [0x694775, 0xa476a4, 0xba724f, 0x3e3648],
}

export function drawPlaceholder(g: Graphics, id: AssetId, w: number, h: number) {
  if (id === 'park.sky') {
    g.fillStyle(0xe8bd83).fillRect(0, 0, w, h)
    g.fillStyle(0xf3ce92).fillRect(0, h * 0.32, w, h * 0.68)
    g.fillStyle(0xffe3a6).fillCircle(w * 0.72, h * 0.57, 33)
    return
  }
  if (id === 'park.ridge.far' || id === 'park.ridge.near') {
    const near = id === 'park.ridge.near'
    g.fillStyle(near ? 0x637e59 : 0x9c9d70)
    for (let i = -1; i <= 13; i++) {
      g.fillEllipse(i * 37, h * 0.59, near ? 78 : 96, h * (0.6 + (i & 3) * 0.1))
    }
    g.fillRect(0, h * 0.61, w, h * 0.39)
    return
  }
  if (id === 'park.tree') {
    g.fillStyle(0x332d28).fillRect(61, 86, 24, 127)
    g.fillStyle(0x634634).fillRect(63, 111, 12, 99)
    g.lineStyle(9, 0x463628).lineBetween(71, 161, 37, 111).lineBetween(77, 147, 107, 106)
    g.fillStyle(0x1d4031).fillEllipse(70, 76, 139, 105).fillEllipse(78, 48, 112, 94)
    g.fillStyle(0x326345).fillEllipse(52, 62, 94, 77).fillEllipse(83, 37, 87, 69)
    g.fillStyle(0x508251).fillEllipse(51, 48, 62, 48).fillEllipse(86, 26, 59, 44)
    g.fillStyle(0x769356).fillEllipse(48, 41, 33, 15)
    return
  }
  if (id === 'park.bench') {
    g.fillStyle(ink).fillRect(16, 28, 7, 41).fillRect(92, 28, 7, 41).fillRect(5, 44, 104, 11)
    g.fillStyle(0x663f33).fillRoundedRect(9, 10, 96, 30, 4).fillRoundedRect(3, 40, 108, 11, 3)
    g.fillStyle(0xc0855d).fillRect(12, 12, 90, 6).fillRect(12, 23, 90, 5).fillRect(8, 41, 98, 5)
    return
  }
  if (id === 'fist.left' || id === 'fist.right') {
    const thumb = id === 'fist.left' ? 96 : 12
    g.fillStyle(ink).fillRoundedRect(26, 76, 99, 128, 28)
    g.fillStyle(0xd98d5d).fillRoundedRect(32, 74, 87, 130, 24)
    g.fillStyle(0x9f543a).fillRect(37, 137, 77, 67)
    g.fillStyle(0x203c3c).fillRect(28, 159, 95, 45)
    g.fillStyle(0x417268).fillRect(29, 158, 94, 12)
    g.fillStyle(ink).fillRoundedRect(11, 26, 128, 104, 28)
    g.fillStyle(0xc3724c).fillRoundedRect(16, 34, 118, 91, 23)
    g.fillStyle(0xf4af77).fillRoundedRect(19, 30, 110, 51, 19)
    g.lineStyle(3, 0xb66a49)
    for (let x = 43; x <= 99; x += 28) g.lineBetween(x, 42, x - 2, 70)
    g.fillStyle(ink).fillRoundedRect(thumb, 69, 44, 44, 15)
    g.fillStyle(0xe39b68).fillRoundedRect(thumb + 3, 72, 37, 33, 13)
    g.fillStyle(0xffd495).fillRoundedRect(28, 34, 56, 6, 3)
    return
  }

  const [shirt, light, skin, pants] = palette[id]
  const x = w / 2
  const body = w * 0.68
  const head = w * (id === 'brute' ? 0.44 : 0.49)
  const headY = h * 0.20
  g.fillStyle(ink).fillRoundedRect(x - body * 0.44, h * 0.59, body * 0.88, h * 0.38, 9)
  g.fillStyle(pants).fillRoundedRect(x - body * 0.39, h * 0.60, body * 0.78, h * 0.34, 7)
  g.fillStyle(ink).fillRect(x - 3, h * 0.76, 6, h * 0.22)
  g.fillRoundedRect(x - body * 0.48, h * 0.90, body * 0.45, h * 0.08, 5)
  g.fillRoundedRect(x + body * 0.04, h * 0.90, body * 0.45, h * 0.08, 5)
  g.fillRoundedRect(x - body / 2 - 4, h * 0.32, body + 8, h * 0.37, 15)
  g.fillStyle(shirt).fillRoundedRect(x - body / 2, h * 0.32, body, h * 0.34, 12)
  g.fillStyle(light).fillRoundedRect(x - body * 0.30, h * 0.36, body * 0.60, 9, 4)
  for (const side of [-1, 1]) {
    const armX = x + side * (body / 2 + 1)
    g.fillStyle(ink).fillEllipse(armX, h * 0.49, w * 0.29, h * 0.29)
    g.fillStyle(shirt).fillEllipse(armX, h * 0.46, w * 0.22, h * 0.21)
    g.fillStyle(skin).fillEllipse(armX + side * 3, h * 0.54, w * 0.21, h * 0.12)
  }
  g.fillStyle(ink).fillEllipse(x, headY, head + 8, h * 0.31)
  g.fillStyle(skin).fillRoundedRect(x - head / 2, headY - h * 0.10, head, h * 0.22, 10)
  g.fillStyle(0x382d29).fillRoundedRect(x - head / 2 - 1, headY - h * 0.14, head + 2, h * 0.09, 6)
  if (id === 'quick') g.fillStyle(light).fillRect(x - head / 2 - 3, headY - h * 0.062, head + 6, 5)
  g.fillStyle(ink).fillRect(x - head * 0.32, headY - 2, 8, 4).fillRect(x + head * 0.32 - 8, headY - 2, 8, 4)
  g.fillRect(x - 6, headY + h * 0.065, 12, 3)
  if (id === 'brute') g.fillStyle(0xffc27a).fillRect(x - 11, h * 0.47, 22, 6)
}
