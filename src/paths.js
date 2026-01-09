// 📁 src/paths.js
/* eslint-disable no-console */
const path = require("path");
const fs = require("fs");
const os = require("os");

const IS_DEV = process.env.NODE_ENV !== "production";
const IS_WIN = process.platform === "win32";

/* ───────────────── Utils de FS ───────────────── */

/** Cria diretório recursivamente (idempotente) */
function ensureDir(p) {
  if (!p) return;
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch (e) {
    if (e?.code !== "EEXIST") throw e;
  }
}

/** Normaliza caminho do ambiente para o OS (corrige barras e remove quotes) */
function normalizeCandidate(p) {
  if (!p) return null;
  const s = String(p).trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  // normaliza separadores para o OS
  return path.normalize(s);
}

/** Rejeita paths "suspeitos" tipo "\var\data" no Windows */
function isSuspiciousWindowsPath(p) {
  if (!IS_WIN) return false;
  // "\var\data" ou "/var/data" em Windows são geralmente inválidos/enganosos
  return /^([\\/])var([\\/]|$)/i.test(p);
}

/** Verifica se o caminho é gravável criando/removendo um probe */
function isWritable(dir) {
  try {
    if (!dir) return false;
    ensureDir(dir);
    const probeDir = path.join(dir, ".probe");
    const probeFile = path.join(probeDir, "w");
    fs.mkdirSync(probeDir, { recursive: true });
    fs.writeFileSync(probeFile, "ok");
    fs.rmSync(probeDir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/** Converte uma key para formato posix (bom p/ storageKey em DB) */
function toPosixKey(...parts) {
  return parts
    .filter(Boolean)
    .map((p) => String(p).replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, ""))
    .join("/");
}

/** Junta base + storageKey com proteção contra path traversal */
function safeJoin(baseDir, storageKey) {
  const key = String(storageKey || "").replace(/\\/g, "/");
  if (key.includes("..") || key.startsWith("/") || key.startsWith("\\")) {
    throw new Error("storageKey inválida");
  }
  return path.join(baseDir, key);
}

/* ───────────────── DATA_ROOT (ordem de candidatos) ─────────────────
 * Primeiro diretório gravável na lista vence.
 * Premium: em Windows priorizamos ./data antes de /var/data
 */
const rawCandidates = [
  process.env.FILES_BASE,
  process.env.DATA_DIR,
  process.env.RENDER_DISK_PATH,

  // locais comuns:
  IS_WIN ? path.join(process.cwd(), "data") : "/var/data",
  path.join(process.cwd(), "data"),
  path.join(process.cwd(), ".data"),
  path.join(os.tmpdir(), "escola-saude"),
].filter(Boolean);

const candidates = rawCandidates
  .map(normalizeCandidate)
  .filter(Boolean)
  .filter((p) => !(IS_WIN && isSuspiciousWindowsPath(p)));

let DATA_ROOT = candidates.find(isWritable);

if (!DATA_ROOT) {
  // Último recurso: tmp (sempre disponível; volátil)
  DATA_ROOT = path.join(os.tmpdir(), "escola-saude");
  ensureDir(DATA_ROOT);
}

/* ───────────────── Estrutura de subpastas ───────────────── */
const UPLOADS_DIR          = path.join(DATA_ROOT, "uploads");
const EVENTOS_DIR          = path.join(UPLOADS_DIR, "eventos");
const MODELOS_CHAMADAS_DIR = path.join(UPLOADS_DIR, "modelos", "chamadas");
const CERT_DIR             = path.join(DATA_ROOT, "certificados");
const TMP_DIR              = path.join(DATA_ROOT, "tmp");
const POSTERS_DIR          = path.join(UPLOADS_DIR, "posters");

/* ───────────────── Garantia de criação ───────────────── */
[
  DATA_ROOT,
  UPLOADS_DIR,
  EVENTOS_DIR,
  MODELOS_CHAMADAS_DIR,
  CERT_DIR,
  TMP_DIR,
  POSTERS_DIR,
].forEach(ensureDir);

/* ───────────────── Logs úteis ───────────────── */
if (process.env.NODE_ENV !== "test") {
  console.log("[FILES] DATA_ROOT:", DATA_ROOT);
  console.log("[FILES] UPLOADS_DIR:", UPLOADS_DIR);
  console.log("[FILES] EVENTOS_DIR:", EVENTOS_DIR);
  console.log("[FILES] MODELOS_CHAMADAS_DIR:", MODELOS_CHAMADAS_DIR);
  console.log("[FILES] CERT_DIR:", CERT_DIR);
  console.log("[FILES] TMP_DIR:", TMP_DIR);
  console.log("[FILES] POSTERS_DIR:", POSTERS_DIR);
}

/* ───────────────── Exports ───────────────── */
module.exports = {
  IS_DEV,
  IS_WIN,

  DATA_ROOT,
  UPLOADS_DIR,
  EVENTOS_DIR,
  MODELOS_CHAMADAS_DIR,
  CERT_DIR,
  TMP_DIR,
  POSTERS_DIR,

  ensureDir,
  isWritable,

  // extras premium (úteis em storage/services)
  toPosixKey,
  safeJoin,
};
