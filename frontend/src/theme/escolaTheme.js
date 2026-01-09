// ✅ src/theme/escolaTheme.js
export const ESCOLA_THEME_KEY = "escola_theme"; // "light" | "dark" | "system"

/* ──────────────────────────────────────────────
   Helpers seguros para SSR / ambientes sem DOM
────────────────────────────────────────────── */
function safeWindow() {
  return typeof window !== "undefined" ? window : undefined;
}
function safeDocument() {
  return typeof document !== "undefined" ? document : undefined;
}

/* ──────────────────────────────────────────────
   Tema do sistema
────────────────────────────────────────────── */
export function getSystemTheme() {
  const win = safeWindow();
  if (!win || !win.matchMedia) return "light";
  try {
    return win.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

/* ──────────────────────────────────────────────
   Resolve o tema efetivo ("system" → dark/light real)
────────────────────────────────────────────── */
export function getEffectiveTheme(theme) {
  if (theme === "dark" || theme === "light") return theme;
  return getSystemTheme();
}

/* ──────────────────────────────────────────────
   Aplica tema ao <html> e <body> (compatível com Tailwind)
────────────────────────────────────────────── */
export function applyThemeToHtml(theme) {
  const doc = safeDocument();
  if (!doc) return;

  const effective = getEffectiveTheme(theme);
  const root = doc.documentElement;

  root.classList.toggle("dark", effective === "dark");
  root.setAttribute("data-theme", effective);
  root.style.colorScheme = effective;

  // previne flash branco/preto na hidratação
  if (doc.body) {
    doc.body.style.backgroundColor =
      effective === "dark" ? "#111827" : "#ffffff";
  }
}

/* ──────────────────────────────────────────────
   Observa mudanças no tema do sistema
────────────────────────────────────────────── */
export function watchSystemTheme(onChange) {
  const win = safeWindow();
  if (!win || !win.matchMedia) return () => {};

  const mq = win.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => onChange?.(mq.matches ? "dark" : "light");

  // Compatível com navegadores antigos e Safari
  try {
    mq.addEventListener?.("change", handler);
  } catch {
    mq.addListener?.(handler);
  }

  return () => {
    try {
      mq.removeEventListener?.("change", handler);
    } catch {
      mq.removeListener?.(handler);
    }
  };
}

/* ──────────────────────────────────────────────
   Leitura e gravação seguras no localStorage
────────────────────────────────────────────── */
export function getStoredTheme() {
  try {
    return localStorage.getItem(ESCOLA_THEME_KEY);
  } catch {
    return null;
  }
}

export function setStoredTheme(value) {
  try {
    localStorage.setItem(ESCOLA_THEME_KEY, value);
  } catch {}
}
