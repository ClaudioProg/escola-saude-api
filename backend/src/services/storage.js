/* eslint-disable no-console */
"use strict";

/**
 * 📁 server/services/storage.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Serviço de armazenamento dos modelos de chamada:
 * - modelo de banner
 * - modelo de apresentação oral
 *
 * Contrato:
 * - aceita apenas .ppt e .pptx
 * - tamanho máximo: 15 MB
 * - salva em MODELOS_CHAMADAS_DIR/<chamadaId>/
 * - storageKey sempre relativa à pasta base
 *
 * Observação:
 * - Mantém armazenamento em disco porque modelos PowerPoint são arquivos de apoio.
 * - Upload temporário pode vir do middleware uploadModelo.
 */

const path = require("path");
const fs = require("fs/promises");
const fsRaw = require("fs");
const crypto = require("crypto");

const { MODELOS_CHAMADAS_DIR, ensureDir } = require("../paths");

/* ──────────────────────────────────────────────────────────────
   Config
────────────────────────────────────────────────────────────── */

const MAX_SIZE_MB = 15;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ALLOWED_EXT = new Set([".ppt", ".pptx"]);

const MIME_BY_EXT = {
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const TIPO_MODELO = {
  TEMPLATE_BANNER: "template_banner",
  TEMPLATE_SLIDE_ORAL: "template_slide_oral",
};

const TIPO_TO_BASENAME = {
  [TIPO_MODELO.TEMPLATE_BANNER]: "modelo_banner",
  [TIPO_MODELO.TEMPLATE_SLIDE_ORAL]: "modelo_oral",
};

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function normalizeTipo(tipo) {
  const normalized = String(tipo || TIPO_MODELO.TEMPLATE_BANNER)
    .trim()
    .toLowerCase();

  if (normalized === TIPO_MODELO.TEMPLATE_SLIDE_ORAL) {
    return TIPO_MODELO.TEMPLATE_SLIDE_ORAL;
  }

  return TIPO_MODELO.TEMPLATE_BANNER;
}

function getBaseNameByTipo(tipo) {
  const tipoNormalizado = normalizeTipo(tipo);
  return TIPO_TO_BASENAME[tipoNormalizado];
}

function normalizeChamadaId(chamadaId) {
  const id = Number(chamadaId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("chamadaId inválido.");
  }

  return String(id);
}

function getExtension(filename = "") {
  return path.extname(String(filename || "")).toLowerCase();
}

function normalizeExt(originalname = "") {
  const ext = getExtension(originalname);

  if (!ALLOWED_EXT.has(ext)) {
    throw new Error("Extensão inválida. Envie apenas arquivos .ppt ou .pptx.");
  }

  return ext;
}

function getMimeByExt(ext) {
  const normalized = String(ext || "").toLowerCase();

  if (!ALLOWED_EXT.has(normalized)) {
    return MIME_BY_EXT[".pptx"];
  }

  return MIME_BY_EXT[normalized];
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function buildTempPath(fullPath) {
  const nonce = crypto.randomBytes(6).toString("hex");
  return `${fullPath}.tmp-${Date.now()}-${nonce}`;
}

function assertSafeStorageKey(storageKey) {
  const key = String(storageKey || "").replace(/\\/g, "/").trim();

  if (!key) {
    throw new Error("storageKey ausente.");
  }

  if (
    key.includes("..") ||
    path.isAbsolute(key) ||
    key.startsWith("/") ||
    key.startsWith("\\")
  ) {
    throw new Error("storageKey inválida.");
  }

  return key;
}

function resolveStoragePath(storageKey) {
  const safeKey = assertSafeStorageKey(storageKey);
  const fullPath = path.join(MODELOS_CHAMADAS_DIR, safeKey);

  const normalizedBase = path.resolve(MODELOS_CHAMADAS_DIR);
  const normalizedFullPath = path.resolve(fullPath);

  if (!normalizedFullPath.startsWith(normalizedBase)) {
    throw new Error("storageKey fora da pasta permitida.");
  }

  return normalizedFullPath;
}

async function fileExists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

function sanitizeDownloadFilename(filename) {
  const safeName = String(filename || "modelo.pptx")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/[\r\n]+/g, " ")
    .trim();

  return safeName || "modelo.pptx";
}

/* ──────────────────────────────────────────────────────────────
   Save
────────────────────────────────────────────────────────────── */

/**
 * Salva arquivo de modelo da chamada no disco.
 *
 * @param {number|string} chamadaId
 * @param {{ originalname?: string, mimetype?: string, size?: number, buffer: Buffer }} file
 * @param {string} [tipo='template_banner']
 * @returns {Promise<{ storageKey: string, sha256: string, size: number, tipo: string, filename: string }>}
 */
async function saveChamadaModelo(chamadaId, file, tipo = TIPO_MODELO.TEMPLATE_BANNER) {
  const id = normalizeChamadaId(chamadaId);

  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new Error("Arquivo inválido para salvar modelo.");
  }

  const size = Number(file.size) || file.buffer.length || 0;

  if (!size) {
    throw new Error("Arquivo vazio.");
  }

  if (size > MAX_SIZE_BYTES) {
    throw new Error(`Arquivo excede o tamanho máximo permitido de ${MAX_SIZE_MB} MB.`);
  }

  const tipoNormalizado = normalizeTipo(tipo);
  const ext = normalizeExt(file.originalname);
  const safeBaseName = getBaseNameByTipo(tipoNormalizado);
  const finalFilename = `${safeBaseName}${ext}`;

  const dir = path.join(MODELOS_CHAMADAS_DIR, id);
  await ensureDir(dir);

  const storageKey = path.posix.join(id, finalFilename);
  assertSafeStorageKey(storageKey);

  const fullPath = resolveStoragePath(storageKey);
  const tmpPath = buildTempPath(fullPath);
  const digest = sha256(file.buffer);

  try {
    await fs.writeFile(tmpPath, file.buffer);
    await fs.rename(tmpPath, fullPath);
  } catch (error) {
    try {
      if (await fileExists(tmpPath)) {
        await fs.unlink(tmpPath);
      }
    } catch {
      // ignora falha de limpeza do temporário
    }

    throw error;
  }

  return {
    storageKey,
    sha256: digest,
    size,
    tipo: tipoNormalizado,
    filename: finalFilename,
  };
}

