// src/routes/votacoesRoute.js
const express = require("express");
const router = express.Router();

const requireAuth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const ctrl = require("../controllers/votacoesController");

// middlewares prontos
const auth = (req, res, next) => requireAuth(req, res, next);
const isAdmin = authorizeRoles("administrador", "admin");

// =======================
// Rotas do USUÁRIO
// =======================

// Lista votações ativas e ainda não votadas pelo usuário
router.get("/abertas/mine", auth, ctrl.listarVotacoesElegiveis);

// Registrar voto (body: { opcoes: number[], cliLat?, cliLng? })
router.post("/:id/votar", auth, ctrl.votar);

// =======================
// Rotas de ADMIN
// =======================
router.get("/", auth, isAdmin, ctrl.listarVotacoesAdmin);        // lista geral (admin)
router.post("/", auth, isAdmin, ctrl.criarVotacao);               // criar
router.put("/:id", auth, isAdmin, ctrl.atualizarVotacao);         // atualizar dados da votação

// opções
router.post("/:id/opcoes", auth, isAdmin, ctrl.criarOpcao);
router.put("/:id/opcoes/:opcaoId", auth, isAdmin, ctrl.atualizarOpcao);

// status
router.patch("/:id/status", auth, isAdmin, ctrl.atualizarStatus);

// relatórios / leitura pontual
router.get("/:id/ranking", auth, isAdmin, ctrl.ranking);
router.get("/:id", auth, isAdmin, ctrl.obterVotacaoAdmin);

module.exports = router;
