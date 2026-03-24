// ───────────────────────────────────────────────────────────────────
// Helpers de ambiente
// ───────────────────────────────────────────────────────────────────
const IS_DEV = !!import.meta.env.DEV;

function isLocalHost(h) {
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(h || "");
}
function isHttpUrl(u) {
  return /^http:\/\//i.test(u || "");
}

// Decide a base automaticamente
function isVercelHost(host = "") {
  const h = String(host || "").toLowerCase();
  return h.endsWith(".vercel.app") || h.includes("vercel.app");
}

function computeBase() {
  const raw = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
  if (raw) return raw; // sempre prioriza variável explícita

  // 👉 Em DEV SEMPRE usa same-origin + proxy do Vite: /api
  if (IS_DEV) return "";

  const host = typeof window !== "undefined" ? window.location.host : "";

  // ✅ Front em Vercel NÃO tem /api -> backend (a menos que você configure rewrite).
  // Então aponta direto pro backend.
  if (isVercelHost(host)) return "https://escola-saude-api.onrender.com";

  // ✅ Se você estiver em um domínio que realmente faz reverse proxy de /api -> backend, mantenha same-origin.
  if (host && !isLocalHost(host)) return "";

  // Fallback final
  return "https://escola-saude-api.onrender.com";
}


let API_BASE_URL = computeBase();

