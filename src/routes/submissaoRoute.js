/* eslint-disable no-console */
// ✅ src/routes/submissaoRoute.js — PREMIUM/UNIFICADO (singular + compat)
"use strict";

const express = require("express");
const { param, validationResult } = require("express-validator");

const router = express.Router();

/* ───────────────── Middlewares do projeto ───────────────── */
const injectDb = require("../middlewares/injectDb");

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[submissaoRoute] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

const _roles = require("../middlewares/authorize");
const authorizeRoles =
  typeof _roles === "function" ? _roles : _roles?.default || _roles?.authorizeRoles;

if (typeof authorizeRoles !== "function") {
  console.error("[submissaoRoute] authorizeRoles inválido:", _roles);
  throw new Error("authorizeRoles não é função (verifique exports em src/middlewares/authorize.js)");
}

/* ───────────────── Controllers ───────────────── */
// Admin (inclui analytics/atribuições)
let adminCtrl = null;
try {
  adminCtrl = require("../controllers/submissaoController");
} catch (e) {
  console.warn("[submissaoRoute] ⚠️ submissaoController não carregou:", e?.message || e);
  adminCtrl = null;
}

// Usuário (minhas, detalhe, download)
let userCtrl = null;
try {
  userCtrl = require("../controllers/submissaoController");
} catch (e) {
  console.warn("[submissaoRoute] ⚠️ submissaoController não carregou:", e?.message || e);
  userCtrl = null;
}

// Avaliador (opcional)
let avaliadorCtrl = null;
try {
  avaliadorCtrl = require("../controllers/submissaoController");
} catch (e) {
  console.warn("[submissaoRoute] ⚠️ submissaoController não encontrado. Fallback p/ submissaoController.");
  avaliadorCtrl = adminCtrl;
}

/* ───────────────── Helpers premium ───────────────── */
const asyncHandler =
  (fn, name = "handler") =>
  (req, res, next) =>
    Promise.resolve()
      .then(() => {
        if (typeof fn !== "function") {
          const err = new Error(`Handler não implementado (${name}).`);
          err.status = 501;
          throw err;
        }
        return fn(req, res, next);
      })
      .catch(next);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({
    erro: "Parâmetros inválidos.",
    detalhes: errors.array().map((e) => ({ campo: e.path, msg: e.msg })),
    requestId: res.getHeader?.("X-Request-Id"),
  });
}

const idParam = (name) =>
  param(name).isInt({ min: 1 }).withMessage("ID inválido.").toInt();

const head204 = (_req, res) => res.status(204).end();

function pickFn(obj, names = []) {
  for (const n of names) {
    const fn = obj?.[n];
    if (typeof fn === "function") return fn;
  }
  return null;
}

const requireAdmin = [requireAuth, authorizeRoles("administrador")];

/* ✅ injeta DB uma vez */
router.use(injectDb);

// ✅ sem cache (dados pessoais)
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

/* =========================================================
   ✅ USUÁRIO (autenticado)
   Montado pelo index em:
   - /api/submissao
   - /api/submissoes (alias)
========================================================= */

// ✅ O FRONT chama: GET /api/submissao/minhas
router.get("/minhas", requireAuth, asyncHandler(userCtrl?.listarMinhas, "userCtrl.listarMinhas"));
// alias curto
router.get("/minha", requireAuth, asyncHandler(userCtrl?.listarMinhas, "userCtrl.listarMinhas"));

// ✅ CRÍTICO: detalhe por ID (isso resolve o 404 em massa: /api/submissao/147)
router.get(
  "/:id(\\d+)",
  requireAuth,
  [idParam("id")],
  validate,
  asyncHandler(
    // tenta userCtrl.obterSubmissao; se não tiver, tenta adminCtrl.obterAvaliacaoDoEvento? não — aqui é submissão
    pickFn(userCtrl, ["obterSubmissao", "obter", "detalhar", "getById", "getOne"]) ||
      pickFn(adminCtrl, ["obterSubmissao", "obter", "detalhar", "getById", "getOne"]),
    "obterSubmissao/getById"
  )
);

