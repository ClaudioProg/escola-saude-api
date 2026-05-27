"use strict";

/**
 * ✅ backend/src/routes/uploadRoute.js — v2.0
 * Atualizado em: 19/05/2026
 *
 * Plataforma Escola da Saúde
 *
 * Módulo:
 * - Upload/download do modelo global de banner de trabalhos.
 *
 * Mount oficial esperado:
 * - app.use("/api", uploadRoute);
 *
 * Rotas oficiais:
 * - GET  /api/modelos/banner.pptx
 * - POST /api/admin/modelos/banner
 *
 * Contrato oficial:
 * - Upload multipart/form-data no campo único: file
 * - Arquivo persistido no banco pela controller em trabalhos_modelos
 * - Sem storage físico local
 * - Sem aliases
 * - Sem rota global legada
 * - Sem rota por chamada neste arquivo
 * - Sem resposta { erro }
 * - Resposta padrão ok/data/message/code/meta
 * - Erro padrão ok:false/data:null/message/code/adminHint/details/requestId
 *
 * Autorização:
 * - authMiddleware deve autenticar.
 * - authorize("administrador") deve autorizar.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");
const multer = require("multer");

const authMiddleware = require("../auth/authMiddleware");
const { authorize } = require("../middlewares/authorize");

const {
  baixarModeloBanner,
  subirModeloBanner,
} = require("../controllers/uploadController");

const router = express.Router();

/* =========================================================================
   Validação estrutural de imports
=========================================================================== */

if (typeof authMiddleware !== "function") {
  throw new Error(
    "[uploadRoute] authMiddleware inválido. O export oficial de ../auth/authMiddleware deve ser uma função."
  );
}

if (typeof authorize !== "function") {
  throw new Error(
    "[uploadRoute] authorize inválido. O export oficial de ../middlewares/authorize deve expor { authorize } como função."
  );
}

for (const [nome, handler] of Object.entries({
  baixarModeloBanner,
  subirModeloBanner,
})) {
  if (typeof handler !== "function") {
    throw new Error(`[uploadRoute] Controller inválido. Função ausente: ${nome}.`);
  }
}

/* =========================================================================
   Autorização oficial
=========================================================================== */

const requireAdministrador = authorize("administrador");

/* =========================================================================
   Contrato de upload
=========================================================================== */

const MAX_BYTES = 50 * 1024 * 1024;

const PPT_MIMES_OFICIAIS = new Set([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
]);

/**
 * Validação preliminar.
 *
 * A validação final e documental fica no uploadController.js.
 * Aqui barramos apenas erros óbvios antes de chegar no controller.
 */
const uploadMemoria = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const originalname = String(file?.originalname || "").trim();
    const mimetype = String(file?.mimetype || "").trim().toLowerCase();

    const extensaoValida = /\.(ppt|pptx)$/i.test(originalname);
    const mimeValido = PPT_MIMES_OFICIAIS.has(mimetype);

    if (!extensaoValida) {
      const error = new Error("Formato inválido. Envie um arquivo .ppt ou .pptx.");
      error.status = 400;
      error.code = "EXTENSAO_INVALIDA";
      return cb(error);
    }

    if (!mimeValido) {
      const error = new Error("MIME inválido para apresentação PowerPoint.");
      error.status = 400;
      error.code = "MIME_INVALIDO";
      return cb(error);
    }

    return cb(null, true);
  },
});

const uploadModeloBanner = uploadMemoria.single("file");

/* =========================================================================
   Helpers
=========================================================================== */

function gerarRequestId() {
  return `upload-route-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function wrap(handler) {
  return async function wrappedHandler(req, res, next) {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  return next();
}

/* =========================================================================
   Rate limits
=========================================================================== */

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.ip),
  handler: (_req, res) => {
    const requestId = gerarRequestId();

    return res.status(429).json({
      ok: false,
      data: null,
      message: "Muitas requisições. Aguarde alguns instantes e tente novamente.",
      code: "RATE_LIMIT_MODELO_BANNER_DOWNLOAD",
      adminHint: "Rate limit aplicado ao download do modelo de banner.",
      details: null,
      requestId,
    });
  },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || req.ip),
  handler: (req, res) => {
    const requestId = gerarRequestId();

    return res.status(429).json({
      ok: false,
      data: null,
      message: "Muitas tentativas de upload. Aguarde e tente novamente.",
      code: "RATE_LIMIT_MODELO_BANNER_UPLOAD",
      adminHint: "Rate limit aplicado ao upload administrativo do modelo de banner.",
      details: {
        usuario_id: req.user?.id || null,
      },
      requestId,
    });
  },
});

/* =========================================================================
   Rotas oficiais
=========================================================================== */

/**
 * Download público/autenticado conforme regra do mount.
 *
 * Controller:
 * - busca em trabalhos_modelos
 * - retorna PPT/PPTX com ETag, Last-Modified, SHA-256 e headers seguros.
 */
router.get(
  "/modelos/banner.pptx",
  downloadLimiter,
  wrap(baixarModeloBanner)
);

/**
 * Upload administrativo do modelo global de banner.
 *
 * multipart/form-data:
 * - campo oficial: file
 */
router.post(
  "/admin/modelos/banner",
  authMiddleware,
  requireAdministrador,
  noStore,
  uploadLimiter,
  uploadModeloBanner,
  wrap(subirModeloBanner)
);

/* =========================================================================
   Tratamento de erro do multer
=========================================================================== */

router.use((error, _req, res, next) => {
  if (!error) return next();

  const requestId = gerarRequestId();

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        ok: false,
        data: null,
        message: "Arquivo muito grande. O limite é de 50 MB.",
        code: "ARQUIVO_MUITO_GRANDE",
        adminHint: "Reduza o tamanho do arquivo PPT/PPTX antes do envio.",
        details: {
          multerCode: error.code,
          limitBytes: MAX_BYTES,
        },
        requestId,
      });
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        ok: false,
        data: null,
        message: "Campo de arquivo inválido. Use o campo oficial file.",
        code: "CAMPO_ARQUIVO_INVALIDO",
        adminHint:
          "O upload v2.0 aceita apenas multipart/form-data com o campo file.",
        details: {
          multerCode: error.code,
          field: error.field || null,
        },
        requestId,
      });
    }

    return res.status(400).json({
      ok: false,
      data: null,
      message: "Erro no upload do arquivo.",
      code: "UPLOAD_MULTER_ERRO",
      adminHint: "Verifique campo, tamanho e formato do arquivo enviado.",
      details: {
        multerCode: error.code,
        field: error.field || null,
      },
      requestId,
    });
  }

  if (error?.status && error.status < 500) {
    return res.status(error.status).json({
      ok: false,
      data: null,
      message: error.message || "Arquivo inválido.",
      code: error.code || "UPLOAD_ARQUIVO_INVALIDO",
      adminHint: "Verifique extensão, MIME e campo oficial file.",
      details: null,
      requestId,
    });
  }

  return next(error);
});

module.exports = router;