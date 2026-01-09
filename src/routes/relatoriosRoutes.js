// 📁 src/routes/relatoriosRoutes.js
const express = require("express");
const router = express.Router();

// 🔐 Middlewares
const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

// 📊 Controller
const {
  gerarRelatorios,
  exportarRelatorios,
  opcoesRelatorios,
} = require("../controllers/relatoriosController");

/* ───────────────────────────────────────────────
   Helpers
─────────────────────────────────────────────── */
const wrapAsync = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

/* ───────────────────────────────────────────────
   🔐 Todas as rotas exigem autenticação + admin
─────────────────────────────────────────────── */
router.use(authMiddleware);
router.use(authorizeRoles("administrador"));

/* ───────────────────────────────────────────────
   📄 GET /api/relatorios
   Geração dinâmica de relatórios (preview/listagem)
─────────────────────────────────────────────── */
router.get("/", wrapAsync(gerarRelatorios));

/* ───────────────────────────────────────────────
   📤 POST /api/relatorios/exportar
   Exportação de relatórios (PDF / Excel / CSV)
─────────────────────────────────────────────── */
router.post("/exportar", wrapAsync(exportarRelatorios));

/* ───────────────────────────────────────────────
   ⚙️ GET /api/relatorios/opcoes
   Retorna opções de filtros (eventos, turmas, anos, etc.)
─────────────────────────────────────────────── */
router.get("/opcoes", wrapAsync(opcoesRelatorios));

module.exports = router;
