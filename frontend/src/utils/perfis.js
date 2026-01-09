// 📁 src/utils/perfis.js
// Utilidades para leitura e validação de perfis do usuário no localStorage.
// - Resiliente a formatos variados (string CSV, array, objeto usuario.perfil/perfis)
// - SSR-safe (não quebra fora do browser)
// - Deduplica, normaliza e cacheia em memória (invalida no evento 'storage')
// - Mantém compat com getPerfisRobusto/ehAdmin/ehInstrutor

/* =========================
   Constantes e helpers
========================= */
const KEY_PERFIL = "perfil";
const KEY_USUARIO = "usuario";

// SSR-safe
function hasWindow() {
  return typeof window !== "undefined";
}
function hasStorage() {
  return hasWindow() && typeof window.localStorage !== "undefined";
}

// JSON.parse seguro
function parseJSONSafe(s) {
  try { return JSON.parse(s); } catch { return null; }
}

// Normaliza qualquer entrada para array lowercase sem ruído
function normalizarPerfis(input) {
  const push = (arr, val) => {
    if (val == null) return;
    const limp = String(val).replace(/[\[\]"]/g, "").trim().toLowerCase();
    if (limp) arr.push(limp);
  };

  if (Array.isArray(input)) {
    const out = [];
    input.forEach((p) => push(out, p));
    return out;
  }

  if (typeof input === "string") {
    return input
      .split(",")
      .map((p) => p.replace(/[\[\]"]/g, "").trim().toLowerCase())
      .filter(Boolean);
  }

  if (input && typeof input === "object" && "toString" in input) {
    const v = String(input).trim().toLowerCase();
    return v ? [v] : [];
  }

  return [];
}

// Leitura segura do LS
function lsGet(key) {
  if (!hasStorage()) return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

/* =========================
   Cache leve em memória
========================= */
let _cachePerfis = null;
function _fromCacheOr(fn) {
  if (_cachePerfis) return _cachePerfis.slice();
  const v = fn();
  _cachePerfis = v.slice();
  return v;
}
function _invalidateCache() { _cachePerfis = null; }

// Invalida cache quando outra aba alterar perfis/usuario
if (hasWindow()) {
  window.addEventListener?.("storage", (ev) => {
    if (ev?.key === KEY_PERFIL || ev?.key === KEY_USUARIO || ev?.key === null) {
      _invalidateCache();
    }
  });
}

/* =========================
   Núcleo de leitura
========================= */
/**
 * Lê os perfis do localStorage de forma robusta, aceitando:
 * - localStorage["perfil"] (string CSV | array JSON)
 * - localStorage["usuario"] com campos `perfil`/`perfis`
 * Sempre retorna array lowercase, sem duplicatas (mín. "usuario" se vazio).
 */
export function getPerfisRobusto() {
  return _fromCacheOr(() => {
    const out = new Set();

    // 1) Chave direta: "perfil"
    const rawPerfil = lsGet(KEY_PERFIL);
    if (rawPerfil != null) {
      const parsed = parseJSONSafe(rawPerfil);
      const itens = parsed == null ? normalizarPerfis(rawPerfil) : normalizarPerfis(parsed);
      itens.forEach((p) => out.add(p));
    }

    // 2) Objeto "usuario" → .perfil / .perfis
    const rawUsuario = lsGet(KEY_USUARIO);
    const u = rawUsuario ? parseJSONSafe(rawUsuario) : null;
    if (u && typeof u === "object") {
      if (u.perfil !== undefined) normalizarPerfis(u.perfil).forEach((p) => out.add(p));
      if (u.perfis !== undefined) normalizarPerfis(u.perfis).forEach((p) => out.add(p));
    }

    // 3) Fallback mínimo
    if (out.size === 0) out.add("usuario");

    return Array.from(out);
  });
}

// Alias curto (se preferir importar como getPerfis)
export const getPerfis = getPerfisRobusto;

/* =========================
   Predicados comuns
========================= */
export function ehAdmin(perfis = []) {
  return perfis.some((p) => String(p).toLowerCase() === "administrador");
}

export function ehInstrutor(perfis = []) {
  const lower = perfis.map((p) => String(p).toLowerCase());
  return lower.includes("instrutor") || lower.includes("administrador");
}

/**
 * Verifica se o usuário possui um perfil específico (case-insensitive).
 * @param {string} perfilAlvo
 * @param {string[]} [perfis=getPerfisRobusto()]
 */
export function temPerfil(perfilAlvo, perfis = null) {
  if (!perfilAlvo) return false;
  const alvo = String(perfilAlvo).toLowerCase().trim();
  const arr = Array.isArray(perfis) ? perfis : getPerfisRobusto();
  return arr.some((p) => p === alvo);
}

/**
 * Verifica se possui QUALQUER perfil dentre a lista.
 * @param {string[]} lista
 * @param {string[]} [perfis=getPerfisRobusto()]
 */
export function hasAnyPerfil(lista = [], perfis = null) {
  if (!Array.isArray(lista) || lista.length === 0) return false;
  const alvo = new Set(lista.map((x) => String(x).toLowerCase().trim()).filter(Boolean));
  if (alvo.size === 0) return false;
  const arr = Array.isArray(perfis) ? perfis : getPerfisRobusto();
  return arr.some((p) => alvo.has(p));
}

/**
 * Verifica se possui TODOS os perfis requeridos.
 * @param {string[]} lista
 * @param {string[]} [perfis=getPerfisRobusto()]
 */
export function hasAllPerfis(lista = [], perfis = null) {
  if (!Array.isArray(lista) || lista.length === 0) return true;
  const alvo = lista.map((x) => String(x).toLowerCase().trim()).filter(Boolean);
  const arr = Array.isArray(perfis) ? perfis : getPerfisRobusto();
  const s = new Set(arr);
  return alvo.every((p) => s.has(p));
}

/* =========================
   Utilidades opcionais
========================= */
/**
 * Persiste perfis no localStorage de forma padronizada (array).
 * ⚠️ Não altera o objeto "usuario" — apenas a chave "perfil".
 */
export function salvarPerfis(perfis = []) {
  if (!hasStorage()) return;
  const arr = normalizarPerfis(perfis);
  try {
    window.localStorage.setItem(KEY_PERFIL, JSON.stringify(arr));
  } catch {}
  _invalidateCache();
}

/**
 * Limpa perfis salvos diretamente (não mexe em "usuario").
 */
export function limparPerfisSalvos() {
  if (!hasStorage()) return;
  try { window.localStorage.removeItem(KEY_PERFIL); } catch {}
  _invalidateCache();
}
