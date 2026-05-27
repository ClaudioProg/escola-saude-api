"use strict";

/**
 * ✅ backend/src/services/pendenciaService.js — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Service oficial do Painel de Pendências Administrativas.
 *
 * Responsabilidades:
 * - Listar pendências administrativas derivadas da view oficial.
 * - Obter resumo consolidado por severidade, prioridade, módulo e tipo.
 * - Consultar pendência específica por pendencia_id.
 * - Apoiar Saúde da Plataforma e diagnóstico administrativo.
 *
 * Contratos aplicados:
 * - View oficial: v_pendencias_administrativas
 * - Status derivado inicial: pendente
 * - Severidades oficiais:
 *   - info
 *   - aviso
 *   - erro
 *   - critico
 * - Prioridades oficiais:
 *   - baixa
 *   - normal
 *   - alta
 *   - urgente
 * - Perfil obrigatório para consulta: administrador
 * - Sem aliases
 * - Sem legado
 */

const pool = require("../db");
const auditoriaService = require("./auditoriaService");

/* ─────────────────────────────────────────────────────────────
 * Contratos oficiais
 * ───────────────────────────────────────────────────────────── */

const SEVERIDADES_OFICIAIS = new Set(["info", "aviso", "erro", "critico"]);

const PRIORIDADES_OFICIAIS = new Set(["baixa", "normal", "alta", "urgente"]);

const STATUS_OFICIAIS = new Set(["pendente"]);

/* ─────────────────────────────────────────────────────────────
 * Helpers internos
 * ───────────────────────────────────────────────────────────── */

function textoOuNull(valor) {
  if (valor === undefined || valor === null) return null;

  const texto = String(valor).trim();
  return texto.length > 0 ? texto : null;
}

function numeroPositivo(valor, padrao, minimo = 1, maximo = 500) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) return padrao;

  return Math.min(Math.max(Math.trunc(numero), minimo), maximo);
}

function usuarioEhAdministrador(req) {
  const perfil = req?.user?.perfil;

  if (Array.isArray(perfil)) {
    return perfil.includes("administrador");
  }

  return perfil === "administrador";
}

function exigirAdministrador(req) {
  if (!req?.user?.id) {
    const error = new Error("Usuário não autenticado.");
    error.code = "NAO_AUTENTICADO";
    error.status = 401;
    throw error;
  }

  if (!usuarioEhAdministrador(req)) {
    const error = new Error("Você não tem permissão para acessar pendências administrativas.");
    error.code = "SEM_PERMISSAO_PENDENCIAS";
    error.status = 403;
    throw error;
  }
}

function normalizarSeveridade(severidade) {
  const texto = textoOuNull(severidade);

  if (!texto) return null;

  if (!SEVERIDADES_OFICIAIS.has(texto)) {
    const error = new Error("Severidade inválida.");
    error.code = "PENDENCIA_SEVERIDADE_INVALIDA";
    error.status = 400;
    throw error;
  }

  return texto;
}

function normalizarPrioridade(prioridade) {
  const texto = textoOuNull(prioridade);

  if (!texto) return null;

  if (!PRIORIDADES_OFICIAIS.has(texto)) {
    const error = new Error("Prioridade inválida.");
    error.code = "PENDENCIA_PRIORIDADE_INVALIDA";
    error.status = 400;
    throw error;
  }

  return texto;
}

function normalizarStatus(status) {
  const texto = textoOuNull(status);

  if (!texto) return null;

  if (!STATUS_OFICIAIS.has(texto)) {
    const error = new Error("Status de pendência inválido.");
    error.code = "PENDENCIA_STATUS_INVALIDO";
    error.status = 400;
    throw error;
  }

  return texto;
}

function montarPaginacao(filtros = {}) {
  const limite = numeroPositivo(filtros.limite, 50, 1, 500);
  const pagina = numeroPositivo(filtros.pagina, 1, 1, 999999);
  const offset = (pagina - 1) * limite;

  return {
    limite,
    pagina,
    offset,
  };
}

