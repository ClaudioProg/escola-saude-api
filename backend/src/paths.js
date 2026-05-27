// 📁 src/paths.js — v2.0
/* eslint-disable no-console */
"use strict";

/**
 * Plataforma Escola da Saúde
 *
 * Fonte única de caminhos de arquivos da aplicação.
 *
 * Função:
 * - Definir DATA_ROOT.
 * - Criar diretórios necessários.
 * - Proteger joins de storageKey.
 * - Padronizar paths usados por uploads, certificados, modelos e temporários.
 *
 * Observação:
 * - Este arquivo não manipula datas.
 * - Não há risco de fuso horário aqui.
 */

const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const IS_DEV = process.env.NODE_ENV !== "production";
const IS_TEST = process.env.NODE_ENV === "test";
const IS_WIN = process.platform === "win32";

const APP_STORAGE_NAME = "escola-saude";

const ALLOW_TMP_FALLBACK =
  String(process.env.FILES_ALLOW_TMP_FALLBACK || "")
    .trim()
    .toLowerCase() === "true";

/* ─────────────────────────────────────────
   Helpers de ambiente
───────────────────────────────────────── */

function normalizeCandidate(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value)
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .replace(/^'(.*)'$/, "$1")
    .trim();

  if (!normalized) {
    return null;
  }

  return path.normalize(normalized);
}

function isSuspiciousWindowsPath(value) {
  if (!IS_WIN) {
    return false;
  }

  return /^([\\/])var([\\/]|$)/i.test(String(value || ""));
}

/* ─────────────────────────────────────────
   Helpers de FS
───────────────────────────────────────── */

function ensureDir(dirPath) {
  if (!dirPath) {
    return;
  }

  try {
    fs.mkdirSync(dirPath, {
      recursive: true,
    });
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw error;
    }
  }
}

function isWritable(dirPath) {
  try {
    if (!dirPath) {
      return false;
    }

    ensureDir(dirPath);

    const probeName = `.probe-${process.pid}-${Date.now()}-${crypto
      .randomBytes(4)
      .toString("hex")}`;

    const probeFile = path.join(dirPath, probeName);

    fs.writeFileSync(probeFile, "ok");
    fs.unlinkSync(probeFile);

    return true;
  } catch {
    return false;
  }
}

function toPosixKey(...parts) {
  return parts
    .filter((part) => part !== null && part !== undefined && part !== "")
    .map((part) =>
      String(part)
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/\/+$/, "")
    )
    .filter(Boolean)
    .join("/");
}

