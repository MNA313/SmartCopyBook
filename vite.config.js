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

  return {
    build: {
      target: 'es2022',
    },
    server: {
      ...(lanDev ? { host: true } : {}),
      proxy: {
        '/api': {
          target: transcribeTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      ...(lanDev ? { host: true } : {}),
      proxy: {
        '/api': {
          target: transcribeTarget,
          changeOrigin: true,
        },
      },
    },
    plugins: [
      ...(lanDev ? [basicSsl()] : []),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
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
