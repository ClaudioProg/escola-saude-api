/* eslint-disable no-console */
"use strict";

// ✅ src/services/avaliacaoService.js — PREMIUM/UNIFICADO
// - date-only safe
// - compat DB (query / db.query)
// - compat inscricoes / inscricao
// - compat avaliacoes / avaliacao
// - fim real da turma via datas_turma > turmas
// - frequência geral >= 75% sem inflar encontros por intervalo corrido
// - integração preparada com questionário obrigatório
// - logs estratégicos
// - retorno enriquecido para auditoria

const dbModule = require("../db");

const IS_DEV = process.env.NODE_ENV !== "production";
const TZ = "America/Sao_Paulo";

/* ───────────────── DB compat resiliente ───────────────── */
const db = dbModule?.db ?? dbModule;

const query =
  dbModule?.query ||
  db?.query?.bind?.(db) ||
  (typeof db?.query === "function" ? db.query.bind(db) : null);

if (typeof query !== "function") {
  console.error("[avaliacaoService] DB inválido:", Object.keys(dbModule || {}));
  throw new Error("DB inválido em avaliacaoService.js (query ausente)");
}

/* ───────────────── Cache leve de schema ───────────────── */
const SCHEMA_CACHE = {
  tables: new Map(),
};

async function tableExists(conn, tableName) {
  const key = String(tableName || "").trim().toLowerCase();
  if (!key) return false;

  if (SCHEMA_CACHE.tables.has(key)) {
    return SCHEMA_CACHE.tables.get(key);
  }

  try {
    const r = await conn.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS ok
      `,
      [key]
    );

    const ok = r?.rows?.[0]?.ok === true;
    SCHEMA_CACHE.tables.set(key, ok);
    return ok;
  } catch (err) {
    logWarn("Falha ao consultar information_schema; tentando fallback direto", {
      tableName: key,
      message: err?.message,
    });

    try {
      await conn.query(`SELECT 1 FROM ${key} LIMIT 1`);
      SCHEMA_CACHE.tables.set(key, true);
      return true;
    } catch {
      SCHEMA_CACHE.tables.set(key, false);
      return false;
    }
  }
}

/* ───────────────── Logs ───────────────── */
function logInfo(msg, extra) {
  if (IS_DEV) {
    console.log("[avaliacaoService]", msg, extra || "");
  }
}

function logWarn(msg, extra) {
  console.warn("[avaliacaoService][WARN]", msg, extra || "");
}

function logError(msg, err, extra) {
  console.error("[avaliacaoService][ERR]", msg, {
    message: err?.message || err,
    code: err?.code,
    stack: err?.stack,
    ...(extra || {}),
  });
}

/* ───────────────── Helpers ───────────────── */
function toIntId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function toNumOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function resolveInscricaoTable(conn) {
  if (await tableExists(conn, "inscricoes")) return "inscricoes";
  if (await tableExists(conn, "inscricao")) return "inscricao";
  return null;
}

async function resolveAvaliacoesTable(conn) {
  if (await tableExists(conn, "avaliacoes")) return "avaliacoes";
  if (await tableExists(conn, "avaliacao")) return "avaliacao";
  return null;
}

async function resolveQuestionarioTables(conn) {
  const hasQuestionariosEvento = await tableExists(conn, "questionarios_evento");
  const hasTentativasQuestionario = await tableExists(conn, "tentativas_questionario");

  return {
    hasQuestionariosEvento,
    hasTentativasQuestionario,
  };
}

async function nowSP(conn) {
  const result = await conn.query(
    `SELECT to_char((NOW() AT TIME ZONE '${TZ}'), 'YYYY-MM-DD HH24:MI:SS') AS agora_sp`
  );
  return result?.rows?.[0]?.agora_sp || null;
}

/* ───────────────── Questionário obrigatório por evento ───────────────── */
async function carregarMapaQuestionariosPorEvento(conn, eventoIds = []) {
  const ids = Array.isArray(eventoIds)
    ? [...new Set(eventoIds.map(Number).filter(Number.isFinite))]
    : [];

  if (!ids.length) return new Map();

  const qt = await resolveQuestionarioTables(conn);
  if (!qt.hasQuestionariosEvento) return new Map();

  try {
    const result = await conn.query(
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

    const rows = result?.rows || [];
    const mapa = new Map();

    for (const row of rows) {
      const eventoId = toIntId(row.evento_id);
      if (!eventoId) continue;

      const candidato = {
        id: toIntId(row.id),
        evento_id: eventoId,
        obrigatorio: row.obrigatorio === true,
        status: String(row.status || "").trim().toLowerCase(),
        min_nota: row.min_nota != null ? toNumOrNull(row.min_nota) : null,
        tentativas_max: row.tentativas_max != null ? toNumOrNull(row.tentativas_max) : null,
      };

      const atual = mapa.get(eventoId);

      if (!atual) {
        mapa.set(eventoId, candidato);
        continue;
      }

      const score = (q) => {
        let s = 0;
        if (q.obrigatorio === true) s += 100;
        if (q.status === "publicado") s += 10;
        return s;
      };

      if (score(candidato) > score(atual)) {
        mapa.set(eventoId, candidato);
      }
    }

    return mapa;
  } catch (err) {
    logWarn("Falha ao carregar mapa de questionários por evento", {
      message: err?.message,
      eventoIds: ids,
    });
    return new Map();
  }
}

async function carregarMapaTentativasAprovadas(conn, usuarioId, questionarioIds = [], turmaIds = []) {
  const uid = toIntId(usuarioId);

  const qIds = Array.isArray(questionarioIds)
    ? [...new Set(questionarioIds.map(Number).filter(Number.isFinite))]
    : [];

  const tIds = Array.isArray(turmaIds)
    ? [...new Set(turmaIds.map(Number).filter(Number.isFinite))]
    : [];

  if (!uid || !qIds.length || !tIds.length) return new Map();

  const qt = await resolveQuestionarioTables(conn);
  if (!qt.hasTentativasQuestionario) return new Map();

  try {
    const result = await conn.query(
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

    const rows = result?.rows || [];
    const mapa = new Map();

    for (const row of rows) {
      const qid = toIntId(row.questionario_id);
      const tid = toIntId(row.turma_id);
      if (!qid || !tid) continue;

      const key = `${qid}|${tid}`;

      if (!mapa.has(key)) {
        mapa.set(key, {
          id: toIntId(row.id),
          questionario_id: qid,
          turma_id: tid,
          status: String(row.status || "").trim().toLowerCase(),
          nota: row.nota != null ? toNumOrNull(row.nota) : null,
        });
      }
    }

    return mapa;
  } catch (err) {
    logWarn("Falha ao carregar tentativas de questionário", {
      message: err?.message,
      usuarioId: uid,
    });
    return new Map();
  }
}

/* ───────────────── Serviço principal ───────────────── */
/**
 * Lista turmas encerradas em que o usuário:
 * - está inscrito
 * - ainda não avaliou
 * - tem frequência geral >= 75%
 * - encerrou no horário real (datas_turma > turmas)
 * - se houver questionário obrigatório publicado, precisa estar aprovado
 *
 * IMPORTANTE:
 * - não infla total de encontros usando todos os dias do intervalo
 * - se a turma não tiver datas_turma, usa fallback conservador:
 *   1 encontro se data_inicio/data_fim existirem
 *
 * Retorna rows:
 * {
 *   evento_id,
 *   nome_evento,
 *   turma_id,
 *   data_inicio,
 *   data_fim,
 *   horario_fim,
 *   total_encontros,
 *   dias_presentes,
 *   percentual_frequencia,
 *   questionario_obrigatorio,
 *   questionario_id,
 *   tentativa_id,
 *   nota_questionario,
 *   min_nota_questionario,
 *   questionario_aprovado
 * }
 */
async function buscarAvaliacaoPendentes(usuario_id, opts = {}) {
  const conn =
    opts?.db?.query
      ? opts.db
      : { query };

  const uid = toIntId(usuario_id);
  if (!uid) return [];

  const inscrTable = await resolveInscricaoTable(conn);
  const avaliacoesTable = await resolveAvaliacoesTable(conn);

  if (!inscrTable) {
    logWarn("Tabela de inscrições não encontrada; retornando vazio.", {
      usuario_id: uid,
    });
    return [];
  }

  if (!avaliacoesTable) {
    logWarn("Tabela de avaliações não encontrada; retornando vazio.", {
      usuario_id: uid,
    });
    return [];
  }

  try {
    const sql = `
      WITH fim_real AS (
        SELECT
          t.id AS turma_id,
          COALESCE(
            (
              SELECT (
                dt.data::date +
                COALESCE(dt.horario_fim::time, t.horario_fim::time, '23:59'::time)
              )
              FROM datas_turma dt
              WHERE dt.turma_id = t.id
              ORDER BY dt.data DESC, COALESCE(dt.horario_fim, t.horario_fim) DESC
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
            WHEN t.data_inicio IS NOT NULL AND t.data_fim IS NOT NULL
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
        to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date, 'YYYY-MM-DD') AS data_fim,
        to_char(COALESCE(t.horario_fim::time, '23:59'::time), 'HH24:MI') AS horario_fim,
        te.total AS total_encontros,
        COALESCE(po.dias_presentes, 0) AS dias_presentes,
        CASE
          WHEN te.total > 0
            THEN ROUND((COALESCE(po.dias_presentes, 0)::numeric / te.total::numeric) * 100, 2)
          ELSE 0
        END AS percentual_frequencia
      FROM ${inscrTable} i
      INNER JOIN turmas t
        ON i.turma_id = t.id
      INNER JOIN eventos e
        ON t.evento_id = e.id
      LEFT JOIN ${avaliacoesTable} a
        ON a.usuario_id = i.usuario_id
       AND a.turma_id = t.id
      INNER JOIN fim_real fr
        ON fr.turma_id = t.id
      INNER JOIN total_encontros te
        ON te.turma_id = t.id
      LEFT JOIN presencas_ok po
        ON po.turma_id = t.id
       AND po.usuario_id = i.usuario_id
      WHERE i.usuario_id = $1
        AND a.id IS NULL
        AND te.total > 0
        AND (NOW() AT TIME ZONE '${TZ}') >= fr.fim_local
        AND COALESCE(po.dias_presentes, 0) >= CEIL(0.75 * te.total)
      ORDER BY t.data_fim DESC, t.id DESC
    `;

    const result = await conn.query(sql, [uid]);
    const rows = result?.rows || [];

    if (!rows.length) {
      logInfo("buscarAvaliacaoPendentes OK (sem pendências)", {
        usuario_id: uid,
        inscrTable,
        avaliacoesTable,
      });
      return [];
    }

    const eventoIds = rows.map((r) => toIntId(r.evento_id)).filter(Boolean);
    const turmaIds = rows.map((r) => toIntId(r.turma_id)).filter(Boolean);

    const mapaQuestionarios = await carregarMapaQuestionariosPorEvento(conn, eventoIds);

    const questionarioIds = Array.from(
      new Set(
        Array.from(mapaQuestionarios.values())
          .map((q) => toIntId(q.id))
          .filter(Boolean)
      )
    );

    const mapaTentativas = await carregarMapaTentativasAprovadas(
      conn,
      uid,
      questionarioIds,
      turmaIds
    );

    const filtradas = rows
      .map((row) => {
        const eventoId = toIntId(row.evento_id);
        const turmaId = toIntId(row.turma_id);
        const qInfo = mapaQuestionarios.get(eventoId) || null;

        // sem questionário obrigatório publicado => avaliação liberada
        if (!qInfo || qInfo.status !== "publicado" || qInfo.obrigatorio !== true) {
          return {
            ...row,
            total_encontros: Number(row.total_encontros || 0),
            dias_presentes: Number(row.dias_presentes || 0),
            percentual_frequencia: Number(row.percentual_frequencia || 0),
            questionario_obrigatorio: false,
            questionario_id: qInfo?.id ?? null,
            tentativa_id: null,
            nota_questionario: null,
            min_nota_questionario: qInfo?.min_nota ?? null,
            questionario_aprovado: null,
          };
        }

        const tentKey = `${Number(qInfo.id)}|${Number(turmaId)}`;
        const tentativa = mapaTentativas.get(tentKey) || null;

        const minNota = qInfo.min_nota != null ? Number(qInfo.min_nota) : null;
        const nota = tentativa?.nota != null ? Number(tentativa.nota) : null;
        const enviada = tentativa?.status === "enviada";
        const aprovado =
          enviada &&
          minNota != null &&
          nota != null
            ? nota >= minNota
            : false;

        return {
          ...row,
          total_encontros: Number(row.total_encontros || 0),
          dias_presentes: Number(row.dias_presentes || 0),
          percentual_frequencia: Number(row.percentual_frequencia || 0),
          questionario_obrigatorio: true,
          questionario_id: qInfo.id,
          tentativa_id: tentativa?.id ?? null,
          nota_questionario: nota,
          min_nota_questionario: minNota,
          questionario_aprovado: aprovado,
        };
      })
      .filter((row) => {
        if (row.questionario_obrigatorio !== true) return true;
        return row.questionario_aprovado === true;
      });

    logInfo("buscarAvaliacaoPendentes OK", {
      usuario_id: uid,
      inscrTable,
      avaliacoesTable,
      agora_sp: await nowSP(conn),
      total_base: rows.length,
      total_filtradas: filtradas.length,
      turmas: filtradas.map((r) => ({
        turma_id: Number(r.turma_id),
        evento_id: Number(r.evento_id),
        total_encontros: Number(r.total_encontros || 0),
        dias_presentes: Number(r.dias_presentes || 0),
        percentual_frequencia: Number(r.percentual_frequencia || 0),
        questionario_obrigatorio: r.questionario_obrigatorio === true,
        questionario_id: r.questionario_id ?? null,
        tentativa_id: r.tentativa_id ?? null,
        nota_questionario: r.nota_questionario ?? null,
        min_nota_questionario: r.min_nota_questionario ?? null,
        questionario_aprovado: r.questionario_aprovado ?? null,
      })),
    });

    return filtradas;
  } catch (err) {
    logError("buscarAvaliacaoPendentes", err, {
      usuario_id: uid,
      inscrTable,
      avaliacoesTable,
    });
    return [];
  }
}

module.exports = {
  buscarAvaliacaoPendentes,
  resolveInscricaoTable,
  resolveAvaliacoesTable,
};