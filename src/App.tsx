import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react'
import { threshold, duotone, halftone, dither, grain, hexToRgb, type FilterId } from './lib/filters'
import { searchFreeImages, type KbImage } from './lib/kb'

const INK = '#141414'
const PAPER = '#F2EFE6'
const ACID = '#D8FF3E'
const PINK = '#FF4FA0'
const MUTED = '#595959'
const PAGE_W = 460
const PAGE_H = 651
const IMG_BASE = 200

type Base = { id: string; x: number; y: number; scale: number; z: number }
type ImgEl = Base & {
  kind: 'image'; src: KbImage; img: HTMLImageElement
  filter: FilterId; level: number; shadow: string; highlight: string
  cell: number; angle: number; levels: number; amount: number
}
type TextEl = Base & { kind: 'text'; text: string; size: number; color: string }
type El = ImgEl | TextEl
type Page = { id: string; elements: El[] }

const FILTER_ORDER: FilterId[] = ['none', 'xerox', 'duotone', 'halftone', 'dither', 'grain']
const FILTER_LABEL: Record<FilterId, string> = { none: 'INGEN', xerox: 'XEROX', duotone: 'DUOTON', halftone: 'RASTER', dither: 'DITHER', grain: 'KORN' }
const FILTER_INFO: Record<FilterId, string> = {
  none: 'Ingen effekt — originalbilden som den ligger i KB:s arkiv.',
  xerox: 'Tröskel gör varje pixel antingen svart eller vit, helt utan gråskala. Precis så fungerade fotokopiatorn och tidiga faxar, och det blev fanzinekulturens hårda, korniga signatur.',
  duotone: 'Duoton byter ut gråskalan mot två färger, en för skuggorna och en för högdagrarna. Det härmar risografen och tidigt screentryck, där varje färg trycktes som ett eget lager, ofta i grälla kombinationer.',
  halftone: 'Rastret bygger upp bilden av prickar, stora där det är mörkt och små där det är ljust. Tekniken uppfanns på 1880-talet för att kunna trycka fotografier i tidningar. Håll en gammal tidningsbild nära ögat så ser du prickarna.',
  dither: 'Dithering strör ut prickar i mönster och lurar ögat att se fler toner än det egentligen finns. Det användes flitigt på tidiga svartvita datorskärmar och i den tidiga webbens 256-färgsbilder.',
  grain: 'Korn lägger på slumpmässigt brus, som filmkornet i analog film eller suset på en sliten kopia. Lite korn får en ren digital bild att kännas äldre, taktil och hemmagjord.',
}

let counter = 0
const uid = () => 'e' + ++counter
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const nextZ = (els: El[]) => (els.length ? Math.max(...els.map((e) => e.z)) + 1 : 1)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const THEMES = ['Porträtt', 'Affischer', 'Kartor', 'Kopparstick', 'Fartyg', 'Stockholm', 'Blommor', 'Ornament']
const DECADES = [1600, 1700, 1800, 1850, 1880, 1900, 1920]
const SURPRISE = ['Porträtt', 'Affischer', 'Kartor', 'Stockholm', 'Kunglig', 'Fågel', 'Stad', 'Fest', 'Kopparstick']
const rnd = (n: number) => Math.floor(Math.random() * n)

// Full upplösning för export, lägre för live-förhandsvisning. Bilden visas
// ändå bara ~200px på ytan, så att filtrera 700px vid varje slider-steg är
// slöseri som fryser UI:t. Förhandsvisningen filtrerar färre pixlar.
const EXPORT_CAP = 700
const PREVIEW_CAP = 360

function filteredCanvas(el: ImgEl, cap = EXPORT_CAP): HTMLCanvasElement {
  const iw = el.img.naturalWidth || el.img.width
  const ih = el.img.naturalHeight || el.img.height
  if (!iw || !ih) { const blank = document.createElement('canvas'); blank.width = 1; blank.height = 1; return blank }
  const maxDim = Math.max(iw, ih)
  const s = Math.min(1, cap / maxDim)
  const w = Math.max(1, Math.round(iw * s))
  const h = Math.max(1, Math.round(ih * s))
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.drawImage(el.img, 0, 0, w, h)
  if (el.filter === 'none') return c
  const base = ctx.getImageData(0, 0, w, h)
  let out: ImageData
  if (el.filter === 'xerox') out = threshold(base, el.level)
  else if (el.filter === 'duotone') out = duotone(base, hexToRgb(el.shadow), hexToRgb(el.highlight))
  else if (el.filter === 'halftone') {
    // Prickstorleken är i pixlar, så den måste skalas mot exportupplösningen,
    // annars ser rastret olika ut i förhandsvisning och export.
    const ratio = Math.min(maxDim, cap) / Math.min(maxDim, EXPORT_CAP)
    out = halftone(base, Math.max(3, Math.round(el.cell * ratio)), el.angle)
  }
  else if (el.filter === 'dither') out = dither(base, el.levels)
  else out = grain(base, el.amount)
  ctx.putImageData(out, 0, 0)
  return c
}

