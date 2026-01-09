// 📁 src/controllers/relatorioPresencasController.js — PREMIUM (seguro, consistente, sem falso-positivo)
// Observações importantes:
// - Prioriza datas_turma quando existir (datas reais da turma).
// - Fallback: generate_series(data_inicio..data_fim) quando NÃO existir datas_turma.
// - Sempre retorna datas como "YYYY-MM-DD" (date-only), evitando dor de fuso.
// - “porEvento” agora retorna agregados melhores (presenças distintas, período, frequência), sem duplicar usuário.

const dbRaw = require("../db");
const db = dbRaw?.db ?? dbRaw; // compat: pg-pool (query) OU pg-promise (db)

const IS_PROD = process.env.NODE_ENV === "production";
const log = (...a) => !IS_PROD && console.log("[rel-pres]", ...a);
const logErr = (...a) => console.error("[rel-pres][ERR]", ...a);

/* ────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────── */
function toInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function hasDatasTurma(turmaId) {
  const q = await db.query(
    `SELECT EXISTS(SELECT 1 FROM datas_turma WHERE turma_id = $1) AS tem`,
    [turmaId]
  );
  return !!q.rows?.[0]?.tem;
}

/**
 * Datas reais da turma:
 * - se existir datas_turma: usa dt.data
 * - senão: usa generate_series(t.data_inicio..t.data_fim)
 * Retorna array de "YYYY-MM-DD" (ordenado).
 */
async function getDatasDaTurmaYMD(turmaId) {
  const temDT = await hasDatasTurma(turmaId);

  const sql = temDT
    ? `
      SELECT to_char(dt.data::date, 'YYYY-MM-DD') AS data
      FROM datas_turma dt
      WHERE dt.turma_id = $1
      ORDER BY dt.data ASC
    `
    : `
      WITH t AS (
        SELECT data_inicio::date AS di, data_fim::date AS df
        FROM turmas
        WHERE id = $1
        LIMIT 1
      )
      SELECT to_char(gs::date, 'YYYY-MM-DD') AS data
      FROM t
      CROSS JOIN LATERAL generate_series(t.di, t.df, interval '1 day') AS gs
      ORDER BY gs ASC
    `;

  const r = await db.query(sql, [turmaId]);
  return (r.rows || []).map((x) => x.data).filter(Boolean);
}

/**
 * Carrega dados base da turma/evento (para enriquecer payload e evitar queries soltas no frontend)
 */
async function getTurmaInfo(turmaId) {
  const q = await db.query(
    `
    SELECT
      t.id AS turma_id,
      t.nome AS turma_nome,
      t.evento_id,
      e.titulo AS evento_titulo,
      to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
      to_char(t.data_fim::date, 'YYYY-MM-DD')    AS data_fim,
      to_char(t.horario_inicio::time, 'HH24:MI') AS horario_inicio,
      to_char(t.horario_fim::time, 'HH24:MI')    AS horario_fim
    FROM turmas t
    JOIN eventos e ON e.id = t.evento_id
    WHERE t.id = $1
    LIMIT 1
    `,
    [turmaId]
  );
  return q.rows?.[0] || null;
}

/* ────────────────────────────────────────────────────────────────
   📄 Relatório de presenças por turma (grade completa por data)
   Retorna: { turma, datas, lista }
   - lista: linhas por usuário + data, com presente boolean
   ──────────────────────────────────────────────────────────────── */
