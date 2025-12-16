// 📁 src/routes/avaliacoesRoute.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

const {
  enviarAvaliacao,
  listarAvaliacoesDisponiveis,
  listarPorTurmaParaInstrutor, // ✅ para a página do instrutor
  avaliacoesPorTurma,          // ✅ admin: todas as respostas da turma
  avaliacoesPorEvento,         // ✅ admin: agregado por evento
} = require("../controllers/avaliacoesController");

/* ────────────── Middlewares auxiliares ────────────── */

// Admin pode ver qualquer usuário; demais perfis só se :usuario_id === id do token
function ensureSelfOrAdmin(req, res, next) {
  const user = req.user || {};
  const tokenId = Number(user.id);
  const paramId = Number(req.params.usuario_id);

  const perfis = Array.isArray(user.perfil)
    ? user.perfil.map(String)
    : String(user.perfil || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  const isAdmin = perfis.includes("administrador");

  if (!Number.isFinite(paramId)) {
    return res.status(400).json({ erro: "usuario_id inválido." });
  }
  if (isAdmin || tokenId === paramId) return next();
  return res.status(403).json({ erro: "Acesso negado." });
}

/* ───────────────── Rotas ───────────────── */

// 📝 1) Enviar avaliação
router.post(
  "/",
  authMiddleware,
  authorizeRoles("administrador", "instrutor", "usuario"),
  enviarAvaliacao
);

// 📊 2b) (Admin) Todas as respostas da turma
router.get(
  "/turma/:turma_id/all",
  authMiddleware,
  authorizeRoles("administrador"),
  avaliacoesPorTurma
);

// 📊 2) (Instrutor/Admin) Respostas da turma (restrito ao instrutor vinculado)
router.get(
  "/turma/:turma_id",
  authMiddleware,
  authorizeRoles("instrutor", "administrador"),
  listarPorTurmaParaInstrutor
);

// 🧾 3) (Admin) Agregado por evento
router.get(
  "/evento/:evento_id",
  authMiddleware,
  authorizeRoles("administrador"),
  avaliacoesPorEvento
);

// 📋 4a) (Usuário/Admin) Pendentes por usuário (protegido contra IDOR)
router.get(
  "/disponiveis/:usuario_id",
  authMiddleware,
  authorizeRoles("administrador", "instrutor", "usuario"),
  ensureSelfOrAdmin,
  listarAvaliacoesDisponiveis
);

// 📋 4b) (Usuário/Admin) Alias sem :usuario_id → usa ID do token
router.get(
  "/disponiveis",
  authMiddleware,
  authorizeRoles("administrador", "instrutor", "usuario"),
  (req, res, next) => {
    if (!req.user?.id) return res.status(401).json({ erro: "Não autenticado." });
    req.params.usuario_id = String(req.user.id);
    return listarAvaliacoesDisponiveis(req, res, next);
  }
);

module.exports = router;
