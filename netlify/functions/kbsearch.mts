// Netlify Function (v2): proxar KB:s sök-API och skickar vidare alla parametrar
// (q, limit, from, to, offset, _sort) med rätt Accept-header.
export default async (req: Request) => {
  const inUrl = new URL(req.url)
  if (!inUrl.searchParams.get('q')) return Response.json({ hits: [] })
  try {
    const r = await fetch('https://data.kb.se/search/' + inUrl.search, {
      headers: { Accept: 'application/json' },
    })
    return new Response(await r.text(), {
      headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=3600' },
    })
  } catch {
    return Response.json({ hits: [] }, { status: 502 })
  }
}
export const config = { path: '/api/kbsearch' }
