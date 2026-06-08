// Vercel serverless-funktion: generisk bild-proxy så KB:s bilder blir CORS-rena
// och kan bearbetas i canvas (filter + PNG-export).
export default async function handler(req: any, res: any) {
  const url = (req.query?.url ?? '') as string
  if (!url) { res.status(400).send('missing url'); return }
  try {
    const upstream = await fetch(url)
    if (!upstream.ok) { res.status(upstream.status).send('upstream error'); return }
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg')
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate')
    res.status(200).send(Buffer.from(await upstream.arrayBuffer()))
  } catch {
    res.status(502).send('proxy error')
  }
}
