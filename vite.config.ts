import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/myfin-app/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'misGastos',
        short_name: 'misGastos',
        description: 'Control de gastos del hogar',
        start_url: '/myfin-app/',
        display: 'standalone',
        background_color: '#f2f2f7',
        theme_color: '#007aff',
        icons: [
          { src: '/myfin-app/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
});
