/* eslint-disable no-console */
// 📁 src/controllers/instrutorController.js — PREMIUM (robusto, date-only safe, SQL defensivo)
const dbMod = require("../db");

// Compat: alguns lugares exportam { pool, query }, outros exportam direto.
const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;
const query =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null);

if (typeof query !== "function") {
  console.error("[instrutorController] DB inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em instrutorController.js (query ausente)");
}

const IS_DEV = process.env.NODE_ENV !== "production";

/* ────────────────────────────────────────────────────────────────
   Logger util (RID) — reduz ruído em produção
   ──────────────────────────────────────────────────────────────── */
function mkRid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function log(rid, level, msg, extra) {
  const prefix = `[INS-CTRL][RID=${rid}]`;
  if (level === "error") return console.error(`${prefix} ✖ ${msg}`, extra?.stack || extra?.message || extra);
  if (!IS_DEV) return;
  if (level === "warn") return console.warn(`${prefix} ⚠ ${msg}`, extra || "");
  return console.log(`${prefix} • ${msg}`, extra || "");
}

/* ────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────── */
const asPositiveInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
};

function getUsuarioId(req) {
  return req.user?.id ?? null;
}

/**
 * 🔢 Helper SQL seguro p/ enum/text -> nota 1..5 (numeric)
 * - SEMPRE castea para text antes de comparar/converter
 * - Aceita "1..5" (com vírgula/ponto), e textos comuns (ótimo, bom, etc.)
 *
 * Observação: usa alias "a" (avaliacao) — mantenha o alias como "a" nas CTEs/joins.
 */
const SQL_MAP_NOTA = `
  CASE
    WHEN a.desempenho_instrutor IS NULL THEN NULL
    WHEN trim(a.desempenho_instrutor::text) ~ '^[1-5](?:[\\.,]0+)?$'
      THEN REPLACE(trim(a.desempenho_instrutor::text), ',', '.')::numeric
    WHEN lower(a.desempenho_instrutor::text) IN ('ótimo','otimo','excelente','muito bom') THEN 5
    WHEN lower(a.desempenho_instrutor::text) = 'bom' THEN 4
    WHEN lower(a.desempenho_instrutor::text) IN ('regular','médio','medio') THEN 3
    WHEN lower(a.desempenho_instrutor::text) = 'ruim' THEN 2
    WHEN lower(a.desempenho_instrutor::text) IN ('péssimo','pessimo','muito ruim') THEN 1
    ELSE NULL
  END
`;

/* ────────────────────────────────────────────────────────────────
   📋 Lista instrutores com médias/contadores
   - Liga por evento_instrutor → turmas → avaliacao (a.turma_id).
   - Evita multiplicação indevida com LEFT JOIN (CTEs agregadas).
   ──────────────────────────────────────────────────────────────── */
