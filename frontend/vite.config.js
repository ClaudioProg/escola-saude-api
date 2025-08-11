// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  // Proxy só vale no DEV (localhost). Em produção no Vercel é build estático.
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'https://escola-saude-api.onrender.com',
        changeOrigin: true,
        secure: true, // ok porque o certificado do Render é válido
      },
    },
  },

  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },

  define: {
    'process.env': {},
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // deixe vazio mesmo; você pode reativar os chunks quando quiser
        },
      },
    },
  },
});
