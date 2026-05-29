// ✅ frontend/src/services/api.js — v2.2
// Atualizado em: 19/05/2026
/* eslint-disable no-console */
/**
 * Plataforma Escola da Saúde
 *
 * Serviço central oficial de API.
 *
 * Contrato:
 * - VITE_API_BASE_URL é a env oficial.
 * - Token oficial: localStorage["token"].
 * - Perfil oficial: localStorage["perfil"] como string única.
 * - Base de chamadas frontend sem "/api" direto nas páginas/componentes.
 * - Este service é o único ponto que monta URLs da API.
 *
 * Padrão:
 * - Sem aliases de rota.
 * - Sem chamadas legadas.
 * - Sem fallback hardcoded de produção.
 * - Sem access_token/authToken/user.
 * - Sem múltiplas formas para o mesmo recurso.
 * - Rotas preferencialmente em português e singular.
 * - Headers anti-fuso em todas as requisições.
 * - Respostas diagnosticáveis.
 */

const IS_DEV = Boolean(import.meta.env.DEV);

/* ─────────────────────────────────────────────────────────────
   Logs
────────────────────────────────────────────────────────────── */

function logDev(...args) {
  if (IS_DEV) console.log("[api]", ...args);
}

function errorDev(...args) {
  if (IS_DEV) console.error("[api]", ...args);
}

/* ─────────────────────────────────────────────────────────────
   Ambiente / URL
────────────────────────────────────────────────────────────── */

function isLocalHost(host) {
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(host || ""));
}

function isHttpUrl(url) {
  return /^http:\/\//i.test(String(url || ""));
}

function isAbsoluteUrl(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function normalizePath(path) {
  const raw = String(path || "/").trim();

  if (!raw) return "/";
  if (isAbsoluteUrl(raw)) return raw;

  return raw.startsWith("/") ? raw : `/${raw}`;
}

function computeBase() {
  const envBase = stripTrailingSlash(import.meta.env.VITE_API_BASE_URL || "");

  if (envBase) return envBase;

  if (IS_DEV) return "";

  throw new Error(
    "VITE_API_BASE_URL não configurada. Defina a URL oficial da API no ambiente de produção."
  );
}

let API_BASE_URL = computeBase();

try {
  if (isHttpUrl(API_BASE_URL)) {
    const host = new URL(API_BASE_URL).host;

    if (!isLocalHost(host)) {
      API_BASE_URL = API_BASE_URL.replace(/^http:\/\//i, "https://");
    }
  }
} catch {
  // noop
}

if (API_BASE_URL == null) {
  throw new Error("Falha ao resolver API_BASE_URL.");
}

function ensureApi(base, path) {
  const baseNoSlash = stripTrailingSlash(base);
  let normalizedPath = normalizePath(path);

  if (isAbsoluteUrl(normalizedPath)) return normalizedPath;

  const baseHasApi = /\/api$/i.test(baseNoSlash);
  const pathHasApi = /^\/api(\/|$)/i.test(normalizedPath);

  if (baseHasApi && pathHasApi) {
    normalizedPath = normalizedPath.replace(/^\/api(\/|$)/i, "/");
  } else if (!baseHasApi && !pathHasApi) {
    normalizedPath = `/api${normalizedPath}`;
  }

  return `${baseNoSlash}${normalizedPath}`;
}

function ensureRoot(base, path) {
  const baseNoSlash = stripTrailingSlash(base);
  const normalizedPath = normalizePath(path);

  if (isAbsoluteUrl(normalizedPath)) return normalizedPath;

  return `${baseNoSlash}${normalizedPath}`;
}

function enforceHttpsExternal(url) {
  try {
    if (isHttpUrl(url)) {
      const host = new URL(url).host;

      if (!isLocalHost(host)) {
        return url.replace(/^http:\/\//i, "https://");
      }
    }
  } catch {
    // noop
  }

  return url;
}

function isBadParamValue(value) {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value === "number" && Number.isNaN(value)) return true;

  if (typeof value === "string" && value.trim().toLowerCase() === "nan") {
    return true;
  }

  return false;
}

export function qs(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (!isBadParamValue(item)) query.append(key, item);
      });
      return;
    }

    if (!isBadParamValue(value)) {
      query.append(key, value);
    }
  });

  const serialized = query.toString();

  return serialized ? `?${serialized}` : "";
}

export function makeApiUrl(path, query) {
  const url = ensureApi(API_BASE_URL, normalizePath(path)) + qs(query);
  return enforceHttpsExternal(url);
}

function makeRootUrl(path, query) {
  const url = ensureRoot(API_BASE_URL, normalizePath(path)) + qs(query);
  return enforceHttpsExternal(url);
}

const API_BASE_ROOT = ensureApi(API_BASE_URL, "/").replace(/\/+$/, "");

/* ─────────────────────────────────────────────────────────────
   Sessão oficial
────────────────────────────────────────────────────────────── */

const STORAGE_TOKEN_KEY = "token";
const STORAGE_USUARIO_KEY = "usuario";
const STORAGE_PERFIL_KEY = "perfil";

const PERFIL_CHANGE_EVENT = "escola-perfil-change";
const AUTH_CHANGE_EVENT = "auth:changed";

export function getToken() {
  try {
    const raw = localStorage.getItem(STORAGE_TOKEN_KEY);

    if (!raw) return null;

    return String(raw).replace(/^Bearer\s+/i, "").trim() || null;
  } catch {
    return null;
  }
}

export function getUsuarioLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_USUARIO_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function getPerfilLocal() {
  try {
    return String(localStorage.getItem(STORAGE_PERFIL_KEY) || "").trim() || null;
  } catch {
    return null;
  }
}

function emitPerfilChange(value = null) {
  if (typeof window === "undefined") return;

  try {
    window.dispatchEvent(
      new CustomEvent(PERFIL_CHANGE_EVENT, {
        detail: {
          storageKey: STORAGE_PERFIL_KEY,
          value,
        },
      })
    );
  } catch {
    // noop
  }
}

export function clearAuthSession(options = {}) {
  const { emitEvent = true } = options;

  try {
    const hadSession =
      Boolean(localStorage.getItem(STORAGE_TOKEN_KEY)) ||
      Boolean(localStorage.getItem(STORAGE_USUARIO_KEY)) ||
      Boolean(localStorage.getItem(STORAGE_PERFIL_KEY));

    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USUARIO_KEY);
    localStorage.removeItem(STORAGE_PERFIL_KEY);

    setPerfilIncompletoFlag(null);
    emitPerfilChange(null);

    if (emitEvent && hadSession && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(AUTH_CHANGE_EVENT, {
          detail: {
            authenticated: false,
          },
        })
      );
    }

    logDev("sessão limpa", { emitEvent, hadSession });
  } catch (error) {
    errorDev("erro ao limpar sessão", error);
  }
}

export function persistAuthSession(token, usuario = null, options = {}) {
  const { emitEvent = true } = options;

  try {
    const normalizedToken = token
      ? String(token).replace(/^Bearer\s+/i, "").trim()
      : null;

    const prevToken = localStorage.getItem(STORAGE_TOKEN_KEY);
    const prevUsuario = localStorage.getItem(STORAGE_USUARIO_KEY);
    const nextUsuario = usuario ? JSON.stringify(usuario) : null;

    let changed = false;

    if (normalizedToken && prevToken !== normalizedToken) {
      localStorage.setItem(STORAGE_TOKEN_KEY, normalizedToken);
      changed = true;
    }

    if (nextUsuario && prevUsuario !== nextUsuario) {
      localStorage.setItem(STORAGE_USUARIO_KEY, nextUsuario);
      changed = true;
    }

    if (usuario?.perfil) {
      const perfil = String(usuario.perfil || "").trim();

      if (perfil && localStorage.getItem(STORAGE_PERFIL_KEY) !== perfil) {
        localStorage.setItem(STORAGE_PERFIL_KEY, perfil);
        emitPerfilChange(perfil);
        changed = true;
      }
    }

    if (emitEvent && changed && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(AUTH_CHANGE_EVENT, {
          detail: {
            authenticated: true,
            usuario,
          },
        })
      );
    }

    logDev("sessão persistida", {
      changed,
      hasToken: Boolean(normalizedToken),
      usuarioId: usuario?.id || null,
      perfil: usuario?.perfil || null,
    });
  } catch (error) {
    errorDev("erro ao persistir sessão", error);
  }
}

export function isLoggedIn() {
  return Boolean(getToken());
}

/* ─────────────────────────────────────────────────────────────
   Rotas públicas / redirecionamento
────────────────────────────────────────────────────────────── */

function isPublicAppPath(pathname = "") {
  const path = String(pathname || "");

  return (
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/cadastro") ||
    path.startsWith("/esqueci-senha") ||
    path.startsWith("/redefinir-senha") ||
    path.startsWith("/validar-certificado") ||
    path.startsWith("/presenca") ||
    path.startsWith("/historico") ||
    path.startsWith("/privacidade")
  );
}

function currentPathWithQuery() {
  if (typeof window === "undefined") return "/";

  const { pathname, search, hash } = window.location;

  return pathname + (search || "") + (hash || "");
}

function redirectToLogin(nextPath = null) {
  if (typeof window === "undefined") return;

  if (isPublicAppPath(window.location.pathname)) {
    logDev("redirectToLogin ignorado em rota pública", {
      pathname: window.location.pathname,
    });
    return;
  }

  const current = nextPath || currentPathWithQuery();
  const next = encodeURIComponent(current || "/");
  const target = `/login?next=${next}`;

  logDev("redirectToLogin executado", { from: current, to: target });
  window.location.replace(target);
}

/* ─────────────────────────────────────────────────────────────
   Headers anti-fuso / request id
────────────────────────────────────────────────────────────── */

