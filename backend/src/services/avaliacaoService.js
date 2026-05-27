/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/services/avaliacaoService.js — v2.0
 * Atualizado em: 14/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Listar turmas encerradas em que o usuário pode preencher avaliação final.
 * - Aplicar regra de liberação pós-curso.
 * - Considerar questionário obrigatório publicado quando existir.
 *
 * Regras de liberação:
 * - usuário inscrito;
 * - turma encerrada pelo fim real;
 * - avaliação ainda não respondida;
 * - frequência geral >= 75%;
 * - se houver questionário obrigatório publicado, usuário precisa estar aprovado.
 *
 * Contratos oficiais:
 * - Tabela de inscrição: inscricoes
 * - Tabela de avaliação: avaliacoes
 * - Tabela de questionário: questionarios_evento
 * - Tabela de tentativa: tentativas_questionario
 *
 * Diretrizes v2.0:
 * - Sem fallback de tabela.
 * - Sem compat inscricoes/inscricao.
 * - Sem compat avaliacoes/avaliacao.
 * - Sem aliases.
 * - Sem ocultar erro estrutural em silêncio.
 * - Date-only seguro.
 */

const db = require("../db");

const IS_DEV = process.env.NODE_ENV !== "production";
const TZ = "America/Sao_Paulo";

const TABELA_INSCRICAO = "inscricoes";
const TABELA_AVALIACAO = "avaliacoes";

/* ─────────────────────────────────────────────
 * Logs
 * ───────────────────────────────────────────── */

function logInfo(message, extra) {
  if (IS_DEV) {
    console.log("[avaliacaoService]", message, extra || "");
  }
}

function logWarn(message, extra) {
  console.warn("[avaliacaoService][WARN]", message, extra || "");
}

function logError(message, error, extra) {
  console.error("[avaliacaoService][ERR]", message, {
    message: error?.message || error,
    code: error?.code,
    detail: error?.detail,
    constraint: error?.constraint,
    table: error?.table,
    column: error?.column,
    ...(extra || {}),
  });
}

/* ─────────────────────────────────────────────
 * Adaptadores seguros de consulta
 * ───────────────────────────────────────────── */

function getConn(opts = {}) {
  if (opts?.db && typeof opts.db.query === "function") {
    return opts.db;
  }

  if (db && typeof db.query === "function") {
    return db;
  }

  throw new Error("Contrato inválido: backend/src/db deve exportar query.");
}

async function queryRows(conn, sql, params = []) {
  if (typeof conn.many === "function") {
    return conn.many(sql, params);
  }

  const result = await conn.query(sql, params);
  return result.rows || [];
}

async function queryOneOrNone(conn, sql, params = []) {
  if (typeof conn.oneOrNone === "function") {
    return conn.oneOrNone(sql, params);
  }

  const result = await conn.query(sql, params);
  return result.rows?.[0] || null;
}

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

function toIntId(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function toNumOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function uniqueIntIds(values) {
  if (!Array.isArray(values)) return [];

  return [
    ...new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    ),
  ];
}

async function nowSP(conn = db) {
  const result = await queryOneOrNone(
    conn,
    `
    SELECT to_char(
      (NOW() AT TIME ZONE $1),
      'YYYY-MM-DD HH24:MI:SS'
    ) AS agora_sp
    `,
    [TZ]
  );

  return result?.agora_sp || null;
}

function normalizarLinhaAvaliacao(row) {
  return {
    ...row,
    evento_id: toIntId(row.evento_id),
    turma_id: toIntId(row.turma_id),
    total_encontros: Number(row.total_encontros || 0),
    dias_presentes: Number(row.dias_presentes || 0),
    percentual_frequencia: Number(row.percentual_frequencia || 0),
  };
}

/* ─────────────────────────────────────────────
 * Questionário obrigatório por evento
 * ───────────────────────────────────────────── */

async function carregarMapaQuestionariosPorEvento(conn = db, eventoIds = []) {
  const ids = uniqueIntIds(eventoIds);

  if (!ids.length) {
    return new Map();
  }

  const rows = await queryRows(
    conn,
    `
    SELECT
      q.id,
      q.evento_id,
      q.obrigatorio,
      q.status,
      q.min_nota,
      q.tentativas_max
    FROM questionarios_evento q
    WHERE q.evento_id = ANY($1::int[])
    `,
    [ids]
  );

  const mapa = new Map();

  for (const row of rows) {
    const eventoId = toIntId(row.evento_id);

    if (!eventoId) {
      continue;
    }

    const candidato = {
      id: toIntId(row.id),
      evento_id: eventoId,
      obrigatorio: row.obrigatorio === true,
      status: String(row.status || "").trim().toLowerCase(),
      min_nota: row.min_nota != null ? toNumOrNull(row.min_nota) : null,
      tentativas_max:
        row.tentativas_max != null ? toNumOrNull(row.tentativas_max) : null,
    };

    const atual = mapa.get(eventoId);

    if (!atual) {
      mapa.set(eventoId, candidato);
      continue;
    }

    const score = (questionario) => {
      let total = 0;

      if (questionario.obrigatorio === true) total += 100;
      if (questionario.status === "publicado") total += 10;

      return total;
    };

    if (score(candidato) > score(atual)) {
      mapa.set(eventoId, candidato);
    }
  }

  return mapa;
}

