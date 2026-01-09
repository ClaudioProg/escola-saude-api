/* src/theme/theme.js */
const THEME_KEY = "theme"; // 'light' | 'dark' | 'system'

/* ───────── Helpers SSR-safe ───────── */
const hasWindow = () => typeof window !== "undefined";
const hasDocument = () => typeof document !== "undefined";
const doc = () => (hasDocument() ? document : null);
const win = () => (hasWindow() ? window : null);

function getSystemTheme() {
  const w = win();
  if (!w || !w.matchMedia) return "light";
  try {
    return w.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function readSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {}
  // fallback: reflete o que já está aplicado no DOM
  const d = doc();
  if (!d) return "light";
  const hasDark = d.documentElement.classList.contains("dark");
  return hasDark ? "dark" : "light";
}

export function getEffectiveTheme(theme) {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyToDom(effective) {
  const d = doc();
  if (!d) return;
  const root = d.documentElement;
  root.classList.toggle("dark", effective === "dark");
  root.setAttribute("data-theme", effective);
  root.style.colorScheme = effective;
  if (d.body) {
    // evita flash entre claro/escuro
    d.body.style.backgroundColor = effective === "dark" ? "#111827" : "#ffffff";
  }
}

export function applyTheme(theme, { persist = true } = {}) {
  const eff = getEffectiveTheme(theme);
  applyToDom(eff);
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }
}

/**
 * Observa as mudanças do SO quando o tema salvo for "system".
 * Retorna uma função de cleanup para parar de observar.
 */
export function attachSystemWatcherIfNeeded() {
  const saved = readSavedTheme();
  if (saved !== "system") return () => {};
  const w = win();
  if (!w || !w.matchMedia) return () => {};
  const mql = w.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => applyToDom(mql.matches ? "dark" : "light");
  try {
    mql.addEventListener?.("change", handler);
  } catch {
    mql.addListener?.(handler);
  }
  return () => {
    try {
      mql.removeEventListener?.("change", handler);
    } catch {
      mql.removeListener?.(handler);
    }
  };
}

/**
 * Alterna entre light/dark tomando por base o TEMA EFETIVO atual.
 * Se o salvo for 'system', ao alternar definimos explicitamente o oposto do efetivo.
 */
export function toggleTheme() {
  const saved = readSavedTheme();
  const effective = getEffectiveTheme(saved);
  const next = effective === "dark" ? "light" : "dark";
  applyTheme(next, { persist: true });
  return next;
}

/**
 * Alternância cíclica: light -> dark -> system -> light ...
 */
export function toggleCycle() {
  const saved = readSavedTheme();
  const order = ["light", "dark", "system"];
  const idx = Math.max(0, order.indexOf(saved));
  const next = order[(idx + 1) % order.length];
  applyTheme(next, { persist: true });
  // se passou para system, aplica imediatamente o efetivo do SO
  if (next === "system") applyToDom(getSystemTheme());
  return next;
}

/* ===== Tripwire de diagnóstico DEV (opcional) ===== */
let __tripwire = null;

export function installThemeTripwireDev() {
  if (!hasWindow() || !hasDocument()) return;
  // só no dev
  if (!(typeof import.meta?.env?.DEV !== "undefined" && import.meta.env.DEV)) return;
  if (__tripwire) return __tripwire; // já instalado

  const d = doc();
  const root = d.documentElement;

  // Guarda originais locais (só do root.classList) para reverter
  const originalAdd = root.classList.add.bind(root.classList);
  const originalRemove = root.classList.remove.bind(root.classList);

  root.classList.add = (...tokens) => {
    if (tokens.includes("dark")) {
      console.groupCollapsed("%c[TEMA] classList.add('dark') detectado no <html>", "color:#b91c1c;font-weight:bold");
      console.trace();
      console.groupEnd();
    }
    return originalAdd(...tokens);
  };
  root.classList.remove = (...tokens) => originalRemove(...tokens);

  const mo = new MutationObserver(() => {
    const isDark = root.classList.contains("dark");
    console.log("[TEMA] <html> agora está:", isDark ? "dark" : "light");
  });
  mo.observe(root, { attributes: true, attributeFilter: ["class"] });

  console.log("[TEMA] Tripwire DEV instalado (apenas no <html>, seguro para reverter).");

  __tripwire = () => {
    try {
      mo.disconnect();
      root.classList.add = originalAdd;
      root.classList.remove = originalRemove;
      __tripwire = null;
      console.log("[TEMA] Tripwire DEV removido.");
    } catch {}
  };
  return __tripwire;
}

export function removeThemeTripwireDev() {
  if (typeof __tripwire === "function") {
    __tripwire();
  }
}