function newRequestId() {
  try {
    const uuid = crypto.randomUUID?.();

    if (uuid) return uuid;
  } catch {
    // noop
  }

  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getClientTZ() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function getClientOffsetMinutes() {
  try {
    return -new Date().getTimezoneOffset();
  } catch {
    return 0;
  }
}

function todayLocalYMD() {
  const date = new Date();
  const pad = (number) => String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function buildClientContextHeaders() {
  return {
    "X-Client-TZ": getClientTZ(),
    "X-Client-Offset-Minutes": String(getClientOffsetMinutes()),
    "X-Client-Today": todayLocalYMD(),
    "X-Client-Now-UTC": new Date().toISOString(),
    "X-Date-Only-Semantics": "YMD_LOCAL",
    "X-Request-Id": newRequestId(),
  };
}

const DEBUG_CONF_KEY = "debug_conflitos";

export function setDebugConflitos(on = true) {
  try {
    sessionStorage.setItem(DEBUG_CONF_KEY, on ? "1" : "0");
  } catch {
    // noop
  }
}

function getDebugConflitos() {
  try {
    return sessionStorage.getItem(DEBUG_CONF_KEY) === "1";
  } catch {
    return false;
  }
}

function buildHeaders(
  auth = true,
  extra = {},
  { contentType = "application/json" } = {}
) {
  const token = getToken();

  const base = {
    ...buildClientContextHeaders(),
    ...(getDebugConflitos() ? { "X-Debug-Conflitos": "1" } : {}),
    ...(contentType ? { "Content-Type": contentType } : {}),
  };

  return {
    ...base,
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

/* ─────────────────────────────────────────────────────────────
   Erro de API
────────────────────────────────────────────────────────────── */

export class ApiError extends Error {
  constructor(message, { status, url, data } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
    this.data = data;
  }
}

/* ─────────────────────────────────────────────────────────────
   Perfil incompleto
────────────────────────────────────────────────────────────── */

const PERFIL_HEADER = "X-Perfil-Incompleto";
const PERFIL_FLAG_KEY = "perfil_incompleto";
const PERFIL_EVENT = "perfil:flag";
const PERFIL_BC_NAME = "perfil:bc";

const REQUIRED_PROFILE_FIELDS = [
  "cargo_id",
  "unidade_id",
  "escolaridade_id",
  "deficiencia_id",
  "data_nascimento",
];

let perfilBC = null;

function getPerfilBC() {
  try {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
      return null;
    }

    if (!perfilBC) {
      perfilBC = new BroadcastChannel(PERFIL_BC_NAME);
    }

    return perfilBC;
  } catch {
    return null;
  }
}

export function getPerfilIncompletoFlag() {
  try {
    const value = sessionStorage.getItem(PERFIL_FLAG_KEY);

    return value === null ? null : value === "1";
  } catch {
    return null;
  }
}

export function setPerfilIncompletoFlag(value) {
  try {
    const previous = getPerfilIncompletoFlag();

    if (value === null || typeof value === "undefined") {
      sessionStorage.removeItem(PERFIL_FLAG_KEY);
    } else {
      sessionStorage.setItem(PERFIL_FLAG_KEY, value ? "1" : "0");
    }

    const next =
      value === null || typeof value === "undefined" ? null : Boolean(value);

    if (previous !== next) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(PERFIL_EVENT, { detail: next }));
      }

      const channel = getPerfilBC();
      channel?.postMessage({ type: "perfil_flag", value: next });
    }
  } catch {
    // noop
  }
}

export function subscribePerfilFlag(callback) {
  if (typeof callback !== "function") return () => {};

  const windowHandler = (event) => callback(event.detail);

  if (typeof window !== "undefined") {
    window.addEventListener(PERFIL_EVENT, windowHandler);
  }

  const channel = getPerfilBC();

  const channelHandler = (event) => {
    if (event?.data?.type === "perfil_flag") {
      callback(event.data.value);
    }
  };

  channel?.addEventListener?.("message", channelHandler);

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener(PERFIL_EVENT, windowHandler);
    }

    channel?.removeEventListener?.("message", channelHandler);
  };
}

function syncPerfilHeader(response) {
  try {
    const value = response?.headers?.get?.(PERFIL_HEADER);

    if (value === "1") setPerfilIncompletoFlag(true);
    else if (value === "0") setPerfilIncompletoFlag(false);
    else setPerfilIncompletoFlag(null);
  } catch {
    // noop
  }
}

function inferPerfilIncompleto(usuario) {
  if (!usuario || typeof usuario !== "object") return true;

  return REQUIRED_PROFILE_FIELDS.some(
    (key) =>
      usuario?.[key] === null ||
      usuario?.[key] === undefined ||
      usuario?.[key] === ""
  );
}

/* ─────────────────────────────────────────────────────────────
   Warmup
────────────────────────────────────────────────────────────── */

const WARMUP_PUBLIC_ROOT = "/__ping";
const WARMUP_AUTH = "/perfil/me";

async function warmup(authNeeded) {
  const token = getToken();
  const path = authNeeded ? WARMUP_AUTH : WARMUP_PUBLIC_ROOT;
  const url = authNeeded ? ensureApi(API_BASE_URL, path) : makeRootUrl(path);

  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      mode: "cors",
      cache: "no-store",
      headers:
        authNeeded && token
          ? { Authorization: `Bearer ${token}`, ...buildClientContextHeaders() }
          : buildClientContextHeaders(),
      redirect: "follow",
      referrerPolicy: "strict-origin-when-cross-origin",
      keepalive: true,
    });

    return response.ok;
  } catch {
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────
   Response handlers
────────────────────────────────────────────────────────────── */

async function handle(
  response,
  {
    on401 = "silent",
    on403 = "silent",
    on404 = "throw",
    suppressGlobalError = false,
  } = {}
) {
  const url = response?.url || "";
  const status = response?.status;

  syncPerfilHeader(response);

  if (status === 404 && on404 === "silent") return null;

  let text = "";
  let data = null;

  try {
    text = await response.text();
  } catch {
    // noop
  }

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (status === 401) {
    if (on401 === "redirect") {
      clearAuthSession();
      redirectToLogin();
    }

    const error = new ApiError(
      data?.message || "Não autorizado (401)",
      {
        status,
        url,
        data: data ?? text,
      }
    );

    error.code = data?.code || "AUTH-401";
    error.sessionExpired = data?.sessionExpired === true;

    throw error;
  }

  if (status === 403) {
    if (
      on403 === "redirect" &&
      typeof window !== "undefined" &&
      !isPublicAppPath(window.location.pathname)
    ) {
      window.location.replace("/painel");
    }

    const error = new ApiError(data?.message || "Sem permissão (403)", {
      status,
      url,
      data: data ?? text,
    });

    error.code = data?.code || "AUTH-403";

    throw error;
  }

  if (!response.ok) {
    const message = data?.message || text || `HTTP ${status}`;
    const error = new ApiError(message, { status, url, data: data ?? text });

    error.code = data?.code || `HTTP-${status}`;

    if (suppressGlobalError) error.silenced = true;

    throw error;
  }

  return data;
}

function throwForAuthStatus(
  response,
  url,
  { on401 = "silent", on403 = "silent" } = {}
) {
  syncPerfilHeader(response);

  if (response.status === 401) {
    if (on401 === "redirect") {
      clearAuthSession();
      redirectToLogin();
    }

    const error = new ApiError("Não autorizado (401)", { status: 401, url });
    error.code = "AUTH-401";

    throw error;
  }

  if (response.status === 403) {
    if (
      on403 === "redirect" &&
      typeof window !== "undefined" &&
      !isPublicAppPath(window.location.pathname)
    ) {
      window.location.replace("/painel");
    }

    const error = new ApiError("Sem permissão (403)", { status: 403, url });
    error.code = "AUTH-403";

    throw error;
  }
}

async function extractErrorMessage(response) {
  let message = `HTTP ${response.status}`;

  try {
    const text = await response.text();
    message = text || message;

    try {
      const json = JSON.parse(text);
      message = json?.message || message;
    } catch {
      // noop
    }
  } catch {
    // noop
  }

  return message;
}

/* ─────────────────────────────────────────────────────────────
   Fetch centralizado
────────────────────────────────────────────────────────────── */

const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);

async function rawFetch(
  path,
  {
    method = "GET",
    auth = true,
    headers,
    query,
    body,
    signal,
    accept = null,
    contentType = "application/json",
    apiPrefix = true,
  } = {}
) {
  const safePath = normalizePath(path);

  const url = enforceHttpsExternal(
    isAbsoluteUrl(safePath)
      ? safePath + qs(query)
      : apiPrefix
        ? ensureApi(API_BASE_URL, safePath) + qs(query)
        : makeRootUrl(safePath, query)
  );

  const token = getToken();

  let finalHeaders;

  if (body instanceof FormData) {
    finalHeaders = {
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...buildClientContextHeaders(),
      ...(getDebugConflitos() ? { "X-Debug-Conflitos": "1" } : {}),
      ...(accept ? { Accept: accept } : {}),
      ...(headers || {}),
    };
  } else {
    finalHeaders = buildHeaders(
      auth,
      {
        ...(accept ? { Accept: accept } : {}),
        ...(headers || {}),
      },
      { contentType }
    );
  }

  const init = {
    method,
    credentials: "include",
    mode: "cors",
    cache: "no-store",
    redirect: "follow",
    referrerPolicy: "strict-origin-when-cross-origin",
    headers: finalHeaders,
    ...(body instanceof FormData
      ? { body }
      : body !== undefined
        ? { body: body ? JSON.stringify(body) : undefined }
        : {}),
  };

  async function runOnce() {
    const controller = new AbortController();

    const abortFromOuter = () => {
      try {
        controller.abort(signal?.reason || new Error("aborted"));
      } catch {
        // noop
      }
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
        try {
          signal.removeEventListener("abort", abortFromOuter);
        } catch {
          // noop
        }
      }
    }
  }

  let response;

  try {
    response = await runOnce();
  } catch (firstError) {
    if (
      firstError?.name === "AbortError" ||
      String(firstError?.message || "").toLowerCase().includes("aborted") ||
      signal?.aborted
    ) {
      throw firstError;
    }

    const reason = firstError?.message || firstError?.name || String(firstError);

    logDev("falha na primeira tentativa, executando warmup", {
      method,
      path: safePath,
      auth,
      reason,
    });

    await warmup(auth && Boolean(token));

    try {
      response = await runOnce();
    } catch (secondError) {
      if (
        secondError?.name === "AbortError" ||
        String(secondError?.message || "").toLowerCase().includes("aborted") ||
        signal?.aborted
      ) {
        throw secondError;
      }

      throw new ApiError(
        String(reason).toLowerCase().includes("timeout")
          ? "Tempo de resposta excedido."
          : "Falha de rede ou CORS",
        { status: 0, url, data: secondError }
      );
    }
  }

  if (response && (response.status === 429 || response.status === 503)) {
    const retryAfter = Number(response.headers?.get?.("Retry-After")) || 0;
    const waitMs = retryAfter
      ? retryAfter * 1000
      : 500 + Math.floor(Math.random() * 600);

    await new Promise((resolve) => setTimeout(resolve, waitMs));
    response = await runOnce();
  }

  return { res: response, url };
}

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
    apiPrefix = true,
  } = {}
) {
  const { res } = await rawFetch(path, {
    method,
    auth,
    headers,
    query,
    body,
    signal,
    apiPrefix,
  });

  return handle(res, {
    on401,
    on403,
    on404,
    suppressGlobalError,
  });
}

