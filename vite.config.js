import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
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
})
