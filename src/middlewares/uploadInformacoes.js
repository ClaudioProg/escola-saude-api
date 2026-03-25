/* eslint-disable no-console */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const { UPLOADS_DIR, ensureDir } = require("../paths");

const uploadRoot = path.join(UPLOADS_DIR, "informacoes");
ensureDir(uploadRoot);

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg"
]);

const mimeToExtension = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadRoot);
  },

  filename: (_req, file, cb) => {
    try {
      const safeBase = sanitizeBaseFilename(file.originalname);
      const mimeExt = mimeToExtension[file.mimetype];
      const originalExt = path.extname(file.originalname || "").toLowerCase();
      const ext = mimeExt || originalExt || ".jpg";
      const stamp = Date.now();
      const nonce = crypto.randomBytes(4).toString("hex");

      cb(null, `informacao-${stamp}-${nonce}-${safeBase}${ext}`);
    } catch (error) {
      cb(error);
    }
  }
});

function fileFilter(_req, file, cb) {
  if (!file || !file.mimetype) {
    return cb(new Error("Arquivo de imagem inválido."));
  }

  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(new Error("Formato de imagem inválido. Envie JPG, PNG ou WEBP."));
  }

  cb(null, true);
}

const uploadInformacaoImagem = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  }
}).single("imagem");

function handleUploadInformacaoImagem(req, res, next) {
  uploadInformacaoImagem(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          ok: false,
          mensagem: "A imagem deve ter no máximo 5 MB."
        });
      }

      if (error.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          ok: false,
          mensagem: "Envie apenas uma imagem por publicação."
        });
      }

      console.error("[informacoes][upload][multer-erro]", {
        code: error.code,
        message: error.message
      });

      return res.status(400).json({
        ok: false,
        mensagem: "Não foi possível processar o upload da imagem."
      });
    }

    console.error("[informacoes][upload][erro]", {
      error: error?.message,
      stack: error?.stack
    });

    return res.status(400).json({
      ok: false,
      mensagem: error?.message || "Falha ao enviar a imagem."
    });
  });
}

function getImageRelativePath(filename) {
  if (!filename) return null;
  return `uploads/informacoes/${filename}`;
}

function resolveImageAbsolutePath(relativePath) {
  if (!relativePath) return null;

  const cleanRelativePath = String(relativePath).replace(/^\/+/, "");

  return path.resolve(process.cwd(), cleanRelativePath);
}

function removeFileIfExists(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (error) {
    console.error("[informacoes][upload][remove-file-erro]", {
      filePath,
      error: error?.message
    });
  }

  return false;
}

module.exports = {
  uploadInformacaoImagem: handleUploadInformacaoImagem,
  getImageRelativePath,
  resolveImageAbsolutePath,
  removeFileIfExists,
  uploadRoot
};