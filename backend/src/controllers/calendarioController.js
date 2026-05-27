"use strict";

/**
 * 📁 backend/src/controllers/calendarioController.js
 * Atualizado em: 15/05/2026
 *
 * Plataforma Escola da Saúde — v2.0
 *
 * Módulo:
 * - Calendário institucional de bloqueios.
 *
 * Uso principal:
 * - feriados;
 * - pontos facultativos;
 * - bloqueios internos;
 * - integração com agendamento/reserva de salas.
 *
 * Contrato oficial de banco:
 * - calendario_bloqueios
 *
 * Campos:
 * - id
 * - data
 * - tipo
 * - descricao
 * - criado_em
 * - atualizado_em
 *
 * Tipos oficiais:
 * - feriado_nacional
 * - feriado_municipal
 * - ponto_facultativo
 * - bloqueio_interno
 *
 * Diretrizes v2.0:
 * - sem compatibilidade dinâmica de DB;
 * - sem resposta { erro };
 * - sem retorno cru fora do padrão;
 * - sem aliases de tipo;
 * - date-only em YYYY-MM-DD;
 * - resposta padrão ok/data/message/code/meta;
 * - erro padrão ok:false/data:null/message/code/adminHint/details/requestId.
 */

const db = require("../db");

/* =========================================================================
   DB oficial
=========================================================================== */

const query =
  typeof db?.query === "function"
    ? db.query.bind(db)
    : typeof db?.pool?.query === "function"
      ? db.pool.query.bind(db.pool)
      : null;

if (typeof query !== "function") {
  throw new Error(
    "[calendarioController] DB inválido. O export oficial de ../db deve expor query."
  );
}

/* =========================================================================
   Contrato oficial
=========================================================================== */

const TIPOS_OFICIAIS = Object.freeze({
  FERIADO_NACIONAL: "feriado_nacional",
  FERIADO_MUNICIPAL: "feriado_municipal",
  PONTO_FACULTATIVO: "ponto_facultativo",
  BLOQUEIO_INTERNO: "bloqueio_interno",
});

const TIPOS_PERMITIDOS = new Set(Object.values(TIPOS_OFICIAIS));

/* =========================================================================
   Respostas / logs
=========================================================================== */

function gerarRequestId(prefix = "calendario") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function sucesso(
  res,
  {
    status = 200,
    data = null,
    message = "OK",
    code = "OK",
    meta = null,
  } = {}
) {
  return res.status(status).json({
    ok: true,
    data,
    message,
    code,
    ...(meta ? { meta } : {}),
  });
}

function falha(
  res,
  {
    status = 500,
    message = "Erro interno.",
    code = "ERRO_INTERNO",
    adminHint = null,
    details = null,
    requestId,
  }
) {
  return res.status(status).json({
    ok: false,
    data: null,
    message,
    code,
    adminHint,
    details,
    requestId,
  });
}

function logErro(requestId, contexto, err) {
  console.error(`[calendarioController][${requestId}] ${contexto}`, {
    message: err?.message,
    code: err?.code,
    detail: err?.detail,
    constraint: err?.constraint,
    table: err?.table,
    column: err?.column,
  });
}

/* =========================================================================
   Helpers
=========================================================================== */

