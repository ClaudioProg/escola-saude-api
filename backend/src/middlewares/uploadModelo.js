// 📁 src/middlewares/uploadModelo.js — v2.0
/* eslint-disable no-console */
"use strict";

/**
 * Plataforma Escola da Saúde
 * Upload oficial de modelo PowerPoint
 *
 * Contrato:
 * - Aceita apenas .ppt e .pptx
 * - Tamanho máximo: 15 MB
 * - Salva temporariamente no tmp do sistema operacional
 * - Controller/service deve processar e remover o arquivo temporário depois
 *
 * Campo esperado no controller:
 * - uploadModelo.single("file")
 */

const os = require("os");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

/* =========================
   Configurações
========================= */

const MAX_SIZE_MB = 15;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([".ppt", ".pptx"]);

const ALLOWED_MIME = new Set([
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  // Alguns navegadores/proxies podem enviar PowerPoint como genérico.
  // A extensão continua sendo obrigatória.
  "application/octet-stream",
]);

/* =========================
   Helpers
========================= */

function getExtension(filename = "") {
  return path.extname(String(filename || "")).toLowerCase();
}

function sanitizeBaseName(filename = "arquivo") {
  const ext = getExtension(filename);
  const base = path.basename(String(filename || "arquivo"), ext);

  return (
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "arquivo"
  );
}

function buildSafeTmpName(originalname = "arquivo") {
  const ext = getExtension(originalname);
  const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : ".pptx";
  const base = sanitizeBaseName(originalname);
  const nonce = crypto.randomBytes(4).toString("hex");

  return `modelo-${Date.now()}-${nonce}-${base}${safeExt}`;
}

function isAllowedExtension(file) {
  return ALLOWED_EXTENSIONS.has(getExtension(file?.originalname));
}

function isExpectedMime(file) {
  return ALLOWED_MIME.has(String(file?.mimetype || "").toLowerCase());
}

/* =========================
   Storage temporário
========================= */

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, os.tmpdir());
  },

  filename: (_req, file, cb) => {
    try {
      cb(null, buildSafeTmpName(file?.originalname));
    } catch (error) {
      cb(error);
    }
  },
});

/* =========================
   Filtro de arquivos
========================= */

function fileFilter(_req, file, cb) {
  if (!file || !file.originalname) {
    return cb(new Error("Arquivo inválido."), false);
  }

  const extOk = isAllowedExtension(file);
  const mimeOk = isExpectedMime(file);

  if (!extOk) {
    return cb(new Error("Envie apenas arquivos .ppt ou .pptx."), false);
  }

  if (!mimeOk) {
    console.warn("[uploadModelo] MIME inesperado recebido", {
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
  }

  return cb(null, true);
}

/* =========================
   Instância Multer
========================= */

const uploadModelo = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_SIZE_BYTES,
    files: 1,
  },
});

module.exports = uploadModelo;
module.exports.MAX_SIZE_MB = MAX_SIZE_MB;
module.exports.MAX_SIZE_BYTES = MAX_SIZE_BYTES;