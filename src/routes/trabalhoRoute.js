/* eslint-disable no-console */
// ✅ src/routes/trabalhoRoute.js — PREMIUM/UNIFICADO (singular + aliases + mounts por prefixo)
// Observação importante:
// - Este router deve ser montado no index como:
//   router.use("/trabalho", trabalhoRoute);
//   router.use("/trabalhos", trabalhoRoute);
// - Portanto, AQUI dentro NÃO começamos com "/trabalhos" ou "/trabalho".

"use strict";

const express = require("express");
const router = express.Router();

const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { param, validationResult } = require("express-validator");

/* ───────────────── Middlewares do projeto ───────────────── */
const injectDb = require("../middlewares/injectDb");

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default || _auth?.authMiddleware || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[trabalhoRoute] authMiddleware inválido:", _auth);
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
  console.error("[trabalhoRoute] authorizeRoles inválido:", _roles);
  throw new Error(
    "authorizeRoles não exportado corretamente em src/middlewares/authorize.js"
  );
}

const requireAdmin = [requireAuth, authorizeRoles("administrador")];

/* ───────────────── Controllers ───────────────── */
const trabalhoCtrl = require("../controllers/trabalhoController");
const submissaoCtrl = require("../controllers/submissaoController");

/* ───────────────── Helpers ───────────────── */
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

const vId = [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()];
const vChamadaId = [
  param("chamadaId").isInt({ min: 1 }).withMessage("chamadaId inválido.").toInt(),
];

function pickFn(obj, names = []) {
  for (const n of names) {
    if (typeof obj?.[n] === "function") return obj[n];
  }
  return null;
}

const listarAvaliadoresFn = pickFn(submissaoCtrl, [
  "listarAvaliadoresDaSubmissao",
  "listarAvaliadoresFlex",
]);

const atribuirAvaliadoresFn = pickFn(submissaoCtrl, [
  "atribuirAvaliadores",
  "incluirAvaliadores",
]);

/* ───────────────── TMP upload ───────────────── */
const TMP_DIR = path.join(process.cwd(), "uploads", "tmp");

function ensureTmpDir() {
  try {
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  } catch (e) {
    console.error("[trabalhoRoute] falha ao criar TMP_DIR:", TMP_DIR, e?.message || e);
  }
}
ensureTmpDir();

const upload = multer({
  dest: TMP_DIR,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ok =
      /^image\/(png|jpe?g|gif|webp)$/i.test(file.mimetype) ||
      /^application\/pdf$/i.test(file.mimetype);

    if (!ok) {
      const err = new Error("Arquivo inválido. Envie PNG/JPG/GIF/WEBP ou PDF.");
      err.status = 400;
      return cb(err);
    }

    return cb(null, true);
  },
});

/* ──────────────────────────────────────────────────────────────
   🧰 Middleware de erro (multer)
────────────────────────────────────────────────────────────── */
function multerErrorHandler(err, _req, res, next) {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ erro: "Arquivo muito grande (limite 25MB)." });
    }

    return res.status(400).json({ erro: `Erro no upload (${err.code}).` });
  }

  const status = Number(err.status) || 500;
  return res.status(status).json({ erro: err.message || "Erro no upload." });
}

/* ✅ injeta DB */
router.use(injectDb);

// ✅ sem cache
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

/* ─────────────────────────── ROTAS DE USUÁRIO ─────────────────────────── */

// Minhas submissões
router.get(
  "/submissao/minhas",
  requireAuth,
  asyncHandler(trabalhoCtrl.minhassubmissao, "trabalhoCtrl.minhassubmissao")
);

router.get(
  "/minhas-submissoes",
  requireAuth,
  asyncHandler(trabalhoCtrl.minhassubmissao, "trabalhoCtrl.minhassubmissao")
);

// Repositório
router.get(
  "/repositorio",
  requireAuth,
  asyncHandler(
    trabalhoCtrl.listarRepositorioTrabalhos,
    "trabalhoCtrl.listarRepositorioTrabalhos"
  )
);

router.get(
  "/repository",
  requireAuth,
  asyncHandler(
    trabalhoCtrl.listarRepositorioTrabalhos,
    "trabalhoCtrl.listarRepositorioTrabalhos"
  )
);

// Criar submissão
router.post(
  "/chamadas/:chamadaId/submissao",
  requireAuth,
  vChamadaId,
  validate,
  asyncHandler(trabalhoCtrl.criarSubmissao, "trabalhoCtrl.criarSubmissao")
);

// CRUD submissão
router.get(
  "/submissao/:id",
  requireAuth,
  vId,
  validate,
  asyncHandler(trabalhoCtrl.obterSubmissao, "trabalhoCtrl.obterSubmissao")
);

router.put(
  "/submissao/:id",
  requireAuth,
  vId,
  validate,
  asyncHandler(trabalhoCtrl.atualizarSubmissao, "trabalhoCtrl.atualizarSubmissao")
);

router.delete(
  "/submissao/:id",
  requireAuth,
  vId,
  validate,
  asyncHandler(trabalhoCtrl.removerSubmissao, "trabalhoCtrl.removerSubmissao")
);

// Downloads
router.get(
  "/submissao/:id/poster",
  requireAuth,
  vId,
  validate,
  asyncHandler(trabalhoCtrl.baixarPoster, "trabalhoCtrl.baixarPoster")
);

