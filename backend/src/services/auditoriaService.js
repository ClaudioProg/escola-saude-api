"use strict";

/**
 * ✅ backend/src/services/auditoriaService.js — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Service oficial da Auditoria Premium Centralizada.
 *
 * Responsabilidades:
 * - Registrar ações sensíveis e eventos rastreáveis em auditoria_eventos.
 * - Padronizar dados de auditoria entre módulos.
 * - Capturar requestId, IP, user-agent, método e rota a partir do req.
 * - Evitar vazamento de dados sensíveis excessivos.
 * - Não quebrar o fluxo principal quando a auditoria falhar em ação não crítica.
 *
 * Contratos aplicados:
 * - Tabela oficial: auditoria_eventos
 * - Perfis oficiais: usuario, organizador, administrador
 * - Severidades oficiais: debug, info, aviso, erro, critico
 * - Métodos HTTP oficiais: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
 * - Sem aliases
 * - Sem legado
 */

const pool = require("../db");

/* ─────────────────────────────────────────────────────────────
 * Contratos oficiais
 * ───────────────────────────────────────────────────────────── */

const PERFIS_OFICIAIS = new Set(["usuario", "organizador", "administrador"]);

const SEVERIDADES_OFICIAIS = new Set(["debug", "info", "aviso", "erro", "critico"]);

const METODOS_HTTP_OFICIAIS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

/* ─────────────────────────────────────────────────────────────
 * Helpers internos
 * ───────────────────────────────────────────────────────────── */

function textoOuNull(valor) {
  if (valor === undefined || valor === null) return null;

  const texto = String(valor).trim();
  return texto.length > 0 ? texto : null;
}

function limitarTexto(valor, limite = 2000) {
  const texto = textoOuNull(valor);
  if (!texto) return null;

  return texto.length > limite ? texto.slice(0, limite) : texto;
}

function normalizarBoolean(valor, padrao = true) {
  if (typeof valor === "boolean") return valor;
  return padrao;
}

function normalizarPerfil(perfil) {
  const texto = textoOuNull(perfil);

  if (!texto) return null;
  if (!PERFIS_OFICIAIS.has(texto)) return null;

  return texto;
}

function normalizarSeveridade(severidade) {
  const texto = textoOuNull(severidade) || "info";

  if (!SEVERIDADES_OFICIAIS.has(texto)) {
    return "info";
  }

  return texto;
}

function normalizarMetodoHttp(metodo) {
  const texto = textoOuNull(metodo);

  if (!texto) return null;

  const upper = texto.toUpperCase();

  if (!METODOS_HTTP_OFICIAIS.has(upper)) {
    return null;
  }

  return upper;
}

function normalizarJson(valor) {
  if (valor === undefined || valor === null) return null;

  if (typeof valor === "object") {
    return valor;
  }

  return {
    valor,
  };
}

function extrairRequestId(req) {
  if (!req) return null;

  return (
    textoOuNull(req.requestId) ||
    textoOuNull(req.id) ||
    textoOuNull(req.headers?.["x-request-id"]) ||
    null
  );
}

function extrairIp(req) {
  if (!req) return null;

  const forwardedFor = textoOuNull(req.headers?.["x-forwarded-for"]);

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return (
    textoOuNull(req.ip) ||
    textoOuNull(req.connection?.remoteAddress) ||
    textoOuNull(req.socket?.remoteAddress) ||
    null
  );
}

function extrairRota(req) {
  if (!req) return null;

  return (
    textoOuNull(req.originalUrl) ||
    textoOuNull(req.url) ||
    textoOuNull(req.path) ||
    null
  );
}

function extrairUsuarioId(req, usuario_id) {
  if (usuario_id !== undefined && usuario_id !== null) {
    const numero = Number(usuario_id);
    return Number.isInteger(numero) && numero > 0 ? numero : null;
  }

  const reqUserId = req?.user?.id;

  if (reqUserId !== undefined && reqUserId !== null) {
    const numero = Number(reqUserId);
    return Number.isInteger(numero) && numero > 0 ? numero : null;
  }

  return null;
}

function extrairPerfilUsuario(req, perfil_usuario) {
  const perfilInformado = normalizarPerfil(perfil_usuario);

  if (perfilInformado) {
    return perfilInformado;
  }

  const perfilReq = req?.user?.perfil;

  if (Array.isArray(perfilReq)) {
    const primeiroPerfilValido = perfilReq.find((perfil) =>
      PERFIS_OFICIAIS.has(String(perfil).trim())
    );

    return primeiroPerfilValido || null;
  }

  return normalizarPerfil(perfilReq);
}

