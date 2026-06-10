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
function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
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

// --- dither: en hel familj felspridnings- och ordnade algoritmer --------------
type Kernel = { div: number; pts: Array<[number, number, number]> } // [dx, dy, vikt]
const KERNELS: Record<string, Kernel> = {
  floyd: { div: 16, pts: [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]] },
  atkinson: { div: 8, pts: [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]] },
  jarvis: { div: 48, pts: [[1, 0, 7], [2, 0, 5], [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3], [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1]] },
  stucki: { div: 42, pts: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2], [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1]] },
  sierra: { div: 32, pts: [[1, 0, 5], [2, 0, 3], [-2, 1, 2], [-1, 1, 4], [0, 1, 5], [1, 1, 4], [2, 1, 2], [-1, 2, 2], [0, 2, 3], [1, 2, 2]] },
  burkes: { div: 32, pts: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2]] },
}
function bayerMatrix(n: number): number[][] {
  if (n <= 2) return [[0, 2], [3, 1]]
  const half = bayerMatrix(n / 2), s = n / 2
  const m = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const b = half[y][x] * 4
    m[y][x] = b; m[y][x + s] = b + 2; m[y + s][x] = b + 3; m[y + s][x + s] = b + 1
  }
  return m
}
function quant(v: number, levels: number): number {
  const step = 255 / (levels - 1)
  return clampByte(Math.round(v / step) * step)
}

export function dither(src: ImageData, p: Params, ratio = 1): ImageData {
  const algo = str(p, 'algo', 'floyd')
  const levels = Math.max(2, Math.round(num(p, 'levels', 2)))
  const pixel = Math.max(1, Math.round(num(p, 'pixel', 1) * ratio))
  const ink = hexToRgb(str(p, 'ink', '#141414'))
  const w = src.width, h = src.height
  // arbeta i lägre upplösning (pixel>1) för chunky retro-look, skala sedan upp
  const gw = Math.max(1, Math.ceil(w / pixel)), gh = Math.max(1, Math.ceil(h / pixel))
  const g = new Float32Array(gw * gh)
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    // medelvärde över blocket
    let sum = 0, n = 0
    for (let dy = 0; dy < pixel; dy++) for (let dx = 0; dx < pixel; dx++) {
      const x = gx * pixel + dx, y = gy * pixel + dy
      if (x >= w || y >= h) continue
      const i = (y * w + x) * 4
      sum += luma(src.data[i], src.data[i + 1], src.data[i + 2]); n++
    }
    g[gy * gw + gx] = n ? sum / n : 0
  }
  if (algo === 'bayer4' || algo === 'bayer8') {
    const n = algo === 'bayer8' ? 8 : 4
    const m = bayerMatrix(n)
    const span = 255 / (levels - 1)
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const t = (m[y % n][x % n] + 0.5) / (n * n) - 0.5
      g[y * gw + x] = quant(g[y * gw + x] + t * span, levels)
    }
  } else {
    const ker = KERNELS[algo] ?? KERNELS.floyd
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const idx = y * gw + x
      const old = g[idx], nv = quant(old, levels), err = old - nv
      g[idx] = nv
      for (const [dx, dy, wt] of ker.pts) {
        const xi = x + dx, yi = y + dy
        if (xi < 0 || xi >= gw || yi < 0 || yi >= gh) continue
        g[yi * gw + xi] += (err * wt) / ker.div
      }
    }
  }
  // skala upp (nearest) och färga: mörkt → bläck, ljust → vitt
  const out = new ImageData(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = g[Math.floor(y / pixel) * gw + Math.floor(x / pixel)] / 255
    const o = (y * w + x) * 4
    out.data[o] = mix(ink[0], 255, v)
    out.data[o + 1] = mix(ink[1], 255, v)
    out.data[o + 2] = mix(ink[2], 255, v)
    out.data[o + 3] = src.data[(y * w + x) * 4 + 3]
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
    info: 'Dithering strör ut prickar i mönster och lurar ögat att se fler toner än det finns. Hjärtat i tidiga svartvita skärmar, GIF-bilder och dagens pixel-trend.',
    controls: [
      { kind: 'select', key: 'algo', label: 'Algoritm', def: 'floyd', options: [
        { value: 'floyd', label: 'Floyd–Steinberg', info: 'Floyd–Steinberg (1976): standarden. Sprider felet till fyra grannar — GIF-erans arbetshäst.' },
        { value: 'atkinson', label: 'Atkinson', info: 'Atkinson (1984): Bill Atkinson på Apple, looken i tidiga Macintosh och HyperCard. Behåller bara en del av felet, vilket ger ljusare, renare bilder.' },
        { value: 'jarvis', label: 'Jarvis–Judice–Ninke', info: 'Jarvis–Judice–Ninke (1976): sprider felet till tolv grannar — mjukare och mer detaljerat än Floyd–Steinberg, men långsammare.' },
        { value: 'stucki', label: 'Stucki', info: 'Stucki (1981): en snabbare, skarpare variant av Jarvis med ren tonövergång.' },
        { value: 'sierra', label: 'Sierra', info: 'Sierra (1989): Frankie Sierras familj av kärnor som balanserar skärpa och hastighet.' },
        { value: 'burkes', label: 'Burkes', info: 'Burkes (1988): en förenkling av Stucki — färre grannar, snabbare, lite grövre.' },
        { value: 'bayer4', label: 'Bayer 4×4', info: 'Ordnad dithering (Bayer, 1973): ett fast korsstygnsmönster i stället för slumpspridning. Looken hos tidiga skrivare och Game Boy.' },
        { value: 'bayer8', label: 'Bayer 8×8', info: 'Ordnad dithering (Bayer, 1973), finare 8×8-matris — tätare regelbundet mönster, mjukare toner.' },
      ] },
      { kind: 'range', key: 'levels', label: 'Nivåer', min: 2, max: 6, def: 2 },
      { kind: 'range', key: 'pixel', label: 'Pixelstorlek', min: 1, max: 8, def: 1 },
      { kind: 'color', key: 'ink', label: 'Bläck', def: '#141414' },
    ],
    apply: (s, p, r) => dither(s, p, r),
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
