// Vercel serverless-funktion: proxar KB:s sök-API och skickar vidare alla parametrar.
export default async function handler(req: any, res: any) {
  const qs = (req.url || '').split('?')[1] || ''
  if (!new URLSearchParams(qs).get('q')) { res.status(200).json({ hits: [] }); return }
  try {
    const r = await fetch('https://data.kb.se/search/?' + qs, { headers: { Accept: 'application/json' } })
    const data = await r.json()
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
    res.status(200).json(data)
  } catch {
    res.status(502).json({ hits: [] })
  }
}
