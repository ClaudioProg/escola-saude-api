// ✅ src/routes/certificadosRoute.js
/* eslint-disable no-console */
const express = require("express");
const router = express.Router();

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware;
if (typeof requireAuth !== "function") {
  console.error("[certificadosRoutes] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

const _roles = require("../auth/authorizeRoles");
const authorizeRoles =
  typeof _roles === "function" ? _roles : _roles?.default || _roles?.authorizeRoles;
if (typeof authorizeRoles !== "function") {
  console.error("[certificadosRoutes] authorizeRoles inválido:", _roles);
  throw new Error("authorizeRoles não é função (verifique exports em src/auth/authorizeRoles.js)");
}

const { extrairPerfis } = require("../utils/perfil");
const ctrl = require("../controllers/certificadosController");

/* ───────────────── Middlewares anti-IDOR ───────────────── */

/** Permite admin; demais perfis só se req.body.usuario_id === id do token. */
function ensureBodySelfOrAdmin(req, res, next) {
  const user = req.usuario ?? req.user ?? {};
  const tokenId = Number(user.id);
  const perfis = extrairPerfis({ usuario: user, user }); // robusto p/ array|string|CSV
  const isAdmin = perfis.includes("administrador");

  const bodyId = Number(req.body?.usuario_id);
  if (!Number.isFinite(bodyId)) {
    return res
      .status(400)
      .json({ erro: "Body inválido: 'usuario_id' numérico é obrigatório." });
  }
  if (isAdmin || bodyId === tokenId) return next();
  return res.status(403).json({ erro: "Acesso negado." });
}

/** Permite admin; demais perfis só se o certificado pertence ao token. */
async function ensureCertOwnerOrAdmin(req, res, next) {
  try {
    const user = req.usuario ?? req.user ?? {};
    const tokenId = Number(user.id);
    const perfis = extrairPerfis({ usuario: user, user });
    const isAdmin = perfis.includes("administrador");

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ erro: "ID de certificado inválido." });
    }
    if (isAdmin) return next();

    // Checa dono do certificado
    const db = require("../db");
    const q = await db.query(
      "SELECT 1 FROM certificados WHERE id = $1 AND usuario_id = $2 LIMIT 1",
      [id, tokenId]
    );
    if (q.rowCount > 0) return next();
    return res.status(403).json({ erro: "Acesso negado ao certificado." });
  } catch (e) {
    console.error("ensureCertOwnerOrAdmin:", e);
    return res.status(500).json({ erro: "Erro de autorização." });
  }
}

/* Helper: exige perfil administrador */
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

/* ───────────────── Rotas ───────────────── */

// 🧾 Listar certificados emitidos do usuário autenticado
router.get(
  "/usuario",
  requireAuth,
  authorizeRoles("administrador", "instrutor", "usuario"),
  ctrl.listarCertificadosDoUsuario
);

// 🆕 Elegíveis (participante) — do próprio usuário do token
router.get(
  "/elegiveis",
  requireAuth,
  authorizeRoles("administrador", "instrutor", "usuario"),
  ctrl.listarCertificadosElegiveis
);

// 🆕 Elegíveis (instrutor) — do próprio usuário do token
router.get(
  "/elegiveis-instrutor",
  requireAuth,
  authorizeRoles("administrador", "instrutor"),
  ctrl.listarCertificadosInstrutorElegiveis
);

// 🖨️ Gerar certificado (participante ou instrutor)
router.post(
  "/gerar",
  requireAuth,
  authorizeRoles("administrador", "instrutor", "usuario"),
  ensureBodySelfOrAdmin,
  ctrl.gerarCertificado
);

// 📥 Baixar certificado (mantido público como está no seu fluxo)
router.get("/:id/download", ctrl.baixarCertificado);

// 🔁 Revalidar certificado (dono ou admin)
router.post(
  "/:id/revalidar",
  requireAuth,
  authorizeRoles("administrador", "instrutor", "usuario"),
  ensureCertOwnerOrAdmin,
  ctrl.revalidarCertificado
);

/* ───────────────── Admin: Reset por Turma ───────────────── */
router.post(
  "/admin/turmas/:turmaId/reset",
  requireAdmin,
  ctrl.resetTurma
);

module.exports = router;
