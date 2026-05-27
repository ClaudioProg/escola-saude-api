// 📁 src/middlewares/uploadInformacoes.js — v2.0
/* eslint-disable no-console */
"use strict";

/**
 * Plataforma Escola da Saúde
 * Upload oficial de imagem para Informações/Publicações
 *
 * Contrato:
 * - Recebe 1 arquivo no campo "imagem"
 * - Usa multer.memoryStorage()
 * - Não salva arquivo em disco
 * - Controller/service deve persistir no banco:
 *   - buffer
 *   - mime
 *   - size
 *   - nome original
 *   - extensão detectada
 *
 * Não usar:
 * - caminho relativo em disco
 * - uploadRoot
 * - getImageRelativePath
 * - resolveImageAbsolutePath
 * - removeFileIfExists
 */

const crypto = require("crypto");
const path = require("path");
const multer = require("multer");

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MIME_TO_EXTENSION = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */

function sanitizeBaseFilename(originalname = "imagem") {
  const ext = path.extname(originalname || "").toLowerCase();

  const base = path
    .basename(originalname || "imagem", ext)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return base || "imagem";
}

function getOriginalExtension(originalname = "") {
  return path.extname(originalname || "").toLowerCase();
}

function getDetectedExtension(file) {
  return MIME_TO_EXTENSION[file?.mimetype] || "";
}

function buildLogicalFilename(file) {
  const safeBase = sanitizeBaseFilename(file?.originalname);
  const detectedExtension = getDetectedExtension(file) || ".jpg";
  const stamp = Date.now();
  const nonce = crypto.randomBytes(4).toString("hex");

  return `informacao-${stamp}-${nonce}-${safeBase}${detectedExtension}`;
}

function sendUploadError(res, status, code, message, details = null) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    data: null,
    ...(details ? { details } : {}),
  });
}

function validateImageFile(file) {
  if (!file || !file.mimetype) {
    return {
      ok: false,
      message: "Arquivo de imagem inválido.",
    };
  }

  const mimetype = String(file.mimetype || "").toLowerCase();
  const originalExtension = getOriginalExtension(file.originalname);

  if (!ALLOWED_MIME_TYPES.has(mimetype)) {
    return {
      ok: false,
      message: "Formato de imagem inválido. Envie JPG, PNG ou WEBP.",
    };
  }

  if (originalExtension && !ALLOWED_EXTENSIONS.has(originalExtension)) {
    return {
      ok: false,
      message: "Extensão de imagem inválida. Envie JPG, PNG ou WEBP.",
    };
  }

  return {
    ok: true,
  };
}

function fileFilter(_req, file, cb) {
  const validation = validateImageFile(file);

  if (!validation.ok) {
    return cb(new Error(validation.message));
  }

  return cb(null, true);
}

/* ─────────────────────────────────────────
   Multer
───────────────────────────────────────── */

const uploadInformacaoImagemMulter = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
}).single("imagem");

/* ─────────────────────────────────────────
   Middleware oficial
───────────────────────────────────────── */

function uploadInformacaoImagem(req, res, next) {
  uploadInformacaoImagemMulter(req, res, (error) => {
    if (!error) {
      if (req.file) {
        req.file.logicalFilename = buildLogicalFilename(req.file);
        req.file.detectedExtension = getDetectedExtension(req.file);
        req.file.originalExtension = getOriginalExtension(req.file.originalname);
      }

      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return sendUploadError(
          res,
          400,
          "INFORMACAO-UPLOAD-400-FILE-TOO-LARGE",
          "A imagem deve ter no máximo 5 MB."
        );
      }

      if (error.code === "LIMIT_FILE_COUNT") {
        return sendUploadError(
          res,
          400,
          "INFORMACAO-UPLOAD-400-TOO-MANY-FILES",
          "Envie apenas uma imagem por publicação."
        );
      }

      if (error.code === "LIMIT_UNEXPECTED_FILE") {
        return sendUploadError(
          res,
          400,
          "INFORMACAO-UPLOAD-400-UNEXPECTED-FIELD",
          'Campo de arquivo inválido. Envie a imagem no campo "imagem".'
        );
      }

      console.error("[informacao][upload][multer-error]", {
        code: error.code,
        message: error.message,
      });

      return sendUploadError(
        res,
        400,
        "INFORMACAO-UPLOAD-400-MULTER-ERROR",
        "Não foi possível processar o upload da imagem.",
        {
          uploadCode: error.code,
        }
      );
    }

    console.error("[informacao][upload][error]", {
      message: error?.message,
      stack: error?.stack,
    });

    return sendUploadError(
      res,
      400,
      "INFORMACAO-UPLOAD-400-INVALID-IMAGE",
      error?.message || "Falha ao enviar a imagem."
    );
  });
}

/* ─────────────────────────────────────────
   Export oficial
───────────────────────────────────────── */

module.exports = {
  uploadInformacaoImagem,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  MIME_TO_EXTENSION,
};