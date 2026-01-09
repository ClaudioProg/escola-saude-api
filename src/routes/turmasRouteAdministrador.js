// ✅ src/routes/turmasAdministradorRoute.js
"use strict";

const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/turmasControllerAdministrador");
const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

// Helper: usa handler se existir; senão, 501
function safeHandler(fnName) {
  const fn = ctrl?.[fnName];
  if (typeof fn === "function") return fn;
  return (_req, res) =>
    res.status(501).json({
      erro: `Handler '${fnName}' não implementado em turmasControllerAdministrador.`,
    });
}

/* ─────────────────────────────────────────────
   🧭 Admin — listar turmas (com detalhes)
   GET /api/turmas-admin  (ou onde você montar)
   ───────────────────────────────────────────── */
router.get(
  "/",
  authMiddleware,
  authorizeRoles("administrador"),
  safeHandler("listarTurmasAdministrador")
);

module.exports = router;
