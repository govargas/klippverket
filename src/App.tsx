import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react'
import { threshold, duotone, hexToRgb, type FilterId } from './lib/filters'
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
type ImgEl = Base & { kind: 'image'; src: KbImage; img: HTMLImageElement; filter: FilterId; level: number; shadow: string; highlight: string }
type TextEl = Base & { kind: 'text'; text: string; size: number; color: string }
type El = ImgEl | TextEl

let counter = 0
const uid = () => 'e' + ++counter
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const nextZ = (els: El[]) => (els.length ? Math.max(...els.map((e) => e.z)) + 1 : 1)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function filteredCanvas(el: ImgEl): HTMLCanvasElement {
  const cap = 700
  const s = Math.min(1, cap / Math.max(el.img.width, el.img.height))
  const w = Math.max(1, Math.round(el.img.width * s))
  const h = Math.max(1, Math.round(el.img.height * s))
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.drawImage(el.img, 0, 0, w, h)
  if (el.filter === 'xerox') ctx.putImageData(threshold(ctx.getImageData(0, 0, w, h), el.level), 0, 0)
  else if (el.filter === 'duotone') ctx.putImageData(duotone(ctx.getImageData(0, 0, w, h), hexToRgb(el.shadow), hexToRgb(el.highlight)), 0, 0)
  return c
}

function ImageNode({ el }: { el: ImgEl }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const fc = filteredCanvas(el)
    c.width = fc.width; c.height = fc.height
    c.getContext('2d')!.drawImage(fc, 0, 0)
  }, [el.img, el.filter, el.level, el.shadow, el.highlight])
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
        <h3 className="disp" style={{ fontSize: 16, marginTop: 16 }}>Teknik</h3>
        <p className="mono" style={{ fontSize: 12, lineHeight: 1.7 }}>React, TypeScript, Vite. Egen bildfilter-motor i canvas 2D. KB:s öppna sök-API via en liten bild-/sök-proxy (serverless) så bilderna kan bearbetas i canvas. Byggd i React där jag är snabbast; lär mig aktivt SvelteKit för att matcha KB:s stack.</p>
        <h3 className="disp" style={{ fontSize: 16, marginTop: 16 }}>Tillgänglighet</h3>
        <p className="mono" style={{ fontSize: 12, lineHeight: 1.7 }}>Responsiv från 320 px, WCAG 2 AA i sikte: tangentbordsnåbara kontroller, semantiska knappar, synligt fokus och skärmläsar-annonser. På ytan: Tab markerar, piltangenter flyttar, +/− skalar, Delete tar bort.</p>
        <h3 className="disp" style={{ fontSize: 16, marginTop: 16 }}>Källa &amp; licens</h3>
        <p className="mono" style={{ fontSize: 12, lineHeight: 1.7 }}>Material från Kungliga biblioteket (data.kb.se), i första hand fritt/public domain där metadatan tillåter det. Källa bäddas in i exporten.</p>
        <h3 className="disp" style={{ fontSize: 16, marginTop: 16 }}>Koncept och utveckling</h3>
        <p className="mono" style={{ fontSize: 12, lineHeight: 1.7 }}>Talo Vargas</p>
        <button ref={closeRef} onClick={onClose} className="disp" style={{ marginTop: 18, background: INK, color: PAPER, border: 'none', padding: '10px 18px', fontSize: 15 }}>Stäng</button>
      </div>
    </div>
  )
}

