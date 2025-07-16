const express = require("express");
const router = express.Router();
const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const dashboardController = require("../controllers/dashboardAnaliticoController");

// 📊 Painel analítico (somente administrador)
router.get(
  "/",
  authMiddleware,
  authorizeRoles("administrador"),
  dashboardController.obterDashboard
);

module.exports = router;
