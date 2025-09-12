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
        // ✅ Paleta principal como alias (use bg-brand-900, text-brand-600, etc.)
        brand: colors.green,

        // ✅ Tokens existentes (mantidos), alinhados ao brand.900
        gelo: "#f8f9fa",          // Fundo claro
        lousa: colors.green[900], // Verde institucional -> verde 900
        verdelousa: colors.green[900], // 👈 alias legado (compat)
        textoLousa: colors.white,

        // Extras usados no projeto
        roxo: "#6d28d9",
        azul: "#2563eb",
        lilas: "#a78bfa",
        rosa: "#ec4899",

        // 🎯 Cores semânticas para status (usando Tailwind colors)
        status: {
          programado: colors.green[500],
          aguardando: colors.amber[400],
          encerrado: colors.red[500],
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
        // Gradientes atualizados para usar o verde 900
        "grad-lousa-roxo": `linear-gradient(90deg, ${colors.green[900]}, #6d28d9)`,
        "grad-lousa-azul": `linear-gradient(90deg, ${colors.green[900]}, #2563eb)`,
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
  ],
};
