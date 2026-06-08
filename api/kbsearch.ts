// Vercel serverless-funktion: proxar KB:s sök-API med rätt Accept-header.
export default async function handler(req: any, res: any) {
  const q = (req.query?.q ?? '') as string
  const limit = (req.query?.limit ?? '24') as string
  if (!q) { res.status(200).json({ hits: [] }); return }
  try {
    const r = await fetch(
      `https://data.kb.se/search/?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`,
      { headers: { Accept: 'application/json' } },
    )
    const data = await r.json()
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
    res.status(200).json(data)
  } catch {
    res.status(502).json({ hits: [] })
  }
}
