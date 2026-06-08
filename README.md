# Klippverket

**A DIY zine workshop built with KB open cultural heritage data.**

Klippverket lets users search KB's open cultural heritage data, place free-to-use archive images on an A5 artboard, apply xerox/riso-inspired filters, add text and export a zine-style PNG with source attribution. It connects my background in libraries and youth culture (LAVA), visual/music production and my current work as a frontend developer.

> Pitch: **KB:s öppna kulturarv som kreativt råmaterial.**

## Status — MVP klar (fas 1–4)
- Brutalistisk UI och en riktig editor: lägg flera bilder + rubriktext på en A5-yta, dra för att flytta, skala, per-bild-filter, redigera text, ta bort, lagerordning.
- **Filter-motor på riktigt** (`src/lib/filters.ts`): Xerox/tröskel + Duoton/riso i canvas 2D.
- **Live KB-sök + bildimport** via proxy så canvasen blir CORS-ren.
- **PNG-export** som komponerar alla lager med riktiga filter och bäddar källhänvisning.
- **Tillgänglighet:** tangentbordsstyrning på ytan, semantiska knappar, synligt fokus, `aria-live`-annonser, About-vy, `prefers-reduced-motion`.
- **Deploy-redo:** serverless-funktioner (`api/kbsearch.ts`, `api/kbimg.ts`) för produktion.

Nästa (valfritt): drag-and-drop från hyllan, fler filter, spara/dela-länk, automatiska tester, Lighthouse/axe-rapport i README.

## Tangentbord
Tab markerar ett objekt · piltangenter flyttar (Shift = fin) · `+`/`−` skalar · `Delete` tar bort.

## Stack
React 19, TypeScript, Vite, Tailwind v4, TanStack Query, Zustand, canvas-baserade bildfilter.

> Byggd i React/TypeScript där jag är snabbast; lär mig aktivt SvelteKit för att matcha KB:s stack.

## Kör lokalt
```bash
npm install
npm run dev
```
Sök t.ex. "Stockholm", klicka bilder, lägg till text, växla filter, exportera PNG.

## Deploy (Vercel)
Vercel upptäcker Vite automatiskt (`npm run build` → `dist`) och kör `api/*.ts` som serverless-funktioner.
```bash
npm i -g vercel
vercel        # följ promptarna; api/kbsearch + api/kbimg blir endpoints
```
I dev efterliknas samma endpoints av Vite-proxyn i `vite.config.ts`, så `/api/kbsearch` och `/api/kbimg` funkar både lokalt och i produktion.

## Data & licens
KB:s öppna sök-API (`data.kb.se`, kräver `Accept: application/json`). Importerar i första hand material som är fritt/public domain där KB:s metadata tillåter det, och bäddar källhänvisning i exporten. KB:s bilder hämtas via en liten server-proxy så de kan bearbetas säkert i canvas för filter och export.

## Tillgänglighet
Tangentbordsnåbara kontroller, semantiska knappar, synligt fokus och skärmläsar-annonser för nyckelhandlingar. Full canvas-manipulation via tangentbord och en formell axe/Lighthouse-rapport är dokumenterade som nästa steg.
