// 📁 api/routes/trabalhosRoutes.js
"use strict";

const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Middlewares
const requireAuth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

// Controllers
const ctrl = require("../controllers/trabalhosController");
const adminCtrl = require("../controllers/submissoesAdminController");

/* ──────────────────────────────────────────────────────────────
   Constantes / Helpers
────────────────────────────────────────────────────────────── */
const ID_NUM = "(\\d+)";
const TMP_DIR = path.join(process.cwd(), "uploads", "tmp");

// garante pasta TMP (evita erro do multer em ambientes “zerados”)
function ensureTmpDir() {
  try {
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  } catch (e) {
    // se falhar, multer vai quebrar; então melhor logar claramente
    console.error("[trabalhosRoutes] falha ao criar TMP_DIR:", TMP_DIR, e?.message);
  }
}
ensureTmpDir();

// middlewares compostos
const requireAdmin = [requireAuth, authorizeRoles("administrador")];
const requireAdminOrInstrutor = [requireAuth, authorizeRoles("administrador", "instrutor")];

// upload premium: limite + filtro
const upload = multer({
  dest: TMP_DIR,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB (ajuste se quiser)
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    // Aceita imagens e pdf (pôster/banner costumam ser imagem, mas você pode usar PDF também)
    const ok =
      /^image\/(png|jpe?g|gif|webp)$/i.test(file.mimetype) ||
      /^application\/pdf$/i.test(file.mimetype);

    if (!ok) {
      const err = new Error("Arquivo inválido. Envie PNG/JPG/GIF/WEBP ou PDF.");
      // @ts-ignore
      err.status = 400;
      return cb(err);
    }
    return cb(null, true);
  },
});

/* ──────────────────────────────────────────────────────────────
   🧰 Middleware de erro (multer / validações)
   - Importante: manter NO FINAL do router exportado caso seu app
     use `app.use('/api/trabalhos', router)`
────────────────────────────────────────────────────────────── */
function multerErrorHandler(err, _req, res, next) {
  if (!err) return next();

  // erro padrão do multer
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "Arquivo muito grande (limite 25MB)." });
    }
    return res.status(400).json({ error: `Erro no upload (${err.code}).` });
  }

  const status = Number(err.status) || 500;
  return res.status(status).json({ error: err.message || "Erro no upload." });
}

/* ─────────────────────────── ROTAS DE USUÁRIO ─────────────────────────── */

// Minhas submissões
router.get("/submissoes/minhas", requireAuth, ctrl.minhasSubmissoes);

// 💾 Repositório de trabalhos avaliados (sem notas, com banner)
// GET /api/trabalhos/repositorio[?chamadaId=...]
router.get("/repositorio", requireAuth, ctrl.listarRepositorioTrabalhos);

// CRUD submissões (usuário)
router.post(`/chamadas/:chamadaId${ID_NUM}/submissoes`, requireAuth, ctrl.criarSubmissao);
router.get(`/submissoes/:id${ID_NUM}`, requireAuth, ctrl.obterSubmissao);
router.put(`/submissoes/:id${ID_NUM}`, requireAuth, ctrl.atualizarSubmissao);
router.delete(`/submissoes/:id${ID_NUM}`, requireAuth, ctrl.removerSubmissao);

// Downloads (usuário autenticado)
router.get(`/submissoes/:id${ID_NUM}/poster`, requireAuth, ctrl.baixarPoster);
router.get(`/submissoes/:id${ID_NUM}/banner`, requireAuth, ctrl.baixarBanner);

// Uploads (usuário autenticado)
router.post(
  `/submissoes/:id${ID_NUM}/poster`,
  requireAuth,
  upload.single("poster"),
  ctrl.atualizarPoster
);

router.post(
  `/submissoes/:id${ID_NUM}/banner`,
  requireAuth,
  upload.single("banner"),
  ctrl.atualizarBanner
);

/* ─────────────────────────── ROTAS ADMIN ─────────────────────────── */

// Listagens
router.get("/admin/submissoes", requireAdmin, ctrl.listarSubmissoesAdminTodas);
router.get(`/admin/chamadas/:chamadaId${ID_NUM}/submissoes`, requireAdmin, ctrl.listarSubmissoesAdmin);

// Avaliações / nota visível / avaliadores (admin)
router.get(`/admin/submissoes/:id${ID_NUM}/avaliacoes`, requireAdmin, adminCtrl.listarAvaliacoesDaSubmissao);
router.post(`/admin/submissoes/:id${ID_NUM}/nota-visivel`, requireAdmin, adminCtrl.definirNotaVisivel);

// ✅ mantém compat (nome antigo no route → controller premium mantém alias)
router.get(`/admin/submissoes/:id${ID_NUM}/avaliadores`, requireAdmin, adminCtrl.listarAvaliadoresDaSubmissao);
router.post(`/admin/submissoes/:id${ID_NUM}/avaliadores`, requireAdmin, adminCtrl.atribuirAvaliadores);

// Avaliações (admin/avaliador) — precisa estar logado (o controller decide permissões)
router.post(`/admin/submissoes/:id${ID_NUM}/avaliar`, requireAuth, ctrl.avaliarEscrita);
router.post(`/admin/submissoes/:id${ID_NUM}/avaliar-oral`, requireAuth, ctrl.avaliarOral);

// Consolidação e status final (admin-only)
router.post(`/admin/chamadas/:chamadaId${ID_NUM}/classificar`, requireAdmin, ctrl.consolidarClassificacao);
router.post(`/admin/submissoes/:id${ID_NUM}/status`, requireAdmin, ctrl.definirStatusFinal);

/* ─────────────────────────── PAINEL DO AVALIADOR ─────────────────────────── */

// Contagens (usa a mesma regra do admin para “avaliado”)
router.get("/avaliador/minhas-contagens", requireAuth, ctrl.contagemMinhasAvaliacoes);

// Lista/Detalhe do avaliador
router.get("/avaliador/submissoes", requireAuth, ctrl.listarSubmissoesDoAvaliador);
router.get(`/avaliador/submissoes/:id${ID_NUM}`, requireAuth, ctrl.obterParaAvaliacao);

// Ações do avaliador
router.post(`/avaliador/submissoes/:id${ID_NUM}/avaliar`, requireAuth, ctrl.avaliarEscrita);
router.post(`/avaliador/submissoes/:id${ID_NUM}/avaliar-oral`, requireAuth, ctrl.avaliarOral);

/* ─────────────────────────── Error handler (multer) ─────────────────────────── */
router.use(multerErrorHandler);

module.exports = router;
