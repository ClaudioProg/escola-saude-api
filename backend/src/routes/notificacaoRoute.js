/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/notificacaoRoute.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Rotas oficiais de notificações do usuário autenticado.
 *
 * Mount oficial:
 * - /api/notificacao
 *
 * Rotas oficiais:
 * - GET   /api/notificacao
 * - HEAD  /api/notificacao
 * - GET   /api/notificacao/resumo
 * - HEAD  /api/notificacao/resumo
 * - GET   /api/notificacao/nao-lida/total
 * - HEAD  /api/notificacao/nao-lida/total
 * - PATCH /api/notificacao/:id/lida
 * - PATCH /api/notificacao/lida/todas
 *
 * Query oficial em GET /api/notificacao:
 * - apenas_nao_lida
 * - tipo
 * - limite
 * - deslocamento
 *
 * Contrato:
 * - Autenticação obrigatória em todas as rotas.
 * - Sem aliases.
 * - Sem /nao-lidas.
 * - Sem /nao-lidas/contagem.
 * - Sem /:id/ler.
 * - Sem /lidas/todas.
 * - Sem /todas/lidas.
 * - Sem auth resiliente.
 * - Sem múltiplas possibilidades de controller.
 */

const express = require("express");

const requireAuth = require("../auth/authMiddleware");
const notificacaoController = require("../controllers/notificacaoController");

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   Contratos obrigatórios
────────────────────────────────────────────────────────────── */

if (typeof requireAuth !== "function") {
  throw new Error("[notificacaoRoute] authMiddleware deve exportar uma função.");
}

function assertHandler(name, handler) {
  if (typeof handler !== "function") {
    throw new Error(
      `[notificacaoRoute] Handler obrigatório ausente: notificacaoController.${name}`
    );
  }
}

assertHandler("listarNotificacao", notificacaoController.listarNotificacao);
assertHandler("resumoNotificacoes", notificacaoController.resumoNotificacoes);
assertHandler("contarNaoLidas", notificacaoController.contarNaoLidas);
assertHandler("marcarComoLida", notificacaoController.marcarComoLida);
assertHandler(
  "marcarTodasComoLidas",
  notificacaoController.marcarTodasComoLidas
);

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function routeTag(tag) {
  return (_req, res, next) => {
    res.setHeader("X-Route-Handler", tag);
    return next();
  };
}

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  return next();
}

function respostaErro(res, status, code, message) {
  return res.status(status).json({
    ok: false,
    code,
    message,
  });
}

function ensurePositiveIntParam(paramName) {
  return (req, res, next) => {
    const number = Number(req.params?.[paramName]);

    if (!Number.isSafeInteger(number) || number <= 0) {
      return respostaErro(
        res,
        400,
        "NOTIFICACAO-400-ID-INVALIDO",
        "ID de notificação inválido."
      );
    }

    req.params[paramName] = String(number);
    return next();
  };
}

/* ─────────────────────────────────────────────────────────────
   Middlewares globais
────────────────────────────────────────────────────────────── */

router.use(requireAuth);
router.use(noStore);

/* ─────────────────────────────────────────────────────────────
   Lista de notificações
────────────────────────────────────────────────────────────── */

/**
 * GET /api/notificacao
 */
router.get(
  "/",
  routeTag("notificacaoRoute:v2.0:GET /"),
  asyncHandler(notificacaoController.listarNotificacao)
);

/**
 * HEAD /api/notificacao
 */
router.head(
  "/",
  routeTag("notificacaoRoute:v2.0:HEAD /"),
  (_req, res) => res.sendStatus(204)
);

/* ─────────────────────────────────────────────────────────────
   Resumo para badge/dashboard
────────────────────────────────────────────────────────────── */

/**
 * GET /api/notificacao/resumo
 */
router.get(
  "/resumo",
  routeTag("notificacaoRoute:v2.0:GET /resumo"),
  asyncHandler(notificacaoController.resumoNotificacoes)
);

/**
 * HEAD /api/notificacao/resumo
 */
router.head(
  "/resumo",
  routeTag("notificacaoRoute:v2.0:HEAD /resumo"),
  (_req, res) => res.sendStatus(204)
);

/* ─────────────────────────────────────────────────────────────
   Total de não lidas
────────────────────────────────────────────────────────────── */

/**
 * GET /api/notificacao/nao-lida/total
 */
router.get(
  "/nao-lida/total",
  routeTag("notificacaoRoute:v2.0:GET /nao-lida/total"),
  asyncHandler(notificacaoController.contarNaoLidas)
);

/**
 * HEAD /api/notificacao/nao-lida/total
 */
router.head(
  "/nao-lida/total",
  routeTag("notificacaoRoute:v2.0:HEAD /nao-lida/total"),
  (_req, res) => res.sendStatus(204)
);

/* ─────────────────────────────────────────────────────────────
   Marcar uma como lida
────────────────────────────────────────────────────────────── */

/**
 * PATCH /api/notificacao/:id/lida
 */
router.patch(
  "/:id/lida",
  ensurePositiveIntParam("id"),
  routeTag("notificacaoRoute:v2.0:PATCH /:id/lida"),
  asyncHandler(notificacaoController.marcarComoLida)
);

/* ─────────────────────────────────────────────────────────────
   Marcar todas como lidas
────────────────────────────────────────────────────────────── */

/**
 * PATCH /api/notificacao/lida/todas
 */
router.patch(
  "/lida/todas",
  routeTag("notificacaoRoute:v2.0:PATCH /lida/todas"),
  asyncHandler(notificacaoController.marcarTodasComoLidas)
);

module.exports = router;