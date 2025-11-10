// 📁 src/paths.js
const path = require("path");
const fs = require("fs");
const os = require("os");

const IS_DEV = process.env.NODE_ENV !== "production";

/* ───────────────── Utils de FS ───────────────── */

/** Cria diretório recursivamente (idempotente) */
function ensureDir(p) {
  if (!p) return;
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch (e) {
    // Qualquer erro diferente de EEXIST deve emergir
    if (e?.code !== "EEXIST") throw e;
  }
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

/* ───────────────── DATA_ROOT (ordem de candidatos) ─────────────────
 * Primeiro diretório gravável na lista vence:
 * - FILES_BASE (custom; recomendado definir no Render)
 * - DATA_DIR (compat legado)
 * - RENDER_DISK_PATH (quando usa Disk no Render)
 * - /var/data (padrão comum em montagens de disco)
 * - ./data e ./.data (no projeto)
 * - /tmp/escola-saude (sempre disponível; volátil)
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
if (!DATA_ROOT) {
  // Último recurso: tmp
  DATA_ROOT = path.join(os.tmpdir(), "escola-saude");
  ensureDir(DATA_ROOT);
}

/* ───────────────── Estrutura de subpastas ───────────────── */
const UPLOADS_DIR          = path.join(DATA_ROOT, "uploads");
const EVENTOS_DIR          = path.join(UPLOADS_DIR, "eventos"); // <- imagens/pdf de eventos
const MODELOS_CHAMADAS_DIR = path.join(UPLOADS_DIR, "modelos", "chamadas"); // .ppt/.pptx (banner/oral)
const CERT_DIR             = path.join(DATA_ROOT, "certificados");          // PDFs gerados
const TMP_DIR              = path.join(DATA_ROOT, "tmp");                   // arquivos temporários
const POSTERS_DIR          = path.join(UPLOADS_DIR, "posters");             // uploads de pôster (submissões)

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
  DATA_ROOT,
  UPLOADS_DIR,
  EVENTOS_DIR,
  MODELOS_CHAMADAS_DIR,
  CERT_DIR,
  TMP_DIR,
  POSTERS_DIR,
  ensureDir,
  isWritable,
};
