// Vercel serverless-funktion: bild-proxy så KB:s bilder blir CORS-rena
// och kan bearbetas i canvas (filter + PNG-export).
// Allowlist:ad till data.kb.se så endpointen inte blir ett öppet relä (SSRF /
// bandbreddsmissbruk på vårt konto). KB:s thumbnails och IIIF ligger på samma host.
const ALLOWED_HOST = 'data.kb.se'
export default async function handler(req: any, res: any) {
  const url = (req.query?.url ?? '') as string
  if (!url) { res.status(400).send('missing url'); return }
  let host: string
  try { host = new URL(url).hostname } catch { res.status(400).send('invalid url'); return }
  if (host !== ALLOWED_HOST) { res.status(403).send('host not allowed'); return }
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
