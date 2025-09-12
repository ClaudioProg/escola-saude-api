// postcss.config.cjs (CommonJS)
module.exports = {
  plugins: {
    "tailwindcss/nesting": {},
    tailwindcss: {},
    autoprefixer: { grid: "autoplace" },
  },
};