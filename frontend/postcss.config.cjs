// 📦 postcss.config.cjs — Configuração institucional (Tailwind + Autoprefixer)
module.exports = {
  plugins: {
    // 🪴 Nesting CSS moderno
    "postcss-nesting": {},

    // 🎨 Tailwind
    tailwindcss: {},

    // ⚙️ Compatibilidade de CSS
    autoprefixer: {
      grid: "autoplace",
      flexbox: "no-2009",
    },
  },
};