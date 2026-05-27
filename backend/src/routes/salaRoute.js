"use strict";

/**
 * 📁 backend/src/routes/salaRoute.js
 * Atualizado em: 15/05/2026
 *
 * Plataforma Escola da Saúde — v2.0
 *
 * Módulo:
 * - Agendamento / reserva de salas.
 *
 * Mount oficial:
 * - app.use("/api/sala", salaRoute);
 *
 * Contratos oficiais:
 * - GET    /api/sala/agenda-admin
 * - GET    /api/sala/agenda-usuario
 * - POST   /api/sala/solicitar
 * - PUT    /api/sala/minhas/:id
 * - DELETE /api/sala/minhas/:id
 * - POST   /api/sala/admin/reservas
 * - PUT    /api/sala/admin/reservas/:id
 * - DELETE /api/sala/admin/reservas/:id
 * - GET    /api/sala/admin/reservas/:id/termo-pdf
 *
 * Diretrizes v2.0:
 * - sem auth resiliente;
 * - sem safeHandler;
 * - sem resposta { erro };
 * - sem rotas para handlers inexistentes;
 * - admin validado por req.user.perfil === "administrador";
 * - cache no-store;
 * - requestId padronizado.
 */

const express = require("express");

const authMiddleware = require("../auth/authMiddleware");
const salaController = require("../controllers/salaController");

const router = express.Router();

const {
  listarAgendaAdmin,
  listarAgendaUsuario,
  solicitarReserva,
  atualizarReservaUsuario,
  excluirReservaUsuario,
  criarReservaAdmin,
  atualizarReservaAdmin,
  excluirReservaAdmin,
  visualizarTermoReservaAdmin,

  diagnosticarConfirmacaoUsoSala,
  executarConfirmacaoUsoSala,
  confirmarUsoSalaUsuario,
  diagnosticarCancelamentoSemConfirmacaoSala,
  executarCancelamentoSemConfirmacaoSala,
} = salaController;

/* =========================================================================
   Validação estrutural de imports
=========================================================================== */

if (typeof authMiddleware !== "function") {
  throw new Error(
    "[salaRoute] authMiddleware inválido. O export oficial de ../auth/authMiddleware deve ser uma função."
  );
}

for (const [nome, handler] of Object.entries({
  listarAgendaAdmin,
  listarAgendaUsuario,
  solicitarReserva,
  atualizarReservaUsuario,
  excluirReservaUsuario,
  criarReservaAdmin,
  atualizarReservaAdmin,
  excluirReservaAdmin,
  visualizarTermoReservaAdmin,

  diagnosticarConfirmacaoUsoSala,
  executarConfirmacaoUsoSala,
  confirmarUsoSalaUsuario,
  diagnosticarCancelamentoSemConfirmacaoSala,
  executarCancelamentoSemConfirmacaoSala,
})) {
  if (typeof handler !== "function") {
    throw new Error(`[salaRoute] Controller inválido. Função ausente: ${nome}.`);
  }
}

/* =========================================================================
   Helpers
=========================================================================== */

