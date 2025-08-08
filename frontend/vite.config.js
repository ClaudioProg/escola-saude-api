import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // 🔌 Plugins utilizados no build
  plugins: [react()],

  // 🌐 Proxy para desenvolvimento local
  server: {
    proxy: {
      '/api': 'http://escola-saude-api.onrender.com', // 🔁 Redireciona chamadas para o backend
    },
  },

  // 📦 Correções de importação para evitar 'undefined.createContext'
  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },

  define: {
    'process.env': {}, // ⛑️ Evita erros em libs que acessam process.env
  },

  // 🏗️ Otimização do build: separação de chunks
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 🔍 Divisão personalizada de pacotes da pasta node_modules
          //if (id.includes('node_modules')) {
         //   if (id.includes('react')) return 'react-vendor';
          //  if (id.includes('lucide-react')) return 'icons-vendor';
         //   if (id.includes('react-router-dom')) return 'router-vendor';
         //   if (id.includes('axios')) return 'axios-vendor';
         //   return 'vendor';
         // }
        },
      },
    },
  },
});