function renderPage(els: El[]): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = PAGE_W; c.height = PAGE_H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#F6F3EA'; ctx.fillRect(0, 0, PAGE_W, PAGE_H)
  for (const el of [...els].sort((a, b) => a.z - b.z)) {
    if (el.kind === 'image') {
      const fc = filteredCanvas(el)
      const w = el.scale * IMG_BASE
      ctx.drawImage(fc, el.x, el.y, w, w * (fc.height / fc.width))
    } else {
      ctx.fillStyle = el.color
      ctx.font = '700 ' + el.size + "px Anton, Impact, sans-serif"
      ctx.textBaseline = 'top'
      ctx.fillText(el.text, el.x, el.y)
    }
  }
  const firstImg = els.find((e): e is ImgEl => e.kind === 'image')
  if (firstImg) {
    ctx.fillStyle = INK; ctx.fillRect(0, PAGE_H - 24, PAGE_W, 24)
    ctx.fillStyle = PAPER; ctx.font = "10px 'Space Mono', monospace"; ctx.textBaseline = 'alphabetic'
    ctx.fillText(trunc([firstImg.src.title, firstImg.src.creator, firstImg.src.year].filter(Boolean).join(' · '), 60) + ' · KB', 8, PAGE_H - 8)
  }
  return c
}

const STORE = 'klippverket:zines'
type SavedZine = { id: string; name: string; savedAt: number; doc: string }
function loadStore(): SavedZine[] { try { return JSON.parse(localStorage.getItem(STORE) || '[]') } catch { return [] } }
function saveStore(list: SavedZine[]) { localStorage.setItem(STORE, JSON.stringify(list)) }
function b64encode(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}
function b64decode(b64: string): string {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => resolve(i); i.onerror = () => resolve(i); i.src = src })
}
function serialize(pages: Page[]): string {
  return JSON.stringify({ v: 1, pages }, (k, v) => (k === 'img' ? undefined : v))
}
async function deserialize(json: string): Promise<Page[]> {
  const doc = JSON.parse(json)
  const pages: Page[] = []
  for (const pg of doc.pages ?? []) {
    const els: El[] = []
    for (const e of pg.elements ?? []) {
      if (e.kind === 'image') { const img = await loadImage(e.src.fullImage); els.push({ ...e, id: uid(), img }) }
      else els.push({ ...e, id: uid() })
    }
    pages.push({ id: uid(), elements: els })
  }
  return pages
}

function ImageNode({ el }: { el: ImgEl }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    // Koalescera till en omräkning per animationsruta: vid snabb slider-dragning
    // hinner cleanup avbryta den väntande rutan, så bara senaste värdet renderas.
    const raf = requestAnimationFrame(() => {
      const c = ref.current
      if (!c) return
      const fc = filteredCanvas(el, PREVIEW_CAP)
      c.width = fc.width; c.height = fc.height
      c.getContext('2d')!.drawImage(fc, 0, 0)
    })
    return () => cancelAnimationFrame(raf)
  }, [el.img, el.filter, el.level, el.shadow, el.highlight, el.cell, el.angle, el.levels, el.amount])
  return <canvas ref={ref} aria-hidden="true" style={{ width: el.scale * IMG_BASE, height: 'auto', display: 'block', pointerEvents: 'none' }} />
}

