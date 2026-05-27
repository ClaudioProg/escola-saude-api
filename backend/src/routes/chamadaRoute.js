/* eslint-disable no-console */
"use strict";

/**
 * 📁 src/routes/chamadaRoute.js
 * Atualizado em: 15/05/2026
 *
 * Plataforma Escola da Saúde — v2.0
 *
 * Rotas oficiais de CHAMADAS DE TRABALHOS.
 *
 * Mount oficial:
 * - app.use("/api/chamada", chamadaRoute);
 *
 * Responsabilidades deste router:
 * - chamadas públicas ativas;
 * - detalhe público de chamada;
 * - CRUD administrativo de chamada;
 * - publicação/despublicação de chamada;
 * - modelo padrão de banner;
 * - modelo de banner/oral vinculado à chamada.
 *
 * Fora deste router:
 * - submissões;
 * - avaliações de trabalhos;
 * - classificação;
 * - votação;
 * - certificados de trabalhos.
 *
 * Contrato v2.0:
 * - sem /api/chamadas;
 * - sem rotas duplicadas plural/singular;
 * - sem /ativas ou /publicadas;
 * - sem /admin/chamada dentro do router;
 * - sem req.usuario;
 * - sem auth resiliente;
 * - sem authorize resiliente;
 * - sem respostas { erro };
 * - campo multipart oficial para modelos: "arquivo".
 */

const express = require("express");
const rateLimit = require("express-rate-limit");
const { param, validationResult } = require("express-validator");

const router = express.Router();

const ctrl = require("../controllers/chamadaController");

const injectDb = require("../middlewares/injectDb");
const requireAuth = require("../auth/authMiddleware");
const { authorize } = require("../middlewares/authorize");

/* =========================================================================
   Guards estruturais
=========================================================================== */

if (typeof requireAuth !== "function") {
  throw new Error(
    "[chamadaRoute] authMiddleware oficial inválido. Esperado export direto como função."
  );
}

if (typeof authorize !== "function") {
  throw new Error(
    "[chamadaRoute] authorize oficial inválido. Esperado export nomeado { authorize }."
  );
}

/* =========================================================================
   Helpers
=========================================================================== */

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function criarErroValidacao(req, errors) {
  const err = new Error("Parâmetros inválidos.");
  err.status = 400;
  err.code = "PARAMETROS_INVALIDOS";
  err.adminHint =
    "A rota recebeu parâmetro fora do contrato oficial definido no express-validator.";
  err.details = errors.array().map((error) => ({
    field: error.path || error.param,
    message: error.msg,
    value: error.value,
  }));
  err.requestId = req.requestId || req.rid || null;
  return err;
}

function validate(req, _res, next) {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  return next(criarErroValidacao(req, errors));
}

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
}

function getRateLimitKey(req) {
  return String(req.user?.id || req.ip || req.headers["x-forwarded-for"] || "anon");
}

const idParam = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("ID inválido.")
    .toInt(),
];

const adminUploadModeloLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getRateLimitKey,
  message: {
    ok: false,
    data: null,
    message: "Muitos envios em pouco tempo. Aguarde alguns minutos e tente novamente.",
    code: "RATE_LIMIT_UPLOAD_MODELO",
    adminHint:
      "Limite de upload de modelo de chamada excedido para o usuário/IP no intervalo configurado.",
    details: null,
  },
});

/* =========================================================================
   Middlewares globais da rota
=========================================================================== */

router.use(injectDb);

/* =========================================================================
   Público / usuário
=========================================================================== */

/**
 * Modelo padrão global de banner.
 *
 * GET /api/chamada/modelo/banner-padrao.pptx
 */
router.get(
  "/modelo/banner-padrao.pptx",
  asyncHandler(ctrl.exportarModeloBanner)
);

/**
 * Chamadas públicas ativas/publicadas.
 *
 * GET /api/chamada/ativa
 */
router.get(
  "/ativa",
  asyncHandler(ctrl.listarAtivas)
);

/**
 * Detalhe público de uma chamada.
 *
 * GET /api/chamada/:id
 */
router.get(
  "/:id(\\d+)",
  idParam,
  validate,
  asyncHandler(ctrl.obterChamada)
);

/**
 * Download público do modelo de banner da chamada.
 *
 * HEAD /api/chamada/:id/modelo-banner
 * GET  /api/chamada/:id/modelo-banner
 */
