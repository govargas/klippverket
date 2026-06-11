// Inramning runt verktyget: hero, manifest, hur-det-funkar och två tidslinjer
// (bild- och typografihistorien) byggda på verktygets EGEN data, plus ett
// galleri som visar levande KB-träffar. Allt presentationslager, klassdrivet
// mot tokensystemet i index.css. Själva editorn bor kvar i App.tsx.
import { FILTERS, FILTER_ORDER, type FilterId } from './lib/filters'
import { FONTS, FONT_ORDER } from './lib/fonts'
import type { KbImage } from './lib/kb'

// Inträdesrörelse (data-reveal) sköts helt i CSS via animation-timeline:view().
// Ingen JS, inget kan lämna innehåll osynligt: webbläsare utan stöd och
// reducerad rörelse visar allt direkt. Se index.css.

// ---- riso-tile: en KB-bild (eller skelett) som en tryckplåt i en bläckfärg ---
function RisoTile({ img, ink, className = '', style }: { img?: KbImage; ink: 'acid' | 'pink'; className?: string; style?: React.CSSProperties }) {
  const inkVar = ink === 'acid' ? 'var(--color-acid)' : 'var(--color-pink)'
  return (
    <div className={'riso border-2 border-ink hard ' + className} style={{ ['--riso-ink' as string]: inkVar, ...style }} aria-hidden="true">
      {img
        ? <img src={img.thumbnail} alt="" loading="lazy" />
        : <span style={{ display: 'block', width: '100%', height: '100%' }} />}
    </div>
  )
}

// =============================================================================
// 1. STICKY SITE-NAV  (en rad, <= 72px)
// =============================================================================
export function SiteNav({ onStart, onAbout }: { onStart: () => void; onAbout: () => void }) {
  return (
    <header className="sticky top-0 z-50 bg-ink text-paper border-b-2 border-paper/15">
      <nav className="mx-auto flex h-[64px] max-w-[1400px] items-center justify-between gap-3 px-[var(--space-gut)]">
        <a href="#top" className="flex items-center gap-2.5 shrink-0" aria-label="Klippverket, till toppen">
          <span className="h-4 w-4 bg-acid" aria-hidden="true" />
          <span className="disp text-[19px] text-paper">Klippverket</span>
        </a>
        <div className="hidden items-center gap-1 md:flex">
          <a href="#verkstad" className="tool no-underline">VERKSTADEN</a>
          <a href="#bildhistoria" className="tool no-underline">BILDHISTORIA</a>
          <a href="#galleri" className="tool no-underline">GALLERI</a>
          <button className="tool" onClick={onAbout}>OM</button>
        </div>
        <button className="btn btn-acid btn-sm" onClick={onStart}>Börja klippa</button>
      </nav>
    </header>
  )
}

// =============================================================================
// 2. HERO  (asymmetrisk split)
// =============================================================================
export function Hero({ images, loading, onStart, onAbout }: { images: KbImage[]; loading: boolean; onStart: () => void; onAbout: () => void }) {
  const tiles = images.slice(0, 3)
  const ready = !loading && tiles.length > 0
  return (
    <section id="top" className="relative overflow-hidden border-b-2 border-ink bg-paper">
      <div className="mx-auto grid min-h-[calc(100dvh_-_64px)] max-w-[1400px] grid-cols-1 items-center gap-[var(--space-gut)] px-[var(--space-gut)] pt-16 pb-14 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
        {/* vänster: budskap */}
        <div data-reveal>
          <span className="eyebrow mb-6">KB:s öppna data, som råmaterial</span>
          <h1 className="disp mt-4 text-[length:var(--text-mega)] text-ink">Klippverket</h1>
          <p className="mono mt-6 max-w-[42ch] text-[15px] leading-relaxed text-ink/85 md:text-[17px]">
            Gör Kungliga bibliotekets öppna kulturarv till din egen zine. Sök, klipp, filtrera och tryck. Allt fritt material.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <button className="btn btn-acid" onClick={onStart}>Börja klippa</button>
            <button className="btn btn-ghost border-ink" onClick={onAbout}>Om projektet</button>
          </div>
        </div>
        {/* höger: riso-collage av levande KB-bilder, eller skelett medan vi hämtar */}
        <div className="relative mx-auto h-[clamp(320px,46vw,560px)] w-full max-w-[520px]" aria-hidden="true">
          <RisoTile img={ready ? tiles[0] : undefined} ink="acid"
            className="absolute left-0 top-4 h-[68%] w-[58%] -rotate-3" />
          <RisoTile img={ready ? tiles[1] : undefined} ink="pink"
            className="absolute right-0 top-0 h-[52%] w-[46%] rotate-2" />
          <RisoTile img={ready ? tiles[2] : undefined} ink="acid"
            className="absolute bottom-0 right-6 h-[44%] w-[52%] -rotate-1 hard-pink" />
          {loading && (
            <span className="mono absolute bottom-2 left-2 bg-ink px-2 py-1 text-[10px] text-paper">hämtar ur KB…</span>
          )}
        </div>
      </div>
    </section>
  )
}

