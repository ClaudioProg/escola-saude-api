// ✅ src/routes/usuariosEstatisticasRoutes.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const router = express.Router();

// 🔐 Middlewares de autenticação e autorização
const requireAuth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

// 📊 Controller de estatísticas de usuários
const ctrl = require("../controllers/usuariosEstatisticasController");

/* ──────────────────────────────────────────────────────────────
   Helpers premium
────────────────────────────────────────────────────────────── */
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

// Rate limit defensivo (1 min)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// Gera ETag a partir de objeto (para cache condicional)
function buildEtag(data) {
  const digest = crypto.createHash("sha1").update(JSON.stringify(data)).digest("base64");
  return `"stats-${digest}"`;
}

/* ──────────────────────────────────────────────────────────────
   📈 Endpoint principal — Estatísticas agregadas de usuários
────────────────────────────────────────────────────────────── */
router.get("/usuarios/estatisticas", requireAdmin, limiter, async (req, res) => {
  try {
    const data = await ctrl.getEstatisticasUsuarios(req, res, { internal: true });
    if (!data || res.headersSent) return;

    const etag = buildEtag(data);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=600");

    // Suporte a If-None-Match (304)
    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    console.log(`[ESTATISTICAS] Usuários — ${new Date().toISOString()} | OK`);

    return res.status(200).json({
      ok: true,
      gerado_em: new Date().toISOString(),
      data,
    });
  } catch (err) {
    console.error("❌ Erro ao gerar estatísticas de usuários:", err);
    return res.status(500).json({ erro: "Erro ao gerar estatísticas de usuários" });
  }
});

/* ──────────────────────────────────────────────────────────────
   HEAD /usuarios/estatisticas — checagem de cache/etag
────────────────────────────────────────────────────────────── */
router.head("/usuarios/estatisticas", requireAdmin, limiter, async (req, res) => {
  try {
    const preview = await ctrl.getEstatisticasUsuarios(req, res, { preview: true });
    if (!preview) return res.status(204).end();

    const etag = buildEtag(preview);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
    return res.status(200).end();
  } catch (err) {
    console.error("❌ Erro no HEAD /usuarios/estatisticas:", err);
    return res.status(500).end();
  }
});

/* ──────────────────────────────────────────────────────────────
   (Opcional futuro)
   GET /usuarios/estatisticas/detalhes — breakdowns (unidade, cargo etc.)
   Mantém o padrão premium e reutiliza o mesmo controller modular.
────────────────────────────────────────────────────────────── */
router.get("/usuarios/estatisticas/detalhes", requireAdmin, limiter, async (req, res) => {
  try {
    const data = await ctrl.getEstatisticasUsuariosDetalhadas?.(req, res);
    if (!data) return res.status(204).end();

    const etag = buildEtag(data);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=600");

    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    return res.status(200).json({
      ok: true,
      gerado_em: new Date().toISOString(),
      data,
    });
  } catch (err) {
    console.error("❌ Erro ao gerar estatísticas detalhadas:", err);
    return res.status(500).json({ erro: "Erro ao gerar estatísticas detalhadas" });
  }
});

module.exports = router;
