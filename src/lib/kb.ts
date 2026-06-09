// Klient mot KB:s öppna sök-API via /api/kbsearch (proxy i dev, serverless i prod).
// Bilder via /api/kbimg så de blir CORS-rena och kan bearbetas i canvas.

export type KbImage = {
  id: string
  title: string
  year: string | null
  creator: string | null
  creatorRole: string | null
  genres: string[]
  subjects: string[]
  thumbnail: string
  fullImage: string
  license: string | null
  sourceUrl: string
}

type Hit = {
  '@id': string
  title?: string | string[]
  datePublished?: string
  thumbnail?: string
  imageServiceId?: string
  contribution?: Array<{ agent?: Array<{ name?: string }>; role?: Array<{ prefLabelByLang?: { sv?: string } }> }>
  genreForm?: Array<{ prefLabel?: { sv?: string } }>
  subject?: Array<{ displayPrefLabel?: string; prefLabel?: string }>
  usageAndAccessPolicy?: Array<{ value?: string; '@id'?: string; prefLabelByLang?: { sv?: string } }>
}

const proxied = (url: string) => `/api/kbimg?url=${encodeURIComponent(url)}`

// Returnerar den policy-post som gör objektet fritt, eller undefined.
// Licensetiketten ska komma från SAMMA post som filtreringen, annars kan
// "Om bilden"-kortet motsäga själva fri-bedömningen.
function freePolicy(p?: Hit['usageAndAccessPolicy']) {
  if (!p) return undefined
  return p.find(
    (x) =>
      x.value === 'Free' ||
      (x['@id'] || '').includes('publicdomain') ||
      (x['@id'] || '').includes('/zero/'),
  )
}
function isFree(p?: Hit['usageAndAccessPolicy']): boolean {
  return !!freePolicy(p)
}

function toImage(h: Hit): KbImage {
  const full = h.imageServiceId
    ? `${h.imageServiceId}/full/max/0/default.jpg`
    : (h.thumbnail as string)
  const contrib = h.contribution?.[0]
  return {
    id: h['@id'],
    title: Array.isArray(h.title) ? h.title.join(' ') : h.title ?? 'Utan titel',
    year: h.datePublished ? h.datePublished.slice(0, 4) : null,
    creator: contrib?.agent?.[0]?.name ?? null,
    creatorRole: contrib?.role?.[0]?.prefLabelByLang?.sv ?? null,
    genres: (h.genreForm ?? []).map((g) => g.prefLabel?.sv).filter((x): x is string => !!x),
    subjects: (h.subject ?? []).map((s) => s.displayPrefLabel ?? s.prefLabel).filter((x): x is string => !!x),
    thumbnail: proxied(h.thumbnail as string),
    fullImage: proxied(full),
    license: (() => { const fp = freePolicy(h.usageAndAccessPolicy); return fp?.prefLabelByLang?.sv ?? fp?.value ?? null })(),
    sourceUrl: h['@id'],
  }
}

export type SearchOpts = { from?: string; to?: string; offset?: number }
// images = endast fritt/public domain-material. total = alla träffar för frågan
// (även ofria) så anroparen kan skilja "inga träffar" från "inga FRIA träffar".
export type SearchResponse = { images: KbImage[]; total: number }

export async function searchFreeImages(q: string, limit = 24, opts: SearchOpts = {}): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: q || '*', limit: String(limit) })
  if (opts.from) params.set('from', opts.from)
  if (opts.to) params.set('to', opts.to)
  if (opts.offset) params.set('offset', String(opts.offset))
  const res = await fetch(`/api/kbsearch?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  // Kasta vid driftfel så anroparen kan visa ett ärligt felmeddelande
  // istället för att låta nätverksfel se ut som ett tomt sökresultat.
  if (!res.ok) throw new Error(`KB-sök misslyckades: ${res.status}`)
  const data: { hits?: Hit[]; total?: number } = await res.json()
  const withThumb = (data.hits ?? []).filter((h) => h.thumbnail)
  // Strikt: visa BARA material som metadatan markerar som fritt/public domain.
  // Ingen fallback till ofritt — appen lovar fritt material och får inte
  // tvätta rättighetsskyddade verk till en export med KB-kreditering.
  const free = withThumb.filter((h) => isFree(h.usageAndAccessPolicy))
  return { images: free.map(toImage), total: data.total ?? withThumb.length }
}
