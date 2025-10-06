// 📁 api/routes/trabalhosRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// ✅ Middlewares do seu projeto
const requireAuth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

// Controllers
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
  const allowed = [
    "application/vnd.ms-powerpoint", // .ppt
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  ];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Formato inválido. Envie arquivo .ppt ou .pptx"));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/* ------------------------------------------------------------------
   Rate limit simples por IP/rota para evitar double click no upload
   ------------------------------------------------------------------ */
const recentUploads = new Map(); // key: ip -> timestamp
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

/* ------------------------------------------------------------------
   ROTAS DO USUÁRIO
   ------------------------------------------------------------------ */
// Criar submissão (rascunho/enviado)
router.post("/chamadas/:chamadaId/submissoes", requireAuth, ctrl.criarSubmissao);

// Editar submissão (somente autor/admin e até o prazo)
router.put("/submissoes/:id", requireAuth, ctrl.atualizarSubmissao);

// Excluir submissão (somente autor/admin e até o prazo)
router.delete("/submissoes/:id", requireAuth, ctrl.removerSubmissao);

// Upload/atualização do pôster (somente autor/admin e até o prazo)
router.post(
  "/submissoes/:id/poster",
  requireAuth,
  uploadRateLimit,
  upload.single("poster"),
  // middleware inline para tratar erros do multer
  (err, _req, res, next) => {
    if (err) {
      if (err.message && err.message.includes("Formato inválido")) {
        return res.status(400).json({ erro: err.message });
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ erro: "Arquivo muito grande (máximo 50MB)." });
      }
      return res.status(400).json({ erro: "Falha no upload do arquivo." });
    }
    next();
  },
  ctrl.atualizarPoster
);

// Minhas submissões
router.get("/minhas-submissoes", requireAuth, ctrl.minhasSubmissoes);

// Detalhe da submissão (autor ou admin)
router.get("/submissoes/:id", requireAuth, ctrl.obterSubmissao);

/* ------------------------------------------------------------------
   ROTAS ADMIN
   ------------------------------------------------------------------ */
router.get(
  "/admin/chamadas/:chamadaId/submissoes",
  requireAdmin,
  ctrl.listarSubmissoesAdmin
);

router.post(
  "/admin/submissoes/:id/avaliar",
  requireAdmin,
  ctrl.avaliarEscrita
);

router.post(
  "/admin/submissoes/:id/avaliar-oral",
  requireAdmin,
  ctrl.avaliarOral
);

router.post(
  "/admin/chamadas/:chamadaId/classificar",
  requireAdmin,
  ctrl.consolidarClassificacao
);

router.post(
  "/admin/submissoes/:id/status",
  requireAdmin,
  ctrl.definirStatusFinal
);

module.exports = router;
