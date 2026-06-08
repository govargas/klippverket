# Klippverket

**A DIY zine workshop built with KB open cultural heritage data.**

Klippverket lets users search KB's open cultural heritage data, place free-to-use archive images on an A5 artboard, apply xerox/riso-inspired filters, add text and export a zine-style PNG with source attribution. It connects my background in libraries and youth culture (LAVA), visual/music production and my current work as a frontend developer.

> Pitch: **KB:s öppna kulturarv som kreativt råmaterial.**

## Status — MVP klar (fas 1–4)
- Brutalistisk UI och en riktig editor: lägg flera bilder + rubriktext på en A5-yta, dra för att flytta, skala, per-bild-filter, redigera text, ta bort, lagerordning.
- **Filter-motor på riktigt** (`src/lib/filters.ts`): Xerox/tröskel + Duoton/riso i canvas 2D.
- **Live KB-sök + bildimport** via proxy så canvasen blir CORS-ren.
- **PNG-export** som komponerar alla lager med riktiga filter och bäddar källhänvisning.
- **Tillgänglighet:** tangentbordsstyrning, semantiska knappar, synligt fokus, `aria-live`-annonser, About-vy, `prefers-reduced-motion`.

Nästa (valfritt): drag-and-drop från hyllan, fler filter, spara/dela-länk, automatiska tester, axe/Lighthouse-rapport.

## Tangentbord
Tab markerar · piltangenter flyttar (Shift = fin) · `+`/`−` skalar · `Delete` tar bort.

## Stack
React 19, TypeScript, Vite, Tailwind v4, TanStack Query, Zustand, canvas-baserade bildfilter.

> Byggd i React/TypeScript där jag är snabbast; lär mig aktivt SvelteKit för att matcha KB:s stack.

## Kör lokalt
```bash
npm install
npm run dev
```

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

**Övrigt:** Cloudflare Pages fungerar också (statisk frontend + en liten Pages Function för proxyn). I dev efterliknas samma `/api`-endpoints av Vite-proxyn i `vite.config.ts`.

## Data & licens
KB:s öppna sök-API (`data.kb.se`, kräver `Accept: application/json`). Importerar i första hand material som är fritt/public domain där KB:s metadata tillåter det, och bäddar källhänvisning i exporten.

Koden är licensierad under **MIT** (se `LICENSE`). Kulturarvsmaterialet tillhör KB och dess leverantörer, och återanvänds enligt varje objekts rättighetsstatus.

## Tillgänglighet
Tangentbordsnåbara kontroller, semantiska knappar, synligt fokus och skärmläsar-annonser för nyckelhandlingar. Full canvas-manipulation via tangentbord och en formell axe/Lighthouse-rapport är dokumenterade som nästa steg.
