"use strict";

/**
 * ✅ backend/src/controllers/mensagemController.js — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Controller oficial da Caixa de Mensagens Institucional.
 *
 * Responsabilidades:
 * - Usuário abrir conversa institucional.
 * - Usuário listar suas próprias conversas.
 * - Usuário/admin consultar conversa com respostas.
 * - Usuário/admin responder conversa.
 * - Administrador listar todas as conversas.
 * - Administrador atualizar status, prioridade e atribuição.
 * - Administrador consultar resumo da caixa de mensagens.
 *
 * Contratos aplicados:
 * - Service oficial: mensagemService
 * - Tabelas oficiais:
 *   - mensagem_conversas
 *   - mensagem_respostas
 * - Perfis oficiais:
 *   - usuario
 *   - organizador
 *   - administrador
 * - Categorias oficiais:
 *   - duvida
 *   - sugestao
 *   - problema
 *   - certificado
 *   - inscricao
 *   - presenca
 *   - reserva
 *   - curso
 *   - pesquisa
 *   - interacao
 *   - outro
 * - Status oficiais:
 *   - aberta
 *   - em_atendimento
 *   - respondida
 *   - encerrada
 *   - arquivada
 * - Prioridades oficiais:
 *   - baixa
 *   - normal
 *   - alta
 *   - urgente
 * - Resposta padrão: { ok, data, message, code, meta }
 * - Erro padrão: { ok:false, data:null, message, code, adminHint, details, requestId }
 * - Sem aliases
 * - Sem legado
 */

const mensagemService = require("../services/mensagemService");

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
    USUARIO_AUTENTICADO_INVALIDO: 401,
    PERFIL_AUTENTICADO_INVALIDO: 403,
    SEM_PERMISSAO_MENSAGEM_ADMIN: 403,
    SEM_PERMISSAO_CONVERSA: 403,

    MENSAGEM_CONVERSA_NAO_ENCONTRADA: 404,

    MENSAGEM_ASSUNTO_INVALIDO: 400,
    MENSAGEM_TEXTO_INVALIDO: 400,
    MENSAGEM_CATEGORIA_INVALIDA: 400,
    MENSAGEM_STATUS_INVALIDO: 400,
    MENSAGEM_PRIORIDADE_INVALIDA: 400,
    MENSAGEM_USUARIO_ID_INVALIDO: 400,
    MENSAGEM_ATRIBUIDO_PARA_INVALIDO: 400,
    MENSAGEM_CONVERSA_ID_INVALIDO: 400,

    MENSAGEM_CONVERSA_FINALIZADA: 409,
    MENSAGEM_REABERTURA_NAO_PERMITIDA: 409,
  };

  return mapa[code] || 500;
}

