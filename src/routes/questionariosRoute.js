const express = require("express");
const router = express.Router();

const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

const {
  criarOuObterRascunhoPorEvento,
  obterQuestionarioPorEvento,
  atualizarQuestionario,
  adicionarQuestao,
  atualizarQuestao,
  removerQuestao,
  adicionarAlternativa,
  atualizarAlternativa,
  removerAlternativa,
  publicarQuestionario,

  listarDisponiveisParaUsuario,
  obterQuestionarioParaResponder,
  iniciarTentativa,
  enviarTentativa,
  obterMinhaTentativaPorTurma,
} = require("../controllers/questionariosController");

// Instrutor/Admin
router.use(authMiddleware);

router.post(
  "/evento/:evento_id/rascunho",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  criarOuObterRascunhoPorEvento
);

router.get(
  "/evento/:evento_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  obterQuestionarioPorEvento
);

router.put(
  "/:questionario_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  atualizarQuestionario
);

router.post(
  "/:questionario_id/questoes",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  adicionarQuestao
);

router.put(
  "/:questionario_id/questoes/:questao_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  atualizarQuestao
);

router.delete(
  "/:questionario_id/questoes/:questao_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  removerQuestao
);

router.post(
  "/questoes/:questao_id/alternativas",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  adicionarAlternativa
);

router.put(
  "/alternativas/:alt_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  atualizarAlternativa
);

router.delete(
  "/alternativas/:alt_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  removerAlternativa
);

router.post(
  "/:questionario_id/publicar",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  publicarQuestionario
);

// Usuário (aluno)
router.get(
  "/disponiveis/usuario/:usuario_id",
  authorizeRoles("administrador", "instrutor", "coordenador", "usuario"),
  listarDisponiveisParaUsuario
);

router.get(
  "/:questionario_id/responder/turma/:turma_id",
  authorizeRoles("administrador", "instrutor", "coordenador", "usuario"),
  obterQuestionarioParaResponder
);

router.post(
  "/:questionario_id/iniciar/turma/:turma_id",
  authorizeRoles("administrador", "instrutor", "coordenador", "usuario"),
  iniciarTentativa
);

router.post(
  "/:questionario_id/enviar/turma/:turma_id",
  authorizeRoles("administrador", "instrutor", "coordenador", "usuario"),
  enviarTentativa
);

router.get(
  "/:questionario_id/minha-tentativa/turma/:turma_id",
  authorizeRoles("administrador", "instrutor", "coordenador", "usuario"),
  obterMinhaTentativaPorTurma
);

module.exports = router;
