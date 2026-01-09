// 📁 src/routes/avaliacoesRoute.js
const express = require("express");
const { param, validationResult } = require("express-validator");

const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

const {
  enviarAvaliacao,
  listarAvaliacoesDisponiveis,
  listarPorTurmaParaInstrutor, // ✅ para a página do instrutor
  avaliacoesPorTurma,          // ✅ admin: todas as respostas da turma
  avaliacoesPorEvento,         // ✅ admin: agregado por evento
} = require("../controllers/avaliacoesController");

const router = express.Router();

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
    erro: "Parâmetros inválidos.",
    detalhes: errors.array().map((e) => ({ campo: e.path || e.param, msg: e.msg })),
    requestId: res.getHeader?.("X-Request-Id"),
  });
}

const idParam = (name) =>
  param(name)
    .exists({ checkFalsy: true })
    .withMessage(`"${name}" é obrigatório.`)
    .bail()
    .isInt({ min: 1 })
    .withMessage(`"${name}" deve ser um inteiro >= 1.`)
    .toInt();

function getPerfis(user) {
  // suporta user.perfis (string/array) e user.perfil (string/array)
  const raw = user?.perfis ?? user?.perfil ?? "";
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return String(raw)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/* ────────────── Middlewares auxiliares ────────────── */

// Admin pode ver qualquer usuário; demais perfis só se :usuario_id === id do token
function ensureSelfOrAdmin(req, res, next) {
  const user = req.user || {};
  const tokenId = Number(user.id);
  const paramId = Number(req.params.usuario_id);

  const perfis = getPerfis(user);
  const isAdmin = perfis.includes("administrador");

  if (!Number.isFinite(paramId)) {
    return res.status(400).json({ erro: "usuario_id inválido." });
  }
  if (isAdmin || tokenId === paramId) return next();
  return res.status(403).json({ erro: "Acesso negado." });
}

/* =========================
   Middlewares do grupo
========================= */
router.use(authMiddleware);

// 🛡️ Premium: avaliações podem conter comentários → não cachear
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

/* ───────────────── Rotas ───────────────── */

// 📝 1) Enviar avaliação
router.post(
  "/",
  authorizeRoles("administrador", "instrutor", "usuario"),
  asyncHandler(enviarAvaliacao)
);

// 📊 2b) (Admin) Todas as respostas da turma
router.get(
  "/turma/:turma_id/all",
  authorizeRoles("administrador"),
  [idParam("turma_id")],
  validate,
  asyncHandler(avaliacoesPorTurma)
);

// 📊 2) (Instrutor/Admin) Respostas da turma (restrito ao instrutor vinculado)
router.get(
  "/turma/:turma_id",
  authorizeRoles("instrutor", "administrador"),
  [idParam("turma_id")],
  validate,
  asyncHandler(listarPorTurmaParaInstrutor)
);

// 🧾 3) (Admin) Agregado por evento
router.get(
  "/evento/:evento_id",
  authorizeRoles("administrador"),
  [idParam("evento_id")],
  validate,
  asyncHandler(avaliacoesPorEvento)
);

// 📋 4a) (Usuário/Admin) Pendentes por usuário (protegido contra IDOR)
router.get(
  "/disponiveis/:usuario_id",
  authorizeRoles("administrador", "instrutor", "usuario"),
  [idParam("usuario_id")],
  validate,
  ensureSelfOrAdmin,
  asyncHandler(listarAvaliacoesDisponiveis)
);

// 📋 4b) (Usuário/Admin) Alias sem :usuario_id → usa ID do token
router.get(
  "/disponiveis",
  authorizeRoles("administrador", "instrutor", "usuario"),
  asyncHandler((req, res, next) => {
    if (!req.user?.id) return res.status(401).json({ erro: "Não autenticado." });
    req.params.usuario_id = String(req.user.id);
    return listarAvaliacoesDisponiveis(req, res, next);
  })
);

module.exports = router;
