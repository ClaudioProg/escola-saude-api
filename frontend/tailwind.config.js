// ✅ tailwind.config.js — Escola da Saúde (premium)
const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./public/**/*.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],

  darkMode: "class",

  // 🔒 Evita purge agressivo remover classes dinâmicas (ex.: via map/status)
  safelist: [
    // status (cores institucionais)
    { pattern: /^(bg|text|ring|border)-status-(programado|andamento|encerrado|aguardando)$/ },
    // gradientes temáticos opcionais
    { pattern: /^bg-grad-lousa-(roxo|azul|laranja|dourado)$/ },
    // helpers ocasionais
    "shadow-suave",
    "shadow-destaque",
  ],

  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", md: "1.25rem", lg: "2rem", xl: "2.5rem" },
    },

    extend: {
      colors: {
        // 🎨 Paleta principal (emerald “mais premium”)
        brand: colors.emerald,

        // Compat/tokens existentes
        gelo: "#f8f9fa",
        lousa: colors.green[900],
        verdelousa: colors.green[900],
        textoLousa: colors.white,

        petroleo: "#0f172a",
        violeta: "#6d28d9",
        dourado: "#b45309",
        laranja: "#ea580c",
        azul: "#2563eb",
        lilas: "#a78bfa",
        rosa: "#ec4899",

        // 🟩🟨🟥 Padrão institucional (memorizado)
        status: {
          programado: colors.green[500],
          andamento: colors.amber[400],
          encerrado: colors.red[500],
          aguardando: colors.amber[400],
        },
      },

      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
      },

      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },

      boxShadow: {
        suave: "0 2px 10px rgba(2,6,23,0.08)",
        destaque: "0 18px 55px rgba(2,6,23,0.18)",
      },

      minHeight: { card: "12rem" },

      backgroundImage: {
        "grad-lousa-roxo": `linear-gradient(90deg, ${colors.green[900]}, #6d28d9)`,
        "grad-lousa-azul": `linear-gradient(90deg, ${colors.green[900]}, #2563eb)`,
        "grad-lousa-laranja": `linear-gradient(90deg, ${colors.green[900]}, #ea580c)`,
        "grad-lousa-dourado": `linear-gradient(90deg, ${colors.green[900]}, #b45309)`,
      },

      keyframes: {
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "slide-up": { "0%": { opacity: 0, transform: "translateY(8px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        shimmer: { "0%": { backgroundPosition: "-468px 0" }, "100%": { backgroundPosition: "468px 0" } },
        "pulse-soft": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.65 },
        },
      },
      animation: {
        "fade-in": "fade-in .2s ease-out forwards",
        "slide-up": "slide-up .25s ease-out forwards",
        shimmer: "shimmer 1.2s linear infinite",
        "pulse-soft": "pulse-soft 2.2s ease-in-out infinite",
      },

      // Breakpoint extra mobile-first
      screens: { xs: "475px" },

      // Espaçamentos úteis (opcional)
      spacing: {
        13: "3.25rem",
        18: "4.5rem",
      },

      // Z-index utilitário para overlays premium
      zIndex: {
        60: "60",
        70: "70",
        80: "80",
        90: "90",
        100: "100",
      },
    },
  },

  plugins: [
    require("@tailwindcss/forms")({ strategy: "class" }),
    require("@tailwindcss/typography"),
    require("@tailwindcss/aspect-ratio"),

    // 🔧 Vars semânticas + tipografia premium (light/dark)
    function ({ addBase, addComponents, theme }) {
      addBase({
        ":root": {
          "--color-bg": theme("colors.white"),
          "--color-surface": theme("colors.slate.50"),
          "--color-card": theme("colors.white"),
          "--color-border": theme("colors.slate.200"),
          "--color-text": theme("colors.slate.900"),
          "--color-text-muted": theme("colors.slate.600"),
          "--ring": "rgba(20,83,45,.6)", // ring institucional
        },
        ".dark": {
          "--color-bg": "#0b1220",
          "--color-surface": "#0f172a",
          "--color-card": "#0f172a",
          "--color-border": "rgba(255,255,255,.12)",
          "--color-text": theme("colors.slate.50"),
          "--color-text-muted": theme("colors.zinc.400"),
          "--ring": "rgba(52,211,153,.45)",
        },
      });

      // Tipografia: melhora contraste e links no dark
      addComponents({
        ".prose": {
          "--tw-prose-body": theme("colors.slate.800"),
          "--tw-prose-headings": theme("colors.slate.900"),
          "--tw-prose-links": theme("colors.emerald.700"),
          "--tw-prose-bold": theme("colors.slate.900"),
          "--tw-prose-quotes": theme("colors.slate.900"),
          "--tw-prose-code": theme("colors.slate.900"),
        },
        ".dark .prose": {
          "--tw-prose-body": theme("colors.slate.200"),
          "--tw-prose-headings": theme("colors.slate.100"),
          "--tw-prose-links": theme("colors.emerald.400"),
          "--tw-prose-bold": theme("colors.slate.50"),
          "--tw-prose-quotes": theme("colors.slate.100"),
          "--tw-prose-code": theme("colors.slate.100"),
        },
      });
    },
  ],
};
