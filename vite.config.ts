import { defineConfig } from 'vite';
import { resolve } from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/aposta-loteria/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'ES2022',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks(id: string) {
          if (id.includes('uplot')) return 'charts';
          if (id.includes('idb-keyval')) return 'vendor';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
    worker: {
      format: 'es',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*loteria.*\.vercel\.app\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
            },
          },
        ],
      },
      manifest: {
        name: 'Loterias Brasil IA',
        short_name: 'Loteria IA',
        description: 'Motor probabilistico para analise de loterias brasileiras',
        theme_color: '#071018',
        background_color: '#071018',
        display: 'standalone',
        start_url: '/aposta-loteria/',
        icons: [
          { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
});
