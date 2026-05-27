"use strict";

/**
 * ✅ backend/src/services/saudePlataformaService.js — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Service oficial da Saúde da Plataforma.
 *
 * Responsabilidades:
 * - Ler indicadores consolidados da view v_saude_plataforma.
 * - Listar indicadores com filtros administrativos.
 * - Obter indicador específico por indicador_id.
 * - Gerar resumo executivo da saúde operacional.
 * - Separar saúde operacional, alertas, críticos e passivo histórico.
 * - Registrar consulta administrativa na auditoria centralizada.
 *
 * Contratos aplicados:
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
 * - Sem aliases
 * - Sem legado
 */

const pool = require("../db");
const auditoriaService = require("./auditoriaService");

/* ─────────────────────────────────────────────────────────────
 * Contratos oficiais
 * ───────────────────────────────────────────────────────────── */

const STATUS_SAUDE_OFICIAIS = new Set(["saudavel", "alerta", "critico"]);

const SEVERIDADES_OFICIAIS = new Set(["info", "aviso", "erro", "critico"]);

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
    const error = new Error(
      "Você não tem permissão para acessar a Saúde da Plataforma."
    );
    error.code = "SEM_PERMISSAO_SAUDE_PLATAFORMA";
    error.status = 403;
    throw error;
  }
}

function normalizarStatus(status) {
  const texto = textoOuNull(status);

  if (!texto) return null;

  if (!STATUS_SAUDE_OFICIAIS.has(texto)) {
    const error = new Error("Status de saúde inválido.");
    error.code = "SAUDE_PLATAFORMA_STATUS_INVALIDO";
    error.status = 400;
    throw error;
  }

  return texto;
}

function normalizarSeveridade(severidade) {
  const texto = textoOuNull(severidade);

  if (!texto) return null;

  if (!SEVERIDADES_OFICIAIS.has(texto)) {
    const error = new Error("Severidade inválida.");
    error.code = "SAUDE_PLATAFORMA_SEVERIDADE_INVALIDA";
    error.status = 400;
    throw error;
  }

  return texto;
}

function montarPaginacao(filtros = {}) {
  const limite = numeroPositivo(filtros.limite, 100, 1, 500);
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

  const indicadorId = textoOuNull(filtros.indicador_id);
  const modulo = textoOuNull(filtros.modulo);
  const janela = textoOuNull(filtros.janela);
  const busca = textoOuNull(filtros.busca);

  const status = normalizarStatus(filtros.status);
  const severidade = normalizarSeveridade(filtros.severidade);

  if (indicadorId) add("indicador_id = ?", indicadorId);
  if (modulo) add("modulo = ?", modulo);
  if (janela) add("janela = ?", janela);
  if (status) add("status = ?", status);
  if (severidade) add("severidade = ?", severidade);

  if (busca) {
    values.push(`%${busca}%`);
    const param = `$${values.length}`;

    where.push(`
      (
        indicador_id ILIKE ${param}
        OR modulo ILIKE ${param}
        OR titulo ILIKE ${param}
        OR descricao ILIKE ${param}
        OR janela ILIKE ${param}
      )
    `);
  }

  return {
    whereSql: where.length > 0 ? `WHERE ${where.join(" AND ")}` : "",
    values,
  };
}

function orderByIndicadores() {
  return `
    ORDER BY
      CASE status
        WHEN 'critico' THEN 1
        WHEN 'alerta' THEN 2
        WHEN 'saudavel' THEN 3
        ELSE 4
      END,
      CASE severidade
        WHEN 'critico' THEN 1
        WHEN 'erro' THEN 2
        WHEN 'aviso' THEN 3
        WHEN 'info' THEN 4
        ELSE 5
      END,
      modulo ASC,
      indicador_id ASC
  `;
}

function calcularClassificacaoGeral(geral = {}) {
  const criticos = Number(geral.criticos || 0);
  const alertas = Number(geral.alertas || 0);
  const severidadeCritica = Number(geral.severidade_critica || 0);
  const erros = Number(geral.erro || 0);

  if (criticos > 0 || severidadeCritica > 0) {
    return {
      status_geral: "critico",
      titulo: "A plataforma exige atenção imediata",
      descricao:
        "Existem indicadores críticos ou severidade crítica que precisam de ação administrativa.",
    };
  }

  if (alertas > 0 || erros > 0) {
    return {
      status_geral: "alerta",
      titulo: "A plataforma possui alertas operacionais",
      descricao:
        "Existem indicadores em alerta ou erros que devem ser acompanhados pela administração.",
    };
  }

  return {
    status_geral: "saudavel",
    titulo: "A plataforma está saudável",
    descricao:
      "Não há indicadores críticos ou alertas relevantes neste momento.",
  };
}

