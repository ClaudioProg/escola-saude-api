// routes/votacoes.js
const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const { isAdmin } = require("../middlewares/roles");
const ctrl = require("../controllers/votacoesController");

// Admin
router.post("/", auth, isAdmin, ctrl.criarVotacao);
router.put("/:id", auth, isAdmin, ctrl.atualizarVotacao);
router.post("/:id/opcoes", auth, isAdmin, ctrl.criarOpcao);
router.put("/:id/opcoes/:opcaoId", auth, isAdmin, ctrl.atualizarOpcao);
router.patch("/:id/status", auth, isAdmin, ctrl.atualizarStatus);
router.get("/", auth, isAdmin, ctrl.listarVotacoesAdmin);
router.get("/:id", auth, isAdmin, ctrl.obterVotacaoAdmin);
router.get("/:id/ranking", auth, isAdmin, ctrl.ranking);

// Usuário
router.get("/abertas/mine", auth, ctrl.listarVotacoesElegiveis);
router.post("/:id/votar", auth, ctrl.votar); // body: { opcoes: number[], cliLat?, cliLng? }

module.exports = router;
