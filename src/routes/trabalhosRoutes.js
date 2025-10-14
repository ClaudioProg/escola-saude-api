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
   Storage de pôster (PPT/PPTX)
------------------------------------------------------------------ */
const postersDir = path.join(process.cwd(), "uploads", "posters");
fs.mkdirSync(postersDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, postersDir),
  filename: (_, file, cb) => {
    const uid = Date.now() + "_" + Math.round(Math.random() * 1e9);
    cb(null, `${uid}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const okMime =
    file.mimetype === "application/vnd.ms-powerpoint" || // .ppt
    file.mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation"; // .pptx

  const okExt = /\.(pptx?|PPTX?)$/.test(file.originalname || "");

  if (okMime || okExt) return cb(null, true);
  return cb(Object.assign(new Error("Apenas arquivos .ppt ou .pptx"), { status: 400 }));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/* ------------------------------------------------------------------
   Rate limit simples por IP/rota para evitar double click no upload
------------------------------------------------------------------ */
const recentUploads = new Map(); // key: ip+rota -> timestamp
function uploadRateLimit(req, res, next) {
  const now = Date.now();
  const key = `${req.ip}:/submissoes/${req.params.id}/poster`;
  const last = recentUploads.get(key) || 0;
  if (now - last < 3000) {
    return res
      .status(429)
      .json({ erro: "Muitas tentativas. Aguarde alguns segundos e tente novamente." });
  }
  recentUploads.set(key, now);
  setTimeout(() => recentUploads.delete(key), 5000);
  next();
}

/* ───────────────────────── ROTAS DO USUÁRIO ───────────────────────── */
// Criar submissão (pode vir como rascunho ou enviado)
router.post("/chamadas/:chamadaId/submissoes", requireAuth, ctrl.criarSubmissao);

// Editar submissão (usar para salvar rascunho depois do 1º POST ou para enviar)
router.put("/submissoes/:id", requireAuth, ctrl.atualizarSubmissao);

// Excluir submissão (até o prazo e se não estiver em avaliação/finalizada)
router.delete("/submissoes/:id", requireAuth, ctrl.removerSubmissao);

// Upload/atualização do pôster
router.post(
  "/submissoes/:id/poster",
  requireAuth,
  uploadRateLimit,
  upload.single("poster"),
  // Middleware de erro específico do multer (precisa ter 4 args)
  (err, _req, res, next) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ erro: "Arquivo muito grande (máximo 50MB)." });
      }
      const msg = err.message || "Falha no upload do arquivo.";
      const status = err.status || 400;
      return res.status(status).json({ erro: msg });
    }
    next();
  },
  ctrl.atualizarPoster
);

// Minhas submissões / Detalhe da submissão
router.get("/minhas-submissoes", requireAuth, ctrl.minhasSubmissoes);
router.get("/submissoes/minhas", requireAuth, ctrl.minhasSubmissoes); 
router.get("/submissoes/:id", requireAuth, ctrl.obterSubmissao);

/* ─────────────────────────── ROTAS ADMIN ─────────────────────────── */
// 🆕 Lista TODAS as submissões (sem filtrar por chamada)
router.get("/admin/submissoes", requireAdmin, ctrl.listarSubmissoesAdminTodas);

// Lista submissões por chamada (compat)
router.get("/admin/chamadas/:chamadaId/submissoes", requireAdmin, ctrl.listarSubmissoesAdmin);

// Download do pôster
router.get("/submissoes/:id/poster", requireAuth, ctrl.baixarPoster);

// Avaliações
router.post("/admin/submissoes/:id/avaliar", requireAdmin, ctrl.avaliarEscrita);
router.post("/admin/submissoes/:id/avaliar-oral", requireAdmin, ctrl.avaliarOral);

// Consolidação e status final
router.post("/admin/chamadas/:chamadaId/classificar", requireAdmin, ctrl.consolidarClassificacao);
router.post("/admin/submissoes/:id/status", requireAdmin, ctrl.definirStatusFinal);

module.exports = router;
