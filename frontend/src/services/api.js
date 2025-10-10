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
  if (raw) return raw; // sempre prioriza variável explícita

  // 👉 Em DEV SEMPRE usa same-origin + proxy do Vite: /api
  if (IS_DEV) return "";

  // Em produção: se o front estiver no mesmo domínio da API, use same-origin (/api)
  if (typeof window !== "undefined" && !isLocalHost(window.location.host)) {
    return ""; // deixa o reverse proxy/ingress cuidar
  }

  // Fallback (ex.: build estático rodando fora do domínio da API)
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
const getTokenRaw = () => {
  try {
    return localStorage.getItem("token");
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

function buildHeaders(auth = true, extra = {}) {
  const jwt = getToken();
  return {
    "Content-Type": "application/json",
    ...(auth && jwt ? { Authorization: `Bearer ${jwt}` } : {}),
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
      headers: authNeeded && jwt ? { Authorization: `Bearer ${jwt}` } : {},
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
async function handle(res, { on401 = "silent", on403 = "silent" } = {}) {
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
    if (on401 === "redirect") {
      try {
        // limpa apenas chaves de auth
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        localStorage.removeItem("perfil");
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

// Fetch centralizado (com timeout + retry com warm-up)
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

  const init = {
    ...initBase,
    headers: buildHeaders(auth, headers),
  };

  if (body instanceof FormData) {
    // Não setar Content-Type manualmente em FormData
    init.headers = {
      ...(auth && jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      ...headers,
    };
    init.body = body;
  } else if (body !== undefined) {
    init.body = body ? JSON.stringify(body) : undefined;
  }

  const hadAuthHeader = !!init.headers?.Authorization;
  const headersPreview = { ...init.headers };
  if (headersPreview.Authorization) headersPreview.Authorization = "Bearer ***";
  console.log(`🛫 [req ${method}] ${url}`, {
    auth: auth ? "on" : "off",
    hasAuthHeader: hadAuthHeader,
    headers: headersPreview,
    body: body instanceof FormData ? "[FormData]" : body,
  });

  // ⏱️ timeout com AbortController
  async function runOnce() {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(new Error("timeout")),
      DEFAULT_TIMEOUT_MS
    );
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  let res;
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();

  // 1ª tentativa
  try {
    res = await runOnce();
  } catch (e1) {
    // Erro de rede/timeout → warm-up e retry 1x
    const reason = e1?.message || e1?.name || String(e1);
    console.error(`🌩️ [neterr ${method}] ${url}:`, reason);

    await warmup(auth && hadAuthHeader);
    try {
      res = await runOnce();
    } catch (e2) {
      throw new ApiError(
        reason?.toLowerCase?.().includes("timeout") || e2?.name === "AbortError"
          ? "Tempo de resposta excedido."
          : "Falha de rede ou CORS",
        { status: 0, url, data: e2 }
      );
    }
  }

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  console.log(`⏱️ [time ${method}] ${url} → ${Math.round(t1 - t0)}ms`);

  // Passa o contexto (on401/on403) para o handler
  return handle(res, { on401, on403 });
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

// Upload multipart (aceita FormData OU File/Blob)
export async function apiUpload(path, formDataOrFile, opts = {}) {
  let fd;
  if (formDataOrFile instanceof FormData) {
    fd = formDataOrFile;
  } else if (formDataOrFile instanceof Blob) {
    const fieldName = opts.fieldName || "file"; // troque por "banner"/"poster" conforme rota
    fd = new FormData();
    fd.append(fieldName, formDataOrFile);
  } else {
    throw new Error("apiUpload: passe um FormData ou File/Blob.");
  }
  // usa doFetch com FormData (sem Content-Type)
  return doFetch(path, { method: "POST", body: fd, ...opts });
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
      "Content-Type": "application/json",
      Accept: "*/*",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined, // 🔧 agora envia o body
    credentials: "include",
    mode: "cors",
    cache: "no-store",
    redirect: "follow",
    referrerPolicy: "strict-origin-when-cross-origin",
  });

  syncPerfilHeader(res);

  if (res.status === 401) {
    if (on401 === "redirect") {
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        localStorage.removeItem("perfil");
        setPerfilIncompletoFlag(null);
      } catch {}
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
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        localStorage.removeItem("perfil");
        setPerfilIncompletoFlag(null);
      } catch {}
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
// 🆕 Pequenos utilitários
// ───────────────────────────────────────────────────────────────────
export const onlyDigits = (s) => String(s ?? "").replace(/\D/g, ""); // 🆕 útil p/ CPF

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
export async function apiPerfilOpcoes(opts = {}) {
  // sensível → 401 silencioso para não perder a sessão
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
// Compat: facade estilo axios + default export
// ───────────────────────────────────────────────────────────────────
export { API_BASE_URL };

export const api = {
  get: (path, opts) => apiGet(path, opts),
  post: (path, body, opts) => apiPost(path, body, opts),
  put: (path, body, opts) => apiPut(path, body, opts),
  patch: (path, body, opts) => apiPatch(path, body, opts),
  delete: (path, opts) => apiDelete(path, opts),
  upload: (path, formDataOrFile, opts) => apiUpload(path, formDataOrFile, opts),
  request: ({ url, method = "GET", data, ...opts } = {}) =>
    doFetch(url, { method, body: data, ...opts }),
};

export default api;