function validarCamposObrigatorios({ acao, modulo }) {
  const acaoNormalizada = textoOuNull(acao);
  const moduloNormalizado = textoOuNull(modulo);

  if (!acaoNormalizada || acaoNormalizada.length < 3) {
    return {
      ok: false,
      message: "Ação de auditoria inválida.",
      code: "AUDITORIA_ACAO_INVALIDA",
    };
  }

  if (!moduloNormalizado || moduloNormalizado.length < 2) {
    return {
      ok: false,
      message: "Módulo de auditoria inválido.",
      code: "AUDITORIA_MODULO_INVALIDO",
    };
  }

  return {
    ok: true,
    acao: acaoNormalizada,
    modulo: moduloNormalizado,
  };
}

/* ─────────────────────────────────────────────────────────────
 * Função principal
 * ───────────────────────────────────────────────────────────── */

/**
 * Registra um evento na auditoria centralizada.
 *
 * @param {Object} params
 * @param {Object} [params.req] - Request Express, quando disponível.
 * @param {number} [params.usuario_id] - Usuário responsável pela ação.
 * @param {string} [params.perfil_usuario] - Perfil oficial no momento da ação.
 * @param {string} params.acao - Ação oficial executada.
 * @param {string} params.modulo - Módulo oficial afetado.
 * @param {string} [params.entidade] - Entidade afetada.
 * @param {string|number} [params.entidade_id] - ID ou código da entidade afetada.
 * @param {boolean} [params.sucesso=true] - Resultado da ação.
 * @param {string} [params.severidade=info] - Severidade oficial.
 * @param {Object} [params.dados_anteriores] - Estado anterior.
 * @param {Object} [params.dados_novos] - Estado novo.
 * @param {Object} [params.detalhes] - Detalhes complementares.
 * @param {string} [params.mensagem] - Mensagem compreensível.
 * @param {string} [params.admin_hint] - Diagnóstico técnico controlado.
 * @param {boolean} [params.critica=false] - Se true, relança erro em falha de auditoria.
 */
async function registrarAuditoria(params = {}) {
  const {
    req = null,
    usuario_id = null,
    perfil_usuario = null,
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
    critica = false,
  } = params;

  const validacao = validarCamposObrigatorios({ acao, modulo });

  if (!validacao.ok) {
    if (critica) {
      const erro = new Error(validacao.message);
      erro.code = validacao.code;
      throw erro;
    }

    console.error("[auditoriaService] Auditoria ignorada por contrato inválido:", {
      code: validacao.code,
      message: validacao.message,
      acao,
      modulo,
    });

    return {
      ok: false,
      data: null,
      message: validacao.message,
      code: validacao.code,
    };
  }

  const auditoria = {
    usuario_id: extrairUsuarioId(req, usuario_id),
    perfil_usuario: extrairPerfilUsuario(req, perfil_usuario),

    acao: validacao.acao,
    modulo: validacao.modulo,
    entidade: textoOuNull(entidade),
    entidade_id: textoOuNull(entidade_id),

    sucesso: normalizarBoolean(sucesso, true),
    severidade: normalizarSeveridade(severidade),

    dados_anteriores: normalizarJson(dados_anteriores),
    dados_novos: normalizarJson(dados_novos),
    detalhes: normalizarJson(detalhes),

    request_id: extrairRequestId(req),
    ip: limitarTexto(extrairIp(req), 255),
    user_agent: limitarTexto(req?.headers?.["user-agent"], 1000),
    metodo_http: normalizarMetodoHttp(req?.method),
    rota: limitarTexto(extrairRota(req), 1000),

    mensagem: limitarTexto(mensagem, 2000),
    admin_hint: limitarTexto(admin_hint, 4000),
  };

  try {
    const { rows } = await pool.query(
      `
        INSERT INTO auditoria_eventos (
          usuario_id,
          perfil_usuario,
          acao,
          modulo,
          entidade,
          entidade_id,
          sucesso,
          severidade,
          dados_anteriores,
          dados_novos,
          detalhes,
          request_id,
          ip,
          user_agent,
          metodo_http,
          rota,
          mensagem,
          admin_hint
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18
        )
        RETURNING
          id,
          usuario_id,
          perfil_usuario,
          acao,
          modulo,
          entidade,
          entidade_id,
          sucesso,
          severidade,
          request_id,
          criado_em
      `,
      [
        auditoria.usuario_id,
        auditoria.perfil_usuario,
        auditoria.acao,
        auditoria.modulo,
        auditoria.entidade,
        auditoria.entidade_id,
        auditoria.sucesso,
        auditoria.severidade,
        auditoria.dados_anteriores,
        auditoria.dados_novos,
        auditoria.detalhes,
        auditoria.request_id,
        auditoria.ip,
        auditoria.user_agent,
        auditoria.metodo_http,
        auditoria.rota,
        auditoria.mensagem,
        auditoria.admin_hint,
      ]
    );

    return {
      ok: true,
      data: rows[0],
      message: "Evento de auditoria registrado com sucesso.",
      code: "AUDITORIA_REGISTRADA",
    };
  } catch (error) {
    console.error("[auditoriaService] Falha ao registrar auditoria:", {
      message: error.message,
      code: error.code,
      acao: auditoria.acao,
      modulo: auditoria.modulo,
      entidade: auditoria.entidade,
      entidade_id: auditoria.entidade_id,
      request_id: auditoria.request_id,
    });

    if (critica) {
      throw error;
    }

    return {
      ok: false,
      data: null,
      message: "Não foi possível registrar o evento de auditoria.",
      code: "AUDITORIA_FALHA_REGISTRO",
      adminHint:
        "A falha de auditoria foi controlada e não interrompeu o fluxo principal.",
    };
  }
}

