// Klippverkets filter-motor. Rena funktioner som arbetar på ImageData via canvas 2D.
// Det här är projektets unika tekniska hantverk.

export type RGB = [number, number, number]
export type FilterId = 'none' | 'xerox' | 'duotone' | 'halftone' | 'dither' | 'grain'

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}
function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}
export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Xerox: 1-bit svart/vit över en luminans-tröskel.
export function threshold(src: ImageData, level = 128): ImageData {
  const out = new ImageData(src.width, src.height)
  const s = src.data, o = out.data
  for (let i = 0; i < s.length; i += 4) {
    const v = luma(s[i], s[i + 1], s[i + 2]) >= level ? 255 : 0
    o[i] = o[i + 1] = o[i + 2] = v
    o[i + 3] = s[i + 3]
  }
  return out
}

// Duoton / riso: mappa luminans till en gradient mellan två färger.
export function duotone(src: ImageData, shadow: RGB, highlight: RGB): ImageData {
  const out = new ImageData(src.width, src.height)
  const s = src.data, o = out.data
  for (let i = 0; i < s.length; i += 4) {
    const t = luma(s[i], s[i + 1], s[i + 2]) / 255
    o[i] = shadow[0] + (highlight[0] - shadow[0]) * t
    o[i + 1] = shadow[1] + (highlight[1] - shadow[1]) * t
    o[i + 2] = shadow[2] + (highlight[2] - shadow[2]) * t
    o[i + 3] = s[i + 3]
  }
  return out
}

// Raster / halftone: prickrutnät, prickstorlek växer med mörkret, valfri vinkel.
export function halftone(src: ImageData, cell = 6, angleDeg = 0): ImageData {
  const w = src.width, h = src.height
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#000000'
  const cs = Math.max(3, cell)
  const lumAt = (x: number, y: number) => {
    const xi = x < 0 ? 0 : x >= w ? w - 1 : x | 0
    const yi = y < 0 ? 0 : y >= h ? h - 1 : y | 0
    const i = (yi * w + xi) * 4
    return luma(src.data[i], src.data[i + 1], src.data[i + 2]) / 255
  }
  const ang = (angleDeg * Math.PI) / 180
  const cos = Math.cos(ang), sin = Math.sin(ang)
  const diag = Math.ceil(Math.hypot(w, h))
  for (let gy = -diag; gy < diag; gy += cs) {
    for (let gx = -diag; gx < diag; gx += cs) {
      const px = w / 2 + gx * cos - gy * sin
      const py = h / 2 + gx * sin + gy * cos
      if (px < -cs || px > w + cs || py < -cs || py > h + cs) continue
      const r = (cs / 2) * Math.sqrt(1 - lumAt(px, py))
      if (r > 0.35) { ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill() }
    }
  }
  return ctx.getImageData(0, 0, w, h)
}

// Dither (Floyd–Steinberg): kvantisera gråskala till få nivåer och sprid felet.
export function dither(src: ImageData, levels = 2): ImageData {
  const w = src.width, h = src.height
  const g = new Float32Array(w * h)
  for (let i = 0, p = 0; i < src.data.length; i += 4, p++) g[p] = luma(src.data[i], src.data[i + 1], src.data[i + 2])
  const lv = Math.max(2, levels)
  const step = 255 / (lv - 1)
  const out = new ImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      const old = g[idx]
      const nv = clampByte(Math.round(old / step) * step)
      const err = old - nv
      g[idx] = nv
      if (x + 1 < w) g[idx + 1] += (err * 7) / 16
      if (y + 1 < h) {
        if (x > 0) g[idx + w - 1] += (err * 3) / 16
        g[idx + w] += (err * 5) / 16
        if (x + 1 < w) g[idx + w + 1] += (err * 1) / 16
      }
      const o = idx * 4
      out.data[o] = out.data[o + 1] = out.data[o + 2] = nv
      out.data[o + 3] = src.data[o + 3]
    }
  }
  return out
}

// Korn: monokromt slumpbrus.
export function grain(src: ImageData, amount = 30): ImageData {
  const out = new ImageData(src.width, src.height)
  const s = src.data, o = out.data
  for (let i = 0; i < s.length; i += 4) {
    const n = (Math.random() * 2 - 1) * amount
    o[i] = clampByte(s[i] + n)
    o[i + 1] = clampByte(s[i + 1] + n)
    o[i + 2] = clampByte(s[i + 2] + n)
    o[i + 3] = s[i + 3]
  }
  return out
}
