// 📦 postcss.config.cjs — Escola da Saúde
// Pipeline CSS: nesting moderno + Tailwind + prefixação automática.

module.exports = {
  plugins: {
    "postcss-nesting": {},

    tailwindcss: {},

    autoprefixer: {
      grid: "autoplace",
      flexbox: "no-2009",
    },
  },
};