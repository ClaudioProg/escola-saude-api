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
  typeof _auth === "function"
    ? _auth
    : _auth?.default ||
      _auth?.authMiddleware ||
      _auth?.authAny ||
      _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[certificadoRoute] authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
}

/* ───────────────── Roles resiliente ───────────────── */
const authorizeMod = require("../middlewares/authorize");
const authorizeRoles =
  authorizeMod?.authorizeRoles ||
  authorizeMod?.authorizeRole ||
  authorizeMod?.authorize?.any ||
  authorizeMod?.authorize;

if (typeof authorizeRoles !== "function") {
  console.error("[certificadoRoute] authorizeRoles inválido:", authorizeMod);
  throw new Error(
    "authorizeRoles não exportado corretamente em src/middlewares/authorize.js"
  );
}

const { extrairPerfis } = require("../utils/perfil");

/* ───────────────── DB resiliente ───────────────── */
const dbMod = require("../db");
const dbFallback = dbMod?.db ?? dbMod;

/* ───────────────── Controllers ───────────────── */
const ctrl = require("../controllers/certificadoController");
const avulsoCtrl = require("../controllers/certificadoAvulsoController");

function assertFn(name, fn) {
  if (typeof fn !== "function") {
    console.error(`[certificadoRoute] Handler ausente/inválido: ${name}`, fn);
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

assertFn("criarCertificadoAvulso", avulsoCtrl.criarCertificadoAvulso);
assertFn("listarCertificadosAvulsos", avulsoCtrl.listarCertificadosAvulsos);
assertFn("gerarPdfCertificado", avulsoCtrl.gerarPdfCertificado);
assertFn("enviarPorEmail", avulsoCtrl.enviarPorEmail);

/* =========================
   Helpers (premium)
========================= */
const asyncHandler = (fn) => {
  if (typeof fn !== "function") {
    const got = fn === null ? "null" : Array.isArray(fn) ? "array" : typeof fn;
    throw new TypeError(
      `[certificadoRoute] asyncHandler recebeu ${got}, esperado function.`
    );
  }
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};

function getDb(req) {
  const fromReq = req?.db?.db ?? req?.db;
  return fromReq ?? dbFallback;
}

function toIntId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function getRequestId(res) {
  return res.getHeader?.("X-Request-Id") || "no-rid";
}

function logRoute(scope, req, res, extra = {}) {
  if (process.env.NODE_ENV === "production") return;
  console.log(`[CERT_ROUTE][${scope}]`, {
    rid: getRequestId(res),
    method: req.method,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    path: req.path,
    ...extra,
  });
}

function getUserId(req) {
  const u = req.usuario ?? req.user ?? {};
  const a = req.auth ?? {};

  return toIntId(
    req.userId ??
      req.usuario_id ??
      req.user?.id ??
      req.usuario?.id ??
      u?.id ??
      u?.usuario_id ??
      a?.id ??
      a?.usuario_id ??
      a?.userId ??
      a?.sub ??
      a?.payload?.id ??
      a?.payload?.usuario_id
  );
}

function getPerfis(req) {
  try {
    const uctx = req.usuario ?? req.user ?? null;
    return extrairPerfis({ usuario: uctx, user: uctx }) || [];
  } catch {
    return [];
  }
}

function isAdmin(req) {
  return getPerfis(req).includes("administrador");
}

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  logRoute("VALIDATION_ERROR", req, res, {
    detalhes: errors.array().map((e) => ({
      campo: e.path || e.param,
      msg: e.msg,
      valor: e.value,
    })),
  });

  return res.status(400).json({
    ok: false,
    erro: "Parâmetros inválidos.",
    detalhes: errors.array().map((e) => ({
      campo: e.path || e.param,
      msg: e.msg,
    })),
    requestId: getRequestId(res),
  });
}

function isAvulsosLegacyMount(req) {
  const base = String(req.baseUrl || "");
  return (
    base === "/certificados-avulsos" ||
    base.endsWith("/certificados-avulsos") ||
    base.includes("/certificados-avulsos")
  );
}

function buildLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) =>
      String(
        getUserId(req) ||
          req.ip ||
          req.headers["x-forwarded-for"] ||
          "anon"
      ),
    message,
  });
}

