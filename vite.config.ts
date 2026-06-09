import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// I dev efterliknar vi produktionens serverless-endpoints:
//   /api/kbsearch  -> KB:s sök-API (med Accept-header)
//   /api/kbimg     -> generisk bild-proxy (CORS-ren canvas)
// I produktion sköts samma paths av api/kbsearch.ts och api/kbimg.ts (Vercel).
function kbImageProxy(): Plugin {
  return {
    name: 'kb-image-proxy',
    configureServer(server) {
      server.middlewares.use('/api/kbimg', async (req: any, res: any) => {
        try {
          const u = new URL(req.url || '', 'http://localhost')
          const target = u.searchParams.get('url')
          if (!target) { res.statusCode = 400; res.end('missing url'); return }
          // Spegla produktionens allowlist så dev och prod beter sig lika.
          let host: string
          try { host = new URL(target).hostname } catch { res.statusCode = 400; res.end('invalid url'); return }
          if (host !== 'data.kb.se') { res.statusCode = 403; res.end('host not allowed'); return }
          const upstream = await (globalThis as any).fetch(target)
          if (!upstream.ok) { res.statusCode = upstream.status; res.end('upstream error'); return }
          res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg')
          res.setHeader('Cache-Control', 'public, max-age=86400')
          res.end(new Uint8Array(await upstream.arrayBuffer()))
        } catch {
          res.statusCode = 502; res.end('proxy error')
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), kbImageProxy()],
  server: {
    proxy: {
      '/api/kbsearch': {
        target: 'https://data.kb.se',
        changeOrigin: true,
        headers: { Accept: 'application/json' },
        rewrite: (p) => p.replace(/^\/api\/kbsearch/, '/search'),
      },
    },
  },
})
