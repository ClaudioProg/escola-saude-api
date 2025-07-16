// vite.config.js

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 🔌 Plugins utilizados no build
  plugins: [react()],

  // 🌐 Proxy para desenvolvimento local
  server: {
    proxy: {
      '/api': 'http://localhost:3000', // 🔁 Redireciona chamadas para o backend
    },
  },

  // 🏗️ Otimização do build: separação de chunks
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 🔍 Divisão personalizada de pacotes da pasta node_modules
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'react-vendor';
            if (id.includes('lucide-react')) return 'icons-vendor';
            if (id.includes('react-router-dom')) return 'router-vendor';
            if (id.includes('axios')) return 'axios-vendor';
            return 'vendor';
          }
        },
      },
    },
  },
});
