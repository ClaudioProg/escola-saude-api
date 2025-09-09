//frontend/src/services/api.js
/* eslint-disable no-console */

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
function computeBase() {
  const raw = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
  if (raw) return raw;

  if (typeof window !== "undefined" && isLocalHost(window.location.host)) {
    if (import.meta.env.VITE_USE_VITE_PROXY === "1") return "/api";
    return "http://localhost:3000/api";
  }
  return "https://escola-saude-api.onrender.com/api";
}

let API_BASE_URL = computeBase();

// 🔒 NÃO force https para localhost (apenas domínios externos)
if (isHttpUrl(API_BASE_URL) && !(typeof window !== "undefined" && isLocalHost(new URL(API_BASE_URL).host))) {
  API_BASE_URL = API_BASE_URL.replace(/^http:\/\//i, "https://");
}

// Logs de init
(() => {
  const proto = typeof window !== "undefined" ? window.location.protocol : "n/a";
  const host = typeof window !== "undefined" ? window.location.host : "n/a";

  console.info("[API:init] base:", API_BASE_URL || "(vazia)", {
    protocol: proto,
    host,
    env: IS_DEV ? "dev" : "prod",
  });

  if (!API_BASE_URL) {
    const msg = "[API:init] Base vazia.";
    if (!IS_DEV) throw new Error("VITE_API_BASE_URL ausente em produção.");
    console.warn(`${msg} Em dev use proxy do Vite ou .env.local.`);
  }
})();

// ───────────────────────────────────────────────────────────────────
// Token & headers
// ───────────────────────────────────────────────────────────────────
const getToken = () => {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
};

function buildHeaders(auth = true, extra = {}) {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

// ───────────────────────────────────────────────────────────────────
// Querystring
// ───────────────────────────────────────────────────────────────────
export function qs(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.append(k, v);
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

export function setPerfilIncompletoFlag(val) {
  try {
    if (val === null || typeof val === "undefined") {
      sessionStorage.removeItem(PERFIL_FLAG_KEY);
    } else {
      sessionStorage.setItem(PERFIL_FLAG_KEY, val ? "1" : "0");
    }
  } catch {}
}

export function getPerfilIncompletoFlag() {
  try {
    const v = sessionStorage.getItem(PERFIL_FLAG_KEY);
    return v === null ? null : v === "1";
  } catch {
    return null;
  }
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

// Handler centralizado — recebe contexto da requisição
async function handle(res, { on401 = "silent", on403 = "silent", hadAuth = false } = {}) {
  const url = res?.url || "";
  const status = res?.status;

  // 🧭 sincroniza flag de perfil (se o backend enviar)
  syncPerfilHeader(res);

  let text = "";
  let data = null;

  try { text = await res.text(); } catch {}
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  if (IS_DEV) {
    const preview = data ?? text ?? "";
    console[res.ok ? "log" : "warn"](
      `🛬 [resp ${status}] ${url}`,
      typeof preview === "string" ? preview.slice(0, 500) : preview
    );
  } else if (!res.ok) {
    console.warn(`🛬 [resp ${status}] ${url}`);
  }

  if (status === 401) {
    // 🔐 Só efetua logout/redirecionamento quando explicitamente solicitado
    if (on401 === "redirect") {
      try {
        localStorage.clear();
        setPerfilIncompletoFlag(null);
      } catch {}
      if (typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
        const next = encodeURIComponent(currentPathWithQuery());
        window.location.assign(`/login?next=${next}`);
      }
    }
    throw new ApiError(data?.erro || data?.message || "Não autorizado (401)", {
      status, url, data: data ?? text,
    });
  }

  if (status === 403) {
    if (on403 === "redirect" && typeof window !== "undefined" && location.pathname !== "/dashboard") {
      window.location.assign("/dashboard");
    }
    throw new ApiError(data?.erro || data?.message || "Sem permissão (403)", {
      status, url, data: data ?? text,
    });
  }

  if (!res.ok) {
    const msg = data?.erro || data?.message || text || `HTTP ${status}`;
    throw new ApiError(msg, { status, url, data: data ?? text });
  }

  return data;
}

// ───────────────────────────────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);

// Fetch centralizado (com timeout)
async function doFetch(
  path,
  { method = "GET", auth = true, headers, query, body, on401, on403 } = {}
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

  const init = {
    method,
    headers: buildHeaders(auth, headers),
    credentials: "include",
  };

  if (body instanceof FormData) {
    const token = getToken();
    init.headers = {
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    };
    init.body = body;
  } else if (body !== undefined) {
    init.body = body ? JSON.stringify(body) : undefined;
  }

  const hadAuth = !!init.headers?.Authorization;
  const headersPreview = { ...init.headers };
  if (headersPreview.Authorization) headersPreview.Authorization = "Bearer ***";
  console.log(`🛫 [req ${method}] ${url}`, {
    auth: auth ? "on" : "off",
    hasAuthHeader: hadAuth,
    headers: headersPreview,
    body: body instanceof FormData ? "[FormData]" : body,
  });

  let res;
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();

  // ⏱️ timeout com AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error("timeout")),
    DEFAULT_TIMEOUT_MS
  );

  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch (networkErr) {
    const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const reason = networkErr?.message || networkErr?.name || String(networkErr);
    console.error(
      `🌩️ [neterr ${method}] ${url} (${Math.round(t1 - t0)}ms):`,
      reason
    );
    const isTimeout =
      reason?.toLowerCase?.().includes("timeout") ||
      networkErr?.name === "AbortError";
    throw new ApiError(isTimeout ? "Tempo de resposta excedido." : "Falha de rede ou CORS", {
      status: 0,
      url: url,
      data: networkErr,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  console.log(`⏱️ [time ${method}] ${url} → ${Math.round(t1 - t0)}ms`);

  // Passa o contexto (hadAuth) para o handler
  return handle(res, { on401, on403, hadAuth });
}

// ───────────────────────────────────────────────────────────────────
// Métodos HTTP
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

// Upload multipart
export async function apiUpload(path, formData, opts = {}) {
  return doFetch(path, { method: "POST", body: formData, ...opts });
}

// POST que retorna arquivo (Blob)
export async function apiPostFile(path, body, opts = {}) {
  const {
    auth = true,
    headers,
    query,
    on401 = "silent",
    on403 = "silent",
  } = opts;

  const token = getToken();

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
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      Accept: "*/*",
      ...headers,
    },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  syncPerfilHeader(res);

  if (res.status === 401) {
    if (on401 === "redirect") {
      try { localStorage.clear(); setPerfilIncompletoFlag(null); } catch {}
      if (typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
        const next = encodeURIComponent(currentPathWithQuery());
        window.location.assign(`/login?next=${next}`);
      }
    }
    throw new Error("Não autorizado (401)");
  }
  if (res.status === 403) {
    if (on403 === "redirect" && typeof window !== "undefined") {
      window.location.assign("/dashboard");
    }
    throw new Error("Sem permissão (403)");
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
  const m = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
  const filename = m ? decodeURIComponent(m[1]) : undefined;

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

  const token = getToken();

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
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: "*/*",
      ...headers,
    },
    credentials: "include",
  });

  syncPerfilHeader(res);

  if (res.status === 401) {
    if (on401 === "redirect") {
      try { localStorage.clear(); setPerfilIncompletoFlag(null); } catch {}
      if (typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
        const next = encodeURIComponent(currentPathWithQuery());
        window.location.assign(`/login?next=${next}`);
      }
    }
    throw new Error("Não autorizado (401)");
  }
  if (res.status === 403) {
    if (on403 === "redirect" && typeof window !== "undefined") {
      window.location.assign("/dashboard");
    }
    throw new Error("Sem permissão (403)");
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
  const m = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
  const filename = m ? decodeURIComponent(m[1]) : undefined;

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
// 🆕 APIs de Perfil (cadastro obrigatório) — ÚNICAS
// ───────────────────────────────────────────────────────────────────
export async function apiPerfilOpcoes(opts = {}) {
  // sensível → mas mantemos 401 silencioso para não perder a sessão
  return apiGet("/perfil/opcoes", { auth: true, on401: "silent", on403: "silent", ...opts });
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

// ───────────────────────────────────────────────────────────────────
export { API_BASE_URL };