function montarWhere(filtros = {}) {
  const where = [];
  const values = [];

  function add(sql, valor) {
    values.push(valor);
    where.push(sql.replace("?", `$${values.length}`));
  }

  const modulo = textoOuNull(filtros.modulo);
  const tipo = textoOuNull(filtros.tipo);
  const entidade = textoOuNull(filtros.entidade);
  const entidade_id = textoOuNull(filtros.entidade_id);
  const origem = textoOuNull(filtros.origem);
  const busca = textoOuNull(filtros.busca);

  const severidade = normalizarSeveridade(filtros.severidade);
  const prioridade = normalizarPrioridade(filtros.prioridade);
  const status = normalizarStatus(filtros.status);

  if (modulo) add("modulo = ?", modulo);
  if (tipo) add("tipo = ?", tipo);
  if (entidade) add("entidade = ?", entidade);
  if (entidade_id) add("entidade_id = ?", entidade_id);
  if (origem) add("origem = ?", origem);
  if (severidade) add("severidade = ?", severidade);
  if (prioridade) add("prioridade = ?", prioridade);
  if (status) add("status = ?", status);

  if (filtros.usuario_id !== undefined && filtros.usuario_id !== null && filtros.usuario_id !== "") {
    const usuarioId = Number(filtros.usuario_id);

    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      const error = new Error("Usuário da pendência inválido.");
      error.code = "PENDENCIA_USUARIO_ID_INVALIDO";
      error.status = 400;
      throw error;
    }

    add("usuario_id = ?", usuarioId);
  }

  if (textoOuNull(filtros.data_inicio)) {
    add("criado_em >= ?", textoOuNull(filtros.data_inicio));
  }

  if (textoOuNull(filtros.data_fim)) {
    add("criado_em <= ?", textoOuNull(filtros.data_fim));
  }

  if (busca) {
    values.push(`%${busca}%`);
    const param = `$${values.length}`;

    where.push(`
      (
        titulo ILIKE ${param}
        OR descricao ILIKE ${param}
        OR modulo ILIKE ${param}
        OR tipo ILIKE ${param}
        OR entidade ILIKE ${param}
        OR entidade_id ILIKE ${param}
      )
    `);
  }

  return {
    whereSql: where.length > 0 ? `WHERE ${where.join(" AND ")}` : "",
    values,
  };
}

function orderByPendencias() {
  return `
    ORDER BY
      CASE prioridade
        WHEN 'urgente' THEN 1
        WHEN 'alta' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'baixa' THEN 4
        ELSE 5
      END,
      CASE severidade
        WHEN 'critico' THEN 1
        WHEN 'erro' THEN 2
        WHEN 'aviso' THEN 3
        WHEN 'info' THEN 4
        ELSE 5
      END,
      atualizado_em DESC NULLS LAST,
      criado_em DESC NULLS LAST,
      pendencia_id ASC
  `;
}

async function registrarConsultaAuditoria(req, detalhes = {}) {
  await auditoriaService.registrarAuditoria({
    req,
    acao: "consultar",
    modulo: "pendencia",
    entidade: "v_pendencias_administrativas",
    entidade_id: null,
    sucesso: true,
    severidade: "info",
    detalhes,
    mensagem: "Consulta ao Painel de Pendências Administrativas.",
    admin_hint:
      "Consulta administrativa derivada da view v_pendencias_administrativas.",
  });
}

/* ─────────────────────────────────────────────────────────────
 * Consultas
 * ───────────────────────────────────────────────────────────── */

async function listarPendencias(req, filtros = {}) {
  exigirAdministrador(req);

  const { limite, pagina, offset } = montarPaginacao(filtros);
  const { whereSql, values } = montarWhere(filtros);

  const paramsLista = [...values, limite, offset];
  const limiteParam = `$${values.length + 1}`;
  const offsetParam = `$${values.length + 2}`;

  const { rows } = await pool.query(
    `
      SELECT
        pendencia_id,
        modulo,
        tipo,
        titulo,
        descricao,
        severidade,
        prioridade,
        status,
        entidade,
        entidade_id,
        usuario_id,
        criado_em,
        atualizado_em,
        detalhes,
        origem
      FROM v_pendencias_administrativas
      ${whereSql}
      ${orderByPendencias()}
      LIMIT ${limiteParam}
      OFFSET ${offsetParam}
    `,
    paramsLista
  );

  const totalResult = await pool.query(
    `
      SELECT COUNT(*)::INTEGER AS total
      FROM v_pendencias_administrativas
      ${whereSql}
    `,
    values
  );

  const total = totalResult.rows[0]?.total || 0;

  await registrarConsultaAuditoria(req, {
    tipo_consulta: "listar",
    filtros: {
      modulo: filtros.modulo || null,
      tipo: filtros.tipo || null,
      severidade: filtros.severidade || null,
      prioridade: filtros.prioridade || null,
      status: filtros.status || null,
      usuario_id: filtros.usuario_id || null,
    },
    total,
    pagina,
    limite,
  });

  return {
    ok: true,
    data: rows,
    message: "Pendências administrativas carregadas com sucesso.",
    code: "PENDENCIAS_LISTADAS",
    meta: {
      total,
      pagina,
      limite,
      total_paginas: Math.ceil(total / limite),
    },
  };
}