router.head(
  "/:id(\\d+)/modelo-banner",
  idParam,
  validate,
  asyncHandler(ctrl.baixarModeloBanner)
);

router.get(
  "/:id(\\d+)/modelo-banner",
  idParam,
  validate,
  asyncHandler(ctrl.baixarModeloBanner)
);

/**
 * Download público do modelo de apresentação oral da chamada.
 *
 * HEAD /api/chamada/:id/modelo-oral
 * GET  /api/chamada/:id/modelo-oral
 */
router.head(
  "/:id(\\d+)/modelo-oral",
  idParam,
  validate,
  asyncHandler(ctrl.baixarModeloOral)
);

router.get(
  "/:id(\\d+)/modelo-oral",
  idParam,
  validate,
  asyncHandler(ctrl.baixarModeloOral)
);

/* =========================================================================
   Admin — proteção única
=========================================================================== */

router.use("/admin", requireAuth, authorize("administrador"), noStore);

/* =========================================================================
   Admin — chamadas
=========================================================================== */

/**
 * Lista administrativa de chamadas.
 *
 * GET /api/chamada/admin
 */
router.get(
  "/admin",
  asyncHandler(ctrl.listarAdmin)
);

/**
 * Cria chamada.
 *
 * POST /api/chamada/admin
 */
router.post(
  "/admin",
  asyncHandler(ctrl.criar)
);

/**
 * Atualiza chamada.
 *
 * PUT /api/chamada/admin/:id
 */
router.put(
  "/admin/:id(\\d+)",
  idParam,
  validate,
  asyncHandler(ctrl.atualizar)
);

/**
 * Publica/despublica chamada.
 *
 * Body oficial:
 * {
 *   "publicado": true | false
 * }
 *
 * PATCH /api/chamada/admin/:id/publicacao
 */
router.patch(
  "/admin/:id(\\d+)/publicacao",
  idParam,
  validate,
  asyncHandler(ctrl.publicar)
);

/**
 * Remove chamada apenas quando não houver submissões vinculadas.
 *
 * DELETE /api/chamada/admin/:id
 */
router.delete(
  "/admin/:id(\\d+)",
  idParam,
  validate,
  asyncHandler(ctrl.remover)
);

/* =========================================================================
   Admin — modelos da chamada
=========================================================================== */

/**
 * Metadados do modelo de banner.
 *
 * GET /api/chamada/admin/:id/modelo-banner/meta
 */
router.get(
  "/admin/:id(\\d+)/modelo-banner/meta",
  idParam,
  validate,
  asyncHandler(ctrl.modeloBannerMeta)
);

/**
 * Download administrativo do modelo de banner.
 *
 * GET /api/chamada/admin/:id/modelo-banner/download
 */
router.get(
  "/admin/:id(\\d+)/modelo-banner/download",
  idParam,
  validate,
  asyncHandler(ctrl.baixarModeloBanner)
);

/**
 * Upload administrativo do modelo de banner.
 *
 * Campo multipart oficial:
 * - arquivo
 *
 * POST /api/chamada/admin/:id/modelo-banner
 */
router.post(
  "/admin/:id(\\d+)/modelo-banner",
  adminUploadModeloLimiter,
  idParam,
  validate,
  ctrl.importarModeloBanner
);

/**
 * Metadados do modelo oral.
 *
 * GET /api/chamada/admin/:id/modelo-oral/meta
 */
router.get(
  "/admin/:id(\\d+)/modelo-oral/meta",
  idParam,
  validate,
  asyncHandler(ctrl.modeloOralMeta)
);

/**
 * Download administrativo do modelo oral.
 *
 * GET /api/chamada/admin/:id/modelo-oral/download
 */
router.get(
  "/admin/:id(\\d+)/modelo-oral/download",
  idParam,
  validate,
  asyncHandler(ctrl.baixarModeloOral)
);

/**
 * Upload administrativo do modelo oral.
 *
 * Campo multipart oficial:
 * - arquivo
 *
 * POST /api/chamada/admin/:id/modelo-oral
 */
router.post(
  "/admin/:id(\\d+)/modelo-oral",
  adminUploadModeloLimiter,
  idParam,
  validate,
  ctrl.importarModeloOral
);

module.exports = router;