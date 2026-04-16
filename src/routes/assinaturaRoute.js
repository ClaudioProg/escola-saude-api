// src/routes/assinaturaRoute.js
/* eslint-disable no-console */
"use strict";

const express = require("express");
const { body, validationResult } = require("express-validator");

const router = express.Router();

/* =========================
   Imports resilientes
========================= */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default || _auth?.authMiddleware || _auth?.authAny;

if (typeof requireAuth !== "function") {
  console.error("[assinaturaRoute] authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
}

const _roles = require("../middlewares/authorize");
const authorizeRoles =
  _roles?.authorizeRoles ||
  _roles?.authorizeRole ||
  _roles?.authorize?.any ||
  _roles?.authorize;

if (typeof authorizeRoles !== "function") {
  console.error("[assinaturaRoute] authorizeRoles inválido:", _roles);
  throw new Error(
    "authorizeRoles não é função (verifique exports em src/middlewares/authorize.js)"
  );
}

const ctrl = require("../controllers/assinaturaController");

/* =========================
   Constantes alinhadas ao controller
========================= */
// ✅ manter alinhado ao assinaturaController.js
const MAX_DATAURL_TOTAL = 6 * 1024 * 1024; // 6MB
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;   // 4MB

/* =========================
   Helpers (premium)
========================= */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  return res.status(400).json({
    ok: false,
    erro: "Dados inválidos.",
    detalhes: errors.array().map((e) => ({
      campo: e.path || e.param,
      msg: e.msg,
    })),
    requestId: res.getHeader?.("X-Request-Id"),
  });
}

// ✅ alinhado ao controller: png / jpg / jpeg / webp
function isDataImageUrl(v) {
  if (typeof v !== "string") return false;
  return /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/.test(v.trim());
}

function extractBase64Payload(dataUrl) {
  const m = String(dataUrl || "").match(/^data:[^;]+;base64,([\s\S]+)$/);
  return m ? m[1] : null;
}

// mesma lógica aproximada do controller
function approxBase64Bytes(dataUrl) {
  const b64 = extractBase64Payload(dataUrl);
  if (!b64) return 0;

  const s = String(b64).replace(/\s/g, "");
  if (!s) return 0;

  const padding = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0;
  return Math.floor((s.length * 3) / 4) - padding;
}

/* =========================
   Middlewares do grupo
========================= */
// 🔐 todas as rotas exigem autenticação
router.use(requireAuth);

// 🛡️ dado sensível → não cachear
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

/* =========================
   Rotas
========================= */
/**
 * 🖋️ Obter assinatura do usuário autenticado
 * GET /api/assinatura
 * - Se usuário for instrutor/administrador e NÃO tiver assinatura,
 *   o controller auto-gera e persiste.
 */
router.get("/", asyncHandler(ctrl.getAssinatura));

/**
 * ✍️ Salvar/atualizar assinatura do usuário autenticado
 * POST /api/assinatura
 * body: { assinatura: "data:image/png;base64,..." }
 */
router.post(
  "/",
  [
    body("assinatura")
      .exists({ checkFalsy: true })
      .withMessage('"assinatura" é obrigatória.')
      .bail()
      .isString()
      .withMessage('"assinatura" deve ser string.')
      .bail()
      .custom((v) => isDataImageUrl(v))
      .withMessage("Assinatura deve ser uma dataURL válida de imagem (PNG, JPG/JPEG ou WEBP).")
      .bail()
      .custom((v) => {
        const trimmed = String(v).trim();

        if (trimmed.length > MAX_DATAURL_TOTAL) {
          throw new Error("Imagem muito grande (limite 6MB).");
        }

        const bytes = approxBase64Bytes(trimmed);
        if (bytes > MAX_IMAGE_BYTES) {
          throw new Error("Imagem muito grande (payload > 4MB).");
        }

        return true;
      }),
  ],
  validate,
  asyncHandler(ctrl.salvarAssinatura)
);

/**
 * ⚡ Forçar autogeração idempotente
 * POST /api/assinatura/auto
 */
router.post("/auto", asyncHandler(ctrl.getAssinatura));

/**
 * 📜 Listar assinaturas cadastradas
 * GET /api/assinatura/lista
 * GET /api/assinatura/todas
 * restrito a administradores/instrutores
 */
router.get(
  ["/lista", "/todas"],
  authorizeRoles("administrador", "instrutor"),
  asyncHandler(ctrl.listarAssinaturas)
);

module.exports = router;