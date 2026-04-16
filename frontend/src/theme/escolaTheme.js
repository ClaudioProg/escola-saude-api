// ✅ src/theme/escolaTheme.js — PREMIUM++
// - Tailwind darkMode: "class" (fonte única: <html class="dark">)
// - Broadcast na mesma aba via CustomEvent
// - Sincroniza entre abas via localStorage + helper oficial
// - Migração real da chave legada "theme"
// - Idempotente e SSR-safe
// - Boot helper oficial para main.jsx

export const ESCOLA_THEME_KEY = "escola_theme"; // "light" | "dark" | "system"
export const ESCOLA_THEME_EVENT = "escola-theme-change";

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
    const raw = localStorage.getItem(ESCOLA_THEME_KEY);
    return raw ? normalizeTheme(raw) : null;
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

export function removeStoredTheme() {
  try {
    localStorage.removeItem(ESCOLA_THEME_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Lê tema com migração da chave legada.
 * Use isso no boot do main.jsx.
 */
export function readStoredThemeWithMigration({
  legacyKey = "theme",
  removeLegacy = false,
} = {}) {
  const currentRaw = (() => {
    try {
      return localStorage.getItem(ESCOLA_THEME_KEY);
    } catch {
      return null;
    }
  })();

  if (currentRaw && VALID.has(String(currentRaw).toLowerCase())) {
    return normalizeTheme(currentRaw);
  }

  try {
    const legacy = localStorage.getItem(legacyKey);

    if (legacy && VALID.has(String(legacy).toLowerCase())) {
      const normalized = normalizeTheme(legacy);
      localStorage.setItem(ESCOLA_THEME_KEY, normalized);
      if (removeLegacy) localStorage.removeItem(legacyKey);
      return normalized;
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
  const data = root.getAttribute("data-theme");

  if (data === "dark" || data === "light") return data;
  if (root.classList.contains("dark")) return "dark";
  if (root.classList.contains("light")) return "light";

  return null;
}

function setBodyBgFallback(effective) {
  const doc = safeDocument();
  if (!doc?.body) return;

  doc.body.style.backgroundColor = effective === "dark" ? "#0b1220" : "#ffffff";
}

export function applyThemeToHtml(theme) {
  const doc = safeDocument();
  if (!doc) return;

  const effective = getEffectiveTheme(theme);
  const already = getDomAppliedTheme();
  const root = doc.documentElement;

  // Sempre garantir color-scheme
  root.style.colorScheme = effective;

  // Idempotência real
  if (already === effective) {
    setBodyBgFallback(effective);
    return effective;
  }

  root.classList.toggle("dark", effective === "dark");
  root.classList.toggle("light", effective === "light");
  root.setAttribute("data-theme", effective);

  setBodyBgFallback(effective);
  return effective;
}

/* ──────────────────────────────────────────────
   Broadcast (mesma aba)
────────────────────────────────────────────── */
export function emitThemeChange({ theme, effective, source = "engine" } = {}) {
  const win = safeWindow();
  if (!win) return;

  const normalizedTheme = normalizeTheme(theme);
  const normalizedEffective =
    effective === "dark" || effective === "light"
      ? effective
      : getEffectiveTheme(normalizedTheme);

  try {
    win.dispatchEvent(
      new CustomEvent(ESCOLA_THEME_EVENT, {
        detail: {
          theme: normalizedTheme,
          effective: normalizedEffective,
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
 * - emite evento para mesma aba
 */
export function setThemeAndBroadcast(nextTheme, { source = "engine" } = {}) {
  const theme = normalizeTheme(nextTheme);
  setStoredTheme(theme);
  const effective = applyThemeToHtml(theme);
  emitThemeChange({ theme, effective, source });
  return theme;
}

/* ──────────────────────────────────────────────
   Watcher do sistema
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
 * Instala watcher do SO somente se o tema salvo for "system".
 * - Atualiza DOM
 * - Emite evento
 */
export function installSystemWatcherIfNeeded({ source = "system" } = {}) {
  const saved = normalizeTheme(getStoredTheme() || "system");
  if (saved !== "system") return () => {};

  return watchSystemTheme(() => {
    const effective = applyThemeToHtml("system");
    emitThemeChange({
      theme: "system",
      effective,
      source,
    });
  });
}

/* ──────────────────────────────────────────────
   Sync entre abas
────────────────────────────────────────────── */
export function listenThemeStorageSync(onThemeChange) {
  const win = safeWindow();
  if (!win) return () => {};

  const handler = (e) => {
    if (e.key !== ESCOLA_THEME_KEY) return;

    const theme = normalizeTheme(e.newValue || "system");
    const effective = applyThemeToHtml(theme);

    try {
      onThemeChange?.(theme, effective, "storage");
    } catch {
      /* noop */
    }

    emitThemeChange({
      theme,
      effective,
      source: "storage",
    });
  };

  win.addEventListener("storage", handler);
  return () => win.removeEventListener("storage", handler);
}

/* ──────────────────────────────────────────────
   Boot helper oficial
────────────────────────────────────────────── */
/**
 * Uso sugerido no main.jsx:
 *
 * const theme = bootEscolaTheme();
 * const stopSystem = installSystemWatcherIfNeeded();
 * const stopStorage = listenThemeStorageSync();
 */
export function bootEscolaTheme(options = {}) {
  const theme = readStoredThemeWithMigration(options);
  applyThemeToHtml(theme);
  return theme;
}