/* ──────────────────────────────────────────────────────────────
   Read / metadata
────────────────────────────────────────────────────────────── */

function stream(storageKey) {
  const fullPath = resolveStoragePath(storageKey);
  return fsRaw.createReadStream(fullPath);
}

async function exists(storageKey) {
  const fullPath = resolveStoragePath(storageKey);
  return fileExists(fullPath);
}

async function stat(storageKey) {
  const fullPath = resolveStoragePath(storageKey);
  return fs.stat(fullPath);
}

async function remove(storageKey) {
  const fullPath = resolveStoragePath(storageKey);

  try {
    await fs.unlink(fullPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

/* ──────────────────────────────────────────────────────────────
   Download helpers
────────────────────────────────────────────────────────────── */

function getDownloadHeaders(filename) {
  const safeName = sanitizeDownloadFilename(filename);
  const ext = normalizeExt(safeName);
  const mime = getMimeByExt(ext);
  const encodedName = encodeURIComponent(safeName);

  return {
    "Content-Type": mime,
    "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
    "X-Content-Type-Options": "nosniff",
  };
}

/* ──────────────────────────────────────────────────────────────
   Export
────────────────────────────────────────────────────────────── */

module.exports = {
  saveChamadaModelo,
  stream,
  exists,
  stat,
  remove,
  resolveStoragePath,
  getDownloadHeaders,

  MAX_SIZE_MB,
  MAX_SIZE_BYTES,
  TIPO_MODELO,
};