/* ───────────────── Middlewares anti-IDOR ───────────────── */

/** Admin pode tudo; demais só se body.usuario_id === id do token */
function ensureBodySelfOrAdmin(req, res, next) {
  const tokenId = getUserId(req);
  const admin = isAdmin(req);
  const bodyId = toIntId(req.body?.usuario_id);

  logRoute("BODY_SELF_OR_ADMIN", req, res, {
    tokenId,
    admin,
    bodyId,
  });

  if (!bodyId) {
    return res.status(400).json({
      erro: "Body inválido: 'usuario_id' numérico é obrigatório.",
      requestId: getRequestId(res),
    });
  }

  if (admin || (tokenId && bodyId === tokenId)) return next();

  return res.status(403).json({
    erro: "Acesso negado.",
    requestId: getRequestId(res),
  });
}

/** Admin pode tudo; demais só se o certificado pertencer ao usuário logado */
async function ensureCertOwnerOrAdmin(req, res, next) {
  try {
    const rid = getRequestId(res);
    const tokenId = getUserId(req);
    const perfis = getPerfis(req);
    const admin = perfis.includes("administrador");
    const certId = toIntId(req.params.id);

    if (!certId) {
      return res.status(400).json({
        erro: "ID de certificado inválido.",
        requestId: rid,
      });
    }

    logRoute("CERT_OWNER_CHECK_INICIO", req, res, {
      certId,
      tokenId,
      perfis,
      admin,
    });

    if (admin) return next();

    if (!tokenId) {
      return res.status(401).json({
        erro: "Não autenticado.",
        requestId: rid,
      });
    }

    const db = getDb(req);
    const q = await db.query(
      `SELECT usuario_id FROM certificados WHERE id = $1 LIMIT 1`,
      [certId]
    );

    logRoute("CERT_OWNER_CHECK_DB", req, res, {
      certId,
      rowCount: q.rowCount,
    });

    if (q.rowCount === 0) {
      return res.status(404).json({
        erro: "Certificado não encontrado.",
        requestId: rid,
      });
    }

    if (Number(q.rows[0].usuario_id) !== Number(tokenId)) {
      return res.status(403).json({
        erro: "Acesso negado ao certificado.",
        requestId: rid,
      });
    }

    return next();
  } catch (e) {
    console.error("[CERT_ROUTE][CERT_OWNER_CHECK][ERRO]", e?.stack || e);
    return res.status(500).json({
      erro:
        process.env.NODE_ENV !== "production"
          ? e.message
          : "Erro de autorização.",
      requestId: getRequestId(res),
    });
  }
}

/* =========================
   Rate limits (premium)
========================= */
const publicLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: { ok: false, erro: "Muitas requisições. Aguarde alguns instantes." },
});

const privateLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 240,
  message: { erro: "Muitas requisições. Aguarde alguns instantes." },
});

const resetLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: {
    erro: "Muitas operações sensíveis. Aguarde antes de tentar novamente.",
  },
});

const pdfLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: { erro: "Muitas requisições de PDF. Aguarde alguns instantes." },
});

const emailLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    erro: "Muitas solicitações de e-mail. Aguarde antes de tentar novamente.",
  },
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
    query("usuario_id")
      .isInt({ min: 1 })
      .withMessage("usuario_id inválido.")
      .toInt(),
    query("evento_id")
      .isInt({ min: 1 })
      .withMessage("evento_id inválido.")
      .toInt(),
    query("turma_id")
      .isInt({ min: 1 })
      .withMessage("turma_id inválido.")
      .toInt(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const uid = req.query.usuario_id;
    const eid = req.query.evento_id;
    const tid = req.query.turma_id;

    logRoute("VALIDAR_PUBLICO", req, res, {
      usuario_id: uid,
      evento_id: eid,
      turma_id: tid,
    });

    const db = getDb(req);
    const q = await db.query(
      `
      SELECT
        c.id,
        c.tipo,
        c.gerado_em,
        c.revalidado_em,
        e.titulo,
        t.nome AS turma,
        t.data_inicio,
        t.data_fim
      FROM certificados c
      JOIN eventos e ON e.id = c.evento_id
      JOIN turmas  t ON t.id = c.turma_id
      WHERE c.usuario_id = $1
        AND c.evento_id = $2
        AND c.turma_id = $3
      ORDER BY c.gerado_em DESC
      LIMIT 1
      `,
      [uid, eid, tid]
    );

    if (q.rowCount === 0) {
      return res.json({ ok: true, valido: false });
    }

    return res.json({
      ok: true,
      valido: true,
      certificado: q.rows[0],
    });
  })
);

/* =========================
   Download autenticado
========================= */
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

// sem cache para dados pessoais/arquivos
router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  logRoute("AUTH_AREA", req, res, {
    userId: getUserId(req),
    perfis: getPerfis(req),
  });
  next();
});

/* =========================
   ENTRYPOINT /certificados-avulsos (LEGADO)
========================= */
router.get(
  "/",
  authorizeRoles("administrador"),
  asyncHandler(async (req, res, next) => {
    const legacy = isAvulsosLegacyMount(req);

    logRoute("ROOT_ENTRYPOINT_GET", req, res, { legacy });

    if (!legacy) return next();
    return avulsoCtrl.listarCertificadosAvulsos(req, res, next);
  })
);

router.post(
  "/",
  authorizeRoles("administrador"),
  [
    body("nome").trim().notEmpty().withMessage("nome é obrigatório."),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("e-mail é obrigatório.")
      .isEmail()
      .withMessage("e-mail inválido."),
    body("curso").trim().notEmpty().withMessage("curso é obrigatório."),
    body("data_inicio")
      .optional({ nullable: true, checkFalsy: true })
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("data_inicio deve estar em AAAA-MM-DD."),
    body("data_fim")
      .optional({ nullable: true, checkFalsy: true })
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("data_fim deve estar em AAAA-MM-DD."),
    body("modalidade")
      .optional({ nullable: true, checkFalsy: true })
      .isString()
      .withMessage("modalidade inválida."),
  ],
  validate,
  asyncHandler(async (req, res, next) => {
    const legacy = isAvulsosLegacyMount(req);

    logRoute("ROOT_ENTRYPOINT_POST", req, res, { legacy });

    if (!legacy) return next();
    return avulsoCtrl.criarCertificadoAvulso(req, res, next);
  })
);

router.get(
  "/:id/pdf",
  authorizeRoles("administrador"),
  pdfLimiter,
  [
    param("id").isInt({ min: 1 }).withMessage("id inválido.").toInt(),
    query("assinatura2_id")
      .optional()
      .isInt({ min: 1 })
      .withMessage("assinatura2_id deve ser inteiro >= 1.")
      .toInt(),
    query("modalidade")
      .optional()
      .isString()
      .withMessage("modalidade inválida."),
  ],
  validate,
  asyncHandler(async (req, res, next) => {
    const legacy = isAvulsosLegacyMount(req);

    logRoute("ROOT_ENTRYPOINT_PDF", req, res, {
      legacy,
      id: req.params.id,
    });

    if (!legacy) return next();
    return avulsoCtrl.gerarPdfCertificado(req, res, next);
  })
);