/* ─────────────────────────────────────────────────────────────
 * Consultas administrativas
 * ───────────────────────────────────────────────────────────── */

async function listarAuditoria(filtros = {}) {
  const {
    usuario_id = null,
    modulo = null,
    acao = null,
    entidade = null,
    entidade_id = null,
    sucesso = null,
    severidade = null,
    request_id = null,
    data_inicio = null,
    data_fim = null,
    limite = 100,
    pagina = 1,
  } = filtros;

  const where = [];
  const values = [];

  function addWhere(sql, value) {
    values.push(value);
    where.push(sql.replace("?", `$${values.length}`));
  }

  if (usuario_id !== null && usuario_id !== undefined && usuario_id !== "") {
    addWhere("usuario_id = ?", Number(usuario_id));
  }

  if (textoOuNull(modulo)) {
    addWhere("modulo = ?", textoOuNull(modulo));
  }

  if (textoOuNull(acao)) {
    addWhere("acao = ?", textoOuNull(acao));
  }

  if (textoOuNull(entidade)) {
    addWhere("entidade = ?", textoOuNull(entidade));
  }

  if (textoOuNull(entidade_id)) {
    addWhere("entidade_id = ?", textoOuNull(entidade_id));
  }

  if (typeof sucesso === "boolean") {
    addWhere("sucesso = ?", sucesso);
  }

  if (textoOuNull(severidade)) {
    addWhere("severidade = ?", normalizarSeveridade(severidade));
  }

  if (textoOuNull(request_id)) {
    addWhere("request_id = ?", textoOuNull(request_id));
  }

  if (textoOuNull(data_inicio)) {
    addWhere("criado_em >= ?", textoOuNull(data_inicio));
  }

  if (textoOuNull(data_fim)) {
    addWhere("criado_em <= ?", textoOuNull(data_fim));
  }

  const limiteSeguro = Math.min(Math.max(Number(limite) || 100, 1), 500);
  const paginaSegura = Math.max(Number(pagina) || 1, 1);
  const offset = (paginaSegura - 1) * limiteSeguro;

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  values.push(limiteSeguro);
  const limiteParam = `$${values.length}`;

  values.push(offset);
  const offsetParam = `$${values.length}`;

  const { rows } = await pool.query(
    `
      SELECT
        id,
        usuario_id,
        perfil_usuario,
        acao,
        modulo,
        entidade,
        entidade_id,
        sucesso,
        severidade,
        dados_anteriores,
        dados_novos,
        detalhes,
        request_id,
        ip,
        user_agent,
        metodo_http,
        rota,
        mensagem,
        admin_hint,
        criado_em
      FROM auditoria_eventos
      ${whereSql}
      ORDER BY criado_em DESC, id DESC
      LIMIT ${limiteParam}
      OFFSET ${offsetParam}
    `,
    values
  );

  const countValues = values.slice(0, values.length - 2);

  const totalResult = await pool.query(
    `
      SELECT COUNT(*)::INTEGER AS total
      FROM auditoria_eventos
      ${whereSql}
    `,
    countValues
  );

  const total = totalResult.rows[0]?.total || 0;

  return {
    ok: true,
    data: rows,
    message: "Eventos de auditoria listados com sucesso.",
    code: "AUDITORIA_LISTADA",
    meta: {
      total,
      pagina: paginaSegura,
      limite: limiteSeguro,
      total_paginas: Math.ceil(total / limiteSeguro),
    },
  };
}

