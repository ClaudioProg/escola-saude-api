// ✅ src/utils/url.js
/**
 * Resolve uma URL de arquivo (ou endpoint) da API de forma segura e previsível.
 * - Se a URL já for absoluta (http/https), retorna como está.
 * - Se for relativa, prefixa com VITE_API_BASE_URL (ou /api como fallback).
 * - Remove barras duplicadas e normaliza "./" e "//".
 *
 * @param {string} url - Caminho ou URL parcial retornada pelo backend
 * @returns {string} URL final absoluta
 */
export function resolveApiFile(url) {
  if (!url || typeof url !== "string") return "";

  const clean = url.trim();
  if (!clean) return "";

  // já é URL absoluta?
  if (/^https?:\/\//i.test(clean)) return clean;

  // remove "./" e normaliza múltiplas barras
  const normalized = clean.replace(/^\.?\/*/, "/").replace(/\/{2,}/g, "/");

  // tenta buscar a base da API do .env, senão cai no mesmo domínio
  const base =
    import.meta.env?.VITE_API_BASE_URL?.replace(/\/+$/, "") ||
    (typeof window !== "undefined" ? window.location.origin + "/api" : "/api");

  // junta com segurança
  const full = `${base}${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
  return full.replace(/([^:]\/)\/+/g, "$1"); // evita "//" fora do protocolo
}

/**
 * Atalho: resolve um caminho genérico da API (não só arquivos).
 * Ideal para endpoints REST, fetch, axios, etc.
 */
export const resolveApiUrl = resolveApiFile;

/**
 * Verifica se uma URL é absoluta (http/https)
 */
export function isAbsoluteUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

/**
 * Remove possíveis duplicações de barras ("//") internas.
 */
export function normalizeUrlPath(url) {
  return typeof url === "string"
    ? url.replace(/([^:]\/)\/+/g, "$1").replace(/^\.?\/*/, "/")
    : "";
}