// Download pôster/banner (deixa como público/autenticado conforme seu controller)
router.get(
  "/:id(\\d+)/poster",
  [idParam("id")],
  validate,
  asyncHandler(userCtrl?.baixarBanner, "userCtrl.baixarBanner")
);
router.get(
  "/:id(\\d+)/banner",
  [idParam("id")],
  validate,
  asyncHandler(userCtrl?.baixarBanner, "userCtrl.baixarBanner")
);

/* HEAD legado (front antigo) */
router.head("/chamadas/:id(\\d+)/modelo-banner", (_req, res) => res.sendStatus(410));
router.head("/chamadas/:id(\\d+)/modelo-oral", (_req, res) => res.sendStatus(410));

/* =========================================================
   ✅ AVALIADOR (autenticado)
   /api/submissao/avaliador/...
========================================================= */
const avaliador = express.Router();
avaliador.use(requireAuth);

avaliador.get("/submissao", asyncHandler(avaliadorCtrl?.listarAtribuidas, "avaliadorCtrl.listarAtribuidas"));
avaliador.get("/pendentes", asyncHandler(avaliadorCtrl?.listarPendentes, "avaliadorCtrl.listarPendentes"));
avaliador.get("/minhas-contagens", asyncHandler(avaliadorCtrl?.minhasContagens, "avaliadorCtrl.minhasContagens"));
avaliador.get("/para-mim", asyncHandler(avaliadorCtrl?.paraMim, "avaliadorCtrl.paraMim"));

// HEADs canônicos
avaliador.head("/submissao", head204);
avaliador.head("/pendentes", head204);
avaliador.head("/minhas-contagens", head204);
avaliador.head("/para-mim", head204);

// Aliases compat (dentro do escopo /avaliador)
avaliador.get("/avaliacao/atribuidas", asyncHandler(avaliadorCtrl?.listarAtribuidas, "avaliadorCtrl.listarAtribuidas"));
avaliador.get("/submissao/atribuidas", asyncHandler(avaliadorCtrl?.listarAtribuidas, "avaliadorCtrl.listarAtribuidas"));
avaliador.get("/minhas-submissao", asyncHandler(avaliadorCtrl?.listarAtribuidas, "avaliadorCtrl.listarAtribuidas"));

avaliador.head("/avaliacao/atribuidas", head204);
avaliador.head("/submissao/atribuidas", head204);
avaliador.head("/minhas-submissao", head204);

router.use("/avaliador", avaliador);

/* =========================================================
   ✅ ADMIN (autenticado + admin)
   /api/submissao/admin/...
========================================================= */
const admin = express.Router();
admin.use(...requireAdmin);

// ✅ Listagem admin (padroniza singular/plural)
admin.get(
  "/submissao",
  asyncHandler(
    pickFn(adminCtrl, ["listarsubmissaoAdminTodas", "listarsubmissaoAdmin", "listarAdmin", "listar"]) ,
    "adminCtrl.listarSubmissaoAdmin"
  )
);
admin.get(
  "/submissoes",
  asyncHandler(
    pickFn(adminCtrl, ["listarsubmissaoAdminTodas", "listarsubmissaoAdmin", "listarAdmin", "listar"]) ,
    "adminCtrl.listarSubmissaoAdmin"
  )
);

// Avaliadores (tudo com fallback 501 caso falte)
admin.get("/submissao/:id(\\d+)/avaliador", asyncHandler(adminCtrl?.listarAvaliadoresDaSubmissao, "adminCtrl.listarAvaliadoresDaSubmissao"));
admin.post("/submissao/:id(\\d+)/avaliador", asyncHandler(adminCtrl?.atribuirAvaliadores, "adminCtrl.atribuirAvaliadores"));
admin.delete("/submissao/:id(\\d+)/avaliador", asyncHandler(adminCtrl?.revogarAvaliadorFlex, "adminCtrl.revogarAvaliadorFlex"));
admin.patch("/submissao/:id(\\d+)/avaliador/restore", asyncHandler(adminCtrl?.restaurarAvaliadorFlex, "adminCtrl.restaurarAvaliadorFlex"));
admin.post("/submissao/:id(\\d+)/avaliador/revogar", asyncHandler(adminCtrl?.revogarAvaliadorFlex, "adminCtrl.revogarAvaliadorFlex"));