/* ─────────────────────────────────────────────────────────────
   Métodos HTTP oficiais
────────────────────────────────────────────────────────────── */

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

export const apiGetPublic = (path, opts = {}) =>
  apiGet(path, { auth: false, on401: "silent", ...opts });

export const apiPostPublic = (path, body, opts = {}) =>
  apiPost(path, body, { auth: false, on401: "silent", ...opts });

/* ─────────────────────────────────────────────────────────────
   HEAD cache/coalescing
────────────────────────────────────────────────────────────── */

const HEAD_CACHE_TTL_MS = Number(import.meta.env.VITE_API_HEAD_TTL_MS || 120_000);
const headCache = new Map();
const inflightHead = new Map();

function headKeyFromPath(path) {
  return normalizePath(path);
}

function headCacheGet(key) {
  const entry = headCache.get(key);

  if (!entry) return undefined;

  if (entry.expires < Date.now()) {
    headCache.delete(key);
    return undefined;
  }

  return entry.value;
}

function headCacheSet(key, value, ttlMs = HEAD_CACHE_TTL_MS) {
  headCache.set(key, {
    value: Boolean(value),
    expires: Date.now() + ttlMs,
  });
}

export function invalidateHeadPrefix(prefixPath) {
  const prefix = headKeyFromPath(prefixPath);

  for (const key of headCache.keys()) {
    if (key.startsWith(prefix)) headCache.delete(key);
  }
}

export async function apiHead(path, opts = {}) {
  const {
    auth = true,
    headers,
    query,
    on401 = "silent",
    on403 = "silent",
    ttlMs = HEAD_CACHE_TTL_MS,
    quiet = true,
  } = opts;

  const key = headKeyFromPath(path);
  const cached = headCacheGet(key);

  if (typeof cached === "boolean") return cached;
  if (inflightHead.has(key)) return inflightHead.get(key);

  const promise = (async () => {
    const { res } = await rawFetch(path, {
      method: "HEAD",
      auth,
      headers,
      query,
      contentType: null,
    }).catch((error) => {
      if (!quiet) console.warn("[apiHead] erro:", error?.message || error);

      return {
        res: {
          status: 0,
          ok: false,
          headers: new Headers(),
        },
      };
    });

    try {
      syncPerfilHeader(res);
    } catch {
      // noop
    }

    const status = res?.status ?? 0;

    if (status === 401 && on401 !== "silent" && !quiet) {
      console.warn("[apiHead] 401");
    }

    if (status === 403 && on403 !== "silent" && !quiet) {
      console.warn("[apiHead] 403");
    }

    const exists = res?.ok || status === 200 || status === 204;

    headCacheSet(key, exists, ttlMs);

    return exists;
  })();

  inflightHead.set(key, promise);

  promise.finally(() => {
    setTimeout(() => inflightHead.delete(key), 0);
  });

  return promise;
}

/* ─────────────────────────────────────────────────────────────
   Arquivos / response crua
────────────────────────────────────────────────────────────── */

function parseContentDispositionFilename(contentDisposition = "") {
  if (!contentDisposition) return undefined;

  const star = contentDisposition.match(/filename\*=(?:UTF-8'')?([^;]+)/i);

  if (star) {
    try {
      const value = star[1].trim().replace(/^"(.*)"$/, "$1");
      return decodeURIComponent(value);
    } catch {
      // noop
    }
  }

  const normal = contentDisposition.match(/filename=(?:"([^"]+)"|([^;]+))/i);

  if (normal) {
    const raw = (normal[1] || normal[2] || "")
      .trim()
      .replace(/^"(.*)"$/, "$1");

    return raw.replace(/^'(.*)'$/, "$1").trim();
  }

  return undefined;
}

export async function apiGetResponse(path, opts = {}) {
  const { on401 = "silent", on403 = "silent", ...rest } = opts;

  const { res, url } = await rawFetch(path, {
    method: "GET",
    ...rest,
  });

  throwForAuthStatus(res, url, { on401, on403 });

  if (!res.ok) {
    const message = await extractErrorMessage(res);
    throw new ApiError(message, { status: res.status, url });
  }

  return res;
}

export async function apiGetFile(path, opts = {}) {
  const response = await apiGetResponse(path, {
    accept: "*/*",
    ...opts,
  });

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const filename = parseContentDispositionFilename(contentDisposition);

  return { blob, filename };
}

export async function apiPostFile(path, body, opts = {}) {
  const { on401 = "silent", on403 = "silent", ...rest } = opts;

  const { res, url } = await rawFetch(path, {
    method: "POST",
    body,
    accept: "*/*",
    ...rest,
  });

  throwForAuthStatus(res, url, { on401, on403 });

  if (!res.ok) {
    const message = await extractErrorMessage(res);
    throw new ApiError(message, { status: res.status, url });
  }

  const blob = await res.blob();
  const contentDisposition = res.headers.get("Content-Disposition") || "";
  const filename = parseContentDispositionFilename(contentDisposition);

  return { blob, filename };
}

export async function apiUpload(path, formDataOrFile, opts = {}) {
  let formData;

  if (formDataOrFile instanceof FormData) {
    formData = formDataOrFile;
  } else if (formDataOrFile instanceof Blob) {
    const fieldName = opts.fieldName || "arquivo";

    formData = new FormData();

    const fallbackName =
      (formDataOrFile && "name" in formDataOrFile && formDataOrFile.name) ||
      fieldName;

    formData.append(fieldName, formDataOrFile, fallbackName);
  } else {
    throw new Error("apiUpload: passe um FormData ou File/Blob.");
  }

  return doFetch(path, {
    method: "POST",
    body: formData,
    ...opts,
  });
}

export const onlyDigitsString = (value) => String(value ?? "").replace(/\D/g, "");

export function downloadBlob(filename = "download", blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename || "download";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}
/* ─────────────────────────────────────────────────────────────
   Auth público — contrato oficial
────────────────────────────────────────────────────────────── */

export async function apiAuthLogin(payload, opts = {}) {
  return apiPostPublic("/login", payload, {
    on401: "silent",
    on403: "silent",
    ...opts,
  });
}

export async function apiAuthGoogle(payload, opts = {}) {
  return apiPostPublic("/auth/google", payload, {
    on401: "silent",
    on403: "silent",
    ...opts,
  });
}

export async function apiCadastrarUsuario(payload, opts = {}) {
  return apiPostPublic("/auth/cadastro", payload, opts);
}

export async function apiEsqueciSenha(payload, opts = {}) {
  return apiPostPublic("/auth/esqueci-senha", payload, opts);
}

export async function apiRedefinirSenha(payload, opts = {}) {
  return apiPostPublic("/auth/redefinir-senha", payload, opts);
}

/* ─────────────────────────────────────────────────────────────
   Perfil — contrato oficial
────────────────────────────────────────────────────────────── */

export async function apiPerfilOpcao(opts = {}) {
  const response = await apiGetPublic("/perfil/opcao", {
    on401: "silent",
    on403: "silent",
    ...opts,
  });

  return response?.data || {
    cargos: [],
    unidades: [],
    generos: [],
    orientacoes_sexuais: [],
    cores_racas: [],
    escolaridades: [],
    deficiencias: [],
  };
}

export async function apiPerfilMe(opts = {}) {
  const response = await apiGet("/perfil/me", {
    auth: true,
    on401: "silent",
    on403: "silent",
    suppressGlobalError: true,
    ...opts,
  });

  const usuario = response?.data || null;

  try {
    const incompleto =
      typeof usuario?.perfil_incompleto === "boolean"
        ? usuario.perfil_incompleto
        : inferPerfilIncompleto(usuario);

    setPerfilIncompletoFlag(Boolean(incompleto));
  } catch {
    // noop
  }

  return usuario;
}

export async function apiPerfilUpdate(payload, opts = {}) {
  const response = await apiPut("/perfil/me", payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });

  const usuario = response?.data || null;

  try {
    const incompleto =
      typeof usuario?.perfil_incompleto === "boolean"
        ? usuario.perfil_incompleto
        : inferPerfilIncompleto(usuario);

    setPerfilIncompletoFlag(Boolean(incompleto));
  } catch {
    // noop
  }

  return usuario;
}

export async function apiAuthMe(opts = {}) {
  return apiPerfilMe(opts);
}

/* ─────────────────────────────────────────────────────────────
   Lookup público — contrato oficial singular
────────────────────────────────────────────────────────────── */

export async function apiLookupCargo(opts = {}) {
  return apiGetPublic("/lookup/cargo", opts);
}

export async function apiLookupUnidade(opts = {}) {
  return apiGetPublic("/lookup/unidade", opts);
}

export async function apiLookupGenero(opts = {}) {
  return apiGetPublic("/lookup/genero", opts);
}

export async function apiLookupOrientacaoSexual(opts = {}) {
  return apiGetPublic("/lookup/orientacao-sexual", opts);
}

export async function apiLookupCorRaca(opts = {}) {
  return apiGetPublic("/lookup/cor-raca", opts);
}

export async function apiLookupEscolaridade(opts = {}) {
  return apiGetPublic("/lookup/escolaridade", opts);
}

export async function apiLookupDeficiencia(opts = {}) {
  return apiGetPublic("/lookup/deficiencia", opts);
}

