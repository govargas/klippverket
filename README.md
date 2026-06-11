# Klippverket

**A DIY zine workshop built with KB open cultural heritage data.**

**Live demo:** https://klippverket.netlify.app/

Klippverket lets users search KB's open cultural heritage data, place free-to-use archive images on an A5 artboard, apply print-history-inspired filters, add typographic headlines, and export a zine as PNG or PDF with source attribution. A scrollable landing page frames the workshop with live KB imagery, filter and font timelines, and a riso-inspired design system. The project connects my background in libraries and youth culture (LAVA), visual/music production, and my current work as a frontend developer.

> Pitch: **KB:s öppna kulturarv som kreativt råmaterial.**

## Status — komplett verkstad (fas 1–5)

**Landningssida** (`src/sections.tsx`): sticky nav, hero med levande KB-collage, manifest, markis, steg-för-steg, horisontell filter-tidslinje, typografi-specimen, galleri och avslutande CTA. Inträdesrörelse i ren CSS (tidsbaserad `@keyframes`, inte scrolldriven) som respekterar `prefers-reduced-motion`, så inget JS kan lämna innehåll osynligt.

**Verkstaden** (`src/App.tsx`):
- A5-editor med flera bilder + rubriktext per sida: dra för att flytta, skala, per-bild-filter (upp till två lager), redigera text, ta bort, lagerordning.
- **Flera sidor** — bygg ett helt zine, bläddra mellan sidor, lägg till/ta bort.
- **Arkivet** — live KB-sök med teman, epoker, fritext och "Överraska mig"; drag-and-drop från hyllan till arket (desktop).
- **Elva filter** i canvas 2D (`src/lib/filters.ts`): gravyr, cyanotypi, sepia, raster, CMYK, solarisering, posterisering, xerox, dither, duoton, korn.
- **Åtta rubriktypsnitt** (`src/lib/fonts.ts`) — en tidslinje från antiken till fanzine.
- **Export:** PNG (en sida) eller PDF (hela zinet, lazy-loaded jsPDF) med inbäddad källhänvisning.
- **Spara & dela:** lokalt i webbläsaren ("Mina zines") + delbar URL (`#z=…` i adressfältet).
- **Tillgänglighet:** tangentbordsstyrning, semantiska knappar, synligt fokus, `aria-live`-annonser, About-vy, `prefers-reduced-motion`.

Nästa (valfritt): automatiska tester, Lighthouse-rapport, fler filter, touch-optimerad drag-and-drop.

## Tangentbord

Tab markerar · piltangenter flyttar (Shift = fin) · `+`/`−` skalar · `Delete` tar bort.

## Projektstruktur

```
src/
  App.tsx          # verkstaden: editor, sök, export, spara/dela
  sections.tsx     # landningssidan: hero, tidslinjer, galleri, footer
  lib/
    filters.ts     # filterregister + canvas 2D-pixelmotor
    fonts.ts       # typsnittsregister (Google Fonts)
    kb.ts          # klient mot KB:s sök-API
api/               # Vercel serverless (kbsearch, kbimg)
netlify/functions/ # Netlify-motsvarighet, samma /api-paths
```

## Stack

React 19, TypeScript, Vite 8, Tailwind v4 (`@theme`-tokens i `src/index.css`), egen canvas-baserad bildfiltermotor, jsPDF (lazy-loaded för zine-export), två små serverless-proxyer mot KB.

Tillståndet är medvetet lokalt (`useState`) — appen redigerar ett dokument i en vy, så en global store eller en server-cache-klient hade varit overengineering utan motsvarande nytta.

> Byggd i React/TypeScript där jag är snabbast; lär mig aktivt SvelteKit för att matcha KB:s stack.

## Kör lokalt

```bash
npm install
npm run dev
```

Vite-proxyn i `vite.config.ts` efterliknar produktionens `/api/kbsearch` och `/api/kbimg` i dev.

## Driftsättning (inte låst till en leverantör)

Frontend är statiska filer (`dist`) och kan ligga var som helst. Det enda värdspecifika är två små proxy-funktioner (CORS-ren bild/sök mot KB). De finns färdiga för både Netlify och Vercel, med samma `/api/kbsearch` och `/api/kbimg`-paths, så appen behöver inte ändras.

**Netlify**

```bash
npm i -g netlify-cli
netlify deploy --build --prod
```

`netlify.toml` sätter build (`dist`) och funktionerna i `netlify/functions/` binder själva till `/api/...`.

**Vercel**

```bash
npm i -g vercel
vercel
```

Vercel upptäcker Vite automatiskt och kör `api/*.ts` som serverless-funktioner.

**Övrigt:** Cloudflare Pages fungerar också (statisk frontend + en liten Pages Function för proxyn).

## Data & licens

KB:s öppna sök-API (`data.kb.se`, kräver `Accept: application/json`). Importerar i första hand material som är fritt/public domain där KB:s metadata tillåter det, och bäddar källhänvisning i exporten.

Koden är licensierad under **MIT** (se `LICENSE`). Kulturarvsmaterialet tillhör KB och dess leverantörer, och återanvänds enligt varje objekts rättighetsstatus.

## Tillgänglighet

Tangentbords- och pekstyrd editor (pekarfångst så drag fungerar på touch), semantiska knappar, synligt fokus, landmärken och `aria-live`-annonser för nyckelhandlingar. Manuell axe-core-granskning utan anmärkningar (inkl. kontrast).

**Medveten begränsning:** själva bildkompositionen ritas i `<canvas>` och exponeras inte pixel för pixel för skärmläsare — varje objekt på ytan har istället en beskrivande etikett (titel/rubrik). Full skärmläsar-representation av kompositionen och en Lighthouse-rapport är nästa steg.
