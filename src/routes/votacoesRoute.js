// ✅ src/routes/votacoesRoute.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const router = express.Router();

// 🔐 Auth e Roles
const requireAuth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const ctrl = require("../controllers/votacoesController");

// Middlewares prontos
const auth = (req, res, next) => requireAuth(req, res, next);
const isAdmin = authorizeRoles("administrador", "admin");

// ⚙️ Helpers premium
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
});

function buildEtag(payload) {
  return `"vote-${crypto.createHash("sha1").update(JSON.stringify(payload)).digest("base64")}"`;
}

/* ────────────────────────────────────────────────
   🗳️ Rotas do USUÁRIO
──────────────────────────────────────────────── */
router.get("/abertas/mine", auth, limiter, async (req, res, next) => {
  try {
    const data = await ctrl.listarVotacoesElegiveis(req, res, { internal: true });
    if (res.headersSent) return;

    const etag = buildEtag(data);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=180");

    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error("❌ Erro em /votacoes/abertas/mine:", err);
    next(err);
  }
});

// Registrar voto
router.post("/:id/votar", auth, limiter, async (req, res, next) => {
  try {
    await ctrl.votar(req, res);
  } catch (err) {
    console.error("❌ Erro ao registrar voto:", err);
    next(err);
  }
});

/* ────────────────────────────────────────────────
   🛠️ Rotas de ADMIN
──────────────────────────────────────────────── */

// Lista geral (admin)
router.get("/", auth, isAdmin, limiter, async (req, res, next) => {
  try {
    const data = await ctrl.listarVotacoesAdmin(req, res, { internal: true });
    if (res.headersSent) return;

    const etag = buildEtag(data);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, max-age=120, stale-while-revalidate=600");
    if (req.headers["if-none-match"] === etag) return res.status(304).end();

    console.log(`[VOTAÇÕES] Listagem admin gerada em ${new Date().toISOString()}`);
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error("❌ Erro ao listar votações admin:", err);
    next(err);
  }
});

// Criar, atualizar e status
router.post("/", auth, isAdmin, limiter, ctrl.criarVotacao);
router.put("/:id", auth, isAdmin, limiter, ctrl.atualizarVotacao);
router.patch("/:id/status", auth, isAdmin, limiter, ctrl.atualizarStatus);

// Opções
router.post("/:id/opcoes", auth, isAdmin, limiter, ctrl.criarOpcao);
router.put("/:id/opcoes/:opcaoId", auth, isAdmin, limiter, ctrl.atualizarOpcao);

// Relatórios / leitura pontual
router.get("/:id/ranking", auth, isAdmin, limiter, async (req, res, next) => {
  try {
    const data = await ctrl.ranking(req, res, { internal: true });
    if (res.headersSent) return;

    const etag = buildEtag(data);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, max-age=120, stale-while-revalidate=600");
    if (req.headers["if-none-match"] === etag) return res.status(304).end();

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error("❌ Erro ao gerar ranking:", err);
    next(err);
  }
});

// Detalhe de votação
router.get("/:id", auth, isAdmin, limiter, async (req, res, next) => {
  try {
    const data = await ctrl.obterVotacaoAdmin(req, res, { internal: true });
    if (res.headersSent) return;

    const etag = buildEtag(data);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, max-age=120, stale-while-revalidate=600");
    if (req.headers["if-none-match"] === etag) return res.status(304).end();

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error("❌ Erro ao obter votação:", err);
    next(err);
  }
});

module.exports = router;
