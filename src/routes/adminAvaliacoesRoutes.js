// 📁 src/routes/adminAvaliacoesRoutes.js
const express = require("express");
const { param, validationResult } = require("express-validator");

const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const adminCtrl = require("../controllers/adminAvaliacoesController");

const router = express.Router();

/* =========================
   Helpers (premium)
========================= */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  return res.status(400).json({
    ok: false,
    erro: "Parâmetros inválidos.",
    detalhes: errors.array().map((e) => ({ campo: e.param, msg: e.msg })),
    requestId: res.getHeader?.("X-Request-Id"),
  });
}

// evita try/catch duplicado em controllers
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// IDs numéricos (Postgres serial) — se em algum momento virar UUID, é só ajustar aqui.
const idParam = (name) =>
  param(name)
    .exists({ checkFalsy: true })
    .withMessage(`"${name}" é obrigatório.`)
    .bail()
    .isInt({ min: 1 })
    .withMessage(`"${name}" deve ser um inteiro >= 1.`)
    .toInt();

/* =========================
   Middlewares do grupo
========================= */
// 🔐 Protege todo o grupo: só administradores
router.use(authMiddleware, authorizeRoles("administrador"));

// 🛡️ Premium: recomenda não cachear respostas admin
router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

/* =========================
   Rotas
========================= */
/**
 * GET /api/admin/avaliacoes/eventos
 * Lista eventos com resumo de avaliações (contagens/médias) para o painel
 */
router.get("/eventos", asyncHandler(adminCtrl.listarEventosComAvaliacoes));

/**
 * GET /api/admin/avaliacoes/evento/:evento_id
 * Retorna:
 * { respostas, agregados: { total, dist, medias, textos, mediaOficial }, turmas }
 */
router.get(
  "/evento/:evento_id",
  [idParam("evento_id")],
  validate,
  asyncHandler(adminCtrl.obterAvaliacoesDoEvento)
);

/**
 * GET /api/admin/avaliacoes/turma/:turma_id
 * Retorna formato equivalente ao do evento (visão admin)
 */
router.get(
  "/turma/:turma_id",
  [idParam("turma_id")],
  validate,
  asyncHandler(adminCtrl.obterAvaliacoesDaTurma)
);

module.exports = router;
