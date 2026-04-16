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
  typeof _auth === "function"
    ? _auth
    : _auth?.default || _auth?.authMiddleware || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[submissaoRoute] authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
}

const _roles = require("../middlewares/authorize");
const authorizeRoles =
  typeof _roles === "function"
    ? _roles
    : _roles?.default ||
      _roles?.authorizeRoles ||
      _roles?.authorizeRole ||
      _roles?.authorize?.any ||
      _roles?.authorize;

if (typeof authorizeRoles !== "function") {
  console.error("[submissaoRoute] authorizeRoles inválido:", _roles);
  throw new Error(
    "authorizeRoles não é função (verifique exports em src/middlewares/authorize.js)"
  );
}

/* ───────────────── Controller único ───────────────── */
let ctrl = null;
try {
  ctrl = require("../controllers/submissaoController");
} catch (e) {
  console.warn(
    "[submissaoRoute] ⚠️ submissaoController não carregou:",
    e?.message || e
  );
  ctrl = null;
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
    detalhes: errors.array().map((e) => ({
      campo: e.path || e.param,
      msg: e.msg,
    })),
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

const getDetalheFn = () =>
  pickFn(ctrl, ["obterSubmissao", "obter", "detalhar", "getById", "getOne"]);

const getListarAdminFn = () =>
  pickFn(ctrl, [
    "listarsubmissaoAdminTodas",
    "listarsubmissaoAdmin",
    "listarAdmin",
    "listar",
  ]);

/* ✅ injeta DB uma vez */
router.use(injectDb);

// ✅ sem cache (dados pessoais / atribuições / avaliações)
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

/* =========================================================
   ✅ USUÁRIO (autenticado)
   Montado pelo index em:
   - /api/submissao
   - /api/submissoes
========================================================= */

// ✅ O front chama: GET /api/submissao/minhas
router.get(
  "/minhas",
  requireAuth,
  asyncHandler(ctrl?.listarMinhas, "ctrl.listarMinhas")
);

// alias curto
router.get(
  "/minha",
  requireAuth,
  asyncHandler(ctrl?.listarMinhas, "ctrl.listarMinhas")
);

// ✅ Detalhe por ID
router.get(
  "/:id(\\d+)",
  requireAuth,
  [idParam("id")],
  validate,
  asyncHandler(getDetalheFn(), "obterSubmissao/getById")
);

// ✅ Download do arquivo principal (poster/banner unificado no controller)
router.get(
  "/:id(\\d+)/poster",
  [idParam("id")],
  validate,
  asyncHandler(ctrl?.baixarBanner, "ctrl.baixarBanner")
);

router.get(
  "/:id(\\d+)/banner",
  [idParam("id")],
  validate,
  asyncHandler(ctrl?.baixarBanner, "ctrl.baixarBanner")
);

/* HEAD legado */
router.head("/chamadas/:id(\\d+)/modelo-banner", head204);
router.head("/chamadas/:id(\\d+)/modelo-oral", head204);

/* =========================================================
   ✅ AVALIADOR (autenticado)
   /api/submissao/avaliador/...
========================================================= */
const avaliador = express.Router();
avaliador.use(requireAuth);

avaliador.get(
  "/submissao",
  asyncHandler(ctrl?.listarAtribuidas, "ctrl.listarAtribuidas")
);
avaliador.get(
  "/pendentes",
  asyncHandler(ctrl?.listarPendentes, "ctrl.listarPendentes")
);
avaliador.get(
  "/minhas-contagens",
  asyncHandler(ctrl?.minhasContagens, "ctrl.minhasContagens")
);
avaliador.get(
  "/para-mim",
  asyncHandler(ctrl?.paraMim, "ctrl.paraMim")
);

// HEADs canônicos
avaliador.head("/submissao", head204);
avaliador.head("/pendentes", head204);
avaliador.head("/minhas-contagens", head204);
avaliador.head("/para-mim", head204);

// Aliases compat
avaliador.get(
  "/avaliacao/atribuidas",
  asyncHandler(ctrl?.listarAtribuidas, "ctrl.listarAtribuidas")
);
avaliador.get(
  "/submissao/atribuidas",
  asyncHandler(ctrl?.listarAtribuidas, "ctrl.listarAtribuidas")
);
avaliador.get(
  "/minhas-submissao",
  asyncHandler(ctrl?.listarAtribuidas, "ctrl.listarAtribuidas")
);

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

// ✅ Listagem admin
admin.get(
  "/submissao",
  asyncHandler(getListarAdminFn(), "ctrl.listarSubmissaoAdmin")
);

admin.get(
  "/submissoes",
  asyncHandler(getListarAdminFn(), "ctrl.listarSubmissaoAdmin")
);

// Avaliadores
admin.get(
  "/submissao/:id(\\d+)/avaliador",
  [idParam("id")],
  validate,
  asyncHandler(
    ctrl?.listarAvaliadoresDaSubmissao || ctrl?.listarAvaliadoresFlex,
    "ctrl.listarAvaliadoresDaSubmissao"
  )
);

admin.post(
  "/submissao/:id(\\d+)/avaliador",
  [idParam("id")],
  validate,
  asyncHandler(
    ctrl?.atribuirAvaliadores || ctrl?.incluirAvaliadores,
    "ctrl.atribuirAvaliadores"
  )
);

admin.delete(
  "/submissao/:id(\\d+)/avaliador",
  [idParam("id")],
  validate,
  asyncHandler(ctrl?.revogarAvaliadorFlex, "ctrl.revogarAvaliadorFlex")
);

admin.patch(
  "/submissao/:id(\\d+)/avaliador/restore",
  [idParam("id")],
  validate,
  asyncHandler(ctrl?.restaurarAvaliadorFlex, "ctrl.restaurarAvaliadorFlex")
);

admin.post(
  "/submissao/:id(\\d+)/avaliador/revogar",
  [idParam("id")],
  validate,
  asyncHandler(ctrl?.revogarAvaliadorFlex, "ctrl.revogarAvaliadorFlex")
);

// Aliases plural antigo
admin.get(
  "/submissao/:id(\\d+)/avaliadores",
  [idParam("id")],
  validate,
  asyncHandler(
    ctrl?.listarAvaliadoresDaSubmissao || ctrl?.listarAvaliadoresFlex,
    "ctrl.listarAvaliadoresDaSubmissao"
  )
);

admin.post(
  "/submissao/:id(\\d+)/avaliadores",
  [idParam("id")],
  validate,
  asyncHandler(
    ctrl?.atribuirAvaliadores || ctrl?.incluirAvaliadores,
    "ctrl.atribuirAvaliadores"
  )
);

admin.delete(
  "/submissao/:id(\\d+)/avaliadores",
  [idParam("id")],
  validate,
  asyncHandler(ctrl?.revogarAvaliadorFlex, "ctrl.revogarAvaliadorFlex")
);

admin.patch(
  "/submissao/:id(\\d+)/avaliadores/restore",
  [idParam("id")],
  validate,
  asyncHandler(ctrl?.restaurarAvaliadorFlex, "ctrl.restaurarAvaliadorFlex")
);

admin.post(
  "/submissao/:id(\\d+)/avaliadores/revogar",
  [idParam("id")],
  validate,
  asyncHandler(ctrl?.revogarAvaliadorFlex, "ctrl.revogarAvaliadorFlex")
);

// Avaliações / nota visível
admin.get(
  "/submissao/:id(\\d+)/avaliacao",
  [idParam("id")],
  validate,
  asyncHandler(ctrl?.listarAvaliacaoDaSubmissao, "ctrl.listarAvaliacaoDaSubmissao")
);

admin.post(
  "/submissao/:id(\\d+)/nota-visivel",
  [idParam("id")],
  validate,
  asyncHandler(ctrl?.definirNotaVisivel, "ctrl.definirNotaVisivel")
);

// Atualização de nota média materializada
admin.post(
  "/submissao/:id(\\d+)/atualizar-nota",
  [idParam("id")],
  validate,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    if (typeof ctrl?.atualizarNotaMediaMaterializada !== "function") {
      return res.status(501).json({
        error: "Função atualizarNotaMediaMaterializada não implementada.",
      });
    }

    await ctrl.atualizarNotaMediaMaterializada(id);
    return res.json({ ok: true });
  }, "ctrl.atualizarNotaMediaMaterializada")
);

