/* eslint-disable no-console */
// ✅ src/routes/certificadoRoute.js — PREMIUM/UNIFICADO (singular + compat)
"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const { query, param, body, validationResult } = require("express-validator");

const router = express.Router();

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware;

if (typeof requireAuth !== "function") {
  console.error("[certificadoRoute] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

const _roles = require("../middlewares/authorize");
const authorizeRoles =
  typeof _roles === "function" ? _roles : _roles?.default || _roles?.authorizeRoles;

if (typeof authorizeRoles !== "function") {
  console.error("[certificadoRoute] authorizeRoles inválido:", _roles);
  throw new Error("authorizeRoles não é função (verifique exports em src/middlewares/authorize.js)");
}

const { extrairPerfis } = require("../utils/perfil");

// ✅ normaliza db (alguns módulos exportam { db }, outros exportam direto)
const dbMod = require("../db");
const dbFallback = dbMod?.db ?? dbMod;

/* ───────────────── Controllers (mantidos) ───────────────── */
const ctrl = require("../controllers/certificadoController");
const avulsoCtrl = require("../controllers/certificadoAvulsoController");

function assertFn(name, fn) {
  if (typeof fn !== "function") {
    console.error(`[certificadoRoute] Handler ausente/ inválido: ${name}`, fn);
    throw new Error(`[certificadoRoute] Controller não exporta função: ${name}`);
  }
}

assertFn("baixarCertificado", ctrl.baixarCertificado);
assertFn("listarCertificadoDoUsuario", ctrl.listarCertificadoDoUsuario);
assertFn("listarElegivel", ctrl.listarElegivel);
assertFn("listarInstrutorElegivel", ctrl.listarInstrutorElegivel);
assertFn("gerarCertificado", ctrl.gerarCertificado);
assertFn("revalidarCertificado", ctrl.revalidarCertificado);

assertFn("listarArvore", ctrl.listarArvore);
assertFn("resetTurma", ctrl.resetTurma);

/* =========================
   Helpers (premium)
========================= */
const asyncHandler = (fn) => {
  if (typeof fn !== "function") {
    const got = fn === null ? "null" : Array.isArray(fn) ? "array" : typeof fn;
    throw new TypeError(`[certificadoRoute] asyncHandler recebeu ${got}, esperado function.`);
  }
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};

function getDb(req) {
  // ✅ também normaliza req.db caso venha no mesmo padrão
  const fromReq = req?.db?.db ?? req?.db;
  return fromReq ?? dbFallback;
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
  function getUserId(req) {
    const u = req.usuario ?? req.user ?? {};
    const a = req.auth ?? {};

    return toIntId(
      // ✅ mais comuns (várias bases usam isso)
      req.userId ??
      req.usuario_id ??
      req.user?.id ??
      req.usuario?.id ??

      // ✅ seus objetos normalizados
      u?.id ??
      u?.usuario_id ??

      // ✅ auth context (muito comum em middleware JWT)
      a?.id ??
      a?.usuario_id ??
      a?.userId ??
      a?.sub ??
      a?.payload?.id ??
      a?.payload?.usuario_id
    );
  }

  const tokenId = getUserId(req);

  // ✅ pega o usuário do req (compat)
  const uctx = req.usuario ?? req.user ?? null;
  const perfis = extrairPerfis({ usuario: uctx, user: uctx });
  const isAdmin = perfis.includes("administrador");

  const bodyId = toIntId(req.body?.usuario_id);
  if (!bodyId) {
    return res.status(400).json({ erro: "Body inválido: 'usuario_id' numérico é obrigatório." });
  }
  if (isAdmin || (tokenId && bodyId === tokenId)) return next();
  return res.status(403).json({ erro: "Acesso negado." });
}


// ✅ Middleware anti-IDOR: dono do certificado OU admin
async function ensureCertOwnerOrAdmin(req, res, next) {
  try {
    const rid = res.getHeader?.("X-Request-Id") || "no-rid";

    const tokenId = toIntId(
      req.userId ??
      req.usuario_id ??
      req.user?.id ??
      req.usuario?.id ??
      req.auth?.userId ??
      req.auth?.id ??
      req.auth?.sub
    );

    const perfis = extrairPerfis(req);         // ✅ sempre definido aqui
    const isAdmin = perfis.includes("administrador");

    const certId = toIntId(req.params.id);
    if (!certId) return res.status(400).json({ erro: "ID de certificado inválido." });

    if (process.env.NODE_ENV !== "production") {
      console.log("[CERT-AUTH]", { rid, certId, tokenId, perfis, isAdmin });
    }

    if (isAdmin) return next();
    if (!tokenId) return res.status(401).json({ erro: "Não autenticado." });

    const db = getDb(req);

    const q = await db.query(
      "SELECT usuario_id FROM certificados WHERE id = $1 LIMIT 1",
      [certId]
    );

    if (process.env.NODE_ENV !== "production") {
      console.log("[CERT-AUTH] DB:", q.rows);
    }

    if (q.rowCount === 0) return res.status(404).json({ erro: "Certificado não encontrado." });

    if (Number(q.rows[0].usuario_id) !== Number(tokenId)) {
      return res.status(403).json({ erro: "Acesso negado ao certificado." });
    }

    return next();
  } catch (e) {
    console.error("[CERT-AUTH-ERRO]", e?.stack || e);
    return res.status(500).json({
      erro: process.env.NODE_ENV !== "production" ? e.message : "Erro de autorização.",
      requestId: res.getHeader?.("X-Request-Id"),
    });
  }
}


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

const resetLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas operações sensíveis. Aguarde antes de tentar novamente." },
});

const pdfLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições de PDF. Aguarde alguns instantes." },
});

const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas solicitações de e-mail. Aguarde antes de tentar novamente." },
});

/* =========================
   Público (QR / terceiros)
========================= */
/**
 * 🔎 Validação pública via QR
 * GET /api/certificado/validar?usuario_id=...&evento_id=...&turma_id=...
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

// ✅ Download passa a ser autenticado (evita vazamento)
router.get(
  "/:id/download",
  requireAuth,
  privateLimiter,
  [param("id").isInt({ min: 1 }).withMessage("id inválido.").toInt()],
  validate,
  ensureCertOwnerOrAdmin,
  asyncHandler(ctrl.baixarCertificado)
);

/* =========================
   Autenticado
========================= */
router.use(requireAuth, privateLimiter);

// ⚠️ dados pessoais/arquivos → sem cache
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

/* =========================
   ✅ ENTRYPOINT /certificados-avulsos (LEGADO)
   Front chama: GET /api/certificados-avulsos
   Este router é montado em vários prefixes, então este GET "/"
   só deve responder quando baseUrl for "certificados-avulsos".
========================= */
router.get(
  "/",
  authorizeRoles("administrador"),
  asyncHandler(async (req, res, next) => {
    const base = String(req.baseUrl || "");
    const isAvulsosMount =
      base === "/certificados-avulsos" ||
      base.endsWith("/certificados-avulsos") ||
      base.includes("/certificados-avulsos");

    // não “rouba” /api/certificado nem /api/certificados
    if (!isAvulsosMount) return next();

    if (typeof avulsoCtrl?.listarCertificadosAvulsos === "function") {
      return avulsoCtrl.listarCertificadosAvulsos(req, res, next);
    }

    // fallback dev
    return res.json([]);
  })
);

// 🧾 Listar certificados emitidos do usuário autenticado
router.get(
  "/usuario",
  authorizeRoles("administrador", "instrutor", "usuario"),
  asyncHandler(ctrl.listarCertificadoDoUsuario)
);

// 🆕 Elegíveis (participante)
router.get(
  "/elegivel",
  authorizeRoles("administrador", "instrutor", "usuario"),
  asyncHandler(ctrl.listarElegivel)
);

// 🆕 Elegíveis (instrutor)
router.get(
  "/elegivel-instrutor",
  authorizeRoles("administrador", "instrutor"),
  asyncHandler(ctrl.listarInstrutorElegivel)
);

// 🖨️ Gerar certificado
router.post(
  "/gerar",
  authorizeRoles("administrador", "instrutor", "usuario"),
  [body("usuario_id").isInt({ min: 1 }).withMessage("usuario_id inválido.").toInt()],
  validate,
  ensureBodySelfOrAdmin,
  asyncHandler(ctrl.gerarCertificado)
);

