// 📁 public/boot-theme.js
// Executa o tema o mais cedo possível (antes do React)
(() => {
  try {
    const root = document.documentElement;
    const stored = localStorage.getItem("theme");

    // Detecta preferência do sistema, caso não haja preferido salvo
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const theme =
      stored === "dark" || stored === "light"
        ? stored
        : prefersDark
        ? "dark"
        : "light";

    // Aplica tema
    root.classList.toggle("dark", theme === "dark");

    // Salva o valor padrão, se ainda não existir
    if (!stored) localStorage.setItem("theme", theme);

    // Ajuste de cor de fundo do body imediato (sem piscar branco/preto)
    document.body.style.backgroundColor =
      theme === "dark" ? "#111827" : "#ffffff";

    // Atributo ARIA para acessibilidade
    root.setAttribute("data-theme", theme);
  } catch (err) {
    console.error("Erro ao aplicar tema inicial:", err);
  }
})();
