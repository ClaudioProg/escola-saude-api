/* eslint-disable no-console */
// ✅ src/controllers/instrutorController.js — PREMIUM+++ (2026)
// - Vínculo principal: turma_instrutor (por turma) ✅
// - Fallback: evento_instrutor ✅
// - Compat DB robusta (req.db + fallback) ✅
// - Date-only safe (sem Date JS para "YYYY-MM-DD") ✅
// - Status por data+hora com fuso SP ✅
// - Fallback real avaliacoes/avaliacao ✅
// - SQL defensivo (sem multiplicar linhas indevidamente) ✅
// - Rotas:
//    • GET /api/instrutor (listarInstrutor)
//    • GET /api/instrutor/:id/eventos-avaliacao
//    • GET /api/instrutor/:id/turmas
//    • GET /api/instrutor/minhas/turmas?filtro=ativos|encerrados|todos

"use strict";

const dbMod = require("../db");

const TZ = "America/Sao_Paulo";
const IS_DEV = process.env.NODE_ENV !== "production";

/* ────────────────────────────────────────────────────────────────
   Compat DB
──────────────────────────────────────────────────────────────── */
const pgpDb = dbMod?.db ?? null;
const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;

const baseQuery =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null) ||
  (pgpDb?.query ? pgpDb.query.bind(pgpDb) : null);

if (typeof baseQuery !== "function") {
  console.error("[instrutorController] DB inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em instrutorController.js (query ausente)");
}

function getDb(req) {
  const reqDb = req?.db;

  if (reqDb?.query && typeof reqDb.query === "function") {
    return reqDb;
  }

  return { query: baseQuery };
}

async function queryDb(req, sql, params = []) {
  const db = getDb(req);
  return db.query(sql, params);
}

/* ────────────────────────────────────────────────────────────────
   Logger util (RID)
──────────────────────────────────────────────────────────────── */
function mkRid(prefix = "INS") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function reqRid(req, prefix = "INS") {
  return req?.requestId || req?.rid || mkRid(prefix);
}

function log(rid, level, msg, extra) {
  const prefix = `[INS-CTRL][RID=${rid}]`;

  if (level === "error") {
    return console.error(
      `${prefix} ✖ ${msg}`,
      extra?.stack || extra?.message || extra
    );
  }

  if (level === "warn") {
    return console.warn(`${prefix} ⚠ ${msg}`, extra || "");
  }

  if (!IS_DEV) return undefined;
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
  return (
    req?.user?.id ??
    req?.usuario?.id ??
    req?.user?.usuario_id ??
    req?.usuario?.usuario_id ??
    null
  );
}

