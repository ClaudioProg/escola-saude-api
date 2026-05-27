"use strict";

/**
 * ✅ backend/src/controllers/auditoriaController.js — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Controller oficial da Auditoria Premium Centralizada.
 *
 * Responsabilidades:
 * - Listar eventos de auditoria para administradores.
 * - Consultar evento de auditoria por ID.
 * - Exibir resumo administrativo da auditoria.
 * - Registrar auditoria manual/técnica quando necessário.
 *
 * Contratos aplicados:
 * - Service oficial: auditoriaService
 * - Tabela oficial: auditoria_eventos
 * - Perfis oficiais: usuario, organizador, administrador
 * - Resposta padrão: { ok, data, message, code, meta }
 * - Erro padrão: { ok:false, data:null, message, code, adminHint, details, requestId }
 * - Sem aliases
 * - Sem legado
 */

const auditoriaService = require("../services/auditoriaService");

/* ─────────────────────────────────────────────────────────────
 * Helpers internos
 * ───────────────────────────────────────────────────────────── */

function obterRequestId(req) {
  return (
    req?.requestId ||
    req?.id ||
    req?.headers?.["x-request-id"] ||
    null
  );
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

function respostaErro(res, erro = {}, status = 500, req = null) {
  return res.status(status).json({
    ok: false,
    data: null,
    message: erro.message || "Não foi possível concluir a operação.",
    code: erro.code || "ERRO_INTERNO",
    adminHint:
      erro.adminHint ||
      erro.admin_hint ||
      "Verifique os logs do servidor e o requestId informado.",
    details: erro.details || {},
    requestId: obterRequestId(req),
  });
}

function somenteAdministrador(req) {
  const perfil = req?.user?.perfil;

  if (Array.isArray(perfil)) {
    return perfil.includes("administrador");
  }

  return perfil === "administrador";
}

function validarAdministrador(req, res) {
  if (!req?.user?.id) {
    respostaErro(
      res,
      {
        message: "Usuário não autenticado.",
        code: "NAO_AUTENTICADO",
        adminHint: "A rota de auditoria exige autenticação.",
      },
      401,
      req
    );

    return false;
  }

  if (!somenteAdministrador(req)) {
    respostaErro(
      res,
      {
        message: "Você não tem permissão para acessar a auditoria.",
        code: "SEM_PERMISSAO_AUDITORIA",
        adminHint:
          "Somente usuários com perfil oficial administrador podem consultar auditoria.",
      },
      403,
      req
    );

    return false;
  }

  return true;
}

function parseBooleanQuery(valor) {
  if (valor === undefined || valor === null || valor === "") return null;

  if (valor === true || valor === "true") return true;
  if (valor === false || valor === "false") return false;

  return null;
}

function montarFiltrosAuditoria(query = {}) {
  return {
    usuario_id: query.usuario_id || null,
    modulo: query.modulo || null,
    acao: query.acao || null,
    entidade: query.entidade || null,
    entidade_id: query.entidade_id || null,
    sucesso: parseBooleanQuery(query.sucesso),
    severidade: query.severidade || null,
    request_id: query.request_id || null,
    data_inicio: query.data_inicio || null,
    data_fim: query.data_fim || null,
    limite: query.limite || 100,
    pagina: query.pagina || 1,
  };
}

/* ─────────────────────────────────────────────────────────────
 * Controllers administrativos
 * ───────────────────────────────────────────────────────────── */

async function listar(req, res) {
  try {
    if (!validarAdministrador(req, res)) return;

    const filtros = montarFiltrosAuditoria(req.query);

    const resultado = await auditoriaService.listarAuditoria(filtros);

    return respostaSucesso(res, resultado);
  } catch (error) {
    console.error("[auditoriaController.listar] Erro ao listar auditoria:", {
      message: error.message,
      code: error.code,
      requestId: obterRequestId(req),
    });

    return respostaErro(
      res,
      {
        message: "Não foi possível listar os eventos de auditoria.",
        code: "AUDITORIA_LISTAR_ERRO",
        adminHint:
          "Falha ao consultar auditoria_eventos. Verifique filtros, conexão com banco e logs do servidor.",
        details: {
          originalMessage: error.message,
          originalCode: error.code,
        },
      },
      500,
      req
    );
  }
}

async function obterPorId(req, res) {
  try {
    if (!validarAdministrador(req, res)) return;

    const { id } = req.params;

    const resultado = await auditoriaService.obterAuditoriaPorId(id);

    if (!resultado.ok) {
      return respostaErro(
        res,
        {
          message: resultado.message,
          code: resultado.code,
          adminHint:
            "O evento de auditoria solicitado não foi encontrado ou o ID informado é inválido.",
        },
        resultado.code === "AUDITORIA_ID_INVALIDO" ? 400 : 404,
        req
      );
    }

    return respostaSucesso(res, resultado);
  } catch (error) {
    console.error("[auditoriaController.obterPorId] Erro ao obter auditoria:", {
      message: error.message,
      code: error.code,
      requestId: obterRequestId(req),
      auditoriaId: req.params?.id,
    });

    return respostaErro(
      res,
      {
        message: "Não foi possível carregar o evento de auditoria.",
        code: "AUDITORIA_OBTER_ERRO",
        adminHint:
          "Falha ao consultar auditoria_eventos por ID. Verifique o identificador e os logs do servidor.",
        details: {
          originalMessage: error.message,
          originalCode: error.code,
          auditoriaId: req.params?.id,
        },
      },
      500,
      req
    );
  }
}

async function resumo(req, res) {
  try {
    if (!validarAdministrador(req, res)) return;

    const filtros = {
      data_inicio: req.query?.data_inicio || null,
      data_fim: req.query?.data_fim || null,
    };

    const resultado = await auditoriaService.resumoAuditoria(filtros);

    return respostaSucesso(res, resultado);
  } catch (error) {
    console.error("[auditoriaController.resumo] Erro ao carregar resumo:", {
      message: error.message,
      code: error.code,
      requestId: obterRequestId(req),
    });

    return respostaErro(
      res,
      {
        message: "Não foi possível carregar o resumo da auditoria.",
        code: "AUDITORIA_RESUMO_ERRO",
        adminHint:
          "Falha ao calcular resumo da auditoria. Verifique auditoria_eventos e logs do servidor.",
        details: {
          originalMessage: error.message,
          originalCode: error.code,
        },
      },
      500,
      req
    );
  }
}

/**
 * Registro manual de auditoria.
 *
 * Uso restrito a administrador.
 * Serve para eventos técnicos/controlados, testes diagnósticos ou marcações institucionais.
 */
async function registrarManual(req, res) {
  try {
    if (!validarAdministrador(req, res)) return;

    const {
      acao,
      modulo,
      entidade = null,
      entidade_id = null,
      sucesso = true,
      severidade = "info",
      dados_anteriores = null,
      dados_novos = null,
      detalhes = null,
      mensagem = null,
      admin_hint = null,
    } = req.body || {};

    const resultado = await auditoriaService.registrarAuditoria({
      req,
      acao,
      modulo,
      entidade,
      entidade_id,
      sucesso,
      severidade,
      dados_anteriores,
      dados_novos,
      detalhes,
      mensagem:
        mensagem ||
        "Evento de auditoria registrado manualmente por administrador.",
      admin_hint:
        admin_hint ||
        "Registro manual/técnico criado a partir do controller de auditoria.",
      critica: true,
    });

    return respostaSucesso(res, resultado, 201);
  } catch (error) {
    console.error(
      "[auditoriaController.registrarManual] Erro ao registrar auditoria manual:",
      {
        message: error.message,
        code: error.code,
        requestId: obterRequestId(req),
      }
    );

    return respostaErro(
      res,
      {
        message: "Não foi possível registrar o evento de auditoria.",
        code: error.code || "AUDITORIA_REGISTRAR_MANUAL_ERRO",
        adminHint:
          "Falha no registro manual de auditoria. Verifique contrato obrigatório: acao e modulo.",
        details: {
          originalMessage: error.message,
          originalCode: error.code,
        },
      },
      error.code === "AUDITORIA_ACAO_INVALIDA" ||
        error.code === "AUDITORIA_MODULO_INVALIDO"
        ? 400
        : 500,
      req
    );
  }
}

module.exports = {
  listar,
  obterPorId,
  resumo,
  registrarManual,
};