// 📁 src/middlewares/uploadInformacoes.js
/* eslint-disable no-console */
"use strict";

const crypto = require("crypto");
const path = require("path");
const multer = require("multer");

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
]);

const mimeToExtension = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

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

function buildSafeFilename(file) {
  const safeBase = sanitizeBaseFilename(file?.originalname);
  const mimeExt = mimeToExtension[file?.mimetype];
  const originalExt = path.extname(file?.originalname || "").toLowerCase();
  const ext = mimeExt || originalExt || ".jpg";
  const stamp = Date.now();
  const nonce = crypto.randomBytes(4).toString("hex");

  return `informacao-${stamp}-${nonce}-${safeBase}${ext}`;
}

function fileFilter(_req, file, cb) {
  if (!file || !file.mimetype) {
    return cb(new Error("Arquivo de imagem inválido."));
  }

  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(new Error("Formato de imagem inválido. Envie JPG, PNG ou WEBP."));
  }

  return cb(null, true);
}

const uploadInformacaoImagem = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
}).single("imagem");

function handleUploadInformacaoImagem(req, res, next) {
  uploadInformacaoImagem(req, res, (error) => {
    if (!error) {
      if (req.file) {
        req.file.safeFilename = buildSafeFilename(req.file);
        req.file.detectedExtension =
          mimeToExtension[req.file.mimetype] ||
          path.extname(req.file.originalname || "").toLowerCase() ||
          ".jpg";
      }

      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          ok: false,
          mensagem: "A imagem deve ter no máximo 5 MB.",
        });
      }

      if (error.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          ok: false,
          mensagem: "Envie apenas uma imagem por publicação.",
        });
      }

      console.error("[informacoes][upload][multer-erro]", {
        code: error.code,
        message: error.message,
      });

      return res.status(400).json({
        ok: false,
        mensagem: "Não foi possível processar o upload da imagem.",
      });
    }

    console.error("[informacoes][upload][erro]", {
      error: error?.message,
      stack: error?.stack,
    });

    return res.status(400).json({
      ok: false,
      mensagem: error?.message || "Falha ao enviar a imagem.",
    });
  });
}

/**
 * Compatibilidade:
 * Como agora a imagem deve ficar persistida no banco,
 * não usamos mais caminho relativo em disco.
 */
function getImageRelativePath(_filename) {
  return null;
}

/**
 * Compatibilidade:
 * não há mais arquivo salvo em disco para resolver.
 */
function resolveImageAbsolutePath(_relativePath) {
  return null;
}

/**
 * Compatibilidade:
 * não há mais arquivo salvo em disco para remover.
 */
function removeFileIfExists(_filePath) {
  return false;
}

module.exports = {
  uploadInformacaoImagem: handleUploadInformacaoImagem,
  getImageRelativePath,
  resolveImageAbsolutePath,
  removeFileIfExists,
  uploadRoot: null,
};