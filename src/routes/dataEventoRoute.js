/* eslint-disable no-console */
const express = require("express");
const router = express.Router();

const { listarDatasDaTurma } = require("../controllers/dataEventoController");

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware;

if (typeof requireAuth !== "function") {
  console.error("[datasEventoRoute] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

/* (Opcional) Roles — deixe comentado se não quiser restringir agora
const _roles = require("../middlewares/authorize");
const authorizeRoles =
  typeof _roles === "function" ? _roles : _roles?.default || _roles?.authorizeRoles;

if (typeof authorizeRoles !== "function") {
  console.error("[datasEventoRoute] authorizeRoles inválido:", _roles);
  throw new Error("authorizeRoles não é função (verifique exports em src/middlewares/authorize.js)");
}
*/

/* ───────────────── Middlewares locais ───────────────── */

// valida e normaliza :id (turma_id)
function validateTurmaIdParam(req, res, next) {
  const raw = req.params.id;
  const id = Number(raw);

  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ erro: "ID de turma inválido." });
  }

  // normaliza para o controller
  req.params.id = String(id);
  return next();
}

/* ───────────────── Rotas ───────────────── */

/**
 * 🔍 Buscar todas as datas de uma turma
 * GET /api/datas-evento/turma/:id
 * - Protegida (token)
 * - No-store (evita cache agressivo)
 */
router.get(
  "/turma/:id",
  requireAuth,
  validateTurmaIdParam,
  (req, res, next) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("X-Route", "datasEventoRoute:listarDatasDaTurma");
    return listarDatasDaTurma(req, res, next);
  }
);

module.exports = router;