function assertSafeStorageKey(storageKey) {
  const key = String(storageKey || "")
    .replace(/\\/g, "/")
    .trim();

  if (!key) {
    throw new Error("storageKey vazia.");
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

function safeJoin(baseDir, storageKey) {
  const base = path.resolve(String(baseDir || ""));
  const key = assertSafeStorageKey(storageKey);

  if (!base) {
    throw new Error("baseDir inválido.");
  }

  const finalPath = path.resolve(base, key);

  if (finalPath !== base && !finalPath.startsWith(base + path.sep)) {
    throw new Error("storageKey fora da pasta permitida.");
  }

  return finalPath;
}

/* ─────────────────────────────────────────
   Resolução do DATA_ROOT
───────────────────────────────────────── */

const ENV_RENDER_DISK = normalizeCandidate(process.env.RENDER_DISK_PATH);
const ENV_FILES_BASE = normalizeCandidate(process.env.FILES_BASE);
const ENV_DATA_DIR = normalizeCandidate(process.env.DATA_DIR);

const RENDER_DISK_VALIDO =
  ENV_RENDER_DISK &&
  !(IS_WIN && isSuspiciousWindowsPath(ENV_RENDER_DISK)) &&
  isWritable(ENV_RENDER_DISK);

const CANDIDATE_CWD_DATA = path.join(process.cwd(), "data");
const CANDIDATE_CWD_DOT_DATA = path.join(process.cwd(), ".data");
const CANDIDATE_TMP = path.join(os.tmpdir(), APP_STORAGE_NAME);

function resolveDataRoot() {
  if (!IS_DEV && RENDER_DISK_VALIDO) {
    return {
      dataRoot: ENV_RENDER_DISK,
      source: "RENDER_DISK_PATH",
      fallbackToTmp: false,
    };
  }

  const rawCandidates = [
    ENV_FILES_BASE,
    ENV_DATA_DIR,
    !IS_WIN ? "/var/data" : null,
    CANDIDATE_CWD_DATA,
    CANDIDATE_CWD_DOT_DATA,
  ].filter(Boolean);

  const candidates = rawCandidates
    .map(normalizeCandidate)
    .filter(Boolean)
    .filter((candidate) => !(IS_WIN && isSuspiciousWindowsPath(candidate)));

  for (const candidate of candidates) {
    if (isWritable(candidate)) {
      let source = "DEFAULT_CANDIDATE";

      if (candidate === ENV_FILES_BASE) source = "FILES_BASE";
      else if (candidate === ENV_DATA_DIR) source = "DATA_DIR";
      else if (candidate === "/var/data") source = "VAR_DATA";
      else if (candidate === CANDIDATE_CWD_DATA) source = "CWD_DATA";
      else if (candidate === CANDIDATE_CWD_DOT_DATA) source = "CWD_DOT_DATA";

      return {
        dataRoot: candidate,
        source,
        fallbackToTmp: false,
      };
    }
  }

  if (!IS_DEV && !ALLOW_TMP_FALLBACK) {
    throw new Error(
      "[paths] Nenhum DATA_ROOT persistente gravável encontrado em produção. " +
        "Configure RENDER_DISK_PATH, FILES_BASE ou DATA_DIR. " +
        "Para permitir fallback temporário conscientemente, defina FILES_ALLOW_TMP_FALLBACK=true."
    );
  }

  ensureDir(CANDIDATE_TMP);

  return {
    dataRoot: CANDIDATE_TMP,
    source: "TMP_FALLBACK",
    fallbackToTmp: true,
  };
}

const resolved = resolveDataRoot();

const DATA_ROOT = resolved.dataRoot;
const DATA_ROOT_SOURCE = resolved.source;
const FALLBACK_TO_TMP = resolved.fallbackToTmp;

/* ─────────────────────────────────────────
   Estrutura oficial de subpastas
───────────────────────────────────────── */

const UPLOADS_DIR = path.join(DATA_ROOT, "uploads");
const EVENTOS_DIR = path.join(UPLOADS_DIR, "eventos");
const MODELOS_CHAMADAS_DIR = path.join(UPLOADS_DIR, "modelos", "chamadas");
const CERT_DIR = path.join(DATA_ROOT, "certificados");
const TMP_DIR = path.join(DATA_ROOT, "tmp");
const POSTERS_DIR = path.join(UPLOADS_DIR, "posters");

const ALL_DIRS = [
  DATA_ROOT,
  UPLOADS_DIR,
  EVENTOS_DIR,
  MODELOS_CHAMADAS_DIR,
  CERT_DIR,
  TMP_DIR,
  POSTERS_DIR,
];

ALL_DIRS.forEach(ensureDir);

/* ─────────────────────────────────────────
   Diagnóstico
───────────────────────────────────────── */

function getStorageInfo() {
  return {
    isDev: IS_DEV,
    isWin: IS_WIN,
    dataRoot: DATA_ROOT,
    dataRootSource: DATA_ROOT_SOURCE,
    fallbackToTmp: FALLBACK_TO_TMP,
    uploadsDir: UPLOADS_DIR,
    eventosDir: EVENTOS_DIR,
    modelosChamadasDir: MODELOS_CHAMADAS_DIR,
    certDir: CERT_DIR,
    tmpDir: TMP_DIR,
    postersDir: POSTERS_DIR,
  };
}

if (!IS_TEST) {
  console.log("[paths] Storage resolvido:", {
    isDev: IS_DEV,
    isWin: IS_WIN,
    dataRoot: DATA_ROOT,
    source: DATA_ROOT_SOURCE,
    fallbackToTmp: FALLBACK_TO_TMP,
    renderDiskPath: ENV_RENDER_DISK || null,
    filesBase: ENV_FILES_BASE || null,
    dataDir: ENV_DATA_DIR || null,
    allowTmpFallback: ALLOW_TMP_FALLBACK,
  });

  if (!IS_DEV && FALLBACK_TO_TMP) {
    console.warn(
      "[paths] ATENÇÃO: usando armazenamento temporário em produção. " +
        "Arquivos podem ser perdidos em restart/redeploy."
    );
  }
}

/* ─────────────────────────────────────────
   Export oficial
───────────────────────────────────────── */

module.exports = {
  IS_DEV,
  IS_TEST,
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
  getStorageInfo,
};