async function obterPendencia(req, pendencia_id) {
  exigirAdministrador(req);

  const pendenciaId = textoOuNull(pendencia_id);

  if (!pendenciaId) {
    const error = new Error("Identificador da pendência inválido.");
    error.code = "PENDENCIA_ID_INVALIDO";
    error.status = 400;
    throw error;
  }

  const { rows } = await pool.query(
    `
      SELECT
        pendencia_id,
        modulo,
        tipo,
        titulo,
        descricao,
        severidade,
        prioridade,
        status,
        entidade,
        entidade_id,
        usuario_id,
        criado_em,
        atualizado_em,
        detalhes,
        origem
      FROM v_pendencias_administrativas
      WHERE pendencia_id = $1
      LIMIT 1
    `,
    [pendenciaId]
  );

  if (!rows[0]) {
    const error = new Error("Pendência administrativa não encontrada.");
    error.code = "PENDENCIA_NAO_ENCONTRADA";
    error.status = 404;
    throw error;
  }

  await registrarConsultaAuditoria(req, {
    tipo_consulta: "obter",
    pendencia_id: pendenciaId,
  });

  return {
    ok: true,
    data: rows[0],
    message: "Pendência administrativa carregada com sucesso.",
    code: "PENDENCIA_CARREGADA",
  };
}

async function resumoPendencias(req, filtros = {}) {
  exigirAdministrador(req);

  const { whereSql, values } = montarWhere(filtros);

  const geral = await pool.query(
    `
      SELECT
        COUNT(*)::INTEGER AS total_pendencias,
        COUNT(*) FILTER (WHERE severidade = 'info')::INTEGER AS info,
        COUNT(*) FILTER (WHERE severidade = 'aviso')::INTEGER AS aviso,
        COUNT(*) FILTER (WHERE severidade = 'erro')::INTEGER AS erro,
        COUNT(*) FILTER (WHERE severidade = 'critico')::INTEGER AS critico,
        COUNT(*) FILTER (WHERE prioridade = 'baixa')::INTEGER AS baixa,
        COUNT(*) FILTER (WHERE prioridade = 'normal')::INTEGER AS normal,
        COUNT(*) FILTER (WHERE prioridade = 'alta')::INTEGER AS alta,
        COUNT(*) FILTER (WHERE prioridade = 'urgente')::INTEGER AS urgente,
        MIN(criado_em) AS primeira_pendencia,
        MAX(atualizado_em) AS ultima_atualizacao
      FROM v_pendencias_administrativas
      ${whereSql}
    `,
    values
  );

  const porModulo = await pool.query(
    `
      SELECT
        modulo,
        COUNT(*)::INTEGER AS total,
        COUNT(*) FILTER (WHERE prioridade = 'urgente')::INTEGER AS urgentes,
        COUNT(*) FILTER (WHERE severidade = 'critico')::INTEGER AS criticas
      FROM v_pendencias_administrativas
      ${whereSql}
      GROUP BY modulo
      ORDER BY total DESC, modulo ASC
    `,
    values
  );

  const porTipo = await pool.query(
    `
      SELECT
        tipo,
        modulo,
        COUNT(*)::INTEGER AS total,
        COUNT(*) FILTER (WHERE prioridade = 'urgente')::INTEGER AS urgentes,
        COUNT(*) FILTER (WHERE severidade = 'critico')::INTEGER AS criticas
      FROM v_pendencias_administrativas
      ${whereSql}
      GROUP BY tipo, modulo
      ORDER BY total DESC, modulo ASC, tipo ASC
      LIMIT 30
    `,
    values
  );

  const porPrioridade = await pool.query(
    `
      SELECT
        prioridade,
        COUNT(*)::INTEGER AS total
      FROM v_pendencias_administrativas
      ${whereSql}
      GROUP BY prioridade
      ORDER BY
        CASE prioridade
          WHEN 'urgente' THEN 1
          WHEN 'alta' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'baixa' THEN 4
          ELSE 5
        END
    `,
    values
  );

  await registrarConsultaAuditoria(req, {
    tipo_consulta: "resumo",
    filtros,
  });

  return {
    ok: true,
    data: {
      geral: geral.rows[0],
      por_modulo: porModulo.rows,
      por_tipo: porTipo.rows,
      por_prioridade: porPrioridade.rows,
    },
    message: "Resumo de pendências carregado com sucesso.",
    code: "PENDENCIAS_RESUMO",
  };
}

module.exports = {
  listarPendencias,
  obterPendencia,
  resumoPendencias,
};