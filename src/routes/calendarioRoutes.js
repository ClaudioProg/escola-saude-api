const express = require("express");
const router = express.Router();
const calendarioController = require("../controllers/calendarioController");
const auth = require("../auth/authMiddleware");

// Admin lista
router.get("/", auth, calendarioController.listar);

// Admin cria
router.post("/", auth, calendarioController.criar);

// Admin edita
router.put("/:id", auth, calendarioController.atualizar);

// Admin exclui
router.delete("/:id", auth, calendarioController.excluir);

module.exports = router;
