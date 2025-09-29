// 📁 src/routes/avaliacoesRoute.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

const {
  enviarAvaliacao,
  listarAvaliacoesDisponiveis,
  listarPorTurmaParaInstrutor, // ✅ novo (para a página do instrutor)
  avaliacoesPorTurma,          // ✅ admin: todas as respostas da turma
  avaliacoesPorEvento,         // ✅ admin: agregado por evento
} = require("../controllers/avaliacoesController");

// 📝 1) Enviar avaliação (usuario, instrutor ou administrador)
router.post(
  "/",
  authMiddleware,
  authorizeRoles("administrador", "instrutor", "usuario"),
  enviarAvaliacao
);

// 📊 2) (Instrutor) Listar avaliações da turma APENAS para o instrutor logado
//     Obs.: Admin também pode acessar **se** for instrutor do evento (caso prático).
router.get(
  "/turma/:turma_id",
  authMiddleware,
  authorizeRoles("instrutor", "administrador"),
  listarPorTurmaParaInstrutor
);

// 📊 2b) (Admin) Listar TODAS as avaliações da turma (sem filtro de instrutor)
//      Use esta rota para painéis administrativos/analíticos.
router.get(
  "/turma/:turma_id/all",
  authMiddleware,
  authorizeRoles("administrador"),
  avaliacoesPorTurma
);

// 🧾 3) (Admin) Agregado de avaliações por evento
router.get(
  "/evento/:evento_id",
  authMiddleware,
  authorizeRoles("administrador"),
  avaliacoesPorEvento
);

// 📋 4) (Usuário) Listar avaliações pendentes para o próprio usuário
router.get(
  "/disponiveis/:usuario_id",
  authMiddleware,
  authorizeRoles("administrador", "instrutor", "usuario"),
  listarAvaliacoesDisponiveis
);

module.exports = router;
