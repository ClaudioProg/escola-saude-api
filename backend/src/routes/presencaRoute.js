/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/presencaRoute.js — v2.1
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Rotas oficiais do módulo de presença.
 *
 * Mount oficial esperado:
 * - /api/presenca
 *
 * Contratos aplicados:
 * - Tabela oficial: presencas
 * - Sem rota plural /presencas
 * - Sem aliases turmaId/usuarioId/dataPresenca
 * - Sem req.usuario
 * - Sem req.userId/auth.userId
 * - Sem perfil/perfis/roles/admin
 * - Usuário autenticado oficial: req.user.id
 * - Perfil autenticado oficial: req.user.perfil
 * - Sem HEAD duplicado
 * - Sem aliases de QR/camelCase
 * - Sem rotas antigas em duplicidade
 * - Envelope oficial: { ok, data, message }
 * - Erro oficial: { ok:false, message, details? }
 * - Date-only em YYYY-MM-DD
 */

const express = require("express");

const authMiddleware = require("../auth/authMiddleware");
const { authorize } = require("../middlewares/authorize");
const presencaController = require("../controllers/presencaController");

const router = express.Router();

const IS_DEV = process.env.NODE_ENV !== "production";

const PERFIS_USUARIO = Object.freeze(["administrador", "organizador", "usuario"]);
const PERFIS_GESTAO = Object.freeze(["administrador", "organizador"]);
const PERFIS_ADMIN = Object.freeze(["administrador"]);

/* ─────────────────────────────────────────────────────────────
 * Validação de dependências oficiais
 * ───────────────────────────────────────────────────────────── */

if (typeof authMiddleware !== "function") {
  console.error("[presencaRoute] authMiddleware inválido:", authMiddleware);
  throw new Error(
    "authMiddleware deve ser exportado como função em backend/src/auth/authMiddleware.js."
  );
}

if (typeof authorize !== "function") {
  console.error("[presencaRoute] authorize inválido:", authorize);
  throw new Error(
    "authorize deve ser exportado como função nomeada em backend/src/middlewares/authorize.js."
  );
}

function requireControllerFunction(name) {
  const fn = presencaController?.[name];

  if (typeof fn !== "function") {
    console.error(`[presencaRoute] controller inválido: ${name}`, {
      available: Object.keys(presencaController || {}),
    });

    throw new Error(`presencaController.${name} deve ser exportado como função.`);
  }

  return fn;
}

