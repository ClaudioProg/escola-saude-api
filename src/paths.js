// 📁 src/paths.js — PREMIUM++
// - ✅ Em PROD: se RENDER_DISK_PATH existir e for gravável, ele vira o DATA_ROOT
// - ✅ Em DEV: mantém fallback amigável
// - ✅ Windows-safe
// - ✅ safeJoin reforçado
// - ✅ logs mais claros
/* eslint-disable no-console */
"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

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

/** Normaliza caminho vindo do ambiente */
function normalizeCandidate(p) {
  if (p === null || p === undefined) return null;

  const s = String(p)
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .replace(/^'(.*)'$/, "$1")
    .trim();

  if (!s) return null;

  return path.normalize(s);
}

/** Rejeita caminhos suspeitos no Windows */
function isSuspiciousWindowsPath(p) {
  if (!IS_WIN) return false;
  return /^([\\/])var([\\/]|$)/i.test(String(p || ""));
}

/** Probe de escrita com nome único */
function isWritable(dir) {
  try {
    if (!dir) return false;

    ensureDir(dir);

    const probeName = `.probe-${process.pid}-${Date.now()}-${crypto
      .randomBytes(4)
      .toString("hex")}`;

    const probeFile = path.join(dir, probeName);

    fs.writeFileSync(probeFile, "ok");
    fs.unlinkSync(probeFile);

    return true;
  } catch {
    return false;
  }
}

/** Converte uma key para formato posix (bom para storageKey em DB) */
function toPosixKey(...parts) {
  return parts
    .filter(Boolean)
    .map((p) =>
      String(p)
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/\/+$/, "")
    )
    .filter(Boolean)
    .join("/");
}

/**
 * Junta base + storageKey com proteção contra path traversal
 */
function safeJoin(baseDir, storageKey) {
  const base = path.resolve(String(baseDir || ""));
  const key = String(storageKey || "").replace(/\\/g, "/").trim();

  if (!base) throw new Error("baseDir inválido");
  if (!key) throw new Error("storageKey vazia");
  if (key.includes("..") || key.startsWith("/") || key.startsWith("\\")) {
    throw new Error("storageKey inválida");
  }

  const finalPath = path.resolve(base, key);

  if (
    finalPath !== base &&
    !finalPath.startsWith(base + path.sep)
  ) {
    throw new Error("storageKey inválida");
  }

  return finalPath;
}

/* ───────────────── DATA_ROOT (estratégia) ───────────────── */

const ENV_RENDER_DISK = normalizeCandidate(process.env.RENDER_DISK_PATH);
const ENV_FILES_BASE = normalizeCandidate(process.env.FILES_BASE);
const ENV_DATA_DIR = normalizeCandidate(process.env.DATA_DIR);

const renderDiskAllowed =
  ENV_RENDER_DISK &&
  !(IS_WIN && isSuspiciousWindowsPath(ENV_RENDER_DISK));

const hasRenderDiskWritable =
  !!renderDiskAllowed && isWritable(ENV_RENDER_DISK);

let DATA_ROOT = null;
let DATA_ROOT_SOURCE = null;
let FALLBACK_TO_TMP = false;

/* ✅ 1) Produção: Render Disk-first */
if (!IS_DEV && hasRenderDiskWritable) {
  DATA_ROOT = ENV_RENDER_DISK;
  DATA_ROOT_SOURCE = "RENDER_DISK_PATH";
}

/* ✅ 2) Caso contrário: candidatos ordenados */
if (!DATA_ROOT) {
  const rawCandidates = [
    ENV_FILES_BASE,
    ENV_DATA_DIR,

    // locais comuns
    IS_WIN ? path.join(process.cwd(), "data") : "/var/data",
    path.join(process.cwd(), "data"),
    path.join(process.cwd(), ".data"),
    path.join(os.tmpdir(), "escola-saude"),
  ].filter(Boolean);

  const candidates = rawCandidates
    .map(normalizeCandidate)
    .filter(Boolean)
    .filter((p) => !(IS_WIN && isSuspiciousWindowsPath(p)));

  for (const candidate of candidates) {
    if (isWritable(candidate)) {
      DATA_ROOT = candidate;
      DATA_ROOT_SOURCE =
        candidate === ENV_FILES_BASE
          ? "FILES_BASE"
          : candidate === ENV_DATA_DIR
            ? "DATA_DIR"
            : candidate === path.join(process.cwd(), "data")
              ? "CWD_DATA"
              : candidate === path.join(process.cwd(), ".data")
                ? "CWD_DOT_DATA"
                : candidate === path.join(os.tmpdir(), "escola-saude")
                  ? "TMP_APP_DIR"
                  : "DEFAULT_CANDIDATE";
      break;
    }
  }
}

/* ✅ 3) Último recurso: tmp */
if (!DATA_ROOT) {
  DATA_ROOT = path.join(os.tmpdir(), "escola-saude");
  DATA_ROOT_SOURCE = "TMP_FALLBACK";
  FALLBACK_TO_TMP = true;
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
    usingRenderDisk: !IS_DEV && hasRenderDiskWritable,
    resolvedFrom: DATA_ROOT_SOURCE,
    fallbackToTmp: FALLBACK_TO_TMP,
    RENDER_DISK_PATH: ENV_RENDER_DISK || null,
    FILES_BASE: ENV_FILES_BASE || null,
    DATA_DIR: ENV_DATA_DIR || null,
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
  DATA_ROOT_SOURCE,
  FALLBACK_TO_TMP,

  UPLOADS_DIR,
  EVENTOS_DIR,
  MODELOS_CHAMADAS_DIR,
  CERT_DIR,
  TMP_DIR,
  POSTERS_DIR,

  ensureDir,
  isWritable,
  toPosixKey,
  safeJoin,
};