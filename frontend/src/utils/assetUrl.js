/* ==========================================================================
 * src/utils/assetUrl.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Resolver URLs de imagens/PDFs vindos do backend ou salvos no banco.
 * - Evitar mixed-content.
 * - Preservar same-origin quando não houver backend configurado.
 *
 * Contrato oficial:
 * - VITE_API_BASE_URL
 *
 * Não usar:
 * - VITE_API_URL
 * - aliases de env
 * - fallback legado
 * ========================================================================== */

function safeWindow() {
  return typeof window !== "undefined" ? window : undefined;
}

function normalizeUrlInput(value = "") {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/");
}

function isHttpUrl(value = "") {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function isProtocolRelativeUrl(value = "") {
  return /^\/\//.test(String(value || "").trim());
}

function hasDangerousScheme(value = "") {
  return /^(javascript|data|vbscript|file|blob):/i.test(
    String(value || "").trim()
  );
}

function stripTrailingApi(url = "") {
  return normalizeUrlInput(url)
    .replace(/\/api\/?$/i, "")
    .replace(/\/+$/, "");
}

function getPageOrigin() {
  const win = safeWindow();

  return win?.location?.origin || "";
}

function forceHttpsIfNeeded(url = "") {
  const win = safeWindow();

  if (!win) {
    return url;
  }

  if (win.location.protocol === "https:" && /^http:\/\//i.test(url)) {
    return url.replace(/^http:\/\//i, "https://");
  }

  return url;
}

/* ─────────────────────────────────────────
   Backend origin
───────────────────────────────────────── */

/**
 * Retorna a origem do backend sem /api.
 *
 * Exemplo:
 * VITE_API_BASE_URL=https://api.escoladasaude.sp.gov.br/api
 * retorna:
 * https://api.escoladasaude.sp.gov.br
 */
export function getBackendOrigin() {
  const base = String(import.meta.env.VITE_API_BASE_URL || "").trim();

  if (!base) {
    return "";
  }

  return stripTrailingApi(base);
}

/* ─────────────────────────────────────────
   Resolver de assets
───────────────────────────────────────── */

export function resolveAssetUrl(raw) {
  const value = normalizeUrlInput(raw);

  if (!value) {
    return "";
  }

  if (hasDangerousScheme(value)) {
    return "";
  }

  if (isHttpUrl(value)) {
    return forceHttpsIfNeeded(value);
  }

  if (isProtocolRelativeUrl(value)) {
    const win = safeWindow();
    const protocol = win?.location?.protocol || "https:";

    return `${protocol}${value}`;
  }

  const backendOrigin = getBackendOrigin();
  const baseOrigin = backendOrigin || getPageOrigin();

  if (!baseOrigin) {
    return value.startsWith("/") ? value : `/${value}`;
  }

  try {
    const finalUrl = new URL(
      value.startsWith("/") ? value : `/${value}`,
      `${baseOrigin}/`
    ).toString();

    return forceHttpsIfNeeded(finalUrl);
  } catch {
    const fallback = `${baseOrigin}${value.startsWith("/") ? "" : "/"}${value}`;

    return forceHttpsIfNeeded(fallback);
  }
}

/* ─────────────────────────────────────────
   Abrir asset
───────────────────────────────────────── */

export function openAsset(raw) {
  const url = resolveAssetUrl(raw);

  if (!url) {
    return false;
  }

  const win = safeWindow();

  if (!win) {
    return false;
  }

  const opened = win.open(url, "_blank", "noopener,noreferrer");

  if (opened) {
    opened.opener = null;
  }

  return Boolean(opened);
}