router.get(
  "/submissao/:id/banner",
  requireAuth,
  vId,
  validate,
  asyncHandler(trabalhoCtrl.baixarBanner, "trabalhoCtrl.baixarBanner")
);

// Uploads
router.post(
  "/submissao/:id/poster",
  requireAuth,
  vId,
  validate,
  upload.single("poster"),
  asyncHandler(trabalhoCtrl.atualizarPoster, "trabalhoCtrl.atualizarPoster")
);

router.post(
  "/submissao/:id/banner",
  requireAuth,
  vId,
  validate,
  upload.single("banner"),
  asyncHandler(trabalhoCtrl.atualizarBanner, "trabalhoCtrl.atualizarBanner")
);

/* ─────────────────────────── ROTAS ADMIN ─────────────────────────── */

// Listagens admin
router.get(
  "/admin/submissao",
  ...requireAdmin,
  asyncHandler(
    trabalhoCtrl.listarsubmissaoAdminTodas,
    "trabalhoCtrl.listarsubmissaoAdminTodas"
  )
);

router.get(
  "/admin/chamadas/:chamadaId/submissao",
  ...requireAdmin,
  vChamadaId,
  validate,
  asyncHandler(trabalhoCtrl.listarsubmissaoAdmin, "trabalhoCtrl.listarsubmissaoAdmin")
);

// Avaliações / nota visível / avaliadores
router.get(
  "/admin/submissao/:id/avaliacao",
  ...requireAdmin,
  vId,
  validate,
  asyncHandler(
    submissaoCtrl.listarAvaliacaoDaSubmissao,
    "submissaoCtrl.listarAvaliacaoDaSubmissao"
  )
);

router.post(
  "/admin/submissao/:id/nota-visivel",
  ...requireAdmin,
  vId,
  validate,
  asyncHandler(submissaoCtrl.definirNotaVisivel, "submissaoCtrl.definirNotaVisivel")
);

// Avaliadores
router.get(
  "/admin/submissao/:id/avaliadores",
  ...requireAdmin,
  vId,
  validate,
  asyncHandler(listarAvaliadoresFn, "submissaoCtrl.listarAvaliadores")
);

router.post(
  "/admin/submissao/:id/avaliadores",
  ...requireAdmin,
  vId,
  validate,
  asyncHandler(atribuirAvaliadoresFn, "submissaoCtrl.atribuirAvaliadores")
);

// compat singular
router.get(
  "/admin/submissao/:id/avaliador",
  ...requireAdmin,
  vId,
  validate,
  asyncHandler(listarAvaliadoresFn, "submissaoCtrl.listarAvaliadores")
);

router.post(
  "/admin/submissao/:id/avaliador",
  ...requireAdmin,
  vId,
  validate,
  asyncHandler(atribuirAvaliadoresFn, "submissaoCtrl.atribuirAvaliadores")
);

// Avaliar escrita / oral
router.post(
  "/admin/submissao/:id/avaliar",
  requireAuth,
  vId,
  validate,
  asyncHandler(trabalhoCtrl.avaliarEscrita, "trabalhoCtrl.avaliarEscrita")
);

router.post(
  "/admin/submissao/:id/avaliar-oral",
  requireAuth,
  vId,
  validate,
  asyncHandler(trabalhoCtrl.avaliarOral, "trabalhoCtrl.avaliarOral")
);

// Consolidação / status final
router.post(
  "/admin/chamadas/:chamadaId/classificar",
  ...requireAdmin,
  vChamadaId,
  validate,
  asyncHandler(
    trabalhoCtrl.consolidarClassificacao,
    "trabalhoCtrl.consolidarClassificacao"
  )
);

router.post(
  "/admin/submissao/:id/status",
  ...requireAdmin,
  vId,
  validate,
  asyncHandler(trabalhoCtrl.definirStatusFinal, "trabalhoCtrl.definirStatusFinal")
);

/* ─────────────────────────── PAINEL DO AVALIADOR ─────────────────────────── */

router.get(
  "/avaliador/minhas-contagens",
  requireAuth,
  asyncHandler(
    trabalhoCtrl.contagemMinhasAvaliacao,
    "trabalhoCtrl.contagemMinhasAvaliacao"
  )
);

router.get(
  "/avaliador/submissao",
  requireAuth,
  asyncHandler(
    trabalhoCtrl.listarsubmissaoDoAvaliador,
    "trabalhoCtrl.listarsubmissaoDoAvaliador"
  )
);

router.get(
  "/avaliador/submissao/:id",
  requireAuth,
  vId,
  validate,
  asyncHandler(trabalhoCtrl.obterParaAvaliacao, "trabalhoCtrl.obterParaAvaliacao")
);

router.post(
  "/avaliador/submissao/:id/avaliar",
  requireAuth,
  vId,
  validate,
  asyncHandler(trabalhoCtrl.avaliarEscrita, "trabalhoCtrl.avaliarEscrita")
);

router.post(
  "/avaliador/submissao/:id/avaliar-oral",
  requireAuth,
  vId,
  validate,
  asyncHandler(trabalhoCtrl.avaliarOral, "trabalhoCtrl.avaliarOral")
);

/* ─────────────────────────── Error handler (multer) ─────────────────────────── */
router.use(multerErrorHandler);

module.exports = router;