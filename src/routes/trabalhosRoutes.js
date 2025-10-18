// 📁 api/routes/trabalhosRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Middlewares
const requireAuth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

// Controller
const ctrl = require("../controllers/trabalhosController");

/* ------------------------------------------------------------------
   Storage de pôster e banner (paths unificados)
------------------------------------------------------------------ */
const { POSTERS_DIR, BANNERS_DIR, ensureDir } = require("../paths");

// Garante diretórios persistentes (cross-env)
const postersDir = POSTERS_DIR;
const bannersDir = BANNERS_DIR || path.join(POSTERS_DIR, "..", "banners");
[postersDir, bannersDir].forEach((d) => ensureDir(d));

/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------ */
function buildSafeName(originalname) {
  const ext = path.extname(originalname || "").toLowerCase();
  const uid = Date.now() + "_" + Math.round(Math.random() * 1e9);
  return `${uid}${ext}`;
}
function isPptOrPptx(file) {
  const okMime =
    file.mimetype === "application/vnd.ms-powerpoint" ||
    file.mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  const okExt = /\.(pptx?|PPTX?)$/i.test(file.originalname || "");
  return okMime || okExt;
}
function isBannerAllowed(file) {
  const okMime = /^image\//i.test(file.mimetype) || /pdf/i.test(file.mimetype);
  const okExt = /\.(png|jpe?g|gif|pdf)$/i.test(file.originalname || "");
  return okMime || okExt;
}

/* ------------------------------------------------------------------
   Multer storages e filtros (com limites)
------------------------------------------------------------------ */
const MAX_POSTER_MB = Number(process.env.MAX_POSTER_MB || 50);
const MAX_BANNER_MB = Number(process.env.MAX_BANNER_MB || 30);

const posterStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, postersDir),
  filename: (_req, file, cb) => cb(null, buildSafeName(file.originalname)),
});
const posterFileFilter = (_req, file, cb) => {
  if (isPptOrPptx(file)) return cb(null, true);
  return cb(Object.assign(new Error("Apenas arquivos .ppt ou .pptx"), { status: 400 }));
};
const posterUpload = multer({
  storage: posterStorage,
  fileFilter: posterFileFilter,
  limits: { fileSize: MAX_POSTER_MB * 1024 * 1024 },
});

const bannerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, bannersDir),
  filename: (_req, file, cb) => cb(null, buildSafeName(file.originalname)),
});
const bannerFileFilter = (_req, file, cb) => {
  if (isBannerAllowed(file)) return cb(null, true);
  return cb(
    Object.assign(new Error("Formato inválido. Envie PNG, JPG, GIF ou PDF."), { status: 400 })
  );
};
const bannerUpload = multer({
  storage: bannerStorage,
  fileFilter: bannerFileFilter,
  limits: { fileSize: MAX_BANNER_MB * 1024 * 1024 },
});

/* ------------------------------------------------------------------
   Rate limit simples por IP/rota para evitar double-click no upload
------------------------------------------------------------------ */
const recentUploads = new Map(); // key: ip+rota -> timestamp
function mkRateLimiter(keyBuilder, windowMs = 3000, forgetMs = 5000) {
  return function (req, res, next) {
    const now = Date.now();
    const key = keyBuilder(req);
    const last = recentUploads.get(key) || 0;
    if (now - last < windowMs) {
      return res
        .status(429)
        .json({ erro: "Muitas tentativas. Aguarde alguns segundos e tente novamente." });
    }
    recentUploads.set(key, now);
    setTimeout(() => recentUploads.delete(key), forgetMs);
    next();
  };
}
const posterRateLimit = mkRateLimiter((req) => `${req.ip}:/submissoes/${req.params.id}/poster`);
const bannerRateLimit = mkRateLimiter((req) => `${req.ip}:/submissoes/${req.params.id}/banner`);

/* ------------------------------------------------------------------
   Middleware de erro específico do Multer (reutilizável)
------------------------------------------------------------------ */
function multerErrorHandler(maxMbMsg) {
  return (err, _req, res, next) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ erro: maxMbMsg });
    }
    const msg = err.message || "Falha no upload do arquivo.";
    const status = err.status || 400;
    return res.status(status).json({ erro: msg });
  };
}

/* ───────────────────────── ROTAS DO USUÁRIO ───────────────────────── */
// Criar submissão (rascunho ou enviado)
router.post("/chamadas/:chamadaId/submissoes", requireAuth, ctrl.criarSubmissao);

// Editar submissão
router.put("/submissoes/:id", requireAuth, ctrl.atualizarSubmissao);

// Excluir submissão
router.delete("/submissoes/:id", requireAuth, ctrl.removerSubmissao);

/* Upload/atualização do PÔSTER (.ppt/.pptx) */
router.post(
  "/submissoes/:id/poster",
  requireAuth,
  posterRateLimit,
  posterUpload.single("poster"),
  multerErrorHandler(`Arquivo muito grande (máximo ${MAX_POSTER_MB}MB).`),
  // dica: se quiser salvar BLOB também, o controller pode ler req.file.path
  ctrl.atualizarPoster
);

/* Upload/atualização do BANNER (png/jpg/gif/pdf) */
router.post(
  "/submissoes/:id/banner",
  requireAuth,
  bannerRateLimit,
  bannerUpload.single("banner"),
  multerErrorHandler(`Arquivo muito grande (máximo ${MAX_BANNER_MB}MB).`),
  ctrl.atualizarBanner
);

// Minhas submissões / Detalhe
router.get("/minhas-submissoes", requireAuth, ctrl.minhasSubmissoes);
router.get("/submissoes/minhas", requireAuth, ctrl.minhasSubmissoes);
router.get("/submissoes/:id", requireAuth, ctrl.obterSubmissao);

/* ─────────────────────────── ROTAS ADMIN ─────────────────────────── */
// Lista todas as submissões (sem filtrar por chamada)
router.get("/admin/submissoes", requireAdmin, ctrl.listarSubmissoesAdminTodas);

// Lista por chamada (compat)
router.get("/admin/chamadas/:chamadaId/submissoes", requireAdmin, ctrl.listarSubmissoesAdmin);

// Downloads (inline; autorização fina no controller)
router.get("/submissoes/:id/poster", requireAuth, ctrl.baixarPoster);
router.get("/submissoes/:id/banner", requireAuth, ctrl.baixarBanner);

/* Avaliações — controller valida admin OU avaliador atribuído */
router.post("/admin/submissoes/:id/avaliar", requireAuth, ctrl.avaliarEscrita);
router.post("/admin/submissoes/:id/avaliar-oral", requireAuth, ctrl.avaliarOral);

/* Consolidação e status final (admin-only) */
router.post("/admin/chamadas/:chamadaId/classificar", requireAdmin, ctrl.consolidarClassificacao);
router.post("/admin/submissoes/:id/status", requireAdmin, ctrl.definirStatusFinal);

/* Painel do avaliador */
router.get("/avaliador/submissoes", requireAuth, ctrl.listarSubmissoesDoAvaliador);
router.get("/avaliador/submissoes/:id", requireAuth, ctrl.obterParaAvaliacao);
router.post("/avaliador/submissoes/:id/avaliar", requireAuth, ctrl.avaliarEscrita);

module.exports = router;
