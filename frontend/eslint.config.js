// 📦 eslint.config.js — Configuração institucional premium (React + Vite + A11y)
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";

const isProd = process.env.NODE_ENV === "production";

export default [
  // 🚫 Ignora artefatos de build/cache
  {
    ignores: [
      "**/dist/**",
      "**/dist-ssr/**",
      "**/node_modules/**",
      "**/.vite/**",
      "**/coverage/**",
      "**/.yarn/**",
      "**/.turbo/**",
      "**/.cache/**",
      "**/cypress/**",
      "**/playwright-report/**",
    ],
  },

  {
    // 📁 Arquivos a analisar
    files: ["**/*.{js,jsx}"],

    // 🌐 Linguagem / ambiente
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.es2021,
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

      // ✳️ Código mais limpo
      "no-var": "error",
      "prefer-const": "warn",
      eqeqeq: ["warn", "smart"],
      curly: ["error", "multi-line"],
      "no-duplicate-imports": "error",

      // ⚙️ Variáveis não usadas: permite Args com _ e Vars em Maiúscula (React Components)
      "no-unused-vars": [
        "error",
        { varsIgnorePattern: "^[A-Z]", argsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],

      // 🔍 Console liberado em dev, restrito em produção
      "no-console": isProd ? ["warn", { allow: ["warn", "error"] }] : "off",

      // ♻️ React Refresh (Vite HMR)
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // ♿️ Acessibilidade (jsx-a11y)
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/aria-role": "warn",
      "jsx-a11y/anchor-is-valid": "warn",
      "jsx-a11y/no-autofocus": "off",

      // ⚡ Outras melhorias
      "no-trailing-spaces": "warn",
      "eol-last": ["warn", "always"],
    },
  },

  // 🧪 Testes (Vitest / Jest): relaxa regras
  {
    files: ["**/*.{test,spec}.{js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
        vi: true,
        describe: true,
        it: true,
        expect: true,
      },
    },
    rules: {
      "no-console": "off",
      "no-unused-expressions": "off",
    },
  },

  // ⚙️ Configurações Node (Vite, ESLint, scripts)
  {
    files: [
      "**/*.config.{js,mjs,cjs}",
      "eslint.config.js",
      "vite.config.{js,mjs,cjs}",
      "scripts/**/*.js",
    ],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];