function toIntId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function isYMD(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function cleanStr(value, { max = 2000 } = {}) {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();

  if (!text) return null;

  return text.length > max ? text.slice(0, max) : text;
}

function normalizarTipo(value) {
  const tipo = cleanStr(value, { max: 80 });

  if (!tipo) return null;

  const normalized = tipo.toLowerCase();

  return TIPOS_PERMITIDOS.has(normalized) ? normalized : null;
}

function normalizarData(value) {
  const data = cleanStr(value, { max: 10 });

  if (!data || !isYMD(data)) return null;

  return data;
}

function tratarErroPg(res, requestId, err, contexto) {
  logErro(requestId, contexto, err);

  if (err?.code === "23505") {
    return falha(res, {
      status: 409,
      message: "Já existe um bloqueio cadastrado para esta data.",
      code: "CALENDARIO_DATA_DUPLICADA",
      adminHint:
        "Verifique constraint única em calendario_bloqueios para a coluna data.",
      details: {
        dbCode: err.code,
        constraint: err.constraint,
      },
      requestId,
    });
  }

  if (err?.code === "23514") {
    return falha(res, {
      status: 400,
      message: "Tipo inválido para bloqueio de calendário.",
      code: "CALENDARIO_TIPO_INVALIDO_CHECK",
      adminHint:
        "O banco rejeitou o valor pela constraint CHECK. Use apenas os tipos oficiais.",
      details: {
        tipos_permitidos: Array.from(TIPOS_PERMITIDOS),
        dbCode: err.code,
        constraint: err.constraint,
      },
      requestId,
    });
  }

  if (err?.code === "22007") {
    return falha(res, {
      status: 400,
      message: "Data inválida. Use o formato YYYY-MM-DD.",
      code: "CALENDARIO_DATA_INVALIDA_DB",
      details: {
        dbCode: err.code,
      },
      requestId,
    });
  }

  return falha(res, {
    status: 500,
    message: "Erro interno ao processar calendário.",
    code: "CALENDARIO_ERRO_INTERNO",
    adminHint:
      "Verifique tabela calendario_bloqueios, constraints, conexão com banco e payload recebido.",
    details: {
      dbCode: err?.code,
      constraint: err?.constraint,
    },
    requestId,
  });
}

/* =========================================================================
   SQL
=========================================================================== */

const SELECT_BASE = `
  SELECT
    id,
    to_char(data::date, 'YYYY-MM-DD') AS data,
    tipo,
    descricao,
    criado_em,
    atualizado_em
  FROM calendario_bloqueios
`;

/* =========================================================================
   Controller
=========================================================================== */

async function listar(req, res) {
  const requestId = gerarRequestId("calendario-listar");

  try {
    const tipo = req.query?.tipo ? normalizarTipo(req.query.tipo) : null;
    const dataInicio = req.query?.data_inicio
      ? normalizarData(req.query.data_inicio)
      : null;
    const dataFim = req.query?.data_fim
      ? normalizarData(req.query.data_fim)
      : null;

    if (req.query?.tipo && !tipo) {
      return falha(res, {
        status: 400,
        message: "Tipo inválido para filtro de calendário.",
        code: "CALENDARIO_TIPO_INVALIDO",
        details: {
          tipos_permitidos: Array.from(TIPOS_PERMITIDOS),
        },
        requestId,
      });
    }

    if (req.query?.data_inicio && !dataInicio) {
      return falha(res, {
        status: 400,
        message: "Data inicial inválida. Use o formato YYYY-MM-DD.",
        code: "CALENDARIO_DATA_INICIO_INVALIDA",
        requestId,
      });
    }

    if (req.query?.data_fim && !dataFim) {
      return falha(res, {
        status: 400,
        message: "Data final inválida. Use o formato YYYY-MM-DD.",
        code: "CALENDARIO_DATA_FIM_INVALIDA",
        requestId,
      });
    }

    const params = [];
    const where = [];

    if (tipo) {
      params.push(tipo);
      where.push(`tipo = $${params.length}`);
    }

    if (dataInicio) {
      params.push(dataInicio);
      where.push(`data >= $${params.length}::date`);
    }

    if (dataFim) {
      params.push(dataFim);
      where.push(`data <= $${params.length}::date`);
    }

    const sql = `
      ${SELECT_BASE}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY data ASC, id ASC
    `;

    const result = await query(sql, params);
    const rows = result.rows || [];

    return sucesso(res, {
      data: rows,
      message: "Bloqueios de calendário listados com sucesso.",
      code: "CALENDARIO_LISTADO",
      meta: {
        total: rows.length,
        filtros: {
          tipo,
          data_inicio: dataInicio,
          data_fim: dataFim,
        },
      },
    });
  } catch (err) {
    return tratarErroPg(res, requestId, err, "Erro ao listar calendário");
  }
}

async function criar(req, res) {
  const requestId = gerarRequestId("calendario-criar");

  try {
    const data = normalizarData(req.body?.data);
    const tipo = normalizarTipo(req.body?.tipo);
    const descricao = cleanStr(req.body?.descricao, { max: 2000 });

    if (!data) {
      return falha(res, {
        status: 400,
        message: "Data obrigatória ou inválida. Use o formato YYYY-MM-DD.",
        code: "CALENDARIO_DATA_OBRIGATORIA",
        requestId,
      });
    }

    if (!tipo) {
      return falha(res, {
        status: 400,
        message: "Tipo obrigatório ou inválido para bloqueio de calendário.",
        code: "CALENDARIO_TIPO_OBRIGATORIO",
        details: {
          tipos_permitidos: Array.from(TIPOS_PERMITIDOS),
        },
        requestId,
      });
    }

    const result = await query(
      `
        INSERT INTO calendario_bloqueios
          (data, tipo, descricao)
        VALUES
          ($1::date, $2, $3)
        RETURNING
          id,
          to_char(data::date, 'YYYY-MM-DD') AS data,
          tipo,
          descricao,
          criado_em,
          atualizado_em
      `,
      [data, tipo, descricao]
    );

    return sucesso(res, {
      status: 201,
      data: result.rows?.[0] || null,
      message: "Bloqueio de calendário criado com sucesso.",
      code: "CALENDARIO_CRIADO",
    });
  } catch (err) {
    return tratarErroPg(res, requestId, err, "Erro ao criar calendário");
  }
}

async function atualizar(req, res) {
  const requestId = gerarRequestId("calendario-atualizar");

  try {
    const id = toIntId(req.params?.id);

    if (!id) {
      return falha(res, {
        status: 400,
        message: "ID inválido.",
        code: "ID_INVALIDO",
        adminHint: "O parâmetro :id deve ser um número inteiro positivo.",
        details: {
          value: req.params?.id,
        },
        requestId,
      });
    }

    const body = req.body || {};
    const campos = [];
    const params = [];

    if (Object.prototype.hasOwnProperty.call(body, "data")) {
      const data = normalizarData(body.data);

      if (!data) {
        return falha(res, {
          status: 400,
          message: "Data inválida. Use o formato YYYY-MM-DD.",
          code: "CALENDARIO_DATA_INVALIDA",
          requestId,
        });
      }

      params.push(data);
      campos.push(`data = $${params.length}::date`);
    }

    if (Object.prototype.hasOwnProperty.call(body, "tipo")) {
      const tipo = normalizarTipo(body.tipo);

      if (!tipo) {
        return falha(res, {
          status: 400,
          message: "Tipo inválido para bloqueio de calendário.",
          code: "CALENDARIO_TIPO_INVALIDO",
          details: {
            tipos_permitidos: Array.from(TIPOS_PERMITIDOS),
          },
          requestId,
        });
      }

      params.push(tipo);
      campos.push(`tipo = $${params.length}`);
    }

    if (Object.prototype.hasOwnProperty.call(body, "descricao")) {
      const descricao = cleanStr(body.descricao, { max: 2000 });

      params.push(descricao);
      campos.push(`descricao = $${params.length}`);
    }

    if (campos.length === 0) {
      return falha(res, {
        status: 400,
        message:
          "Nenhum campo enviado para atualização. Envie data, tipo e/ou descricao.",
        code: "CALENDARIO_NADA_PARA_ATUALIZAR",
        requestId,
      });
    }

    campos.push("atualizado_em = NOW()");
    params.push(id);

    const result = await query(
      `
        UPDATE calendario_bloqueios
           SET ${campos.join(", ")}
         WHERE id = $${params.length}
        RETURNING
          id,
          to_char(data::date, 'YYYY-MM-DD') AS data,
          tipo,
          descricao,
          criado_em,
          atualizado_em
      `,
      params
    );

    const row = result.rows?.[0] || null;

    if (!row) {
      return falha(res, {
        status: 404,
        message: "Bloqueio de calendário não encontrado.",
        code: "CALENDARIO_NAO_ENCONTRADO",
        requestId,
      });
    }

    return sucesso(res, {
      data: row,
      message: "Bloqueio de calendário atualizado com sucesso.",
      code: "CALENDARIO_ATUALIZADO",
    });
  } catch (err) {
    return tratarErroPg(res, requestId, err, "Erro ao atualizar calendário");
  }
}

async function excluir(req, res) {
  const requestId = gerarRequestId("calendario-excluir");

  try {
    const id = toIntId(req.params?.id);

    if (!id) {
      return falha(res, {
        status: 400,
        message: "ID inválido.",
        code: "ID_INVALIDO",
        adminHint: "O parâmetro :id deve ser um número inteiro positivo.",
        details: {
          value: req.params?.id,
        },
        requestId,
      });
    }

    const result = await query(
      `
        DELETE FROM calendario_bloqueios
         WHERE id = $1
        RETURNING
          id,
          to_char(data::date, 'YYYY-MM-DD') AS data,
          tipo,
          descricao,
          criado_em,
          atualizado_em
      `,
      [id]
    );

    const row = result.rows?.[0] || null;

    if (!row) {
      return falha(res, {
        status: 404,
        message: "Bloqueio de calendário não encontrado.",
        code: "CALENDARIO_NAO_ENCONTRADO",
        requestId,
      });
    }

    return sucesso(res, {
      data: row,
      message: "Bloqueio de calendário excluído com sucesso.",
      code: "CALENDARIO_EXCLUIDO",
    });
  } catch (err) {
    return tratarErroPg(res, requestId, err, "Erro ao excluir calendário");
  }
}

module.exports = {
  listar,
  criar,
  atualizar,
  excluir,
};