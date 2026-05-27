// 📁 vite.config.js — Escola da Saúde
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const root = process.cwd();
  const env = loadEnv(mode, root, "");

  const isProd = mode === "production";

  const proxyTarget = String(
    env.VITE_DEV_PROXY_TARGET || "http://localhost:3000"
  ).replace(/\/+$/, "");

  const proxySecure = /^https:/i.test(proxyTarget);

  return {
    base: "/",

    plugins: [react()],

    server: {
      host: true,
      port: 5173,
      strictPort: true,

      hmr: {
        timeout: 12000,
        overlay: true,
      },

      headers: {
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Content-Type-Options": "nosniff",
      },

      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: proxySecure,
        },

        "/uploads": {
          target: proxyTarget,
          changeOrigin: true,
          secure: proxySecure,
        },
      },
    },

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },

    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "0.0.0"),
    },

    build: {
      sourcemap: !isProd,
      cssCodeSplit: true,
      minify: isProd ? "esbuild" : false,
      target: "es2018",
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000,
      assetsInlineLimit: 4096,

      rollupOptions: {
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",

          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            chart: ["chart.js", "react-chartjs-2"],
            qrcode: ["qrcode"],
            pdf: ["jspdf", "jspdf-autotable"],
          },
        },
      },
    },

    envPrefix: "VITE_",
  };
});