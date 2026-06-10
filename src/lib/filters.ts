// Klippverkets filter-motor. Rena funktioner på ImageData (canvas 2D) plus ett
// register som beskriver varje filters reglage och trivia. Registret låter UI:t
// genereras automatiskt, så ett nytt filter är en post här i stället för
// ändringar på fem ställen. Det här är projektets unika tekniska hantverk:
// en liten tidslinje genom foto-, tryck- och designhistorien.

export type RGB = [number, number, number]
export type FilterId =
  | 'none' | 'engrave' | 'cyanotype' | 'sepia' | 'halftone' | 'cmyk'
  | 'solarize' | 'posterize' | 'xerox' | 'dither' | 'duotone' | 'grain'

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

// Läs en param som tal/sträng med fallback (filter får aldrig krascha på en
// saknad nyckel — gamla sparade ziner kanske inte har den).
const num = (p: Params, k: string, d: number) => (typeof p[k] === 'number' ? (p[k] as number) : d)
const str = (p: Params, k: string, d: string) => (typeof p[k] === 'string' ? (p[k] as string) : d)

// =============================================================================
// FILTER (rena pixel-/canvas-operationer)
// =============================================================================

// Xerox: 1-bit svart/vit. contrast spänner tonerna före tröskeln, generation
// härmar kopia-av-kopia (oskärpa + ny tröskel), invert ger vit-på-svart.
export function xerox(src: ImageData, p: Params): ImageData {
  const level = num(p, 'level', 128)
  const contrast = num(p, 'contrast', 0)
  const generation = Math.round(num(p, 'generation', 1))
  const invert = num(p, 'invert', 0) === 1
  const w = src.width, h = src.height
  const f = (259 * (contrast + 255)) / (255 * (259 - contrast)) // standard kontrastfaktor
  // binär buffert (0/255) från kontrastjusterad luminans
  let bin = new Uint8ClampedArray(w * h)
  for (let i = 0, pix = 0; i < src.data.length; i += 4, pix++) {
    const lv = clampByte(f * (luma(src.data[i], src.data[i + 1], src.data[i + 2]) - 128) + 128)
    bin[pix] = lv >= level ? 255 : 0
  }
  // generationsförfall: lätt 3x3-medel som suddar kanten, sedan ny tröskel
  for (let g = 1; g < generation; g++) {
    const next = new Uint8ClampedArray(w * h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let sum = 0, n = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xi = x + dx, yi = y + dy
        if (xi < 0 || yi < 0 || xi >= w || yi >= h) continue
        sum += bin[yi * w + xi]; n++
      }
      next[y * w + x] = sum / n >= 128 ? 255 : 0
    }
    bin = next
  }
  const out = new ImageData(w, h)
  for (let pix = 0; pix < bin.length; pix++) {
    const v = invert ? 255 - bin[pix] : bin[pix]
    const o = pix * 4
    out.data[o] = out.data[o + 1] = out.data[o + 2] = v
    out.data[o + 3] = src.data[o + 3]
  }
  return out
}

// Duoton / riso / triton: mappa luminans (via gammakurva) genom skugga → mellan →
// högdager. mid default mitt emellan så standardläget ser ut som en ren duoton.
export function duotone(src: ImageData, p: Params): ImageData {
  const shadow = hexToRgb(str(p, 'shadow', '#141414'))
  const highlight = hexToRgb(str(p, 'highlight', '#ff4fa0'))
  const mid = hexToRgb(str(p, 'mid', '#7a4060'))
  const gamma = num(p, 'gamma', 1)
  const out = new ImageData(src.width, src.height)
  const s = src.data, o = out.data
  for (let i = 0; i < s.length; i += 4) {
    const t = Math.pow(luma(s[i], s[i + 1], s[i + 2]) / 255, gamma)
    // piecewise: skugga→mellan (0–0.5), mellan→högdager (0.5–1)
    let r: number, g: number, b: number
    if (t < 0.5) { const u = t * 2; r = mix(shadow[0], mid[0], u); g = mix(shadow[1], mid[1], u); b = mix(shadow[2], mid[2], u) }
    else { const u = (t - 0.5) * 2; r = mix(mid[0], highlight[0], u); g = mix(mid[1], highlight[1], u); b = mix(mid[2], highlight[2], u) }
    o[i] = r; o[i + 1] = g; o[i + 2] = b; o[i + 3] = s[i + 3]
  }
  return out
}