router.post(
  "/:id/enviar",
  authorizeRoles("administrador"),
  emailLimiter,
  [
    param("id").isInt({ min: 1 }).withMessage("id inválido.").toInt(),
    query("assinatura2_id")
      .optional()
      .isInt({ min: 1 })
      .withMessage("assinatura2_id deve ser inteiro >= 1.")
      .toInt(),
    query("modalidade")
      .optional()
      .isString()
      .withMessage("modalidade inválida."),
  ],
  validate,
  asyncHandler(async (req, res, next) => {
    const legacy = isAvulsosLegacyMount(req);

    logRoute("ROOT_ENTRYPOINT_EMAIL", req, res, {
      legacy,
      id: req.params.id,
    });

    if (!legacy) return next();
    return avulsoCtrl.enviarPorEmail(req, res, next);
  })
);

/* =========================
   Rotas autenticadas
========================= */

// 🧾 certificados já emitidos do usuário autenticado
router.get(
  "/usuario",
  authorizeRoles("administrador", "instrutor", "usuario"),
  asyncHandler(ctrl.listarCertificadoDoUsuario)
);

// 🎓 elegíveis (participante)
router.get(
  "/elegivel",
  authorizeRoles("administrador", "instrutor", "usuario"),
  asyncHandler(ctrl.listarElegivel)
);

// 👩‍🏫 elegíveis (instrutor)
router.get(
  "/elegivel-instrutor",
  authorizeRoles("administrador", "instrutor"),
  asyncHandler(ctrl.listarInstrutorElegivel)
);

// 🖨️ gerar certificado
router.post(
  "/gerar",
  authorizeRoles("administrador", "instrutor", "usuario"),
  [
    body("usuario_id")
      .isInt({ min: 1 })
      .withMessage("usuario_id inválido.")
      .toInt(),
    body("evento_id")
      .isInt({ min: 1 })
      .withMessage("evento_id inválido.")
      .toInt(),
    body("turma_id")
      .isInt({ min: 1 })
      .withMessage("turma_id inválido.")
      .toInt(),
    body("tipo")
      .isIn(["usuario", "instrutor"])
      .withMessage("tipo deve ser 'usuario' ou 'instrutor'."),
  ],
  validate,
  ensureBodySelfOrAdmin,
  asyncHandler(ctrl.gerarCertificado)
);

// 🔁 revalidar certificado
router.post(
  "/:id/revalidar",
  authorizeRoles("administrador", "instrutor", "usuario"),
  [param("id").isInt({ min: 1 }).withMessage("id inválido.").toInt()],
  validate,
  ensureCertOwnerOrAdmin,
  asyncHandler(ctrl.revalidarCertificado)
);

/* =========================
   Admin (subrouter)
   /api/certificado/admin/...
========================= */
const admin = express.Router();

admin.use((req, res, next) => {
  logRoute("ADMIN_AREA", req, res, {
    userId: getUserId(req),
    perfis: getPerfis(req),
  });
  next();
});

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
admin.post(
  "/avulso",
  [
    body("nome").trim().notEmpty().withMessage("nome é obrigatório."),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("e-mail é obrigatório.")
      .isEmail()
      .withMessage("e-mail inválido."),
    body("curso").trim().notEmpty().withMessage("curso é obrigatório."),
    body("data_inicio")
      .optional({ nullable: true, checkFalsy: true })
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("data_inicio deve estar em AAAA-MM-DD."),
    body("data_fim")
      .optional({ nullable: true, checkFalsy: true })
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("data_fim deve estar em AAAA-MM-DD."),
    body("modalidade")
      .optional({ nullable: true, checkFalsy: true })
      .isString()
      .withMessage("modalidade inválida."),
  ],
  validate,
  asyncHandler(avulsoCtrl.criarCertificadoAvulso)
);

admin.get("/avulso", asyncHandler(avulsoCtrl.listarCertificadosAvulsos));

