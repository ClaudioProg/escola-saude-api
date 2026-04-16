/* eslint-disable no-console */
// ✅ src/controllers/questionarioController.js — PREMIUM+++
// - Seguro, idempotente, anti-fuso, com regras reais
// - Logs com RID
// - Compat DB robusta
// - Frequência via datas_turma > fallback conservador
// - Publicação com validação forte
// - Envio de tentativa mais robusto
// - Disparo best-effort de notificação de avaliação após aprovação

"use strict";

const db = require("../db");

let gerarNotificacaoDeAvaliacao = async () => {};
try {
  ({ gerarNotificacaoDeAvaliacao } = require("./notificacaoController"));
} catch {
  gerarNotificacaoDeAvaliacao = async () => {};
}

/* ------------------------------------------------------------------ */
/* Compat DB                                                          */
/* ------------------------------------------------------------------ */
const pool =
  db?.pool ||
  db?.Pool ||
  db?.db?.pool ||
  db?.default?.pool ||
  null;

const query =
  typeof db?.query === "function"
    ? db.query.bind(db)
    : typeof db?.default?.query === "function"
      ? db.default.query.bind(db.default)
      : typeof db === "function"
        ? db
        : db?.db?.query?.bind(db.db);

if (typeof query !== "function") {
  console.error("[questionarioController] DB inválido:", Object.keys(db || {}));
  throw new Error("DB inválido em questionarioController.js (query ausente)");
}

const IS_DEV = process.env.NODE_ENV !== "production";
const TZ = "America/Sao_Paulo";

/* ------------------------------------------------------------------ */
/* Logger                                                             */
/* ------------------------------------------------------------------ */
function mkRid(prefix = "QST") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function _log(rid, level, msg, extra) {
  const prefix = `[${rid}]`;
  if (level === "error") {
    return console.error(`${prefix} ✖ ${msg}`, extra?.stack || extra?.message || extra);
  }
  if (level === "warn") {
    return console.warn(`${prefix} ⚠ ${msg}`, extra || "");
  }
  if (IS_DEV) {
    return console.log(`${prefix} • ${msg}`, extra || "");
  }
  return undefined;
}

const logInfo = (rid, msg, extra) => _log(rid, "info", msg, extra);
const logWarn = (rid, msg, extra) => _log(rid, "warn", msg, extra);
const logError = (rid, msg, err) => _log(rid, "error", msg, err);

/* ------------------------------------------------------------------ */
/* Transação                                                          */
/* ------------------------------------------------------------------ */
async function withTx(fn) {
  if (!pool || typeof pool.connect !== "function") {
    await query("BEGIN");
    try {
      const out = await fn({ query });
      await query("COMMIT");
      return out;
    } catch (e) {
      try { await query("ROLLBACK"); } catch {}
      throw e;
    }
  }

  const client = await pool.connect();
  try {
    const q = client.query.bind(client);
    await q("BEGIN");
    const out = await fn({ query: q });
    await q("COMMIT");
    return out;
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    throw e;
  } finally {
    client.release();
  }
}

