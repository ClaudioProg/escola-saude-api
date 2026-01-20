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
// Admin
const adminCtrl = require("../controllers/submissaoController");
// Usuário
const userCtrl = require("../controllers/submissaoUsuarioController");

// Avaliador (pode não existir ainda)
let avaliadorCtrl;
try {
  avaliadorCtrl = require("../controllers/submissaoAvaliadorController");
} catch (e) {
  console.warn("[submissaoRoute] submissaoAvaliadorController não encontrado. Fallback p/ submissaoController.");
  avaliadorCtrl = adminCtrl;
}

/* ───────────────── Helpers premium ───────────────── */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve()
      .then(() => {
        if (typeof fn !== "function") {
          const err = new Error("Handler não implementado no controller (função ausente).");
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

const head204 = (_req, res) => res.status(204).end();
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

/* ✅ injeta DB uma vez */
router.use(injectDb);

/* =========================================================
   ✅ USUÁRIO (autenticado)
   IMPORTANTÍSSIMO:
   Este arquivo é montado pelo index como:
   - /api/submissao
   - /api/submissoes (alias)
   Então AQUI dentro não pode começar com "/submissao/..."
========================================================= */

// ✅ O FRONT chama: GET /api/submissao/minhas
router.get("/minhas", requireAuth, asyncHandler(userCtrl.listarMinhas));
// alias curto
router.get("/minha", requireAuth, asyncHandler(userCtrl.listarMinhas));

// Detalhe (autor/avaliador/admin)
router.get(
  "/:id(\\d+)",
  requireAuth,
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(userCtrl.obterSubmissao)
);

// Download pôster/banner (mantém público/autenticado conforme seu controller)
router.get(
  "/:id(\\d+)/poster",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(userCtrl.baixarBanner)
);
router.get(
  "/:id(\\d+)/banner",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(userCtrl.baixarBanner)
);

/* HEAD legado (front antigo) — devolve 410 sem barulho */
router.head("/chamadas/:id(\\d+)/modelo-banner", (_req, res) => res.sendStatus(410));
router.head("/chamadas/:id(\\d+)/modelo-oral", (_req, res) => res.sendStatus(410));

/* =========================================================
   ✅ AVALIADOR (autenticado)
   O index NÃO monta isso em /api/avaliador automaticamente,
   então deixamos aqui como sub-escopo:
   /api/submissao/avaliador/...
   (e também /api/submissoes/avaliador/...)
========================================================= */
const avaliador = express.Router();

avaliador.use(requireAuth);

avaliador.get("/submissao", asyncHandler(avaliadorCtrl.listarAtribuidas));
avaliador.get("/pendentes", asyncHandler(avaliadorCtrl.listarPendentes));
avaliador.get("/minhas-contagens", asyncHandler(avaliadorCtrl.minhasContagens));
avaliador.get("/para-mim", asyncHandler(avaliadorCtrl.paraMim));

// HEADs canônicos
avaliador.head("/submissao", head204);
avaliador.head("/pendentes", head204);
avaliador.head("/minhas-contagens", head204);
avaliador.head("/para-mim", head204);

// Aliases compat
avaliador.get("/avaliacao/atribuidas", asyncHandler(avaliadorCtrl.listarAtribuidas));
avaliador.get("/submissao/atribuidas", asyncHandler(avaliadorCtrl.listarAtribuidas));
avaliador.get("/minhas-submissao", asyncHandler(avaliadorCtrl.listarAtribuidas));

avaliador.head("/avaliacao/atribuidas", head204);
avaliador.head("/submissao/atribuidas", head204);
avaliador.head("/minhas-submissao", head204);

router.use("/avaliador", avaliador);

/* =========================================================
   ✅ ADMIN (autenticado + admin)
   /api/submissao/admin/...
   (e /api/submissoes/admin/...)
========================================================= */
const admin = express.Router();
admin.use(...requireAdmin);

// Listagem admin
admin.get("/submissoes", asyncHandler(adminCtrl.listarsubmissaoAdmin));
admin.get("/submissao", asyncHandler(adminCtrl.listarsubmissaoAdmin)); // alias

// Avaliadores
admin.get("/submissao/:id(\\d+)/avaliador", asyncHandler(adminCtrl.listarAvaliadoresDaSubmissao));
admin.post("/submissao/:id(\\d+)/avaliador", asyncHandler(adminCtrl.atribuirAvaliadores));
admin.delete("/submissao/:id(\\d+)/avaliador", asyncHandler(adminCtrl.revogarAvaliadorFlex));
admin.patch("/submissao/:id(\\d+)/avaliador/restore", asyncHandler(adminCtrl.restaurarAvaliadorFlex));
admin.post("/submissao/:id(\\d+)/avaliador/revogar", asyncHandler(adminCtrl.revogarAvaliadorFlex));

// Aliases plural antigo
admin.get("/submissao/:id(\\d+)/avaliadores", asyncHandler(adminCtrl.listarAvaliadoresDaSubmissao));
admin.post("/submissao/:id(\\d+)/avaliadores", asyncHandler(adminCtrl.atribuirAvaliadores));
admin.delete("/submissao/:id(\\d+)/avaliadores", asyncHandler(adminCtrl.revogarAvaliadorFlex));
admin.patch("/submissao/:id(\\d+)/avaliadores/restore", asyncHandler(adminCtrl.restaurarAvaliadorFlex));
admin.post("/submissao/:id(\\d+)/avaliadores/revogar", asyncHandler(adminCtrl.revogarAvaliadorFlex));

// Avaliações / Nota visível
admin.get("/submissao/:id(\\d+)/avaliacao", asyncHandler(adminCtrl.listarAvaliacaoDaSubmissao));
admin.post("/submissao/:id(\\d+)/nota-visivel", asyncHandler(adminCtrl.definirNotaVisivel));

// Atualização de nota média materializada (se existir)
admin.post(
  "/submissao/:id(\\d+)/atualizar-nota",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (typeof adminCtrl.atualizarNotaMediaMaterializada !== "function") {
      return res.status(501).json({ error: "Função atualizarNotaMediaMaterializada não implementada." });
    }
    await adminCtrl.atualizarNotaMediaMaterializada(id);
    return res.json({ ok: true });
  })
);

// Modelos PPTX (admin) — compat legado
admin.get("/chamadas/:id(\\d+)/modelo-banner/meta", asyncHandler(adminCtrl.getModeloBannerMeta));
admin.get("/chamadas/:id(\\d+)/modelo-banner", asyncHandler(adminCtrl.downloadModeloBanner));
admin.post("/chamadas/:id(\\d+)/modelo-banner", asyncHandler(adminCtrl.uploadModeloBanner));

admin.get("/chamadas/:id(\\d+)/modelo-oral/meta", asyncHandler(adminCtrl.getModeloOralMeta));
admin.get("/chamadas/:id(\\d+)/modelo-oral", asyncHandler(adminCtrl.downloadModeloOral));
admin.post("/chamadas/:id(\\d+)/modelo-oral", asyncHandler(adminCtrl.uploadModeloOral));

// Resumo avaliadores
admin.get("/avaliador/resumo", asyncHandler(adminCtrl.resumoAvaliadores));
admin.get("/avaliadores/resumo", asyncHandler(adminCtrl.resumoAvaliadores));

/* Bridge: às vezes front chama isso */
admin.get("/submissao/para-mim", asyncHandler(avaliadorCtrl.paraMim));
admin.head("/submissao/para-mim", head204);

router.use("/admin", admin);

/* =========================================================
   ♻️ BRIDGE GLOBAL (legado)
   ⚠️ ATENÇÃO: Estes endpoints saem em:
   - /api/submissao/avaliacao/atribuidas
   Se você quiser global mesmo em /api/..., faça no index.
========================================================= */
router.get("/avaliacao/atribuidas", requireAuth, asyncHandler(avaliadorCtrl.listarAtribuidas));
router.head("/avaliacao/atribuidas", requireAuth, head204);

router.get("/submissao/atribuidas", requireAuth, asyncHandler(avaliadorCtrl.listarAtribuidas));
router.head("/submissao/atribuidas", requireAuth, head204);

router.get("/submissao/para-mim", requireAuth, asyncHandler(avaliadorCtrl.paraMim));
router.head("/submissao/para-mim", requireAuth, head204);

module.exports = router;