const controller = Object.freeze({
  validarPresencaPublica: requireControllerFunction("validarPresencaPublica"),

  listarMinhasPresencas: requireControllerFunction("listarMinhasPresencas"),
  obterMeuResumoPresencas: requireControllerFunction("obterMeuResumoPresencas"),

  registrarPresenca: requireControllerFunction("registrarPresenca"),
  confirmarPresencaViaQR: requireControllerFunction("confirmarPresencaViaQR"),
  confirmarPresencaViaToken: requireControllerFunction("confirmarPresencaViaToken"),

  registrarPresencaManual: requireControllerFunction("registrarPresencaManual"),
  confirmarPresencaManualHoje: requireControllerFunction(
    "confirmarPresencaManualHoje"
  ),
  validarPresencaManual: requireControllerFunction("validarPresencaManual"),
  confirmarPresencaorganizador: requireControllerFunction(
    "confirmarPresencaorganizador"
  ),

  listarTurmasDoorganizador: requireControllerFunction("listarTurmasDoorganizador"),
  obterDetalhesTurma: requireControllerFunction("obterDetalhesTurma"),
  listarFrequenciasPorTurma: requireControllerFunction(
    "listarFrequenciasPorTurma"
  ),
  exportarPresencasPdfPorTurma: requireControllerFunction(
    "exportarPresencasPdfPorTurma"
  ),
  listarTodasPresencasParaAdmin: requireControllerFunction(
    "listarTodasPresencasParaAdmin"
  ),
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

function ensureDateOnlyQuery(paramName) {
  return (req, res, next) => {
    const value = String(req.query?.[paramName] || "").trim();

    if (!value) {
      return next();
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return fail(res, 400, `${paramName} deve estar no formato YYYY-MM-DD.`);
    }

    req.query[paramName] = value;

    return next();
  };
}

function getAuthenticatedUserId(req) {
  return toPositiveInt(req?.user?.id);
}

function getAuthenticatedPerfil(req) {
  return String(req?.user?.perfil || "").trim().toLowerCase();
}

/* ─────────────────────────────────────────────────────────────
 * Diagnóstico DEV público e seguro
 * ───────────────────────────────────────────────────────────── */

if (IS_DEV) {
  router.get("/_ping", routeTag("presencaRoute:GET /_ping"), (_req, res) => {
    return res.json({
      ok: true,
      data: {
        modulo: "presenca",
      },
      message: "presencaRoute ativo.",
    });
  });
}

/* ─────────────────────────────────────────────────────────────
 * Validação pública simples
 * ───────────────────────────────────────────────────────────── */

/**
 * Valida se um usuário teve presença confirmada em evento.
 *
 * GET /api/presenca/validar?evento_id=1&usuario_id=2
 */
router.get(
  "/validar",
  noStore,
  ensureDateOnlyQuery("data_presenca"),
  routeTag("presencaRoute:GET /validar"),
  wrap(controller.validarPresencaPublica)
);

/* ─────────────────────────────────────────────────────────────
 * Middlewares autenticados
 * ───────────────────────────────────────────────────────────── */

router.use(authMiddleware, noStore);

/* ─────────────────────────────────────────────────────────────
 * Diagnóstico DEV autenticado
 * ───────────────────────────────────────────────────────────── */

if (IS_DEV) {
  router.get(
    "/_auth/ping",
    routeTag("presencaRoute:GET /_auth/ping"),
    (req, res) => {
      return res.json({
        ok: true,
        data: {
          modulo: "presenca",
          usuario: {
            id: getAuthenticatedUserId(req),
            perfil: getAuthenticatedPerfil(req),
          },
        },
        message: "presencaRoute autenticado ativo.",
      });
    }
  );
}

/* ─────────────────────────────────────────────────────────────
 * Usuário autenticado
 * ───────────────────────────────────────────────────────────── */

/**
 * Lista as presenças do usuário autenticado.
 *
 * GET /api/presenca/minha
 */
router.get(
  "/minha",
  authorize(...PERFIS_USUARIO),
  routeTag("presencaRoute:GET /minha"),
  wrap(controller.listarMinhasPresencas)
);

/**
 * Obtém resumo das presenças do usuário autenticado.
 *
 * GET /api/presenca/minha/resumo
 */
router.get(
  "/minha/resumo",
  authorize(...PERFIS_USUARIO),
  routeTag("presencaRoute:GET /minha/resumo"),
  wrap(controller.obterMeuResumoPresencas)
);

/**
 * Registra presença do usuário autenticado.
 *
 * POST /api/presenca
 * Body oficial:
 * - turma_id
 * - data_presenca? YYYY-MM-DD
 */
router.post(
  "/",
  authorize(...PERFIS_USUARIO),
  routeTag("presencaRoute:POST /"),
  wrap(controller.registrarPresenca)
);

/**
 * Confirma presença via QR.
 *
 * POST /api/presenca/qr
 * Body oficial:
 * - turma_id
 * - token?
 */
router.post(
  "/qr",
  authorize(...PERFIS_USUARIO),
  routeTag("presencaRoute:POST /qr"),
  wrap(controller.confirmarPresencaViaQR)
);

/**
 * Confirma presença via token.
 *
 * POST /api/presenca/token
 * Body oficial:
 * - token
 */
router.post(
  "/token",
  authorize(...PERFIS_USUARIO),
  routeTag("presencaRoute:POST /token"),
  wrap(controller.confirmarPresencaViaToken)
);

/* ─────────────────────────────────────────────────────────────
 * Organizador/Admin
 * ───────────────────────────────────────────────────────────── */

/**
 * Lista turmas vinculadas ao organizador autenticado.
 *
 * GET /api/presenca/organizador/turma
 */
router.get(
  "/organizador/turma",
  authorize(...PERFIS_GESTAO),
  routeTag("presencaRoute:GET /organizador/turma"),
  wrap(controller.listarTurmasDoorganizador)
);

/**
 * Detalhes de presença de uma turma.
 *
 * GET /api/presenca/turma/:turma_id
 */
router.get(
  "/turma/:turma_id",
  authorize(...PERFIS_USUARIO),
  ensureNumericParam("turma_id"),
  routeTag("presencaRoute:GET /turma/:turma_id"),
  wrap(controller.obterDetalhesTurma)
);

/**
 * Frequências consolidadas de uma turma.
 *
 * GET /api/presenca/turma/:turma_id/frequencia
 */
router.get(
  "/turma/:turma_id/frequencia",
  authorize(...PERFIS_GESTAO),
  ensureNumericParam("turma_id"),
  routeTag("presencaRoute:GET /turma/:turma_id/frequencia"),
  wrap(controller.listarFrequenciasPorTurma)
);

/**
 * Exporta presenças da turma em PDF.
 *
 * GET /api/presenca/turma/:turma_id/pdf
 */
router.get(
  "/turma/:turma_id/pdf",
  authorize(...PERFIS_GESTAO),
  ensureNumericParam("turma_id"),
  routeTag("presencaRoute:GET /turma/:turma_id/pdf"),
  wrap(controller.exportarPresencasPdfPorTurma)
);

/**
 * Registro manual de presença.
 *
 * POST /api/presenca/manual
 * Body oficial:
 * - usuario_id
 * - turma_id
 * - data_presenca
 * - presente
 */
router.post(
  "/manual",
  authorize(...PERFIS_GESTAO),
  routeTag("presencaRoute:POST /manual"),
  wrap(controller.registrarPresencaManual)
);

/**
 * Confirma presença manual para hoje.
 *
 * POST /api/presenca/manual/hoje
 * Body oficial:
 * - usuario_id
 * - turma_id
 */
router.post(
  "/manual/hoje",
  authorize(...PERFIS_ADMIN),
  routeTag("presencaRoute:POST /manual/hoje"),
  wrap(controller.confirmarPresencaManualHoje)
);

/**
 * Validação manual de presença.
 *
 * PUT /api/presenca/manual/validar
 * Body oficial:
 * - usuario_id
 * - turma_id
 * - data_presenca
 * - presente
 */
router.put(
  "/manual/validar",
  authorize(...PERFIS_GESTAO),
  routeTag("presencaRoute:PUT /manual/validar"),
  wrap(controller.validarPresencaManual)
);

/**
 * Confirma presença pelo organizador.
 *
 * POST /api/presenca/organizador/confirmar
 * Body oficial:
 * - usuario_id
 * - turma_id
 * - data_presenca
 */
router.post(
  "/organizador/confirmar",
  authorize(...PERFIS_GESTAO),
  routeTag("presencaRoute:POST /organizador/confirmar"),
  wrap(controller.confirmarPresencaorganizador)
);

/* ─────────────────────────────────────────────────────────────
 * Administração
 * ───────────────────────────────────────────────────────────── */

/**
 * Lista todas as presenças para administração.
 *
 * GET /api/presenca/administrador
 */
router.get(
  "/administrador",
  authorize(...PERFIS_ADMIN),
  routeTag("presencaRoute:GET /administrador"),
  wrap(controller.listarTodasPresencasParaAdmin)
);

module.exports = router;