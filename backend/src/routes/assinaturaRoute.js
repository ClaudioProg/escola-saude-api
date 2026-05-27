/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/assinaturaRoute.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Rotas oficiais para assinatura digital do usuário autenticado.
 *
 * Mount oficial:
 * - /api/assinatura
 *
 * Rotas oficiais:
 * - GET  /api/assinatura
 * - HEAD /api/assinatura
 * - POST /api/assinatura
 * - POST /api/assinatura/auto
 * - GET  /api/assinatura/lista
 * - HEAD /api/assinatura/lista
 *
 * Contrato:
 * - Autenticação obrigatória em todas as rotas.
 * - Qualquer usuário autenticado pode obter, salvar ou autogerar a própria assinatura.
 * - Listagem geral permanece restrita a organizador/administrador.
 *   {
 *     "assinatura": "data:image/png;base64,..."
 *   }
 *
 * Perfis autorizados para listagem:
 * - administrador
 * - organizador
 *
 * Padrão:
 * - Sem aliases.
 * - Sem imports resilientes.
 * - Sem /todas.
 * - Sem múltiplas possibilidades de middleware/controller.
 * - Sem cache.
 * - Diagnóstico por X-Route-Handler.
 */

const express = require("express");
const { body, validationResult } = require("express-validator");

const requireAuth = require("../auth/authMiddleware");
const { authorize } = require("../middlewares/authorize");
const assinaturaController = require("../controllers/assinaturaController");

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   Contratos obrigatórios
────────────────────────────────────────────────────────────── */

if (typeof requireAuth !== "function") {
  throw new Error("[assinaturaRoute] authMiddleware deve exportar uma função.");
}

if (typeof authorize !== "function") {
  throw new Error(
    "[assinaturaRoute] authorize deve ser exportado por middlewares/authorize."
  );
}

function assertHandler(name, handler) {
  if (typeof handler !== "function") {
    throw new Error(
      `[assinaturaRoute] Handler obrigatório ausente: assinaturaController.${name}`
    );
  }
}

assertHandler("getAssinatura", assinaturaController.getAssinatura);
assertHandler("salvarAssinatura", assinaturaController.salvarAssinatura);
assertHandler("listarAssinaturas", assinaturaController.listarAssinaturas);

/* ─────────────────────────────────────────────────────────────
   Constantes oficiais
────────────────────────────────────────────────────────────── */

const MAX_DATAURL_TOTAL = 6 * 1024 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const DATA_IMAGE_URL_RE =
  /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/;

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function routeTag(tag) {
  return (_req, res, next) => {
    res.setHeader("X-Route-Handler", tag);
    return next();
  };
}

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  return next();
}

function respostaErroValidacao(res, fieldErrors) {
  return res.status(400).json({
    ok: false,
    code: "ASSINATURA-400-DADOS-INVALIDOS",
    message: "Dados inválidos para assinatura.",
    fieldErrors,
  });
}

function validate(req, res, next) {
  const errors = validationResult(req);

  if (errors.isEmpty()) return next();

  const fieldErrors = {};

  for (const error of errors.array()) {
    const field = error.path || error.param || "assinatura";

    if (!fieldErrors[field]) {
      fieldErrors[field] = error.msg;
    }
  }

  return respostaErroValidacao(res, fieldErrors);
}

function isDataImageUrl(value) {
  return typeof value === "string" && DATA_IMAGE_URL_RE.test(value.trim());
}

function extractBase64Payload(dataUrl) {
  const match = String(dataUrl || "").match(/^data:[^;]+;base64,([\s\S]+)$/);
  return match ? match[1] : null;
}

function approxBase64Bytes(dataUrl) {
  const payload = extractBase64Payload(dataUrl);

  if (!payload) return 0;

  const base64 = String(payload).replace(/\s/g, "");

  if (!base64) return 0;

  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;

  return Math.floor((base64.length * 3) / 4) - padding;
}

/* ─────────────────────────────────────────────────────────────
   Validações
────────────────────────────────────────────────────────────── */

const validarAssinaturaBody = [
  body("assinatura")
    .exists({ checkFalsy: true })
    .withMessage("Assinatura é obrigatória.")
    .bail()
    .isString()
    .withMessage("Assinatura deve ser enviada como texto.")
    .bail()
    .custom((value) => isDataImageUrl(value))
    .withMessage(
      "Assinatura deve ser uma dataURL válida de imagem PNG, JPG/JPEG ou WEBP."
    )
    .bail()
    .custom((value) => {
      const trimmed = String(value || "").trim();

      if (trimmed.length > MAX_DATAURL_TOTAL) {
        throw new Error("Imagem muito grande. Limite máximo: 6MB.");
      }

      const bytes = approxBase64Bytes(trimmed);

      if (bytes > MAX_IMAGE_BYTES) {
        throw new Error("Imagem muito grande. Payload máximo: 4MB.");
      }

      return true;
    }),
];

/* ─────────────────────────────────────────────────────────────
   Middlewares globais da rota
────────────────────────────────────────────────────────────── */

router.use(requireAuth);
router.use(noStore);

/* ─────────────────────────────────────────────────────────────
   Rotas oficiais
────────────────────────────────────────────────────────────── */

/**
 * GET /api/assinatura
 *
 * Obtém a assinatura do usuário autenticado.
 * O controller pode autogerar assinatura quando aplicável.
 */
router.get(
  "/",
  routeTag("assinaturaRoute:v2.0:GET /"),
  asyncHandler(assinaturaController.getAssinatura)
);

/**
 * HEAD /api/assinatura
 */
router.head(
  "/",
  routeTag("assinaturaRoute:v2.0:HEAD /"),
  (_req, res) => res.sendStatus(204)
);

/**
 * POST /api/assinatura
 *
 * Body:
 * {
 *   "assinatura": "data:image/png;base64,..."
 * }
 */
router.post(
  "/",
  validarAssinaturaBody,
  validate,
  routeTag("assinaturaRoute:v2.0:POST /"),
  asyncHandler(assinaturaController.salvarAssinatura)
);

/**
 * POST /api/assinatura/auto
 *
 * Força autogeração idempotente da assinatura do usuário autenticado.
 */
router.post(
  "/auto",
  routeTag("assinaturaRoute:v2.0:POST /auto"),
  asyncHandler(assinaturaController.getAssinatura)
);

/**
 * GET /api/assinatura/lista
 *
 * Lista assinaturas cadastradas.
 * Restrito a administrador e organizador, conforme contrato atual informado.
 */
router.get(
  "/lista",
  authorize("administrador", "organizador"),
  routeTag("assinaturaRoute:v2.0:GET /lista"),
  asyncHandler(assinaturaController.listarAssinaturas)
);

/**
 * HEAD /api/assinatura/lista
 */
router.head(
  "/lista",
  authorize("administrador", "organizador"),
  routeTag("assinaturaRoute:v2.0:HEAD /lista"),
  (_req, res) => res.sendStatus(204)
);

module.exports = router;