// Netlify Function (v2): generisk bild-proxy så KB:s bilder blir CORS-rena.
export default async (req: Request) => {
  const target = new URL(req.url).searchParams.get('url')
  if (!target) return new Response('missing url', { status: 400 })
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
