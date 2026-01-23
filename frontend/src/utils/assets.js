/* ==========================================================================
 * Assets Utils — PREMIUM++
 * Resolve URLs de imagens/PDFs de forma segura em DEV e PROD
 * - Evita localhost em produção
 * - Evita mixed-content (http em https)
 * - Compatível com Vite proxy, Vercel, Render, Railway etc.
 * ========================================================================== */

const IS_DEV = import.meta.env.DEV;

/* ───────────────────────── Helpers ───────────────────────── */

const isAbsUrl = (u = "") => /^https?:\/\//i.test(String(u || "").trim());

const normalize = (u = "") =>
  String(u || "")
    .trim()
    .replace(/\\/g, "/");

const stripApi = (url = "") =>
  normalize(url)
    .replace(/\/api\/?$/i, "")
    .replace(/\/+$/, "");

/* ───────────────────── Backend origin ───────────────────── */

/**
 * Retorna a origem do backend SEM /api
 * Prioridade:
 * 1) VITE_API_BASE_URL
 * 2) VITE_API_URL
 *
 * Ex:
 *  https://api.escoladasaude.sp.gov.br/api  → https://api.escoladasaude.sp.gov.br
 */
export function getBackendOrigin() {
  const base =
    (import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      "").trim();

  if (!base) return "";

  return stripApi(base);
}

/* ───────────────────── Resolver de assets ───────────────────── */

/**
 * resolveAssetUrl
 *
 * @param {string} raw Caminho salvo no banco (ex: /uploads/eventos/img.png)
 * @returns {string} URL final segura para <img>, <a>, window.open etc.
 */
export function resolveAssetUrl(raw) {
  const value = normalize(raw);
  if (!value) return "";

  // Já absoluto → retorna como está
  if (isAbsUrl(value)) return value;

  const origin = getBackendOrigin();

  // DEV (proxy do Vite ou same-origin)
  if (!origin) {
    return value.startsWith("/") ? value : `/${value}`;
  }

  // PROD → prefixa backend
  const url = `${origin}${value.startsWith("/") ? "" : "/"}${value}`;

  // Segurança extra: evita http em páginas https
  if (typeof window !== "undefined") {
    const pageIsHttps = window.location.protocol === "https:";
    if (pageIsHttps && url.startsWith("http://")) {
      return url.replace(/^http:\/\//i, "https://");
    }
  }

  return url;
}

/* ───────────────────── Abrir asset (UX premium) ───────────────────── */

/**
 * Abre imagem/PDF em nova aba sem quebrar SPA
 */
export function openAsset(raw) {
  const url = resolveAssetUrl(raw);
  if (!url) return;

  window.open(url, "_blank", "noopener,noreferrer");
}