export default function App() {
  const [elements, setElements] = useState<El[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('Stockholm')
  const [results, setResults] = useState<KbImage[]>([])
  const [loading, setLoading] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [aboutOpen, setAboutOpen] = useState(false)
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

  const runSearch = async (q: string) => {
    setLoading(true)
    try { const r = await searchFreeImages(q || 'Stockholm'); setResults(r); say(r.length + ' träffar från KB') }
    finally { setLoading(false) }
  }
  useEffect(() => { void runSearch('Stockholm') }, [])

  const sel = elements.find((e) => e.id === selected) ?? null

  useEffect(() => {
    if (selected && !isRow && propsRef.current) {
      const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      propsRef.current.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'nearest' })
    }
  }, [selected, isRow])

  const update = (id: string, fn: (el: El) => El) => setElements((els) => els.map((e) => (e.id === id ? fn(e) : e)))

  const addImage = (a: KbImage) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const id = uid()
      setElements((els) => [...els, { id, kind: 'image', src: a, img, x: 50, y: 60, scale: 1, z: nextZ(els), filter: 'xerox', level: 128, shadow: '#141414', highlight: '#ff4fa0' }])
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
  const setFilter = (id: string, f: FilterId) => { update(id, (e) => (e.kind === 'image' ? { ...e, filter: f } : e)); say('Filter: ' + (f === 'none' ? 'inget' : f)) }

  const onElPointerDown = (e: PointerEvent<HTMLDivElement>, id: string) => {
    e.stopPropagation(); setSelected(id)
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
    const c = document.createElement('canvas')
    c.width = PAGE_W; c.height = PAGE_H
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#F6F3EA'; ctx.fillRect(0, 0, PAGE_W, PAGE_H)
    for (const el of [...elements].sort((a, b) => a.z - b.z)) {
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
    const firstImg = elements.find((e): e is ImgEl => e.kind === 'image')
    if (firstImg) {
      ctx.fillStyle = INK; ctx.fillRect(0, PAGE_H - 24, PAGE_W, 24)
      ctx.fillStyle = PAPER; ctx.font = "10px 'Space Mono', monospace"; ctx.textBaseline = 'alphabetic'
      ctx.fillText(trunc([firstImg.src.title, firstImg.src.creator, firstImg.src.year].filter(Boolean).join(' · '), 60) + ' · KB', 8, PAGE_H - 8)
    }
    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'klippverket-zine.png'; a.click()
    say('Exporterade PNG med kreditering')
  }

  const sorted = [...elements].sort((a, b) => a.z - b.z)

  return (
    <div className="kv-shell" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', border: '2px solid ' + INK }}>
      <p aria-live="polite" className="sr-only">{announce}</p>
      {aboutOpen && <About onClose={() => setAboutOpen(false)} />}

      <header style={{ background: INK, color: PAPER, padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 14, height: 14, background: ACID, display: 'inline-block' }} aria-hidden="true" />
            <h1 className="disp" style={{ fontSize: 22 }}>Klippverket</h1>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="tool" onClick={addText}>+ TEXT</button>
            <button className="tool" onClick={() => setAboutOpen(true)}>OM</button>
            <button onClick={exportPng} className="disp" style={{ background: ACID, color: INK, border: '2px solid ' + INK, fontSize: 14, padding: '9px 14px' }}>EXPORTERA PNG</button>
          </div>
        </div>
      </header>

      <section style={{ background: PAPER, padding: '10px 18px', borderBottom: '2px solid ' + INK }}>
        <form onSubmit={(e) => { e.preventDefault(); void runSearch(query) }} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Sök i KB:s fria material" placeholder="Sök i KB, t.ex. Stockholm, affisch, karta…" style={{ flex: 1, minWidth: 0, border: '2px solid ' + INK, background: '#fff', padding: '9px 10px', fontSize: 12 }} />
          <button type="submit" className="disp" style={{ background: INK, color: PAPER, border: '2px solid ' + INK, padding: '0 16px', fontSize: 14 }}>SÖK</button>
        </form>
        {loading && <div className="mono" style={{ fontSize: 11, color: MUTED }}>Hämtar från KB…</div>}
        {!loading && (
          <div style={{ display: 'flex', gap: 8, overflow: 'auto', paddingBottom: 4 }}>
            {results.slice(0, 18).map((a) => (
              <button key={a.id} onClick={() => addImage(a)} title={a.title} aria-label={'Lägg in ' + a.title} style={{ flex: 'none', width: 76, padding: 0, border: '2px solid ' + INK, background: '#fff', cursor: 'pointer' }}>
                <span style={{ display: 'block', aspectRatio: '3 / 4', overflow: 'hidden', background: '#e6e2d8' }}>
                  <img src={a.thumbnail} alt={a.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </span>
              </button>
            ))}
            {results.length === 0 && <span className="mono" style={{ fontSize: 11, color: MUTED }}>Inga träffar (kör <code>npm run dev</code> så KB-proxyn är på).</span>}
          </div>
        )}
      </section>

      <main ref={mainRef} className="kv-editor" style={{ background: 'var(--desk)', padding: 18, flex: 1 }}>
        <div className="kv-stagecol">
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
              style={{ position: 'relative', width: PAGE_W, height: PAGE_H, transform: 'scale(' + scale + ')', transformOrigin: 'top left', background: '#F6F3EA', border: '2px solid ' + INK, overflow: 'hidden' }}
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
                      {(['none', 'xerox', 'duotone'] as FilterId[]).map((f) => (
                        <button key={f} className="chip" aria-pressed={sel.filter === f} onClick={() => setFilter(sel.id, f)}>
                          {f === 'none' ? 'INGEN' : f === 'xerox' ? 'XEROX' : 'DUOTON'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {sel.filter === 'xerox' && (
                    <label className="mono" style={{ fontSize: 12 }}>Tröskel: {sel.level}
                      <input type="range" min={0} max={255} value={sel.level} onChange={(e) => { const v = Number(e.target.value); update(sel.id, (el) => (el.kind === 'image' ? { ...el, level: v } : el)) }} style={{ width: '100%', display: 'block', marginTop: 6 }} />
                    </label>
                  )}
                  {sel.filter === 'duotone' && (
                    <div style={{ display: 'flex', gap: 16 }}>
                      <label className="mono" style={{ fontSize: 12 }}>Skugga<input type="color" value={sel.shadow} onChange={(e) => { const v = e.target.value; update(sel.id, (el) => (el.kind === 'image' ? { ...el, shadow: v } : el)) }} style={{ display: 'block', marginTop: 6 }} /></label>
                      <label className="mono" style={{ fontSize: 12 }}>Högdager<input type="color" value={sel.highlight} onChange={(e) => { const v = e.target.value; update(sel.id, (el) => (el.kind === 'image' ? { ...el, highlight: v } : el)) }} style={{ display: 'block', marginTop: 6 }} /></label>
                    </div>
                  )}
                  <label className="mono" style={{ fontSize: 12 }}>Storlek: {Math.round(sel.scale * 100)}%
                    <input type="range" min={0.2} max={2.5} step={0.05} value={sel.scale} onChange={(e) => { const v = Number(e.target.value); update(sel.id, (el) => ({ ...el, scale: v })) }} style={{ width: '100%', display: 'block', marginTop: 6 }} />
                  </label>
                  <div className="mono" style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{trunc(sel.src.title, 44)} · {sel.src.license ?? 'okänd licens'}</div>
                </>
              )}
              {sel.kind === 'text' && (
                <>
                  <label className="mono" style={{ fontSize: 12 }}>Text
                    <input value={sel.text} onChange={(e) => { const v = e.target.value; update(sel.id, (el) => (el.kind === 'text' ? { ...el, text: v } : el)) }} style={{ width: '100%', display: 'block', marginTop: 6, border: '2px solid ' + INK, padding: '8px 8px', fontSize: 13 }} />
                  </label>
                  <label className="mono" style={{ fontSize: 12 }}>Storlek: {sel.size}px
                    <input type="range" min={14} max={120} value={sel.size} onChange={(e) => { const v = Number(e.target.value); update(sel.id, (el) => (el.kind === 'text' ? { ...el, size: v } : el)) }} style={{ width: '100%', display: 'block', marginTop: 6 }} />
                  </label>
                  <label className="mono" style={{ fontSize: 12 }}>Färg<input type="color" value={sel.color} onChange={(e) => { const v = e.target.value; update(sel.id, (el) => (el.kind === 'text' ? { ...el, color: v } : el)) }} style={{ display: 'block', marginTop: 6 }} /></label>
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