function getPerfis(req) {
  const raw =
    req?.user?.perfis ??
    req?.user?.perfil ??
    req?.usuario?.perfis ??
    req?.usuario?.perfil ??
    "";

  if (Array.isArray(raw)) {
    return raw.map(String).map((s) => s.trim().toLowerCase()).filter(Boolean);
  }

  return String(raw)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** normaliza filtro ?filtro=ativos|encerrados|todos (default: todos) */
function getFiltro(req) {
  const hasParam =
    req.query?.filtro != null || req.query?.status != null;

  const raw = String(req.query?.filtro ?? req.query?.status ?? "")
    .toLowerCase()
    .trim();

  if (!hasParam) return "todos";
  if (raw === "encerrados" || raw === "encerrado" || raw === "realizados") return "encerrados";
  if (raw === "ativos" || raw === "ativo") return "ativos";
  return "todos";
}

async function queryFirstWorking(req, variants, params = []) {
  let lastErr = null;

  for (const sql of variants) {
    try {
      return await queryDb(req, sql, params);
    } catch (e) {
      lastErr = e;
      if (["42P01", "42703"].includes(e?.code)) continue;
      throw e;
    }
  }

  throw lastErr || new Error("Nenhuma variante de SQL funcionou.");
}

/* ────────────────────────────────────────────────────────────────
   Status por data+hora (sem Date JS) — fuso SP
   Usa alias "t"
──────────────────────────────────────────────────────────────── */
const SQL_STATUS_TURMA = `
  CASE
    WHEN (now() AT TIME ZONE '${TZ}') < (t.data_inicio::timestamp + COALESCE(t.horario_inicio,'00:00'::time)) THEN 'programado'
    WHEN (now() AT TIME ZONE '${TZ}') BETWEEN (t.data_inicio::timestamp + COALESCE(t.horario_inicio,'00:00'::time))
                                         AND (t.data_fim::timestamp + COALESCE(t.horario_fim,'23:59'::time)) THEN 'andamento'
    ELSE 'encerrado'
  END
`;

/* ────────────────────────────────────────────────────────────────
   Nota robusta -> 1..5
   Observação: usa alias "a"
──────────────────────────────────────────────────────────────── */
const SQL_MAP_NOTA = `
  CASE
    WHEN a.desempenho_instrutor IS NULL THEN NULL
    WHEN trim(a.desempenho_instrutor::text) ~ '^[1-5](?:[\\.,]0+)?$'
      THEN REPLACE(trim(a.desempenho_instrutor::text), ',', '.')::numeric
    WHEN lower(a.desempenho_instrutor::text) IN ('ótimo','otimo','excelente','muito bom','muitobom') THEN 5
    WHEN lower(a.desempenho_instrutor::text) = 'bom' THEN 4
    WHEN lower(a.desempenho_instrutor::text) IN ('regular','médio','medio') THEN 3
    WHEN lower(a.desempenho_instrutor::text) = 'ruim' THEN 2
    WHEN lower(a.desempenho_instrutor::text) IN ('péssimo','pessimo','muito ruim','muitoruim') THEN 1
    ELSE NULL
  END
`;

/* ────────────────────────────────────────────────────────────────
   CTE base de vínculos por instrutor específico
──────────────────────────────────────────────────────────────── */
function sqlVinculosBase(whereInstrutor = "$1") {
  return `
    WITH vinc_ti AS (
      SELECT ti.instrutor_id, t.evento_id, ti.turma_id
      FROM turma_instrutor ti
      JOIN turmas t ON t.id = ti.turma_id
      WHERE ti.instrutor_id = ${whereInstrutor}
    ),
    vinc_ei AS (
      SELECT ei.instrutor_id, ei.evento_id, t.id AS turma_id
      FROM evento_instrutor ei
      JOIN turmas t ON t.evento_id = ei.evento_id
      WHERE ei.instrutor_id = ${whereInstrutor}
    ),
    vinculos AS (
      SELECT DISTINCT instrutor_id, evento_id, turma_id FROM vinc_ti
      UNION
      SELECT DISTINCT instrutor_id, evento_id, turma_id FROM vinc_ei
    )
  `;
}

/* ────────────────────────────────────────────────────────────────
   CTE base de vínculos global (para listagem)
──────────────────────────────────────────────────────────────── */
function sqlVinculosBaseGlobal() {
  return `
    WITH vinc_ti AS (
      SELECT ti.instrutor_id, t.evento_id, ti.turma_id
      FROM turma_instrutor ti
      JOIN turmas t ON t.id = ti.turma_id
    ),
    vinc_ei AS (
      SELECT ei.instrutor_id, ei.evento_id, t.id AS turma_id
      FROM evento_instrutor ei
      JOIN turmas t ON t.evento_id = ei.evento_id
    ),
    vinculos AS (
      SELECT DISTINCT instrutor_id, evento_id, turma_id FROM vinc_ti
      UNION
      SELECT DISTINCT instrutor_id, evento_id, turma_id FROM vinc_ei
    )
  `;
}

/* ===================================================================
   📋 Lista instrutores com médias/contadores
   GET /api/instrutor
=================================================================== */
async function listarInstrutor(req, res) {
  const rid = reqRid(req);

  try {
    const sqlVariants = [
      `
      ${sqlVinculosBaseGlobal()},
      instrutores AS (
        SELECT DISTINCT u.id, u.nome, u.email
        FROM usuarios u
        WHERE string_to_array(COALESCE(u.perfil,''), ',') && ARRAY['instrutor','administrador']
      ),
      eventos_por_instrutor AS (
        SELECT instrutor_id, COUNT(DISTINCT evento_id)::int AS eventos_ministrados
        FROM vinculos
        GROUP BY instrutor_id
      ),
      turmas_por_instrutor AS (
        SELECT instrutor_id, COUNT(DISTINCT turma_id)::int AS turmas_vinculadas
        FROM vinculos
        GROUP BY instrutor_id
      ),
      notas_por_instrutor AS (
        SELECT
          v.instrutor_id,
          ${SQL_MAP_NOTA} AS nota
        FROM vinculos v
        LEFT JOIN avaliacoes a ON a.turma_id = v.turma_id
      ),
      agg_notas AS (
        SELECT
          instrutor_id,
          COUNT(nota)::int AS total_respostas,
          ROUND(AVG(nota)::numeric, 2) AS media_avaliacao
        FROM notas_por_instrutor
        GROUP BY instrutor_id
      ),
      assinaturas_agg AS (
        SELECT
          s.usuario_id,
          BOOL_OR(
            s.imagem_base64 IS NOT NULL
            OR NULLIF(trim(COALESCE(s.assinatura_url, '')), '') IS NOT NULL
            OR NULLIF(trim(COALESCE(s.assinatura_path, '')), '') IS NOT NULL
          ) AS possui_assinatura
        FROM assinaturas s
        GROUP BY s.usuario_id
      )
      SELECT
        i.id,
        i.nome,
        i.email,
        COALESCE(ep.eventos_ministrados, 0) AS "eventosMinistrados",
        COALESCE(tp.turmas_vinculadas, 0)   AS "turmasVinculadas",
        COALESCE(an.total_respostas, 0)     AS "totalRespostas",
        an.media_avaliacao,
        COALESCE(sa.possui_assinatura, FALSE) AS "possuiAssinatura"
      FROM instrutores i
      LEFT JOIN eventos_por_instrutor ep ON ep.instrutor_id = i.id
      LEFT JOIN turmas_por_instrutor  tp ON tp.instrutor_id = i.id
      LEFT JOIN agg_notas             an ON an.instrutor_id = i.id
      LEFT JOIN assinaturas_agg       sa ON sa.usuario_id = i.id
      ORDER BY i.nome;
      `,
      `
      ${sqlVinculosBaseGlobal()},
      instrutores AS (
        SELECT DISTINCT u.id, u.nome, u.email
        FROM usuarios u
        WHERE string_to_array(COALESCE(u.perfil,''), ',') && ARRAY['instrutor','administrador']
      ),
      eventos_por_instrutor AS (
        SELECT instrutor_id, COUNT(DISTINCT evento_id)::int AS eventos_ministrados
        FROM vinculos
        GROUP BY instrutor_id
      ),
      turmas_por_instrutor AS (
        SELECT instrutor_id, COUNT(DISTINCT turma_id)::int AS turmas_vinculadas
        FROM vinculos
        GROUP BY instrutor_id
      ),
      notas_por_instrutor AS (
        SELECT
          v.instrutor_id,
          ${SQL_MAP_NOTA} AS nota
        FROM vinculos v
        LEFT JOIN avaliacao a ON a.turma_id = v.turma_id
      ),
      agg_notas AS (
        SELECT
          instrutor_id,
          COUNT(nota)::int AS total_respostas,
          ROUND(AVG(nota)::numeric, 2) AS media_avaliacao
        FROM notas_por_instrutor
        GROUP BY instrutor_id
      ),
      assinaturas_agg AS (
        SELECT
          s.usuario_id,
          BOOL_OR(
            s.imagem_base64 IS NOT NULL
            OR NULLIF(trim(COALESCE(s.assinatura_url, '')), '') IS NOT NULL
            OR NULLIF(trim(COALESCE(s.assinatura_path, '')), '') IS NOT NULL
          ) AS possui_assinatura
        FROM assinaturas s
        GROUP BY s.usuario_id
      )
      SELECT
        i.id,
        i.nome,
        i.email,
        COALESCE(ep.eventos_ministrados, 0) AS "eventosMinistrados",
        COALESCE(tp.turmas_vinculadas, 0)   AS "turmasVinculadas",
        COALESCE(an.total_respostas, 0)     AS "totalRespostas",
        an.media_avaliacao,
        COALESCE(sa.possui_assinatura, FALSE) AS "possuiAssinatura"
      FROM instrutores i
      LEFT JOIN eventos_por_instrutor ep ON ep.instrutor_id = i.id
      LEFT JOIN turmas_por_instrutor  tp ON tp.instrutor_id = i.id
      LEFT JOIN agg_notas             an ON an.instrutor_id = i.id
      LEFT JOIN assinaturas_agg       sa ON sa.usuario_id = i.id
      ORDER BY i.nome;
      `,
    ];

    const { rows } = await queryFirstWorking(req, sqlVariants, []);

    log(rid, "info", "listarInstrutor OK", { count: rows.length });
    return res.status(200).json(rows);
  } catch (error) {
    log(rid, "error", "Erro ao buscar instrutores", error);
    return res.status(500).json({ erro: "Erro ao buscar instrutor." });
  }
}

/* ===================================================================
   📊 Eventos ministrados por instrutor
   GET /api/instrutor/:id/eventos-avaliacao
=================================================================== */
async function getEventosAvaliacaoPorInstrutor(req, res) {
  const rid = reqRid(req);
  const instrutorId = asPositiveInt(req.params?.id);

  if (!instrutorId) {
    return res.status(400).json({ erro: "ID inválido." });
  }

  try {
    const sqlVariants = [
      `
      ${sqlVinculosBase("$1")},
      turmas_evento AS (
        SELECT
          e.id AS evento_id,
          e.titulo AS evento,
          MIN(t.data_inicio)::date AS data_inicio,
          MAX(t.data_fim)::date    AS data_fim
        FROM vinculos v
        JOIN eventos e ON e.id = v.evento_id
        JOIN turmas  t ON t.id = v.turma_id
        GROUP BY e.id, e.titulo
      ),
      notas_evento AS (
        SELECT
          v.evento_id,
          ${SQL_MAP_NOTA} AS nota
        FROM vinculos v
        LEFT JOIN avaliacoes a ON a.turma_id = v.turma_id
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
      `,
      `
      ${sqlVinculosBase("$1")},
      turmas_evento AS (
        SELECT
          e.id AS evento_id,
          e.titulo AS evento,
          MIN(t.data_inicio)::date AS data_inicio,
          MAX(t.data_fim)::date    AS data_fim
        FROM vinculos v
        JOIN eventos e ON e.id = v.evento_id
        JOIN turmas  t ON t.id = v.turma_id
        GROUP BY e.id, e.titulo
      ),
      notas_evento AS (
        SELECT
          v.evento_id,
          ${SQL_MAP_NOTA} AS nota
        FROM vinculos v
        LEFT JOIN avaliacao a ON a.turma_id = v.turma_id
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
      `,
    ];

    const { rows } = await queryFirstWorking(req, sqlVariants, [instrutorId]);

    log(rid, "info", "getEventosAvaliacaoPorInstrutor OK", {
      instrutorId,
      count: rows.length,
    });

    return res.json(rows);
  } catch (error) {
    log(rid, "error", "Erro ao buscar eventos do instrutor", error);
    return res.status(500).json({ erro: "Erro ao buscar eventos ministrados." });
  }
}

/* ===================================================================
   📚 Turmas vinculadas ao instrutor (com dados do evento)
   GET /api/instrutor/:id/turmas
=================================================================== */
async function getTurmasComEventoPorInstrutor(req, res) {
  const rid = reqRid(req);
  const instrutorId = asPositiveInt(req.params?.id);

  if (!instrutorId) {
    return res.status(400).json({ erro: "ID inválido." });
  }

  try {
    const sql = `
      ${sqlVinculosBase("$1")},
      turmas_ids AS (
        SELECT DISTINCT turma_id FROM vinculos
      )
      SELECT 
        t.id AS id,
        t.nome AS nome,
        to_char(t.data_inicio::date,'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date,'YYYY-MM-DD')    AS data_fim,
        to_char(t.horario_inicio,'HH24:MI')       AS horario_inicio,
        to_char(t.horario_fim,'HH24:MI')          AS horario_fim,
        ${SQL_STATUS_TURMA}                        AS status,
        e.id     AS evento_id,
        e.titulo AS evento_nome,
        e.local  AS evento_local
      FROM turmas_ids x
      JOIN turmas  t ON t.id = x.turma_id
      JOIN eventos e ON e.id = t.evento_id
      ORDER BY t.data_inicio ASC NULLS LAST, t.id ASC
    `;

    const { rows } = await queryDb(req, sql, [instrutorId]);

    const turmasFormatadas = (rows || []).map((t) => ({
      id: t.id,
      nome: t.nome,
      data_inicio: t.data_inicio,
      data_fim: t.data_fim,
      horario_inicio: t.horario_inicio,
      horario_fim: t.horario_fim,
      status: t.status || "programado",
      evento: {
        id: t.evento_id,
        nome: t.evento_nome,
        local: t.evento_local,
      },
    }));

    log(rid, "info", "getTurmasComEventoPorInstrutor OK", {
      instrutorId,
      count: turmasFormatadas.length,
    });

    return res.json(turmasFormatadas);
  } catch (error) {
    log(rid, "error", "Erro ao buscar turmas do instrutor", error);
    return res.status(500).json({ erro: "Erro ao buscar turmas do instrutor." });
  }
}

/* ===================================================================
   👤 “Minhas turmas” (instrutor autenticado)
   GET /api/instrutor/minhas/turmas?filtro=ativos|encerrados|todos
=================================================================== */
async function getMinhasTurmasInstrutor(req, res) {
  const rid = reqRid(req);
  const usuarioId = asPositiveInt(getUsuarioId(req));

  if (!usuarioId) {
    return res.status(401).json({ erro: "Usuário não autenticado." });
  }

  const perfis = getPerfis(req);
  const filtro = getFiltro(req);

  const whereByFiltro =
    filtro === "encerrados"
      ? `WHERE base.status_calc = 'encerrado'`
      : filtro === "ativos"
      ? `WHERE base.status_calc IN ('programado','andamento')`
      : ``;

  try {
    const sqlTurmaInstrutor = `
      WITH base AS (
        SELECT
          t.id,
          t.nome,
          to_char(t.data_inicio::date,'YYYY-MM-DD') AS data_inicio,
          to_char(t.data_fim::date,'YYYY-MM-DD')    AS data_fim,
          to_char(t.horario_inicio,'HH24:MI')       AS horario_inicio,
          to_char(t.horario_fim,'HH24:MI')          AS horario_fim,
          ${SQL_STATUS_TURMA}                        AS status_calc,
          e.id     AS evento_id,
          e.titulo AS evento_nome,
          e.local  AS evento_local
        FROM turma_instrutor ti
        JOIN turmas t  ON t.id = ti.turma_id
        JOIN eventos e ON e.id = t.evento_id
        WHERE ti.instrutor_id = $1
      )
      SELECT *
      FROM base
      ${whereByFiltro}
      ORDER BY
        (CASE WHEN status_calc='andamento' THEN 1 WHEN status_calc='programado' THEN 2 ELSE 3 END),
        data_inicio DESC NULLS LAST,
        id DESC
    `;

    let rows = [];

    try {
      const r1 = await queryDb(req, sqlTurmaInstrutor, [usuarioId]);
      rows = r1?.rows || [];
    } catch (e) {
      if (e?.code !== "42P01") throw e;

      const sqlFallbackEventoInstrutor = `
        WITH base AS (
          SELECT
            t.id,
            t.nome,
            to_char(t.data_inicio::date,'YYYY-MM-DD') AS data_inicio,
            to_char(t.data_fim::date,'YYYY-MM-DD')    AS data_fim,
            to_char(t.horario_inicio,'HH24:MI')       AS horario_inicio,
            to_char(t.horario_fim,'HH24:MI')          AS horario_fim,
            ${SQL_STATUS_TURMA}                        AS status_calc,
            e.id     AS evento_id,
            e.titulo AS evento_nome,
            e.local  AS evento_local
          FROM evento_instrutor ei
          JOIN eventos e ON e.id = ei.evento_id
          JOIN turmas  t ON t.evento_id = e.id
          WHERE ei.instrutor_id = $1
        )
        SELECT *
        FROM base
        ${whereByFiltro}
        ORDER BY
          (CASE WHEN status_calc='andamento' THEN 1 WHEN status_calc='programado' THEN 2 ELSE 3 END),
          data_inicio DESC NULLS LAST,
          id DESC
      `;

      const r2 = await queryDb(req, sqlFallbackEventoInstrutor, [usuarioId]);
      rows = r2?.rows || [];
    }

    const turmas = (rows || []).map((r) => ({
      id: r.id,
      nome: r.nome,
      data_inicio: r.data_inicio,
      data_fim: r.data_fim,
      horario_inicio: r.horario_inicio,
      horario_fim: r.horario_fim,
      status: r.status_calc || r.status || "programado",
      evento: {
        id: r.evento_id,
        nome: r.evento_nome,
        local: r.evento_local,
      },
    }));

    log(rid, "info", "getMinhasTurmasInstrutor OK", {
      usuarioId,
      perfis,
      filtro,
      count: turmas.length,
    });

    try {
      res.setHeader("X-Instrutor-Filtro", filtro);
      res.setHeader("X-Instrutor-Turmas", String(turmas.length));
    } catch (_) {
      // noop
    }

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