/* eslint-disable no-console */
"use strict";

// 📁 src/routes/notificacaoRoute.js — PREMIUM V3
const express = require("express");
const router = express.Router();

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default || _auth?.authMiddleware || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[notificacaoRoute] authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
}

/* ───────────────── Controller oficial ───────────────── */
const notificacaoCtrl = require("../controllers/notificacaoController");

const listarNotificacao =
  typeof notificacaoCtrl?.listarNotificacao === "function"
    ? notificacaoCtrl.listarNotificacao
    : null;

const resumoNotificacoes =
  typeof notificacaoCtrl?.resumoNotificacoes === "function"
    ? notificacaoCtrl.resumoNotificacoes
    : null;

const contarNaoLidas =
  typeof notificacaoCtrl?.contarNaoLidas === "function"
    ? notificacaoCtrl.contarNaoLidas
    : null;

const marcarComoLida =
  typeof notificacaoCtrl?.marcarComoLida === "function"
    ? notificacaoCtrl.marcarComoLida
    : null;

const marcarTodasComoLidas =
  typeof notificacaoCtrl?.marcarTodasComoLidas === "function"
    ? notificacaoCtrl.marcarTodasComoLidas
    : null;

function assertFn(name, fn) {
  if (typeof fn !== "function") {
    console.error(`[notificacaoRoute] handler inválido: ${name}`, notificacaoCtrl);
    throw new Error(
      `[notificacaoRoute] Controller não exporta função válida: ${name}`
    );
  }
}

assertFn("listarNotificacao", listarNotificacao);
assertFn("resumoNotificacoes", resumoNotificacoes);
assertFn("contarNaoLidas", contarNaoLidas);
assertFn("marcarComoLida", marcarComoLida);
assertFn("marcarTodasComoLidas", marcarTodasComoLidas);

/* ───────────────── Helpers premium ───────────────── */
const routeTag = (tag) => (req, res, next) => {
  res.set("X-Route-Handler", tag);
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
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

function ensurePositiveIntParam(paramName) {
  return (req, res, next) => {
    const raw = req.params?.[paramName];
    const n = Number(raw);

    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      return res.status(400).json({
        ok: false,
        erro: `${paramName} inválido.`,
      });
    }

    req.params[paramName] = String(n);
    return next();
  };
}

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

router.head(
  "/",
  requireAuth,
  routeTag("notificacaoRoute:HEAD /"),
  (_req, res) => res.sendStatus(204)
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

router.head(
  "/resumo",
  requireAuth,
  routeTag("notificacaoRoute:HEAD /resumo"),
  (_req, res) => res.sendStatus(204)
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

// alias plural/curto
router.get(
  "/nao-lidas",
  requireAuth,
  routeTag("notificacaoRoute:GET /nao-lidas"),
  handle(contarNaoLidas)
);

/* ────────────────────────────────────────────────────────────────
   ✅ PATCH /api/notificacao/:id/lida
   Marca uma notificação como lida
──────────────────────────────────────────────────────────────── */
router.patch(
  "/:id/lida",
  requireAuth,
  ensurePositiveIntParam("id"),
  routeTag("notificacaoRoute:PATCH /:id/lida"),
  handle(marcarComoLida)
);

// alias compat
router.patch(
  "/:id/ler",
  requireAuth,
  ensurePositiveIntParam("id"),
  routeTag("notificacaoRoute:PATCH /:id/ler"),
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

// alias compat
router.patch(
  "/todas/lidas",
  requireAuth,
  routeTag("notificacaoRoute:PATCH /todas/lidas"),
  handle(marcarTodasComoLidas)
);

module.exports = router;