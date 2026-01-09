// ✅ src/routes/chamadasRoutes.js
/* eslint-disable no-console */
const express = require("express");
const { param, validationResult } = require("express-validator");

const ctrl = require("../controllers/chamadasController");
const trabCtrl = require("../controllers/trabalhosController");

// Middlewares do projeto
const injectDb = require("../middlewares/injectDb");

// 🔐 Auth resiliente
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware || _auth?.auth;
if (typeof requireAuth !== "function") {
  console.error("[chamadasRoutes] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

const _roles = require("../auth/authorizeRoles");
const authorizeRoles =
  typeof _roles === "function" ? _roles : _roles?.default || _roles?.authorizeRoles;
if (typeof authorizeRoles !== "function") {
  console.error("[chamadasRoutes] authorizeRoles inválido:", _roles);
  throw new Error("authorizeRoles não é função (verifique exports em src/auth/authorizeRoles.js)");
}

const router = express.Router();

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

// Cache curtinho para arquivos públicos (ideal para <img> sem token)
function cachePublicoCurto(_req, res, next) {
  res.setHeader("Cache-Control", "public, max-age=3600, immutable");
  next();
}

// Admin -> no-store
function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
}

/* ✅ injeta DB uma vez */
router.use(injectDb);

/* =================================================================== */
/* Público / Usuário  (montado sob /api)                               */
/* =================================================================== */

// Lista chamadas publicadas (com flag dentro_prazo)
router.get("/chamadas/ativas", asyncHandler(ctrl.listarAtivas));
router.get("/chamadas/publicadas", asyncHandler(ctrl.listarAtivas)); // alias

// Detalhe de uma chamada (linhas / critérios / limites)
router.get(
  "/chamadas/:id",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(ctrl.obterChamada)
);

// Modelo de banner padrão (legado/global)
router.get("/modelos/banner-padrao.pptx", cachePublicoCurto, asyncHandler(ctrl.exportarModeloBanner));

/* =================================================================== */
/* Administração (Escola da Saúde)  (montado sob /api/admin)           */
/* =================================================================== */

/**
 * ✅ Premium: protege TODO /admin de uma vez,
 * reduz risco de esquecer middleware em rota nova.
 */
router.use("/admin", requireAuth, authorizeRoles("administrador"), noStore);

// Listar chamadas (admin)
router.get("/admin/chamadas", asyncHandler(ctrl.listarAdmin));

// Criar / Atualizar chamadas
router.post("/admin/chamadas", asyncHandler(ctrl.criar));
router.put(
  "/admin/chamadas/:id",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(ctrl.atualizar)
);

// Publicar / Despublicar chamada (aceita POST/PUT/PATCH)
router.post(
  "/admin/chamadas/:id/publicar",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(ctrl.publicar)
);
router.put(
  "/admin/chamadas/:id/publicar",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(ctrl.publicar)
);
router.patch(
  "/admin/chamadas/:id/publicar",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(ctrl.publicar)
);

// Excluir chamada
router.delete(
  "/admin/chamadas/:id",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(ctrl.remover)
);

/* =================================================================== */
/* Administração — Submissões (sem exigir chamadaId)                   */
/* =================================================================== */

// Todas as submissões (admin) — opcional
if (typeof trabCtrl.listarSubmissoesAdminTodas === "function") {
  router.get("/admin/submissoes", asyncHandler(trabCtrl.listarSubmissoesAdminTodas));
}

// Submissões por chamada (compat com página atual)
router.get(
  "/admin/chamadas/:chamadaId/submissoes",
  [param("chamadaId").isInt({ min: 1 }).withMessage("chamadaId inválido.").toInt()],
  validate,
  asyncHandler(trabCtrl.listarSubmissoesAdmin)
);

// Avaliação escrita / oral
router.post(
  "/admin/submissoes/:id/avaliar",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(trabCtrl.avaliarEscrita)
);
router.post(
  "/admin/submissoes/:id/avaliar-oral",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(trabCtrl.avaliarOral)
);

// Definir status final
router.post(
  "/admin/submissoes/:id/status",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(trabCtrl.definirStatusFinal)
);

// Consolidar classificação (Top 40 + Top 6 por linha)
router.post(
  "/admin/chamadas/:chamadaId/classificar",
  [param("chamadaId").isInt({ min: 1 }).withMessage("chamadaId inválido.").toInt()],
  validate,
  asyncHandler(trabCtrl.consolidarClassificacao)
);

module.exports = router;