async function carregarMapaTentativasAprovadas(
  conn = db,
  usuarioId,
  questionarioIds = [],
  turmaIds = []
) {
  const uid = toIntId(usuarioId);
  const qIds = uniqueIntIds(questionarioIds);
  const tIds = uniqueIntIds(turmaIds);

  if (!uid || !qIds.length || !tIds.length) {
    return new Map();
  }

  const rows = await queryRows(
    conn,
    `
    SELECT
      tq.id,
      tq.questionario_id,
      tq.usuario_id,
      tq.turma_id,
      tq.status,
      tq.nota
    FROM tentativas_questionario tq
    WHERE tq.usuario_id = $1
      AND tq.questionario_id = ANY($2::int[])
      AND tq.turma_id = ANY($3::int[])
    ORDER BY tq.id DESC
    `,
    [uid, qIds, tIds]
  );

  const mapa = new Map();

  for (const row of rows) {
    const questionarioId = toIntId(row.questionario_id);
    const turmaId = toIntId(row.turma_id);

    if (!questionarioId || !turmaId) {
      continue;
    }

    const key = `${questionarioId}|${turmaId}`;

    if (!mapa.has(key)) {
      mapa.set(key, {
        id: toIntId(row.id),
        questionario_id: questionarioId,
        turma_id: turmaId,
        status: String(row.status || "").trim().toLowerCase(),
        nota: row.nota != null ? toNumOrNull(row.nota) : null,
      });
    }
  }

  return mapa;
}

/* ─────────────────────────────────────────────
 * Serviço principal
 * ───────────────────────────────────────────── */

/**
 * Lista avaliações pendentes do usuário.
 *
 * @param {number|string} usuarioId
 * @param {object} [opts]
 * @param {object} [opts.db] conexão opcional, útil em testes/transações
 * @returns {Promise<Array>}
 */