/* ------------------------------------------------------------------ */
/* Helpers premium                                                    */
/* ------------------------------------------------------------------ */
function nowSP_YMDHM() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce((o, p) => {
      o[p.type] = p.value;
      return o;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toPositiveInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function safeText(v, fb = "") {
  return v == null ? fb : String(v);
}

function clampNumber(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizePerfis(user) {
  const perf = user?.perfil ?? user?.perfis ?? [];
  const arr = Array.isArray(perf)
    ? perf.map(String)
    : String(perf)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  return Array.from(new Set(arr.map((s) => s.toLowerCase())));
}

function isAdminLike(user) {
  return normalizePerfis(user).includes("administrador");
}

async function resolveInscricaoTable(q) {
  try {
    await q(`SELECT 1 FROM inscricoes LIMIT 1`);
    return "inscricoes";
  } catch {
    return "inscricao";
  }
}

/* ------------------------------------------------------------------ */
/* Regras de turma / elegibilidade                                    */
/* ------------------------------------------------------------------ */
/** fim real da turma (datas_turma > turmas), em string "YYYY-MM-DD HH:MM" (SP) */
async function fimRealTurmaStr(q, turmaId) {
  const result = await q(
    `
    WITH base AS (
      SELECT
        (
          SELECT
            to_char(dt.data::date, 'YYYY-MM-DD') || ' ' ||
            to_char(COALESCE(dt.horario_fim::time, t.horario_fim::time, '23:59'::time), 'HH24:MI')
          FROM datas_turma dt
          JOIN turmas t ON t.id = dt.turma_id
          WHERE dt.turma_id = $1
          ORDER BY dt.data DESC, COALESCE(dt.horario_fim, t.horario_fim) DESC
          LIMIT 1
        ) AS fim_dt,
        (
          SELECT
            to_char(t.data_fim::date, 'YYYY-MM-DD') || ' ' ||
            to_char(COALESCE(t.horario_fim::time, '23:59'::time), 'HH24:MI')
          FROM turmas t
          WHERE t.id = $1
          LIMIT 1
        ) AS fim_tb
    )
    SELECT COALESCE(fim_dt, fim_tb) AS fim_real
    FROM base;
    `,
    [Number(turmaId)]
  );

  return result.rows?.[0]?.fim_real || null;
}

/** total de encontros reais (datas_turma > fallback conservador = 1) */
async function totalEncontrosTurma(q, turmaId) {
  const result = await q(
    `
    WITH dts AS (
      SELECT COUNT(*)::int AS n
      FROM datas_turma
      WHERE turma_id = $1
    ),
    fallback AS (
      SELECT
        CASE
          WHEN t.data_inicio IS NOT NULL AND t.data_fim IS NOT NULL THEN 1
          ELSE 0
        END::int AS n
      FROM turmas t
      WHERE t.id = $1
    )
    SELECT
      CASE
        WHEN (SELECT n FROM dts) > 0 THEN (SELECT n FROM dts)
        ELSE (SELECT n FROM fallback)
      END AS total;
    `,
    [Number(turmaId)]
  );

  return Number(result.rows?.[0]?.total || 0);
}

/** presentes do usuário (dias distintos com presente=TRUE) */
async function presentesUsuarioTurma(q, usuarioId, turmaId) {
  const result = await q(
    `
    SELECT COUNT(DISTINCT data_presenca::date)::int AS presentes
    FROM presencas
    WHERE turma_id = $1
      AND usuario_id = $2
      AND presente = TRUE
    `,
    [Number(turmaId), Number(usuarioId)]
  );

  return Number(result.rows?.[0]?.presentes || 0);
}

/** confere se usuário está inscrito na turma */
async function ensureInscrito(q, usuarioId, turmaId) {
  const inscrTable = await resolveInscricaoTable(q);
  const result = await q(
    `SELECT 1 FROM ${inscrTable} WHERE usuario_id = $1 AND turma_id = $2 LIMIT 1`,
    [Number(usuarioId), Number(turmaId)]
  );
  return result.rowCount > 0;
}

/** confere se questionário pertence ao evento da turma */
async function getQuestionarioTurmaContext(q, questionarioId, turmaId) {
  const result = await q(
    `
    SELECT
      q.id AS questionario_id,
      q.evento_id,
      q.status,
      q.obrigatorio,
      q.min_nota,
      q.tentativas_max,
      t.id AS turma_id
    FROM questionarios_evento q
    JOIN turmas t ON t.evento_id = q.evento_id
    WHERE q.id = $1
      AND t.id = $2
    LIMIT 1
    `,
    [Number(questionarioId), Number(turmaId)]
  );

  return result.rows?.[0] || null;
}

/** checa elegibilidade real (turma encerrada + presença >= 75%) */
async function checarElegibilidadeAluno(q, { usuarioId, turmaId }) {
  const fimReal = await fimRealTurmaStr(q, turmaId);
  if (!fimReal) return { ok: false, motivo: "TURMA_INVALIDA" };

  const agora = nowSP_YMDHM();
  if (agora < fimReal) {
    return { ok: false, motivo: "TURMA_NAO_ENCERRADA", agora, fimReal };
  }

  const total = await totalEncontrosTurma(q, turmaId);
  if (total <= 0) {
    return { ok: false, motivo: "TURMA_SEM_DATAS" };
  }

  const presentes = await presentesUsuarioTurma(q, usuarioId, turmaId);
  const freq = total > 0 ? presentes / total : 0;

  if (freq < 0.75) {
    return {
      ok: false,
      motivo: "FREQUENCIA_INSUFICIENTE",
      presentes,
      total,
      freq,
    };
  }

  return { ok: true, presentes, total, freq, agora, fimReal };
}

/* ------------------------------------------------------------------ */
/* Helpers de questões / alternativas                                 */
/* ------------------------------------------------------------------ */
async function carregarQuestoes(q, questionarioId) {
  const result = await q(
    `
    SELECT *
    FROM questoes_questionario
    WHERE questionario_id = $1
    ORDER BY ordem ASC, id ASC
    `,
    [Number(questionarioId)]
  );
  return result.rows || [];
}

async function carregarAlternativasPorQuestoes(q, questoesIds = []) {
  const ids = Array.isArray(questoesIds)
    ? questoesIds.map(Number).filter(Number.isFinite)
    : [];

  if (!ids.length) return [];

  const result = await q(
    `
    SELECT *
    FROM alternativas_questao
    WHERE questao_id = ANY($1::int[])
    ORDER BY questao_id ASC, ordem ASC, id ASC
    `,
    [ids]
  );

  return result.rows || [];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* =========================================================
   1) INSTRUTOR/ADMIN: CRIAR/EDITAR
   ========================================================= */

// POST /api/questionarios/evento/:evento_id/rascunho
async function criarOuObterRascunhoPorEvento(req, res) {
  const rid = mkRid();
  try {
    const eventoId = toPositiveInt(req.params.evento_id);
    const userId = toPositiveInt(req.user?.id);

    if (!eventoId) {
      return res.status(400).json({ error: "evento_id inválido." });
    }

    const existe = await query(
      `SELECT * FROM questionarios_evento WHERE evento_id = $1 LIMIT 1`,
      [eventoId]
    );

    if (existe.rowCount) {
      logInfo(rid, "rascunho já existente", { eventoId, questionarioId: existe.rows[0].id });
      return res.json(existe.rows[0]);
    }

    const created = await query(
      `
      INSERT INTO questionarios_evento (evento_id, titulo, descricao, obrigatorio, status, criado_por)
      VALUES ($1, $2, $3, $4, 'rascunho', $5)
      RETURNING *
      `,
      [
        eventoId,
        "Questionário de Aprendizagem",
        "Verificação de absorção do conteúdo (antes da avaliação institucional).",
        true,
        userId || null,
      ]
    );

    logInfo(rid, "rascunho criado", { eventoId, questionarioId: created.rows[0]?.id || null });
    return res.status(201).json(created.rows[0]);
  } catch (err) {
    logError(rid, "criarOuObterRascunhoPorEvento", err);
    return res.status(500).json({ error: "Erro ao criar/obter rascunho." });
  }
}

// GET /api/questionarios/evento/:evento_id
async function obterQuestionarioPorEvento(req, res) {
  const rid = mkRid();
  try {
    const eventoId = toPositiveInt(req.params.evento_id);
    if (!eventoId) return res.status(400).json({ error: "evento_id inválido." });

    const qst = await query(
      `SELECT * FROM questionarios_evento WHERE evento_id = $1 LIMIT 1`,
      [eventoId]
    );
    if (!qst.rowCount) return res.status(404).json({ error: "Questionário não encontrado." });

    const questionario = qst.rows[0];
    const questoes = await carregarQuestoes(query, questionario.id);
    const alternativas = await carregarAlternativasPorQuestoes(
      query,
      questoes.map((r) => r.id)
    );

    logInfo(rid, "obterQuestionarioPorEvento OK", {
      eventoId,
      questionarioId: questionario.id,
      questoes: questoes.length,
    });

    return res.json({
      ...questionario,
      questoes: questoes.map((qq) => ({
        ...qq,
        alternativas: alternativas.filter((a) => a.questao_id === qq.id),
      })),
    });
  } catch (err) {
    logError(rid, "obterQuestionarioPorEvento", err);
    return res.status(500).json({ error: "Erro ao obter questionário." });
  }
}

// PUT /api/questionarios/:questionario_id
async function atualizarQuestionario(req, res) {
  const rid = mkRid();
  try {
    const questionarioId = toPositiveInt(req.params.questionario_id);
    if (!questionarioId) return res.status(400).json({ error: "questionario_id inválido." });

    const { titulo, descricao, obrigatorio, min_nota, tentativas_max, status } = req.body || {};

    const minNota = min_nota === "" || min_nota == null ? null : Number(min_nota);
    const tentMax = tentativas_max === "" || tentativas_max == null ? null : Number(tentativas_max);

    if (minNota != null && (!Number.isFinite(minNota) || minNota < 0 || minNota > 100)) {
      return res.status(400).json({ error: "min_nota inválida (0..100)." });
    }

    if (tentMax != null && (!Number.isFinite(tentMax) || tentMax < 1 || tentMax > 50)) {
      return res.status(400).json({ error: "tentativas_max inválido (1..50)." });
    }

    const upd = await query(
      `
      UPDATE questionarios_evento
      SET
        titulo = COALESCE($2, titulo),
        descricao = COALESCE($3, descricao),
        obrigatorio = COALESCE($4, obrigatorio),
        min_nota = $5,
        tentativas_max = $6,
        status = COALESCE($7, status),
        atualizado_em = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        questionarioId,
        titulo ?? null,
        descricao ?? null,
        typeof obrigatorio === "boolean" ? obrigatorio : null,
        minNota,
        tentMax,
        status ?? null,
      ]
    );

    if (!upd.rowCount) return res.status(404).json({ error: "Questionário não encontrado." });

    logInfo(rid, "atualizarQuestionario OK", { questionarioId });
    return res.json(upd.rows[0]);
  } catch (err) {
    logError(rid, "atualizarQuestionario", err);
    return res.status(500).json({ error: "Erro ao atualizar questionário." });
  }
}

// POST /api/questionarios/:questionario_id/questoes
async function adicionarQuestao(req, res) {
  const rid = mkRid();
  try {
    const questionarioId = toPositiveInt(req.params.questionario_id);
    const { tipo, enunciado, ordem, peso } = req.body || {};

    if (!questionarioId) return res.status(400).json({ error: "questionario_id inválido." });
    if (!tipo || !["multipla_escolha", "dissertativa"].includes(tipo)) {
      return res.status(400).json({ error: "tipo inválido." });
    }
    if (!safeText(enunciado).trim()) {
      return res.status(400).json({ error: "enunciado é obrigatório." });
    }

    const ord = Number.isFinite(Number(ordem)) ? Number(ordem) : 1;
    const ps = Number.isFinite(Number(peso)) ? Number(peso) : 1;

    if (ps <= 0 || ps > 100) {
      return res.status(400).json({ error: "peso inválido (1..100)." });
    }

    const ins = await query(
      `
      INSERT INTO questoes_questionario (questionario_id, tipo, enunciado, ordem, peso)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [questionarioId, tipo, safeText(enunciado).trim(), ord, ps]
    );

    logInfo(rid, "adicionarQuestao OK", { questionarioId, questaoId: ins.rows[0]?.id || null });
    return res.status(201).json(ins.rows[0]);
  } catch (err) {
    logError(rid, "adicionarQuestao", err);
    return res.status(500).json({ error: "Erro ao adicionar questão." });
  }
}

// PUT /api/questionarios/:questionario_id/questoes/:questao_id
async function atualizarQuestao(req, res) {
  const rid = mkRid();
  try {
    const questaoId = toPositiveInt(req.params.questao_id);
    const { enunciado, ordem, peso, tipo } = req.body || {};

    if (!questaoId) return res.status(400).json({ error: "questao_id inválido." });
    if (tipo && !["multipla_escolha", "dissertativa"].includes(tipo)) {
      return res.status(400).json({ error: "tipo inválido." });
    }

    const ord = Number.isFinite(Number(ordem)) ? Number(ordem) : null;
    const ps = Number.isFinite(Number(peso)) ? Number(peso) : null;

    if (ps != null && (ps <= 0 || ps > 100)) {
      return res.status(400).json({ error: "peso inválido (1..100)." });
    }

    const upd = await query(
      `
      UPDATE questoes_questionario
      SET
        enunciado = COALESCE($2, enunciado),
        ordem = COALESCE($3, ordem),
        peso = COALESCE($4, peso),
        tipo = COALESCE($5, tipo)
      WHERE id = $1
      RETURNING *
      `,
      [questaoId, safeText(enunciado).trim() || null, ord, ps, tipo ?? null]
    );

    if (!upd.rowCount) return res.status(404).json({ error: "Questão não encontrada." });

    logInfo(rid, "atualizarQuestao OK", { questaoId });
    return res.json(upd.rows[0]);
  } catch (err) {
    logError(rid, "atualizarQuestao", err);
    return res.status(500).json({ error: "Erro ao atualizar questão." });
  }
}

// DELETE /api/questionarios/:questionario_id/questoes/:questao_id
async function removerQuestao(req, res) {
  const rid = mkRid();
  try {
    const questaoId = toPositiveInt(req.params.questao_id);
    if (!questaoId) return res.status(400).json({ error: "questao_id inválido." });

    await query(`DELETE FROM questoes_questionario WHERE id = $1`, [questaoId]);

    logInfo(rid, "removerQuestao OK", { questaoId });
    return res.json({ ok: true });
  } catch (err) {
    logError(rid, "removerQuestao", err);
    return res.status(500).json({ error: "Erro ao remover questão." });
  }
}

// POST /api/questionarios/questoes/:questao_id/alternativas
async function adicionarAlternativa(req, res) {
  const rid = mkRid();
  try {
    const questaoId = toPositiveInt(req.params.questao_id);
    const { texto, correta, ordem } = req.body || {};

    if (!questaoId) return res.status(400).json({ error: "questao_id inválido." });
    if (!safeText(texto).trim()) return res.status(400).json({ error: "texto é obrigatório." });

    const ord = Number.isFinite(Number(ordem)) ? Number(ordem) : 1;

    const ins = await query(
      `
      INSERT INTO alternativas_questao (questao_id, texto, correta, ordem)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [questaoId, safeText(texto).trim(), typeof correta === "boolean" ? correta : false, ord]
    );

    logInfo(rid, "adicionarAlternativa OK", { questaoId, alternativaId: ins.rows[0]?.id || null });
    return res.status(201).json(ins.rows[0]);
  } catch (err) {
    logError(rid, "adicionarAlternativa", err);
    return res.status(500).json({ error: "Erro ao adicionar alternativa." });
  }
}

// PUT /api/questionarios/alternativas/:alt_id
async function atualizarAlternativa(req, res) {
  const rid = mkRid();
  try {
    const altId = toPositiveInt(req.params.alt_id);
    const { texto, correta, ordem } = req.body || {};

    if (!altId) return res.status(400).json({ error: "alt_id inválido." });

    const ord = Number.isFinite(Number(ordem)) ? Number(ordem) : null;

    const upd = await query(
      `
      UPDATE alternativas_questao
      SET
        texto = COALESCE($2, texto),
        correta = COALESCE($3, correta),
        ordem = COALESCE($4, ordem)
      WHERE id = $1
      RETURNING *
      `,
      [altId, safeText(texto).trim() || null, typeof correta === "boolean" ? correta : null, ord]
    );

    if (!upd.rowCount) return res.status(404).json({ error: "Alternativa não encontrada." });

    logInfo(rid, "atualizarAlternativa OK", { altId });
    return res.json(upd.rows[0]);
  } catch (err) {
    logError(rid, "atualizarAlternativa", err);
    return res.status(500).json({ error: "Erro ao atualizar alternativa." });
  }
}

// DELETE /api/questionarios/alternativas/:alt_id
async function removerAlternativa(req, res) {
  const rid = mkRid();
  try {
    const altId = toPositiveInt(req.params.alt_id);
    if (!altId) return res.status(400).json({ error: "alt_id inválido." });

    await query(`DELETE FROM alternativas_questao WHERE id = $1`, [altId]);

    logInfo(rid, "removerAlternativa OK", { altId });
    return res.json({ ok: true });
  } catch (err) {
    logError(rid, "removerAlternativa", err);
    return res.status(500).json({ error: "Erro ao remover alternativa." });
  }
}

/* =========================================================
   PUBLICAR: valida conteúdo + prazo
   ========================================================= */

// POST /api/questionarios/:questionario_id/publicar
async function publicarQuestionario(req, res) {
  const rid = mkRid();
  try {
    const questionarioId = toPositiveInt(req.params.questionario_id);
    if (!questionarioId) return res.status(400).json({ error: "questionario_id inválido." });

    const qst = await query(
      `SELECT id, evento_id, status FROM questionarios_evento WHERE id = $1 LIMIT 1`,
      [questionarioId]
    );

    if (!qst.rowCount) return res.status(404).json({ error: "Questionário não encontrado." });

    const eventoId = qst.rows[0].evento_id;

    const turmas = await query(
      `
      SELECT id, data_fim, horario_fim
      FROM turmas
      WHERE evento_id = $1
      ORDER BY data_fim ASC, COALESCE(horario_fim,'23:59') ASC, id ASC
      LIMIT 1
      `,
      [eventoId]
    );

    if (turmas.rowCount) {
      const fimPrimeira = `${String(turmas.rows[0].data_fim).slice(0, 10)} ${String(turmas.rows[0].horario_fim || "23:59").slice(0, 5)}`;
      const agora = nowSP_YMDHM();

      if (!isAdminLike(req.user) && agora > fimPrimeira) {
        return res.status(400).json({
          error:
            "Prazo expirado: o questionário deve ser publicado antes do encerramento da 1ª turma do evento.",
          agora,
          fimPrimeira,
        });
      }
    }

    const questoes = await query(
      `SELECT id, tipo, peso FROM questoes_questionario WHERE questionario_id = $1`,
      [questionarioId]
    );

    if (!questoes.rowCount) {
      return res.status(400).json({ error: "Não é possível publicar: adicione ao menos 1 questão." });
    }

    const soma = questoes.rows.reduce((acc, qx) => acc + Number(qx.peso || 0), 0);
    const somaArred = Math.round(soma * 100) / 100;

    if (somaArred !== 10) {
      return res.status(400).json({
        error: "Não é possível publicar: a soma dos pesos das questões deve fechar exatamente 10.",
        soma_pesos: somaArred,
      });
    }

    const mcqIds = questoes.rows
      .filter((r) => r.tipo === "multipla_escolha")
      .map((r) => r.id);

    if (mcqIds.length) {
      const alt = await query(
        `
        SELECT
          questao_id,
          COUNT(*)::int AS total,
          SUM(CASE WHEN correta THEN 1 ELSE 0 END)::int AS corretas
        FROM alternativas_questao
        WHERE questao_id = ANY($1::int[])
        GROUP BY questao_id
        `,
        [mcqIds]
      );

      const mapa = new Map(alt.rows.map((r) => [Number(r.questao_id), r]));

      for (const qid of mcqIds) {
        const row = mapa.get(Number(qid));
        const total = Number(row?.total || 0);
        const corretas = Number(row?.corretas || 0);

        if (total < 2) {
          return res.status(400).json({
            error: `Questão ${qid}: múltipla escolha precisa de pelo menos 2 alternativas.`,
          });
        }

        if (corretas !== 1) {
          return res.status(400).json({
            error: `Questão ${qid}: deve existir exatamente 1 alternativa correta.`,
          });
        }
      }
    }

    const upd = await query(
      `
      UPDATE questionarios_evento
      SET status = 'publicado', atualizado_em = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [questionarioId]
    );

    logInfo(rid, "publicarQuestionario OK", { questionarioId, eventoId });
    return res.json(upd.rows[0]);
  } catch (err) {
    logError(rid, "publicarQuestionario", err);
    return res.status(500).json({ error: "Erro ao publicar questionário." });
  }
}

/* =========================================================
   2) ALUNO: DISPONÍVEIS / RESPONDER / ENVIAR
   ========================================================= */

// GET /api/questionarios/disponiveis/usuario/:usuario_id
async function listarDisponiveisParaUsuario(req, res) {
  const rid = mkRid();
  try {
    const usuarioId = toPositiveInt(req.params.usuario_id);
    if (!usuarioId) return res.status(400).json({ error: "usuario_id inválido." });

    const authUserId = toPositiveInt(req.user?.id);
    if (!isAdminLike(req.user) && authUserId !== usuarioId) {
      return res.status(403).json({ error: "Sem permissão para consultar este usuário." });
    }

    const inscrTable = await resolveInscricaoTable(query);

    const base = await query(
      `
      SELECT
        t.id AS turma_id,
        t.nome AS turma_nome,
        to_char(t.data_inicio::date,'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date,'YYYY-MM-DD') AS data_fim,
        to_char(COALESCE(t.horario_inicio::time,'00:00'::time),'HH24:MI') AS horario_inicio,
        to_char(COALESCE(t.horario_fim::time,'23:59'::time),'HH24:MI') AS horario_fim,
        e.id AS evento_id,
        e.titulo AS evento_titulo,
        q.id AS questionario_id,
        q.titulo AS questionario_titulo,
        q.min_nota,
        q.tentativas_max,
        q.obrigatorio,
        q.status
      FROM ${inscrTable} i
      JOIN turmas t ON t.id = i.turma_id
      JOIN eventos e ON e.id = t.evento_id
      JOIN questionarios_evento q ON q.evento_id = e.id
      WHERE i.usuario_id = $1
        AND q.status = 'publicado'
        AND q.obrigatorio = TRUE
      ORDER BY t.data_fim DESC, t.horario_fim DESC, t.id DESC
      `,
      [usuarioId]
    );

    const out = [];
    for (const row of base.rows || []) {
      const elig = await checarElegibilidadeAluno(query, { usuarioId, turmaId: row.turma_id });
      if (!elig.ok) continue;

      const tent = await query(
        `
        SELECT
          COUNT(*) FILTER (WHERE status = 'enviada')::int AS enviadas,
          MAX(id)::int AS ultima_id,
          MAX(nota)::numeric AS ultima_nota
        FROM tentativas_questionario
        WHERE questionario_id = $1
          AND usuario_id = $2
          AND turma_id = $3
        `,
        [row.questionario_id, usuarioId, row.turma_id]
      );

      const enviadas = Number(tent.rows?.[0]?.enviadas || 0);
      const tentMax = row.tentativas_max == null ? null : Number(row.tentativas_max);

      out.push({
        ...row,
        elegivel: true,
        frequencia: Math.round((elig.freq || 0) * 1000) / 10,
        presentes: elig.presentes,
        total_encontros: elig.total,
        fim_real: elig.fimReal,
        tentativas_enviadas: enviadas,
        bloqueado_por_tentativas: tentMax != null ? enviadas >= tentMax : false,
        ultima_tentativa_id: tent.rows?.[0]?.ultima_id ?? null,
        ultima_nota: tent.rows?.[0]?.ultima_nota ?? null,
      });
    }

    logInfo(rid, "listarDisponiveisParaUsuario OK", { usuarioId, total: out.length });
    return res.json(out);
  } catch (err) {
    logError(rid, "listarDisponiveisParaUsuario", err);
    return res.status(500).json({ error: "Erro ao listar questionários disponíveis." });
  }
}

// GET /api/questionarios/:questionario_id/responder/turma/:turma_id
async function obterQuestionarioParaResponder(req, res) {
  const rid = mkRid();
  try {
    const questionarioId = toPositiveInt(req.params.questionario_id);
    const turmaId = toPositiveInt(req.params.turma_id);
    const usuarioId = toPositiveInt(req.user?.id);

    if (!questionarioId || !turmaId || !usuarioId) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    const ctx = await getQuestionarioTurmaContext(query, questionarioId, turmaId);
    if (!ctx) {
      return res.status(404).json({ error: "Questionário não pertence a esta turma." });
    }

    if (!isAdminLike(req.user)) {
      const inscrito = await ensureInscrito(query, usuarioId, turmaId);
      if (!inscrito) return res.status(403).json({ error: "Você não está inscrito nesta turma." });

      const elig = await checarElegibilidadeAluno(query, { usuarioId, turmaId });
      if (!elig.ok) {
        return res.status(409).json({
          error: "Questionário indisponível para esta turma.",
          motivo: elig.motivo,
        });
      }
    }

    const qst = await query(
      `SELECT * FROM questionarios_evento WHERE id = $1 LIMIT 1`,
      [questionarioId]
    );
    if (!qst.rowCount) return res.status(404).json({ error: "Questionário não encontrado." });

    if (String(qst.rows[0].status) !== "publicado" && !isAdminLike(req.user)) {
      return res.status(409).json({ error: "Questionário ainda não foi publicado." });
    }

    const questoes = await carregarQuestoes(query, questionarioId);
    const alternativas = await carregarAlternativasPorQuestoes(
      query,
      questoes.map((r) => r.id)
    );

    const questoesMix = shuffle(questoes);

    logInfo(rid, "obterQuestionarioParaResponder OK", {
      questionarioId,
      turmaId,
      questoes: questoesMix.length,
    });

    return res.json({
      id: qst.rows[0].id,
      titulo: qst.rows[0].titulo,
      descricao: qst.rows[0].descricao,
      min_nota: qst.rows[0].min_nota,
      tentativas_max: qst.rows[0].tentativas_max,
      turma_id: turmaId,
      questoes: questoesMix.map((qq) => {
        const alts =
          qq.tipo === "multipla_escolha"
            ? shuffle(alternativas.filter((a) => a.questao_id === qq.id))
            : [];

        return {
          id: qq.id,
          tipo: qq.tipo,
          enunciado: qq.enunciado,
          ordem: qq.ordem,
          peso: qq.peso,
          alternativas: alts.map((a) => ({
            id: a.id,
            questao_id: a.questao_id,
            texto: a.texto,
            ordem: a.ordem,
          })),
        };
      }),
    });
  } catch (err) {
    logError(rid, "obterQuestionarioParaResponder", err);
    return res.status(500).json({ error: "Erro ao obter questionário." });
  }
}

// POST /api/questionarios/:questionario_id/iniciar/turma/:turma_id
async function iniciarTentativa(req, res) {
  const rid = mkRid();
  try {
    const questionarioId = toPositiveInt(req.params.questionario_id);
    const turmaId = toPositiveInt(req.params.turma_id);
    const usuarioId = toPositiveInt(req.user?.id);

    if (!questionarioId || !turmaId || !usuarioId) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    const ctx = await getQuestionarioTurmaContext(query, questionarioId, turmaId);
    if (!ctx) return res.status(404).json({ error: "Questionário não pertence a esta turma." });

    if (!isAdminLike(req.user)) {
      const inscrito = await ensureInscrito(query, usuarioId, turmaId);
      if (!inscrito) return res.status(403).json({ error: "Você não está inscrito nesta turma." });

      const elig = await checarElegibilidadeAluno(query, { usuarioId, turmaId });
      if (!elig.ok) {
        return res.status(409).json({ error: "Você ainda não está elegível.", motivo: elig.motivo });
      }
    }

    if (String(ctx.status) !== "publicado" && !isAdminLike(req.user)) {
      return res.status(409).json({ error: "Questionário ainda não foi publicado." });
    }

    const tentMax = ctx.tentativas_max == null ? null : Number(ctx.tentativas_max);

    const last = await query(
      `
      SELECT *
      FROM tentativas_questionario
      WHERE questionario_id = $1
        AND usuario_id = $2
        AND turma_id = $3
      ORDER BY id DESC
      LIMIT 1
      `,
      [questionarioId, usuarioId, turmaId]
    );

    if (last.rowCount && ["iniciada", "enviada"].includes(last.rows[0].status)) {
      if (last.rows[0].status === "iniciada") {
        logInfo(rid, "iniciarTentativa idempotente", {
          questionarioId,
          turmaId,
          usuarioId,
          tentativaId: last.rows[0].id,
        });
        return res.json(last.rows[0]);
      }
    }

    if (tentMax != null) {
      const cnt = await query(
        `
        SELECT COUNT(*)::int AS enviadas
        FROM tentativas_questionario
        WHERE questionario_id = $1
          AND usuario_id = $2
          AND turma_id = $3
          AND status = 'enviada'
        `,
        [questionarioId, usuarioId, turmaId]
      );

      const enviadas = Number(cnt.rows?.[0]?.enviadas || 0);
      if (enviadas >= tentMax) {
        return res.status(409).json({
          error: "Limite de tentativas atingido.",
          tentativas_max: tentMax,
        });
      }
    }

    const ins = await query(
      `
      INSERT INTO tentativas_questionario (questionario_id, usuario_id, turma_id, status, iniciado_em)
      VALUES ($1, $2, $3, 'iniciada', NOW())
      RETURNING *
      `,
      [questionarioId, usuarioId, turmaId]
    );

    logInfo(rid, "iniciarTentativa OK", {
      questionarioId,
      turmaId,
      usuarioId,
      tentativaId: ins.rows[0]?.id || null,
    });

    return res.status(201).json(ins.rows[0]);
  } catch (err) {
    logError(rid, "iniciarTentativa", err);
    return res.status(500).json({ error: "Erro ao iniciar tentativa." });
  }
}

// POST /api/questionarios/:questionario_id/enviar/turma/:turma_id
// body: { respostas: [{ questao_id, alternativa_id?, resposta_texto? }, ...] }
async function enviarTentativa(req, res) {
  const rid = mkRid();
  try {
    const questionarioId = toPositiveInt(req.params.questionario_id);
    const turmaId = toPositiveInt(req.params.turma_id);
    const usuarioId = toPositiveInt(req.user?.id);
    const respostas = Array.isArray(req.body?.respostas) ? req.body.respostas : [];

    if (!questionarioId || !turmaId || !usuarioId) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    const ctx = await getQuestionarioTurmaContext(query, questionarioId, turmaId);
    if (!ctx) return res.status(404).json({ error: "Questionário não pertence a esta turma." });

    if (!isAdminLike(req.user)) {
      const inscrito = await ensureInscrito(query, usuarioId, turmaId);
      if (!inscrito) return res.status(403).json({ error: "Você não está inscrito nesta turma." });

      const elig = await checarElegibilidadeAluno(query, { usuarioId, turmaId });
      if (!elig.ok) {
        return res.status(409).json({ error: "Você ainda não está elegível.", motivo: elig.motivo });
      }
    }

    const result = await withTx(async ({ query: q }) => {
      const tent = await q(
        `
        SELECT *
        FROM tentativas_questionario
        WHERE questionario_id = $1
          AND usuario_id = $2
          AND turma_id = $3
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
        `,
        [questionarioId, usuarioId, turmaId]
      );

      if (!tent.rowCount) {
        return { http: 400, body: { error: "Nenhuma tentativa iniciada." } };
      }

      if (tent.rows[0].status === "enviada") {
        return { http: 200, body: { ...tent.rows[0], ja_enviada: true } };
      }

      const qq = await q(
        `SELECT id, evento_id, min_nota, tentativas_max, status FROM questionarios_evento WHERE id = $1 LIMIT 1`,
        [questionarioId]
      );

      if (!qq.rowCount) return { http: 404, body: { error: "Questionário não encontrado." } };

      if (String(qq.rows[0].status) !== "publicado" && !isAdminLike(req.user)) {
        return { http: 409, body: { error: "Questionário ainda não foi publicado." } };
      }

      const tentMax = qq.rows[0].tentativas_max == null ? null : Number(qq.rows[0].tentativas_max);
      if (tentMax != null) {
        const cnt = await q(
          `
          SELECT COUNT(*)::int AS enviadas
          FROM tentativas_questionario
          WHERE questionario_id = $1
            AND usuario_id = $2
            AND turma_id = $3
            AND status = 'enviada'
          `,
          [questionarioId, usuarioId, turmaId]
        );

        const enviadas = Number(cnt.rows?.[0]?.enviadas || 0);
        if (enviadas >= tentMax) {
          return {
            http: 409,
            body: { error: "Limite de tentativas atingido.", tentativas_max: tentMax },
          };
        }
      }

      const tentativaId = tent.rows[0].id;

      const questoes = await q(
        `SELECT id, tipo, peso FROM questoes_questionario WHERE questionario_id = $1`,
        [questionarioId]
      );
      const questRows = questoes.rows || [];
      const questMap = new Map(questRows.map((item) => [Number(item.id), item]));

      const mcqIds = questRows
        .filter((item) => item.tipo === "multipla_escolha")
        .map((item) => item.id);

      let altCorretas = [];
      if (mcqIds.length) {
        const alt = await q(
          `
          SELECT id, questao_id, correta
          FROM alternativas_questao
          WHERE questao_id = ANY($1::int[])
          `,
          [mcqIds]
        );
        altCorretas = alt.rows || [];
      }

      const altMap = new Map(
        altCorretas.map((a) => [
          Number(a.id),
          {
            questao_id: Number(a.questao_id),
            correta: !!a.correta,
          },
        ])
      );

      const respostasValidas = [];
      for (const r of respostas) {
        const qid = toPositiveInt(r?.questao_id);
        if (!qid) continue;

        const questao = questMap.get(qid);
        if (!questao) continue;

        if (questao.tipo === "multipla_escolha") {
          const altId = toPositiveInt(r?.alternativa_id);
          if (!altId) continue;

          const info = altMap.get(altId);
          if (!info || info.questao_id !== qid) continue;

          respostasValidas.push({
            qid,
            altId,
            texto: null,
          });
        } else {
          const texto = r?.resposta_texto != null ? String(r.resposta_texto) : "";
          respostasValidas.push({
            qid,
            altId: null,
            texto: texto.trim() || null,
          });
        }
      }

      await q(`DELETE FROM respostas_questionario WHERE tentativa_id = $1`, [tentativaId]);

      let totalPesoMCQ = 0;
      let totalPontos = 0;

      for (const r of respostasValidas) {
        const questao = questMap.get(r.qid);
        const peso = Number(questao?.peso || 1);

        let correta = null;
        let pontuacao = null;

        if (questao.tipo === "multipla_escolha") {
          totalPesoMCQ += peso;

          const info = altMap.get(r.altId);
          const ok = !!(info && info.questao_id === r.qid && info.correta === true);

          correta = ok;
          pontuacao = ok ? peso : 0;
          totalPontos += pontuacao;
        }

        await q(
          `
          INSERT INTO respostas_questionario (tentativa_id, questao_id, alternativa_id, resposta_texto, correta, pontuacao)
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [tentativaId, r.qid, r.altId, r.texto, correta, pontuacao]
        );
      }

      let nota = null;
      if (mcqIds.length > 0 && totalPesoMCQ > 0) {
        nota = Math.round((totalPontos / totalPesoMCQ) * 10000) / 100;
      }

      const upd = await q(
        `
        UPDATE tentativas_questionario
        SET status = 'enviada', nota = $2, enviado_em = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [tentativaId, nota]
      );

      const minNota = qq.rows[0].min_nota == null ? null : Number(qq.rows[0].min_nota);
      const aprovado = minNota != null && nota != null ? nota >= minNota : null;

      return {
        http: 200,
        body: {
          ...upd.rows[0],
          aprovado,
          min_nota: minNota,
          resumo: {
            total_peso_mcq: totalPesoMCQ,
            total_pontos: totalPontos,
            respostas_recebidas: respostasValidas.length,
          },
        },
      };
    });

    if (result?.http === 200 && result?.body?.aprovado === true) {
      try {
        await gerarNotificacaoDeAvaliacao(usuarioId, {
          turma_id: turmaId,
          evento_id: ctx.evento_id,
        });

        logInfo(rid, "notificação de avaliação disparada após aprovação no questionário", {
          usuarioId,
          turmaId,
          eventoId: ctx.evento_id,
          questionarioId,
          tentativaId: result?.body?.id || null,
        });
      } catch (e) {
        logWarn(rid, "falha ao disparar notificação de avaliação pós-questionário", {
          message: e?.message || String(e),
        });
      }
    }

    logInfo(rid, "enviarTentativa OK", {
      questionarioId,
      turmaId,
      usuarioId,
      aprovado: result?.body?.aprovado ?? null,
      nota: result?.body?.nota ?? null,
    });

    return res.status(result.http).json(result.body);
  } catch (err) {
    logError(rid, "enviarTentativa", err);
    return res.status(500).json({ error: "Erro ao enviar tentativa." });
  }
}

// GET /api/questionarios/:questionario_id/minha-tentativa/turma/:turma_id
async function obterMinhaTentativaPorTurma(req, res) {
  const rid = mkRid();
  try {
    const questionarioId = toPositiveInt(req.params.questionario_id);
    const turmaId = toPositiveInt(req.params.turma_id);
    const usuarioId = toPositiveInt(req.user?.id);

    if (!questionarioId || !turmaId || !usuarioId) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    const ctx = await getQuestionarioTurmaContext(query, questionarioId, turmaId);
    if (!ctx) return res.status(404).json({ error: "Questionário não pertence a esta turma." });

    if (!isAdminLike(req.user)) {
      const inscrito = await ensureInscrito(query, usuarioId, turmaId);
      if (!inscrito) return res.status(403).json({ error: "Você não está inscrito nesta turma." });
    }

    const last = await query(
      `
      SELECT *
      FROM tentativas_questionario
      WHERE questionario_id = $1
        AND usuario_id = $2
        AND turma_id = $3
      ORDER BY id DESC
      LIMIT 1
      `,
      [questionarioId, usuarioId, turmaId]
    );

    if (!last.rowCount) return res.status(404).json({ error: "Sem tentativa." });

    logInfo(rid, "obterMinhaTentativaPorTurma OK", {
      questionarioId,
      turmaId,
      usuarioId,
      tentativaId: last.rows[0]?.id || null,
    });

    return res.json(last.rows[0]);
  } catch (err) {
    logError(rid, "obterMinhaTentativaPorTurma", err);
    return res.status(500).json({ error: "Erro ao obter tentativa." });
  }
}

module.exports = {
  criarOuObterRascunhoPorEvento,
  obterQuestionarioPorEvento,
  atualizarQuestionario,
  adicionarQuestao,
  atualizarQuestao,
  removerQuestao,
  adicionarAlternativa,
  atualizarAlternativa,
  removerAlternativa,
  publicarQuestionario,

  listarDisponiveisParaUsuario,
  obterQuestionarioParaResponder,
  iniciarTentativa,
  enviarTentativa,
  obterMinhaTentativaPorTurma,
};