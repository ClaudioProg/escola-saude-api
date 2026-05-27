// 📁 public/boot-theme.js
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Aplica o tema antes do React carregar para evitar flash visual.
//
// Contrato oficial:
// - localStorage["escola_theme"]
// - valores permitidos: "light" | "dark"
//
// Diretrizes v2.0:
// - não usar "theme";
// - não migrar chave antiga;
// - não usar aliases;
// - não bloquear carregamento da aplicação por falha de localStorage;
// - respeitar preferência do sistema apenas quando não houver tema oficial salvo.

(() => {
  try {
    const root = document.documentElement;
    const body = document.body;

    const STORAGE_KEY = "escola_theme";
    const VALORES_PERMITIDOS = new Set(["light", "dark"]);

    let storedTheme = null;

    try {
      storedTheme = localStorage.getItem(STORAGE_KEY);
    } catch {
      storedTheme = null;
    }

    const hasValidStoredTheme = VALORES_PERMITIDOS.has(storedTheme);

    const prefersDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const theme = hasValidStoredTheme ? storedTheme : prefersDark ? "dark" : "light";

    root.classList.toggle("dark", theme === "dark");
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;

    if (body) {
      body.style.backgroundColor = theme === "dark" ? "#111827" : "#ffffff";
    }

    if (!hasValidStoredTheme) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // Sem persistência, mas sem impedir carregamento.
      }
    }
  } catch {
    // Não bloquear carregamento da aplicação por falha de tema.
  }
})();