function gerarRequestId() {
  return `sala-route-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function wrap(handler) {
  return async function wrappedHandler(req, res, next) {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  return next();
}

function validarIdParam(req, res, next) {
  const requestId = gerarRequestId();
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: "ID inválido.",
      code: "ID_INVALIDO",
      adminHint: "O parâmetro :id deve ser um número inteiro positivo.",
      details: {
        param: "id",
        value: req.params.id,
      },
      requestId,
    });
  }

  req.params.id = String(id);
  return next();
}

function requireAdministrador(req, res, next) {
  const requestId = gerarRequestId();
  const perfil = String(req.user?.perfil || "").trim().toLowerCase();

  if (perfil !== "administrador") {
    return res.status(403).json({
      ok: false,
      data: null,
      message: "Acesso permitido apenas para administradores.",
      code: "ACESSO_ADMINISTRADOR_OBRIGATORIO",
      adminHint:
        "Verifique se o middleware de autenticação popula req.user.perfil com o valor oficial 'administrador'.",
      details: {
        perfil: perfil || null,
      },
      requestId,
    });
  }

  return next();
}

/* =========================================================================
   Middlewares globais
=========================================================================== */

router.use(authMiddleware);
router.use(noStore);

/* =========================================================================
   Agenda
=========================================================================== */

/**
 * Agenda administrativa.
 *
 * Query:
 * - ano
 * - mes
 * - sala opcional: auditorio | sala_reuniao
 */
router.get(
  "/agenda-admin",
  requireAdministrador,
  wrap(listarAgendaAdmin)
);

/**
 * Agenda do usuário.
 *
 * Query:
 * - ano
 * - mes
 * - sala opcional: auditorio | sala_reuniao
 */
router.get(
  "/agenda-usuario",
  wrap(listarAgendaUsuario)
);

/* =========================================================================
   Usuário
=========================================================================== */

/**
 * Solicitar nova reserva.
 */
router.post(
  "/solicitar",
  wrap(solicitarReserva)
);

/**
 * Atualizar a própria solicitação.
 *
 * Regra no controller:
 * - somente solicitante;
 * - somente status pendente.
 */
router.put(
  "/minhas/:id",
  validarIdParam,
  wrap(atualizarReservaUsuario)
);

/**
 * Cancelar a própria solicitação.
 *
 * v2.0:
 * - cancelamento lógico;
 * - status = cancelado;
 * - sem DELETE real.
 */
router.delete(
  "/minhas/:id",
  validarIdParam,
  wrap(excluirReservaUsuario)
);

/* =========================================================================
   Confirmação de uso da sala
=========================================================================== */

/**
 * Confirmar uso da própria reserva.
 *
 * Regra no controller/service:
 * - somente solicitante;
 * - somente reserva aprovada;
 * - somente entre 7 dias e 48 horas antes da data reservada;
 * - registra confirmado_em e confirmado_por;
 * - não cria status novo.
 */
router.post(
  "/minhas/:id/confirmar-uso",
  validarIdParam,
  wrap(confirmarUsoSalaUsuario)
);

/**
 * Diagnóstico administrativo das reservas que devem receber solicitação
 * de confirmação de uso.
 *
 * Query:
 * - data_base opcional: YYYY-MM-DD
 * - limite opcional
 */
router.get(
  "/confirmacao-uso/diagnostico",
  requireAdministrador,
  wrap(diagnosticarConfirmacaoUsoSala)
);

/**
 * Execução administrativa/manual das solicitações de confirmação.
 *
 * Body:
 * - data_base opcional: YYYY-MM-DD
 * - limite opcional
 */
router.post(
  "/confirmacao-uso/executar",
  requireAdministrador,
  wrap(executarConfirmacaoUsoSala)
);

/**
 * Diagnóstico administrativo das reservas aptas a cancelamento por ausência
 * de confirmação dentro do prazo.
 *
 * Query:
 * - data_base opcional: YYYY-MM-DD
 * - limite opcional
 */
router.get(
  "/confirmacao-uso/cancelamento/diagnostico",
  requireAdministrador,
  wrap(diagnosticarCancelamentoSemConfirmacaoSala)
);

/**
 * Execução administrativa/manual dos cancelamentos por ausência de confirmação.
 *
 * Body:
 * - data_base opcional: YYYY-MM-DD
 * - limite opcional
 */
router.post(
  "/confirmacao-uso/cancelamento/executar",
  requireAdministrador,
  wrap(executarCancelamentoSemConfirmacaoSala)
);

/* =========================================================================
   Administração
=========================================================================== */

/**
 * Criar reserva administrativa.
 */
router.post(
  "/admin/reservas",
  requireAdministrador,
  wrap(criarReservaAdmin)
);

/**
 * Atualizar reserva administrativa.
 */
router.put(
  "/admin/reservas/:id",
  requireAdministrador,
  validarIdParam,
  wrap(atualizarReservaAdmin)
);

/**
 * Cancelar reserva administrativa.
 *
 * v2.0:
 * - cancelamento lógico;
 * - status = cancelado;
 * - sem DELETE real.
 */
router.delete(
  "/admin/reservas/:id",
  requireAdministrador,
  validarIdParam,
  wrap(excluirReservaAdmin)
);

/**
 * Visualizar termo assinado da reserva.
 */
router.get(
  "/admin/reservas/:id/termo-pdf",
  requireAdministrador,
  validarIdParam,
  wrap(visualizarTermoReservaAdmin)
);

module.exports = router;