// 🔁 Revalidar certificado
router.post(
  "/:id/revalidar",
  authorizeRoles("administrador", "instrutor", "usuario"),
  [param("id").isInt({ min: 1 }).withMessage("id inválido.").toInt()],
  validate,
  ensureCertOwnerOrAdmin,
  asyncHandler(ctrl.revalidarCertificado)
);

/* =========================
   Admin (dentro do mesmo router)
   /api/certificado/admin/...
========================= */
const admin = express.Router();
admin.use(authorizeRoles("administrador"));

// 🌳 árvore: eventos → turmas → participantes
admin.get("/arvore", asyncHandler(ctrl.listarArvore));

admin.post(
  "/turma/:turmaId/reset",
  resetLimiter,
  [param("turmaId").isInt({ min: 1 }).withMessage("turmaId inválido.").toInt()],
  validate,
  asyncHandler(ctrl.resetTurma)
);

// Avulsos (admin)
admin.post("/avulso", asyncHandler(avulsoCtrl.criarCertificadoAvulso));
admin.get("/avulso", asyncHandler(avulsoCtrl.listarCertificadosAvulsos));

admin.get(
  "/avulso/:id/pdf",
  pdfLimiter,
  [
    param("id").isInt({ min: 1 }).withMessage("id inválido.").toInt(),
    query("palestrante")
      .optional()
      .isIn(["1", "0", "true", "false"])
      .withMessage("palestrante deve ser 1/0/true/false."),
    query("assinatura2_id")
      .optional()
      .isInt({ min: 1 })
      .withMessage("assinatura2_id deve ser inteiro >= 1.")
      .toInt(),
  ],
  validate,
  asyncHandler(avulsoCtrl.gerarPdfCertificado)
);

admin.post(
  "/avulso/:id/enviar",
  emailLimiter,
  [param("id").isInt({ min: 1 }).withMessage("id inválido.").toInt()],
  validate,
  asyncHandler(avulsoCtrl.enviarPorEmail)
);

router.use("/admin", admin);

/* =========================
   ✅ Aliases ADMIN "root" (compat)
   Quando este router é montado em:
   - /api/certificados-admin
   o front chama:
   - /api/certificados-admin/arvore
   então precisamos mapear /arvore -> /admin/arvore
========================= */
router.get(
  "/arvore",
  authorizeRoles("administrador"),
  asyncHandler(ctrl.listarArvore)
);

router.post(
  "/turma/:turmaId/reset",
  authorizeRoles("administrador"),
  resetLimiter,
  [param("turmaId").isInt({ min: 1 }).withMessage("turmaId inválido.").toInt()],
  validate,
  asyncHandler(ctrl.resetTurma)
);

// Avulsos em root (compat com /api/certificados-admin/avulso)
router.get(
  "/avulso",
  authorizeRoles("administrador"),
  asyncHandler(avulsoCtrl.listarCertificadosAvulsos)
);

router.post(
  "/avulso",
  authorizeRoles("administrador"),
  asyncHandler(avulsoCtrl.criarCertificadoAvulso)
);

router.get(
  "/avulso/:id/pdf",
  authorizeRoles("administrador"),
  pdfLimiter,
  [
    param("id").isInt({ min: 1 }).withMessage("id inválido.").toInt(),
    query("palestrante")
      .optional()
      .isIn(["1", "0", "true", "false"])
      .withMessage("palestrante deve ser 1/0/true/false."),
    query("assinatura2_id")
      .optional()
      .isInt({ min: 1 })
      .withMessage("assinatura2_id deve ser inteiro >= 1.")
      .toInt(),
  ],
  validate,
  asyncHandler(avulsoCtrl.gerarPdfCertificado)
);

router.post(
  "/avulso/:id/enviar",
  authorizeRoles("administrador"),
  emailLimiter,
  [param("id").isInt({ min: 1 }).withMessage("id inválido.").toInt()],
  validate,
  asyncHandler(avulsoCtrl.enviarPorEmail)
);

/* =========================
   Aliases retrocompat
========================= */
router.get("/elegiveis", asyncHandler(ctrl.listarElegivel));
router.get("/elegiveis-instrutor", asyncHandler(ctrl.listarInstrutorElegivel));

router.post(
  "/admin/turmas/:turmaId/reset",
  resetLimiter,
  [param("turmaId").isInt({ min: 1 }).withMessage("turmaId inválido.").toInt()],
  validate,
  asyncHandler(ctrl.resetTurma)
);

module.exports = router;