admin.get(
  "/avulso/:id/pdf",
  pdfLimiter,
  [
    param("id").isInt({ min: 1 }).withMessage("id inválido.").toInt(),
    query("assinatura2_id")
      .optional()
      .isInt({ min: 1 })
      .withMessage("assinatura2_id deve ser inteiro >= 1.")
      .toInt(),
    query("modalidade")
      .optional()
      .isString()
      .withMessage("modalidade inválida."),
  ],
  validate,
  asyncHandler(avulsoCtrl.gerarPdfCertificado)
);

admin.post(
  "/avulso/:id/enviar",
  emailLimiter,
  [
    param("id").isInt({ min: 1 }).withMessage("id inválido.").toInt(),
    query("assinatura2_id")
      .optional()
      .isInt({ min: 1 })
      .withMessage("assinatura2_id deve ser inteiro >= 1.")
      .toInt(),
    query("modalidade")
      .optional()
      .isString()
      .withMessage("modalidade inválida."),
  ],
  validate,
  asyncHandler(avulsoCtrl.enviarPorEmail)
);

router.use("/admin", admin);

/* =========================
   Aliases ADMIN "root" (compat)
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

// Avulsos root (compat)
router.get(
  "/avulso",
  authorizeRoles("administrador"),
  asyncHandler(avulsoCtrl.listarCertificadosAvulsos)
);

router.post(
  "/avulso",
  authorizeRoles("administrador"),
  [
    body("nome").trim().notEmpty().withMessage("nome é obrigatório."),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("e-mail é obrigatório.")
      .isEmail()
      .withMessage("e-mail inválido."),
    body("curso").trim().notEmpty().withMessage("curso é obrigatório."),
    body("data_inicio")
      .optional({ nullable: true, checkFalsy: true })
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("data_inicio deve estar em AAAA-MM-DD."),
    body("data_fim")
      .optional({ nullable: true, checkFalsy: true })
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("data_fim deve estar em AAAA-MM-DD."),
    body("modalidade")
      .optional({ nullable: true, checkFalsy: true })
      .isString()
      .withMessage("modalidade inválida."),
  ],
  validate,
  asyncHandler(avulsoCtrl.criarCertificadoAvulso)
);

router.get(
  "/avulso/:id/pdf",
  authorizeRoles("administrador"),
  pdfLimiter,
  [
    param("id").isInt({ min: 1 }).withMessage("id inválido.").toInt(),
    query("assinatura2_id")
      .optional()
      .isInt({ min: 1 })
      .withMessage("assinatura2_id deve ser inteiro >= 1.")
      .toInt(),
    query("modalidade")
      .optional()
      .isString()
      .withMessage("modalidade inválida."),
  ],
  validate,
  asyncHandler(avulsoCtrl.gerarPdfCertificado)
);

router.post(
  "/avulso/:id/enviar",
  authorizeRoles("administrador"),
  emailLimiter,
  [
    param("id").isInt({ min: 1 }).withMessage("id inválido.").toInt(),
    query("assinatura2_id")
      .optional()
      .isInt({ min: 1 })
      .withMessage("assinatura2_id deve ser inteiro >= 1.")
      .toInt(),
    query("modalidade")
      .optional()
      .isString()
      .withMessage("modalidade inválida."),
  ],
  validate,
  asyncHandler(avulsoCtrl.enviarPorEmail)
);

/* =========================
   Aliases retrocompat
========================= */
router.get(
  "/elegiveis",
  authorizeRoles("administrador", "instrutor", "usuario"),
  asyncHandler(ctrl.listarElegivel)
);

router.get(
  "/elegiveis-instrutor",
  authorizeRoles("administrador", "instrutor"),
  asyncHandler(ctrl.listarInstrutorElegivel)
);

router.post(
  "/admin/turmas/:turmaId/reset",
  authorizeRoles("administrador"),
  resetLimiter,
  [param("turmaId").isInt({ min: 1 }).withMessage("turmaId inválido.").toInt()],
  validate,
  asyncHandler(ctrl.resetTurma)
);

module.exports = router;