// Netlify Function (v2): proxar KB:s sök-API med rätt Accept-header.
// Binder direkt till /api/kbsearch via config.path nedan.
export default async (req: Request) => {
  const params = new URL(req.url).searchParams
  const q = params.get('q') ?? ''
  const limit = params.get('limit') ?? '24'
  if (!q) return Response.json({ hits: [] })
  try {
    const r = await fetch(
      `https://data.kb.se/search/?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`,
      { headers: { Accept: 'application/json' } },
    )
    return new Response(await r.text(), {
      headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=3600' },
    })
  } catch {
    return Response.json({ hits: [] }, { status: 502 })
  }
}
export const config = { path: '/api/kbsearch' }
