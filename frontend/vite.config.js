// 📁 vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig(({ mode }) => {
  const root = process.cwd();
  const env = loadEnv(mode, root, ""); // carrega variáveis para a config; só VITE_* vão para o client

  const IS_PROD = mode === "production";
  const ENABLE_PWA =
    env.VITE_ENABLE_PWA !== "false" && env.VITE_ENABLE_PWA !== "0";

  const proxyTarget =
    (env.VITE_DEV_PROXY_TARGET || "http://localhost:3000").replace(/\/+$/, "");
  const isHttps = /^https:/i.test(proxyTarget);

  const runtimeCaching = [
    {
      urlPattern: ({ url }) =>
        url.origin.includes("escola-saude-api.onrender.com") ||
        url.pathname.startsWith("/api"),
      handler: "NetworkFirst",
      method: "GET",
      options: {
        cacheName: "api-cache",
        networkTimeoutSeconds: 6,
        expiration: { maxEntries: 80, maxAgeSeconds: 60 * 10 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts",
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 365 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: ({ request }) =>
        request.destination === "image" ||
        /\.(png|jpe?g|gif|svg|webp)$/i.test(request.url),
      handler: "CacheFirst",
      options: {
        cacheName: "images",
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ];

  return {
    base: "/",

    plugins: [
      react(),

      VitePWA({
        disable: !ENABLE_PWA,
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
          theme_color: "#14532d",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "/icons/maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          clientsClaim: true,
          skipWaiting: true,
          cleanupOutdatedCaches: true,
          globPatterns: [
            "**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg,woff2,webmanifest}",
          ],
          navigateFallback: "/index.html",
          runtimeCaching,
        },
      }),
    ],

    server: {
      host: true,
      port: 5173,
      strictPort: true,
      hmr: { timeout: 12000, overlay: true },
      headers: {
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Content-Type-Options": "nosniff",
      },
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: isHttps,
        },
        "/uploads": {
          target: proxyTarget,
          changeOrigin: true,
          secure: isHttps,
        },
      },
    },

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },

    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },

    build: {
      sourcemap: !IS_PROD,
      cssCodeSplit: true,
      minify: IS_PROD ? "esbuild" : false,
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
            qrcode: ["qrcode.react", "react-qr-code"],
          },
        },
      },
    },

    envPrefix: "VITE_",
  };
});