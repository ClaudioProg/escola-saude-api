// 📁 src/theme/escolaTheme.js — v2.0
// Motor oficial de tema da Plataforma Escola da Saúde.
//
// Contrato oficial:
// - localStorage["escola_theme"] = "light" | "dark" | "system"
// - chave legada lida apenas para migração: "theme"
// - Tailwind darkMode: "class"
// - fonte única: <html class="dark"> + data-theme
// - evento oficial: escola-theme-change

export const ESCOLA_THEME_KEY = "escola_theme";
export const ESCOLA_THEME_LEGACY_KEY = "theme";
export const ESCOLA_THEME_EVENT = "escola-theme-change";

const THEME_VALIDO = new Set(["light", "dark", "system"]);

function normalizeTheme(value) {
  const theme = String(value || "").trim().toLowerCase();

  return THEME_VALIDO.has(theme) ? theme : "system";
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

function safeLocalStorage() {
  const win = safeWindow();

  try {
    return win?.localStorage || null;
  } catch {
    return null;
  }
}

/* ──────────────────────────────────────────────
   Sistema
────────────────────────────────────────────── */

export function getSystemTheme() {
  const win = safeWindow();

  if (!win || typeof win.matchMedia !== "function") {
    return "light";
  }

  try {
    return win.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

export function getEffectiveTheme(theme) {
  const normalized = normalizeTheme(theme);

  return normalized === "system" ? getSystemTheme() : normalized;
}

/* ──────────────────────────────────────────────
   Storage
────────────────────────────────────────────── */

export function getStoredTheme() {
  const storage = safeLocalStorage();

  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(ESCOLA_THEME_KEY);

    return raw ? normalizeTheme(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredTheme(value) {
  const storage = safeLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(ESCOLA_THEME_KEY, normalizeTheme(value));
  } catch {
    // noop
  }
}

export function removeStoredTheme() {
  const storage = safeLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(ESCOLA_THEME_KEY);
  } catch {
    // noop
  }
}

/**
 * Lê tema com migração da chave legada.
 *
 * Chave oficial:
 * - escola_theme
 *
 * Chave legada:
 * - theme
 */
export function readStoredThemeWithMigration({
  legacyKey = ESCOLA_THEME_LEGACY_KEY,
  removeLegacy = false,
} = {}) {
  const storage = safeLocalStorage();

  if (!storage) {
    return "system";
  }

  try {
    const currentRaw = storage.getItem(ESCOLA_THEME_KEY);

    if (currentRaw && THEME_VALIDO.has(String(currentRaw).toLowerCase())) {
      return normalizeTheme(currentRaw);
    }

    const legacyRaw = storage.getItem(legacyKey);

    if (legacyRaw && THEME_VALIDO.has(String(legacyRaw).toLowerCase())) {
      const normalized = normalizeTheme(legacyRaw);

      storage.setItem(ESCOLA_THEME_KEY, normalized);

      if (removeLegacy) {
        storage.removeItem(legacyKey);
      }

      return normalized;
    }
  } catch {
    // noop
  }

  return "system";
}

/* ──────────────────────────────────────────────
   DOM apply
────────────────────────────────────────────── */

function getDomAppliedTheme() {
  const doc = safeDocument();

  if (!doc) {
    return null;
  }

  const root = doc.documentElement;
  const dataTheme = root.getAttribute("data-theme");

  if (dataTheme === "dark" || dataTheme === "light") {
    return dataTheme;
  }

  if (root.classList.contains("dark")) {
    return "dark";
  }

  if (root.classList.contains("light")) {
    return "light";
  }

  return null;
}

function setBodyBgFallback(effectiveTheme) {
  const doc = safeDocument();

  if (!doc?.body) {
    return;
  }

  doc.body.style.backgroundColor =
    effectiveTheme === "dark" ? "#0b1220" : "#ffffff";
}

export function applyThemeToHtml(theme) {
  const doc = safeDocument();

  if (!doc) {
    return getEffectiveTheme(theme);
  }

  const effectiveTheme = getEffectiveTheme(theme);
  const alreadyApplied = getDomAppliedTheme();
  const root = doc.documentElement;

  root.style.colorScheme = effectiveTheme;

  if (alreadyApplied === effectiveTheme) {
    setBodyBgFallback(effectiveTheme);
    return effectiveTheme;
  }

  root.classList.toggle("dark", effectiveTheme === "dark");
  root.classList.toggle("light", effectiveTheme === "light");
  root.setAttribute("data-theme", effectiveTheme);

  setBodyBgFallback(effectiveTheme);

  return effectiveTheme;
}

/* ──────────────────────────────────────────────
   Broadcast
────────────────────────────────────────────── */

export function emitThemeChange({ theme, effective, source = "engine" } = {}) {
  const win = safeWindow();

  if (!win) {
    return;
  }

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
    // noop
  }
}

/**
 * Setter oficial do motor.
 */
export function setThemeAndBroadcast(nextTheme, { source = "engine" } = {}) {
  const theme = normalizeTheme(nextTheme);

  setStoredTheme(theme);

  const effective = applyThemeToHtml(theme);

  emitThemeChange({
    theme,
    effective,
    source,
  });

  return theme;
}

/* ──────────────────────────────────────────────
   Watcher do sistema
────────────────────────────────────────────── */

export function watchSystemTheme(onChange) {
  const win = safeWindow();

  if (!win || typeof win.matchMedia !== "function") {
    return () => {};
  }

  const mediaQuery = win.matchMedia("(prefers-color-scheme: dark)");

  const handler = () => {
    onChange?.(mediaQuery.matches ? "dark" : "light");
  };

  try {
    mediaQuery.addEventListener?.("change", handler);
  } catch {
    mediaQuery.addListener?.(handler);
  }

  return () => {
    try {
      mediaQuery.removeEventListener?.("change", handler);
    } catch {
      mediaQuery.removeListener?.(handler);
    }
  };
}

/**
 * Instala watcher do sistema somente se o tema salvo for "system".
 */
export function installSystemWatcherIfNeeded({ source = "system" } = {}) {
  const saved = normalizeTheme(getStoredTheme() || "system");

  if (saved !== "system") {
    return () => {};
  }

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

  if (!win) {
    return () => {};
  }

  const handler = (event) => {
    if (event.key !== ESCOLA_THEME_KEY) {
      return;
    }

    const theme = normalizeTheme(event.newValue || "system");
    const effective = applyThemeToHtml(theme);

    try {
      onThemeChange?.(theme, effective, "storage");
    } catch {
      // noop
    }

    emitThemeChange({
      theme,
      effective,
      source: "storage",
    });
  };

  win.addEventListener("storage", handler);

  return () => {
    win.removeEventListener("storage", handler);
  };
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