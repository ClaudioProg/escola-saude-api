/* ==========================================================================
 * Assets Utils — PREMIUM+++
 * Resolve URLs de imagens/PDFs de forma segura em DEV e PROD
 * - Evita localhost em produção quando houver backend configurado
 * - Evita mixed-content (http em página https)
 * - Compatível com Vite proxy, Vercel, Render, Railway etc.
 * - Mantém comportamento same-origin quando apropriado
 * ========================================================================== */

const IS_DEV = import.meta.env.DEV;

/* ───────────────────────── Helpers ───────────────────────── */

const isAbsUrl = (u = "") => /^https?:\/\//i.test(String(u || "").trim());
const isProtocolRelative = (u = "") => /^\/\//.test(String(u || "").trim());

const normalize = (u = "") =>
  String(u || "")
    .trim()
    .replace(/\\/g, "/");

const stripApi = (url = "") =>
  normalize(url)
    .replace(/\/api\/?$/i, "")
    .replace(/\/+$/, "");

function safeWindow() {
  return typeof window !== "undefined" ? window : undefined;
}

function getPageOrigin() {
  const win = safeWindow();
  return win?.location?.origin || "";
}

function forceHttpsIfNeeded(url = "") {
  const win = safeWindow();
  if (!win) return url;

  const pageIsHttps = win.location.protocol === "https:";
  if (pageIsHttps && /^http:\/\//i.test(url)) {
    return url.replace(/^http:\/\//i, "https://");
  }

  return url;
}

/* ───────────────────── Backend origin ───────────────────── */

/**
 * Retorna a origem do backend SEM /api
 * Prioridade:
 * 1) VITE_API_BASE_URL
 * 2) VITE_API_URL
 *
 * Ex:
 *  https://api.escoladasaude.sp.gov.br/api
 *  → https://api.escoladasaude.sp.gov.br
 */
export function getBackendOrigin() {
  const base = (
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    ""
  ).trim();

  if (!base) return "";

  return stripApi(base);
}

/* ───────────────────── Resolver de assets ───────────────────── */

/**
 * Resolve asset salvo no banco ou vindo do backend.
 *
 * Regras:
 * - URL absoluta → retorna como está
 * - URL protocol-relative (//...) → respeita protocolo atual
 * - path relativo/absoluto:
 *   - se houver backend configurado, usa backend
 *   - se não houver backend configurado, usa same-origin
 */
export function resolveAssetUrl(raw) {
  const value = normalize(raw);
  if (!value) return "";

  // Já absoluto
  if (isAbsUrl(value)) {
    return forceHttpsIfNeeded(value);
  }

  // Ex.: //cdn.site.com/img.png
  if (isProtocolRelative(value)) {
    const win = safeWindow();
    const protocol = win?.location?.protocol || "https:";
    return `${protocol}${value}`;
  }

  const backendOrigin = getBackendOrigin();
  const baseOrigin = backendOrigin || getPageOrigin();

  // Sem nenhuma origem disponível: devolve relativo seguro
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

/* ───────────────────── Abrir asset (UX premium) ───────────────────── */

/**
 * Abre imagem/PDF em nova aba sem quebrar SPA
 */
export function openAsset(raw) {
  const url = resolveAssetUrl(raw);
  if (!url) return false;

  const win = safeWindow();
  if (!win) return false;

  win.open(url, "_blank", "noopener,noreferrer");
  return true;
}