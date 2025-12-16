// ✅ src/theme/escolaTheme.js
export const ESCOLA_THEME_KEY = "escola_theme"; // "light" | "dark" | "system"

export function getSystemTheme() {
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function getEffectiveTheme(theme) {
  return theme === "system" ? getSystemTheme() : theme;
}

export function applyThemeToHtml(theme) {
  const root = document.documentElement;
  const effective = getEffectiveTheme(theme);

  root.classList.toggle("dark", effective === "dark");
  root.style.colorScheme = effective;
}

export function watchSystemTheme(onChange) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener?.("change", onChange);
  return () => mq.removeEventListener?.("change", onChange);
}
