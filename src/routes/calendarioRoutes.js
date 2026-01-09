const express = require("express");
const router = express.Router();

const calendarioController = require("../controllers/calendarioController");
const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

// 🔐 Todas as rotas exigem autenticação
router.use(authMiddleware);

// 📅 Listar calendário (admin)
router.get(
  "/",
  authorizeRoles("administrador"),
  calendarioController.listar
);

// ➕ Criar evento no calendário (admin)
router.post(
  "/",
  authorizeRoles("administrador"),
  calendarioController.criar
);

// ✏️ Atualizar evento do calendário (admin)
router.put(
  "/:id",
  authorizeRoles("administrador"),
  calendarioController.atualizar
);

// 🗑️ Excluir evento do calendário (admin)
router.delete(
  "/:id",
  authorizeRoles("administrador"),
  calendarioController.excluir
);

module.exports = router;
