// 📁 tailwind.config.js
const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",

  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        md: "1.5rem",
        lg: "2rem",
      },
    },

    extend: {
      colors: {
        // ✅ Paleta principal (use bg-brand-900, text-brand-600, etc.)
        brand: colors.green,

        // ✅ Tokens existentes (mantidos)
        gelo: "#f8f9fa",                 // Fundo claro
        lousa: colors.green[900],        // Verde institucional -> verde 900
        verdelousa: colors.green[900],   // alias legado (compat)
        textoLousa: colors.white,

        // Extras usados no projeto (headers/accents)
        petroleo: "#0f172a", // slate-900-ish
        violeta: "#6d28d9",
        dourado: "#b45309", // amber-700-ish
        laranja: "#ea580c",
        azul: "#2563eb",
        lilas: "#a78bfa",
        rosa: "#ec4899",

        // 🎯 Cores semânticas de status (padrão do Cláudio)
        status: {
          programado: colors.green[500], // verde
          andamento: colors.amber[400],  // amarelo (em andamento)
          encerrado: colors.red[500],    // vermelho
          // compat:
          aguardando: colors.amber[400],
        },
      },

      fontFamily: {
        // Fallbacks robustos
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
      },

      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem", // usado nos Cards e Botões
      },

      boxShadow: {
        suave: "0 2px 8px rgba(0,0,0,0.08)", // sombra clean para cards
        destaque: "0 4px 12px rgba(0,0,0,0.15)",
      },

      minHeight: {
        card: "12rem", // altura mínima para cards ficarem consistentes
      },

      backgroundImage: {
        // Gradientes alinhados ao brand.900
        "grad-lousa-roxo": `linear-gradient(90deg, ${colors.green[900]}, #6d28d9)`,
        "grad-lousa-azul": `linear-gradient(90deg, ${colors.green[900]}, #2563eb)`,
        "grad-lousa-laranja": `linear-gradient(90deg, ${colors.green[900]}, #ea580c)`,
        "grad-lousa-dourado": `linear-gradient(90deg, ${colors.green[900]}, #b45309)`,
      },

      // ✨ animações úteis
      keyframes: {
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "slide-up": {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-468px 0" },
          "100%": { backgroundPosition: "468px 0" },
        },
      },
      animation: {
        "fade-in": "fade-in .2s ease-out forwards",
        "slide-up": "slide-up .25s ease-out forwards",
        shimmer: "shimmer 1.2s linear infinite",
      },

      screens: {
        xs: "475px",
      },
    },
  },

  plugins: [
    require("@tailwindcss/forms")({ strategy: "class" }),
    require("@tailwindcss/typography"),
    require("@tailwindcss/aspect-ratio"),

    // 🌗 CSS variables para tokens semânticos (light/dark)
    function ({ addBase, theme }) {
      addBase({
        ":root": {
          // superfícies (light)
          "--color-bg": "#ffffff",
          "--color-surface": theme("colors.gray.50"),
          "--color-card": theme("colors.white"),
          "--color-border": theme("colors.gray.200"),
          "--color-text": theme("colors.gray.900"),
          "--color-text-muted": theme("colors.gray.600"),
          "--ring": theme("colors.green.600"),
        },
        ".dark": {
          // superfícies (dark)
          "--color-bg": theme("colors.gray.900"),
          "--color-surface": theme("colors.gray.800"),
          "--color-card": theme("colors.gray.800"),
          "--color-border": theme("colors.gray.700"),
          "--color-text": theme("colors.gray.100"),
          "--color-text-muted": theme("colors.gray.400"),
          "--ring": theme("colors.green.400"),
        },
      });
    },
  ],
};
