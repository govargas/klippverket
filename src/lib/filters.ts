// Klippverkets filter-motor. Rena, testbara funktioner som arbetar på ImageData
// via canvas 2D. Det här är projektets unika tekniska hantverk.

export type RGB = [number, number, number]

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Xerox: gör bilden 1-bit (svart/vit) över en luminans-tröskel.
export function threshold(src: ImageData, level = 128): ImageData {
  const out = new ImageData(src.width, src.height)
  const s = src.data
  const o = out.data
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
  const s = src.data
  const o = out.data
  for (let i = 0; i < s.length; i += 4) {
    const t = luma(s[i], s[i + 1], s[i + 2]) / 255
    o[i] = shadow[0] + (highlight[0] - shadow[0]) * t
    o[i + 1] = shadow[1] + (highlight[1] - shadow[1]) * t
    o[i + 2] = shadow[2] + (highlight[2] - shadow[2]) * t
    o[i + 3] = s[i + 3]
  }
  return out
}

export type FilterId = 'none' | 'xerox' | 'duotone'