// Aliases plural antigo
admin.get("/submissao/:id(\\d+)/avaliadores", asyncHandler(adminCtrl?.listarAvaliadoresDaSubmissao, "adminCtrl.listarAvaliadoresDaSubmissao"));
admin.post("/submissao/:id(\\d+)/avaliadores", asyncHandler(adminCtrl?.atribuirAvaliadores, "adminCtrl.atribuirAvaliadores"));
admin.delete("/submissao/:id(\\d+)/avaliadores", asyncHandler(adminCtrl?.revogarAvaliadorFlex, "adminCtrl.revogarAvaliadorFlex"));
admin.patch("/submissao/:id(\\d+)/avaliadores/restore", asyncHandler(adminCtrl?.restaurarAvaliadorFlex, "adminCtrl.restaurarAvaliadorFlex"));
admin.post("/submissao/:id(\\d+)/avaliadores/revogar", asyncHandler(adminCtrl?.revogarAvaliadorFlex, "adminCtrl.revogarAvaliadorFlex"));

// Avaliações / Nota visível
admin.get("/submissao/:id(\\d+)/avaliacao", asyncHandler(adminCtrl?.listarAvaliacaoDaSubmissao, "adminCtrl.listarAvaliacaoDaSubmissao"));
admin.post("/submissao/:id(\\d+)/nota-visivel", asyncHandler(adminCtrl?.definirNotaVisivel, "adminCtrl.definirNotaVisivel"));

// Atualização de nota média materializada (se existir)
admin.post(
  "/submissao/:id(\\d+)/atualizar-nota",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (typeof adminCtrl?.atualizarNotaMediaMaterializada !== "function") {
      return res.status(501).json({ error: "Função atualizarNotaMediaMaterializada não implementada." });
    }
    await adminCtrl.atualizarNotaMediaMaterializada(id);
    return res.json({ ok: true });
  }, "adminCtrl.atualizarNotaMediaMaterializada")
);

// Modelos PPTX (admin) — compat legado
admin.get("/chamadas/:id(\\d+)/modelo-banner/meta", asyncHandler(adminCtrl?.getModeloBannerMeta, "adminCtrl.getModeloBannerMeta"));
admin.get("/chamadas/:id(\\d+)/modelo-banner", asyncHandler(adminCtrl?.downloadModeloBanner, "adminCtrl.downloadModeloBanner"));
admin.post("/chamadas/:id(\\d+)/modelo-banner", asyncHandler(adminCtrl?.uploadModeloBanner, "adminCtrl.uploadModeloBanner"));

admin.get("/chamadas/:id(\\d+)/modelo-oral/meta", asyncHandler(adminCtrl?.getModeloOralMeta, "adminCtrl.getModeloOralMeta"));
admin.get("/chamadas/:id(\\d+)/modelo-oral", asyncHandler(adminCtrl?.downloadModeloOral, "adminCtrl.downloadModeloOral"));
admin.post("/chamadas/:id(\\d+)/modelo-oral", asyncHandler(adminCtrl?.uploadModeloOral, "adminCtrl.uploadModeloOral"));

// Resumo avaliadores
admin.get("/avaliador/resumo", asyncHandler(adminCtrl?.resumoAvaliadores, "adminCtrl.resumoAvaliadores"));
admin.get("/avaliadores/resumo", asyncHandler(adminCtrl?.resumoAvaliadores, "adminCtrl.resumoAvaliadores"));

/* Bridge: às vezes front chama isso */
admin.get("/submissao/para-mim", asyncHandler(avaliadorCtrl?.paraMim, "avaliadorCtrl.paraMim"));
admin.head("/submissao/para-mim", head204);

router.use("/admin", admin);

/* =========================================================
   ♻️ ALIASES dentro deste router (mantém legado vivo)
========================================================= */
router.get("/avaliacao/atribuidas", requireAuth, asyncHandler(avaliadorCtrl?.listarAtribuidas, "avaliadorCtrl.listarAtribuidas"));
router.head("/avaliacao/atribuidas", requireAuth, head204);

router.get("/submissao/atribuidas", requireAuth, asyncHandler(avaliadorCtrl?.listarAtribuidas, "avaliadorCtrl.listarAtribuidas"));
router.head("/submissao/atribuidas", requireAuth, head204);

router.get("/submissao/para-mim", requireAuth, asyncHandler(avaliadorCtrl?.paraMim, "avaliadorCtrl.paraMim"));
router.head("/submissao/para-mim", requireAuth, head204);

module.exports = router;
