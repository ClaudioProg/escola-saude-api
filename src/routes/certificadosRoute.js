// ✅ src/routes/certificadosRoute.js
/* eslint-disable no-console */
const express = require("express");
const rateLimit = require("express-rate-limit");
const { query, param, body, validationResult } = require("express-validator");

const router = express.Router();

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth = typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware;
if (typeof requireAuth !== "function") {
  console.error("[certificadosRoutes] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

const _roles = require("../auth/authorizeRoles");
const authorizeRoles = typeof _roles === "function" ? _roles : _roles?.default || _roles?.authorizeRoles;
if (typeof authorizeRoles !== "function") {
  console.error("[certificadosRoutes] authorizeRoles inválido:", _roles);
  throw new Error("authorizeRoles não é função (verifique exports em src/auth/authorizeRoles.js)");
}

const { extrairPerfis } = require("../utils/perfil");
const ctrl = require("../controllers/certificadosController");
const dbFallback = require("../db");

/* =========================
   Helpers (premium)
========================= */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function getDb(req) {
  return req?.db ?? dbFallback;
}

function toIntId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({
    ok: false,
    erro: "Parâmetros inválidos.",
    detalhes: errors.array().map((e) => ({ campo: e.path, msg: e.msg })),
    requestId: res.getHeader?.("X-Request-Id"),
  });
}

/* ───────────────── Middlewares anti-IDOR ───────────────── */

/** Permite admin; demais perfis só se req.body.usuario_id === id do token. */
function ensureBodySelfOrAdmin(req, res, next) {
  const user = req.usuario ?? req.user ?? {};
  const tokenId = toIntId(user.id);
  const perfis = extrairPerfis({ usuario: user, user });
  const isAdmin = perfis.includes("administrador");

  const bodyId = toIntId(req.body?.usuario_id);

  if (!bodyId) {
    return res.status(400).json({ erro: "Body inválido: 'usuario_id' numérico é obrigatório." });
  }
  if (isAdmin || (tokenId && bodyId === tokenId)) return next();
  return res.status(403).json({ erro: "Acesso negado." });
}

/** Permite admin; demais perfis só se o certificado pertence ao token. */
async function ensureCertOwnerOrAdmin(req, res, next) {
  try {
    const user = req.usuario ?? req.user ?? {};
    const tokenId = toIntId(user.id);
    const perfis = extrairPerfis({ usuario: user, user });
    const isAdmin = perfis.includes("administrador");

    const id = toIntId(req.params.id);
    if (!id) return res.status(400).json({ erro: "ID de certificado inválido." });
    if (isAdmin) return next();

    if (!tokenId) return res.status(401).json({ erro: "Não autenticado." });

    const db = getDb(req);
    const q = await db.query("SELECT 1 FROM certificados WHERE id = $1 AND usuario_id = $2 LIMIT 1", [id, tokenId]);
    if (q.rowCount > 0) return next();

    return res.status(403).json({ erro: "Acesso negado ao certificado." });
  } catch (e) {
    console.error("[certificados] ensureCertOwnerOrAdmin:", e?.message || e);
    return res.status(500).json({ erro: "Erro de autorização." });
  }
}

/* Helper: exige perfil administrador */
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

/* =========================
   Rate limits (premium)
========================= */
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, erro: "Muitas requisições. Aguarde alguns instantes." },
});

const privateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Aguarde alguns instantes." },
});

/* =========================
   Rotas públicas
========================= */
/**
 * 🔎 Validação pública via QR
 * GET /api/certificados/validar?usuario_id=...&evento_id=...&turma_id=...
 * Resposta: { ok, valido, certificado? }
 */
router.get(
  "/validar",
  publicLimiter,
  [
    query("usuario_id").isInt({ min: 1 }).withMessage("usuario_id inválido.").toInt(),
    query("evento_id").isInt({ min: 1 }).withMessage("evento_id inválido.").toInt(),
    query("turma_id").isInt({ min: 1 }).withMessage("turma_id inválido.").toInt(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const uid = req.query.usuario_id;
    const eid = req.query.evento_id;
    const tid = req.query.turma_id;

    const db = getDb(req);
    const q = await db.query(
      `
      SELECT c.id, c.tipo, c.gerado_em, c.revalidado_em,
             e.titulo,
             t.nome AS turma,
             t.data_inicio, t.data_fim
        FROM certificados c
        JOIN eventos e ON e.id = c.evento_id
        JOIN turmas  t ON t.id = c.turma_id
       WHERE c.usuario_id = $1 AND c.evento_id = $2 AND c.turma_id = $3
       ORDER BY c.gerado_em DESC
       LIMIT 1
      `,
      [uid, eid, tid]
    );

    if (q.rowCount === 0) return res.json({ ok: true, valido: false });
    return res.json({ ok: true, valido: true, certificado: q.rows[0] });
  })
);

/* 📥 Baixar certificado (mantido público p/ QR/terceiros) */
router.get(
  "/:id/download",
  publicLimiter,
  [param("id").isInt({ min: 1 }).withMessage("id inválido.").toInt()],
  validate,
  asyncHandler(ctrl.baixarCertificado)
);

/* =========================
   Rotas autenticadas
========================= */
router.use(requireAuth, privateLimiter);

// 🧾 Listar certificados emitidos do usuário autenticado
router.get(
  "/usuario",
  authorizeRoles("administrador", "instrutor", "usuario"),
  asyncHandler(ctrl.listarCertificadosDoUsuario)
);

// 🆕 Elegíveis (participante) — do próprio usuário do token
router.get(
  "/elegiveis",
  authorizeRoles("administrador", "instrutor", "usuario"),
  asyncHandler(ctrl.listarCertificadosElegiveis)
);

// 🆕 Elegíveis (instrutor) — do próprio usuário do token
router.get(
  "/elegiveis-instrutor",
  authorizeRoles("administrador", "instrutor"),
  asyncHandler(ctrl.listarCertificadosInstrutorElegiveis)
);

// 🖨️ Gerar certificado (participante ou instrutor)
router.post(
  "/gerar",
  authorizeRoles("administrador", "instrutor", "usuario"),
  [body("usuario_id").isInt({ min: 1 }).withMessage("usuario_id inválido.").toInt()],
  validate,
  ensureBodySelfOrAdmin,
  asyncHandler(ctrl.gerarCertificado)
);

// 🔁 Revalidar certificado (dono ou admin)
router.post(
  "/:id/revalidar",
  authorizeRoles("administrador", "instrutor", "usuario"),
  [param("id").isInt({ min: 1 }).withMessage("id inválido.").toInt()],
  validate,
  ensureCertOwnerOrAdmin,
  asyncHandler(ctrl.revalidarCertificado)
);

/* ───────────────── Admin: Reset por Turma ───────────────── */
router.post(
  "/admin/turmas/:turmaId/reset",
  requireAdmin,
  [param("turmaId").isInt({ min: 1 }).withMessage("turmaId inválido.").toInt()],
  validate,
  asyncHandler(ctrl.resetTurma)
);

module.exports = router;