// 🔒 NÃO force https para localhost (apenas domínios externos)
if (isHttpUrl(API_BASE_URL) && !(typeof window !== "undefined" && isLocalHost(new URL(API_BASE_URL).host))) {
  API_BASE_URL = API_BASE_URL.replace(/^http:\/\//i, "https://");
}

// Validação de base (sem log)
(() => {
  if (!API_BASE_URL && !IS_DEV) {
    throw new Error("VITE_API_BASE_URL ausente em produção.");
  }
})();

export async function apiAuthMe(opts = {}) {
  const me = await apiGet("/auth/me", {
    auth: true,
    on401: "silent",
    on403: "silent",
    suppressGlobalError: true,
    ...opts,
  });

  if (me?.usuario) {
    persistAuthSession(getToken(), me.usuario);
  }

  return me;
}

// ───────────────────────────────────────────────────────────────────
// Token & headers
// ───────────────────────────────────────────────────────────────────
const AUTH_STORAGE_KEYS = ["token", "authToken", "access_token"];
const USER_STORAGE_KEYS = ["usuario", "perfil"];

const getTokenRaw = () => {
  try {
    for (const key of AUTH_STORAGE_KEYS) {
      const value = localStorage.getItem(key);
      if (value) return value;
    }
    return null;
  } catch {
    return null;
  }
};

// Normaliza para sempre retornar APENAS o JWT (sem "Bearer ")
const getToken = () => {
  try {
    const raw = getTokenRaw();
    if (!raw) return null;
    return raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw.trim();
  } catch {
    return null;
  }
};

export function clearAuthSession() {
  try {
    AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    USER_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    setPerfilIncompletoFlag(null);
    window.dispatchEvent(new CustomEvent("auth:changed", { detail: { authenticated: false } }));
  } catch {}
}

export function persistAuthSession(token, usuario = null) {
  try {
    if (token) {
      localStorage.setItem("token", String(token).replace(/^Bearer\s+/i, "").trim());
    }
    if (usuario) {
      localStorage.setItem("usuario", JSON.stringify(usuario));
      if (usuario?.perfil) {
        const perfis = Array.isArray(usuario.perfil)
          ? usuario.perfil
          : String(usuario.perfil).split(",").map((p) => p.trim()).filter(Boolean);
        localStorage.setItem("perfil", perfis.join(","));
      }
    }
    window.dispatchEvent(new CustomEvent("auth:changed", { detail: { authenticated: true, usuario } }));
  } catch {}
}

function isPublicAppPath(pathname = "") {
  const path = String(pathname || "");
  return (
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/cadastro") ||
    path.startsWith("/recuperar-senha") ||
    path.startsWith("/redefinir-senha") ||
    path.startsWith("/validar") ||
    path.startsWith("/presenca") ||
    path.startsWith("/historico") ||
    path.startsWith("/privacidade")
  );
}

function redirectToLogin(nextPath = null) {
  if (typeof window === "undefined") return;

  const current = nextPath || currentPathWithQuery();

  if (isPublicAppPath(window.location.pathname)) return;

  const next = encodeURIComponent(current || "/");
  window.location.replace(`/login?next=${next}`);
}

// 🆕 id de requisição (útil em logs/monitoramento)
function newRequestId() {
  try {
    const u = crypto.randomUUID?.();
    if (u) return u;
  } catch {}
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// 🆕 ——— Contexto de data/hora do cliente (para o backend interpretar "date-only")
function getClientTZ() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
function getClientOffsetMinutes() {
  try {
    // getTimezoneOffset(): minutos para converter LOCAL → UTC (ex.: São Paulo retorna 180)
    // Retornamos o sinal invertido: offset efetivo do cliente (ex.: UTC-3 => -180).
    return -new Date().getTimezoneOffset();
  } catch {
    return 0;
  }
}
function todayLocalYMD() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function buildClientContextHeaders() {
  // Convenção: o backend pode usar esses headers para resolver "date-only" como YMD local.
  return {
    "X-Client-TZ": getClientTZ(),                      // e.g. America/Sao_Paulo
    "X-Client-Offset-Minutes": String(getClientOffsetMinutes()), // e.g. -180 para UTC-3
    "X-Client-Today": todayLocalYMD(),                 // e.g. 2025-11-03
    "X-Client-Now-UTC": new Date().toISOString(),      // carimbo confiável
    "X-Date-Only-Semantics": "YMD_LOCAL",              // dica semântica p/ o servidor
    "X-Request-Id": newRequestId(),                    // rastreio ponta a ponta
  };
}

// 🆕 Debug de conflitos (liga/desliga por sessão)
const DEBUG_CONF_KEY = "debug_conflitos";
export function setDebugConflitos(on = true) {
  try { sessionStorage.setItem(DEBUG_CONF_KEY, on ? "1" : "0"); } catch {}
}
function getDebugConflitos() {
  try { return sessionStorage.getItem(DEBUG_CONF_KEY) === "1"; } catch { return false; }
}

function buildHeaders(auth = true, extra = {}) {
  const jwt = getToken();
  const base = {
    "Content-Type": "application/json",
    ...buildClientContextHeaders(),                // 🆕 sempre manda contexto do cliente
    ...(getDebugConflitos() ? { "X-Debug-Conflitos": "1" } : {}), // 🆕 opcional
  };
  return {
    ...base,
    ...(auth && jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...extra,
  };
}

// ───────────────────────────────────────────────────────────────────
// Querystring
// ───────────────────────────────────────────────────────────────────
// Valores inválidos para query (ex.: NaN) não devem ir para o backend
function isBadParamValue(v) {
  if (v === null || v === undefined || v === "") return true;
  // número NaN
  if (typeof v === "number" && Number.isNaN(v)) return true;
  // string "NaN" (ou variantes com espaços)
  if (typeof v === "string" && v.trim().toLowerCase() === "nan") return true;
  return false;
}

export function qs(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    // suporta array: ?k=a&k=b
    if (Array.isArray(v)) {
      v.forEach((vi) => { if (!isBadParamValue(vi)) q.append(k, vi); });
    } else {
      if (!isBadParamValue(v)) q.append(k, v);
    }
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ───────────────────────────────────────────────────────────────────
// Erro enriquecido
// ───────────────────────────────────────────────────────────────────
class ApiError extends Error {
  constructor(message, { status, url, data } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
    this.data = data;
  }
}

// ───────────────────────────────────────────────────────────────────
// Path / Base normalizers
// ───────────────────────────────────────────────────────────────────
function normalizePath(path) {
  if (!path) return "/";
  if (/^https?:\/\//i.test(path)) return path; // absoluta
  let p = String(path).trim();
  if (!p.startsWith("/")) p = "/" + p;
  return p;
}

// ✅ Garante exatamente um "/api"
function ensureApi(base, path) {
  const baseNoSlash = String(base || "").replace(/\/+$/, "");
  let p = String(path || "").trim();
  if (!p.startsWith("/")) p = "/" + p;

  const baseHasApi = /\/api$/i.test(baseNoSlash);
  const pathHasApi = /^\/api(\/|$)/i.test(p);

  if (baseHasApi && pathHasApi) {
    p = p.replace(/^\/api(\/|$)/i, "/");
  } else if (!baseHasApi && !pathHasApi) {
    p = "/api" + p;
  }

  return baseNoSlash + p;
}

// 👉 Helper para montar URL pública
export function makeApiUrl(path, query) {
  const safePath = normalizePath(path);
  const url = ensureApi(API_BASE_URL, safePath) + qs(query);
  try {
    if (isHttpUrl(url)) {
      const host = new URL(url).host;
      if (!isLocalHost(host)) return url.replace(/^http:\/\//i, "https://");
    }
  } catch {}
  return url;
}

// ───────────────────────────────────────────────────────────────────
// Perfil incompleto – helpers (ÚNICOS)
// ───────────────────────────────────────────────────────────────────
const PERFIL_HEADER = "X-Perfil-Incompleto";
const PERFIL_FLAG_KEY = "perfil_incompleto";
const PERFIL_EVENT = "perfil:flag";

// Cross-tab (opcional): BroadcastChannel
const PERFIL_BC_NAME = "perfil:bc";
let perfilBC = null;
function getPerfilBC() {
  try {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return null;
    if (!perfilBC) perfilBC = new BroadcastChannel(PERFIL_BC_NAME);
    return perfilBC;
  } catch {
    return null;
  }
}

export function getPerfilIncompletoFlag() {
  try {
    const v = sessionStorage.getItem(PERFIL_FLAG_KEY);
    return v === null ? null : v === "1";
  } catch {
    return null;
  }
}

/** Atualiza a flag no sessionStorage e emite evento (mesma aba + outras abas). */
export function setPerfilIncompletoFlag(val) {
  try {
    const prev = getPerfilIncompletoFlag();
    if (val === null || typeof val === "undefined") {
      sessionStorage.removeItem(PERFIL_FLAG_KEY);
    } else {
      sessionStorage.setItem(PERFIL_FLAG_KEY, val ? "1" : "0");
    }
    // 🔔 notifica apenas se mudou
    const next = val === null ? null : !!val;
    if (prev !== next) {
      // mesma aba
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(PERFIL_EVENT, { detail: next }));
      }
      // outras abas
      const bc = getPerfilBC();
      bc?.postMessage({ type: "perfil_flag", value: next });
    }
  } catch {}
}

/** Assina mudanças da flag de perfil (retorna função para desinscrever). */
export function subscribePerfilFlag(cb) {
  if (typeof cb !== "function") return () => {};
  const handler = (e) => cb(e.detail);
  if (typeof window !== "undefined") {
    window.addEventListener(PERFIL_EVENT, handler);
  }
  // cross-tab
  const bc = getPerfilBC();
  const bcHandler = (ev) => {
    if (ev?.data?.type === "perfil_flag") cb(ev.data.value);
  };
  bc?.addEventListener?.("message", bcHandler);

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener(PERFIL_EVENT, handler);
    }
    bc?.removeEventListener?.("message", bcHandler);
  };
}

function syncPerfilHeader(res) {
  try {
    const val = res?.headers?.get?.(PERFIL_HEADER);
    if (val === "1") setPerfilIncompletoFlag(true);
    else if (val === "0") setPerfilIncompletoFlag(false);
    else setPerfilIncompletoFlag(null);
  } catch {}
}

// ───────────────────────────────────────────────────────────────────
function currentPathWithQuery() {
  if (typeof window === "undefined") return "/";
  const { pathname, search } = window.location;
  return pathname + (search || "");
}

// 🔒 Rota sensível (ex.: perfil) — mantida para futuros usos
function isSensitiveUrl(u = "") {
  try {
    const path = new URL(u, API_BASE_URL).pathname;
    return /^\/?api\/perfil(\/|$)/i.test(path);
  } catch {
    return false;
  }
}

// ───────────────────────────────────────────────────────────────────
// WARM-UP automático para casos pós-upload / preflight frio
// ───────────────────────────────────────────────────────────────────
const WARMUP_PUBLIC = "/health";
const WARMUP_AUTH = "/perfil/me";

async function warmup(authNeeded) {
  const path = authNeeded ? WARMUP_AUTH : WARMUP_PUBLIC;
  const url = ensureApi(API_BASE_URL, path);
  const jwt = getToken();
  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      mode: "cors",
      cache: "no-store",
      headers: authNeeded && jwt ? { Authorization: `Bearer ${jwt}`, ...buildClientContextHeaders() } : buildClientContextHeaders(),
      redirect: "follow",
      referrerPolicy: "strict-origin-when-cross-origin",
      keepalive: true,
    });
    // não importa o status — o objetivo é “acordar” sessão/CORS
    return res.ok;
  } catch {
    return false;
  }
}

