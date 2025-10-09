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

/* ───────────────── Middlewares auxiliares ───────────────── */

// Permite admin para qualquer usuário; demais perfis só se o :usuario_id == id do token
function ensureSelfOrAdmin(req, res, next) {
  const user = req.user ?? req.usuario ?? {};
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

// 📝 1) Enviar avaliação (usuário; instrutor/admin só para o próprio token)
router.post(
  "/",
  authMiddleware,
  authorizeRoles("administrador", "instrutor", "usuario"),
  enviarAvaliacao
);

// 📊 2b) (Admin) Listar TODAS as avaliações da turma (sem filtro de instrutor)
//     Dica: deixar esta rota mais específica antes da rota genérica ajuda a leitura.
router.get(
  "/turma/:turma_id/all",
  authMiddleware,
  authorizeRoles("administrador"),
  avaliacoesPorTurma
);

// 📊 2) (Instrutor) Listar avaliações da turma APENAS para o instrutor logado
//     Obs.: Admin também pode acessar (o controller libera admin sem exigir vínculo).
router.get(
  "/turma/:turma_id",
  authMiddleware,
  authorizeRoles("instrutor", "administrador"),
  listarPorTurmaParaInstrutor
);

// 🧾 3) (Admin) Agregado de avaliações por evento
router.get(
  "/evento/:evento_id",
  authMiddleware,
  authorizeRoles("administrador"),
  avaliacoesPorEvento
);

// 📋 4) (Usuário) Listar avaliações pendentes para o próprio usuário
//     Protegido contra IDOR: admin pode ver de qualquer usuário; demais perfis só o próprio.
router.get(
  "/disponiveis/:usuario_id",
  authMiddleware,
  authorizeRoles("administrador", "instrutor", "usuario"),
  ensureSelfOrAdmin,
  listarAvaliacoesDisponiveis
);

module.exports = router;
