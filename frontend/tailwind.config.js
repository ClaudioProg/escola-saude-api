// tailwind.config.js

export default {
  // 🧠 Define os arquivos onde o Tailwind deve procurar por classes
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],

  // 🌙 Ativa o modo escuro baseado em classe (usando `class="dark"`)
  darkMode: 'class',

  theme: {
    extend: {
      // 🎨 Cores personalizadas (identidade visual da Escola da Saúde)
      colors: {
        gelo: '#f8f9fa',           // Fundo padrão claro
        lousa: '#2e5e4e',          // Verde-lousa para destaques
        textoLousa: '#ffffff',     // Texto claro sobre o fundo verde
      },

      // 🔤 Fonte padrão
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },

      // 📱 Breakpoints extras (opcional)
      screens: {
        'xs': '475px', // breakpoint adicional útil para responsividade extrema
      },
    },
  },

  // 🔌 Plugins adicionais (nenhum por enquanto, mas pode incluir forms, typography etc.)
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
