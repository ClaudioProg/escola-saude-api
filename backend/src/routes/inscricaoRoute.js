/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/inscricaoRoute.js — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Rotas oficiais do módulo de inscrição.
 *
 * Mount oficial esperado:
 * - /api/inscricao
 *
 * Contratos aplicados:
 * - Tabela oficial: inscricoes
 * - Sem tabela inscricao
 * - Sem rota plural /inscricoes
 * - Sem aliases turmaId/usuarioId/inscricaoId
 * - Sem req.usuario
 * - Sem req.userId/auth.userId
 * - Sem perfil/perfis/roles/admin
 * - Usuário autenticado oficial: req.user.id
 * - Perfil autenticado oficial: req.user.perfil
 * - Cancelamento por inscrição:
 *   - DELETE /api/inscricao/:inscricao_id
 * - Minhas inscrições:
 *   - GET /api/inscricao/minha
 * - Inscrição em turma:
 *   - POST /api/inscricao { turma_id }
 * - Sem bloco legado tentando adivinhar se :id é turma ou inscrição
 * - Envelope oficial: { ok, data, message }
 */

const express = require("express");

const authMiddleware = require("../auth/authMiddleware");
const { authorize } = require("../middlewares/authorize");
const inscricaoController = require("../controllers/inscricaoController");
const db = require("../db");
const { podeAcessarEvento } = require("../services/eventoAcessoRegistroService");

const router = express.Router();

const IS_DEV = process.env.NODE_ENV !== "production";

const PERFIS_USUARIO = Object.freeze(["administrador", "organizador", "usuario"]);
const PERFIS_GESTAO = Object.freeze(["administrador", "organizador"]);

/* ─────────────────────────────────────────────────────────────
 * Validação de dependências oficiais
 * ───────────────────────────────────────────────────────────── */

if (typeof authMiddleware !== "function") {
  console.error("[inscricaoRoute] authMiddleware inválido:", authMiddleware);
  throw new Error(
    "authMiddleware deve ser exportado como função em backend/src/auth/authMiddleware.js."
  );
}

if (typeof authorize !== "function") {
  console.error("[inscricaoRoute] authorize inválido:", authorize);
  throw new Error(
    "authorize deve ser exportado como função nomeada em backend/src/middlewares/authorize.js."
  );
}

if (!db || typeof db.query !== "function") {
  console.error("[inscricaoRoute] db.query inválido:", db);
  throw new Error("db.query deve existir em backend/src/db.js.");
}

if (typeof podeAcessarEvento !== "function") {
  console.error("[inscricaoRoute] podeAcessarEvento inválido:", podeAcessarEvento);
  throw new Error(
    "podeAcessarEvento deve ser exportado como função em backend/src/services/eventoAcessoRegistroService.js."
  );
}

function requireControllerFunction(name) {
  const fn = inscricaoController?.[name];

  if (typeof fn !== "function") {
    console.error(`[inscricaoRoute] controller inválido: ${name}`, {
      available: Object.keys(inscricaoController || {}),
    });

    throw new Error(
      `inscricaoController.${name} deve ser exportado como função.`
    );
  }

  return fn;
}

const controller = Object.freeze({
  inscreverEmTurma: requireControllerFunction("inscreverEmTurma"),
  cancelarInscricaoPorId: requireControllerFunction("cancelarInscricaoPorId"),
  cancelarMinhaInscricaoPorTurma: requireControllerFunction(
    "cancelarMinhaInscricaoPorTurma"
  ),
  cancelarInscricaoDoUsuarioNaTurma: requireControllerFunction(
    "cancelarInscricaoDoUsuarioNaTurma"
  ),
  listarMinhasInscricoes: requireControllerFunction("listarMinhasInscricoes"),
  listarInscritosPorTurma: requireControllerFunction("listarInscritosPorTurma"),
  conflitoPorTurma: requireControllerFunction("conflitoPorTurma"),
});

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

const wrap =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function fail(res, status, message, details = undefined) {
  const payload = {
    ok: false,
    message,
  };

  if (details !== undefined) {
    payload.details = details;
  }

  return res.status(status).json(payload);
}

function routeTag(tag) {
  return (_req, res, next) => {
    if (IS_DEV) {
      res.set("X-Route-Handler", tag);
    }

    return next();
  };
}

function noStore(_req, res, next) {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  return next();
}

