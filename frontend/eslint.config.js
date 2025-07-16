// 📦 Importações dos presets e plugins necessários
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  // 🚫 Ignora arquivos de build
  { ignores: ['**/dist/**'] },

  {
    // 📁 Arquivos que serão analisados
    files: ['**/*.{js,jsx}'],

    // 🌐 Configurações da linguagem
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },

    // 🔌 Plugins utilizados
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },

    // ✅ Regras definidas
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // 🔍 Ignora variáveis iniciadas com maiúscula e argumentos com prefixo "_"
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z]', argsIgnorePattern: '^_' }],

      // ♻️ Garante que apenas componentes sejam exportados em arquivos com HMR (Hot Module Replacement)
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },

    // ⚛️ Configuração de detecção automática da versão do React
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
];
