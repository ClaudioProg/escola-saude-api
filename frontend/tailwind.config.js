// 📁 tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        gelo: "#f8f9fa",        // Fundo claro
        lousa: "#2e5e4e",       // Verde institucional
        textoLousa: "#ffffff",  // Texto claro sobre verde
        roxo: "#6d28d9",
        azul: "#2563eb",
        lilas: "#a78bfa",
        rosa: "#ec4899",

        // 🎯 Cores semânticas para status
        status: {
          programado: "#22c55e",  // verde-500
          aguardando: "#facc15", // amarelo-400
          encerrado: "#ef4444",  // vermelho-500
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
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
        "grad-lousa-roxo": "linear-gradient(90deg, #2e5e4e, #6d28d9)",
        "grad-lousa-azul": "linear-gradient(90deg, #2e5e4e, #2563eb)",
      },
      screens: {
        xs: "475px",
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
  ],
};
