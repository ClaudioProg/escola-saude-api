// 📁 src/paths.js — PREMIUM++ (Render Disk-first em PROD, sem quebrar DEV/Windows)
// - ✅ Em PROD: se RENDER_DISK_PATH existir e for gravável, ele vira o DATA_ROOT (prioridade absoluta)
// - ✅ Em DEV: mantém comportamento atual (primeiro gravável) com preferência por ./data no Windows
// - ✅ Mantém toPosixKey + safeJoin + probes

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
  return path.normalize(s);
}

/** Rejeita paths "suspeitos" tipo "\var\data" no Windows */
function isSuspiciousWindowsPath(p) {
  if (!IS_WIN) return false;
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

/* ───────────────── DATA_ROOT (estratégia) ─────────────────
   ✅ Regra PREMIUM:
   - Em PRODUÇÃO no Render: se existir RENDER_DISK_PATH gravável, ele vence SEM DISCUSSÃO.
   - Em DEV/local: mantém estratégia "primeiro gravável" com prioridades amigáveis.
*/

const ENV_RENDER_DISK = normalizeCandidate(process.env.RENDER_DISK_PATH);
const ENV_FILES_BASE = normalizeCandidate(process.env.FILES_BASE);
const ENV_DATA_DIR = normalizeCandidate(process.env.DATA_DIR);

const hasRenderDisk =
  ENV_RENDER_DISK &&
  !(IS_WIN && isSuspiciousWindowsPath(ENV_RENDER_DISK)) &&
  isWritable(ENV_RENDER_DISK);

let DATA_ROOT = null;

// ✅ 1) Produção: Render Disk-first (se configurado)
if (!IS_DEV && hasRenderDisk) {
  DATA_ROOT = ENV_RENDER_DISK;
}

// ✅ 2) Caso contrário (DEV ou sem disk), usa candidatos na ordem
if (!DATA_ROOT) {
  const rawCandidates = [
    ENV_FILES_BASE,
    ENV_DATA_DIR,
    ENV_RENDER_DISK,

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

  DATA_ROOT = candidates.find(isWritable) || null;
}

// ✅ 3) Último recurso: tmp (sempre disponível; volátil)
if (!DATA_ROOT) {
  DATA_ROOT = path.join(os.tmpdir(), "escola-saude");
  ensureDir(DATA_ROOT);
}

/* ───────────────── Estrutura de subpastas ───────────────── */
const UPLOADS_DIR = path.join(DATA_ROOT, "uploads");
const EVENTOS_DIR = path.join(UPLOADS_DIR, "eventos");
const MODELOS_CHAMADAS_DIR = path.join(UPLOADS_DIR, "modelos", "chamadas");
const CERT_DIR = path.join(DATA_ROOT, "certificados");
const TMP_DIR = path.join(DATA_ROOT, "tmp");
const POSTERS_DIR = path.join(UPLOADS_DIR, "posters");

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
  console.log("[FILES] DATA_ROOT:", DATA_ROOT, {
    IS_DEV,
    usingRenderDisk: !IS_DEV && hasRenderDisk,
    RENDER_DISK_PATH: ENV_RENDER_DISK || null,
  });
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
