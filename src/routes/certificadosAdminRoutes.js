// ✅ src/routes/certificadosAdminRoutes.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const { param, validationResult } = require("express-validator");

const router = express.Router();

const ctrl = require("../controllers/certificadosAdminController");
const auth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

/* =========================
   Helpers
========================= */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({
    erro: "Parâmetros inválidos.",
    detalhes: errors.array().map((e) => ({ campo: e.path, msg: e.msg })),
  });
}

/* =========================
   Rate limit (reset é perigoso)
========================= */
const resetLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas operações sensíveis. Aguarde antes de tentar novamente." },
});

/* =========================
   Proteção do grupo (admin)
========================= */
router.use(auth, authorizeRoles("administrador"));

// Dados administrativos -> não cachear
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

/* =========================
   Rotas
========================= */

// árvore: eventos → turmas → participantes
router.get("/arvore", asyncHandler(ctrl.listarArvore));

// reset por turma
router.post(
  "/turmas/:turmaId/reset",
  resetLimiter,
  [param("turmaId").isInt({ min: 1 }).withMessage("turmaId inválido.").toInt()],
  validate,
  asyncHandler(ctrl.resetTurma)
);

module.exports = router;
