// 📁 vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Carrega .env (Vite só expõe variáveis com prefixo VITE_)
  const env = loadEnv(mode, process.cwd(), '');

  // ▶ Proxy alvo no dev:
  // - Padrão: API local em http://localhost:3000
  // - Pode sobrescrever com VITE_DEV_PROXY_TARGET (ex.: https://sua-api.com)
  const proxyTarget =
    env.VITE_DEV_PROXY_TARGET?.replace(/\/+$/, '') || 'http://localhost:3000';

  const isHttps = /^https:/i.test(proxyTarget);

  // Ativa PWA só em produção (mantém sua config)
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
          },
        }),
    ].filter(Boolean),

    server: {
      host: true,
      port: 5173,
      strictPort: true,
      proxy: {
        // Tudo que começar com /api vai para a API
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          // secure = true só quando o target for https
          secure: isHttps,
          // se sua API estiver atrás de um proxy que exige Host correto,
          // o changeOrigin acima já resolve; não precisa rewrite
          // rewrite: (p) => p, // (mantemos /api)
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
      rollupOptions: { output: {} },
    },

    envPrefix: 'VITE_',
  };
});
