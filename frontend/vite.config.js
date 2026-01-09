// 📁 vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

function toBool(v, def = false) {
  if (v == null) return def;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export default defineConfig(({ mode }) => {
  const root = process.cwd();
  const env = loadEnv(mode, root, ""); // expõe apenas VITE_* em runtime

  const IS_PROD = mode === "production";
  const ENABLE_PWA = IS_PROD && !toBool(env.VITE_ENABLE_PWA === "false" || env.VITE_ENABLE_PWA === "0", false);

  // ▶ Proxy alvo no dev
  const proxyTarget =
    (env.VITE_DEV_PROXY_TARGET || "http://localhost:3000").replace(/\/+$/, "");
  const isHttps = /^https:/i.test(proxyTarget);

  // ▶ Caches runtime para Workbox
  const runtimeCaching = [
    // API da Escola (GET/HEAD): cache com network-first p/ manter dados frescos
    {
      urlPattern: ({ url }) =>
        url.origin.includes("escola-saude-api.onrender.com") ||
        url.pathname.startsWith("/api"),
      handler: "NetworkFirst",
      method: "GET",
      options: {
        cacheName: "api-cache",
        networkTimeoutSeconds: 6,
        expiration: { maxEntries: 80, maxAgeSeconds: 60 * 10 }, // 10min
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // Fontes Google
    {
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts",
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 365 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // Imagens externas (logos/banners): cache-first com expiração
    {
      urlPattern: ({ request }) =>
        request.destination === "image" || /\.(png|jpe?g|gif|svg|webp)$/i.test(request.url),
      handler: "CacheFirst",
      options: {
        cacheName: "images",
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 dias
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ];

  return {
    base: "/",

    plugins: [
      react({
        // JSX dev: Fast Refresh já incluso
        babel: {
          // espaço para transforms específicos se precisar
        },
      }),

      ENABLE_PWA &&
        VitePWA({
          injectRegister: "script",
          registerType: "autoUpdate",
          devOptions: { enabled: false },
          manifest: {
            name: "Escola da Saúde",
            short_name: "SESA",
            start_url: "/",
            scope: "/",
            display: "standalone",
            background_color: "#ffffff",
            theme_color: "#0f766e",
            icons: [
              { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
              { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
              { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
            ],
          },
          workbox: {
            clientsClaim: true,
            skipWaiting: true,
            cleanupOutdatedCaches: true,
            globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
            navigateFallback: "/index.html",
            runtimeCaching,
          },
        }),
    ].filter(Boolean),

    server: {
      host: true,
      port: 5173,
      strictPort: true,
      hmr: { timeout: 12000, overlay: true },
      headers: {
        // Cabeçalhos úteis em dev (não-ruptivos)
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Content-Type-Options": "nosniff",
      },
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: isHttps, // verifica TLS do alvo quando https
          // rewrite opcional (mantemos /api)
          // rewrite: (p) => p,
        },
      },
    },

    resolve: {
      alias: {
        react: path.resolve(__dirname, "node_modules/react"),
        "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
        "@": path.resolve(__dirname, "src"),
      },
    },

    define: {
      // flags globais se precisar (ex.: remover warnings libs)
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },

    build: {
      sourcemap: !IS_PROD,
      cssCodeSplit: true,
      minify: IS_PROD ? "terser" : false,
      terserOptions: IS_PROD
        ? {
            compress: {
              drop_console: false, // mantenha logs se desejar
              passes: 2,
            },
            mangle: true,
            format: { comments: false },
          }
        : undefined,
      target: "es2018",
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000,
      assetsInlineLimit: 4096, // 4kb: imagens pequenas inline
      rollupOptions: {
        output: {
          // nomes de arquivos/chunks
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            chart: ["chart.js", "react-chartjs-2"],
            qrcode: ["qrcode.react", "react-qr-code"],
            // libs menores irão para "vendor" automaticamente
          },
        },
      },
    },

    // Apenas variáveis com prefixo VITE_ são expostas no client
    envPrefix: "VITE_",
  };
});
