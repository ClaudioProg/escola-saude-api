// 📁 src/services/avaliacaoService.js — PREMIUM+++
// - Date-only safe
// - Compat com inscricoes/inscricao
// - Compat com avaliacoes
// - Fim real da turma via datas_turma > turmas
// - Frequência geral >= 75% sem inflar encontros por intervalo corrido
// - Integração preparada com questionário obrigatório
// - Logs estratégicos
// - Retorno enriquecido para auditoria

/* eslint-disable no-console */

const dbFallback = require("../db");

const IS_DEV = process.env.NODE_ENV !== "production";
const TZ = "America/Sao_Paulo";

/* ------------------------------------------------------------------ */
/* Compat DB                                                          */
/* ------------------------------------------------------------------ */
const pool = dbFallback.pool || dbFallback.Pool || dbFallback.pool?.pool || dbFallback;
const query =
  dbFallback.query ||
  (typeof dbFallback === "function" ? dbFallback : null) ||
  (pool?.query ? pool.query.bind(pool) : null) ||
  (dbFallback?.db?.query ? dbFallback.db.query.bind(dbFallback.db) : null);

if (typeof query !== "function") {
  console.error("[avaliacaoService] DB inválido:", Object.keys(dbFallback || {}));
  throw new Error("DB inválido em avaliacaoService.js (query ausente)");
}

