// Klient mot KB:s öppna sök-API via /api/kbsearch (proxy i dev, serverless i prod).
// Bilder via /api/kbimg så de blir CORS-rena och kan bearbetas i canvas.

export type KbImage = {
  id: string
  title: string
  year: string | null
  creator: string | null
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
  contribution?: Array<{ agent?: Array<{ name?: string }> }>
  usageAndAccessPolicy?: Array<{ value?: string; '@id'?: string }>
}

const proxied = (url: string) => `/api/kbimg?url=${encodeURIComponent(url)}`

function isFree(p?: Hit['usageAndAccessPolicy']): boolean {
  if (!p) return false
  return p.some(
    (x) =>
      x.value === 'Free' ||
      (x['@id'] || '').includes('publicdomain') ||
      (x['@id'] || '').includes('/zero/'),
  )
}

function toImage(h: Hit): KbImage {
  const full = h.imageServiceId
    ? `${h.imageServiceId}/full/max/0/default.jpg`
    : (h.thumbnail as string)
  return {
    id: h['@id'],
    title: Array.isArray(h.title) ? h.title.join(' ') : h.title ?? 'Utan titel',
    year: h.datePublished ?? null,
    creator: h.contribution?.[0]?.agent?.[0]?.name ?? null,
    thumbnail: proxied(h.thumbnail as string),
    fullImage: proxied(full),
    license: h.usageAndAccessPolicy?.[0]?.value ?? null,
    sourceUrl: h['@id'],
  }
}

export type SearchOpts = { from?: string; to?: string; offset?: number }

export async function searchFreeImages(q: string, limit = 24, opts: SearchOpts = {}): Promise<KbImage[]> {
  try {
    const params = new URLSearchParams({ q: q || '*', limit: String(limit) })
    if (opts.from) params.set('from', opts.from)
    if (opts.to) params.set('to', opts.to)
    if (opts.offset) params.set('offset', String(opts.offset))
    const res = await fetch(`/api/kbsearch?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return []
    const data: { hits?: Hit[] } = await res.json()
    const withThumb = (data.hits ?? []).filter((h) => h.thumbnail)
    const free = withThumb.filter((h) => isFree(h.usageAndAccessPolicy))
    return (free.length ? free : withThumb).map(toImage)
  } catch {
    return []
  }
}