// Handler centralizado — recebe contexto da requisição
async function handle(
     res,
     { on401 = "silent", on403 = "silent", on404 = "throw", suppressGlobalError = false } = {}
   ) {
  const url = res?.url || "";
  const status = res?.status;

  // 🧭 sincroniza flag de perfil (se o backend enviar)
  syncPerfilHeader(res);

  let text = "";
  let data = null;

    // 404 silencioso quando solicitado (útil para fallbacks)
  if (status === 404 && on404 === "silent") {
    // retorna null para o caller decidir (ex.: tentar outra rota)
    return null;
    }

  try { text = await res.text(); } catch {}
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  if (status === 401) {
  if (on401 === "redirect") {
    clearAuthSession();
    redirectToLogin();
  }

  const err = new ApiError(data?.erro || data?.message || "Não autorizado (401)", {
    status,
    url,
    data: data ?? text,
  });
  err.code = "AUTH_401";
  err.sessionExpired = data?.sessionExpired === true;
  throw err;
}

if (status === 403) {
  if (on403 === "redirect" && typeof window !== "undefined" && !isPublicAppPath(window.location.pathname)) {
    window.location.replace("/painel");
  }

  const err = new ApiError(data?.erro || data?.message || "Sem permissão (403)", {
    status,
    url,
    data: data ?? text,
  });
  err.code = "AUTH_403";
  throw err;
}

  if (!res.ok) {
    const msg = data?.erro || data?.message || text || `HTTP ${status}`;
    const err = new ApiError(msg, { status, url, data: data ?? text });
    if (suppressGlobalError) {
      // deixa o caller decidir sem “barulho” global
      err.silenced = true;
    }
    throw err;
  }

  return data;
}

// ───────────────────────────────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);

// 🆕 Parser robusto para Content-Disposition
function parseContentDispositionFilename(cd = "") {
  if (!cd) return undefined;

  // 1) filename* (RFC 5987): filename*=UTF-8''nome%20com%20acento.pptx
  const star = cd.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (star) {
    try {
      const val = star[1].trim().replace(/^"(.*)"$/, "$1");
      return decodeURIComponent(val);
    } catch {}
  }

  // 2) filename="..." (padrão)
  const normal = cd.match(/filename=(?:"([^"]+)"|([^;]+))/i);
  if (normal) {
    const raw = (normal[1] || normal[2] || "").trim().replace(/^"(.*)"$/, "$1");
    return raw.replace(/^'(.*)'$/, "$1").trim();
  }

  return undefined;
}

