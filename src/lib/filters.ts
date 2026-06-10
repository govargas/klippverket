// Klippverkets filter-motor. Rena funktioner på ImageData (canvas 2D) plus ett
// register som beskriver varje filters reglage och trivia. Registret låter UI:t
// genereras automatiskt, så ett nytt filter är en post här i stället för
// ändringar på fem ställen. Det här är projektets unika tekniska hantverk.

export type RGB = [number, number, number]
export type FilterId = 'none' | 'xerox' | 'duotone' | 'halftone' | 'dither' | 'grain'

export type ParamValue = number | string
export type Params = Record<string, ParamValue>

// --- grundläggande hjälpare ---------------------------------------------------
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

const num = (p: Params, k: string, d: number) => (typeof p[k] === 'number' ? (p[k] as number) : d)
const str = (p: Params, k: string, d: string) => (typeof p[k] === 'string' ? (p[k] as string) : d)

// =============================================================================
// FILTER (rena pixel-/canvas-operationer)
// =============================================================================

// Xerox: 1-bit svart/vit över en luminans-tröskel.
export function xerox(src: ImageData, p: Params): ImageData {
  const level = num(p, 'level', 128)
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
export function duotone(src: ImageData, p: Params): ImageData {
  const shadow = hexToRgb(str(p, 'shadow', '#141414'))
  const highlight = hexToRgb(str(p, 'highlight', '#ff4fa0'))
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
// ratio skalar cellen mot exportupplösningen.
export function halftone(src: ImageData, p: Params, ratio = 1): ImageData {
  const w = src.width, h = src.height
  const cell = num(p, 'cell', 6)
  const angleDeg = num(p, 'angle', 0)
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#000000'
  const cs = Math.max(3, Math.round(cell * ratio))
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
export function dither(src: ImageData, p: Params): ImageData {
  const levels = Math.max(2, Math.round(num(p, 'levels', 2)))
  const w = src.width, h = src.height
  const g = new Float32Array(w * h)
  for (let i = 0, pix = 0; i < src.data.length; i += 4, pix++) g[pix] = luma(src.data[i], src.data[i + 1], src.data[i + 2])
  const step = 255 / (levels - 1)
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
export function grain(src: ImageData, p: Params): ImageData {
  const amount = num(p, 'amount', 30)
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

// =============================================================================
// REGISTER: reglage + trivia + apply per filter. UI:t läser detta.
// =============================================================================

export type ControlDef =
  | { kind: 'range'; key: string; label: string; min: number; max: number; step?: number; def: number; suffix?: string }
  | { kind: 'color'; key: string; label: string; def: string }
  | { kind: 'select'; key: string; label: string; def: string; options: Array<{ value: string; label: string; info?: string }> }

export type FilterDef = {
  id: FilterId
  label: string
  era: string // kort epok-etikett för chippen
  info: string
  controls: ControlDef[]
  apply: (src: ImageData, p: Params, ratio: number) => ImageData
}

export const FILTERS: Record<FilterId, FilterDef> = {
  none: {
    id: 'none', label: 'INGEN', era: '',
    info: 'Ingen effekt — originalbilden som den ligger i KB:s arkiv.',
    controls: [],
    apply: (s) => s,
  },
  halftone: {
    id: 'halftone', label: 'RASTER', era: '1880',
    info: 'Rastret bygger upp bilden av prickar, stora där det är mörkt och små där det är ljust. Tekniken uppfanns på 1880-talet för att kunna trycka fotografier i tidningar. Håll en gammal tidningsbild nära ögat så ser du prickarna.',
    controls: [
      { kind: 'range', key: 'cell', label: 'Prickstorlek', min: 3, max: 16, def: 6 },
      { kind: 'range', key: 'angle', label: 'Vinkel', min: 0, max: 90, def: 0, suffix: '°' },
    ],
    apply: (s, p, r) => halftone(s, p, r),
  },
  xerox: {
    id: 'xerox', label: 'XEROX', era: '1970-tal',
    info: 'Tröskel gör varje pixel antingen svart eller vit, helt utan gråskala. Precis så fungerade fotokopiatorn och tidiga faxar, och det blev fanzinekulturens hårda, korniga signatur.',
    controls: [
      { kind: 'range', key: 'level', label: 'Tröskel', min: 0, max: 255, def: 128 },
    ],
    apply: (s, p) => xerox(s, p),
  },
  dither: {
    id: 'dither', label: 'DITHER', era: '1976',
    info: 'Dithering strör ut prickar i mönster och lurar ögat att se fler toner än det egentligen finns. Det användes flitigt på tidiga svartvita datorskärmar och i den tidiga webbens 256-färgsbilder.',
    controls: [
      { kind: 'range', key: 'levels', label: 'Nivåer', min: 2, max: 6, def: 2 },
    ],
    apply: (s, p) => dither(s, p),
  },
  duotone: {
    id: 'duotone', label: 'DUOTON', era: '1980-tal',
    info: 'Duoton byter ut gråskalan mot två färger, en för skuggorna och en för högdagrarna. Det härmar risografen och tidigt screentryck, där varje färg trycktes som ett eget lager, ofta i grälla kombinationer.',
    controls: [
      { kind: 'color', key: 'shadow', label: 'Skugga', def: '#141414' },
      { kind: 'color', key: 'highlight', label: 'Högdager', def: '#ff4fa0' },
    ],
    apply: (s, p) => duotone(s, p),
  },
  grain: {
    id: 'grain', label: 'KORN', era: 'tidlöst',
    info: 'Korn lägger på slumpmässigt brus, som filmkornet i analog film eller suset på en sliten kopia. Lite korn får en ren digital bild att kännas äldre, taktil och hemmagjord.',
    controls: [
      { kind: 'range', key: 'amount', label: 'Mängd', min: 0, max: 100, def: 30 },
    ],
    apply: (s, p) => grain(s, p),
  },
}

// Kronologisk ordning = liten tidslinje genom bildhistorien.
export const FILTER_ORDER: FilterId[] = ['none', 'halftone', 'xerox', 'dither', 'duotone', 'grain']

// Alla filters reglage-defaults i ett platt objekt. Nyckeln är unik per reglage
// (level, shadow, cell, …) så ett enda params-objekt räcker per bild och
// filterbyte behåller övriga värden. Sparade ziner som saknar nyare nycklar
// får dem ifyllda härifrån vid inläsning.
export function defaultParams(): Params {
  const p: Params = {}
  for (const f of Object.values(FILTERS)) {
    for (const c of f.controls) p[c.key] = c.def
  }
  return p
}
