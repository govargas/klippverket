// Typsnittsregister: en liten tidslinje genom typografihistorien, från
// romerska inskriptioner till fanzinets skrivmaskin. Varje post har en
// CSS-familj (laddas via Google Fonts i index.css), en vikt, om texten ska
// versaliseras (gement ser fult ut i frakturer/antikvor) och en trivia-rad.

export type FontId =
  | 'cinzel' | 'fraktur' | 'garamond' | 'playfair'
  | 'abril' | 'rye' | 'elite' | 'anton'

export type FontDef = {
  id: FontId
  label: string
  era: string
  family: string // CSS font-family-värde (med fallback)
  weight: number
  upper: boolean // versalisera texten (brutalistisk display) eller inte
  info: string
}

// Kronologisk ordning = typografins egen tidslinje.
export const FONTS: Record<FontId, FontDef> = {
  cinzel: {
    id: 'cinzel', label: 'Cinzel', era: 'antiken',
    family: "'Cinzel', serif", weight: 600, upper: true,
    info: 'Romerska kapitäler, mejslade i sten. Formen bygger på inskriptioner som den på Trajanus kolonn i Rom (~113 e.Kr.) — själva skelettet för alla våra versaler.',
  },
  fraktur: {
    id: 'fraktur', label: 'Fraktur', era: '1450-tal',
    family: "'UnifrakturMaguntia', cursive", weight: 400, upper: false,
    info: 'Svartfraktur — den täta gotiska stilen som Gutenberg satte i Europas första tryckta böcker. Den förblev standard för tyskt och svenskt tryck långt in på 1900-talet.',
  },
  garamond: {
    id: 'garamond', label: 'Garamond', era: '1500-tal',
    family: "'EB Garamond', serif", weight: 500, upper: false,
    info: 'Renässansantikva efter Claude Garamonts 1500-talstyper, formade efter humanisternas handstil. Ett av de mest långlivade boktypsnitten som någonsin skurits.',
  },
  playfair: {
    id: 'playfair', label: 'Playfair', era: '1700-tal',
    family: "'Playfair Display', serif", weight: 700, upper: false,
    info: 'Upplysningstidens antikva med hög kontrast mellan grov och hårfin linje. Möjlig när spetsiga stålpennor och slätare papper lät tryckare som Baskerville göra strecken tunnare.',
  },
  abril: {
    id: 'abril', label: 'Abril Fatface', era: '1800-tal',
    family: "'Abril Fatface', serif", weight: 400, upper: false,
    info: 'Den feta "fat face"-stilen som skrek från 1800-talets reklamaffischer. Industrialismens annonser behövde typer som syntes på håll — ju fetare desto bättre.',
  },
  rye: {
    id: 'rye', label: 'Rye', era: '1800-tal',
    family: "'Rye', serif", weight: 400, upper: true,
    info: 'Trätyp med kraftiga seriffer — den "egyptiska" slabstilen på cirkusaffischer och efterlysningar. Skuren i trä så att bokstäverna kunde tryckas riktigt stora och billigt.',
  },
  elite: {
    id: 'elite', label: 'Skrivmaskin', era: '1900-tal',
    family: "'Special Elite', monospace", weight: 400, upper: false,
    info: 'En sliten skrivmaskinsstil. Looken av karbonkopior, manifest och DIY-fanzines, hamrade fram en tangenttryckning i taget — fanzinekulturens egen röst.',
  },
  anton: {
    id: 'anton', label: 'Anton', era: 'nutid',
    family: "'Anton', Impact, sans-serif", weight: 700, upper: true,
    info: 'En tung, smal grotesk i arvet från 1800-talets grova trätyper. I dag arbetshästen för feta affischrubriker på webben — Klippverkets standardstil.',
  },
}

export const FONT_ORDER: FontId[] = [
  'cinzel', 'fraktur', 'garamond', 'playfair', 'abril', 'rye', 'elite', 'anton',
]

// Texten som ska ritas/visas, versaliserad om typsnittet vill det.
export function displayText(text: string, font: FontDef): string {
  return font.upper ? text.toUpperCase() : text
}

// CSS-deklaration för canvas (ctx.font) — vikt, storlek, familj.
export function fontSpec(font: FontDef, sizePx: number): string {
  return `${font.weight} ${sizePx}px ${font.family}`
}

// Säkerställ att alla använda typsnitt är inlästa innan export ritar i canvas,
// annars faller texten tillbaka till ett systemtypsnitt i PNG/PDF.
export async function ensureFontsLoaded(ids: Iterable<FontId>): Promise<void> {
  const jobs: Promise<unknown>[] = []
  for (const id of ids) {
    const f = FONTS[id]
    if (f) jobs.push(document.fonts.load(fontSpec(f, 64), 'AÅMjgQ'))
  }
  await Promise.all(jobs)
  await document.fonts.ready
}
