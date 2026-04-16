// ✅ src/utils/url.js — PREMIUM++
/**
 * Resolve URLs da API e de arquivos de forma segura e previsível.
 *
 * Regras:
 * - URL absoluta (http/https) → retorna como está
 * - Caminho relativo de API → usa base da API
 * - Caminho relativo de arquivo (/uploads/...) → usa origem do backend
 * - Evita duplicação de /api
 * - Normaliza barras sem quebrar protocolo
 */

function isBrowser() {
  return typeof window !== "undefined";
}

export function isAbsoluteUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url.trim());
}

function stripTrailingSlashes(value = "") {
  return String(value || "").replace(/\/+$/, "");
}

function normalizeRelativePath(value = "") {
  return String(value || "")
    .trim()
    .replace(/^\.?\/*/, "/")
    .replace(/\/{2,}/g, "/");
}

function stripApiSuffix(value = "") {
  return stripTrailingSlashes(value).replace(/\/api$/i, "");
}

function ensureApiPrefix(path = "") {
  const p = normalizeRelativePath(path);
  return /^\/api(\/|$)/i.test(p) ? p : `/api${p}`;
}

/**
 * Origem do backend SEM /api
 * Ex.:
 * - VITE_API_BASE_URL=https://api.site.com/api → https://api.site.com
 * - fallback browser → window.location.origin
 */
export function getBackendOrigin() {
  const envBase = stripTrailingSlashes(import.meta.env?.VITE_API_BASE_URL || "");
  if (envBase) return stripApiSuffix(envBase);

  if (isBrowser()) return stripTrailingSlashes(window.location.origin);

  return "";
}

/**
 * Base da API COM /api
 * Ex.:
 * - https://api.site.com/api
 * - http://localhost:3000/api
 * - /api (SSR fallback simples)
 */
export function getApiBaseUrl() {
  const envBase = stripTrailingSlashes(import.meta.env?.VITE_API_BASE_URL || "");
  if (envBase) {
    return /\/api$/i.test(envBase) ? envBase : `${envBase}/api`;
  }

  if (isBrowser()) {
    return `${stripTrailingSlashes(window.location.origin)}/api`;
  }

  return "/api";
}

/**
 * Resolve um caminho de arquivo/endereço retornado pelo backend.
 *
 * Exemplos:
 * - "/uploads/eventos/a.png" → backend origin + path
 * - "uploads/eventos/a.png"  → backend origin + /uploads...
 * - "/api/certificados/1/pdf" → api base corretamente sem duplicar /api
 */
export function resolveApiFile(url) {
  if (!url || typeof url !== "string") return "";

  const clean = url.trim();
  if (!clean) return "";

  if (isAbsoluteUrl(clean)) return clean;

  const normalized = normalizeRelativePath(clean);

  // Se já vier como rota da API, usa base da API sem duplicar /api
  if (/^\/api(\/|$)/i.test(normalized)) {
    const apiBase = getApiBaseUrl();
    const pathWithoutApiDup = normalized.replace(/^\/api/i, "");
    return `${stripTrailingSlashes(apiBase)}${pathWithoutApiDup}`.replace(/([^:]\/)\/+/g, "$1");
  }

  // Arquivos e caminhos relativos comuns → origem do backend
  const backendOrigin = getBackendOrigin();
  const full = `${stripTrailingSlashes(backendOrigin)}${normalized}`;

  return full.replace(/([^:]\/)\/+/g, "$1");
}

/**
 * Resolve um endpoint REST da API.
 *
 * Exemplos:
 * - "usuarios" -> https://.../api/usuarios
 * - "/usuarios" -> https://.../api/usuarios
 * - "/api/usuarios" -> https://.../api/usuarios
 */
export function resolveApiUrl(url) {
  if (!url || typeof url !== "string") return "";

  const clean = url.trim();
  if (!clean) return "";

  if (isAbsoluteUrl(clean)) return clean;

  const apiBase = getApiBaseUrl();
  const path = ensureApiPrefix(clean);

  const full = `${stripTrailingSlashes(stripApiSuffix(apiBase))}${path}`;
  return full.replace(/([^:]\/)\/+/g, "$1");
}

/**
 * Normaliza somente paths relativos.
 * Não deve ser usada para URL absoluta.
 */
export function normalizeUrlPath(url) {
  if (typeof url !== "string") return "";
  if (isAbsoluteUrl(url)) return url.trim();
  return normalizeRelativePath(url);
}