/* ------------------------------------------------------------------ */
/* Logs                                                               */
/* ------------------------------------------------------------------ */
function logInfo(msg, extra) {
  if (IS_DEV) console.log("[avaliacaoService]", msg, extra || "");
}
function logWarn(msg, extra) {
  console.warn("[avaliacaoService][WARN]", msg, extra || "");
}
function logError(msg, err) {
  console.error("[avaliacaoService][ERR]", msg, err?.stack || err?.message || err);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
function toIntId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

async function resolveInscricaoTable(db) {
  try {
    await db.query(`SELECT 1 FROM inscricoes LIMIT 1`);
    return "inscricoes";
  } catch {
    return "inscricao";
  }
}

async function resolveAvaliacoesTable(db) {
  try {
    await db.query(`SELECT 1 FROM avaliacoes LIMIT 1`);
    return "avaliacoes";
  } catch {
    return null;
  }
}

async function resolveQuestionarioTables(db) {
  try {
    await db.query(`SELECT 1 FROM questionarios_evento LIMIT 1`);
    await db.query(`SELECT 1 FROM tentativas_questionario LIMIT 1`);
    return {
      hasQuestionariosEvento: true,
      hasTentativasQuestionario: true,
    };
  } catch {
    return {
      hasQuestionariosEvento: false,
      hasTentativasQuestionario: false,
    };
  }
}

async function nowSP(db) {
  const result = await db.query(
    `SELECT to_char((NOW() AT TIME ZONE '${TZ}'), 'YYYY-MM-DD HH24:MI:SS') AS agora_sp`
  );
  return result?.rows?.[0]?.agora_sp || null;
}

/* ------------------------------------------------------------------ */
/* Questionário obrigatório por evento                                */
/* ------------------------------------------------------------------ */
async function carregarMapaQuestionariosPorEvento(db, eventoIds = []) {
  const ids = Array.isArray(eventoIds)
    ? eventoIds.map(Number).filter(Number.isFinite)
    : [];

  if (!ids.length) return new Map();

  const qt = await resolveQuestionarioTables(db);
  if (!qt.hasQuestionariosEvento) return new Map();

  try {
    const result = await db.query(
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
      const eventoId = Number(row.evento_id);
      if (!Number.isFinite(eventoId)) continue;

      // prioriza questionário publicado obrigatório
      const atual = mapa.get(eventoId);

      const candidato = {
        id: Number(row.id),
        evento_id: eventoId,
        obrigatorio: row.obrigatorio === true,
        status: String(row.status || ""),
        min_nota: row.min_nota != null ? Number(row.min_nota) : null,
        tentativas_max: row.tentativas_max != null ? Number(row.tentativas_max) : null,
      };

      if (!atual) {
        mapa.set(eventoId, candidato);
        continue;
      }

      const score = (q) => {
        let s = 0;
        if (q.status === "publicado") s += 10;
        if (q.obrigatorio === true) s += 100;
        return s;
      };

      if (score(candidato) > score(atual)) {
        mapa.set(eventoId, candidato);
      }
    }

    return mapa;
  } catch (err) {
    logWarn("Falha ao carregar mapa de questionários por evento", err?.message || err);
    return new Map();
  }
}

async function carregarMapaTentativasAprovadas(db, usuarioId, questionarioIds = [], turmaIds = []) {
  const qIds = Array.isArray(questionarioIds)
    ? questionarioIds.map(Number).filter(Number.isFinite)
    : [];
  const tIds = Array.isArray(turmaIds)
    ? turmaIds.map(Number).filter(Number.isFinite)
    : [];

  if (!usuarioId || !qIds.length || !tIds.length) return new Map();

  const qt = await resolveQuestionarioTables(db);
  if (!qt.hasTentativasQuestionario) return new Map();

  try {
    const result = await db.query(
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
      [Number(usuarioId), qIds, tIds]
    );

    const rows = result?.rows || [];
    const mapa = new Map();

    for (const row of rows) {
      const key = `${Number(row.questionario_id)}|${Number(row.turma_id)}`;
      if (!mapa.has(key)) {
        mapa.set(key, {
          id: Number(row.id),
          questionario_id: Number(row.questionario_id),
          turma_id: Number(row.turma_id),
          status: String(row.status || ""),
          nota: row.nota != null ? Number(row.nota) : null,
        });
      }
    }

    return mapa;
  } catch (err) {
    logWarn("Falha ao carregar tentativas de questionário", err?.message || err);
    return new Map();
  }
}

/* ------------------------------------------------------------------ */
/* Serviço principal                                                  */
/* ------------------------------------------------------------------ */
/**
 * Lista turmas encerradas em que o usuário:
 * - está inscrito
 * - ainda não avaliou
 * - tem frequência geral >= 75%
 * - encerrou no horário real (datas_turma > turmas)
 * - se houver questionário obrigatório publicado, precisa estar aprovado
 *
 * IMPORTANTE:
 * - Não infla total de encontros usando todos os dias do intervalo
 * - Se a turma não tiver datas_turma, usa fallback conservador:
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
  const db = opts.db ?? { query };
  const uid = toIntId(usuario_id);

  if (!uid) return [];

  const inscrTable = await resolveInscricaoTable(db);
  const avaliacoesTable = await resolveAvaliacoesTable(db);

  if (!avaliacoesTable) {
    logWarn("Tabela de avaliações não encontrada; retornando vazio.", { usuario_id: uid });
    return [];
  }

  try {
    const sql = `
      WITH fim_real AS (
        SELECT
          t.id AS turma_id,
          COALESCE(
            (
              SELECT (dt.data::date + COALESCE(dt.horario_fim::time, t.horario_fim::time, '23:59'::time))
              FROM datas_turma dt
              WHERE dt.turma_id = t.id
              ORDER BY dt.data DESC, COALESCE(dt.horario_fim, t.horario_fim) DESC
              LIMIT 1
            ),
            (t.data_fim::date + COALESCE(t.horario_fim::time, '23:59'::time))
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
            ) THEN (
              SELECT COUNT(*)::int
              FROM datas_turma dt
              WHERE dt.turma_id = t.id
            )
            WHEN t.data_inicio IS NOT NULL AND t.data_fim IS NOT NULL THEN 1
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
       AND a.turma_id   = t.id
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

    const result = await db.query(sql, [uid]);
    const rows = result?.rows || [];

    if (!rows.length) {
      logInfo("buscarAvaliacaoPendentes OK (sem pendências)", {
        usuario_id: uid,
        inscrTable,
        avaliacoesTable,
      });
      return [];
    }

    const eventoIds = rows.map((r) => Number(r.evento_id)).filter(Number.isFinite);
    const turmaIds = rows.map((r) => Number(r.turma_id)).filter(Number.isFinite);

    const mapaQuestionarios = await carregarMapaQuestionariosPorEvento(db, eventoIds);

    const questionarioIds = Array.from(
      new Set(
        Array.from(mapaQuestionarios.values())
          .map((q) => Number(q.id))
          .filter(Number.isFinite)
      )
    );

    const mapaTentativas = await carregarMapaTentativasAprovadas(db, uid, questionarioIds, turmaIds);

    const filtradas = rows
      .map((row) => {
        const eventoId = Number(row.evento_id);
        const turmaId = Number(row.turma_id);
        const qInfo = mapaQuestionarios.get(eventoId) || null;

        // sem questionário obrigatório publicado => avaliação liberada
        if (!qInfo || qInfo.status !== "publicado" || qInfo.obrigatorio !== true) {
          return {
            ...row,
            questionario_obrigatorio: false,
            questionario_id: qInfo?.id ?? null,
            tentativa_id: null,
            nota_questionario: null,
            min_nota_questionario: qInfo?.min_nota ?? null,
            questionario_aprovado: null,
          };
        }

        const tentKey = `${Number(qInfo.id)}|${turmaId}`;
        const tentativa = mapaTentativas.get(tentKey) || null;

        const minNota = qInfo.min_nota != null ? Number(qInfo.min_nota) : null;
        const nota = tentativa?.nota != null ? Number(tentativa.nota) : null;
        const enviada = tentativa?.status === "enviada";
        const aprovado = enviada && minNota != null && nota != null ? nota >= minNota : false;

        return {
          ...row,
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
      agora_sp: await nowSP(db),
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
    logError("buscarAvaliacaoPendentes", err);
    return [];
  }
}

module.exports = { buscarAvaliacaoPendentes };