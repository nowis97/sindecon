import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    host: true,
    allowedHosts: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Cuaderno Médico',
        short_name: 'Cuaderno',
        description: 'Base de conocimientos médica personal, offline',
        lang: 'es',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache de todos los assets → la app abre offline completa.
        // La navegación SPA cae a index.html (navigateFallback por defecto).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  test: {
    // domain/ es lógica pura: tests en node, sin DOM
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
})