/* ─────────────────────────────────────────────────────────────
   Usuário — contrato oficial
────────────────────────────────────────────────────────────── */

export async function apiUsuarioBuscar(params = {}, opts = {}) {
  return apiGet("/usuario/buscar", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiUsuarioListar(params = {}, opts = {}) {
  return apiGet("/usuario", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiUsuarioObter(id, opts = {}) {
  if (!id) throw new Error("ID do usuário é obrigatório.");

  return apiGet(`/usuario/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiUsuarioAtualizarBasico(id, payload, opts = {}) {
  if (!id) throw new Error("ID do usuário é obrigatório.");

  return apiPatch(`/usuario/${id}/basico`, payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiUsuarioAtualizarPerfilInstitucional(
  id,
  payload,
  opts = {}
) {
  if (!id) throw new Error("ID do usuário é obrigatório.");

  return apiPatch(`/usuario/${id}/perfil-institucional`, payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiUsuarioAtualizarDadosAdministrativos(
  id,
  payload,
  opts = {}
) {
  if (!id) throw new Error("ID do usuário é obrigatório.");

  return apiPatch(`/usuario/${id}/dados-administrativos`, payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiUsuarioAtualizarPerfil(id, payload, opts = {}) {
  if (!id) throw new Error("ID do usuário é obrigatório.");

  return apiPatch(`/usuario/${id}/perfil`, payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiUsuarioListarorganizador(opts = {}) {
  return apiGet("/usuario/organizador", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiUsuarioListarAvaliador(params = {}, opts = {}) {
  return apiGet("/usuario/avaliador", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiUsuarioResumo(id, opts = {}) {
  if (!id) throw new Error("ID do usuário é obrigatório.");

  return apiGet(`/usuario/${id}/resumo`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiUsuarioEstatistica(opts = {}) {
  return apiGet("/usuario/estatistica", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiUsuarioEstatisticaDetalhada(opts = {}) {
  return apiGet("/usuario/estatistica/detalhe", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

/* ─────────────────────────────────────────────────────────────
   Dashboard — contrato oficial
────────────────────────────────────────────────────────────── */

export async function apiDashboardResumo(opts = {}) {
  return apiGet("/dashboard", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiDashboardAvaliacaoRecenteorganizador(opts = {}) {
  return apiGet("/dashboard/avaliacao-recente", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiDashboardAnalitico(params = {}, opts = {}) {
  return apiGet("/dashboard/administrador", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

/* ─────────────────────────────────────────────────────────────
   organizador — contrato oficial v2.0
────────────────────────────────────────────────────────────── */

export async function apiorganizadorListar(params = {}, opts = {}) {
  return apiGet("/organizador", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiorganizadorEventosAvaliacao(organizadorId, opts = {}) {
  if (!organizadorId) throw new Error("organizador_id é obrigatório.");

  return apiGet(`/organizador/${organizadorId}/eventos-avaliacao`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiorganizadorTurmas(organizadorId, opts = {}) {
  if (!organizadorId) throw new Error("organizador_id é obrigatório.");

  return apiGet(`/organizador/${organizadorId}/turmas`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiorganizadorMinhasTurmas(params = {}, opts = {}) {
  return apiGet("/organizador/minhas/turmas", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

/* ─────────────────────────────────────────────────────────────
   Informação publicada — contrato oficial
────────────────────────────────────────────────────────────── */

export async function apiInformacaoPublicadaListar(opts = {}) {
  return apiGet("/informacoes/publicadas", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

/* ─────────────────────────────────────────────────────────────
   Notificação — contrato oficial
────────────────────────────────────────────────────────────── */

export async function apiNotificacaoListar(params = {}, opts = {}) {
  return apiGet("/notificacao", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiNotificacaoResumo(opts = {}) {
  return apiGet("/notificacao/resumo", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiNotificacaoMarcarLida(id, opts = {}) {
  if (!id) throw new Error("ID da notificação é obrigatório.");

  return apiPatch(
    `/notificacao/${id}/lida`,
    {},
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

export async function apiNotificacaoMarcarTodasLidas(opts = {}) {
  return apiPatch(
    "/notificacao/lida/todas",
    {},
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

/* ─────────────────────────────────────────────────────────────
   Evento — contrato oficial
────────────────────────────────────────────────────────────── */

export async function apiEventoListarAdministrador(params = {}, opts = {}) {
  return apiGet("/evento/administrador", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiEventoFolderResponse(eventoId, opts = {}) {
  if (!eventoId) throw new Error("eventoId é obrigatório.");

  return apiGetResponse(`/evento/${eventoId}/folder`, {
    auth: false,
    accept: "image/*",
    on401: "silent",
    on403: "silent",
    ...opts,
  });
}

export async function apiEventoProgramacaoResponse(eventoId, opts = {}) {
  if (!eventoId) throw new Error("eventoId é obrigatório.");

  return apiGetResponse(`/evento/${eventoId}/programacao`, {
    auth: false,
    accept: "application/pdf",
    on401: "silent",
    on403: "silent",
    ...opts,
  });
}

export async function apiEventoProgramacaoFile(eventoId, opts = {}) {
  if (!eventoId) throw new Error("eventoId é obrigatório.");

  return apiGetFile(`/evento/${eventoId}/programacao`, {
    auth: false,
    accept: "application/pdf",
    on401: "silent",
    on403: "silent",
    ...opts,
  });
}

/* ─────────────────────────────────────────────────────────────
   Turma — contrato oficial
────────────────────────────────────────────────────────────── */

export async function apiTurmaListarPorEvento(eventoId, opts = {}) {
  if (!eventoId) throw new Error("evento_id é obrigatório.");

  return apiGet(`/turma/evento/${eventoId}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiTurmaListarPorEventoSimples(eventoId, opts = {}) {
  if (!eventoId) throw new Error("evento_id é obrigatório.");

  return apiGet(`/turma/evento/${eventoId}/simples`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiTurmaListarAdministrador(opts = {}) {
  return apiGet("/turma/administrador", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiTurmaListarComUsuario(opts = {}) {
  return apiGet("/turma/com-usuario", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiTurmaObter(turmaId, opts = {}) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiGet(`/turma/${turmaId}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiTurmaCriar(payload, opts = {}) {
  return apiPost("/turma", payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiTurmaAtualizar(turmaId, payload, opts = {}) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiPut(`/turma/${turmaId}`, payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiTurmaExcluir(turmaId, opts = {}) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiDelete(`/turma/${turmaId}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiTurmaDatas(turmaId, opts = {}) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiGet(`/turma/${turmaId}/data`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiTurmaOcorrencias(turmaId, opts = {}) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiGet(`/turma/${turmaId}/ocorrencia`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiTurmaDetalhe(turmaId, opts = {}) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiGet(`/turma/${turmaId}/detalhe`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiTurmaListarOrganizadores(turmaId, opts = {}) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiGet(`/turma/${turmaId}/organizador`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiTurmaAdicionarOrganizador(turmaId, organizadores, opts = {}) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiPost(
    `/turma/${turmaId}/organizador`,
    { organizadores },
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

/* ─────────────────────────────────────────────────────────────
   Inscrição — contrato oficial
────────────────────────────────────────────────────────────── */

export async function apiInscricaoMinhas(opts = {}) {
  return apiGet("/inscricao/minha", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiInscricaoListarPorTurma(turmaId, opts = {}) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiGet(`/inscricao/turma/${turmaId}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiInscricaoCriar(turmaId, opts = {}) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiPost(
    "/inscricao",
    { turma_id: Number(turmaId) },
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

export async function apiInscricaoCancelar(inscricaoId, opts = {}) {
  if (!inscricaoId) throw new Error("inscricao_id é obrigatório.");

  return apiDelete(`/inscricao/${inscricaoId}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiInscricaoCancelarMinhaPorTurma(turmaId, opts = {}) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiDelete(`/inscricao/minha/turma/${turmaId}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiInscricaoCancelarUsuarioNaTurma(
  turmaId,
  usuarioId,
  opts = {}
) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");
  if (!usuarioId) throw new Error("usuario_id é obrigatório.");

  return apiDelete(`/inscricao/turma/${turmaId}/usuario/${usuarioId}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiInscricaoConflito(turmaId, opts = {}) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiGet(`/inscricao/conflito/${turmaId}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

/* ─────────────────────────────────────────────────────────────
   Avaliação — contrato oficial
────────────────────────────────────────────────────────────── */

export async function apiAvaliacaoListarPorTurma(turmaId, opts = {}) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiGet(`/avaliacao/turma/${turmaId}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiAvaliacaoDisponiveis(opts = {}) {
  return apiGet("/avaliacao/disponivel", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiQuestionarioDisponiveis(opts = {}) {
  return apiGet("/questionario/disponivel", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiQuestionarioIniciar(
  { questionario_id, turma_id } = {},
  opts = {}
) {
  if (!questionario_id) throw new Error("questionario_id é obrigatório.");
  if (!turma_id) throw new Error("turma_id é obrigatório.");

  return apiPost(
    `/questionario/${questionario_id}/iniciar/turma/${turma_id}`,
    {},
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

export async function apiQuestionarioResponder(
  { questionario_id, turma_id } = {},
  opts = {}
) {
  if (!questionario_id) throw new Error("questionario_id é obrigatório.");
  if (!turma_id) throw new Error("turma_id é obrigatório.");

  return apiGet(`/questionario/${questionario_id}/responder/turma/${turma_id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiQuestionarioEnviar(
  { questionario_id, turma_id, respostas } = {},
  opts = {}
) {
  if (!questionario_id) throw new Error("questionario_id é obrigatório.");
  if (!turma_id) throw new Error("turma_id é obrigatório.");

  return apiPost(
    `/questionario/${questionario_id}/enviar/turma/${turma_id}`,
    { respostas: Array.isArray(respostas) ? respostas : [] },
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

/* ─────────────────────────────────────────────────────────────
   Presença — contrato oficial
────────────────────────────────────────────────────────────── */

export async function apiPresencaValidarPublico({
  evento_id,
  usuario_id,
  data_presenca,
} = {}) {
  return apiGetPublic("/presenca/validar", {
    query: {
      evento_id,
      usuario_id,
      data_presenca,
    },
    on401: "silent",
  });
}

export async function apiPresencaMinhas(opts = {}) {
  return apiGet("/presenca/minha", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPresencaMinhaResumo(opts = {}) {
  return apiGet("/presenca/minha/resumo", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPresencaRegistrar(payload = {}, opts = {}) {
  return apiPost("/presenca", payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPresencaConfirmarQr(turmaId, opts = {}) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiPost(
    "/presenca/qr",
    { turma_id: Number(turmaId) },
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

export async function apiPresencaConfirmarToken(token, opts = {}) {
  const tokenSeguro = String(token || "").trim();

  if (!tokenSeguro) throw new Error("token é obrigatório.");

  return apiPost(
    "/presenca/token",
    { token: tokenSeguro },
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

export async function apiPresencaTurmasorganizador(opts = {}) {
  return apiGet("/presenca/organizador/turma", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPresencaTurmaDetalhe(turmaId, opts = {}) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiGet(`/presenca/turma/${turmaId}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPresencaDetalhesTurma(turmaId, opts = {}) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiGet(`/presenca/turma/${turmaId}/detalhes`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPresencaTurmaFrequencia(turmaId, opts = {}) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiGet(`/presenca/turma/${turmaId}/frequencia`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPresencasTurmaPDF(turmaId, opts = {}) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiGetFile(`/presenca/turma/${turmaId}/pdf`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPresencaRegistrarManual(payload = {}, opts = {}) {
  return apiPost("/presenca/manual", payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPresencaConfirmarManualHoje(payload = {}, opts = {}) {
  return apiPost("/presenca/manual/hoje", payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPresencaValidarManual(payload = {}, opts = {}) {
  return apiPut("/presenca/manual/validar", payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPresencaConfirmarorganizador(payload = {}, opts = {}) {
  return apiPost("/presenca/organizador/confirmar", payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPresencaAdministrador(opts = {}) {
  return apiGet("/presenca/administrador", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

/* ─────────────────────────────────────────────────────────────
   Assinatura — contrato oficial singular
────────────────────────────────────────────────────────────── */

export async function apiAssinaturaObter(opts = {}) {
  return apiGet("/assinatura", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    suppressGlobalError: true,
    ...opts,
  });
}

export async function apiAssinaturaSalvar(payload, opts = {}) {
  return apiPost("/assinatura", payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiAssinaturaAuto(opts = {}) {
  return apiPost(
    "/assinatura/auto",
    {},
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      suppressGlobalError: true,
      ...opts,
    }
  );
}

export async function apiAssinaturaListar(opts = {}) {
  return apiGet("/assinatura/lista", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

/* ─────────────────────────────────────────────────────────────
   Certificado — contrato oficial
────────────────────────────────────────────────────────────── */

export async function apiCertAvulsoListar(params = {}, opts = {}) {
  return apiGet("/certificado/admin/avulso", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCertAvulsoCriar(payload = {}, opts = {}) {
  return apiPost("/certificado/admin/avulso", payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCertAvulsoPDF(id, { assinantes_ids } = {}, opts = {}) {
  if (!id) throw new Error("ID do certificado é obrigatório.");

  return apiGetFile(`/certificado/admin/avulso/${id}/pdf`, {
    query: {
      ...(assinantes_ids ? { assinantes_ids } : {}),
    },
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCertAvulsoEnviar(id, { assinantes_ids } = {}, opts = {}) {
  if (!id) throw new Error("ID do certificado é obrigatório.");

  return apiPost(
    `/certificado/admin/avulso/${id}/enviar`,
    {
      ...(assinantes_ids ? { assinantes_ids } : {}),
    },
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

export async function apiCertificadoAdminArvore(params = {}, opts = {}) {
  return apiGet("/certificado/admin/arvore", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCertificadoProcessarPendentesPorTurma(
  turmaId,
  opts = {}
) {
  if (!turmaId) throw new Error("turma_id é obrigatório.");

  return apiPost(
    `/certificado/admin/turma/${turmaId}/processar-pendentes`,
    {},
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

export async function apiCertificadoDownload(certificadoId, opts = {}) {
  if (!certificadoId) throw new Error("certificado_id é obrigatório.");

  return apiGetFile(`/certificado/${certificadoId}/download`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCertificadoElegivel(opts = {}) {
  return apiGet("/certificado/meus", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCertificadoGerar(payload = {}, opts = {}) {
  return apiPost("/certificado/gerar", payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCertificadoValidarPublico(codigoValidacao, opts = {}) {
  const codigo = String(codigoValidacao || "").trim();

  if (!codigo) throw new Error("codigo_validacao é obrigatório.");

  return apiGetPublic(`/certificado/validar/${encodeURIComponent(codigo)}`, {
    on401: "silent",
    on403: "silent",
    ...opts,
  });
}

/* ─────────────────────────────────────────────────────────────
   Calendário Anual de EPS — contrato oficial v2.0
────────────────────────────────────────────────────────────── */

export async function apiCalendarioEPSListar(params = {}, opts = {}) {
  return apiGet("/calendario-eps", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCalendarioEPSDepartamentos(opts = {}) {
  return apiGet("/calendario-eps/departamentos", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCalendarioEPSTipos(opts = {}) {
  return apiGet("/calendario-eps/tipos", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCalendarioEPSResumoMensal(
  { ano, mes } = {},
  opts = {}
) {
  if (!ano) throw new Error("ano é obrigatório.");
  if (!mes) throw new Error("mes é obrigatório.");

  return apiGet("/calendario-eps/resumo-mensal", {
    auth: true,
    query: {
      ano,
      mes,
    },
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCalendarioEPSResumoAnual({ ano } = {}, opts = {}) {
  if (!ano) throw new Error("ano é obrigatório.");

  return apiGet("/calendario-eps/resumo-anual", {
    auth: true,
    query: {
      ano,
    },
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCalendarioEPSCriar(payload = {}, opts = {}) {
  return apiPost("/calendario-eps", payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCalendarioEPSAtualizar(id, payload = {}, opts = {}) {
  if (!id) throw new Error("id da programação de EPS é obrigatório.");

  return apiPut(`/calendario-eps/${id}`, payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCalendarioEPSExcluir(id, opts = {}) {
  if (!id) throw new Error("id da programação de EPS é obrigatório.");

  return apiDelete(`/calendario-eps/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

/* ─────────────────────────────────────────────────────────────
   Cursos Online — contrato oficial v2.0
────────────────────────────────────────────────────────────── */

export async function apiCursoOnlineListarPublicados(params = {}, opts = {}) {
  return apiGet("/curso-online/publicado", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCursoOnlineObter(id, opts = {}) {
  if (!id) throw new Error("id do curso online é obrigatório.");

  return apiGet(`/curso-online/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCursoOnlineListarAdmin(params = {}, opts = {}) {
  return apiGet("/curso-online/admin", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCursoOnlineCriar(payload = {}, opts = {}) {
  return apiPost("/curso-online/admin", payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCursoOnlineAtualizar(id, payload = {}, opts = {}) {
  if (!id) throw new Error("id do curso online é obrigatório.");

  return apiPut(`/curso-online/admin/${id}`, payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiCursoOnlineAlterarStatus(id, status, opts = {}) {
  if (!id) throw new Error("id do curso online é obrigatório.");
  if (!status) throw new Error("status do curso online é obrigatório.");

  return apiPatch(
    `/curso-online/admin/${id}/status`,
    { status },
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

export async function apiCursoOnlineExcluir(id, opts = {}) {
  if (!id) throw new Error("id do curso online é obrigatório.");

  return apiDelete(`/curso-online/admin/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

/* ─────────────────────────────────────────────────────────────
   Pesquisas — contrato oficial v2.0
────────────────────────────────────────────────────────────── */

export async function apiPesquisaListarPublicadas(params = {}, opts = {}) {
  return apiGet("/pesquisa/publicada", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPesquisaObter(id, opts = {}) {
  if (!id) throw new Error("id da pesquisa é obrigatório.");

  return apiGet(`/pesquisa/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPesquisaResponder(id, payload = {}, opts = {}) {
  if (!id) throw new Error("id da pesquisa é obrigatório.");

  return apiPost(`/pesquisa/${id}/responder`, payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPesquisaListarAdmin(params = {}, opts = {}) {
  return apiGet("/pesquisa/admin", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPesquisaCriar(payload = {}, opts = {}) {
  return apiPost("/pesquisa/admin", payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPesquisaObterAdmin(id, opts = {}) {
  if (!id) throw new Error("id da pesquisa é obrigatório.");

  return apiGet(`/pesquisa/admin/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPesquisaAtualizar(id, payload = {}, opts = {}) {
  if (!id) throw new Error("id da pesquisa é obrigatório.");

  return apiPut(`/pesquisa/admin/${id}`, payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPesquisaAlterarStatus(id, status, opts = {}) {
  if (!id) throw new Error("id da pesquisa é obrigatório.");
  if (!status) throw new Error("status da pesquisa é obrigatório.");

  return apiPatch(
    `/pesquisa/admin/${id}/status`,
    { status },
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

export async function apiPesquisaRespostas(id, opts = {}) {
  if (!id) throw new Error("id da pesquisa é obrigatório.");

  return apiGet(`/pesquisa/admin/${id}/resposta`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPesquisaResultado(id, opts = {}) {
  if (!id) throw new Error("id da pesquisa é obrigatório.");

  return apiGet(`/pesquisa/admin/${id}/resultado`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPesquisaExcluir(id, opts = {}) {
  if (!id) throw new Error("id da pesquisa é obrigatório.");

  return apiDelete(`/pesquisa/admin/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

/* ─────────────────────────────────────────────────────────────
   Interações — contrato oficial v2.0
────────────────────────────────────────────────────────────── */

export async function apiInteracaoListarPublicadas(params = {}, opts = {}) {
  return apiGet("/interacao/publicada", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiInteracaoObter(id, opts = {}) {
  if (!id) throw new Error("id da interação é obrigatório.");

  return apiGet(`/interacao/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiInteracaoResponder(id, payload = {}, opts = {}) {
  if (!id) throw new Error("id da interação é obrigatório.");

  return apiPost(`/interacao/${id}/responder`, payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiInteracaoListarAdmin(params = {}, opts = {}) {
  return apiGet("/interacao/admin", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiInteracaoCriar(payload = {}, opts = {}) {
  return apiPost("/interacao/admin", payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiInteracaoObterAdmin(id, opts = {}) {
  if (!id) throw new Error("id da interação é obrigatório.");

  return apiGet(`/interacao/admin/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiInteracaoAtualizar(id, payload = {}, opts = {}) {
  if (!id) throw new Error("id da interação é obrigatório.");

  return apiPut(`/interacao/admin/${id}`, payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiInteracaoAlterarStatus(id, status, opts = {}) {
  if (!id) throw new Error("id da interação é obrigatório.");
  if (!status) throw new Error("status da interação é obrigatório.");

  return apiPatch(
    `/interacao/admin/${id}/status`,
    { status },
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

export async function apiInteracaoExcluir(id, opts = {}) {
  if (!id) throw new Error("id da interação é obrigatório.");

  return apiDelete(`/interacao/admin/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiInteracaoIniciarExecucao(id, opts = {}) {
  if (!id) throw new Error("id da interação é obrigatório.");

  return apiPost(
    `/interacao/admin/${id}/execucao/iniciar`,
    {},
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

export async function apiInteracaoAbrirPergunta(id, perguntaId, opts = {}) {
  if (!id) throw new Error("id da interação é obrigatório.");
  if (!perguntaId) throw new Error("pergunta_id é obrigatório.");

  return apiPost(
    `/interacao/admin/${id}/pergunta/abrir`,
    { pergunta_id: Number(perguntaId) },
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

export async function apiInteracaoFecharPergunta(id, perguntaId, opts = {}) {
  if (!id) throw new Error("id da interação é obrigatório.");
  if (!perguntaId) throw new Error("pergunta_id é obrigatório.");

  return apiPost(
    `/interacao/admin/${id}/pergunta/fechar`,
    { pergunta_id: Number(perguntaId) },
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

export async function apiInteracaoExibirGabarito(id, perguntaId, opts = {}) {
  if (!id) throw new Error("id da interação é obrigatório.");
  if (!perguntaId) throw new Error("pergunta_id é obrigatório.");

  return apiPost(
    `/interacao/admin/${id}/pergunta/gabarito`,
    { pergunta_id: Number(perguntaId) },
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

export async function apiInteracaoResultado(id, opts = {}) {
  if (!id) throw new Error("id da interação é obrigatório.");

  return apiGet(`/interacao/admin/${id}/resultado`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiInteracaoApresentacao(id, opts = {}) {
  if (!id) throw new Error("id da interação é obrigatório.");

  return apiGet(`/interacao/admin/${id}/resultado`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

/* ─────────────────────────────────────────────────────────────
   Auditoria — contrato oficial v2.0
────────────────────────────────────────────────────────────── */

export async function apiAuditoriaListar(params = {}, opts = {}) {
  return apiGet("/auditoria", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiAuditoriaResumo(params = {}, opts = {}) {
  return apiGet("/auditoria/resumo", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiAuditoriaObterPorId(id, opts = {}) {
  if (!id) throw new Error("id do evento de auditoria é obrigatório.");

  return apiGet(`/auditoria/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

/* ─────────────────────────────────────────────────────────────
   Caixa de Mensagens Institucional — contrato oficial v2.0
────────────────────────────────────────────────────────────── */

export async function apiMensagemMinhas(params = {}, opts = {}) {
  return apiGet("/mensagem/minhas", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiMensagemCriar(payload = {}, opts = {}) {
  return apiPost("/mensagem", payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiMensagemObterUsuario(id, opts = {}) {
  if (!id) throw new Error("id da conversa é obrigatório.");

  return apiGet(`/mensagem/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiMensagemResponderUsuario(id, payload = {}, opts = {}) {
  if (!id) throw new Error("id da conversa é obrigatório.");

  return apiPost(`/mensagem/${id}/resposta`, payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiMensagemListarAdmin(params = {}, opts = {}) {
  return apiGet("/mensagem/admin", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiMensagemResumoAdmin(params = {}, opts = {}) {
  return apiGet("/mensagem/admin/resumo", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiMensagemObterAdmin(id, opts = {}) {
  if (!id) throw new Error("id da conversa é obrigatório.");

  return apiGet(`/mensagem/admin/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiMensagemResponderAdmin(id, payload = {}, opts = {}) {
  if (!id) throw new Error("id da conversa é obrigatório.");

  return apiPost(`/mensagem/admin/${id}/resposta`, payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiMensagemAlterarStatus(id, status, opts = {}) {
  if (!id) throw new Error("id da conversa é obrigatório.");
  if (!status) throw new Error("status da conversa é obrigatório.");

  return apiPatch(
    `/mensagem/admin/${id}/status`,
    { status },
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

export async function apiMensagemAtribuir(id, atribuido_para, opts = {}) {
  if (!id) throw new Error("id da conversa é obrigatório.");

  return apiPatch(
    `/mensagem/admin/${id}/atribuir`,
    { atribuido_para },
    {
      auth: true,
      on401: "redirect",
      on403: "silent",
      ...opts,
    }
  );
}

/* ─────────────────────────────────────────────────────────────
   Pendências Administrativas — contrato oficial v2.0
────────────────────────────────────────────────────────────── */

export async function apiPendenciaListar(params = {}, opts = {}) {
  return apiGet("/pendencia", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPendenciaResumo(params = {}, opts = {}) {
  return apiGet("/pendencia/resumo", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiPendenciaObterPorId(pendenciaId, opts = {}) {
  if (!pendenciaId) throw new Error("pendencia_id é obrigatório.");

  return apiGet(`/pendencia/${encodeURIComponent(pendenciaId)}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

/* ─────────────────────────────────────────────────────────────
   Saúde da Plataforma — contrato oficial v2.0
────────────────────────────────────────────────────────────── */

export async function apiSaudePlataformaListar(params = {}, opts = {}) {
  return apiGet("/saude-plataforma", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiSaudePlataformaResumo(params = {}, opts = {}) {
  return apiGet("/saude-plataforma/resumo", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiSaudePlataformaDiagnostico(opts = {}) {
  return apiGet("/saude-plataforma/diagnostico", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiSaudePlataformaObterPorId(indicadorId, opts = {}) {
  if (!indicadorId) throw new Error("indicador_id é obrigatório.");

  return apiGet(`/saude-plataforma/${encodeURIComponent(indicadorId)}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

/* ─────────────────────────────────────────────────────────────
   Suporte — contrato oficial v2.0
────────────────────────────────────────────────────────────── */

export async function apiSuporteResumo(opts = {}) {
  return apiGet("/suporte/resumo", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiSuporteMinhaSessaoAtiva(opts = {}) {
  return apiGet("/suporte/minha-sessao-ativa", {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiSuporteIniciarSessao(payload = {}, opts = {}) {
  return apiPost("/suporte/sessao", payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiSuporteListarSessoes(params = {}, opts = {}) {
  return apiGet("/suporte/sessao", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiSuporteObterSessao(id, opts = {}) {
  if (!id) throw new Error("id da sessão de suporte é obrigatório.");

  return apiGet(`/suporte/sessao/${id}`, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiSuporteEncerrarSessao(id, payload = {}, opts = {}) {
  if (!id) throw new Error("id da sessão de suporte é obrigatório.");

  return apiPatch(`/suporte/sessao/${id}/encerrar`, payload, {
    auth: true,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

/* ─────────────────────────────────────────────────────────────
   Relatório — contrato oficial v2.0
────────────────────────────────────────────────────────────── */

export async function apiRelatorioResumoGeral(params = {}, opts = {}) {
  return apiGet("/relatorio/resumo-geral", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiRelatorioEventos(params = {}, opts = {}) {
  return apiGet("/relatorio/eventos", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiRelatorioPresencas(params = {}, opts = {}) {
  return apiGet("/relatorio/presencas", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiRelatorioAvaliacoes(params = {}, opts = {}) {
  return apiGet("/relatorio/avaliacoes", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiRelatorioorganizadores(params = {}, opts = {}) {
  return apiGet("/relatorio/organizadores", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiRelatorioCertificados(params = {}, opts = {}) {
  return apiGet("/relatorio/certificados", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiRelatorioCertificadosPendencias(
  params = {},
  opts = {}
) {
  return apiGet("/relatorio/certificados/pendencias", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiRelatorioUsuarios(params = {}, opts = {}) {
  return apiGet("/relatorio/usuarios", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiRelatorioSalas(params = {}, opts = {}) {
  return apiGet("/relatorio/salas", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiRelatorioNotificacoes(params = {}, opts = {}) {
  return apiGet("/relatorio/notificacoes", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiRelatorioSaudePlataforma(params = {}, opts = {}) {
  return apiGet("/relatorio/saude-plataforma", {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

export async function apiRelatorioExportarXlsx(tipo, params = {}, opts = {}) {
  const safeTipo = String(tipo || "").trim();

  if (!safeTipo) throw new Error("tipo de relatório é obrigatório.");

  return apiGetFile(`/relatorio/exportar/${safeTipo}.xlsx`, {
    auth: true,
    query: params,
    on401: "redirect",
    on403: "silent",
    ...opts,
  });
}

/* ─────────────────────────────────────────────────────────────
   Submissão / chamada — contrato oficial singular
────────────────────────────────────────────────────────────── */

export const apiUploadPoster = (submissaoId, fileOrFormData, opts = {}) => {
  if (!submissaoId) throw new Error("submissaoId é obrigatório.");

  return apiUpload(`/submissao/${submissaoId}/poster`, fileOrFormData, {
    ...opts,
    fieldName: "poster",
  });
};

export async function apiChamadaModeloExists(chamadaId) {
  if (!chamadaId && chamadaId !== 0) {
    throw new Error("chamadaId é obrigatório.");
  }

  const idNum = Number(chamadaId);

  if (!Number.isFinite(idNum)) {
    throw new Error("chamadaId inválido.");
  }

  return apiHead(`/chamada/${chamadaId}/modelo-banner`, {
    auth: true,
    on401: "silent",
    on403: "silent",
  });
}

export async function apiChamadaModeloDownload(chamadaId) {
  if (!chamadaId && chamadaId !== 0) {
    throw new Error("chamadaId é obrigatório.");
  }

  const idNum = Number(chamadaId);

  if (!Number.isFinite(idNum)) {
    throw new Error("chamadaId inválido.");
  }

  return apiGetResponse(`/chamada/${chamadaId}/modelo-banner`, {
    auth: true,
    on401: "silent",
    on403: "silent",
  });
}

export async function apiChamadaModeloUpload(chamadaId, fileOrFormData) {
  if (!chamadaId && chamadaId !== 0) {
    throw new Error("chamadaId é obrigatório.");
  }

  const idNum = Number(chamadaId);

  if (!Number.isFinite(idNum)) {
    throw new Error("chamadaId inválido.");
  }

  const response = await apiUpload(
    `/chamada/${chamadaId}/modelo-banner`,
    fileOrFormData,
    {
      fieldName: "file",
    }
  );

  try {
    invalidateHeadPrefix(`/chamada/${chamadaId}/modelo-banner`);
  } catch {
    // noop
  }

  return response;
}

export async function apiChamadaModeloAdminMeta(chamadaId) {
  if (!chamadaId && chamadaId !== 0) {
    throw new Error("chamadaId é obrigatório.");
  }

  const idNum = Number(chamadaId);

  if (!Number.isFinite(idNum)) {
    throw new Error("chamadaId inválido.");
  }

  return apiGet(`/chamada/admin/${chamadaId}/modelo-banner`, {
    auth: true,
    on401: "silent",
    on403: "silent",
  });
}

/* ─────────────────────────────────────────────────────────────
   Facade estilo axios
────────────────────────────────────────────────────────────── */

export { API_BASE_URL, API_BASE_ROOT };

export const api = {
  defaults: {
    baseURL: API_BASE_ROOT,
  },

  get: (path, opts) => apiGet(path, opts),
  post: (path, body, opts) => apiPost(path, body, opts),
  put: (path, body, opts) => apiPut(path, body, opts),
  patch: (path, body, opts) => apiPatch(path, body, opts),
  delete: (path, opts) => apiDelete(path, opts),

request: ({ url, method = "GET", data, params, responseType, ...opts } = {}) => {
  if (!url) throw new Error("api.request: url é obrigatória.");

  if (responseType === "blob") {
    if (method && String(method).toUpperCase() !== "GET") {
      return apiPostFile(url, data, {
        query: params,
        ...opts,
      });
    }

    return apiGetFile(url, {
      query: params,
      ...opts,
    });
  }

  return doFetch(url, {
    method,
    body: data,
    query: params,
    ...opts,
  });
},

  upload: (path, formDataOrFile, opts) =>
    apiUpload(path, formDataOrFile, opts),

  uploadPoster: (submissaoId, fileOrFormData, opts) =>
    apiUploadPoster(submissaoId, fileOrFormData, opts),

  clearSession: () => clearAuthSession(),
  persistSession: (token, usuario) => persistAuthSession(token, usuario),
  authMe: (opts) => apiAuthMe(opts),

 auth: {
  login: (payload, opts) => apiAuthLogin(payload, opts),
  google: (payload, opts) => apiAuthGoogle(payload, opts),
  cadastrar: (payload, opts) => apiCadastrarUsuario(payload, opts),
  esqueciSenha: (payload, opts) => apiEsqueciSenha(payload, opts),
  redefinirSenha: (payload, opts) => apiRedefinirSenha(payload, opts),
  me: (opts) => apiPerfilMe(opts),
},

  perfil: {
    opcao: (opts) => apiPerfilOpcao(opts),
    me: (opts) => apiPerfilMe(opts),
    update: (payload, opts) => apiPerfilUpdate(payload, opts),
  },

  lookup: {
    cargo: (opts) => apiLookupCargo(opts),
    unidade: (opts) => apiLookupUnidade(opts),
    genero: (opts) => apiLookupGenero(opts),
    orientacaoSexual: (opts) => apiLookupOrientacaoSexual(opts),
    corRaca: (opts) => apiLookupCorRaca(opts),
    escolaridade: (opts) => apiLookupEscolaridade(opts),
    deficiencia: (opts) => apiLookupDeficiencia(opts),
  },

  usuario: {
    buscar: (params, opts) => apiUsuarioBuscar(params, opts),
    listar: (params, opts) => apiUsuarioListar(params, opts),
    obter: (id, opts) => apiUsuarioObter(id, opts),
    atualizarBasico: (id, payload, opts) =>
      apiUsuarioAtualizarBasico(id, payload, opts),
    atualizarPerfilInstitucional: (id, payload, opts) =>
      apiUsuarioAtualizarPerfilInstitucional(id, payload, opts),
    atualizarDadosAdministrativos: (id, payload, opts) =>
      apiUsuarioAtualizarDadosAdministrativos(id, payload, opts),
    atualizarPerfil: (id, payload, opts) =>
      apiUsuarioAtualizarPerfil(id, payload, opts),
    listarorganizador: (opts) => apiUsuarioListarorganizador(opts),
    listarAvaliador: (params, opts) => apiUsuarioListarAvaliador(params, opts),
    resumo: (id, opts) => apiUsuarioResumo(id, opts),
    estatistica: (opts) => apiUsuarioEstatistica(opts),
    estatisticaDetalhada: (opts) => apiUsuarioEstatisticaDetalhada(opts),
  },

  dashboard: {
    resumo: (opts) => apiDashboardResumo(opts),
    avaliacaoRecenteorganizador: (opts) =>
      apiDashboardAvaliacaoRecenteorganizador(opts),
    analitico: (params, opts) => apiDashboardAnalitico(params, opts),
  },

 organizador: {
  listar: (params, opts) => apiorganizadorListar(params, opts),
  eventosAvaliacao: (organizadorId, opts) =>
    apiorganizadorEventosAvaliacao(organizadorId, opts),
  turmas: (organizadorId, opts) => apiorganizadorTurmas(organizadorId, opts),
  minhasTurmas: (params, opts) => apiorganizadorMinhasTurmas(params, opts),
},

  informacao: {
    publicadaListar: (opts) => apiInformacaoPublicadaListar(opts),
  },

  notificacao: {
    listar: (params, opts) => apiNotificacaoListar(params, opts),
    resumo: (opts) => apiNotificacaoResumo(opts),
    marcarLida: (id, opts) => apiNotificacaoMarcarLida(id, opts),
    marcarTodasLidas: (opts) => apiNotificacaoMarcarTodasLidas(opts),
  },

  evento: {
    listarAdministrador: (params, opts) =>
      apiEventoListarAdministrador(params, opts),
    folderResponse: (eventoId, opts) =>
      apiEventoFolderResponse(eventoId, opts),
    programacaoResponse: (eventoId, opts) =>
      apiEventoProgramacaoResponse(eventoId, opts),
    programacaoFile: (eventoId, opts) =>
      apiEventoProgramacaoFile(eventoId, opts),
  },

  calendarioEPS: {
    listar: (params, opts) => apiCalendarioEPSListar(params, opts),
    departamentos: (opts) => apiCalendarioEPSDepartamentos(opts),
    tipos: (opts) => apiCalendarioEPSTipos(opts),
    resumoMensal: (params, opts) =>
      apiCalendarioEPSResumoMensal(params, opts),
    resumoAnual: (params, opts) =>
      apiCalendarioEPSResumoAnual(params, opts),
    criar: (payload, opts) => apiCalendarioEPSCriar(payload, opts),
    atualizar: (id, payload, opts) =>
      apiCalendarioEPSAtualizar(id, payload, opts),
    excluir: (id, opts) => apiCalendarioEPSExcluir(id, opts),
  },

    cursoOnline: {
    listarPublicados: (params, opts) =>
      apiCursoOnlineListarPublicados(params, opts),
    obter: (id, opts) => apiCursoOnlineObter(id, opts),
    listarAdmin: (params, opts) => apiCursoOnlineListarAdmin(params, opts),
    criar: (payload, opts) => apiCursoOnlineCriar(payload, opts),
    atualizar: (id, payload, opts) =>
      apiCursoOnlineAtualizar(id, payload, opts),
    alterarStatus: (id, status, opts) =>
      apiCursoOnlineAlterarStatus(id, status, opts),
    excluir: (id, opts) => apiCursoOnlineExcluir(id, opts),
  },

    pesquisa: {
    listarPublicadas: (params, opts) =>
      apiPesquisaListarPublicadas(params, opts),
    obter: (id, opts) => apiPesquisaObter(id, opts),
    responder: (id, payload, opts) => apiPesquisaResponder(id, payload, opts),

    listarAdmin: (params, opts) => apiPesquisaListarAdmin(params, opts),
    criar: (payload, opts) => apiPesquisaCriar(payload, opts),
    obterAdmin: (id, opts) => apiPesquisaObterAdmin(id, opts),
    atualizar: (id, payload, opts) =>
      apiPesquisaAtualizar(id, payload, opts),
    alterarStatus: (id, status, opts) =>
      apiPesquisaAlterarStatus(id, status, opts),
    respostas: (id, opts) => apiPesquisaRespostas(id, opts),
    resultado: (id, opts) => apiPesquisaResultado(id, opts),
    excluir: (id, opts) => apiPesquisaExcluir(id, opts),
  },

interacao: {
  listarPublicadas: (params, opts) =>
    apiInteracaoListarPublicadas(params, opts),
  obter: (id, opts) => apiInteracaoObter(id, opts),
  responder: (id, payload, opts) =>
    apiInteracaoResponder(id, payload, opts),

  listarAdmin: (params, opts) => apiInteracaoListarAdmin(params, opts),
  criar: (payload, opts) => apiInteracaoCriar(payload, opts),
  obterAdmin: (id, opts) => apiInteracaoObterAdmin(id, opts),
  adminObterPorId: (id, opts) => apiInteracaoObterAdmin(id, opts),
  obterPorId: (id, opts) => apiInteracaoObter(id, opts),
  atualizar: (id, payload, opts) =>
    apiInteracaoAtualizar(id, payload, opts),
  alterarStatus: (id, status, opts) =>
    apiInteracaoAlterarStatus(id, status, opts),
  excluir: (id, opts) => apiInteracaoExcluir(id, opts),

  iniciarExecucao: (id, opts) => apiInteracaoIniciarExecucao(id, opts),
  abrirPergunta: (id, perguntaId, opts) =>
    apiInteracaoAbrirPergunta(id, perguntaId, opts),
  fecharPergunta: (id, perguntaId, opts) =>
    apiInteracaoFecharPergunta(id, perguntaId, opts),
  exibirGabarito: (id, perguntaId, opts) =>
    apiInteracaoExibirGabarito(id, perguntaId, opts),
  resultado: (id, opts) => apiInteracaoResultado(id, opts),
  resultadoAdmin: (id, opts) => apiInteracaoResultado(id, opts),
  apresentacao: (id, opts) => apiInteracaoApresentacao(id, opts),
},

auditoria: {
  listar: (params, opts) => apiAuditoriaListar(params, opts),
  resumo: (params, opts) => apiAuditoriaResumo(params, opts),
  obterPorId: (id, opts) => apiAuditoriaObterPorId(id, opts),
},

mensagem: {
  minhas: (params, opts) => apiMensagemMinhas(params, opts),
  criar: (payload, opts) => apiMensagemCriar(payload, opts),
  obterUsuario: (id, opts) => apiMensagemObterUsuario(id, opts),
  responderUsuario: (id, payload, opts) =>
    apiMensagemResponderUsuario(id, payload, opts),

  listarAdmin: (params, opts) => apiMensagemListarAdmin(params, opts),
  resumoAdmin: (params, opts) => apiMensagemResumoAdmin(params, opts),
  obterAdmin: (id, opts) => apiMensagemObterAdmin(id, opts),
  responderAdmin: (id, payload, opts) =>
    apiMensagemResponderAdmin(id, payload, opts),
  alterarStatus: (id, status, opts) =>
    apiMensagemAlterarStatus(id, status, opts),
  atribuir: (id, atribuido_para, opts) =>
    apiMensagemAtribuir(id, atribuido_para, opts),
},

pendencia: {
  listar: (params, opts) => apiPendenciaListar(params, opts),
  resumo: (params, opts) => apiPendenciaResumo(params, opts),
  obterPorId: (pendenciaId, opts) =>
    apiPendenciaObterPorId(pendenciaId, opts),
},

saudePlataforma: {
  listar: (params, opts) => apiSaudePlataformaListar(params, opts),
  resumo: (params, opts) => apiSaudePlataformaResumo(params, opts),
  diagnostico: (opts) => apiSaudePlataformaDiagnostico(opts),
  obterPorId: (indicadorId, opts) =>
    apiSaudePlataformaObterPorId(indicadorId, opts),
},

suporte: {
  resumo: (opts) => apiSuporteResumo(opts),
  minhaSessaoAtiva: (opts) => apiSuporteMinhaSessaoAtiva(opts),
  iniciarSessao: (payload, opts) => apiSuporteIniciarSessao(payload, opts),
  listarSessoes: (params, opts) => apiSuporteListarSessoes(params, opts),
  obterSessao: (id, opts) => apiSuporteObterSessao(id, opts),
  encerrarSessao: (id, payload, opts) =>
    apiSuporteEncerrarSessao(id, payload, opts),
},

turma: {
  listarAdministrador: (opts) => apiTurmaListarAdministrador(opts),
  listarComUsuario: (opts) => apiTurmaListarComUsuario(opts),

  listarPorEvento: (eventoId, opts) =>
    apiTurmaListarPorEvento(eventoId, opts),
  listarPorEventoSimples: (eventoId, opts) =>
    apiTurmaListarPorEventoSimples(eventoId, opts),

  obter: (turmaId, opts) => apiTurmaObter(turmaId, opts),
  criar: (payload, opts) => apiTurmaCriar(payload, opts),
  atualizar: (turmaId, payload, opts) =>
    apiTurmaAtualizar(turmaId, payload, opts),
  excluir: (turmaId, opts) => apiTurmaExcluir(turmaId, opts),

  datas: (turmaId, opts) => apiTurmaDatas(turmaId, opts),
  datasAuto: (turmaId, opts) => apiTurmaDatas(turmaId, opts),
  ocorrencias: (turmaId, opts) => apiTurmaOcorrencias(turmaId, opts),
  detalhe: (turmaId, opts) => apiTurmaDetalhe(turmaId, opts),

  listarOrganizadores: (turmaId, opts) =>
    apiTurmaListarOrganizadores(turmaId, opts),
  adicionarOrganizador: (turmaId, organizadores, opts) =>
    apiTurmaAdicionarOrganizador(turmaId, organizadores, opts),
},

inscricao: {
  minhas: (opts) => apiInscricaoMinhas(opts),
  listarPorTurma: (turmaId, opts) =>
    apiInscricaoListarPorTurma(turmaId, opts),
  porTurma: (turmaId, opts) => apiInscricaoListarPorTurma(turmaId, opts),
  criar: (turmaId, opts) => apiInscricaoCriar(turmaId, opts),
  cancelar: (inscricaoId, opts) => apiInscricaoCancelar(inscricaoId, opts),
  cancelarMinhaPorTurma: (turmaId, opts) =>
    apiInscricaoCancelarMinhaPorTurma(turmaId, opts),
  cancelarUsuarioNaTurma: (turmaId, usuarioId, opts) =>
    apiInscricaoCancelarUsuarioNaTurma(turmaId, usuarioId, opts),
  conflito: (turmaId, opts) => apiInscricaoConflito(turmaId, opts),
},

avaliacao: {
  enviar: (payload) => apiPost("/avaliacao", payload),

  listarPorTurma: (turmaId, opts) =>
    apiAvaliacaoListarPorTurma(turmaId, opts),

  porTurma: (turmaId, opts) => apiAvaliacaoListarPorTurma(turmaId, opts),

  disponiveis: apiAvaliacaoDisponiveis,
},

questionario: {
  disponiveis: apiQuestionarioDisponiveis,
  iniciar: apiQuestionarioIniciar,
  responder: apiQuestionarioResponder,
  enviar: apiQuestionarioEnviar,
},

presenca: {
  validarPublico: (params, opts) => apiPresencaValidarPublico(params, opts),
  minhas: (opts) => apiPresencaMinhas(opts),
  minhaResumo: (opts) => apiPresencaMinhaResumo(opts),
  registrar: (payload, opts) => apiPresencaRegistrar(payload, opts),
  confirmarQr: (turmaId, opts) => apiPresencaConfirmarQr(turmaId, opts),
  confirmarToken: (token, opts) => apiPresencaConfirmarToken(token, opts),
  turmasorganizador: (opts) => apiPresencaTurmasorganizador(opts),
  turmaDetalhe: (turmaId, opts) => apiPresencaTurmaDetalhe(turmaId, opts),
  detalhesTurma: (turmaId, opts) => apiPresencaDetalhesTurma(turmaId, opts),
  turmaFrequencia: (turmaId, opts) =>
    apiPresencaTurmaFrequencia(turmaId, opts),
  turmaPdf: (turmaId, opts) => apiPresencasTurmaPDF(turmaId, opts),
  registrarManual: (payload, opts) => apiPresencaRegistrarManual(payload, opts),
  confirmarManualHoje: (payload, opts) =>
    apiPresencaConfirmarManualHoje(payload, opts),
  validarManual: (payload, opts) => apiPresencaValidarManual(payload, opts),
  confirmarorganizador: (payload, opts) =>
    apiPresencaConfirmarorganizador(payload, opts),
  administrador: (opts) => apiPresencaAdministrador(opts),
},

assinatura: {
  obter: (opts) => apiAssinaturaObter(opts),
  minha: (opts) => apiAssinaturaObter(opts),
  salvar: (payload, opts) => apiAssinaturaSalvar(payload, opts),
  auto: (opts) => apiAssinaturaAuto(opts),
  listar: (opts) => apiAssinaturaListar(opts),
},

certificado: {
  avulsoPdf: (id, opts) => apiCertAvulsoPDF(id, opts),
  adminArvore: (params, opts) => apiCertificadoAdminArvore(params, opts),
  processarPendentesPorTurma: (turmaId, opts) =>
    apiCertificadoProcessarPendentesPorTurma(turmaId, opts),
  download: (certificadoId, opts) =>
    apiCertificadoDownload(certificadoId, opts),
  elegivel: apiCertificadoElegivel,
  gerar: apiCertificadoGerar,
  validarPublico: (codigoValidacao, opts) =>
    apiCertificadoValidarPublico(codigoValidacao, opts),
},

certificadoAvulso: {
  listar: (params, opts) => apiCertAvulsoListar(params, opts),
  criar: (payload, opts) => apiCertAvulsoCriar(payload, opts),
  pdf: (id, params, opts) => apiCertAvulsoPDF(id, params, opts),
  enviar: (id, params, opts) => apiCertAvulsoEnviar(id, params, opts),
},

relatorio: {
  resumoGeral: (params, opts) => apiRelatorioResumoGeral(params, opts),
  eventos: (params, opts) => apiRelatorioEventos(params, opts),
  presencas: (params, opts) => apiRelatorioPresencas(params, opts),
  avaliacoes: (params, opts) => apiRelatorioAvaliacoes(params, opts),
  organizadores: (params, opts) => apiRelatorioorganizadores(params, opts),
  certificados: (params, opts) => apiRelatorioCertificados(params, opts),
  certificadosPendencias: (params, opts) =>
    apiRelatorioCertificadosPendencias(params, opts),
  usuarios: (params, opts) => apiRelatorioUsuarios(params, opts),
  salas: (params, opts) => apiRelatorioSalas(params, opts),
  notificacoes: (params, opts) => apiRelatorioNotificacoes(params, opts),
  saudePlataforma: (params, opts) =>
    apiRelatorioSaudePlataforma(params, opts),
  exportarXlsx: (tipo, params, opts) =>
    apiRelatorioExportarXlsx(tipo, params, opts),
},

  chamadaModelo: {
    exists: (id) => apiChamadaModeloExists(id),
    download: (id) => apiChamadaModeloDownload(id),
    upload: (id, fileOrFormData) => apiChamadaModeloUpload(id, fileOrFormData),
    adminMeta: (id) => apiChamadaModeloAdminMeta(id),
  },
};

export default api;