// Raster / halftone: prickrutnät, prickstorlek växer med mörkret, valfri vinkel,
// form (rund/kvadrat) och bläck-/pappersfärg. ratio skalar cellen mot exporten.
export function halftone(src: ImageData, p: Params, ratio = 1): ImageData {
  const w = src.width, h = src.height
  const cell = num(p, 'cell', 6)
  const angleDeg = num(p, 'angle', 0)
  const shape = str(p, 'shape', 'round')
  const ink = str(p, 'ink', '#000000')
  const paper = str(p, 'paper', '#ffffff')
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = paper; ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = ink
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
      if (r > 0.35) {
        if (shape === 'square') { const sQ = r * 1.6; ctx.fillRect(px - sQ / 2, py - sQ / 2, sQ, sQ) }
        else { ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill() }
      }
    }
  }
  return ctx.getImageData(0, 0, w, h)
}

// CMYK-rosett: fyra halvtonsplåtar (cyan/magenta/gul/svart) i klassiska vinklar,
// multiplicerade på varandra. misregister förskjuter plåtarna ur passning som i
// en sliten tryckpress. Den dyraste effekten — fyra raster i ett.
export function cmyk(src: ImageData, p: Params, ratio = 1): ImageData {
  const w = src.width, h = src.height
  const cell = Math.max(3, Math.round(num(p, 'cell', 5) * ratio))
  const mis = num(p, 'misreg', 0) * ratio
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
  const sample = (x: number, y: number): [number, number, number, number] => {
    const xi = x < 0 ? 0 : x >= w ? w - 1 : x | 0
    const yi = y < 0 ? 0 : y >= h ? h - 1 : y | 0
    const i = (yi * w + xi) * 4
    const r = src.data[i] / 255, g = src.data[i + 1] / 255, b = src.data[i + 2] / 255
    const k = 1 - Math.max(r, g, b)
    if (k >= 1) return [0, 0, 0, 1]
    return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k]
  }
  // [vinkel°, färg, kanalindex, offsetX, offsetY]
  const plates: Array<[number, string, 0 | 1 | 2 | 3, number, number]> = [
    [15, '#00ffff', 0, mis, 0],
    [75, '#ff00ff', 1, 0, mis],
    [0, '#ffff00', 2, -mis, 0],
    [45, '#000000', 3, 0, -mis],
  ]
  ctx.globalCompositeOperation = 'multiply'
  const diag = Math.ceil(Math.hypot(w, h))
  for (const [angleDeg, color, idx, ox, oy] of plates) {
    ctx.fillStyle = color
    const ang = (angleDeg * Math.PI) / 180
    const cos = Math.cos(ang), sin = Math.sin(ang)
    for (let gy = -diag; gy < diag; gy += cell) {
      for (let gx = -diag; gx < diag; gx += cell) {
        const px = w / 2 + gx * cos - gy * sin
        const py = h / 2 + gx * sin + gy * cos
        if (px < -cell || px > w + cell || py < -cell || py > h + cell) continue
        const v = sample(px, py)[idx]
        const r = (cell / 2) * Math.sqrt(v)
        if (r > 0.35) { ctx.beginPath(); ctx.arc(px + ox, py + oy, r, 0, Math.PI * 2); ctx.fill() }
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over'
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

// Korn: brus, valbar kornstorlek (block skalas mot exporten) och färg av/på.
export function grain(src: ImageData, p: Params, ratio = 1): ImageData {
  const amount = num(p, 'amount', 30)
  const size = Math.max(1, Math.round(num(p, 'grainSize', 1) * ratio))
  const color = num(p, 'colorNoise', 0) === 1
  const w = src.width, h = src.height
  const out = new ImageData(w, h)
  const s = src.data, o = out.data
  const gw = Math.ceil(w / size)
  const noise = new Float32Array(gw * Math.ceil(h / size) * (color ? 3 : 1))
  for (let i = 0; i < noise.length; i++) noise[i] = (Math.random() * 2 - 1) * amount
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const bx = Math.floor(x / size), by = Math.floor(y / size)
    const ni = (by * gw + bx) * (color ? 3 : 1)
    const i = (y * w + x) * 4
    o[i] = clampByte(s[i] + noise[ni])
    o[i + 1] = clampByte(s[i + 1] + noise[ni + (color ? 1 : 0)])
    o[i + 2] = clampByte(s[i + 2] + noise[ni + (color ? 2 : 0)])
    o[i + 3] = s[i + 3]
  }
  return out
}

// Cyanotyp (1842): järnblåtryck. Gammakurva (exponering) + mappning mot
// berlinerblått och pappersvitt, med en gnutta korn för den kemiska känslan.
export function cyanotype(src: ImageData, p: Params): ImageData {
  const gamma = num(p, 'exposure', 1)
  const shadow: RGB = [10, 28, 74], highlight: RGB = [212, 230, 244]
  const out = new ImageData(src.width, src.height)
  const s = src.data, o = out.data
  for (let i = 0; i < s.length; i += 4) {
    const t = Math.pow(luma(s[i], s[i + 1], s[i + 2]) / 255, gamma)
    const n = (Math.random() * 2 - 1) * 6
    o[i] = clampByte(mix(shadow[0], highlight[0], t) + n)
    o[i + 1] = clampByte(mix(shadow[1], highlight[1], t) + n)
    o[i + 2] = clampByte(mix(shadow[2], highlight[2], t) + n)
    o[i + 3] = s[i + 3]
  }
  return out
}

// Sepia/albumin (1850–1900): brunt fototpapper. tone värmer/kyler, fade lyfter
// svärtan (blekt arkiv), vignette mörknar kanterna.
export function sepia(src: ImageData, p: Params): ImageData {
  const tone = num(p, 'tone', 0) / 100        // -0.5..0.5
  const fade = num(p, 'fade', 0) / 100         // 0..0.6
  const vig = num(p, 'vignette', 0) / 100      // 0..0.8
  const w = src.width, h = src.height
  const shadow: RGB = [38 + tone * 30, 26, 14 - tone * 20]
  const highlight: RGB = [240, 226 - tone * 10, 193 - tone * 30]
  const out = new ImageData(w, h)
  const s = src.data, o = out.data
  const cx = w / 2, cy = h / 2, maxD = Math.hypot(cx, cy)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4
    let t = luma(s[i], s[i + 1], s[i + 2]) / 255
    t = fade + t * (1 - fade)
    const d = Math.hypot(x - cx, y - cy) / maxD
    const v = vig > 0 ? 1 - vig * d * d : 1
    o[i] = clampByte(mix(shadow[0], highlight[0], t) * v)
    o[i + 1] = clampByte(mix(shadow[1], highlight[1], t) * v)
    o[i + 2] = clampByte(mix(shadow[2], highlight[2], t) * v)
    o[i + 3] = s[i + 3]
  }
  return out
}

// Gravyrlinjer (1600–1800-tal): skraffering. Parallella linjer vars bredd växer
// i skuggorna, som kopparstickets och sedelgravyrens linjer. density = avstånd.
export function engrave(src: ImageData, p: Params, ratio = 1): ImageData {
  const spacing = Math.max(2, Math.round(num(p, 'density', 6) * ratio))
  const angleDeg = num(p, 'angle', 45)
  const ink = hexToRgb(str(p, 'ink', '#141414'))
  const w = src.width, h = src.height
  const ang = (angleDeg * Math.PI) / 180
  const cos = Math.cos(ang), sin = Math.sin(ang)
  const out = new ImageData(w, h)
  const s = out.data, srcd = src.data
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4
    const lum = luma(srcd[i], srcd[i + 1], srcd[i + 2]) / 255
    const u = x * cos + y * sin
    const phase = ((u % spacing) + spacing) % spacing / spacing // 0..1
    const tri = Math.abs(phase * 2 - 1)                          // 0 mitt, 1 kant
    const isInk = tri < 1 - lum                                  // mörkt = bred linje
    s[i] = isInk ? ink[0] : 255
    s[i + 1] = isInk ? ink[1] : 255
    s[i + 2] = isInk ? ink[2] : 255
    s[i + 3] = srcd[i + 3]
  }
  return out
}

