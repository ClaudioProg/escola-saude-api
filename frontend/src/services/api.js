// 📁 src/services/api.js

// 🔧 Base URL vinda do .env (Vite). Ex.: https://escola-saude-api.onrender.com/api
const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || "").trim();
// remove barras finais da base (fica sem trailing slash)
export let API_BASE_URL = RAW_BASE.replace(/\/+$/, "");
const IS_DEV = !!import.meta.env.DEV;

/* ──────────────────────────────────────────────────────────────────
   LOGS DE INICIALIZAÇÃO
   ────────────────────────────────────────────────────────────────── */
(() => {
  const proto = typeof window !== "undefined" ? window.location.protocol : "n/a";
  const host  = typeof window !== "undefined" ? window.location.host      : "n/a";

  // 🔒 blindagem extra: se vier http:// na base, troca pra https:// SEMPRE
  if (API_BASE_URL.startsWith("http://")) {
    API_BASE_URL = API_BASE_URL.replace(/^http:\/\//, "https://");
  }

  console.info("[API:init] base:", API_BASE_URL || "(vazia)", {
    protocol: proto,
    host,
    env: IS_DEV ? "dev" : "prod",
  });

  if (!API_BASE_URL) {
    const msg = "[API:init] VITE_API_BASE_URL vazia.";
    if (!IS_DEV) throw new Error("VITE_API_BASE_URL ausente em produção.");
    console.warn(`${msg} Em dev dá pra usar rewrites; em prod causará 404.`);
  }
})();

/* ────────────────────────────────────────────────────────────────── */

// 🔑 Lê token salvo
const getToken = () => {
  try { return localStorage.getItem("token"); } catch { return null; }
};

// 🧾 Headers padrão
function buildHeaders(auth = true, extra = {}) {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

// 🔗 Querystring
export function qs(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.append(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

// 🧱 Erro enriquecido
class ApiError extends Error {
  constructor(message, { status, url, data } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
    this.data = data;
  }
}

// 🧼 Normalizador de path: garante "/" inicial, remove prefixo "/api"
function normalizePath(path) {
  if (!path) return "/";
  // Se vier URL absoluta, respeita (override da base) e força https
  if (/^https?:\/\//i.test(path)) return path.replace(/^http:\/\//i, "https://");

  let p = String(path);
  if (!p.startsWith("/")) p = `/${p}`;
  // Remove um "/api" inicial para não duplicar com a base
  p = p.replace(/^\/+api\/?/, "/");
  // Garante uma única barra inicial
  p = "/" + p.replace(/^\/+/, "");
  return p;
}

// 🛰️ Handler centralizado
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

// 🌐 Fetch centralizado
async function doFetch(path, { method = "GET", auth = true, headers, query, body, on401, on403 } = {}) {
  const safePath = normalizePath(path);

  // Monta URL final:
  const isAbsolute = /^https?:\/\//i.test(safePath);
  const base = isAbsolute ? "" : (API_BASE_URL || "");
  let url = `${base}${safePath}${qs(query)}`;

  // 🔒 blindagem final: qualquer URL http:// vira https://
  if (url.startsWith("http://")) {
    url = url.replace(/^http:\/\//, "https://");
  }

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
  try {
    res = await fetch(url, init);
  } catch (networkErr) {
    const t1 = (typeof performance !== "undefined" ? performance.now() : Date.now());
    console.error(`🌩️ [neterr ${method}] ${url} (${Math.round(t1 - t0)}ms):`, networkErr?.message || networkErr);
    throw new ApiError("Falha de rede ou CORS", { status: 0, url, data: networkErr });
  }
  const t1 = (typeof performance !== "undefined" ? performance.now() : Date.now());
  console.log(`⏱️ [time ${method}] ${url} → ${Math.round(t1 - t0)}ms`);

  return handle(res, { on401, on403 });
}

// -------- Métodos HTTP --------
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
  const base = isAbsolute ? "" : (API_BASE_URL || "");
  let url = `${base}${safePath}${qs(query)}`;
  if (url.startsWith("http://")) url = url.replace(/^http:\/\//, "https://");

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
  const base = isAbsolute ? "" : (API_BASE_URL || "");
  let url = `${base}${safePath}${qs(query)}`;
  if (url.startsWith("http://")) url = url.replace(/^http:\/\//, "https://");

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
