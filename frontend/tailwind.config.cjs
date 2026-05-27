// 📦 tailwind.config.cjs — Escola da Saúde
const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],

  darkMode: "class",

  safelist: [
    "bg-status-programado",
    "bg-status-andamento",
    "bg-status-encerrado",
    "bg-status-aguardando",

    "text-status-programado",
    "text-status-andamento",
    "text-status-encerrado",
    "text-status-aguardando",

    "ring-status-programado",
    "ring-status-andamento",
    "ring-status-encerrado",
    "ring-status-aguardando",

    "border-status-programado",
    "border-status-andamento",
    "border-status-encerrado",
    "border-status-aguardando",

    "bg-grad-lousa-roxo",
    "bg-grad-lousa-azul",
    "bg-grad-lousa-laranja",
    "bg-grad-lousa-dourado",

    "shadow-suave",
    "shadow-destaque",
  ],

  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        md: "1.25rem",
        lg: "2rem",
        xl: "2.5rem",
      },
    },

    extend: {
      colors: {
        brand: colors.emerald,

        gelo: "#f8fafc",
        lousa: "#14532d",
        verdelousa: "#14532d",
        textoLousa: "#ffffff",

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
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Arial",
          "sans-serif",
        ],
      },

      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },

      boxShadow: {
        suave: "0 2px 10px rgba(2, 6, 23, 0.08)",
        destaque: "0 18px 55px rgba(2, 6, 23, 0.18)",
      },

      minHeight: {
        card: "12rem",
      },

      backgroundImage: {
        "grad-lousa-roxo": "linear-gradient(90deg, #14532d, #6d28d9)",
        "grad-lousa-azul": "linear-gradient(90deg, #14532d, #2563eb)",
        "grad-lousa-laranja": "linear-gradient(90deg, #14532d, #ea580c)",
        "grad-lousa-dourado": "linear-gradient(90deg, #14532d, #b45309)",
      },

      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          "0%": {
            opacity: "0",
            transform: "translateY(8px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        shimmer: {
          "0%": {
            backgroundPosition: "-468px 0",
          },
          "100%": {
            backgroundPosition: "468px 0",
          },
        },
        "pulse-soft": {
          "0%, 100%": {
            opacity: "1",
          },
          "50%": {
            opacity: "0.65",
          },
        },
      },

      animation: {
        "fade-in": "fade-in 0.2s ease-out forwards",
        "slide-up": "slide-up 0.25s ease-out forwards",
        shimmer: "shimmer 1.2s linear infinite",
        "pulse-soft": "pulse-soft 2.2s ease-in-out infinite",
      },

      screens: {
        xs: "475px",
      },

      spacing: {
        13: "3.25rem",
        18: "4.5rem",
      },

      zIndex: {
        60: "60",
        70: "70",
        80: "80",
        90: "90",
        100: "100",
        999: "999",
        9999: "9999",
      },
    },
  },

  plugins: [
    require("@tailwindcss/forms")({
      strategy: "class",
    }),
    require("@tailwindcss/typography"),
    require("@tailwindcss/aspect-ratio"),

    function ({ addComponents, theme }) {
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

        "html[data-theme='dark'] .prose": {
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