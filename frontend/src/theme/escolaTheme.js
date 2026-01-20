// ✅ src/theme/escolaTheme.js — PREMIUM (single source of truth + broadcast)
// - Tailwind darkMode: "class" (fonte única: <html class="dark">)
// - Sem F5: emite evento "escola-theme-change" (mesma aba)
// - Sincroniza entre abas via localStorage (storage event é automático)
// - Migra chave legada "theme" -> "escola_theme" (opcional)
// - Idempotente: evita reaplicar/repintar à toa

export const ESCOLA_THEME_KEY = "escola_theme"; // "light" | "dark" | "system"
export const ESCOLA_THEME_EVENT = "escola-theme-change"; // CustomEvent

const VALID = new Set(["light", "dark", "system"]);
function normalizeTheme(v) {
  const t = String(v || "").toLowerCase();
  return VALID.has(t) ? t : "system";
}

/* ──────────────────────────────────────────────
   Helpers SSR-safe
────────────────────────────────────────────── */
function safeWindow() {
  return typeof window !== "undefined" ? window : undefined;
}
function safeDocument() {
  return typeof document !== "undefined" ? document : undefined;
}

/* ──────────────────────────────────────────────
   Sistema (prefers-color-scheme)
────────────────────────────────────────────── */
export function getSystemTheme() {
  const win = safeWindow();
  if (!win || !win.matchMedia) return "light";
  try {
    return win.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function getEffectiveTheme(theme) {
  const t = normalizeTheme(theme);
  return t === "system" ? getSystemTheme() : t;
}

/* ──────────────────────────────────────────────
   Storage seguro
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
    localStorage.setItem(ESCOLA_THEME_KEY, normalizeTheme(value));
  } catch {
    /* noop */
  }
}

/**
 * Premium: lê tema com MIGRAÇÃO do legado "theme" (se existir).
 * Use isso no boot do main.jsx.
 */
export function readStoredThemeWithMigration({ legacyKey = "theme", removeLegacy = false } = {}) {
  const current = normalizeTheme(getStoredTheme());
  if (current) return current;

  try {
    const legacy = localStorage.getItem(legacyKey);
    if (legacy === "light" || legacy === "dark" || legacy === "system") {
      localStorage.setItem(ESCOLA_THEME_KEY, legacy);
      if (removeLegacy) localStorage.removeItem(legacyKey);
      return legacy;
    }
  } catch {
    /* noop */
  }

  return "system";
}

/* ──────────────────────────────────────────────
   DOM apply (idempotente)
────────────────────────────────────────────── */
function getDomAppliedTheme() {
  const doc = safeDocument();
  if (!doc) return null;
  const root = doc.documentElement;
  const data = root.getAttribute("data-theme"); // "dark"|"light"
  if (data === "dark" || data === "light") return data;
  return root.classList.contains("dark") ? "dark" : "light";
}

function setBodyBgFallback(effective) {
  const doc = safeDocument();
  if (!doc?.body) return;

  // evita "flash" em transições/hidratação
  doc.body.style.backgroundColor = effective === "dark" ? "#0b1220" : "#ffffff";
}

export function applyThemeToHtml(theme) {
  const doc = safeDocument();
  if (!doc) return;

  const effective = getEffectiveTheme(theme);
  const already = getDomAppliedTheme();

  // ✅ idempotente: não reaplica se já estiver igual
  if (already === effective) {
    // ainda assim garante color-scheme consistente (barato)
    doc.documentElement.style.colorScheme = effective;
    return;
  }

  const root = doc.documentElement;
  root.classList.toggle("dark", effective === "dark");
  root.setAttribute("data-theme", effective);
  root.style.colorScheme = effective;

  setBodyBgFallback(effective);
}

/* ──────────────────────────────────────────────
   Broadcast (mesma aba)
────────────────────────────────────────────── */
export function emitThemeChange({ theme, effective, source = "engine" } = {}) {
  const win = safeWindow();
  if (!win) return;

  try {
    win.dispatchEvent(
      new CustomEvent(ESCOLA_THEME_EVENT, {
        detail: {
          theme: normalizeTheme(theme),
          effective: effective === "dark" || effective === "light" ? effective : getEffectiveTheme(theme),
          source,
          ts: Date.now(),
        },
      })
    );
  } catch {
    /* noop */
  }
}

/**
 * Setter oficial do motor:
 * - persiste
 * - aplica no DOM
 * - emite evento p/ UI reagir sem F5
 */
export function setThemeAndBroadcast(nextTheme, { source = "engine" } = {}) {
  const t = normalizeTheme(nextTheme);
  setStoredTheme(t);
  applyThemeToHtml(t);
  emitThemeChange({ theme: t, effective: getEffectiveTheme(t), source });
  return t;
}

/* ──────────────────────────────────────────────
   System watcher (retorna cleanup)
────────────────────────────────────────────── */
export function watchSystemTheme(onChange) {
  const win = safeWindow();
  if (!win || !win.matchMedia) return () => {};

  const mq = win.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => onChange?.(mq.matches ? "dark" : "light");

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

/**
 * Premium: instala watcher do SO somente se o tema salvo for "system".
 * - Atualiza DOM
 * - Emite evento
 */
export function installSystemWatcherIfNeeded({ source = "system" } = {}) {
  const saved = normalizeTheme(getStoredTheme() || "system");
  if (saved !== "system") return () => {};

  return watchSystemTheme(() => {
    // reaplica o efetivo do sistema
    applyThemeToHtml("system");
    emitThemeChange({ theme: "system", effective: getEffectiveTheme("system"), source });
  });
}