async function listarInstrutor(req, res) {
  const rid = mkRid();
  try {
    const sql = `
      WITH instrutores AS (
        SELECT u.id, u.nome, u.email
        FROM usuarios u
        WHERE string_to_array(COALESCE(u.perfil,''), ',') && ARRAY['instrutor','administrador']
      ),
      eventos_por_instrutor AS (
        SELECT ei.instrutor_id, COUNT(DISTINCT ei.evento_id)::int AS eventos_ministrados
        FROM evento_instrutor ei
        GROUP BY ei.instrutor_id
      ),
      turmas_por_instrutor AS (
        SELECT ei.instrutor_id, COUNT(*)::int AS turmas_vinculadas
        FROM evento_instrutor ei
        JOIN turmas t ON t.evento_id = ei.evento_id
        GROUP BY ei.instrutor_id
      ),
      notas_por_instrutor AS (
        SELECT
          ei.instrutor_id,
          ${SQL_MAP_NOTA} AS nota
        FROM evento_instrutor ei
        JOIN turmas t          ON t.evento_id = ei.evento_id
        LEFT JOIN avaliacoes a ON a.turma_id = t.id
      ),
      agg_notas AS (
        SELECT
          instrutor_id,
          COUNT(nota)::int AS total_respostas,
          ROUND(AVG(nota)::numeric, 2) AS media_avaliacao
        FROM notas_por_instrutor
        GROUP BY instrutor_id
      )
      SELECT
        i.id,
        i.nome,
        i.email,
        COALESCE(ei.eventos_ministrados, 0) AS "eventosMinistrados",
        COALESCE(tp.turmas_vinculadas, 0)   AS "turmasVinculadas",
        COALESCE(an.total_respostas, 0)     AS "totalRespostas",
        an.media_avaliacao,
        CASE WHEN s.imagem_base64 IS NOT NULL THEN TRUE ELSE FALSE END AS "possuiAssinatura"
      FROM instrutores i
      LEFT JOIN eventos_por_instrutor ei ON ei.instrutor_id = i.id
      LEFT JOIN turmas_por_instrutor  tp ON tp.instrutor_id = i.id
      LEFT JOIN agg_notas             an ON an.instrutor_id = i.id
      LEFT JOIN assinaturas            s ON s.usuario_id = i.id
      ORDER BY i.nome;
    `;

    const { rows } = await query(sql, []);
    log(rid, "info", "listarInstrutor OK", { count: rows.length });
    return res.status(200).json(rows);
  } catch (error) {
    log(rid, "error", "Erro ao buscar instrutores", error);
    return res.status(500).json({ erro: "Erro ao buscar instrutor." });
  }
}

/* ────────────────────────────────────────────────────────────────
   📊 Eventos ministrados por instrutor (período, média e total)
   @route GET /api/instrutor/:id/eventos-avaliacao
   - Período calculado em DATE (sem Date JS)
   - Média/contagem calculadas sem multiplicar linhas
   ──────────────────────────────────────────────────────────────── */
async function getEventosAvaliacaoPorInstrutor(req, res) {
  const rid = mkRid();
  const instrutorId = asPositiveInt(req.params?.id);

  if (!instrutorId) return res.status(400).json({ erro: "ID inválido." });

  try {
    const sql = `
      WITH turmas_evento AS (
        SELECT
          e.id AS evento_id,
          e.titulo AS evento,
          MIN(t.data_inicio)::date AS data_inicio,
          MAX(t.data_fim)::date    AS data_fim
        FROM evento_instrutor ei
        JOIN eventos e ON e.id = ei.evento_id
        JOIN turmas  t ON t.evento_id = e.id
        WHERE ei.instrutor_id = $1
        GROUP BY e.id, e.titulo
      ),
      notas_evento AS (
        SELECT
          e.id AS evento_id,
          ${SQL_MAP_NOTA} AS nota
        FROM evento_instrutor ei
        JOIN eventos e         ON e.id = ei.evento_id
        JOIN turmas  t         ON t.evento_id = e.id
        LEFT JOIN avaliacoes a ON a.turma_id = t.id
        WHERE ei.instrutor_id = $1
      ),
      agg AS (
        SELECT
          evento_id,
          ROUND(AVG(nota)::numeric, 1) AS nota_media,
          COUNT(nota)::int AS total_respostas
        FROM notas_evento
        GROUP BY evento_id
      )
      SELECT
        te.evento_id,
        te.evento,
        to_char(te.data_inicio, 'YYYY-MM-DD') AS data_inicio,
        to_char(te.data_fim,    'YYYY-MM-DD') AS data_fim,
        a.nota_media,
        COALESCE(a.total_respostas, 0) AS total_respostas
      FROM turmas_evento te
      LEFT JOIN agg a ON a.evento_id = te.evento_id
      ORDER BY te.data_inicio DESC NULLS LAST;
    `;

    const { rows } = await query(sql, [instrutorId]);
    log(rid, "info", "getEventosAvaliacaoPorInstrutor OK", { instrutorId, count: rows.length });
    return res.json(rows);
  } catch (error) {
    log(rid, "error", "Erro ao buscar eventos do instrutor", error);
    return res.status(500).json({ erro: "Erro ao buscar eventos ministrados." });
  }
}

/* ────────────────────────────────────────────────────────────────
   📚 Turmas vinculadas ao instrutor (com dados do evento)
   @route GET /api/instrutor/:id/turmas
   - Mantém date-only (YYYY-MM-DD) na saída
   ──────────────────────────────────────────────────────────────── */
