// 📁 src/routes/notificacaoRoute.js — PREMIUM V2
/* eslint-disable no-console */
const express = require("express");
const router = express.Router();

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware;

if (typeof requireAuth !== "function") {
  console.error("[notificacaoRoute] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

/* ───────────────── Controller oficial ───────────────── */
const {
  listarNotificacao,
  resumoNotificacoes,
  contarNaoLidas,
  marcarComoLida,
  marcarTodasComoLidas,
} = require("../controllers/notificacaoController");

/* ───────────────── Helpers premium ───────────────── */
const routeTag = (tag) => (req, res, next) => {
  res.set("X-Route-Handler", tag);
  res.set("Cache-Control", "no-store");
  return next();
};

const handle =
  (fn) =>
  (req, res, next) => {
    try {
      const out = fn(req, res, next);
      if (out && typeof out.then === "function") out.catch(next);
    } catch (err) {
      next(err);
    }
  };

/* ────────────────────────────────────────────────────────────────
   ✅ GET /api/notificacao
   Lista notificações do usuário autenticado
   Query suportada:
   - apenasNaoLidas=1|true
   - tipo=...
   - limit=...
   - offset=...
   ──────────────────────────────────────────────────────────────── */
router.get(
  "/",
  requireAuth,
  routeTag("notificacaoRoute:GET /"),
  handle(listarNotificacao)
);

/* ────────────────────────────────────────────────────────────────
   ✅ GET /api/notificacao/resumo
   Resumo premium para badge/sino/painel inicial
   Retorna:
   - total
   - naoLidas
   - porTipo
   ──────────────────────────────────────────────────────────────── */
router.get(
  "/resumo",
  requireAuth,
  routeTag("notificacaoRoute:GET /resumo"),
  handle(resumoNotificacoes)
);

/* ────────────────────────────────────────────────────────────────
   ✅ GET /api/notificacao/nao-lidas/contagem
   Compatibilidade com contador simples
   ──────────────────────────────────────────────────────────────── */
router.get(
  "/nao-lidas/contagem",
  requireAuth,
  routeTag("notificacaoRoute:GET /nao-lidas/contagem"),
  handle(contarNaoLidas)
);

/* ────────────────────────────────────────────────────────────────
   ✅ PATCH /api/notificacao/:id/lida
   Marca uma notificação como lida
   ──────────────────────────────────────────────────────────────── */
router.patch(
  "/:id/lida",
  requireAuth,
  routeTag("notificacaoRoute:PATCH /:id/lida"),
  handle(marcarComoLida)
);

/* ────────────────────────────────────────────────────────────────
   ✅ PATCH /api/notificacao/lidas/todas
   Marca todas as notificações do usuário como lidas
   ──────────────────────────────────────────────────────────────── */
router.patch(
  "/lidas/todas",
  requireAuth,
  routeTag("notificacaoRoute:PATCH /lidas/todas"),
  handle(marcarTodasComoLidas)
);

module.exports = router;