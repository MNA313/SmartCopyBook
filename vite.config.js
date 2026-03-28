import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

/** Set LAN=1 (see npm run dev:lan) so phones/other PCs can open the app on your Wi‑Fi with HTTPS — required for microphone in most browsers. */
const lanDev =
  process.env.LAN === '1' || process.env.LAN === 'true' || process.env.LAN === 'yes'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const transcribePort = env.TRANSCRIBE_PORT || '8787'
  const transcribeTarget = `http://127.0.0.1:${transcribePort}`

  /** When the transcribe server is not running, avoid HTTP 500 on /api (noisy red console). */
  const apiProxy = {
    target: transcribeTarget,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('error', (err, _req, res) => {
        if (!res || res.writableEnded || res.headersSent) return
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, hasKey: false }))
        if (process.env.VITE_LOG_TRANSCRIBE_PROXY !== '0') {
          console.warn(
            `[vite] /api proxy → ${transcribeTarget} failed (${err?.code || err?.message}). ` +
              'Start: npm run transcribe-server (or npm run dev:all).',
          )
        }
      })
    },
  }

  return {
    build: {
      target: 'es2022',
    },
    server: {
      ...(lanDev ? { host: true } : {}),
      proxy: {
        '/api': apiProxy,
      },
    },
    preview: {
      ...(lanDev ? { host: true } : {}),
      proxy: {
        '/api': apiProxy,
      },
    },
    plugins: [
      ...(lanDev ? [basicSsl()] : []),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        workbox: {
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
        },
        manifest: {
          name: 'SmartCopyBook',
          short_name: 'SmartCopyBook',
          description: 'Class notes, organized by subject',
          theme_color: '#6366f1',
          background_color: '#f8f6f2',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: '/favicon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
          ],
        },
      }),
    ],
  }
})