// =============================================================================
// 3. MANIFEST  (helbredd, "tryckt sida" i bläcksvart)
// =============================================================================
export function Manifesto() {
  return (
    <section className="border-b-2 border-ink bg-ink text-paper">
      <div className="mx-auto max-w-[1100px] px-[var(--space-gut)] py-[var(--space-section)]" data-reveal>
        <h2 className="disp text-[length:var(--text-h2)]" style={{ lineHeight: 1.12 }}>
          Arkivet är ingen <span className="text-pink">glasmonter</span>.<br />Det är <span className="text-acid">råmaterial</span>.
        </h2>
        <p className="mono mt-8 max-w-[62ch] text-[15px] leading-relaxed text-paper/80 md:text-[17px]">
          Kartor, affischer, porträtt och kopparstick ur KB:s öppna samlingar är fria att använda. Klippverket gör dem till något du själv trycker, remixar och kallar ditt eget.
        </p>
      </div>
    </section>
  )
}

// =============================================================================
// 4. MARKIS  (en enda, motiverad: KB:s bredd som löpande text)
// =============================================================================
const MARQUEE_WORDS = ['Porträtt', 'Affischer', 'Kartor', 'Kopparstick', 'Vykort', 'Handskrifter', 'Fartyg', 'Ornament', 'Blommor', 'Stockholm']
export function SourceMarquee() {
  const row = [...MARQUEE_WORDS, ...MARQUEE_WORDS]
  return (
    <div className="marquee border-b-2 border-ink bg-acid py-3" aria-hidden="true">
      <div className="marquee__track">
        {row.map((w, i) => (
          <span key={i} className="disp text-[22px] text-ink">{w}<span className="text-pink"> ✶ </span></span>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// 5. HUR DET FUNKAR  (numrerad, förskjuten lista)
// =============================================================================
const STEPS: Array<{ k: string; t: string }> = [
  { k: 'Sök', t: 'Sök fritt i KB:s öppna samlingar, eller tryck Överraska mig.' },
  { k: 'Klipp', t: 'Klicka eller dra en historisk bild rakt ut på arket.' },
  { k: 'Bearbeta', t: 'Lägg på filter ur tryckhistorien. Stapla upp till två lager.' },
  { k: 'Lägg till text', t: 'Sätt rubrik och välj typsnitt ur typografins tidslinje.' },
  { k: 'Tryck', t: 'Exportera sidan som PNG eller hela zinet som PDF, med källan inbäddad.' },
]
export function HowItWorks() {
  return (
    <section className="border-b-2 border-ink bg-paper">
      <div className="mx-auto max-w-[1100px] px-[var(--space-gut)] py-[var(--space-section)]">
        <h2 className="disp mb-10 text-[length:var(--text-h2)] text-ink" data-reveal>Så gör du ett zine</h2>
        <ol className="flex flex-col">
          {STEPS.map((s, i) => (
            <li key={s.k} data-reveal
              className="flex flex-col gap-2 border-t-2 border-ink py-6 sm:flex-row sm:items-baseline sm:gap-8"
              style={{ marginLeft: `${(i % 2) * 6}%` }}>
              <span className="disp flex h-12 w-12 shrink-0 items-center justify-center bg-ink text-[22px] text-acid">{i + 1}</span>
              <span className="disp shrink-0 text-[length:var(--text-h3)] text-ink sm:w-[240px]">{s.k}</span>
              <span className="mono max-w-[48ch] text-[14px] leading-relaxed text-ink/80 md:text-[15px]">{s.t}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// =============================================================================
// 6. BILDHISTORIEN SOM FILTER  (horisontell scroll-snap-rad)
// =============================================================================
export function FilterTimeline() {
  const ids = FILTER_ORDER.filter((f): f is FilterId => f !== 'none')
  return (
    <section id="bildhistoria" className="border-b-2 border-ink bg-desk">
      <div className="mx-auto max-w-[1400px] px-[var(--space-gut)] py-[var(--space-section)]">
        <div className="mb-9 max-w-[60ch]" data-reveal>
          <span className="eyebrow mb-5">Tidslinje genom tryckhistorien</span>
          <h2 className="disp mt-4 text-[length:var(--text-h2)] text-ink">Elva filter, fyra sekel</h2>
          <p className="mono mt-4 text-[14px] leading-relaxed text-ink/75 md:text-[15px]">
            Varje filter i verkstaden är en riktig teknik ur bild- och tryckhistorien, från kopparstickets gravyr till fanzinets fotokopia.
          </p>
        </div>
        <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-5" data-reveal>
          {ids.map((id, i) => {
            const f = FILTERS[id]
            return (
              <article key={id} className="flex w-[260px] shrink-0 snap-start flex-col border-2 border-ink bg-paper hard">
                <div className="flex items-baseline justify-between gap-2 px-4 py-3" style={{ background: i % 2 ? 'var(--color-pink)' : 'var(--color-acid)' }}>
                  <span className="disp text-[15px] text-ink">{f.label}</span>
                  <span className="mono text-[11px] font-bold text-ink">{f.era || 'tidlöst'}</span>
                </div>
                <p className="mono line-clamp-5 px-4 py-4 text-[12.5px] leading-relaxed text-ink/85">{f.info}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// =============================================================================
// 7. TYPOGRAFINS TIDSLINJE  (specimen-bento, varje kort i sitt eget snitt)
// =============================================================================
export function FontTimeline() {
  return (
    <section className="border-b-2 border-ink bg-paper">
      <div className="mx-auto max-w-[1200px] px-[var(--space-gut)] py-[var(--space-section)]">
        <h2 className="disp mb-3 text-[length:var(--text-h2)] text-ink" data-reveal>Typografins tidslinje</h2>
        <p className="mono mb-10 max-w-[60ch] text-[14px] leading-relaxed text-ink/75 md:text-[15px]" data-reveal>
          Åtta rubriktypsnitt, från romerska kapitäler till skrivmaskinens fanzine. Ordet nedan är satt i varje snitts egen form.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {FONT_ORDER.map((fid, i) => {
            const f = FONTS[fid]
            const word = f.upper ? 'TRYCKFRIHET' : 'Tryckfrihet'
            const feature = i === 0 || i === FONT_ORDER.length - 1
            return (
              <article key={fid} data-reveal
                className={'flex flex-col justify-between border-2 border-ink bg-paper p-5 hard ' + (feature ? 'sm:col-span-2' : '')}>
                <div className="mb-5 flex items-baseline justify-between gap-3 border-b-2 border-ink pb-3">
                  <span className="disp text-[15px] text-ink">{f.label}</span>
                  <span className="mono bg-ink px-2 py-1 text-[10px] text-paper">{f.era}</span>
                </div>
                <span className="specimen-word block text-ink"
                  style={{ fontFamily: f.family, fontWeight: f.weight, fontSize: feature ? 'clamp(2.5rem,8vw,5rem)' : 'clamp(2rem,6vw,3.2rem)' }}>
                  {word}
                </span>
                <p className="mono mt-5 line-clamp-3 text-[12px] leading-relaxed text-ink/70">{f.info}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// =============================================================================
// 8. GALLERI  (levande KB-träffar som riso-rutnät)
// =============================================================================
export function Gallery({ images, loading }: { images: KbImage[]; loading: boolean }) {
  const tiles = images.slice(0, 12)
  return (
    <section id="galleri" className="border-b-2 border-ink bg-ink">
      <div className="mx-auto max-w-[1400px] px-[var(--space-gut)] py-[var(--space-section)]">
        <h2 className="disp mb-3 text-[length:var(--text-h2)] text-paper" data-reveal>Råmaterialet, just nu ur KB</h2>
        <p className="mono mb-10 max-w-[58ch] text-[14px] leading-relaxed text-paper/70 md:text-[15px]" data-reveal>
          Ett levande urval fria bilder, hämtade direkt från Kungliga bibliotekets öppna API. Samma bilder ligger redo i verkstaden nedan.
        </p>
        {loading && tiles.length === 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse border-2 border-paper/30" style={{ background: i % 2 ? 'var(--color-pink)' : 'var(--color-acid)', opacity: 0.5 }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6" data-reveal>
            {tiles.map((a, i) => (
              <RisoTile key={a.id} img={a} ink={i % 2 ? 'pink' : 'acid'}
                className={'aspect-[3/4] ' + (i % 5 === 0 ? '-rotate-1' : i % 3 === 0 ? 'rotate-1' : '')} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// =============================================================================
// 9. AVSLUTANDE CTA + FOTER
// =============================================================================
export function ClosingCta({ onStart }: { onStart: () => void }) {
  return (
    <section className="border-b-2 border-ink bg-acid">
      <div className="mx-auto flex max-w-[1100px] flex-col items-start gap-8 px-[var(--space-gut)] py-[var(--space-section)]" data-reveal>
        <h2 className="disp max-w-[18ch] text-[length:var(--text-hero)] text-ink" style={{ lineHeight: 1.04 }}>
          Öppna arkivet.<br />Börja klippa.
        </h2>
        <button className="btn btn-ink" onClick={onStart}>Börja klippa</button>
      </div>
    </section>
  )
}

export function SiteFooter() {
  return (
    <footer className="bg-ink text-paper/70">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-[var(--space-gut)] py-8 sm:flex-row sm:items-center sm:justify-between">
        <span className="mono text-[11px] tracking-wide">KLIPPVERKET · GÖR SVERIGES FRIA KULTURARV TILL DITT</span>
        <span className="mono text-[11px]">
          Material från <a className="text-acid underline" href="https://data.kb.se" target="_blank" rel="noopener">KB:s öppna data</a> · av Talo Vargas
        </span>
      </div>
    </footer>
  )
}
