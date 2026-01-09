// 📦 postcss.config.cjs — Configuração institucional (Tailwind + Autoprefixer)
module.exports = {
  plugins: {
    // 🪴 Suporte a nesting (prioriza plugin do Tailwind, com fallback moderno)
    "tailwindcss/nesting": "postcss-nesting",

    // 🎨 Núcleo do Tailwind
    tailwindcss: {},

    // ⚙️ Autoprefixer (melhor compatibilidade + grid moderno)
    autoprefixer: {
      grid: "autoplace",
      flexbox: "no-2009"
    }
  }
};
