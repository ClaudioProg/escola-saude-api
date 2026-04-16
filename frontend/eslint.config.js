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

  // ✅ Base recomendada do ESLint
  js.configs.recommended,

  {
    // 📁 Arquivos da aplicação
    files: ["**/*.{js,jsx}"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...(globals.es2024 || globals.es2021),
      },
    },

    linterOptions: {
      reportUnusedDisableDirectives: "warn",
    },

    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
    },

    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,

      // ✳️ Código mais limpo
      "no-var": "error",
      "prefer-const": "warn",
      eqeqeq: ["warn", "smart"],
      curly: ["error", "multi-line"],
      "no-duplicate-imports": "error",

      // ⚙️ Variáveis não usadas
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // 🔍 Console liberado em dev, restrito em produção
      "no-console": isProd ? ["warn", { allow: ["warn", "error"] }] : "off",

      // ♻️ React Refresh (Vite HMR)
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // ♿️ Acessibilidade
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
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.jest,
        vi: true,
        describe: true,
        it: true,
        expect: true,
        beforeEach: true,
        afterEach: true,
        beforeAll: true,
        afterAll: true,
      },
    },
    rules: {
      "no-console": "off",
      "no-unused-expressions": "off",
    },
  },

  // ⚙️ Configurações Node / tooling
  {
    files: [
      "**/*.config.{js,mjs,cjs}",
      "eslint.config.js",
      "vite.config.{js,mjs,cjs}",
      "scripts/**/*.{js,mjs,cjs}",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
];