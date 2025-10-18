/* src/theme/theme.js */
const THEME_KEY = "theme"; // 'light' | 'dark'

export function readSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  // se não há preferência, replica o que já está no DOM (decidido no passado)
  const hasDark = document.documentElement.classList.contains("dark");
  return hasDark ? "dark" : "light";
}

export function applyTheme(theme, { persist = true } = {}) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  if (persist) {
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }
}

export function toggleTheme() {
  const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
  applyTheme(next, { persist: true });
  return next;
}

/* ===== Tripwire de diagnóstico DEV (opcional, só desenvolvimento) ===== */
export function installThemeTripwireDev() {
  if (!import.meta?.env?.DEV) return; // só no dev
  const root = document.documentElement;

  // interceptar classList.add/remove no <html>
  const add = DOMTokenList.prototype.add;
  const remove = DOMTokenList.prototype.remove;

  DOMTokenList.prototype.add = function (...tokens) {
    if (this === root.classList && tokens.includes("dark")) {
      // denuncia quem está tentando forçar dark
      console.groupCollapsed("%c[TEMA] alguém chamou classList.add('dark')", "color:#b91c1c");
      console.trace();
      console.groupEnd();
    }
    return add.apply(this, tokens);
  };

  DOMTokenList.prototype.remove = function (...tokens) {
    return remove.apply(this, tokens);
  };

  // avisa quando a classe mudar por qualquer motivo
  const mo = new MutationObserver(() => {
    const isDark = root.classList.contains("dark");
    console.log("[TEMA] classe no <html> agora é:", isDark ? "dark" : "light");
  });
  mo.observe(root, { attributes: true, attributeFilter: ["class"] });

  console.log("[TEMA] Tripwire DEV instalado (interceptando .classList.add/remove no <html>).");
}
