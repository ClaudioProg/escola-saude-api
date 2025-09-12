// 📦 presets e plugins
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";

const isProd = process.env.NODE_ENV === "production";

export default [
  // 🚫 Ignora artefatos de build/cache
  { ignores: ["**/dist/**", "**/dist-ssr/**", "**/node_modules/**", "**/.vite/**", "**/coverage/**"] },

  {
    // 📁 Arquivos a analisar
    files: ["**/*.{js,jsx}"],

    // 🌐 Linguagem/ambiente
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },

    // 🔌 Plugins
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
    },

    // ⚙️ Settings
    settings: {
      react: { version: "detect" },
    },

    // ✅ Regras
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,

      // Vars não usadas: permite Args iniciados com _ e Vars com Maiúscula
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z]", argsIgnorePattern: "^_", ignoreRestSiblings: true }],

      // Console: livre em dev, restrito em prod
      "no-console": isProd ? ["warn", { allow: ["warn", "error"] }] : "off",

      // HMR do Vite + React
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // 🧪 (Opcional) Testes: relaxa console e globais
  {
    files: ["**/*.{test,spec}.{js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest, // troque por globals.node ou vitest se usar Vitest
      },
    },
    rules: {
      "no-console": "off",
    },
  },

  // ⚙️ Config files (Node)
  {
    files: ["**/*.config.{js,mjs,cjs}", "eslint.config.js", "vite.config.{js,mjs,cjs}"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];
