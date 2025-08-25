// 📁 src/services/api.js

// ───────────────────────────────────────────────────────────────────
// Helpers de ambiente
// ───────────────────────────────────────────────────────────────────
const IS_DEV = !!import.meta.env.DEV;

function isLocalHost(h) {
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(h || "");
}
function isHttpUrl(u) { return /^http:\/\//i.test(u || ""); }

// Decide a base automaticamente:
//   1) VITE_API_BASE_URL, se preenchida
//   2) Se estiver em localhost e você quer usar proxy do Vite, use "/api"
//   3) Caso contrário, "http://localhost:3000/api"
function computeBase() {
  const raw = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
  if (raw) return raw;

  if (typeof window !== "undefined" && isLocalHost(window.location.host)) {
    // Se tiver proxy no vite.config.js, prefira "/api"
    // server: { proxy: { '/api': { target: 'http://localhost:3000' } } }
    if (import.meta.env.VITE_USE_VITE_PROXY === "1") return "/api";
    return "http://localhost:3000/api";
  }

  // Fallback seguro em prod (ajuste para sua URL pública, se quiser)
  return "https://escola-saude-api.onrender.com/api";
}

let API_BASE_URL = computeBase();

// 🔒 NÃO force https para localhost (apenas para domínios externos)
if (isHttpUrl(API_BASE_URL) && !(typeof window !== "undefined" && isLocalHost(new URL(API_BASE_URL).host))) {
  API_BASE_URL = API_BASE_URL.replace(/^http:\/\//i, "https://");
}

// Logs de init
(() => {
  const proto = typeof window !== "undefined" ? window.location.protocol : "n/a";
  const host  = typeof window !== "undefined" ? window.location.host      : "n/a";

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
const getToken = () => { try { return localStorage.getItem("token"); } catch { return null; } };

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
// Path normalizer
// ───────────────────────────────────────────────────────────────────
function normalizePath(path) {
  if (!path) return "/";
  if (/^https?:\/\//i.test(path)) return path; // absoluta

  let p = String(path).trim();
  if (!p.startsWith("/")) p = "/" + p;
  return p;
}

// ✅ Garante exatamente um "/api" sem quebrar o "http://"
// - Se base termina com /api e path começa com /api -> remove /api do path
// - Se nenhum tem /api -> adiciona ao path
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

  // 👉 não colapsa barras do protocolo; apenas concatena
  return baseNoSlash + p;
}

// ───────────────────────────────────────────────────────────────────
// Handler centralizado
// ───────────────────────────────────────────────────────────────────
async function handle(res, { on401 = "redirect", on403 = "silent" } = {}) {
  const url = res?.url || "";
  const status = res?.status;
  let text = "";
  let data = null;

  try { text = await res.text(); } catch {}
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  if (IS_DEV) {
    const preview = data ?? text ?? "";
    console[(res.ok ? "log" : "warn")](
      `🛬 [resp ${status}] ${url}`,
      typeof preview === "string" ? preview.slice(0, 500) : preview
    );
  } else if (!res.ok) {
    console.warn(`🛬 [resp ${status}] ${url}`);
  }

  if (status === 401) {
    if (IS_DEV) console.error("⚠️ 401 recebido: limpando sessão");
    try { localStorage.clear(); } catch {}
    if (on401 === "redirect" && typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
      window.location.assign("/login");
    }
    throw new ApiError(data?.erro || data?.message || "Não autorizado (401)", { status, url, data: data ?? text });
  }

  if (status === 403) {
    if (IS_DEV) console.warn("🚫 403 recebido: sem permissão");
    if (on403 === "redirect" && typeof window !== "undefined" && location.pathname !== "/dashboard") {
      window.location.assign("/dashboard");
    }
    throw new ApiError(data?.erro || data?.message || "Sem permissão (403)", { status, url, data: data ?? text });
  }

  if (!res.ok) {
    const msg = data?.erro || data?.message || text || `HTTP ${status}`;
    throw new ApiError(msg, { status, url, data: data ?? text });
  }

  return data;
}

// ───────────────────────────────────────────────────────────────────
// Fetch centralizado (com timeout)
// ───────────────────────────────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);

async function doFetch(path, { method = "GET", auth = true, headers, query, body, on401, on403 } = {}) {
  const safePath = normalizePath(path);

  // Monta URL final
  const isAbsolute = /^https?:\/\//i.test(safePath);
  let url = isAbsolute
    ? safePath + qs(query)
    : ensureApi(API_BASE_URL, safePath) + qs(query);

  // ⚠️ NÃO subir http → https para localhost
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

  const hasAuth = !!init.headers?.Authorization;
  const headersPreview = { ...init.headers };
  if (headersPreview.Authorization) headersPreview.Authorization = "Bearer ***";
  console.log(`🛫 [req ${method}] ${url}`, {
    auth: auth ? "on" : "off",
    hasAuthHeader: hasAuth,
    headers: headersPreview,
    body: body instanceof FormData ? "[FormData]" : body,
  });

  let res;
  const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());

  // ⏱️ timeout com AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("timeout")), DEFAULT_TIMEOUT_MS);

  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch (networkErr) {
    const t1 = (typeof performance !== "undefined" ? performance.now() : Date.now());
    const reason = networkErr?.message || networkErr?.name || String(networkErr);
    console.error(`🌩️ [neterr ${method}] ${url} (${Math.round(t1 - t0)}ms):`, reason);
    const isTimeout =
      reason?.toLowerCase?.().includes("timeout") || networkErr?.name === "AbortError";
    throw new ApiError(isTimeout ? "Tempo de resposta excedido." : "Falha de rede ou CORS", {
      status: 0,
      url: url,
      data: networkErr,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const t1 = (typeof performance !== "undefined" ? performance.now() : Date.now());
  console.log(`⏱️ [time ${method}] ${url} → ${Math.round(t1 - t0)}ms`);

  return handle(res, { on401, on403 });
}

// ───────────────────────────────────────────────────────────────────
// Métodos HTTP
// ───────────────────────────────────────────────────────────────────
export async function apiGet(path, opts = {})         { return doFetch(path, { method: "GET",    ...opts }); }
export async function apiPost(path, body, opts = {})  { return doFetch(path, { method: "POST",  body, ...opts }); }
export async function apiPut(path, body, opts = {})   { return doFetch(path, { method: "PUT",   body, ...opts }); }
export async function apiPatch(path, body, opts = {}) { return doFetch(path, { method: "PATCH", body, ...opts }); }
export async function apiDelete(path, opts = {})      { return doFetch(path, { method: "DELETE",       ...opts }); }

// Upload multipart
export async function apiUpload(path, formData, opts = {}) {
  return doFetch(path, { method: "POST", body: formData, ...opts });
}

// POST que retorna arquivo (Blob)
export async function apiPostFile(path, body, opts = {}) {
  const { auth = true, headers, query, on403 = "silent" } = opts;
  const token = getToken();

  const safePath = normalizePath(path);
  const isAbsolute = /^https?:\/\//i.test(safePath);
  let url = isAbsolute
    ? safePath + qs(query)
    : ensureApi(API_BASE_URL, safePath) + qs(query);

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

  if (res.status === 401) try { localStorage.clear(); } catch {}
  if (res.status === 403 && on403 === "silent") throw new Error("Sem permissão.");

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
  const { auth = true, headers, query, on403 = "silent" } = opts;
  const token = getToken();

  const safePath = normalizePath(path);
  const isAbsolute = /^https?:\/\//i.test(safePath);
  let url = isAbsolute
    ? safePath + qs(query)
    : ensureApi(API_BASE_URL, safePath) + qs(query);

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

  if (res.status === 401) try { localStorage.clear(); } catch {}
  if (res.status === 403 && on403 === "silent") throw new Error("Sem permissão.");

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

export { API_BASE_URL }; // opcional, para debug
