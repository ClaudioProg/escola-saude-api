//src/routes/assinaturaRoute.js
/* eslint-disable no-console */
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
    : _auth?.default || _auth?.authMiddleware;

if (typeof requireAuth !== "function") {
  console.error("[assinaturaRoute] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

const _roles = require("../middlewares/authorize");
const authorizeRoles =
  typeof _roles === "function"
    ? _roles
    : _roles?.default || _roles?.authorizeRoles;

if (typeof authorizeRoles !== "function") {
  console.error("[assinaturaRoute] authorizeRoles inválido:", _roles);
  throw new Error("authorizeRoles não é função (verifique exports em src/middlewares/authorize.js)");
}

const ctrl = require("../controllers/assinaturaController");

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
    detalhes: errors.array().map((e) => ({ campo: e.path || e.param, msg: e.msg })),
    requestId: res.getHeader?.("X-Request-Id"),
  });
}

// valida “data URL” de imagem (PNG/JPEG) e tamanho aproximado (base64)
function isDataImageUrl(v) {
  if (typeof v !== "string") return false;
  // png/jpg/jpeg
  return /^data:image\/(png|jpe?g);base64,[a-z0-9+/=\s]+$/i.test(v);
}
function approxBase64Bytes(dataUrl) {
  // remove prefixo "data:image/...;base64,"
  const b64 = dataUrl.split(",")[1] || "";
  // 4 chars base64 ~ 3 bytes
  return Math.floor((b64.replace(/\s/g, "").length * 3) / 4);
}

/* =========================
   Middlewares do grupo
========================= */
// 🔐 todas as rotas exigem autenticação
router.use(requireAuth);

// 🛡️ Premium: assinatura é dado sensível → não cachear (todas as rotas)
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
 *   o controller auto-gera uma assinatura (PNG em dataURL) e persiste.
 * - Retorna { assinatura: string|null }
 */
router.get("/", asyncHandler(ctrl.getAssinatura));

/**
 * ✍️ Salvar/atualizar assinatura do usuário autenticado (dataURL)
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
      .custom((v) => isDataImageUrl(v))
      .withMessage('Assinatura deve ser uma dataURL de imagem (PNG/JPG).')
      .bail()
      .custom((v) => {
        const bytes = approxBase64Bytes(v);
        // 1.5MB é mais que suficiente p/ assinatura; ajusta se quiser
        if (bytes > 1_500_000) throw new Error("Assinatura muito grande. Reduza a resolução.");
        return true;
      }),
  ],
  validate,
  asyncHandler(ctrl.salvarAssinatura)
);

/**
 * ⚡ Forçar autogeração idempotente (atalho)
 * POST /api/assinatura/auto
 * - Útil para o front acionar explicitamente a criação automática quando quiser.
 * - Apenas delega ao getAssinatura (que já é idempotente).
 */
router.post("/auto", asyncHandler(ctrl.getAssinatura));

/**
 * 📜 Listar assinaturas cadastradas (metadados para dropdown)
 * GET /api/assinatura/lista  ✅ caminho usado no frontend
 * GET /api/assinatura/todas  🔁 alias (compat)
 * ⛑️ restrito a administradores/instrutores
 */
router.get(
  ["/lista", "/todas"],
  authorizeRoles("administrador", "instrutor"),
  asyncHandler(ctrl.listarAssinaturas)
);

module.exports = router;