// Fetch centralizado (com timeout + retry com warm-up + backoff p/ 429/503)
async function doFetch(
  path,
  {
    method = "GET",
    auth = true,
    headers,
    query,
    body,
    on401,
    on403,
    on404 = "throw",
    suppressGlobalError = false,
    signal,
  } = {}
) {
  const safePath = normalizePath(path);

  // Monta URL final
  const isAbsolute = /^https?:\/\//i.test(safePath);
  let url = isAbsolute
    ? safePath + qs(query)
    : ensureApi(API_BASE_URL, safePath) + qs(query);
  
  // Upgrade http→https para hosts externos
  try {
    if (isHttpUrl(url)) {
      const host = new URL(url).host;
      if (!isLocalHost(host)) url = url.replace(/^http:\/\//i, "https://");
    }
  } catch {}

  // Cabeçalhos e init
  const initBase = {
    method,
    credentials: "include",
    mode: "cors",
    cache: "no-store",
    redirect: "follow",
    referrerPolicy: "strict-origin-when-cross-origin",
  };

  const jwt = getToken();

  let init = {
    ...initBase,
    headers: buildHeaders(auth, headers),
  };

  if (body instanceof FormData) {
    // Não setar Content-Type manualmente em FormData
    init.headers = {
      ...(auth && jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      ...buildClientContextHeaders(),                         // 🆕 também em multipart
      ...(getDebugConflitos() ? { "X-Debug-Conflitos": "1" } : {}),
      ...headers,
    };
    init.body = body;
  } else if (body !== undefined) {
    init.body = body ? JSON.stringify(body) : undefined;
  }

  const hadAuthHeader = !!init.headers?.Authorization;

  // ⏱️ timeout com AbortController + ✅ merge com signal externo
  async function runOnce() {
    const controller = new AbortController();

    // ✅ se vier signal externo, "encadeia" abort
    const abortFromOuter = () => {
      try { controller.abort(signal?.reason || new Error("aborted")); } catch {}
    };
    if (signal) {
      if (signal.aborted) abortFromOuter();
      else signal.addEventListener("abort", abortFromOuter, { once: true });
    }

    const timeoutId = setTimeout(
      () => controller.abort(new Error("timeout")),
      DEFAULT_TIMEOUT_MS
    );

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
      if (signal) {
        try { signal.removeEventListener("abort", abortFromOuter); } catch {}
      }
    }
  }


  let res;

  // 1ª tentativa
  try {
    res = await runOnce();
  } catch (e1) {
    // ✅ CANCELAMENTO (AbortController) NÃO é erro: apenas propaga
    if (
      e1?.name === "AbortError" ||
      String(e1?.message || "").toLowerCase().includes("aborted") ||
      signal?.aborted
    ) {
      throw e1;
    }

    // Erro de rede/timeout → warm-up e retry 1x
    const reason = e1?.message || e1?.name || String(e1);

    await warmup(auth && hadAuthHeader);

    try {
      res = await runOnce();
    } catch (e2) {
      // ✅ se o retry foi abortado, também propaga como abort
      if (
        e2?.name === "AbortError" ||
        String(e2?.message || "").toLowerCase().includes("aborted") ||
        signal?.aborted
      ) {
        throw e2;
      }

      throw new ApiError(
        String(reason).toLowerCase().includes("timeout")
          ? "Tempo de resposta excedido."
          : "Falha de rede ou CORS",
        { status: 0, url, data: e2 }
      );
    }
  }

  // 🆕 Backoff simples para 429/503, uma única vez
  if (res && (res.status === 429 || res.status === 503)) {
    const retryAfter = Number(res.headers?.get?.("Retry-After")) || 0;
    const waitMs = retryAfter ? retryAfter * 1000 : 500 + Math.floor(Math.random() * 600);
    try { await new Promise((r) => setTimeout(r, waitMs)); } catch {}
    res = await runOnce();
  }

  // Passa o contexto (on401/on403) para o handler
  return handle(res, { on401, on403, on404, suppressGlobalError });
}

// ───────────────────────────────────────────────────────────────────
// Métodos HTTP (exports nomeados)
// ───────────────────────────────────────────────────────────────────
export async function apiGet(path, opts = {}) {
  return doFetch(path, { method: "GET", ...opts });
}
export async function apiPost(path, body, opts = {}) {
  return doFetch(path, { method: "POST", body, ...opts });
}
export async function apiPut(path, body, opts = {}) {
  return doFetch(path, { method: "PUT", body, ...opts });
}
export async function apiPatch(path, body, opts = {}) {
  return doFetch(path, { method: "PATCH", body, ...opts });
}
export async function apiDelete(path, opts = {}) {
  return doFetch(path, { method: "DELETE", ...opts });
}

// ✅ Atalhos “públicos” (sem Authorization + não redirecionar em 401)
export const apiGetPublic = (path, opts = {}) =>
  apiGet(path, { auth: false, on401: "silent", ...opts });

export const apiPostPublic = (path, body, opts = {}) =>
  apiPost(path, body, { auth: false, on401: "silent", ...opts });

// ───────────────────────────────────────────────────────────────────
// HEAD cache/coalescing (evita spam e dupes em paralelo)
// ───────────────────────────────────────────────────────────────────
const HEAD_CACHE_TTL_MS = Number(import.meta.env.VITE_API_HEAD_TTL_MS || 120_000); // 2min
const __headCache = new Map();    // key -> { value: boolean, expires: number }
const __inflightHead = new Map(); // key -> Promise<boolean>

/** Cria a chave canônica do cache de HEAD (por path normalizado) */
function headKeyFromPath(path) {
  return normalizePath(path);
}

/** Lê do cache se ainda válido */
function headCacheGet(key) {
  const ent = __headCache.get(key);
  if (!ent) return undefined;
  if (ent.expires < Date.now()) {
    __headCache.delete(key);
    return undefined;
  }
  return ent.value;
}

/** Grava no cache com TTL */
function headCacheSet(key, value, ttlMs = HEAD_CACHE_TTL_MS) {
  __headCache.set(key, { value: !!value, expires: Date.now() + ttlMs });
}

/** Invalida entradas cujo key comece com um prefix específico */
export function invalidateHeadPrefix(prefixPath) {
  const prefix = headKeyFromPath(prefixPath);
  for (const k of __headCache.keys()) {
    if (k.startsWith(prefix)) __headCache.delete(k);
  }
}

// 🆕 Detecta paths de modelo (banner/oral) — útil p/ suprimir HEAD em DEV
function isModeloFilePath(p = "") {
  const s = String(p || "");
  return /\/chamadas\/\d+\/modelo-(banner|oral)(?:\/download)?$/i.test(s);
}

/**
 * HEAD simples e resiliente — retorna boolean (existe/não).
 * - Silencia 404/0 (considera false).
 * - Coalesce requisições em paralelo para mesma URL.
 * - TTL de cache configurável (VITE_API_HEAD_TTL_MS, default 120s).
 * - 🆕 Em DEV, opcionalmente não faz request para paths de modelo e assume false (config: VITE_API_SUPPRESS_HEAD_404)
 */
export async function apiHead(path, opts = {}) {
  const {
    auth = true,
    headers,
    query,
    on401 = "silent",
    on403 = "silent",
    ttlMs = HEAD_CACHE_TTL_MS,
    quiet = true, // não loga warnings para estados esperados
    devSuppressModelo404 = (import.meta.env.VITE_API_SUPPRESS_HEAD_404 ?? "1") !== "0",
  } = opts;

  // 🆕 Dev-mode: evita flood de 404 no console para assets opcionais de modelo
  if (IS_DEV && devSuppressModelo404 && isModeloFilePath(path)) {
    const key = headKeyFromPath(path);
    const cached = headCacheGet(key);
    if (typeof cached === "boolean") return cached;   // respeita cache
    headCacheSet(key, false, ttlMs);                  // assume "não existe" e cacheia
    return false;                                     // 🔇 nenhum request → nenhum 404 no console
  }

  // chave canônica do cache (por PATH normalizado)
  const key = headKeyFromPath(path);

  // 1) cache quente
  const cached = headCacheGet(key);
  if (typeof cached === "boolean") return cached;

  // 2) coalescing
  if (__inflightHead.has(key)) return __inflightHead.get(key);

  const p = (async () => {
    // Monta URL final (como os demais helpers)
    const safePath = normalizePath(path);
    const isAbsolute = /^https?:\/\//i.test(safePath);
    let url = isAbsolute ? safePath + qs(query) : ensureApi(API_BASE_URL, safePath) + qs(query);
    try {
      if (isHttpUrl(url)) {
        const host = new URL(url).host;
        if (!isLocalHost(host)) url = url.replace(/^http:\/\//i, "https://");
      }
    } catch {}

    // Cabeçalhos
    const jwt = getToken();
    const hdrs =
      auth && jwt
        ? { Authorization: `Bearer ${jwt}`, ...buildClientContextHeaders(), ...(getDebugConflitos() ? { "X-Debug-Conflitos": "1" } : {}), ...(headers || {}) }
        : { ...buildClientContextHeaders(), ...(getDebugConflitos() ? { "X-Debug-Conflitos": "1" } : {}), ...(headers || {}) };

    // Execução com timeout curto (HEAD deve ser rápido)
    const timeoutMs = Number(import.meta.env.VITE_API_HEAD_TIMEOUT_MS || 8000);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);

    let res;
    try {
      res = await fetch(url, {
        method: "HEAD",
        headers: hdrs,
        credentials: "include",
        mode: "cors",
        cache: "no-store",
        redirect: "follow",
        referrerPolicy: "strict-origin-when-cross-origin",
        signal: controller.signal,
      });
    } catch (e) {
      // Falha de rede/abort → trate como "não existe" silenciosamente
      if (!quiet) console.warn("[apiHead] erro de rede/abort:", e?.message || e);
      res = { status: 0, ok: false, headers: new Headers() };
    } finally {
      clearTimeout(t);
    }

    // sincroniza flag de perfil
    try { syncPerfilHeader(res); } catch {}

    const st = res?.status ?? 0;

    // auth/perm: respeita flags, mas por padrão silencioso
    if (st === 401 && on401 !== "silent" && !quiet) console.warn("[apiHead] 401 em", url);
    if (st === 403 && on403 !== "silent" && !quiet) console.warn("[apiHead] 403 em", url);

    // ok → true; 404/410/0 → false; demais → false (sem exceção)
    const exists =
      res?.ok || st === 200 || st === 204 ? true :
      (st === 404 || st === 410 || st === 0) ? false :
      false;

    // grava cache
    headCacheSet(key, exists, ttlMs);

    return exists;
  })();

  __inflightHead.set(key, p);

  // limpa o inflight assim que resolver (não segura promises velhas)
  p.finally(() => {
    setTimeout(() => __inflightHead.delete(key), 0);
  });

  return p;
}

/**
 * 🆕 GET que retorna a Response crua — para ler headers e então chamar .blob()
 * Útil quando você precisa do Content-Disposition (nome do arquivo).
 */
export async function apiGetResponse(path, opts = {}) {
  const { auth = true, headers, query, on401 = "silent", on403 = "silent" } = opts;

  const safePath = normalizePath(path);
  const isAbsolute = /^https?:\/\//i.test(safePath);
  let url = isAbsolute ? safePath + qs(query) : ensureApi(API_BASE_URL, safePath) + qs(query);
  try {
    if (isHttpUrl(url)) {
      const host = new URL(url).host;
      if (!isLocalHost(host)) url = url.replace(/^http:\/\//i, "https://");
    }
  } catch {}

  const jwt = getToken();
  const res = await fetch(url, {
    method: "GET",
    headers: auth && jwt
      ? { Authorization: `Bearer ${jwt}`, ...buildClientContextHeaders(), ...(getDebugConflitos() ? { "X-Debug-Conflitos": "1" } : {}), ...(headers || {}) }
      : { ...buildClientContextHeaders(), ...(getDebugConflitos() ? { "X-Debug-Conflitos": "1" } : {}), ...(headers || {}) },
    credentials: "include",
    mode: "cors",
    cache: "no-store",
    redirect: "follow",
    referrerPolicy: "strict-origin-when-cross-origin",
  });

  syncPerfilHeader(res);

  if (res.status === 401) {
  if (on401 === "redirect") {
    clearAuthSession();
    redirectToLogin();
  }

  const err = new ApiError("Não autorizado (401)", {
    status: 401,
    url,
  });
  err.code = "AUTH_401";
  throw err;
}

if (res.status === 403) {
  if (
    on403 === "redirect" &&
    typeof window !== "undefined" &&
    !isPublicAppPath(window.location.pathname)
  ) {
    window.location.replace("/painel");
  }

  const err = new ApiError("Sem permissão (403)", {
    status: 403,
    url,
  });
  err.code = "AUTH_403";
  throw err;
}
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const txt = await res.text();
      msg = txt || msg;
      const json = JSON.parse(txt);
      msg = json?.erro || json?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  return res; // o chamador decide se usa .blob() / .arrayBuffer() / .text()
}

// Upload multipart (aceita FormData OU File/Blob)
export async function apiUpload(path, formDataOrFile, opts = {}) {
  let fd;
  if (formDataOrFile instanceof FormData) {
    fd = formDataOrFile;
  } else if (formDataOrFile instanceof Blob) {
    // 🔧 nome do campo por padrão é "poster" para casar com upload.single("poster")
    const fieldName = opts.fieldName || "poster";
    fd = new FormData();
    const fallbackName =
      (formDataOrFile && "name" in formDataOrFile && formDataOrFile.name) ||
      `${fieldName}${/presentation/i.test(formDataOrFile.type || "") ? ".pptx" : ""}`;
    fd.append(fieldName, formDataOrFile, fallbackName);
  } else {
    throw new Error("apiUpload: passe um FormData ou File/Blob.");
  }
  // usa doFetch com FormData (sem Content-Type manual)
  return doFetch(path, { method: "POST", body: fd, ...opts });
}

// 🆕 Atalho específico para pôster (.ppt/.pptx)
export const apiUploadPoster = (submissaoId, fileOrFormData, opts = {}) => {
  if (!submissaoId) throw new Error("submissaoId é obrigatório");
  return apiUpload(`/submissao/${submissaoId}/poster`, fileOrFormData, {
    ...opts,
    fieldName: "poster",
  });
};

// POST que retorna arquivo (Blob)
export async function apiPostFile(path, body, opts = {}) {
  const {
    auth = true,
    headers,
    query,
    on401 = "silent",
    on403 = "silent",
  } = opts;

  const jwt = getToken();

  const safePath = normalizePath(path);
  const isAbsolute = /^https?:\/\//i.test(safePath);
  let url = isAbsolute ? safePath + qs(query) : ensureApi(API_BASE_URL, safePath) + qs(query);
  try {
    if (isHttpUrl(url)) {
      const host = new URL(url).host;
      if (!isLocalHost(host)) url = url.replace(/^http:\/\//i, "https://");
    }
  } catch {}

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...(auth && jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      ...buildClientContextHeaders(),                        // 🆕
      ...(getDebugConflitos() ? { "X-Debug-Conflitos": "1" } : {}),
      "Content-Type": "application/json",
      Accept: "*/*",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
    mode: "cors",
    cache: "no-store",
    redirect: "follow",
    referrerPolicy: "strict-origin-when-cross-origin",
  });

  syncPerfilHeader(res);

  if (res.status === 401) {
  if (on401 === "redirect") {
    clearAuthSession();
    redirectToLogin();
  }

  const err = new ApiError("Não autorizado (401)", {
    status: 401,
    url,
  });
  err.code = "AUTH_401";
  throw err;
}

if (res.status === 403) {
  if (
    on403 === "redirect" &&
    typeof window !== "undefined" &&
    !isPublicAppPath(window.location.pathname)
  ) {
    window.location.replace("/painel");
  }

  const err = new ApiError("Sem permissão (403)", {
    status: 403,
    url,
  });
  err.code = "AUTH_403";
  throw err;
}

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const txt = await res.text();
      msg = txt || msg;
      const json = JSON.parse(txt);
      msg = json?.erro || json?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const filename = parseContentDispositionFilename(cd);

  return { blob, filename };
}

// GET que retorna arquivo (Blob)
export async function apiGetFile(path, opts = {}) {
  const {
    auth = true,
    headers,
    query,
    on401 = "silent",
    on403 = "silent",
  } = opts;

  const jwt = getToken();

  const safePath = normalizePath(path);
  const isAbsolute = /^https?:\/\//i.test(safePath);
  let url = isAbsolute ? safePath + qs(query) : ensureApi(API_BASE_URL, safePath) + qs(query);
  try {
    if (isHttpUrl(url)) {
      const host = new URL(url).host;
      if (!isLocalHost(host)) url = url.replace(/^http:\/\//i, "https://");
    }
  } catch {}

  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...(auth && jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      ...buildClientContextHeaders(),                        // 🆕
      ...(getDebugConflitos() ? { "X-Debug-Conflitos": "1" } : {}),
      Accept: "*/*",
      ...headers,
    },
    credentials: "include",
    mode: "cors",
    cache: "no-store",
    redirect: "follow",
    referrerPolicy: "strict-origin-when-cross-origin",
  });

  syncPerfilHeader(res);

  if (res.status === 401) {
  if (on401 === "redirect") {
    clearAuthSession();
    redirectToLogin();
  }

  const err = new ApiError("Não autorizado (401)", {
    status: 401,
    url,
  });
  err.code = "AUTH_401";
  throw err;
}

if (res.status === 403) {
  if (
    on403 === "redirect" &&
    typeof window !== "undefined" &&
    !isPublicAppPath(window.location.pathname)
  ) {
    window.location.replace("/painel");
  }

  const err = new ApiError("Sem permissão (403)", {
    status: 403,
    url,
  });
  err.code = "AUTH_403";
  throw err;
}

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const txt = await res.text();
      msg = txt || msg;
      const json = JSON.parse(txt);
      msg = json?.erro || json?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const filename = parseContentDispositionFilename(cd);

  return { blob, filename };
}

// ───────────────────────────────────────────────────────────────────
// Helpers específicos de turmas (datas reais)
// ───────────────────────────────────────────────────────────────────
export async function apiGetTurmaDatas(turmaId, via = "datas") {
  if (!turmaId) throw new Error("turmaId obrigatório");
  return apiGet(`/turmas/${turmaId}/datas`, { query: { via } });
}

export async function apiGetTurmaDatasAuto(turmaId) {
  let out = await apiGetTurmaDatas(turmaId, "datas");
  if (Array.isArray(out) && out.length) return out;

  out = await apiGetTurmaDatas(turmaId, "presencas");
  if (Array.isArray(out) && out.length) return out;

  return apiGetTurmaDatas(turmaId, "intervalo");
}

// ───────────────────────────────────────────────────────────────────
// 🆕 APIs de Presenças (usuário / público)
// ───────────────────────────────────────────────────────────────────
export async function apiGetMinhasPresencas(opts = {}) {
  return apiGet("/presencas/minhas", opts);
}
export async function apiGetMePresencas(opts = {}) {
  return apiGet("/presencas/me", opts);
}
export async function apiValidarPresencaPublico({ evento, usuario, evento_id, usuario_id } = {}) {
  const query = { evento: evento ?? evento_id, usuario: usuario ?? usuario_id };
  // pública (sem token)
  return apiGet("/presencas/validar", { auth: false, on401: "silent", query });
}
export async function apiPresencasTurmaPDF(turmaId) {
  if (!turmaId) throw new Error("turmaId obrigatório");
  return apiGetFile(`/presencas/turma/${turmaId}/pdf`);
}

// ───────────────────────────────────────────────────────────────────
// 🆕 Pequenos utilitários
// ───────────────────────────────────────────────────────────────────
export const onlyDigits = (s) => String(s ?? "").replace(/\D/g, "");

/** 🆕 Helper para baixar um Blob com nome de arquivo. */
export function downloadBlob(filename = "download", blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ───────────────────────────────────────────────────────────────────
// 🆕 APIs de Assinaturas/Certificados Avulsos
// ───────────────────────────────────────────────────────────────────
export async function apiGetAssinaturas(opts = {}) {         // 🆕 lista nomes com assinatura
  return apiGet("/assinaturas", { on401: "silent", on403: "silent", ...opts });
}

/**
 * 🆕 Gera/baixa PDF de certificado avulso com flags:
 * - palestrante: boolean → rota de palestrante
 * - assinatura2_id: id da assinatura extra (se houver)
 */
export async function apiCertAvulsoPDF(id, { palestrante = false, assinatura2_id } = {}) {
  if (!id) throw new Error("id do certificado obrigatório");
  const query = {
    ...(palestrante ? { palestrante: "1" } : {}),
    ...(assinatura2_id ? { assinatura2_id } : {}),
  };
  return apiGetFile(`/certificados-avulsos/${id}/pdf`, { query });
}

// ───────────────────────────────────────────────────────────────────
// 🆕 APIs de Perfil (cadastro obrigatório) — ÚNICAS
// ───────────────────────────────────────────────────────────────────
export async function apiPerfilOpcao(opts = {}) {
  // sensível → 401 silencioso para não perder a sessão
  return apiGet("/perfil/opcao", { auth: true, on401: "silent", on403: "silent", ...opts });
}

function inferPerfilIncompleto(me) {
  const required = [
    "cargo_id",
    "unidade_id",
    "genero_id",
    "orientacao_sexual_id",
    "cor_raca_id",
    "escolaridade_id",
    "deficiencia_id",
    "data_nascimento",
  ];
  return required.some((k) => me?.[k] === null || me?.[k] === undefined || me?.[k] === "");
}

export async function apiPerfilMe(opts = {}) {
  const me = await apiGet("/perfil/me", {
    auth: true,
    on401: "silent",
    on403: "silent",
    ...opts,
  });
  try {
    const incompleto = typeof me?.perfil_incompleto === "boolean"
      ? me.perfil_incompleto
      : inferPerfilIncompleto(me);
    setPerfilIncompletoFlag(!!incompleto);
  } catch {}
  return me;
}

export async function apiPerfilUpdate(payload, opts = {}) {
  return apiPut("/perfil/me", payload, {
    auth: true,
    on401: "redirect", // token inválido → volta pro login
    on403: "silent",   // sem permissão → deixa o caller tratar
    ...opts,
  });
}

export function apiResetCertificadosTurma(turmaId, body = {}) {
  if (!turmaId) throw new Error("turmaId é obrigatório");
  return apiPost(`/certificados/admin/turmas/${turmaId}/reset`, body);
}

// ───────────────────────────────────────────────────────────────────
// 🆕 Helpers de Modelo de Banner por Chamada
// ───────────────────────────────────────────────────────────────────

/** HEAD: existe modelo para a chamada? (true/false) */
export async function apiChamadaModeloExists(chamadaId) {
  if (!chamadaId && chamadaId !== 0) throw new Error("chamadaId é obrigatório");
  const idNum = Number(chamadaId);
  if (!Number.isFinite(idNum)) throw new Error("chamadaId inválido");
  return apiHead(`/chamadas/${chamadaId}/modelo-banner`, {
    auth: true,
    on401: "silent",
    on403: "silent",
  });
}

/** GET (Response crua): baixar modelo da chamada (use .blob() e Content-Disposition) */
export async function apiChamadaModeloDownload(chamadaId) {
  if (!chamadaId && chamadaId !== 0) throw new Error("chamadaId é obrigatório");
  const idNum = Number(chamadaId);
  if (!Number.isFinite(idNum)) throw new Error("chamadaId inválido");
  return apiGetResponse(`/chamadas/${chamadaId}/modelo-banner`, {
    auth: true,
    on401: "silent",
    on403: "silent",
  });
}

/** POST (multipart): enviar/atualizar modelo (.ppt/.pptx) – campo `file` */
export async function apiChamadaModeloUpload(chamadaId, fileOrFormData) {
  if (!chamadaId && chamadaId !== 0) throw new Error("chamadaId é obrigatório");
  const idNum = Number(chamadaId);
  if (!Number.isFinite(idNum)) throw new Error("chamadaId inválido");

  const resp = await apiUpload(`/chamadas/${chamadaId}/modelo-banner`, fileOrFormData, {
    fieldName: "file",
  });

  // 🧼 depois do upload, limpe o cache/head dessa chamada
  try {
    invalidateHeadPrefix(`/chamadas/${chamadaId}/modelo-banner`);
  } catch {}

  return resp;
}

/** GET admin (JSON): meta para o painel (exists/filename/size/mtime/mime) */
export async function apiChamadaModeloAdminMeta(chamadaId) {
  if (!chamadaId && chamadaId !== 0) throw new Error("chamadaId é obrigatório");
  const idNum = Number(chamadaId);
  if (!Number.isFinite(idNum)) throw new Error("chamadaId inválido");
  return apiGet(`/admin/chamadas/${chamadaId}/modelo-banner`, {
    auth: true,
    on401: "silent",
    on403: "silent",
  });
}

// ───────────────────────────────────────────────────────────────────
// Compat: facade estilo axios + default export
// ───────────────────────────────────────────────────────────────────
export { API_BASE_URL };
export function isLoggedIn() {
  return !!getToken();
}

export const api = {
  get: (path, opts) => apiGet(path, opts),
  post: (path, body, opts) => apiPost(path, body, opts),
  put: (path, body, opts) => apiPut(path, body, opts),
  patch: (path, body, opts) => apiPatch(path, body, opts),
  delete: (path, opts) => apiDelete(path, opts),
  upload: (path, formDataOrFile, opts) => apiUpload(path, formDataOrFile, opts),
  uploadPoster: (submissaoId, fileOrFormData, opts) => apiUploadPoster(submissaoId, fileOrFormData, opts),
  request: ({ url, method = "GET", data, ...opts } = {}) =>
    doFetch(url, { method, body: data, ...opts }),
  authMe: (opts) => apiAuthMe(opts),
  clearSession: () => clearAuthSession(),
  persistSession: (token, usuario) => persistAuthSession(token, usuario),
  chamadaModelo: {
    exists: (id) => apiChamadaModeloExists(id),
    download: (id) => apiChamadaModeloDownload(id),
    upload: (id, fileOrFD) => apiChamadaModeloUpload(id, fileOrFD),
    adminMeta: (id) => apiChamadaModeloAdminMeta(id),
  },
};

export default api;
