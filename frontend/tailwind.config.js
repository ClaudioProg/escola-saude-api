// ✅ tailwind.config.js
const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",

  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", md: "1.5rem", lg: "2rem" },
    },

    extend: {
      colors: {
        // Paleta principal
        brand: colors.emerald, // emerald fica mais premium que green no UI

        // Tokens existentes (compat)
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
        suave: "0 2px 10px rgba(0,0,0,0.08)",
        destaque: "0 18px 55px rgba(0,0,0,0.18)",
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
      },
      animation: {
        "fade-in": "fade-in .2s ease-out forwards",
        "slide-up": "slide-up .25s ease-out forwards",
        shimmer: "shimmer 1.2s linear infinite",
      },

      screens: { xs: "475px" },
    },
  },

  plugins: [
    require("@tailwindcss/forms")({ strategy: "class" }),
    require("@tailwindcss/typography"),
    require("@tailwindcss/aspect-ratio"),

    // ✅ Vars semânticas (úteis, mas sem brigar com App.css)
    function ({ addBase, theme }) {
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
    },
  ],
};