async function registrarConsultaAuditoria(req, detalhes = {}) {
  await auditoriaService.registrarAuditoria({
    req,
    acao: "consultar",
    modulo: "saude_plataforma",
    entidade: "v_saude_plataforma",
    entidade_id: null,
    sucesso: true,
    severidade: "info",
    detalhes,
    mensagem: "Consulta à Saúde da Plataforma.",
    admin_hint:
      "Consulta administrativa derivada da view v_saude_plataforma.",
  });
}

/* ─────────────────────────────────────────────────────────────
 * Consultas
 * ───────────────────────────────────────────────────────────── */

async function listarIndicadores(req, filtros = {}) {
  exigirAdministrador(req);

  const { limite, pagina, offset } = montarPaginacao(filtros);
  const { whereSql, values } = montarWhere(filtros);

  const paramsLista = [...values, limite, offset];
  const limiteParam = `$${values.length + 1}`;
  const offsetParam = `$${values.length + 2}`;

  const { rows } = await pool.query(
    `
      SELECT
        indicador_id,
        modulo,
        titulo,
        descricao,
        valor,
        severidade,
        status,
        janela,
        detalhes,
        atualizado_em
      FROM v_saude_plataforma
      ${whereSql}
      ${orderByIndicadores()}
      LIMIT ${limiteParam}
      OFFSET ${offsetParam}
    `,
    paramsLista
  );

  const totalResult = await pool.query(
    `
      SELECT COUNT(*)::INTEGER AS total
      FROM v_saude_plataforma
      ${whereSql}
    `,
    values
  );

  const total = totalResult.rows[0]?.total || 0;

  await registrarConsultaAuditoria(req, {
    tipo_consulta: "listar",
    filtros: {
      indicador_id: filtros.indicador_id || null,
      modulo: filtros.modulo || null,
      status: filtros.status || null,
      severidade: filtros.severidade || null,
      janela: filtros.janela || null,
      busca: filtros.busca || null,
    },
    total,
    pagina,
    limite,
  });

  return {
    ok: true,
    data: rows,
    message: "Indicadores da Saúde da Plataforma carregados com sucesso.",
    code: "SAUDE_PLATAFORMA_INDICADORES_LISTADOS",
    meta: {
      total,
      pagina,
      limite,
      total_paginas: Math.ceil(total / limite),
    },
  };
}

async function obterIndicador(req, indicador_id) {
  exigirAdministrador(req);

  const indicadorId = textoOuNull(indicador_id);

  if (!indicadorId) {
    const error = new Error("Identificador do indicador inválido.");
    error.code = "SAUDE_PLATAFORMA_INDICADOR_ID_INVALIDO";
    error.status = 400;
    throw error;
  }

  const { rows } = await pool.query(
    `
      SELECT
        indicador_id,
        modulo,
        titulo,
        descricao,
        valor,
        severidade,
        status,
        janela,
        detalhes,
        atualizado_em
      FROM v_saude_plataforma
      WHERE indicador_id = $1
      LIMIT 1
    `,
    [indicadorId]
  );

  if (!rows[0]) {
    const error = new Error("Indicador da Saúde da Plataforma não encontrado.");
    error.code = "SAUDE_PLATAFORMA_INDICADOR_NAO_ENCONTRADO";
    error.status = 404;
    throw error;
  }

  await registrarConsultaAuditoria(req, {
    tipo_consulta: "obter",
    indicador_id: indicadorId,
  });

  return {
    ok: true,
    data: rows[0],
    message: "Indicador da Saúde da Plataforma carregado com sucesso.",
    code: "SAUDE_PLATAFORMA_INDICADOR_CARREGADO",
  };
}