function erroController(prefixo, error, req, contexto = {}) {
  console.error(`[mensagemController.${prefixo}] Erro:`, {
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
 * Usuário
 * ───────────────────────────────────────────────────────────── */

async function abrirConversa(req, res) {
  try {
    const resultado = await mensagemService.abrirConversa(req, req.body || {});
    return respostaSucesso(res, resultado, 201);
  } catch (error) {
    erroController("abrirConversa", error, req);

    return respostaErro(
      res,
      montarErro(
        error,
        "Não foi possível enviar sua mensagem.",
        "MENSAGEM_CRIAR_ERRO",
        "Falha ao criar conversa institucional. Verifique payload, usuário autenticado, constraints e logs do servidor."
      ),
      statusHttp(error),
      req
    );
  }
}

async function listarMinhasConversas(req, res) {
  try {
    const resultado = await mensagemService.listarMinhasConversas(req, req.query || {});
    return respostaSucesso(res, resultado);
  } catch (error) {
    erroController("listarMinhasConversas", error, req);

    return respostaErro(
      res,
      montarErro(
        error,
        "Não foi possível carregar suas mensagens.",
        "MENSAGEM_MINHAS_CONVERSAS_ERRO",
        "Falha ao listar conversas do usuário autenticado. Verifique req.user.id, filtros e logs do servidor."
      ),
      statusHttp(error),
      req
    );
  }
}

async function obterConversa(req, res) {
  try {
    const resultado = await mensagemService.obterConversa(req, req.params?.id);
    return respostaSucesso(res, resultado);
  } catch (error) {
    erroController("obterConversa", error, req, {
      conversaId: req.params?.id,
    });

    return respostaErro(
      res,
      montarErro(
        error,
        "Não foi possível carregar a conversa.",
        "MENSAGEM_CONVERSA_OBTER_ERRO",
        "Falha ao consultar conversa institucional. Verifique se a conversa existe e se o usuário tem permissão.",
        {
          conversaId: req.params?.id,
        }
      ),
      statusHttp(error),
      req
    );
  }
}

async function responderConversa(req, res) {
  try {
    const resultado = await mensagemService.responderConversa(
      req,
      req.params?.id,
      req.body || {}
    );

    return respostaSucesso(res, resultado, 201);
  } catch (error) {
    erroController("responderConversa", error, req, {
      conversaId: req.params?.id,
    });

    return respostaErro(
      res,
      montarErro(
        error,
        "Não foi possível enviar a resposta.",
        "MENSAGEM_RESPONDER_ERRO",
        "Falha ao responder conversa institucional. Verifique conversa, status, permissão e payload.",
        {
          conversaId: req.params?.id,
        }
      ),
      statusHttp(error),
      req
    );
  }
}

/* ─────────────────────────────────────────────────────────────
 * Administração
 * ───────────────────────────────────────────────────────────── */

async function listarConversasAdmin(req, res) {
  try {
    const resultado = await mensagemService.listarConversasAdmin(req, req.query || {});
    return respostaSucesso(res, resultado);
  } catch (error) {
    erroController("listarConversasAdmin", error, req);

    return respostaErro(
      res,
      montarErro(
        error,
        "Não foi possível carregar a caixa de mensagens administrativa.",
        "MENSAGEM_ADMIN_LISTAR_ERRO",
        "Falha ao listar conversas administrativas. Verifique permissões, filtros, extensão unaccent se usada e logs do servidor."
      ),
      statusHttp(error),
      req
    );
  }
}

async function atualizarConversaAdmin(req, res) {
  try {
    const resultado = await mensagemService.atualizarConversaAdmin(
      req,
      req.params?.id,
      req.body || {}
    );

    return respostaSucesso(res, resultado);
  } catch (error) {
    erroController("atualizarConversaAdmin", error, req, {
      conversaId: req.params?.id,
    });

    return respostaErro(
      res,
      montarErro(
        error,
        "Não foi possível atualizar a conversa.",
        "MENSAGEM_ADMIN_ATUALIZAR_ERRO",
        "Falha ao atualizar conversa institucional. Verifique status oficial, prioridade, atribuição e constraint de encerramento.",
        {
          conversaId: req.params?.id,
        }
      ),
      statusHttp(error),
      req
    );
  }
}

async function resumoMensagensAdmin(req, res) {
  try {
    const resultado = await mensagemService.resumoMensagensAdmin(req);
    return respostaSucesso(res, resultado);
  } catch (error) {
    erroController("resumoMensagensAdmin", error, req);

    return respostaErro(
      res,
      montarErro(
        error,
        "Não foi possível carregar o resumo da caixa de mensagens.",
        "MENSAGEM_ADMIN_RESUMO_ERRO",
        "Falha ao calcular resumo administrativo da caixa de mensagens. Verifique permissões e logs do servidor."
      ),
      statusHttp(error),
      req
    );
  }
}

module.exports = {
  abrirConversa,
  listarMinhasConversas,
  obterConversa,
  responderConversa,
  listarConversasAdmin,
  atualizarConversaAdmin,
  resumoMensagensAdmin,
};