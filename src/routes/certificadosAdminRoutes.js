// 📁 src/routes/certificadosAdminRoutes.js
const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/certificadosAdminController");
const auth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

// árvore: eventos → turmas → participantes
router.get(
  "/arvore",
  auth,
  authorizeRoles("administrador"),
  ctrl.listarArvore
);

// reset por turma
router.post(
  "/turmas/:turmaId/reset",
  auth,
  authorizeRoles("administrador"),
  ctrl.resetTurma
);

module.exports = router;