function About({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { closeRef.current?.focus() }, [])
  return (
    <div role="dialog" aria-modal="true" aria-label="Om Klippverket" onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: PAPER, border: '2px solid ' + INK, maxWidth: 560, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 24 }}>
        <h2 className="disp" style={{ fontSize: 26, marginBottom: 4 }}>Om Klippverket</h2>
        <p className="mono" style={{ fontSize: 13, lineHeight: 1.7 }}>En DIY-zineverkstad som gör KB:s öppna kulturarv till kreativt råmaterial. Sök fria bilder ur Kungliga bibliotekets samlingar, klipp ihop dem på en yta med fotokopierings- och riso-filter, lägg till text och exportera en zine-sida med källhänvisning.</p>
        <h3 className="disp" style={{ fontSize: 16, marginTop: 16 }}>Vad är en zine?</h3>
        <p className="mono" style={{ fontSize: 12, lineHeight: 1.7 }}>En zine (kortform av magazine, ofta även "fanzine") är ett självgjort, småskaligt häfte: klippt, klistrat och kopierat för hand. Kulturen växte fram i punkens och science fiction-fandomens DIY-anda, ingen förläggare, inga regler, vem som helst kan göra en. Klippverket bygger på samma tanke men med kulturarvet som råmaterial. När gamla kartor, affischer och porträtt går att klippa om blir historien inte bara bevarad utan möjlig att leka med, remixa och göra till sin egen. Tillgängliggörande i praktiken, från arkivhylla till köksbord.</p>
        <h3 className="disp" style={{ fontSize: 16, marginTop: 16 }}>Teknik</h3>
        <p className="mono" style={{ fontSize: 12, lineHeight: 1.7 }}>React, TypeScript, Vite. Egen bildfilter-motor i canvas 2D. KB:s öppna sök-API via en liten bild-/sök-proxy (serverless) så bilderna kan bearbetas i canvas.</p>
        <h3 className="disp" style={{ fontSize: 16, marginTop: 16 }}>Tillgänglighet</h3>
        <p className="mono" style={{ fontSize: 12, lineHeight: 1.7 }}>Responsiv från 320 px. Tangentbords- och pekstyrd yta, semantiska knappar, synligt fokus och skärmläsar-annonser. Automatisk axe-granskning utan anmärkningar (inkl. kontrast). På ytan: Tab markerar, piltangenter flyttar, +/− skalar, Delete tar bort. Medveten begränsning: själva bildkompositionen ritas i canvas och exponeras inte pixel för pixel för skärmläsare — varje objekt har istället en beskrivande etikett.</p>
        <h3 className="disp" style={{ fontSize: 16, marginTop: 16 }}>Källa &amp; licens</h3>
        <p className="mono" style={{ fontSize: 12, lineHeight: 1.7 }}>Allt material kommer från KB Digitalt, Kungliga bibliotekets söktjänst för digitaliserat kulturarv: bilder, kartor, affischer, vykort, porträtt, handskrifter och mycket mer. Det mesta är fritt att använda eftersom upphovsrätten har upphört. Klippverket hämtar det via KB:s öppna sök-API (data.kb.se) och visar i första hand det som är fritt eller public domain där metadatan tillåter det. Materialet är kurerat och mest historiskt, så moderna ord ger ofta inga träffar, men det historiska djupet är också det som ger den råa, tidlösa känslan. Källan bäddas in i varje export.</p>
        <h3 className="disp" style={{ fontSize: 16, marginTop: 16 }}>Koncept och utveckling</h3>
        <p className="mono" style={{ fontSize: 12, lineHeight: 1.7 }}>Talo Vargas</p>
        <button ref={closeRef} onClick={onClose} className="disp" style={{ marginTop: 18, background: INK, color: PAPER, border: 'none', padding: '10px 18px', fontSize: 15 }}>Stäng</button>
      </div>
    </div>
  )
}

function MyZines({ pages, onLoad, onClose, say }: { pages: Page[]; onLoad: (p: Page[]) => void; onClose: () => void; say: (m: string) => void }) {
  const [list, setList] = useState<SavedZine[]>(() => loadStore())
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { closeRef.current?.focus() }, [])
  const save = () => {
    const name = (window.prompt('Namn på zinet?', 'Zine ' + (list.length + 1)) || '').trim()
    if (!name) return
    const next = [{ id: uid(), name, savedAt: Date.now(), doc: serialize(pages) }, ...list]
    setList(next); saveStore(next); say('Sparade: ' + name)
  }
  const share = async () => {
    const link = location.origin + location.pathname + '#z=' + encodeURIComponent(b64encode(serialize(pages)))
    try { await navigator.clipboard.writeText(link); say('Delningslänk kopierad till urklipp') }
    catch { location.hash = 'z=' + encodeURIComponent(b64encode(serialize(pages))); say('Länken ligger nu i adressfältet') }
  }
  const open = async (z: SavedZine) => { const pgs = await deserialize(z.doc); if (pgs.length) onLoad(pgs); onClose() }
  const del = (id: string) => { const next = list.filter((z) => z.id !== id); setList(next); saveStore(next); say('Tog bort sparat zine') }
  return (
    <div role="dialog" aria-modal="true" aria-label="Mina zines" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: PAPER, border: '2px solid ' + INK, maxWidth: 520, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 24 }}>
        <h2 className="disp" style={{ fontSize: 24, marginBottom: 10 }}>Mina zines</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button className="chip" onClick={save}>Spara nuvarande</button>
          <button className="chip" onClick={() => void share()}>Kopiera delningslänk</button>
        </div>
        {list.length === 0 && <p className="mono" style={{ fontSize: 12, color: MUTED }}>Inga sparade zines än. Allt sparas lokalt i din webbläsare.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((z) => (
            <div key={z.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: '1.5px solid ' + INK, padding: '8px 10px' }}>
              <div style={{ minWidth: 0 }}>
                <div className="mono" style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.name}</div>
                <div className="mono" style={{ fontSize: 10, color: MUTED }}>{new Date(z.savedAt).toLocaleString('sv-SE')}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                <button className="chip" onClick={() => void open(z)}>Öppna</button>
                <button className="chip" onClick={() => del(z.id)}>Ta bort</button>
              </div>
            </div>
          ))}
        </div>
        <button ref={closeRef} onClick={onClose} className="disp" style={{ marginTop: 18, background: INK, color: PAPER, border: 'none', padding: '10px 18px', fontSize: 15 }}>Stäng</button>
      </div>
    </div>
  )
}

