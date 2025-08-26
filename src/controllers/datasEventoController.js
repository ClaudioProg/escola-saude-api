// 📁 src/controllers/datasEventoController.js
const db = require("../db");

/**
 * Lista as datas de uma turma com diferentes fontes (em ordem de prioridade):
 * - via=datas | via=especificas : usa a tabela datas_turma (datas reais do curso)
 * - via=presencas               : usa DISTINCT de presencas.data_presenca
 * - via=intervalo               : gera 1 linha por dia entre data_inicio e data_fim (default)
 *
 * Resposta (listarDatasDaTurma):
 *   [{ data: 'YYYY-MM-DD', horario_inicio: 'HH:MM', horario_fim: 'HH:MM' }, ...]
 *
 * Resposta (listarOcorrenciasTurma):
 *   ["YYYY-MM-DD", "YYYY-MM-DD", ...]
 */

// Util interno: valida "YYYY-MM-DD"
function isIsoDateOnly(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** ✅ Datas reais (datas_turma), preferindo horário do encontro; fallback para horário da turma */
async function _datasReais(turmaId) {
  // Checa existência da tabela (defensivo)
  const existsSql = `SELECT to_regclass('public.datas_turma') IS NOT NULL AS has_table;`;
  const exists = await db.query(existsSql);
  const has = exists?.rows?.[0]?.has_table === true;
  if (!has) return { rows: [] };

  const sql = `
    SELECT
      to_char(dt.data, 'YYYY-MM-DD') AS data,
      to_char(COALESCE(dt.horario_inicio, t.horario_inicio, '00:00'::time), 'HH24:MI') AS horario_inicio,
      to_char(COALESCE(dt.horario_fim,   t.horario_fim,   '23:59'::time), 'HH24:MI') AS horario_fim
    FROM datas_turma dt
    JOIN turmas t ON t.id = dt.turma_id
    WHERE dt.turma_id = $1
    ORDER BY dt.data ASC;
  `;
  return db.query(sql, [turmaId]);
}

/** Datas a partir de presenças (DISTINCT) com horários herdados da turma */
async function _datasPresencas(turmaId) {
  const sql = `
    SELECT DISTINCT
      to_char(p.data_presenca::date, 'YYYY-MM-DD') AS data,
      to_char(COALESCE(t.horario_inicio, '00:00'::time), 'HH24:MI') AS horario_inicio,
      to_char(COALESCE(t.horario_fim,   '23:59'::time), 'HH24:MI') AS horario_fim
    FROM presencas p
    JOIN turmas t ON t.id = p.turma_id
    WHERE p.turma_id = $1
    ORDER BY 1 ASC;
  `;
  return db.query(sql, [turmaId]);
}

/** Intervalo simples [data_inicio..data_fim] da turma */
async function _datasIntervalo(turmaId) {
  const sql = `
    WITH t AS (
      SELECT
        data_inicio::date AS di,
        data_fim::date    AS df,
        to_char(COALESCE(horario_inicio, '00:00'::time), 'HH24:MI') AS hi,
        to_char(COALESCE(horario_fim,   '23:59'::time), 'HH24:MI')  AS hf
      FROM turmas
      WHERE id = $1
    )
    SELECT
      to_char(gs::date, 'YYYY-MM-DD') AS data,
      t.hi AS horario_inicio,
      t.hf AS horario_fim
    FROM t, generate_series(t.di, t.df, interval '1 day') AS gs
    ORDER BY 1 ASC;
  `;
  return db.query(sql, [turmaId]);
}

/**
 * GET /api/datas/turma/:id?via=(datas|especificas|presencas|intervalo)
 * Fallback em cascata quando a fonte solicitada não retornar linhas:
 *   datas/especificas → presencas → intervalo
 */
async function listarDatasDaTurma(req, res) {
  const turmaId = Number(req.params.id);
  let via = String(req.query.via || "intervalo").toLowerCase();

  if (!Number.isFinite(turmaId)) {
    return res.status(400).json({ erro: "turma_id inválido" });
  }

  // Normaliza alias
  if (via === "especificas") via = "datas";

  try {
    let rows = [];

    if (via === "datas") {
      const r = await _datasReais(turmaId);
      rows = r.rows;
      if (!rows.length) {
        const rp = await _datasPresencas(turmaId);
        rows = rp.rows.length ? rp.rows : (await _datasIntervalo(turmaId)).rows;
      }
    } else if (via === "presencas") {
      const rp = await _datasPresencas(turmaId);
      rows = rp.rows.length ? rp.rows : (await _datasIntervalo(turmaId)).rows;
    } else {
      // intervalo (default) — mas dá prioridade a datas reais se existirem
      const rr = await _datasReais(turmaId);
      rows = rr.rows.length ? rr.rows : (await _datasIntervalo(turmaId)).rows;
    }

    return res.json(rows);
  } catch (erro) {
    console.error("❌ [datasEvento] erro:", erro);
    return res
      .status(500)
      .json({ erro: "Erro ao buscar datas da turma.", detalhe: erro.message });
  }
}

/**
 * GET /api/datas/turma/:id/ocorrencias
 * Retorna apenas array de strings "YYYY-MM-DD", com a mesma prioridade:
 *   datas reais → presenças → intervalo
 */
async function listarOcorrenciasTurma(req, res) {
  const turmaId = Number(req.params.id);
  if (!Number.isFinite(turmaId)) {
    return res.status(400).json({ erro: "turma_id inválido" });
  }

  try {
    const rr = await _datasReais(turmaId);
    let datas = rr.rows.map((r) => String(r.data).slice(0, 10)).filter(isIsoDateOnly);

    if (!datas.length) {
      const rp = await _datasPresencas(turmaId);
      datas = rp.rows.map((r) => String(r.data).slice(0, 10)).filter(isIsoDateOnly);
    }
    if (!datas.length) {
      const ri = await _datasIntervalo(turmaId);
      datas = ri.rows.map((r) => String(r.data).slice(0, 10)).filter(isIsoDateOnly);
    }

    // remove duplicadas e ordena
    const uniq = Array.from(new Set(datas)).sort();
    return res.json(uniq);
  } catch (erro) {
    console.error("❌ [datasEvento/ocorrencias] erro:", erro);
    return res
      .status(500)
      .json({ erro: "Erro ao buscar ocorrências.", detalhe: erro.message });
  }
}

module.exports = {
  listarDatasDaTurma,
  listarOcorrenciasTurma,
};
