"use strict";

/**
 * ✅ backend/src/controllers/saudePlataformaController.js — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Controller oficial da Saúde da Plataforma.
 *
 * Responsabilidades:
 * - Listar indicadores consolidados da Saúde da Plataforma.
 * - Consultar indicador específico por indicador_id.
 * - Exibir resumo executivo da saúde operacional.
 * - Exibir diagnóstico executivo com críticos e alertas.
 *
 * Contratos aplicados:
 * - Service oficial: saudePlataformaService
 * - View oficial: v_saude_plataforma
 * - Status oficiais:
 *   - saudavel
 *   - alerta
 *   - critico
 * - Severidades oficiais:
 *   - info
 *   - aviso
 *   - erro
 *   - critico
 * - Perfil obrigatório: administrador
 * - Resposta padrão: { ok, data, message, code, meta }
 * - Erro padrão: { ok:false, data:null, message, code, adminHint, details, requestId }
 * - Sem aliases
 * - Sem legado
 */

const saudePlataformaService = require("../services/saudePlataformaService");

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
    SEM_PERMISSAO_SAUDE_PLATAFORMA: 403,

    SAUDE_PLATAFORMA_INDICADOR_ID_INVALIDO: 400,
    SAUDE_PLATAFORMA_STATUS_INVALIDO: 400,
    SAUDE_PLATAFORMA_SEVERIDADE_INVALIDA: 400,

    SAUDE_PLATAFORMA_INDICADOR_NAO_ENCONTRADO: 404,
  };

  return mapa[code] || 500;
}

function erroController(prefixo, error, req, contexto = {}) {
  console.error(`[saudePlataformaController.${prefixo}] Erro:`, {
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
    const resultado = await saudePlataformaService.listarIndicadores(
      req,
      req.query || {}
    );

    return respostaSucesso(res, resultado);
  } catch (error) {
    erroController("listar", error, req);

    return respostaErro(
      res,
      montarErro(
        error,
        "Não foi possível carregar os indicadores da Saúde da Plataforma.",
        "SAUDE_PLATAFORMA_LISTAR_ERRO",
        "Falha ao consultar v_saude_plataforma. Verifique permissões, filtros, view e logs do servidor."
      ),
      statusHttp(error),
      req
    );
  }
}

async function obterPorId(req, res) {
  try {
    const resultado = await saudePlataformaService.obterIndicador(
      req,
      req.params?.indicador_id
    );

    return respostaSucesso(res, resultado);
  } catch (error) {
    erroController("obterPorId", error, req, {
      indicadorId: req.params?.indicador_id,
    });

    return respostaErro(
      res,
      montarErro(
        error,
        "Não foi possível carregar o indicador da Saúde da Plataforma.",
        "SAUDE_PLATAFORMA_OBTER_ERRO",
        "Falha ao consultar indicador por indicador_id. Verifique se o indicador existe na view v_saude_plataforma.",
        {
          indicadorId: req.params?.indicador_id,
        }
      ),
      statusHttp(error),
      req
    );
  }
}

async function resumo(req, res) {
  try {
    const resultado = await saudePlataformaService.resumoSaude(
      req,
      req.query || {}
    );

    return respostaSucesso(res, resultado);
  } catch (error) {
    erroController("resumo", error, req);

    return respostaErro(
      res,
      montarErro(
        error,
        "Não foi possível carregar o resumo da Saúde da Plataforma.",
        "SAUDE_PLATAFORMA_RESUMO_ERRO",
        "Falha ao calcular resumo da view v_saude_plataforma. Verifique permissões, filtros e logs do servidor."
      ),
      statusHttp(error),
      req
    );
  }
}

async function diagnosticoExecutivo(req, res) {
  try {
    const resultado = await saudePlataformaService.diagnosticoExecutivo(req);

    return respostaSucesso(res, resultado);
  } catch (error) {
    erroController("diagnosticoExecutivo", error, req);

    return respostaErro(
      res,
      montarErro(
        error,
        "Não foi possível carregar o diagnóstico executivo da Saúde da Plataforma.",
        "SAUDE_PLATAFORMA_DIAGNOSTICO_EXECUTIVO_ERRO",
        "Falha ao montar diagnóstico executivo. Verifique a view v_saude_plataforma, permissões e logs do servidor."
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
  diagnosticoExecutivo,
};