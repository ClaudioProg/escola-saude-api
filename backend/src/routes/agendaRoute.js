"use strict";

/* eslint-disable no-console */

/**
 * ✅ backend/src/routes/agendaRoute.js — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Rotas oficiais da agenda de eventos.
 * - Agenda administrativa geral.
 * - Agenda do organizador.
 * - Minha agenda como participante.
 * - Minha agenda como organizador.
 * - Calendário administrativo de bloqueios/feriados.
 *
 * Mount oficial:
 * - /api/agenda
 *
 * Contratos obrigatórios:
 * - authMiddleware exportado como função em ../auth/authMiddleware
 * - authorize exportado como função nomeada em ../middlewares/authorize
 * - agendaController com funções oficiais:
 *   - buscarAgenda
 *   - buscarAgendaorganizador
 *   - buscarAgendaMinha
 *   - buscarAgendaMinhaorganizador
 *   - listarBloqueios
 *   - criarBloqueio
 *   - removerBloqueio
 *
 * Diretrizes v2.0:
 * - Sem aliases.
 * - Sem fallback legado.
 * - Sem resolução flexível de middleware.
 * - Sem rotas duplicadas.
 * - Sem cache.
 * - Rate limit separado por grupo funcional.
 * - Resposta de erro padronizada.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");

const authMiddleware = require("../auth/authMiddleware");
const { authorize } = require("../middlewares/authorize");
const agendaController = require("../controllers/agendaController");

const router = express.Router();

/* ─────────────────────────────────────────────
 * Validações estruturais de contrato
 * ───────────────────────────────────────────── */

if (typeof authMiddleware !== "function") {
  console.error("[agendaRoute] authMiddleware inválido:", authMiddleware);

  throw new Error(
    "Contrato inválido: ../auth/authMiddleware deve exportar uma função."
  );
}

if (typeof authorize !== "function") {
  console.error("[agendaRoute] authorize inválido:", authorize);

  throw new Error(
    "Contrato inválido: ../middlewares/authorize deve expor { authorize } como função."
  );
}

const controllerObrigatorio = [
  "buscarAgenda",
  "buscarAgendaorganizador",
  "buscarAgendaMinha",
  "buscarAgendaMinhaorganizador",
  "listarBloqueios",
  "criarBloqueio",
  "removerBloqueio",
];

for (const nomeFuncao of controllerObrigatorio) {
  if (typeof agendaController?.[nomeFuncao] !== "function") {
    console.error(
      `[agendaRoute] agendaController.${nomeFuncao} inválido:`,
      agendaController?.[nomeFuncao]
    );

    throw new Error(
      `Contrato inválido: agendaController.${nomeFuncao} deve ser uma função.`
    );
  }
}

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    next(error);
  }
};

function criarMensagemRateLimit(message, code, adminHint) {
  return {
    ok: false,
    data: null,
    message,
    code,
    adminHint,
  };
}

/* ─────────────────────────────────────────────
 * Headers globais da rota
 * ───────────────────────────────────────────── */

router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Route-Group", "agenda");
  next();
});

/* ─────────────────────────────────────────────
 * Rate limits
 * ───────────────────────────────────────────── */

const agendaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: criarMensagemRateLimit(
    "Muitas consultas à agenda em pouco tempo. Aguarde alguns instantes e tente novamente.",
    "AGENDA_RATE_LIMIT",
    "Rate limit aplicado ao grupo de consultas da agenda de eventos."
  ),
});

const calendarioLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: criarMensagemRateLimit(
    "Muitas operações no calendário em pouco tempo. Aguarde alguns instantes e tente novamente.",
    "AGENDA_CALENDARIO_RATE_LIMIT",
    "Rate limit aplicado ao grupo administrativo de bloqueios e feriados da agenda."
  ),
});

/* ─────────────────────────────────────────────
 * Agenda de eventos
 * ───────────────────────────────────────────── */

/**
 * GET /api/agenda
 *
 * Função:
 * - Consulta administrativa da agenda geral de eventos.
 *
 * Query oficial esperada:
 * - local?: string
 * - start?: YYYY-MM-DD
 * - end?: YYYY-MM-DD
 *
 * Permissão:
 * - administrador
 */
router.get(
  "/",
  agendaLimiter,
  authMiddleware,
  authorize("administrador"),
  asyncHandler(agendaController.buscarAgenda)
);

/**
 * GET /api/agenda/organizador
 *
 * Função:
 * - Consulta da agenda vinculada ao organizador autenticado.
 *
 * Query oficial esperada:
 * - start?: YYYY-MM-DD
 * - end?: YYYY-MM-DD
 *
 * Permissão:
 * - usuário autenticado.
 * - regra de organizador deve ser validada no controller/service conforme vínculo real.
 */
router.get(
  "/organizador",
  agendaLimiter,
  authMiddleware,
  asyncHandler(agendaController.buscarAgendaorganizador)
);

/**
 * GET /api/agenda/minha
 *
 * Função:
 * - Consulta da agenda do usuário autenticado como participante/inscrito.
 *
 * Query oficial esperada:
 * - start?: YYYY-MM-DD
 * - end?: YYYY-MM-DD
 *
 * Permissão:
 * - usuário autenticado.
 */
router.get(
  "/minha",
  agendaLimiter,
  authMiddleware,
  asyncHandler(agendaController.buscarAgendaMinha)
);

/**
 * GET /api/agenda/minha-organizador
 *
 * Função:
 * - Consulta da agenda do usuário autenticado como organizador.
 *
 * Query oficial esperada:
 * - start?: YYYY-MM-DD
 * - end?: YYYY-MM-DD
 *
 * Permissão:
 * - usuário autenticado.
 * - regra de organizador deve ser validada no controller/service conforme vínculo real.
 */
router.get(
  "/minha-organizador",
  agendaLimiter,
  authMiddleware,
  asyncHandler(agendaController.buscarAgendaMinhaorganizador)
);

/* ─────────────────────────────────────────────
 * Calendário administrativo da agenda
 * ───────────────────────────────────────────── */

/**
 * GET /api/agenda/calendario
 *
 * Função:
 * - Lista bloqueios, feriados e indisponibilidades administrativas da agenda.
 *
 * Permissão:
 * - administrador
 */
router.get(
  "/calendario",
  calendarioLimiter,
  authMiddleware,
  authorize("administrador"),
  asyncHandler(agendaController.listarBloqueios)
);

/**
 * POST /api/agenda/calendario
 *
 * Função:
 * - Cria bloqueio, feriado ou indisponibilidade administrativa da agenda.
 *
 * Permissão:
 * - administrador
 */
router.post(
  "/calendario",
  calendarioLimiter,
  authMiddleware,
  authorize("administrador"),
  asyncHandler(agendaController.criarBloqueio)
);

/**
 * DELETE /api/agenda/calendario/:id
 *
 * Função:
 * - Remove bloqueio, feriado ou indisponibilidade administrativa da agenda.
 *
 * Params oficiais:
 * - id
 *
 * Permissão:
 * - administrador
 */
router.delete(
  "/calendario/:id",
  calendarioLimiter,
  authMiddleware,
  authorize("administrador"),
  asyncHandler(agendaController.removerBloqueio)
);

module.exports = router;