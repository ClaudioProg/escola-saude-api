// 📁 src/services/api.js

// Base URL: usa .env (Vite) ou vazio para proxy do frontend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const IS_DEV = !!import.meta.env.DEV;

// Lê o token do storage
const getToken = () => localStorage.getItem("token");

// 🔧 Monta headers padrão; não define Authorization se auth=false ou sem token
function buildHeaders(auth = true, extra = {}) {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

// 🔗 Helper de querystring (ignora undefined/null/"")
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

// 🛰️ Handler centralizado: tenta parsear JSON; diferencia 401 x 403
async function handle(res, { on401 = "redirect", on403 = "silent" } = {}) {
  const url = res?.url || "";
  const status = res?.status;
  let text = "";
  let data = null;

  try {
    text = await res.text(); // body só pode ser lido uma vez
  } catch {
    // ignore
  }

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null; // não era JSON
  }

  // Log de resposta
  if (IS_DEV) {
    const preview = data ?? text ?? "";
    console[(res.ok ? "log" : "warn")](
      `🛬 [${status}] ${url}`,
      typeof preview === "string" ? preview.slice(0, 500) : preview
    );
  }

  // Tratamento específico por status
  if (status === 401) {
    // sessão expirada / token inválido
    if (IS_DEV) console.error("⚠️ 401 recebido: limpando sessão");
    localStorage.clear();
    if (on401 === "redirect") {
      // evita loop caso já esteja na página de login
      if (!location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }
    throw new ApiError(data?.erro || data?.message || "Não autorizado (401)", {
      status,
      url,
      data: data ?? text,
    });
  }

  if (status === 403) {
    // sem permissão (NÃO limpar sessão)
    if (IS_DEV) console.warn("🚫 403 recebido: sem permissão");
    if (on403 === "redirect") {
      if (location.pathname !== "/dashboard") {
        window.location.assign("/dashboard");
      }
    }
    throw new ApiError(data?.erro || data?.message || "Sem permissão (403)", {
      status,
      url,
      data: data ?? text,
    });
  }

  if (!res.ok) {
    const msg = data?.erro || data?.message || text || `HTTP ${status}`;
    throw new ApiError(msg, { status, url, data: data ?? text });
  }

  return data;
}

// 🌐 Wrapper de fetch com log de request
async function doFetch(path, { method = "GET", auth = true, headers, query, body, on401, on403 } = {}) {
  const url = `${API_BASE_URL}${path}${qs(query)}`;

  const init = {
    method,
    headers: buildHeaders(auth, headers),
    credentials: "include",
  };

  if (body instanceof FormData) {
    // Upload: NÃO definir Content-Type manualmente
    const token = getToken();
    init.headers = {
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    };
    init.body = body;
  } else if (body !== undefined) {
    init.body = body ? JSON.stringify(body) : undefined;
  }

  if (IS_DEV) {
    const preview = body instanceof FormData ? "[FormData]" : body;
    console.log(`🛫 [${method}] ${url}`, { headers: init.headers, body: preview });
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch (networkErr) {
    // Erro de rede (CORS, queda, DNS…)
    if (IS_DEV) console.error("🌩️ Erro de rede:", networkErr?.message || networkErr);
    throw new ApiError("Falha de rede ou CORS", { status: 0, url, data: networkErr });
  }

  return handle(res, { on401, on403 });
}

// -------- Métodos HTTP --------

// GET: opts = { auth, headers, query, on401, on403 }
export async function apiGet(path, opts = {}) {
  return doFetch(path, { method: "GET", ...opts });
}

// POST: corpo JSON
export async function apiPost(path, body, opts = {}) {
  return doFetch(path, { method: "POST", body, ...opts });
}

// PUT: corpo JSON
export async function apiPut(path, body, opts = {}) {
  return doFetch(path, { method: "PUT", body, ...opts });
}

// PATCH: corpo JSON
export async function apiPatch(path, body, opts = {}) {
  return doFetch(path, { method: "PATCH", body, ...opts });
}

// DELETE
export async function apiDelete(path, opts = {}) {
  return doFetch(path, { method: "DELETE", ...opts });
}

// Upload multipart: passe um FormData; NÃO definimos Content-Type manualmente
export async function apiUpload(path, formData, opts = {}) {
  return doFetch(path, { method: "POST", body: formData, ...opts });
}

// POST que retorna arquivo (Blob). Lê Content-Disposition p/ sugerir nome.
export async function apiPostFile(path, body, opts = {}) {
  const { auth = true, headers, query, on403 = "silent" } = opts;
  const token = localStorage.getItem("token");
  const url = `${API_BASE_URL}${path}${qs(query)}`;

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

  // trata 401/403 sem quebrar a tela
  if (res.status === 401) {
    localStorage.clear();
  }
  if (res.status === 403 && on403 === "silent") {
    throw new Error("Sem permissão.");
  }

  if (!res.ok) {
    // tenta ler mensagem de erro do backend
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
  // tenta extrair filename do header
  const cd = res.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
  const filename = m ? decodeURIComponent(m[1]) : undefined;

  return { blob, filename };
}