// Solarisering (1930-tal): Sabattier-effekten. Toner över en gräns vänds, det
// surrealistiska mörkrummet (Man Ray, Lee Miller). Per kanal för färgskiften.
export function solarize(src: ImageData, p: Params): ImageData {
  const t = num(p, 'threshold', 128)
  const k = num(p, 'strength', 100) / 100
  const out = new ImageData(src.width, src.height)
  const s = src.data, o = out.data
  for (let i = 0; i < s.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = s[i + c]
      o[i + c] = clampByte(v <= t ? v : v - 2 * (v - t) * k)
    }
    o[i + 3] = s[i + 3]
  }
  return out
}

// Posterisering (1960-tal): platta färgfält, psykedeliska affischer och Warhols
// screentryck. Kvantisera varje kanal till N nivåer.
export function posterize(src: ImageData, p: Params): ImageData {
  const levels = Math.max(2, Math.round(num(p, 'levels', 4)))
  const out = new ImageData(src.width, src.height)
  const s = src.data, o = out.data
  for (let i = 0; i < s.length; i += 4) {
    o[i] = quant(s[i], levels)
    o[i + 1] = quant(s[i + 1], levels)
    o[i + 2] = quant(s[i + 2], levels)
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
  era: string // kort epok-etikett för chippen, t.ex. "1842"
  info: string
  controls: ControlDef[]
  apply: (src: ImageData, p: Params, ratio: number) => ImageData
}

// Kronologisk ordning = liten tidslinje genom bildhistorien.
export const FILTERS: Record<FilterId, FilterDef> = {
  none: {
    id: 'none', label: 'INGEN', era: '',
    info: 'Ingen effekt — originalbilden som den ligger i KB:s arkiv.',
    controls: [],
    apply: (s) => s,
  },
  engrave: {
    id: 'engrave', label: 'GRAVYR', era: '1600-tal',
    info: 'Skraffering: parallella linjer som blir tjockare i skuggorna. Så byggde kopparstickare och sedelgravörer upp ton långt före fotografiet — för hand, linje för linje.',
    controls: [
      { kind: 'range', key: 'density', label: 'Linjeavstånd', min: 2, max: 14, def: 6 },
      { kind: 'range', key: 'angle', label: 'Vinkel', min: 0, max: 180, def: 45, suffix: '°' },
      { kind: 'color', key: 'ink', label: 'Bläck', def: '#141414' },
    ],
    apply: (s, p, r) => engrave(s, p, r),
  },
  cyanotype: {
    id: 'cyanotype', label: 'CYANOTYP', era: '1842',
    info: 'Järnblåtryck. Anna Atkins gjorde världens första fotobok med tekniken, och arkitektens "blueprint" är samma kemi. Allt blir berlinerblått mot pappersvitt.',
    controls: [
      { kind: 'range', key: 'exposure', label: 'Exponering', min: 0.5, max: 2.2, step: 0.05, def: 1 },
    ],
    apply: (s, p) => cyanotype(s, p),
  },
  sepia: {
    id: 'sepia', label: 'SEPIA', era: '1850',
    info: 'Albuminpapperets bruna ton, byggt på äggvita. Mycket av KB:s 1800-talsmaterial är just sådana foton — blekta, varma, lite vignetterade i kanten.',
    controls: [
      { kind: 'range', key: 'tone', label: 'Ton', min: -50, max: 50, def: 0 },
      { kind: 'range', key: 'fade', label: 'Blekning', min: 0, max: 60, def: 0 },
      { kind: 'range', key: 'vignette', label: 'Vignett', min: 0, max: 80, def: 0 },
    ],
    apply: (s, p) => sepia(s, p),
  },
  halftone: {
    id: 'halftone', label: 'RASTER', era: '1880',
    info: 'Bilden byggs av prickar, stora där det är mörkt. Tekniken uppfanns på 1880-talet för att kunna trycka fotografier i tidningar. Håll en gammal tidningsbild nära ögat så ser du prickarna.',
    controls: [
      { kind: 'range', key: 'cell', label: 'Prickstorlek', min: 3, max: 16, def: 6 },
      { kind: 'range', key: 'angle', label: 'Vinkel', min: 0, max: 90, def: 0, suffix: '°' },
      { kind: 'select', key: 'shape', label: 'Form', def: 'round', options: [
        { value: 'round', label: 'Rund' }, { value: 'square', label: 'Kvadrat' },
      ] },
      { kind: 'color', key: 'ink', label: 'Bläck', def: '#000000' },
      { kind: 'color', key: 'paper', label: 'Papper', def: '#ffffff' },
    ],
    apply: (s, p, r) => halftone(s, p, r),
  },
  cmyk: {
    id: 'cmyk', label: 'CMYK', era: '1900-tal',
    info: 'Fyrfärgstryck: cyan, magenta, gult och svart läggs som fyra rasterplåtar i olika vinklar och bildar tillsammans ett rosettmönster. Lichtenstein förstorade just det till konst.',
    controls: [
      { kind: 'range', key: 'cell', label: 'Prickstorlek', min: 3, max: 12, def: 5 },
      { kind: 'range', key: 'misreg', label: 'Passningsfel', min: 0, max: 6, def: 0 },
    ],
    apply: (s, p, r) => cmyk(s, p, r),
  },
  solarize: {
    id: 'solarize', label: 'SOLARISERING', era: '1930-tal',
    info: 'Sabattier-effekten: toner över en gräns vänds till sin motsats. Upptäcktes av en slump i mörkrummet och blev surrealismens signatur hos Man Ray och Lee Miller.',
    controls: [
      { kind: 'range', key: 'threshold', label: 'Gräns', min: 0, max: 255, def: 128 },
      { kind: 'range', key: 'strength', label: 'Styrka', min: 0, max: 100, def: 100, suffix: '%' },
    ],
    apply: (s, p) => solarize(s, p),
  },
  posterize: {
    id: 'posterize', label: 'POSTER', era: '1960-tal',
    info: 'Reducera bilden till några få platta färgfält. Greppet bakom 60-talets psykedeliska affischer och Warhols screentryck — färgen blir grafisk och plakatmässig.',
    controls: [
      { kind: 'range', key: 'levels', label: 'Nivåer', min: 2, max: 8, def: 4 },
    ],
    apply: (s, p) => posterize(s, p),
  },
  xerox: {
    id: 'xerox', label: 'XEROX', era: '1970-tal',
    info: 'Tröskel gör varje pixel svart eller vit, helt utan gråskala. Precis så fungerade fotokopiatorn — fanzinekulturens hårda, korniga signatur. Höj "generation" för kopia-av-kopia-förfall.',
    controls: [
      { kind: 'range', key: 'level', label: 'Tröskel', min: 0, max: 255, def: 128 },
      { kind: 'range', key: 'contrast', label: 'Kontrast', min: -100, max: 100, def: 0 },
      { kind: 'range', key: 'generation', label: 'Generation', min: 1, max: 4, def: 1 },
      { kind: 'select', key: 'invert', label: 'Negativ', def: '0', options: [
        { value: '0', label: 'Svart på vitt' }, { value: '1', label: 'Vitt på svart' },
      ] },
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
    info: 'Byter gråskalan mot färger: en för skuggorna, en för högdagrarna, en mittemellan. Härmar risografen och screentrycket, där varje färg trycktes som ett eget lager — ofta i grälla kombinationer.',
    controls: [
      { kind: 'color', key: 'shadow', label: 'Skugga', def: '#141414' },
      { kind: 'color', key: 'mid', label: 'Mellanton', def: '#7a4060' },
      { kind: 'color', key: 'highlight', label: 'Högdager', def: '#ff4fa0' },
      { kind: 'range', key: 'gamma', label: 'Gamma', min: 0.4, max: 2.5, step: 0.05, def: 1 },
    ],
    apply: (s, p) => duotone(s, p),
  },
  grain: {
    id: 'grain', label: 'KORN', era: 'tidlöst',
    info: 'Slumpmässigt brus, som filmkornet i analog film eller suset på en sliten kopia. Lite korn får en ren digital bild att kännas äldre, taktil och hemmagjord.',
    controls: [
      { kind: 'range', key: 'amount', label: 'Mängd', min: 0, max: 100, def: 30 },
      { kind: 'range', key: 'grainSize', label: 'Kornstorlek', min: 1, max: 6, def: 1 },
      { kind: 'select', key: 'colorNoise', label: 'Brus', def: '0', options: [
        { value: '0', label: 'Monokromt' }, { value: '1', label: 'Färg' },
      ] },
    ],
    apply: (s, p, r) => grain(s, p, r),
  },
}

export const FILTER_ORDER: FilterId[] = [
  'none', 'engrave', 'cyanotype', 'sepia', 'halftone', 'cmyk',
  'solarize', 'posterize', 'xerox', 'dither', 'duotone', 'grain',
]

// Alla filters reglage-defaults i ett platt objekt. Nyckeln är unik per reglage
// (level, shadow, cell, algo, …) så ett enda params-objekt räcker per bild och
// filterbyte behåller övriga värden. Sparade ziner som saknar nyare nycklar
// får dem ifyllda härifrån vid inläsning.
export function defaultParams(): Params {
  const p: Params = {}
  for (const f of Object.values(FILTERS)) {
    for (const c of f.controls) p[c.key] = c.def
  }
  return p
}
