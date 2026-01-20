/* eslint-disable no-console */
// 📁 src/routes/trabalhoRoute.js — PREMIUM/UNIFICADO (singular + aliases + mounts por prefixo)
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
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[trabalhoRoute] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

const _roles = require("../middlewares/authorize");
const authorizeRoles =
  typeof _roles === "function" ? _roles : _roles?.default || _roles?.authorizeRoles || _roles?.authorizeRole;

if (typeof authorizeRoles !== "function") {
  console.error("[trabalhoRoute] authorizeRoles inválido:", _roles);
  throw new Error("authorizeRoles não exportado corretamente em src/middlewares/authorize.js");
}

const requireAdmin = [requireAuth, authorizeRoles("administrador")];
const requireAdminOrInstrutor = [requireAuth, authorizeRoles("administrador", "instrutor")];

/* ───────────────── Controllers ───────────────── */
const ctrl = require("../controllers/trabalhoController");
const adminCtrl = require("../controllers/submissaoController");

/* ───────────────── Helpers ───────────────── */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({
    erro: "Parâmetros inválidos.",
    detalhes: errors.array().map((e) => ({ campo: e.path, msg: e.msg })),
    requestId: res.getHeader?.("X-Request-Id"),
  });
}

// ID validator central (mantém padrão)
const vId = [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()];
const vChamadaId = [param("chamadaId").isInt({ min: 1 }).withMessage("chamadaId inválido.").toInt()];

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

// upload premium: limite + filtro
const upload = multer({
  dest: TMP_DIR,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ok =
      /^image\/(png|jpe?g|gif|webp)$/i.test(file.mimetype) || /^application\/pdf$/i.test(file.mimetype);

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

/* ✅ injeta DB (se existir) */
router.use(injectDb);

/* ─────────────────────────── ROTAS DE USUÁRIO ─────────────────────────── */

/**
 * ✅ Minhas submissões (usuário)
 * O frontend recente chama: GET /api/submissao/minhas (via fallback do index)
 * Mas o módulo "trabalhos" também pode oferecer:
 * - /api/trabalhos/submissao/minhas
 * - /api/trabalhos/minhas-submissoes (alias)
 *
 * ⚠️ IMPORTANTE: aqui não prefixamos com "/trabalhos" nem "/api".
 */
router.get("/submissao/minhas", requireAuth, asyncHandler(ctrl.minhassubmissao));
router.get("/minhas-submissoes", requireAuth, asyncHandler(ctrl.minhassubmissao)); // alias leve

/**
 * 💾 Repositório de trabalhos avaliados (sem notas, com banner)
 * Front chama: GET /api/trabalhos/repositorio[?chamadaId=...]
 */
router.get("/repositorio", requireAuth, asyncHandler(ctrl.listarRepositorioTrabalhos));
router.get("/repository", requireAuth, asyncHandler(ctrl.listarRepositorioTrabalhos)); // alias

/**
 * CRUD submissões (usuário)
 * Atenção: seu route antigo tinha um path estranho `:chamadaId(\\d+)` "colado".
 * Corrigido para o padrão: /chamadas/:chamadaId/submissao
 */
router.post(
  "/chamadas/:chamadaId/submissao",
  requireAuth,
  vChamadaId,
  validate,
  asyncHandler(ctrl.criarSubmissao)
);

router.get("/submissao/:id", requireAuth, vId, validate, asyncHandler(ctrl.obterSubmissao));
router.put("/submissao/:id", requireAuth, vId, validate, asyncHandler(ctrl.atualizarSubmissao));
router.delete("/submissao/:id", requireAuth, vId, validate, asyncHandler(ctrl.removerSubmissao));

// Downloads (usuário autenticado)
router.get("/submissao/:id/poster", requireAuth, vId, validate, asyncHandler(ctrl.baixarPoster));
router.get("/submissao/:id/banner", requireAuth, vId, validate, asyncHandler(ctrl.baixarBanner));

// Uploads (usuário autenticado)
router.post(
  "/submissao/:id/poster",
  requireAuth,
  vId,
  validate,
  upload.single("poster"),
  asyncHandler(ctrl.atualizarPoster)
);

router.post(
  "/submissao/:id/banner",
  requireAuth,
  vId,
  validate,
  upload.single("banner"),
  asyncHandler(ctrl.atualizarBanner)
);

/* ─────────────────────────── ROTAS ADMIN ─────────────────────────── */

// Listagens
router.get("/admin/submissao", ...requireAdmin, asyncHandler(ctrl.listarsubmissaoAdminTodas));

router.get(
  "/admin/chamadas/:chamadaId/submissao",
  ...requireAdmin,
  vChamadaId,
  validate,
  asyncHandler(ctrl.listarsubmissaoAdmin)
);

// Avaliações / nota visível / avaliadores (admin)
router.get(
  "/admin/submissao/:id/avaliacao",
  ...requireAdmin,
  vId,
  validate,
  asyncHandler(adminCtrl.listarAvaliacaoDaSubmissao)
);

router.post(
  "/admin/submissao/:id/nota-visivel",
  ...requireAdmin,
  vId,
  validate,
  asyncHandler(adminCtrl.definirNotaVisivel)
);

// ✅ compat antigo (avaliadores)
router.get(
  "/admin/submissao/:id/avaliadores",
  ...requireAdmin,
  vId,
  validate,
  asyncHandler(adminCtrl.listarAvaliadoresDaSubmissao)
);

router.post(
  "/admin/submissao/:id/avaliadores",
  ...requireAdmin,
  vId,
  validate,
  asyncHandler(adminCtrl.atribuirAvaliadores)
);

// Avaliações (admin/avaliador) — precisa estar logado (controller decide permissões)
router.post(
  "/admin/submissao/:id/avaliar",
  requireAuth,
  vId,
  validate,
  asyncHandler(ctrl.avaliarEscrita)
);

router.post(
  "/admin/submissao/:id/avaliar-oral",
  requireAuth,
  vId,
  validate,
  asyncHandler(ctrl.avaliarOral)
);

// Consolidação e status final (admin-only)
router.post(
  "/admin/chamadas/:chamadaId/classificar",
  ...requireAdmin,
  vChamadaId,
  validate,
  asyncHandler(ctrl.consolidarClassificacao)
);

router.post(
  "/admin/submissao/:id/status",
  ...requireAdmin,
  vId,
  validate,
  asyncHandler(ctrl.definirStatusFinal)
);

/* ─────────────────────────── PAINEL DO AVALIADOR ─────────────────────────── */

router.get("/avaliador/minhas-contagens", requireAuth, asyncHandler(ctrl.contagemMinhasAvaliacao));

router.get("/avaliador/submissao", requireAuth, asyncHandler(ctrl.listarsubmissaoDoAvaliador));

router.get("/avaliador/submissao/:id", requireAuth, vId, validate, asyncHandler(ctrl.obterParaAvaliacao));

router.post("/avaliador/submissao/:id/avaliar", requireAuth, vId, validate, asyncHandler(ctrl.avaliarEscrita));

router.post("/avaliador/submissao/:id/avaliar-oral", requireAuth, vId, validate, asyncHandler(ctrl.avaliarOral));

/* ─────────────────────────── Error handler (multer) ─────────────────────────── */
router.use(multerErrorHandler);

module.exports = router;