// Modelos PPTX (compat legado)
admin.get(
  "/chamadas/:id(\\d+)/modelo-banner/meta",
  [idParam("id")],
  validate,
  asyncHandler(ctrl?.getModeloBannerMeta, "ctrl.getModeloBannerMeta")
);

admin.get(
  "/chamadas/:id(\\d+)/modelo-banner",
  [idParam("id")],
  validate,
  asyncHandler(ctrl?.downloadModeloBanner, "ctrl.downloadModeloBanner")
);

admin.post(
  "/chamadas/:id(\\d+)/modelo-banner",
  [idParam("id")],
  validate,
  asyncHandler(ctrl?.uploadModeloBanner, "ctrl.uploadModeloBanner")
);

admin.get(
  "/chamadas/:id(\\d+)/modelo-oral/meta",
  [idParam("id")],
  validate,
  asyncHandler(ctrl?.getModeloOralMeta, "ctrl.getModeloOralMeta")
);

admin.get(
  "/chamadas/:id(\\d+)/modelo-oral",
  [idParam("id")],
  validate,
  asyncHandler(ctrl?.downloadModeloOral, "ctrl.downloadModeloOral")
);

admin.post(
  "/chamadas/:id(\\d+)/modelo-oral",
  [idParam("id")],
  validate,
  asyncHandler(ctrl?.uploadModeloOral, "ctrl.uploadModeloOral")
);

// Resumo avaliadores
admin.get(
  "/avaliador/resumo",
  asyncHandler(ctrl?.resumoAvaliadores, "ctrl.resumoAvaliadores")
);

admin.get(
  "/avaliadores/resumo",
  asyncHandler(ctrl?.resumoAvaliadores, "ctrl.resumoAvaliadores")
);

// Bridge interno compat
admin.get(
  "/submissao/para-mim",
  asyncHandler(ctrl?.paraMim, "ctrl.paraMim")
);

admin.head("/submissao/para-mim", head204);

router.use("/admin", admin);

/* =========================================================
   ♻️ ALIASES dentro deste router (mantém legado vivo)
========================================================= */
router.get(
  "/avaliacao/atribuidas",
  requireAuth,
  asyncHandler(ctrl?.listarAtribuidas, "ctrl.listarAtribuidas")
);
router.head("/avaliacao/atribuidas", requireAuth, head204);

router.get(
  "/submissao/atribuidas",
  requireAuth,
  asyncHandler(ctrl?.listarAtribuidas, "ctrl.listarAtribuidas")
);
router.head("/submissao/atribuidas", requireAuth, head204);

router.get(
  "/submissao/para-mim",
  requireAuth,
  asyncHandler(ctrl?.paraMim, "ctrl.paraMim")
);
router.head("/submissao/para-mim", requireAuth, head204);

module.exports = router;