async function resumoSaude(req, filtros = {}) {
  exigirAdministrador(req);

  const { whereSql, values } = montarWhere(filtros);

  const geralResult = await pool.query(
    `
      SELECT
        COUNT(*)::INTEGER AS total_indicadores,
        COUNT(*) FILTER (WHERE status = 'saudavel')::INTEGER AS saudaveis,
        COUNT(*) FILTER (WHERE status = 'alerta')::INTEGER AS alertas,
        COUNT(*) FILTER (WHERE status = 'critico')::INTEGER AS criticos,
        COUNT(*) FILTER (WHERE severidade = 'info')::INTEGER AS info,
        COUNT(*) FILTER (WHERE severidade = 'aviso')::INTEGER AS aviso,
        COUNT(*) FILTER (WHERE severidade = 'erro')::INTEGER AS erro,
        COUNT(*) FILTER (WHERE severidade = 'critico')::INTEGER AS severidade_critica,
        MAX(atualizado_em) AS atualizado_em
      FROM v_saude_plataforma
      ${whereSql}
    `,
    values
  );

  const porModulo = await pool.query(
    `
      SELECT
        modulo,
        COUNT(*)::INTEGER AS total,
        COUNT(*) FILTER (WHERE status = 'saudavel')::INTEGER AS saudaveis,
        COUNT(*) FILTER (WHERE status = 'alerta')::INTEGER AS alertas,
        COUNT(*) FILTER (WHERE status = 'critico')::INTEGER AS criticos,
        COUNT(*) FILTER (WHERE severidade = 'erro')::INTEGER AS erros,
        COUNT(*) FILTER (WHERE severidade = 'critico')::INTEGER AS severidade_critica,
        SUM(valor)::INTEGER AS soma_valores
      FROM v_saude_plataforma
      ${whereSql}
      GROUP BY modulo
      ORDER BY
        COUNT(*) FILTER (WHERE status = 'critico') DESC,
        COUNT(*) FILTER (WHERE status = 'alerta') DESC,
        total DESC,
        modulo ASC
    `,
    values
  );

  const porStatus = await pool.query(
    `
      SELECT
        status,
        COUNT(*)::INTEGER AS total,
        SUM(valor)::INTEGER AS soma_valores
      FROM v_saude_plataforma
      ${whereSql}
      GROUP BY status
      ORDER BY
        CASE status
          WHEN 'critico' THEN 1
          WHEN 'alerta' THEN 2
          WHEN 'saudavel' THEN 3
          ELSE 4
        END
    `,
    values
  );

  const porSeveridade = await pool.query(
    `
      SELECT
        severidade,
        COUNT(*)::INTEGER AS total,
        SUM(valor)::INTEGER AS soma_valores
      FROM v_saude_plataforma
      ${whereSql}
      GROUP BY severidade
      ORDER BY
        CASE severidade
          WHEN 'critico' THEN 1
          WHEN 'erro' THEN 2
          WHEN 'aviso' THEN 3
          WHEN 'info' THEN 4
          ELSE 5
        END
    `,
    values
  );

  const destaques = await pool.query(
    `
      SELECT
        indicador_id,
        modulo,
        titulo,
        descricao,
        valor,
        severidade,
        status,
        janela,
        detalhes,
        atualizado_em
      FROM v_saude_plataforma
      ${whereSql}
      ${orderByIndicadores()}
      LIMIT 8
    `,
    values
  );

  const geral = geralResult.rows[0] || {};
  const classificacao = calcularClassificacaoGeral(geral);

  await registrarConsultaAuditoria(req, {
    tipo_consulta: "resumo",
    filtros: {
      modulo: filtros.modulo || null,
      status: filtros.status || null,
      severidade: filtros.severidade || null,
      janela: filtros.janela || null,
      busca: filtros.busca || null,
    },
    total_indicadores: geral.total_indicadores || 0,
    status_geral: classificacao.status_geral,
  });

  return {
    ok: true,
    data: {
      geral: {
        ...geral,
        ...classificacao,
      },
      por_modulo: porModulo.rows,
      por_status: porStatus.rows,
      por_severidade: porSeveridade.rows,
      destaques: destaques.rows,
    },
    message: "Resumo da Saúde da Plataforma carregado com sucesso.",
    code: "SAUDE_PLATAFORMA_RESUMO",
  };
}

async function diagnosticoExecutivo(req) {
  exigirAdministrador(req);

  const resumo = await resumoSaude(req);

  const indicadoresCriticos = await pool.query(
    `
      SELECT
        indicador_id,
        modulo,
        titulo,
        valor,
        severidade,
        status,
        janela,
        detalhes
      FROM v_saude_plataforma
      WHERE status = 'critico'
      ${orderByIndicadores()}
    `
  );

  const indicadoresAlerta = await pool.query(
    `
      SELECT
        indicador_id,
        modulo,
        titulo,
        valor,
        severidade,
        status,
        janela,
        detalhes
      FROM v_saude_plataforma
      WHERE status = 'alerta'
      ${orderByIndicadores()}
    `
  );

  await registrarConsultaAuditoria(req, {
    tipo_consulta: "diagnostico_executivo",
    criticos: indicadoresCriticos.rows.length,
    alertas: indicadoresAlerta.rows.length,
  });

  return {
    ok: true,
    data: {
      resumo: resumo.data,
      criticos: indicadoresCriticos.rows,
      alertas: indicadoresAlerta.rows,
    },
    message: "Diagnóstico executivo da Saúde da Plataforma carregado com sucesso.",
    code: "SAUDE_PLATAFORMA_DIAGNOSTICO_EXECUTIVO",
  };
}

module.exports = {
  listarIndicadores,
  obterIndicador,
  resumoSaude,
  diagnosticoExecutivo,
};