// ✅ src/routes/solicitacoesCursoRoute.js
const express = require("express");
const router = express.Router();

const auth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

const {
  listarSolicitacoes,
  listarTipos,
  criarSolicitacao,
  atualizarSolicitacao,
  excluirSolicitacao,
} = require("../controllers/solicitacoesCursoController");

/*  
  🔐 Regras:
  - Todos precisam estar logados para acessar as solicitações.
  - Apenas o criador OU o administrador podem editar/excluir (validado no controller).
*/

// Todas as rotas exigem autenticação
router.use(auth);

/* ─────────────────────────── ROTAS ─────────────────────────── */

// Listar solicitações visíveis ao usuário
router.get("/", listarSolicitacoes);

// Listar tipos cadastrados
router.get("/tipos", listarTipos);

// Criar nova solicitação de curso
router.post("/", criarSolicitacao);

// Atualizar solicitação existente (permissão verificada no controller)
router.put("/:id", atualizarSolicitacao);

// Excluir solicitação (permissão verificada no controller)
router.delete("/:id", excluirSolicitacao);

module.exports = router;
