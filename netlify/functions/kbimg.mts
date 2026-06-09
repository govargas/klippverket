// Netlify Function (v2): bild-proxy så KB:s bilder blir CORS-rena.
// Allowlist:ad till data.kb.se så endpointen inte blir ett öppet relä (SSRF /
// bandbreddsmissbruk på vårt konto). KB:s thumbnails och IIIF ligger på samma host.
const ALLOWED_HOST = 'data.kb.se'
export default async (req: Request) => {
  const target = new URL(req.url).searchParams.get('url')
  if (!target) return new Response('missing url', { status: 400 })
  let host: string
  try { host = new URL(target).hostname } catch { return new Response('invalid url', { status: 400 }) }
  if (host !== ALLOWED_HOST) return new Response('host not allowed', { status: 403 })
  try {
    const upstream = await fetch(target)
    if (!upstream.ok) return new Response('upstream error', { status: upstream.status })
    return new Response(upstream.body, {
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'image/jpeg',
        'cache-control': 's-maxage=86400',
      },
    })
  } catch {
    return new Response('proxy error', { status: 502 })
  }
}
export const config = { path: '/api/kbimg' }