async function porTurma(req, res) {
  const turmaId = toInt(req.params.turma_id);
  if (!turmaId) return res.status(400).json({ ok: false, erro: "TURMA_ID_INVALIDO" });

  const rid = `rt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  try {
    const turma = await getTurmaInfo(turmaId);
    if (!turma) return res.status(404).json({ ok: false, erro: "TURMA_NAO_ENCONTRADA" });

    const datas = await getDatasDaTurmaYMD(turmaId);
    if (!datas.length) {
      return res.json({
        ok: true,
        turma,
        datas: [],
        lista: [],
      });
    }

    // Inscritos da turma
    const insc = await db.query(
      `
      SELECT u.id AS usuario_id, u.nome, u.cpf
      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.turma_id = $1
      ORDER BY u.nome ASC, u.id ASC
      `,
      [turmaId]
    );

    // Presenças por (usuario_id, data) — pega o melhor “estado” do dia:
    // BOOL_OR(presente) evita problema de múltiplos registros no mesmo dia.
    const pres = await db.query(
      `
      SELECT
        p.usuario_id,
        to_char(p.data_presenca::date, 'YYYY-MM-DD') AS data,
        BOOL_OR(p.presente) AS presente
      FROM presencas p
      WHERE p.turma_id = $1
        AND p.usuario_id = ANY($2::int[])
      GROUP BY p.usuario_id, p.data_presenca::date
      `,
      [turmaId, insc.rows.map((r) => Number(r.usuario_id))]
    );

    const presMap = new Map(
      (pres.rows || []).map((r) => [`${r.usuario_id}|${r.data}`, r.presente === true])
    );

    // Grade completa
    const lista = [];
    for (const u of insc.rows) {
      for (const d of datas) {
        const key = `${u.usuario_id}|${d}`;
        lista.push({
          usuario_id: u.usuario_id,
          nome: u.nome,
          cpf: u.cpf,
          data: d,
          presente: presMap.get(key) === true,
        });
      }
    }

    return res.json({
      ok: true,
      rid,
      turma,
      datas,
      lista,
    });
  } catch (err) {
    logErr("porTurma:", { rid, turmaId, message: err?.message, detail: err?.detail, code: err?.code });
    return res.status(500).json({ ok: false, erro: "ERRO_RELATORIO_TURMA", rid });
  }
}

/* ────────────────────────────────────────────────────────────────
   📄 Relatório detalhado por turma (somente registros existentes)
   Retorna: { turma, lista }
   - lista: um registro por (usuario_id, data) agregando presente e confirmado_em
   ──────────────────────────────────────────────────────────────── */
async function porTurmaDetalhado(req, res) {
  const turmaId = toInt(req.params.turma_id);
  if (!turmaId) return res.status(400).json({ ok: false, erro: "TURMA_ID_INVALIDO" });

  const rid = `rd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  try {
    const turma = await getTurmaInfo(turmaId);
    if (!turma) return res.status(404).json({ ok: false, erro: "TURMA_NAO_ENCONTRADA" });

    const result = await db.query(
      `
      SELECT
        u.id AS usuario_id,
        u.nome,
        u.cpf,
        to_char(p.data_presenca::date, 'YYYY-MM-DD') AS data,
        BOOL_OR(p.presente) AS presente,
        MAX(p.confirmado_em) AS confirmado_em
      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      LEFT JOIN presencas p
        ON p.usuario_id = u.id
       AND p.turma_id   = i.turma_id
      WHERE i.turma_id = $1
      GROUP BY u.id, u.nome, u.cpf, p.data_presenca::date
      ORDER BY u.nome ASC, data ASC NULLS LAST
      `,
      [turmaId]
    );

    // Remove a “linha null” (quando não há presenças e data fica null)
    const lista = (result.rows || []).filter((r) => r.data != null);

    return res.json({ ok: true, rid, turma, lista });
  } catch (err) {
    logErr("porTurmaDetalhado:", { rid, turmaId, message: err?.message, detail: err?.detail, code: err?.code });
    return res.status(500).json({ ok: false, erro: "ERRO_RELATORIO_TURMA_DETALHADO", rid });
  }
}

/* ────────────────────────────────────────────────────────────────
   📄 Relatório de presenças por evento (AGREGADO POR USUÁRIO)
   Retorna: { evento, lista }
   - lista: um por usuário com contagens e frequência (se houver datas)
   ──────────────────────────────────────────────────────────────── */
