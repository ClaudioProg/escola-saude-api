// 📁 vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Carrega variáveis .env (Vite só expõe as que começam com VITE_)
  const env = loadEnv(mode, process.cwd(), '');

  const proxyTarget =
    env.VITE_DEV_PROXY_TARGET || 'https://escola-saude-api.onrender.com';

  return {
    plugins: [react()],

    // 💡 O proxy só roda em DEV. Em prod (Vercel) o app é estático.
    server: {
      host: true, // permite acesso via LAN, útil para testar em celular
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          // Se seu backend estiver em HTTPS com cert válido, deixe secure: true
          secure: true,
          // Opcional: se precisar remover o prefixo /api no destino
          // rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },

    resolve: {
      alias: {
        // 🔧 Evita “duas cópias” de react em monorepos (mantenho, mas poderia remover se não for o caso)
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        // Exemplos úteis:
        '@': path.resolve(__dirname, 'src'),
      },
    },

    // ❌ Removido o hack de 'process.env': {} — com Vite isso não é necessário e pode confundir.
    // Use import.meta.env.VITE_*

    build: {
      sourcemap: mode !== 'production', // facilita debugging em dev/staging
      chunkSizeWarningLimit: 900, // evita aviso chato por libs grandes
      rollupOptions: {
        output: {
          // Deixe o Vite decidir os chunks; se precisar, descomente o manualChunks abaixo
          // manualChunks(id) {
          //   if (id.includes('node_modules')) return 'vendor';
          // },
        },
      },
      // Remove console.log em produção (opcional; deixe true se quiser “limpar”)
      // minify: 'esbuild',
      // terserOptions/esbuild não é necessário; Vite usa esbuild por padrão
    },

    // Garante que só variáveis com VITE_ sejam expostas ao client
    envPrefix: 'VITE_',
  };
});