function toPositiveInt(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function ensureNumericParam(paramName) {
  return (req, res, next) => {
    const value = toPositiveInt(req.params?.[paramName]);

    if (!value) {
      return fail(res, 400, `${paramName} inválido.`);
    }

    req.params[paramName] = String(value);

    return next();
  };
}

function getAuthenticatedUserId(req) {
  return toPositiveInt(req?.user?.id);
}

function getAuthenticatedPerfil(req) {
  return String(req?.user?.perfil || "").trim().toLowerCase();
}

async function checarAcessoPorRegistroNaTurma(req, res, next) {
  const turmaId = toPositiveInt(req.body?.turma_id || req.params?.turma_id);
  const usuarioId = getAuthenticatedUserId(req);

  if (!turmaId) {
    return fail(res, 400, "turma_id é obrigatório.");
  }

  if (!usuarioId) {
    return fail(res, 401, "Não autenticado.");
  }

  try {
    const turmaResult = await db.query(
      `
      SELECT
        id,
        evento_id
      FROM turmas
      WHERE id = $1
      LIMIT 1
      `,
      [turmaId]
    );

    const turma = turmaResult.rows?.[0];

    if (!turma) {
      return fail(res, 404, "Turma não encontrada.");
    }

    const acesso = await podeAcessarEvento({
      usuarioId,
      eventoId: turma.evento_id,
      exigirPublicado: true,
      permitirAdministrador: true,
    });

    if (!acesso?.ok) {
      if (IS_DEV) {
        console.warn("[inscricaoRoute] acesso negado por registro", {
          usuario_id: usuarioId,
          turma_id: turmaId,
          evento_id: turma.evento_id,
          motivo: acesso?.motivo || null,
        });
      }

      return fail(
        res,
        403,
        "Você não possui permissão para se inscrever nesta turma.",
        {
          motivo: acesso?.motivo || "SEM_PERMISSAO",
        }
      );
    }

    req.params = req.params || {};
    req.params.turma_id = String(turmaId);
    req.params.evento_id = String(turma.evento_id);

    return next();
  } catch (error) {
    console.error(
      "[inscricaoRoute] erro ao checar acesso por registro:",
      error?.stack || error
    );

    return fail(res, 500, "Erro ao validar acesso à turma.");
  }
}

/* ─────────────────────────────────────────────────────────────
 * Middlewares globais
 * ───────────────────────────────────────────────────────────── */

router.use(authMiddleware, noStore);

/* ─────────────────────────────────────────────────────────────
 * Diagnóstico DEV
 * ───────────────────────────────────────────────────────────── */

if (IS_DEV) {
  router.get("/_ping", routeTag("inscricaoRoute:GET /_ping"), (req, res) => {
    return res.json({
      ok: true,
      data: {
        modulo: "inscricao",
        usuario: {
          id: getAuthenticatedUserId(req),
          perfil: getAuthenticatedPerfil(req),
        },
      },
      message: "inscricaoRoute ativo.",
    });
  });
}

/* ─────────────────────────────────────────────────────────────
 * Inscrição do usuário autenticado
 * ───────────────────────────────────────────────────────────── */

/**
 * Inscreve o usuário autenticado em uma turma.
 *
 * POST /api/inscricao
 * Body:
 * - turma_id
 */
router.post(
  "/",
  authorize(...PERFIS_USUARIO),
  routeTag("inscricaoRoute:POST /"),
  checarAcessoPorRegistroNaTurma,
  wrap(controller.inscreverEmTurma)
);

/**
 * Lista as inscrições do usuário autenticado.
 *
 * GET /api/inscricao/minha
 */
router.get(
  "/minha",
  authorize(...PERFIS_USUARIO),
  routeTag("inscricaoRoute:GET /minha"),
  wrap(controller.listarMinhasInscricoes)
);

/**
 * Cancela a inscrição do usuário autenticado em uma turma específica.
 *
 * DELETE /api/inscricao/minha/turma/:turma_id
 *
 * Importante:
 * - precisa vir antes de DELETE /:inscricao_id.
 */
router.delete(
  "/minha/turma/:turma_id",
  authorize(...PERFIS_USUARIO),
  ensureNumericParam("turma_id"),
  routeTag("inscricaoRoute:DELETE /minha/turma/:turma_id"),
  wrap(controller.cancelarMinhaInscricaoPorTurma)
);

/**
 * Cancela uma inscrição pelo id da inscrição.
 *
 * DELETE /api/inscricao/:inscricao_id
 */
router.delete(
  "/:inscricao_id",
  authorize(...PERFIS_USUARIO),
  ensureNumericParam("inscricao_id"),
  routeTag("inscricaoRoute:DELETE /:inscricao_id"),
  wrap(controller.cancelarInscricaoPorId)
);

/* ─────────────────────────────────────────────────────────────
 * Gestão por turma
 * ───────────────────────────────────────────────────────────── */

/**
 * Lista inscritos de uma turma.
 *
 * GET /api/inscricao/turma/:turma_id
 */
router.get(
  "/turma/:turma_id",
  authorize(...PERFIS_GESTAO),
  ensureNumericParam("turma_id"),
  routeTag("inscricaoRoute:GET /turma/:turma_id"),
  wrap(controller.listarInscritosPorTurma)
);

/**
 * Administrador cancela inscrição de um usuário em uma turma.
 *
 * DELETE /api/inscricao/turma/:turma_id/usuario/:usuario_id
 */
router.delete(
  "/turma/:turma_id/usuario/:usuario_id",
  authorize("administrador"),
  ensureNumericParam("turma_id"),
  ensureNumericParam("usuario_id"),
  routeTag("inscricaoRoute:DELETE /turma/:turma_id/usuario/:usuario_id"),
  wrap(controller.cancelarInscricaoDoUsuarioNaTurma)
);

/* ─────────────────────────────────────────────────────────────
 * Conflito
 * ───────────────────────────────────────────────────────────── */

/**
 * Checa conflito de horário para uma turma.
 *
 * GET /api/inscricao/conflito/:turma_id
 */
router.get(
  "/conflito/:turma_id",
  authorize(...PERFIS_USUARIO),
  ensureNumericParam("turma_id"),
  routeTag("inscricaoRoute:GET /conflito/:turma_id"),
  checarAcessoPorRegistroNaTurma,
  wrap(controller.conflitoPorTurma)
);

module.exports = router;