/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/notificacaoProgramadaController.js — v2.0
 * Atualizado em: 15/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Diagnosticar e executar notificações programadas da plataforma.
 *
 * Nesta etapa:
 * - Lembrete de início de evento/curso no dia anterior ao início da turma.
 *
 * Endpoints oficiais:
 * - GET  /api/notificacao-programada/diagnostico/lembrete-evento
 * - POST /api/notificacao-programada/executar/lembrete-evento
 *
 * Contratos:
 * - Perfil administrativo oficial: administrador.
 * - Sem req.usuario.
 * - Sem resposta { erro } / { mensagem }.
 * - Sem fallback de rota.
 * - Sem aliases de tipo/status.
 */

const {
  diagnosticarLembretesInicioEvento,
  executarLembretesInicioEvento,
} = require("../services/lembreteEventoService");

/* ──────────────────────────────────────────────────────────────
   Helpers de resposta
────────────────────────────────────────────────────────────── */

function getRequestId(req) {
  return (
    req?.id ||
    req?.requestId ||
    req?.headers?.["x-request-id"] ||
    req?.headers?.["x-correlation-id"] ||
    null
  );
}

function responderSucesso(res, payload, req = null, status = 200) {
  return res.status(status).json({
    ok: true,
    data: payload?.data ?? null,
    message: payload?.message || "Operação realizada com sucesso.",
    code: payload?.code || "NOTIFICACAO-PROGRAMADA-OK",
    meta: payload?.meta || {},
    requestId: getRequestId(req),
  });
}

function responderErro(res, status, code, message, req = null, extra = {}) {
  return res.status(status).json({
    ok: false,
    data: null,
    message,
    code,
    adminHint: extra.adminHint || null,
    details: extra.details || {},
    requestId: getRequestId(req),
  });
}

function isAdministrador(req) {
  return String(req?.user?.perfil || "").trim() === "administrador";
}

function normalizarDataReferencia(value) {
  const data = String(value || "").trim();

  if (!data) {
    return "";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    const error = new Error("A data de referência deve estar no formato YYYY-MM-DD.");
    error.code = "NOTIFICACAO-PROGRAMADA-DATA-INVALIDA";
    throw error;
  }

  return data;
}

function normalizarLimite(value) {
  if (value == null || value === "") {
    return null;
  }

  const limite = Number.parseInt(value, 10);

  if (!Number.isFinite(limite) || limite <= 0) {
    const error = new Error("O limite deve ser um número inteiro maior que zero.");
    error.code = "NOTIFICACAO-PROGRAMADA-LIMITE-INVALIDO";
    throw error;
  }

  return Math.min(limite, 1000);
}

function montarOptions(req) {
  const fonte = req.method === "GET" ? req.query : req.body;

  const dataReferencia = normalizarDataReferencia(
    fonte?.data_referencia || fonte?.dataReferencia
  );

  const limite = normalizarLimite(fonte?.limite);

  return {
    ...(dataReferencia ? { dataReferencia } : {}),
    ...(limite ? { limite } : {}),
  };
}

/* ──────────────────────────────────────────────────────────────
   GET /api/notificacao-programada/diagnostico/lembrete-evento
────────────────────────────────────────────────────────────── */

async function diagnosticarLembreteEvento(req, res) {
  try {
    if (!isAdministrador(req)) {
      return responderErro(
        res,
        403,
        "NOTIFICACAO-PROGRAMADA-403-PERFIL",
        "Apenas administradores podem acessar o diagnóstico de notificações programadas.",
        req,
        {
          adminHint:
            "Verifique se o authMiddleware está populando req.user.perfil com o valor oficial 'administrador'.",
        }
      );
    }

    const options = montarOptions(req);

    const resultado = await diagnosticarLembretesInicioEvento(options);

    return responderSucesso(res, resultado, req);
  } catch (err) {
    console.error("[notificacaoProgramadaController.diagnosticarLembreteEvento] ERRO", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint,
    });

    if (
      err?.code === "NOTIFICACAO-PROGRAMADA-DATA-INVALIDA" ||
      err?.code === "NOTIFICACAO-PROGRAMADA-LIMITE-INVALIDO"
    ) {
      return responderErro(res, 400, err.code, err.message, req);
    }

    return responderErro(
      res,
      500,
      "NOTIFICACAO-PROGRAMADA-500-DIAGNOSTICO",
      "Erro ao diagnosticar lembretes programados de início de evento.",
      req,
      {
        adminHint:
          "Verifique conexão com banco, service lembreteEventoService e estrutura das tabelas inscricoes, turmas, eventos, datas_turma e notificacoes_programadas.",
        details: {
          errorCode: err?.code || null,
          constraint: err?.constraint || null,
        },
      }
    );
  }
}

/* ──────────────────────────────────────────────────────────────
   POST /api/notificacao-programada/executar/lembrete-evento
────────────────────────────────────────────────────────────── */

async function executarLembreteEvento(req, res) {
  try {
    if (!isAdministrador(req)) {
      return responderErro(
        res,
        403,
        "NOTIFICACAO-PROGRAMADA-403-PERFIL",
        "Apenas administradores podem executar notificações programadas manualmente.",
        req,
        {
          adminHint:
            "Verifique se o authMiddleware está populando req.user.perfil com o valor oficial 'administrador'.",
        }
      );
    }

    const options = montarOptions(req);

    const resultado = await executarLembretesInicioEvento(options);

    return responderSucesso(res, resultado, req);
  } catch (err) {
    console.error("[notificacaoProgramadaController.executarLembreteEvento] ERRO", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint,
    });

    if (
      err?.code === "NOTIFICACAO-PROGRAMADA-DATA-INVALIDA" ||
      err?.code === "NOTIFICACAO-PROGRAMADA-LIMITE-INVALIDO"
    ) {
      return responderErro(res, 400, err.code, err.message, req);
    }

    return responderErro(
      res,
      500,
      "NOTIFICACAO-PROGRAMADA-500-EXECUCAO",
      "Erro ao executar lembretes programados de início de evento.",
      req,
      {
        adminHint:
          "Verifique SMTP, service mailer, tabela notificacoes, tabela notificacoes_programadas e constraints de contrato.",
        details: {
          errorCode: err?.code || null,
          constraint: err?.constraint || null,
        },
      }
    );
  }
}

module.exports = {
  diagnosticarLembreteEvento,
  executarLembreteEvento,
};