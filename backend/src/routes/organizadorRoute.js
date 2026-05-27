/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/organizadorRoute.js — v2.1
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Rotas oficiais do módulo de organizadores.
 * - Listagem administrativa de organizadores.
 * - Consulta de turmas do organizador autenticado.
 * - Consulta administrativa de turmas/eventos/avaliações por organizador.
 *
 * Mount oficial:
 * - /api/organizador
 *
 * Contrato oficial único:
 * - authMiddleware exporta função.
 * - authorize exporta função nomeada em ../middlewares/authorize.
 * - req.user.id é obrigatório após autenticação.
 * - perfil oficial: organizador | administrador.
 *
 * Rotas oficiais:
 * - GET /minhas/turmas
 * - GET /
 * - GET /:id/eventos-avaliacao
 * - GET /:id/turmas
 *
 * Diretrizes v2.1:
 * - Sem aliases de rota.
 * - Sem fallbacks de auth/authorize.
 * - Sem req.auth.
 * - Sem req.usuario.
 * - Sem resposta { erro }.
 * - Sem rotas alternativas /minhas-turmas ou /me/turmas.
 */

const express = require("express");

const authMiddleware = require("../auth/authMiddleware");
const { authorize } = require("../middlewares/authorize");

const {
  listarorganizador,
  getEventosAvaliacaoPororganizador,
  getTurmasComEventoPororganizador,
  getMinhasTurmasorganizador,
} = require("../controllers/organizadorController");

const router = express.Router();

/* ─────────────────────────────────────────────
 * Contratos obrigatórios
 * ───────────────────────────────────────────── */

if (typeof authMiddleware !== "function") {
  console.error("[organizadorRoute] authMiddleware inválido:", authMiddleware);

  throw new Error(
    "Contrato inválido: backend/src/auth/authMiddleware.js deve exportar uma função."
  );
}

if (typeof authorize !== "function") {
  console.error("[organizadorRoute] authorize inválido:", authorize);

  throw new Error(
    "Contrato inválido: backend/src/middlewares/authorize.js deve expor { authorize } como função."
  );
}

function assertControllerFn(name, fn) {
  if (typeof fn !== "function") {
    console.error(`[organizadorRoute] organizadorController.${name} inválido:`, fn);

    throw new Error(
      `Contrato inválido: organizadorController.${name} deve ser uma função.`
    );
  }
}

assertControllerFn("listarorganizador", listarorganizador);
assertControllerFn(
  "getEventosAvaliacaoPororganizador",
  getEventosAvaliacaoPororganizador
);
assertControllerFn(
  "getTurmasComEventoPororganizador",
  getTurmasComEventoPororganizador
);
assertControllerFn("getMinhasTurmasorganizador", getMinhasTurmasorganizador);

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

function getRequestId(req) {
  return req?.requestId || req?.rid || null;
}

function responderErro(
  res,
  statusCode,
  message,
  code,
  adminHint,
  details = null,
  req = null
) {
  return res.status(statusCode).json({
    ok: false,
    data: null,
    message,
    code,
    adminHint,
    details,
    requestId: getRequestId(req),
  });
}

function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
}

function ensureAuthenticatedContext(req, res, next) {
  const usuarioId = Number(req?.user?.id);

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return responderErro(
      res,
      401,
      "Usuário não autenticado.",
      "ORGANIZADOR_USUARIO_NAO_AUTENTICADO",
      "req.user.id não foi encontrado após authMiddleware.",
      null,
      req
    );
  }

  return next();
}

function ensureNumericParam(paramName) {
  return (req, res, next) => {
    const value = Number(req.params?.[paramName]);

    if (!Number.isInteger(value) || value <= 0) {
      return responderErro(
        res,
        400,
        "Parâmetro inválido.",
        "ORGANIZADOR_PARAMETRO_INVALIDO",
        `${paramName} deve ser um inteiro positivo.`,
        {
          parametro: paramName,
          valor_recebido: req.params?.[paramName] ?? null,
        },
        req
      );
    }

    req.params[paramName] = String(value);

    return next();
  };
}

/* ─────────────────────────────────────────────
 * Middlewares do grupo
 * ───────────────────────────────────────────── */

router.use(authMiddleware);
router.use(noStore);
router.use(ensureAuthenticatedContext);

/* ─────────────────────────────────────────────
 * Organizador autenticado
 * ───────────────────────────────────────────── */

/**
 * GET /api/organizador/minhas/turmas
 *
 * Query oficial:
 * - filtro=ativos|encerrados|todos
 *
 * Função:
 * - Lista turmas vinculadas ao organizador autenticado.
 */
router.get(
  "/minhas/turmas",
  authorize("organizador", "administrador"),
  asyncHandler(getMinhasTurmasorganizador)
);

/* ─────────────────────────────────────────────
 * Administração
 * ───────────────────────────────────────────── */

/**
 * GET /api/organizador
 *
 * Função:
 * - Lista todos os organizadores.
 */
router.get(
  "/",
  authorize("administrador"),
  asyncHandler(listarorganizador)
);

/**
 * GET /api/organizador/:id/eventos-avaliacao
 *
 * Função:
 * - Consulta histórico de eventos e avaliações de um organizador.
 */
router.get(
  "/:id/eventos-avaliacao",
  authorize("administrador"),
  ensureNumericParam("id"),
  asyncHandler(getEventosAvaliacaoPororganizador)
);

/**
 * GET /api/organizador/:id/turmas
 *
 * Função:
 * - Consulta turmas vinculadas a um organizador específico.
 */
router.get(
  "/:id/turmas",
  authorize("administrador"),
  ensureNumericParam("id"),
  asyncHandler(getTurmasComEventoPororganizador)
);

module.exports = router;