async function buscarAvaliacaoPendentes(usuarioId, opts = {}) {
  const conn = getConn(opts);
  const uid = toIntId(usuarioId);

  if (!uid) {
    return [];
  }

  try {
    const rows = await queryRows(
      conn,
      `
      WITH fim_real AS (
        SELECT
          t.id AS turma_id,
          COALESCE(
            (
              SELECT (
                dt.data::date +
                COALESCE(
                  dt.horario_fim::time,
                  t.horario_fim::time,
                  '23:59'::time
                )
              )
              FROM datas_turma dt
              WHERE dt.turma_id = t.id
              ORDER BY
                dt.data DESC,
                COALESCE(dt.horario_fim, t.horario_fim) DESC
              LIMIT 1
            ),
            (
              t.data_fim::date +
              COALESCE(t.horario_fim::time, '23:59'::time)
            )
          ) AS fim_local
        FROM turmas t
      ),
      total_encontros AS (
        SELECT
          t.id AS turma_id,
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM datas_turma dt
              WHERE dt.turma_id = t.id
            )
              THEN (
                SELECT COUNT(*)::int
                FROM datas_turma dt
                WHERE dt.turma_id = t.id
              )
            WHEN t.data_inicio IS NOT NULL
             AND t.data_fim IS NOT NULL
              THEN 1
            ELSE 0
          END AS total
        FROM turmas t
      ),
      presencas_ok AS (
        SELECT
          p.turma_id,
          p.usuario_id,
          COUNT(DISTINCT p.data_presenca::date)::int AS dias_presentes
        FROM presencas p
        WHERE p.usuario_id = $1
          AND p.presente = TRUE
        GROUP BY p.turma_id, p.usuario_id
      )
      SELECT
        e.id AS evento_id,
        e.titulo AS nome_evento,
        t.id AS turma_id,
        t.nome AS turma_nome,
        to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date, 'YYYY-MM-DD') AS data_fim,
        to_char(
          COALESCE(t.horario_fim::time, '23:59'::time),
          'HH24:MI'
        ) AS horario_fim,
        te.total AS total_encontros,
        COALESCE(po.dias_presentes, 0) AS dias_presentes,
        CASE
          WHEN te.total > 0
            THEN ROUND(
              (
                COALESCE(po.dias_presentes, 0)::numeric /
                te.total::numeric
              ) * 100,
              2
            )
          ELSE 0
        END AS percentual_frequencia
      FROM ${TABELA_INSCRICAO} i
      JOIN turmas t
        ON i.turma_id = t.id
      JOIN eventos e
        ON t.evento_id = e.id
      LEFT JOIN ${TABELA_AVALIACAO} a
        ON a.usuario_id = i.usuario_id
       AND a.turma_id = t.id
      JOIN fim_real fr
        ON fr.turma_id = t.id
      JOIN total_encontros te
        ON te.turma_id = t.id
      LEFT JOIN presencas_ok po
        ON po.turma_id = t.id
       AND po.usuario_id = i.usuario_id
      WHERE i.usuario_id = $1
        AND a.id IS NULL
        AND te.total > 0
        AND (NOW() AT TIME ZONE $2) >= fr.fim_local
        AND COALESCE(po.dias_presentes, 0) >= CEIL(0.75 * te.total)
      ORDER BY t.data_fim DESC, t.id DESC
      `,
      [uid, TZ]
    );

    if (!rows.length) {
      logInfo("buscarAvaliacaoPendentes OK sem pendências.", {
        usuarioId: uid,
      });

      return [];
    }

    const linhasBase = rows.map(normalizarLinhaAvaliacao);

    const eventoIds = uniqueIntIds(linhasBase.map((row) => row.evento_id));
    const turmaIds = uniqueIntIds(linhasBase.map((row) => row.turma_id));

    const mapaQuestionarios = await carregarMapaQuestionariosPorEvento(
      conn,
      eventoIds
    );

    const questionarioIds = uniqueIntIds(
      Array.from(mapaQuestionarios.values()).map(
        (questionario) => questionario.id
      )
    );

    const mapaTentativas = await carregarMapaTentativasAprovadas(
      conn,
      uid,
      questionarioIds,
      turmaIds
    );

    const filtradas = linhasBase
      .map((row) => {
        const questionario = mapaQuestionarios.get(row.evento_id) || null;

        if (
          !questionario ||
          questionario.status !== "publicado" ||
          questionario.obrigatorio !== true
        ) {
          return {
            ...row,
            questionario_obrigatorio: false,
            questionario_id: questionario?.id ?? null,
            tentativa_id: null,
            nota_questionario: null,
            min_nota_questionario: questionario?.min_nota ?? null,
            questionario_aprovado: null,
          };
        }

        const tentativaKey = `${Number(questionario.id)}|${Number(
          row.turma_id
        )}`;

        const tentativa = mapaTentativas.get(tentativaKey) || null;

        const minNota =
          questionario.min_nota != null ? Number(questionario.min_nota) : null;

        const nota = tentativa?.nota != null ? Number(tentativa.nota) : null;
        const enviada = tentativa?.status === "enviada";

        const aprovado =
          enviada && minNota != null && nota != null ? nota >= minNota : false;

        return {
          ...row,
          questionario_obrigatorio: true,
          questionario_id: questionario.id,
          tentativa_id: tentativa?.id ?? null,
          nota_questionario: nota,
          min_nota_questionario: minNota,
          questionario_aprovado: aprovado,
        };
      })
      .filter((row) => {
        if (row.questionario_obrigatorio !== true) {
          return true;
        }

        return row.questionario_aprovado === true;
      });

    logInfo("buscarAvaliacaoPendentes OK.", {
      usuarioId: uid,
      agora_sp: await nowSP(conn),
      total_base: linhasBase.length,
      total_filtradas: filtradas.length,
      turmas: filtradas.map((row) => ({
        turma_id: row.turma_id,
        evento_id: row.evento_id,
        total_encontros: row.total_encontros,
        dias_presentes: row.dias_presentes,
        percentual_frequencia: row.percentual_frequencia,
        questionario_obrigatorio: row.questionario_obrigatorio === true,
        questionario_id: row.questionario_id ?? null,
        tentativa_id: row.tentativa_id ?? null,
        nota_questionario: row.nota_questionario ?? null,
        min_nota_questionario: row.min_nota_questionario ?? null,
        questionario_aprovado: row.questionario_aprovado ?? null,
      })),
    });

    return filtradas;
  } catch (error) {
    logError("buscarAvaliacaoPendentes", error, {
      usuarioId: uid,
    });

    throw error;
  }
}

module.exports = {
  buscarAvaliacaoPendentes,
  carregarMapaQuestionariosPorEvento,
  carregarMapaTentativasAprovadas,
};