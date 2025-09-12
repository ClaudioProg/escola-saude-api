// 📁 vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Carrega variáveis .env (Vite só expõe as que começam com VITE_)
  const env = loadEnv(mode, process.cwd(), '');

  const proxyTarget =
    env.VITE_DEV_PROXY_TARGET || 'https://escola-saude-api.onrender.com';

  // Ativa PWA só em produção e se explicitamente permitido
  const enablePWA =
    mode === 'production' &&
    env.VITE_ENABLE_PWA !== 'false' &&
    env.VITE_ENABLE_PWA !== '0';

  return {
    base: '/',
    plugins: [
      react(),
      enablePWA &&
        VitePWA({
          /**
           * 👇 Usa tag <script> (arquivo gerado e servido de "self"),
           * evitando <script src="virtual:pwa-register"> que cai na CSP.
           */
          injectRegister: 'script',
          registerType: 'autoUpdate',

          devOptions: { enabled: false },

          manifest: {
            name: 'Escola de Saúde',
            short_name: 'EscolaSaúde',
            start_url: '/',
            scope: '/',
            display: 'standalone',
            background_color: '#ffffff',
            theme_color: '#0f766e',
            icons: [
              { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
              { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
            ]
          },

          workbox: {
            clientsClaim: true,
            skipWaiting: true,
            // (opcional) se tiver rotas de SPA:
            // navigateFallback: '/index.html',
          },
        }),
    ].filter(Boolean),

    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
          // rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },

    resolve: {
      alias: {
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        '@': path.resolve(__dirname, 'src'),
      },
    },

    build: {
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // manualChunks: {},
        },
      },
    },

    envPrefix: 'VITE_',
  };
});
