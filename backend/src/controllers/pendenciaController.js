"use strict";

/**
 * ✅ backend/src/controllers/pendenciaController.js — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Controller oficial do Painel de Pendências Administrativas.
 *
 * Responsabilidades:
 * - Listar pendências administrativas derivadas.
 * - Consultar pendência específica por pendencia_id.
 * - Exibir resumo consolidado de pendências.
 *
 * Contratos aplicados:
 * - Service oficial: pendenciaService
 * - View oficial: v_pendencias_administrativas
 * - Perfil obrigatório: administrador
 * - Resposta padrão: { ok, data, message, code, meta }
 * - Erro padrão: { ok:false, data:null, message, code, adminHint, details, requestId }
 * - Sem aliases
 * - Sem legado
 */

const pendenciaService = require("../services/pendenciaService");

/* ─────────────────────────────────────────────────────────────
 * Helpers internos
 * ───────────────────────────────────────────────────────────── */

function obterRequestId(req) {
  return req?.requestId || req?.id || req?.headers?.["x-request-id"] || null;
}

function respostaSucesso(res, resultado, status = 200) {
  return res.status(status).json({
    ok: true,
    data: resultado?.data ?? null,
    message: resultado?.message || "Operação realizada com sucesso.",
    code: resultado?.code || "OK",
    ...(resultado?.meta ? { meta: resultado.meta } : {}),
  });
}

function respostaErro(res, error = {}, status = 500, req = null) {
  return res.status(status).json({
    ok: false,
    data: null,
    message: error.message || "Não foi possível concluir a operação.",
    code: error.code || "ERRO_INTERNO",
    adminHint:
      error.adminHint ||
      error.admin_hint ||
      "Verifique os logs do servidor e o requestId informado.",
    details: error.details || {},
    requestId: obterRequestId(req),
  });
}

function statusHttp(error) {
  const status = Number(error?.status);

  if (Number.isInteger(status) && status >= 400 && status <= 599) {
    return status;
  }

  const code = error?.code;

  const mapa = {
    NAO_AUTENTICADO: 401,
    SEM_PERMISSAO_PENDENCIAS: 403,

    PENDENCIA_ID_INVALIDO: 400,
    PENDENCIA_SEVERIDADE_INVALIDA: 400,
    PENDENCIA_PRIORIDADE_INVALIDA: 400,
    PENDENCIA_STATUS_INVALIDO: 400,
    PENDENCIA_USUARIO_ID_INVALIDO: 400,

    PENDENCIA_NAO_ENCONTRADA: 404,
  };

  return mapa[code] || 500;
}

function erroController(prefixo, error, req, contexto = {}) {
  console.error(`[pendenciaController.${prefixo}] Erro:`, {
    message: error.message,
    code: error.code,
    requestId: obterRequestId(req),
    ...contexto,
  });
}

function montarErro(error, fallbackMessage, fallbackCode, adminHint, details = {}) {
  return {
    message: error.message || fallbackMessage,
    code: error.code || fallbackCode,
    adminHint,
    details: {
      originalMessage: error.message,
      originalCode: error.code,
      ...details,
    },
  };
}

/* ─────────────────────────────────────────────────────────────
 * Controllers
 * ───────────────────────────────────────────────────────────── */

async function listar(req, res) {
  try {
    const resultado = await pendenciaService.listarPendencias(req, req.query || {});
    return respostaSucesso(res, resultado);
  } catch (error) {
    erroController("listar", error, req);

    return respostaErro(
      res,
      montarErro(
        error,
        "Não foi possível carregar as pendências administrativas.",
        "PENDENCIAS_LISTAR_ERRO",
        "Falha ao consultar v_pendencias_administrativas. Verifique permissões, filtros, view e logs do servidor."
      ),
      statusHttp(error),
      req
    );
  }
}

async function obterPorId(req, res) {
  try {
    const resultado = await pendenciaService.obterPendencia(
      req,
      req.params?.pendencia_id
    );

    return respostaSucesso(res, resultado);
  } catch (error) {
    erroController("obterPorId", error, req, {
      pendenciaId: req.params?.pendencia_id,
    });

    return respostaErro(
      res,
      montarErro(
        error,
        "Não foi possível carregar a pendência administrativa.",
        "PENDENCIA_OBTER_ERRO",
        "Falha ao consultar pendência por pendencia_id. Verifique se a pendência ainda existe na view derivada.",
        {
          pendenciaId: req.params?.pendencia_id,
        }
      ),
      statusHttp(error),
      req
    );
  }
}

async function resumo(req, res) {
  try {
    const resultado = await pendenciaService.resumoPendencias(req, req.query || {});
    return respostaSucesso(res, resultado);
  } catch (error) {
    erroController("resumo", error, req);

    return respostaErro(
      res,
      montarErro(
        error,
        "Não foi possível carregar o resumo de pendências.",
        "PENDENCIAS_RESUMO_ERRO",
        "Falha ao calcular resumo da view v_pendencias_administrativas. Verifique permissões, filtros e logs do servidor."
      ),
      statusHttp(error),
      req
    );
  }
}

module.exports = {
  listar,
  obterPorId,
  resumo,
};