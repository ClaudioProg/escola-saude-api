// 📁 src/utils/perfis.js — PREMIUM++
const KEY_PERFIL = "perfil";
const KEY_USUARIO = "usuario";

/* =========================
   Ambiente / storage
========================= */
function hasWindow() {
  return typeof window !== "undefined";
}

function hasStorage() {
  return hasWindow() && typeof window.localStorage !== "undefined";
}

function parseJSONSafe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function lsGet(key) {
  if (!hasStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key, value) {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function lsRemove(key) {
  if (!hasStorage()) return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/* =========================
   Normalização
========================= */
function normalizeOnePerfil(value) {
  if (value == null) return "";

  const s = String(value)
    .replace(/[\[\]"]/g, "")
    .trim()
    .toLowerCase();

  return s;
}

function unique(arr = []) {
  return Array.from(new Set(arr));
}

/**
 * Normaliza entrada em array de perfis.
 * Aceita:
 * - string CSV/SSV: "administrador,instrutor" / "administrador;instrutor"
 * - array
 * - objeto com .perfil / .perfis
 */
function normalizarPerfis(input) {
  if (input == null) return [];

  if (Array.isArray(input)) {
    return unique(
      input
        .map(normalizeOnePerfil)
        .filter(Boolean)
    );
  }

  if (typeof input === "string") {
    return unique(
      input
        .split(/[;,]/)
        .map(normalizeOnePerfil)
        .filter(Boolean)
    );
  }

  if (typeof input === "object") {
    const fromPerfil =
      input.perfil !== undefined ? normalizarPerfis(input.perfil) : [];
    const fromPerfis =
      input.perfis !== undefined ? normalizarPerfis(input.perfis) : [];

    return unique([...fromPerfil, ...fromPerfis]);
  }

  return [];
}

/* =========================
   Cache leve em memória
========================= */
let _cachePerfis = null;

function _invalidateCache() {
  _cachePerfis = null;
}

function _emitPerfisChanged() {
  if (!hasWindow()) return;
  try {
    window.dispatchEvent(new CustomEvent("perfis:changed"));
  } catch {
    // noop
  }
}

function _fromCacheOr(factory) {
  if (_cachePerfis !== null) return [..._cachePerfis];
  const value = factory();
  _cachePerfis = [...value];
  return [...value];
}

// Invalida cache quando houver alteração entre abas
if (hasWindow()) {
  window.addEventListener?.("storage", (ev) => {
    if (ev?.key === KEY_PERFIL || ev?.key === KEY_USUARIO || ev?.key === null) {
      _invalidateCache();
    }
  });

  // Invalida também na mesma aba
  window.addEventListener?.("perfis:changed", () => {
    _invalidateCache();
  });
}

/* =========================
   Núcleo de leitura
========================= */
/**
 * Lê os perfis do localStorage de forma robusta, aceitando:
 * - localStorage["perfil"] (string CSV, string JSON, array JSON)
 * - localStorage["usuario"] com campos perfil/perfis
 * Sempre retorna array lowercase e sem duplicatas.
 */
export function getPerfisRobusto() {
  return _fromCacheOr(() => {
    const out = new Set();

    // 1) chave direta "perfil"
    const rawPerfil = lsGet(KEY_PERFIL);
    if (rawPerfil != null) {
      const parsedPerfil = parseJSONSafe(rawPerfil);
      const perfisDiretos =
        parsedPerfil == null
          ? normalizarPerfis(rawPerfil)
          : normalizarPerfis(parsedPerfil);

      perfisDiretos.forEach((p) => out.add(p));
    }

    // 2) objeto "usuario"
    const rawUsuario = lsGet(KEY_USUARIO);
    if (rawUsuario) {
      const usuario = parseJSONSafe(rawUsuario);
      if (usuario && typeof usuario === "object") {
        normalizarPerfis(usuario).forEach((p) => out.add(p));
      }
    }

    // 3) fallback mínimo
    if (out.size === 0) out.add("usuario");

    return Array.from(out);
  });
}

export const getPerfis = getPerfisRobusto;

/* =========================
   Predicados comuns
========================= */
export function ehAdmin(perfis = null) {
  const arr = Array.isArray(perfis) ? normalizarPerfis(perfis) : getPerfisRobusto();
  return arr.includes("administrador");
}

export function ehInstrutor(perfis = null) {
  const arr = Array.isArray(perfis) ? normalizarPerfis(perfis) : getPerfisRobusto();
  return arr.includes("instrutor") || arr.includes("administrador");
}

export function temPerfil(perfilAlvo, perfis = null) {
  if (!perfilAlvo) return false;

  const alvo = normalizeOnePerfil(perfilAlvo);
  if (!alvo) return false;

  const arr = Array.isArray(perfis) ? normalizarPerfis(perfis) : getPerfisRobusto();
  return arr.includes(alvo);
}

export function hasAnyPerfil(lista = [], perfis = null) {
  if (!Array.isArray(lista) || lista.length === 0) return false;

  const alvo = new Set(normalizarPerfis(lista));
  if (alvo.size === 0) return false;

  const arr = Array.isArray(perfis) ? normalizarPerfis(perfis) : getPerfisRobusto();
  return arr.some((p) => alvo.has(p));
}

export function hasAllPerfis(lista = [], perfis = null) {
  if (!Array.isArray(lista) || lista.length === 0) return true;

  const alvo = normalizarPerfis(lista);
  const arr = Array.isArray(perfis) ? normalizarPerfis(perfis) : getPerfisRobusto();
  const setPerfis = new Set(arr);

  return alvo.every((p) => setPerfis.has(p));
}

/* =========================
   Utilidades opcionais
========================= */
/**
 * Persiste perfis no localStorage de forma padronizada (array JSON).
 * Não altera o objeto "usuario".
 */
export function salvarPerfis(perfis = []) {
  const arr = normalizarPerfis(perfis);
  const ok = lsSet(KEY_PERFIL, JSON.stringify(arr));

  if (ok) {
    _invalidateCache();
    _emitPerfisChanged();
  }
}

/**
 * Limpa perfis salvos diretamente.
 */
export function limparPerfisSalvos() {
  const ok = lsRemove(KEY_PERFIL);

  if (ok) {
    _invalidateCache();
    _emitPerfisChanged();
  }
}