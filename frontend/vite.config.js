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

  // Ativa PWA só em produção (ou se VITE_ENABLE_PWA !== 'false')
  const enablePWA = mode === 'production' && env.VITE_ENABLE_PWA !== 'false';

  return {
    base: '/', // bom explicitar
    plugins: [
      react(),
      enablePWA &&
        VitePWA({
          // 👇 evita import dinâmico "virtual:pwa-register"
          injectRegister: 'script',
          registerType: 'autoUpdate',

          // desabilita no dev (por segurança, já que enablePWA só é true em prod)
          devOptions: { enabled: false },

          // Manifesto mínimo; ajuste como quiser
          manifest: {
            name: 'Escola de Saúde',
            short_name: 'EscolaSaúde',
            start_url: '/',
            display: 'standalone',
            background_color: '#ffffff',
            theme_color: '#0f766e',
            icons: [
              { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
              { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
            ]
          },

          // workbox (opcional; defaults já são bons)
          workbox: {
            clientsClaim: true,
            skipWaiting: true,
          },
        }),
    ].filter(Boolean),

    // 💡 O proxy só roda em DEV. Em prod (Vercel/Render) o app é estático.
    server: {
      host: true, // permite acesso via LAN
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
        // Evita “duas cópias” de react (se não precisa, pode remover)
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
          // manualChunks opcional
        },
      },
    },

    // Garante que só variáveis com VITE_ sejam expostas ao client
    envPrefix: 'VITE_',
  };
});