async function getTurmasComEventoPorInstrutor(req, res) {
  const rid = mkRid();
  const instrutorId = asPositiveInt(req.params?.id);

  if (!instrutorId) return res.status(400).json({ erro: "ID inválido." });

  try {
    const sql = `
      SELECT 
        t.id AS id,
        t.nome AS nome,
        to_char(t.data_inicio::date,'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date,'YYYY-MM-DD')    AS data_fim,
        to_char(t.horario_inicio,'HH24:MI')       AS horario_inicio,
        to_char(t.horario_fim,'HH24:MI')          AS horario_fim,
        e.id     AS evento_id,
        e.titulo AS evento_nome,
        e.local  AS evento_local
      FROM evento_instrutor ei
      JOIN eventos e ON ei.evento_id = e.id
      JOIN turmas  t ON t.evento_id = e.id
      WHERE ei.instrutor_id = $1
      ORDER BY t.data_inicio ASC NULLS LAST, t.id ASC
    `;

    const { rows } = await query(sql, [instrutorId]);

    const turmasFormatadas = (rows || []).map((t) => ({
      id: t.id,
      nome: t.nome,
      data_inicio: t.data_inicio,
      data_fim: t.data_fim,
      horario_inicio: t.horario_inicio,
      horario_fim: t.horario_fim,
      evento: {
        id: t.evento_id,
        nome: t.evento_nome,
        local: t.evento_local,
      },
    }));

    log(rid, "info", "getTurmasComEventoPorInstrutor OK", { instrutorId, count: turmasFormatadas.length });
    return res.json(turmasFormatadas);
  } catch (error) {
    log(rid, "error", "Erro ao buscar turmas do instrutor", error);
    return res.status(500).json({ erro: "Erro ao buscar turmas do instrutor." });
  }
}

/* ────────────────────────────────────────────────────────────────
   👤 “Minhas turmas” (instrutor autenticado)
   @route GET /api/instrutor/minhas/turmas
   - Mantém date-only (YYYY-MM-DD) na saída
   ──────────────────────────────────────────────────────────────── */
async function getMinhasTurmasInstrutor(req, res) {
  const rid = mkRid();
  const usuarioId = asPositiveInt(getUsuarioId(req));

  if (!usuarioId) {
    return res.status(401).json({ erro: "Usuário não autenticado." });
  }

  try {
    const sql = `
      SELECT 
        t.id,
        t.nome,
        to_char(t.data_inicio::date,'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date,'YYYY-MM-DD')    AS data_fim,
        to_char(t.horario_inicio,'HH24:MI')       AS horario_inicio,
        to_char(t.horario_fim,'HH24:MI')          AS horario_fim,
        e.id AS evento_id,
        e.titulo AS evento_nome,
        e.local  AS evento_local
      FROM evento_instrutor ei
      JOIN eventos e ON e.id = ei.evento_id
      JOIN turmas  t ON t.evento_id = e.id
      WHERE ei.instrutor_id = $1
      ORDER BY t.data_inicio DESC NULLS LAST, t.id DESC
    `;

    const { rows } = await query(sql, [usuarioId]);

    const turmas = (rows || []).map((r) => ({
      id: r.id,
      nome: r.nome,
      data_inicio: r.data_inicio,
      data_fim: r.data_fim,
      horario_inicio: r.horario_inicio,
      horario_fim: r.horario_fim,
      evento: { id: r.evento_id, nome: r.evento_nome, local: r.evento_local },
    }));

    log(rid, "info", "getMinhasTurmasInstrutor OK", { usuarioId, count: turmas.length });
    return res.json(turmas);
  } catch (err) {
    log(rid, "error", "Erro ao buscar minhas turmas (instrutor)", err);
    return res.status(500).json({ erro: "Erro ao buscar turmas do instrutor." });
  }
}

module.exports = {
  listarInstrutor,
  getEventosAvaliacaoPorInstrutor,
  getTurmasComEventoPorInstrutor,
  getMinhasTurmasInstrutor,
};