async function porEvento(req, res) {
  const eventoId = toInt(req.params.evento_id);
  if (!eventoId) return res.status(400).json({ ok: false, erro: "EVENTO_ID_INVALIDO" });

  const rid = `re-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  try {
    // evento base
    const ev = await db.query(
      `SELECT id AS evento_id, COALESCE(titulo,'Evento') AS titulo FROM eventos WHERE id = $1 LIMIT 1`,
      [eventoId]
    );
    if (!ev.rowCount) return res.status(404).json({ ok: false, erro: "EVENTO_NAO_ENCONTRADO" });

    // Datas possíveis do evento (somatório das datas das turmas):
    // - se houver datas_turma, conta por turma; senão, usa generate_series por turma.
    // Essa base permite calcular frequência “padrão” por evento (informativa).
    const baseDatas = await db.query(
      `
      WITH turmas_ev AS (
        SELECT id, data_inicio::date AS di, data_fim::date AS df
        FROM turmas
        WHERE evento_id = $1
      ),
      dt AS (
        SELECT turma_id, data::date AS d
        FROM datas_turma
        WHERE turma_id IN (SELECT id FROM turmas_ev)
      ),
      ds AS (
        -- turmas sem datas_turma: usa generate_series
        SELECT te.id AS turma_id, gs::date AS d
        FROM turmas_ev te
        LEFT JOIN dt ON dt.turma_id = te.id
        CROSS JOIN LATERAL generate_series(te.di, te.df, interval '1 day') AS gs
        WHERE dt.turma_id IS NULL
      ),
      all_days AS (
        SELECT turma_id, d FROM dt
        UNION ALL
        SELECT turma_id, d FROM ds
      )
      SELECT turma_id, COUNT(*)::int AS total_dias
      FROM all_days
      GROUP BY turma_id
      `,
      [eventoId]
    );

    const totalDiasTurmaMap = new Map(
      (baseDatas.rows || []).map((r) => [Number(r.turma_id), Number(r.total_dias || 0)])
    );

    // Lista (por usuário, por turma) e agrega em JS (mais simples de manter e “premium” no shape)
    const raw = await db.query(
      `
      SELECT
        u.id AS usuario_id,
        u.nome,
        u.cpf,
        t.id AS turma_id,
        t.nome AS turma_nome,
        to_char(t.data_inicio::date,'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date,'YYYY-MM-DD')    AS data_fim,
        COUNT(DISTINCT CASE WHEN p.presente IS TRUE THEN p.data_presenca::date END)::int AS presentes
      FROM turmas t
      JOIN inscricoes i ON i.turma_id = t.id
      JOIN usuarios u   ON u.id = i.usuario_id
      LEFT JOIN presencas p
        ON p.turma_id = t.id
       AND p.usuario_id = u.id
      WHERE t.evento_id = $1
      GROUP BY u.id, u.nome, u.cpf, t.id, t.nome, t.data_inicio, t.data_fim
      ORDER BY u.nome ASC, t.data_inicio ASC NULLS LAST, t.id ASC
      `,
      [eventoId]
    );

    const users = new Map();

    for (const r of raw.rows || []) {
      const uid = Number(r.usuario_id);
      if (!users.has(uid)) {
        users.set(uid, {
          usuario_id: uid,
          nome: r.nome,
          cpf: r.cpf,
          turmas: [],
          // agregados (informativos)
          total_dias: 0,
          presentes: 0,
          frequencia: 0,
        });
      }

      const totalDias = totalDiasTurmaMap.get(Number(r.turma_id)) || 0;
      const presentes = Number(r.presentes || 0);

      const u = users.get(uid);
      u.turmas.push({
        turma_id: Number(r.turma_id),
        turma_nome: r.turma_nome,
        data_inicio: r.data_inicio,
        data_fim: r.data_fim,
        total_dias: totalDias,
        presentes,
        frequencia: totalDias > 0 ? Math.round((presentes / totalDias) * 100) : null,
      });

      u.total_dias += totalDias;
      u.presentes += presentes;
    }

    // calcula agregados finais por usuário
    const lista = Array.from(users.values()).map((u) => ({
      ...u,
      frequencia: u.total_dias > 0 ? Math.round((u.presentes / u.total_dias) * 100) : null,
      presente: u.total_dias > 0 ? u.presentes > 0 : false, // compat/flag simples
    }));

    return res.json({
      ok: true,
      rid,
      evento: ev.rows[0],
      lista,
    });
  } catch (err) {
    logErr("porEvento:", { rid, eventoId, message: err?.message, detail: err?.detail, code: err?.code });
    return res.status(500).json({ ok: false, erro: "ERRO_RELATORIO_EVENTO", rid });
  }
}

module.exports = {
  porTurma,
  porTurmaDetalhado,
  porEvento,
};