export default function App() {
  const [pages, setPages] = useState<Page[]>([{ id: uid(), elements: [] }])
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const elements = pages[current]?.elements ?? []
  const setElements = (fn: (els: El[]) => El[]) => setPages((ps) => ps.map((pg, i) => (i === current ? { ...pg, elements: fn(pg.elements) } : pg)))
  const [query, setQuery] = useState('Stockholm')
  const [results, setResults] = useState<KbImage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [searched, setSearched] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [zinesOpen, setZinesOpen] = useState(false)
  const [frameW, setFrameW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1024))
  const drag = useRef<{ id: string; ox: number; oy: number; sx: number; sy: number } | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const propsRef = useRef<HTMLDivElement>(null)
  const say = (m: string) => setAnnounce(m)

  const isRow = frameW >= 1024
  const scale = isRow ? 1 : clamp(frameW / PAGE_W, 0.35, 1)

  useEffect(() => {
    const el = mainRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => { for (const e of entries) setFrameW(e.contentRect.width) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const runSearch = async (q: string, opts: { from?: string; to?: string; offset?: number } = {}, label?: string) => {
    setLoading(true); setError(false)
    try {
      const { images, total } = await searchFreeImages(q || 'Stockholm', 24, opts)
      setResults(images); setSearched(true)
      say(label ?? (images.length
        ? images.length + ' fria träffar från KB'
        : total + ' träffar hos KB, men ingen fri att använda'))
    } catch {
      setError(true); setResults([]); setSearched(true); say('KB:s API svarar inte just nu')
    } finally { setLoading(false) }
  }
  useEffect(() => { void runSearch('Stockholm') }, [])

  useEffect(() => {
    if (location.hash.startsWith('#z=')) {
      try {
        const json = b64decode(decodeURIComponent(location.hash.slice(3)))
        void deserialize(json).then((pgs) => { if (pgs.length) { setPages(pgs); setCurrent(0); setSelected(null); say('Öppnade delat zine') } })
      } catch { /* ogiltig länk */ }
      history.replaceState(null, '', location.pathname)
    }
  }, [])

  const surprise = async () => {
    const term = SURPRISE[rnd(SURPRISE.length)]
    setQuery(term)
    setLoading(true); setError(false)
    try {
      let r = await searchFreeImages(term, 24, { offset: rnd(60) })
      if (r.images.length === 0) r = await searchFreeImages(term, 24)
      setResults(r.images); setSearched(true)
      say(r.images.length ? 'Överraskning: ' + term : 'Inga fria träffar för ' + term + ', prova igen')
    } catch {
      setError(true); setResults([]); setSearched(true); say('KB:s API svarar inte just nu')
    } finally { setLoading(false) }
  }
  const browseDecade = (start: number) => {
    setQuery('')
    void runSearch('*', { from: start + '-01-01', to: start + 9 + '-12-31', offset: rnd(40) }, 'Bläddrar ' + start + '-talet')
  }

  const sel = elements.find((e) => e.id === selected) ?? null

  useEffect(() => {
    if (selected && !isRow && propsRef.current) {
      const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      propsRef.current.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'nearest' })
    }
  }, [selected, isRow])

  const update = (id: string, fn: (el: El) => El) => setElements((els) => els.map((e) => (e.id === id ? fn(e) : e)))
  const updImg = (id: string, fn: (el: ImgEl) => ImgEl) => update(id, (e) => (e.kind === 'image' ? fn(e) : e))

  const addImage = (a: KbImage) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    let triedThumb = false
    img.onerror = () => {
      // Försök thumbnail om fullbilden inte gick; annars säg ifrån så att
      // klicket inte tyst rinner ut i sanden utan synlig återkoppling.
      if (!triedThumb && a.thumbnail && a.thumbnail !== a.fullImage) { triedThumb = true; img.src = a.thumbnail }
      else say('Kunde inte ladda bilden från KB. Prova en annan.')
    }
    img.onload = () => {
      const id = uid()
      setElements((els) => [...els, { id, kind: 'image', src: a, img, x: 50, y: 60, scale: 1, z: nextZ(els), filter: 'xerox', level: 128, shadow: '#141414', highlight: '#ff4fa0', cell: 6, angle: 0, levels: 2, amount: 30 }])
      setSelected(id); say('Lade till bild: ' + a.title)
    }
    img.src = a.fullImage
  }
  const addText = () => {
    const id = uid()
    setElements((els) => [...els, { id, kind: 'text', text: 'RUBRIK', size: 46, color: '#141414', x: 40, y: 470, scale: 1, z: nextZ(els) }])
    setSelected(id); say('Lade till rubrik')
  }
  const remove = (id: string) => { setElements((els) => els.filter((e) => e.id !== id)); setSelected(null); say('Tog bort objekt') }
  const toFront = (id: string) => update(id, (e) => ({ ...e, z: nextZ(elements) }))
  const setFilter = (id: string, f: FilterId) => { updImg(id, (e) => ({ ...e, filter: f })); say('Filter: ' + FILTER_LABEL[f]) }

  const onElPointerDown = (e: PointerEvent<HTMLDivElement>, id: string) => {
    e.stopPropagation(); setSelected(id)
    // Fånga pekaren på elementet så drag följer fingret/musen även om det
    // lämnar elementet — utan detta scrollar touch-enheter sidan istället.
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* äldre webbläsare */ }
    const el = elements.find((x) => x.id === id)
    if (el) drag.current = { id, ox: el.x, oy: el.y, sx: e.clientX, sy: e.clientY }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    update(d.id, (el) => ({ ...el, x: d.ox + (e.clientX - d.sx) / scale, y: d.oy + (e.clientY - d.sy) / scale }))
  }
  const onPointerUp = () => { drag.current = null }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!sel) return
    const step = e.shiftKey ? 1 : 6
    if (e.key === 'ArrowLeft') { e.preventDefault(); update(sel.id, (el) => ({ ...el, x: el.x - step })) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); update(sel.id, (el) => ({ ...el, x: el.x + step })) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); update(sel.id, (el) => ({ ...el, y: el.y - step })) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); update(sel.id, (el) => ({ ...el, y: el.y + step })) }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); update(sel.id, (el) => (el.kind === 'text' ? { ...el, size: el.size + 4 } : { ...el, scale: el.scale + 0.1 })) }
    else if (e.key === '-') { e.preventDefault(); update(sel.id, (el) => (el.kind === 'text' ? { ...el, size: Math.max(8, el.size - 4) } : { ...el, scale: Math.max(0.1, el.scale - 0.1) })) }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(sel.id) }
  }

  const exportPng = () => {
    const c = renderPage(elements)
    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'klippverket-sida.png'; a.click()
    say('Exporterade sidan som PNG med kreditering')
  }
  const exportZinePdf = async () => {
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ unit: 'pt', format: 'a5', orientation: 'portrait' })
    const pw = 419.53, ph = 595.28
    pages.forEach((pg, i) => {
      if (i > 0) pdf.addPage('a5', 'portrait')
      pdf.addImage(renderPage(pg.elements).toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, pw, ph)
    })
    pdf.save('klippverket-zine.pdf')
    say('Exporterade zine som PDF: ' + pages.length + ' sidor')
  }
  const addPage = () => { setPages((ps) => [...ps, { id: uid(), elements: [] }]); setCurrent(pages.length); setSelected(null); say('Ny sida') }
  const removePage = () => { if (pages.length <= 1) return; const idx = current; setPages((ps) => ps.filter((_, i) => i !== idx)); setCurrent(Math.max(0, idx - 1)); setSelected(null); say('Tog bort sida') }
  const goPage = (i: number) => { setCurrent(i); setSelected(null) }

  const sorted = [...elements].sort((a, b) => a.z - b.z)
  const labelStyle = { fontSize: 12 } as const

  return (
    <div className="kv-shell" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', border: '2px solid ' + INK }}>
      <p aria-live="polite" className="sr-only">{announce}</p>
      {aboutOpen && <About onClose={() => setAboutOpen(false)} />}
      {zinesOpen && <MyZines pages={pages} onLoad={(p) => { setPages(p); setCurrent(0); setSelected(null) }} onClose={() => setZinesOpen(false)} say={say} />}

      <header style={{ background: INK, color: PAPER, padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 14, height: 14, background: ACID, display: 'inline-block' }} aria-hidden="true" />
            <h1 className="disp" style={{ fontSize: 22 }}>Klippverket</h1>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="tool" onClick={addText}>+ TEXT</button>
            <button className="tool" onClick={() => setAboutOpen(true)}>OM</button>
            <button className="tool" onClick={() => setZinesOpen(true)}>ZINES</button>
            <button className="tool" onClick={exportPng}>PNG</button>
            <button onClick={() => void exportZinePdf()} className="disp" style={{ background: ACID, color: INK, border: '2px solid ' + INK, fontSize: 14, padding: '9px 14px' }}>ZINE PDF</button>
          </div>
        </div>
      </header>

      <section aria-label="Sök och bläddra i KB:s material" style={{ background: PAPER, padding: '10px 18px', borderBottom: '2px solid ' + INK }}>
        <form onSubmit={(e) => { e.preventDefault(); void runSearch(query) }} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Sök i KB:s fria material" placeholder="Sök i KB, t.ex. Stockholm, affisch, karta…" style={{ flex: 1, minWidth: 0, border: '2px solid ' + INK, background: '#fff', padding: '9px 10px', fontSize: 12 }} />
          <button type="submit" className="disp" style={{ background: INK, color: PAPER, border: '2px solid ' + INK, padding: '0 16px', fontSize: 14 }}>SÖK</button>
        </form>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <button className="chip" onClick={() => void surprise()} style={{ background: ACID, borderColor: INK, fontWeight: 700 }}>Överraska mig</button>
          <span className="mono" style={{ fontSize: 11, color: MUTED }}>Teman:</span>
          {THEMES.map((t) => (
            <button key={t} className="chip" aria-label={'Sök ' + t} onClick={() => { setQuery(t); void runSearch(t) }}>{t}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <span className="mono" style={{ fontSize: 11, color: MUTED }}>Epok:</span>
          {DECADES.map((d) => (
            <button key={d} className="chip" aria-label={'Bläddra ' + d + '-talet'} onClick={() => browseDecade(d)}>{d}-tal</button>
          ))}
        </div>
        {loading && <div className="mono" style={{ fontSize: 11, color: MUTED }}>Hämtar från KB…</div>}
        {!loading && error && (
          <div role="alert" className="mono" style={{ fontSize: 11, color: INK, background: '#fff', border: '1.5px solid ' + INK, borderLeft: '5px solid ' + PINK, padding: '9px 11px' }}>
            KB:s API svarar inte just nu. Det är ett tillfälligt driftfel, inte ett tomt sökresultat — försök igen om en stund.
          </div>
        )}
        {!loading && !error && (
          <div style={{ display: 'flex', gap: 8, overflow: 'auto', paddingBottom: 4 }}>
            {results.slice(0, 18).map((a) => (
              <button key={a.id} onClick={() => addImage(a)} title={a.title} aria-label={'Lägg in ' + a.title} style={{ flex: 'none', width: 76, padding: 0, border: '2px solid ' + INK, background: '#fff', cursor: 'pointer' }}>
                <span style={{ display: 'block', aspectRatio: '3 / 4', overflow: 'hidden', background: '#e6e2d8' }}>
                  <img src={a.thumbnail} alt={a.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </span>
              </button>
            ))}
            {searched && results.length === 0 && <span className="mono" style={{ fontSize: 11, color: MUTED }}>Inga fria bilder för det ordet. KB:s öppna material är mest historiskt, prova t.ex. Stockholm, affisch, karta, porträtt eller kopparstick.</span>}
          </div>
        )}
      </section>

      <main ref={mainRef} className="kv-editor" style={{ background: 'var(--desk)', padding: 18, flex: 1 }}>
        <div className="kv-stagecol">
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <span className="mono" style={{ fontSize: 11, color: MUTED }}>Sidor:</span>
            {pages.map((pg, i) => (
              <button key={pg.id} className="chip" aria-pressed={i === current} aria-label={'Sida ' + (i + 1)} onClick={() => goPage(i)}>{i + 1}</button>
            ))}
            <button className="chip" aria-label="Lägg till sida" onClick={addPage}>+ sida</button>
            {pages.length > 1 && <button className="chip" aria-label="Ta bort denna sida" onClick={removePage}>− sida</button>}
          </div>
          <div style={{ width: PAGE_W * scale, height: PAGE_H * scale, maxWidth: '100%', overflow: 'hidden' }}>
            <div
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              onKeyDown={onKeyDown}
              onPointerDown={() => setSelected(null)}
              tabIndex={0}
              role="group"
              aria-label="Zine-yta. Tabba till ett objekt för att markera, dra eller använd piltangenter för att flytta, plus och minus skalar, Delete tar bort."
              style={{ position: 'relative', width: PAGE_W, height: PAGE_H, transform: 'scale(' + scale + ')', transformOrigin: 'top left', background: '#F6F3EA', border: '2px solid ' + INK, overflow: 'hidden', touchAction: 'none' }}
            >
              {sorted.map((el) => (
                <div
                  key={el.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected === el.id}
                  aria-label={el.kind === 'image' ? 'Bild: ' + el.src.title : 'Rubrik: ' + el.text}
                  onFocus={() => setSelected(el.id)}
                  onPointerDown={(e) => onElPointerDown(e, el.id)}
                  style={{ position: 'absolute', left: el.x, top: el.y, outline: selected === el.id ? '2px dashed ' + PINK : 'none', outlineOffset: 3, cursor: 'move', touchAction: 'none' }}
                >
                  {el.kind === 'image'
                    ? <ImageNode el={el} />
                    : <span className="disp" style={{ fontSize: el.size, color: el.color, whiteSpace: 'pre', userSelect: 'none' }}>{el.text}</span>}
                </div>
              ))}
              {elements.length === 0 && <div className="mono" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 12, textAlign: 'center', padding: 20 }}>Sök och klicka en KB-bild för att börja klippa.</div>}
            </div>
          </div>
          <p className="mono" style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>Tangentbord: Tab markerar · piltangenter flyttar (Shift = fin) · +/− skalar · Delete tar bort.</p>
        </div>

        <aside ref={propsRef} className="kv-props">
          {!sel && <div className="mono" style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>Markera ett objekt för att redigera det.</div>}
          {sel && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="chip" onClick={() => toFront(sel.id)}>Längst fram</button>
                <button className="chip" onClick={() => remove(sel.id)}>Ta bort</button>
              </div>
              {sel.kind === 'image' && (
                <>
                  <div>
                    <div className="mono" style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>FILTER</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {FILTER_ORDER.map((f) => (
                        <button key={f} className="chip" aria-pressed={sel.filter === f} onClick={() => setFilter(sel.id, f)}>{FILTER_LABEL[f]}</button>
                      ))}
                    </div>
                  </div>

                  {sel.filter === 'xerox' && (
                    <label className="mono" style={labelStyle}>Tröskel: {sel.level}
                      <input type="range" min={0} max={255} value={sel.level} onChange={(e) => { const v = Number(e.target.value); updImg(sel.id, (el) => ({ ...el, level: v })) }} style={{ width: '100%', display: 'block', marginTop: 6 }} />
                    </label>
                  )}
                  {sel.filter === 'duotone' && (
                    <div style={{ display: 'flex', gap: 16 }}>
                      <label className="mono" style={labelStyle}>Skugga<input type="color" value={sel.shadow} onChange={(e) => { const v = e.target.value; updImg(sel.id, (el) => ({ ...el, shadow: v })) }} style={{ display: 'block', marginTop: 6 }} /></label>
                      <label className="mono" style={labelStyle}>Högdager<input type="color" value={sel.highlight} onChange={(e) => { const v = e.target.value; updImg(sel.id, (el) => ({ ...el, highlight: v })) }} style={{ display: 'block', marginTop: 6 }} /></label>
                    </div>
                  )}
                  {sel.filter === 'halftone' && (
                    <>
                      <label className="mono" style={labelStyle}>Prickstorlek: {sel.cell}
                        <input type="range" min={3} max={16} value={sel.cell} onChange={(e) => { const v = Number(e.target.value); updImg(sel.id, (el) => ({ ...el, cell: v })) }} style={{ width: '100%', display: 'block', marginTop: 6 }} />
                      </label>
                      <label className="mono" style={labelStyle}>Vinkel: {sel.angle}°
                        <input type="range" min={0} max={90} value={sel.angle} onChange={(e) => { const v = Number(e.target.value); updImg(sel.id, (el) => ({ ...el, angle: v })) }} style={{ width: '100%', display: 'block', marginTop: 6 }} />
                      </label>
                    </>
                  )}
                  {sel.filter === 'dither' && (
                    <label className="mono" style={labelStyle}>Nivåer: {sel.levels}
                      <input type="range" min={2} max={6} value={sel.levels} onChange={(e) => { const v = Number(e.target.value); updImg(sel.id, (el) => ({ ...el, levels: v })) }} style={{ width: '100%', display: 'block', marginTop: 6 }} />
                    </label>
                  )}
                  {sel.filter === 'grain' && (
                    <label className="mono" style={labelStyle}>Mängd: {sel.amount}
                      <input type="range" min={0} max={100} value={sel.amount} onChange={(e) => { const v = Number(e.target.value); updImg(sel.id, (el) => ({ ...el, amount: v })) }} style={{ width: '100%', display: 'block', marginTop: 6 }} />
                    </label>
                  )}

                  <div className="mono" style={{ fontSize: 11, lineHeight: 1.6, background: '#fff', border: '1.5px solid ' + INK, borderLeft: '5px solid ' + ACID, padding: '9px 11px', color: INK }}>{FILTER_INFO[sel.filter]}</div>

                  <label className="mono" style={labelStyle}>Storlek: {Math.round(sel.scale * 100)}%
                    <input type="range" min={0.2} max={2.5} step={0.05} value={sel.scale} onChange={(e) => { const v = Number(e.target.value); update(sel.id, (el) => ({ ...el, scale: v })) }} style={{ width: '100%', display: 'block', marginTop: 6 }} />
                  </label>
                  <div style={{ background: '#fff', border: '1.5px solid ' + INK, borderLeft: '5px solid ' + PINK, padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div className="mono" style={{ fontSize: 11, fontWeight: 700 }}>Om bilden</div>
                    <div className="mono" style={{ fontSize: 12, lineHeight: 1.5 }}>{sel.src.title}</div>
                    {(sel.src.creator || sel.src.year) && (
                      <div className="mono" style={{ fontSize: 11, color: MUTED }}>{[[sel.src.creatorRole, sel.src.creator].filter(Boolean).join(': '), sel.src.year].filter(Boolean).join(' · ')}</div>
                    )}
                    {sel.src.genres.length > 0 && <div className="mono" style={{ fontSize: 11, color: MUTED }}>Typ: {sel.src.genres.join(', ')}</div>}
                    {sel.src.subjects.length > 0 && <div className="mono" style={{ fontSize: 11, color: MUTED }}>Ämnen: {sel.src.subjects.join(', ')}</div>}
                    <div className="mono" style={{ fontSize: 11, color: MUTED }}>Licens: {sel.src.license ?? 'okänd'}</div>
                    <a className="mono" href={sel.src.sourceUrl} target="_blank" rel="noopener" style={{ fontSize: 11, color: '#1f4fd6' }}>Källa hos KB</a>
                  </div>
                </>
              )}
              {sel.kind === 'text' && (
                <>
                  <label className="mono" style={labelStyle}>Text
                    <input value={sel.text} onChange={(e) => { const v = e.target.value; update(sel.id, (el) => (el.kind === 'text' ? { ...el, text: v } : el)) }} style={{ width: '100%', display: 'block', marginTop: 6, border: '2px solid ' + INK, padding: '8px 8px', fontSize: 13 }} />
                  </label>
                  <label className="mono" style={labelStyle}>Storlek: {sel.size}px
                    <input type="range" min={14} max={120} value={sel.size} onChange={(e) => { const v = Number(e.target.value); update(sel.id, (el) => (el.kind === 'text' ? { ...el, size: v } : el)) }} style={{ width: '100%', display: 'block', marginTop: 6 }} />
                  </label>
                  <label className="mono" style={labelStyle}>Färg<input type="color" value={sel.color} onChange={(e) => { const v = e.target.value; update(sel.id, (el) => (el.kind === 'text' ? { ...el, color: v } : el)) }} style={{ display: 'block', marginTop: 6 }} /></label>
                </>
              )}
            </div>
          )}
        </aside>
      </main>

      <footer style={{ background: INK, color: '#a6a6a6', padding: '10px 18px' }} className="mono">
        <span style={{ fontSize: 10 }}>KLIPPVERKET · GÖR SVERIGES FRIA KULTURARV TILL DITT · BYGGD MED KB:S ÖPPNA DATA</span>
      </footer>
    </div>
  )
}
