/* eslint-disable no-console */
"use strict";

// 📁 server/services/storage.js
// Serviço de armazenamento dos modelos de chamadas (banner/oral)

const path = require("path");
const fs = require("fs/promises");
const fsRaw = require("fs");
const crypto = require("crypto");

// Reusa paths centralizados
const { MODELOS_CHAMADAS_DIR, ensureDir } = require("../paths");

/* ──────────────────────────────────────────────────────────────
   Config
────────────────────────────────────────────────────────────── */
const ALLOWED_EXT = new Set([".ppt", ".pptx"]);
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

const MIME_BY_EXT = {
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const TIPO_TO_BASENAME = {
  template_banner: "modelo_banner",
  template_slide_oral: "modelo_oral",
};

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */
function normalizeTipo(tipo) {
  const t = String(tipo || "template_banner").trim().toLowerCase();
  if (t === "template_slide_oral") return "template_slide_oral";
  return "template_banner";
}

function getBaseNameByTipo(tipo) {
  const t = normalizeTipo(tipo);
  return TIPO_TO_BASENAME[t] || "modelo_banner";
}

function normalizeChamadaId(chamadaId) {
  const n = Number(chamadaId);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("chamadaId inválido.");
  }
  return String(Math.trunc(n));
}

function normalizeExt(originalname = "") {
  const ext = path.extname(String(originalname || "")).toLowerCase();
  if (ALLOWED_EXT.has(ext)) return ext;
  return ".pptx";
}

function getMimeByExt(ext) {
  return MIME_BY_EXT[String(ext || "").toLowerCase()] || MIME_BY_EXT[".pptx"];
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assertSafeStorageKey(storageKey) {
  const key = String(storageKey || "").replace(/\\/g, "/");

  if (!key) throw new Error("storageKey ausente.");

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
  return path.join(MODELOS_CHAMADAS_DIR, safeKey);
}

async function fileExists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

/* ──────────────────────────────────────────────────────────────
   Save
────────────────────────────────────────────────────────────── */
/**
 * Salva arquivo de modelo da chamada no disco.
 *
 * @param {number|string} chamadaId
 * @param {{ originalname?: string, mimetype?: string, size?: number, buffer: Buffer }} file
 * @param {string} [tipo='template_banner'] // template_banner | template_slide_oral
 * @returns {{ storageKey: string, sha256: string, size: number, tipo: string, filename: string }}
 */
async function saveChamadaModelo(chamadaId, file, tipo = "template_banner") {
  const id = normalizeChamadaId(chamadaId);

  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new Error("Arquivo inválido para salvar modelo.");
  }

  const size = Number(file.size) || file.buffer.length || 0;
  if (!size) {
    throw new Error("Arquivo vazio.");
  }

  if (size > MAX_SIZE_BYTES) {
    throw new Error("Arquivo excede o tamanho máximo permitido.");
  }

  const tipoNorm = normalizeTipo(tipo);
  const ext = normalizeExt(file.originalname);
  const safeBaseName = getBaseNameByTipo(tipoNorm);
  const finalFilename = `${safeBaseName}${ext}`;

  // pasta: <MODELOS_CHAMADAS_DIR>/<chamadaId>/
  const dir = path.join(MODELOS_CHAMADAS_DIR, id);
  await ensureDir(dir);

  // storageKey sempre relativa à base
  const storageKey = path.posix.join(id, finalFilename);
  assertSafeStorageKey(storageKey);

  const fullPath = resolveStoragePath(storageKey);
  const tmpPath = `${fullPath}.tmp-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const digest = sha256(file.buffer);

  try {
    await fs.writeFile(tmpPath, file.buffer);
    await fs.rename(tmpPath, fullPath);
  } catch (err) {
    try {
      if (await fileExists(tmpPath)) {
        await fs.unlink(tmpPath);
      }
    } catch {
      // ignore cleanup error
    }
    throw err;
  }

  return {
    storageKey,
    sha256: digest,
    size,
    tipo: tipoNorm,
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
  } catch (err) {
    if (err?.code === "ENOENT") return false;
    throw err;
  }
}

/* ──────────────────────────────────────────────────────────────
   Download helpers
────────────────────────────────────────────────────────────── */
function getDownloadHeaders(filename) {
  const safeName = String(filename || "modelo.pptx")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .trim() || "modelo.pptx";

  const ext = normalizeExt(safeName);
  const mime = getMimeByExt(ext);

  return {
    "Content-Type": mime,
    "Content-Disposition": `attachment; filename="${safeName}"`,
    "X-Content-Type-Options": "nosniff",
  };
}

module.exports = {
  saveChamadaModelo,
  stream,
  exists,
  stat,
  remove,
  resolveStoragePath,
  getDownloadHeaders,
};