async function obterAuditoriaPorId(id) {
  const auditoriaId = Number(id);

  if (!Number.isInteger(auditoriaId) || auditoriaId <= 0) {
    return {
      ok: false,
      data: null,
      message: "Identificador de auditoria inválido.",
      code: "AUDITORIA_ID_INVALIDO",
    };
  }

  const { rows } = await pool.query(
    `
      SELECT
        id,
        usuario_id,
        perfil_usuario,
        acao,
        modulo,
        entidade,
        entidade_id,
        sucesso,
        severidade,
        dados_anteriores,
        dados_novos,
        detalhes,
        request_id,
        ip,
        user_agent,
        metodo_http,
        rota,
        mensagem,
        admin_hint,
        criado_em
      FROM auditoria_eventos
      WHERE id = $1
      LIMIT 1
    `,
    [auditoriaId]
  );

  if (!rows[0]) {
    return {
      ok: false,
      data: null,
      message: "Evento de auditoria não encontrado.",
      code: "AUDITORIA_NAO_ENCONTRADA",
    };
  }

  return {
    ok: true,
    data: rows[0],
    message: "Evento de auditoria encontrado com sucesso.",
    code: "AUDITORIA_ENCONTRADA",
  };
}

async function resumoAuditoria(filtros = {}) {
  const { data_inicio = null, data_fim = null } = filtros;

  const where = [];
  const values = [];

  function addWhere(sql, value) {
    values.push(value);
    where.push(sql.replace("?", `$${values.length}`));
  }

  if (textoOuNull(data_inicio)) {
    addWhere("criado_em >= ?", textoOuNull(data_inicio));
  }

  if (textoOuNull(data_fim)) {
    addWhere("criado_em <= ?", textoOuNull(data_fim));
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `
      SELECT
        COUNT(*)::INTEGER AS total_eventos,
        COUNT(*) FILTER (WHERE sucesso = true)::INTEGER AS total_sucesso,
        COUNT(*) FILTER (WHERE sucesso = false)::INTEGER AS total_falha,
        COUNT(*) FILTER (WHERE severidade = 'debug')::INTEGER AS total_debug,
        COUNT(*) FILTER (WHERE severidade = 'info')::INTEGER AS total_info,
        COUNT(*) FILTER (WHERE severidade = 'aviso')::INTEGER AS total_aviso,
        COUNT(*) FILTER (WHERE severidade = 'erro')::INTEGER AS total_erro,
        COUNT(*) FILTER (WHERE severidade = 'critico')::INTEGER AS total_critico,
        MIN(criado_em) AS primeiro_registro,
        MAX(criado_em) AS ultimo_registro
      FROM auditoria_eventos
      ${whereSql}
    `,
    values
  );

  const porModulo = await pool.query(
    `
      SELECT
        modulo,
        COUNT(*)::INTEGER AS total
      FROM auditoria_eventos
      ${whereSql}
      GROUP BY modulo
      ORDER BY total DESC, modulo ASC
      LIMIT 20
    `,
    values
  );

  const porAcao = await pool.query(
    `
      SELECT
        acao,
        COUNT(*)::INTEGER AS total
      FROM auditoria_eventos
      ${whereSql}
      GROUP BY acao
      ORDER BY total DESC, acao ASC
      LIMIT 20
    `,
    values
  );

  return {
    ok: true,
    data: {
      geral: rows[0],
      por_modulo: porModulo.rows,
      por_acao: porAcao.rows,
    },
    message: "Resumo de auditoria carregado com sucesso.",
    code: "AUDITORIA_RESUMO",
  };
}

module.exports = {
  registrarAuditoria,
  listarAuditoria,
  obterAuditoriaPorId,
  resumoAuditoria,
};