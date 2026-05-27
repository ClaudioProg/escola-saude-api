// 📁 src/utils/url.js — v2.0

/**
 * Utilitário oficial de URLs da API.
 *
 * Função:
 * - Resolver base da API.
 * - Resolver endpoints REST.
 * - Normalizar paths relativos.
 *
 * Contrato oficial:
 * - VITE_API_BASE_URL
 *
 * Não usar:
 * - VITE_API_URL
 * - aliases de env
 * - fallbacks legados
 * - resolução de arquivos/assets aqui
 *
 * Para arquivos/assets, usar:
 * - src/utils/assetUrl.js
 */

function canUseWindow() {
  return typeof window !== "undefined";
}

function normalizeInput(value = "") {
  return String(value || "").trim().replace(/\\/g, "/");
}

export function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(normalizeInput(value));
}

export function hasDangerousUrlScheme(value = "") {
  return /^(javascript|data|vbscript|file|blob):/i.test(normalizeInput(value));
}

function stripTrailingSlashes(value = "") {
  return normalizeInput(value).replace(/\/+$/, "");
}

function stripApiSuffix(value = "") {
  return stripTrailingSlashes(value).replace(/\/api$/i, "");
}

function normalizeRelativePath(value = "") {
  const clean = normalizeInput(value);

  if (!clean) {
    return "";
  }

  return clean
    .replace(/^\.?\/*/, "/")
    .replace(/\/{2,}/g, "/");
}

function ensureApiPrefix(path = "") {
  const normalized = normalizeRelativePath(path);

  if (!normalized) {
    return "/api";
  }

  return /^\/api(\/|$)/i.test(normalized) ? normalized : `/api${normalized}`;
}

function normalizeAbsoluteUrl(value = "") {
  const clean = normalizeInput(value);

  if (!clean || hasDangerousUrlScheme(clean)) {
    return "";
  }

  if (!isAbsoluteUrl(clean)) {
    return "";
  }

  try {
    const url = new URL(clean);

    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function joinUrl(base, path) {
  const safeBase = stripTrailingSlashes(base);
  const safePath = normalizeRelativePath(path);

  if (!safeBase) {
    return safePath;
  }

  return `${safeBase}${safePath}`.replace(/([^:]\/)\/+/g, "$1");
}

/**
 * Origem do backend sem /api.
 *
 * Exemplo:
 * VITE_API_BASE_URL=https://api.site.com/api
 * retorna:
 * https://api.site.com
 */
export function getBackendOrigin() {
  const envBase = normalizeAbsoluteUrl(import.meta.env?.VITE_API_BASE_URL || "");

  if (envBase) {
    return stripApiSuffix(envBase);
  }

  if (canUseWindow()) {
    return stripTrailingSlashes(window.location.origin);
  }

  return "";
}

/**
 * Base da API com /api.
 *
 * Exemplo:
 * VITE_API_BASE_URL=https://api.site.com
 * retorna:
 * https://api.site.com/api
 */
export function getApiBaseUrl() {
  const envBase = normalizeAbsoluteUrl(import.meta.env?.VITE_API_BASE_URL || "");

  if (envBase) {
    return /\/api$/i.test(envBase) ? envBase : `${envBase}/api`;
  }

  if (canUseWindow()) {
    return `${stripTrailingSlashes(window.location.origin)}/api`;
  }

  return "/api";
}

/**
 * Resolve endpoint REST da API.
 *
 * Exemplos:
 * - "usuario"      -> https://.../api/usuario
 * - "/usuario"     -> https://.../api/usuario
 * - "/api/usuario" -> https://.../api/usuario
 */
export function resolveApiUrl(value) {
  const clean = normalizeInput(value);

  if (!clean || hasDangerousUrlScheme(clean)) {
    return "";
  }

  if (isAbsoluteUrl(clean)) {
    return normalizeAbsoluteUrl(clean);
  }

  const apiBase = getApiBaseUrl();
  const path = ensureApiPrefix(clean);

  return joinUrl(stripApiSuffix(apiBase), path);
}

/**
 * Normaliza path relativo.
 * Não resolve origem.
 */
export function normalizeUrlPath(value) {
  const clean = normalizeInput(value);

  if (!clean || hasDangerousUrlScheme(clean)) {
    return "";
  }

  if (isAbsoluteUrl(clean)) {
    return normalizeAbsoluteUrl(clean);
  }

  return normalizeRelativePath(clean);
}