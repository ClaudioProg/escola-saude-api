// 📁 src/paths.js
const path = require("path");
const fs = require("fs");
const os = require("os");

const IS_DEV = process.env.NODE_ENV !== "production";

/** Cria diretório recursivamente (idempotente) */
function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch (e) {
    if (e && e.code !== "EEXIST") throw e;
  }
}

/** Verifica se o caminho é gravável criando/removendo um probe */
function isWritable(dir) {
  try {
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

/**
 * Ordem de candidatos (primeiro gravável vence):
 * - FILES_BASE (você pode definir no Render)
 * - DATA_DIR (compat c/ configs antigas)
 * - RENDER_DISK_PATH (se usar Disk no Render)
 * - /var/data (padrão de Disk no Render)
 * - ./data (no projeto)
 * - ./.data (no projeto)
 * - /tmp/escola-saude (sempre gravável; volátil)
 */
const candidates = [
  process.env.FILES_BASE,
  process.env.DATA_DIR,
  process.env.RENDER_DISK_PATH,
  "/var/data",
  path.join(process.cwd(), "data"),
  path.join(process.cwd(), ".data"),
  path.join(os.tmpdir(), "escola-saude"),
].filter(Boolean);

let DATA_ROOT = candidates.find(isWritable);
// Último recurso
if (!DATA_ROOT) {
  DATA_ROOT = path.join(os.tmpdir(), "escola-saude");
  ensureDir(DATA_ROOT);
}

// Estrutura padrão de subpastas
const UPLOADS_DIR             = path.join(DATA_ROOT, "uploads");
const MODELOS_CHAMADAS_DIR    = path.join(UPLOADS_DIR, "modelos", "chamadas");
const CERT_DIR                = path.join(DATA_ROOT, "certificados"); // <- PDFs
const TMP_DIR                 = path.join(DATA_ROOT, "tmp");

// Garante criação
[DATA_ROOT, UPLOADS_DIR, MODELOS_CHAMADAS_DIR, CERT_DIR, TMP_DIR].forEach(ensureDir);

// Logs úteis (evita poluir testes)
if (process.env.NODE_ENV !== "test") {
  console.log("[FILES] DATA_ROOT:", DATA_ROOT);
  console.log("[FILES] UPLOADS_DIR:", UPLOADS_DIR);
  console.log("[FILES] MODELOS_CHAMADAS_DIR:", MODELOS_CHAMADAS_DIR);
  console.log("[FILES] CERT_DIR:", CERT_DIR);
  console.log("[FILES] TMP_DIR:", TMP_DIR);
}

// abaixo das outras constantes
const POSTERS_DIR = path.join(UPLOADS_DIR, "posters");

// garanta criação
[DATA_ROOT, UPLOADS_DIR, MODELOS_CHAMADAS_DIR, CERT_DIR, TMP_DIR, POSTERS_DIR].forEach(ensureDir);

// no module.exports
module.exports = {
  IS_DEV,
  DATA_ROOT,
  UPLOADS_DIR,
  MODELOS_CHAMADAS_DIR,
  CERT_DIR,
  TMP_DIR,
  ensureDir,
  isWritable,
  POSTERS_DIR,              // 👈 exporte isto
};
