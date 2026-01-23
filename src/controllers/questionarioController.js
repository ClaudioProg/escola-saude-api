// ✅ src/controllers/questionarioController.js — PREMIUM (seguro, idempotente, anti-fuso, com regras reais)
/* eslint-disable no-console */
const db = require("../db");

// compat: alguns módulos exportam { query }, outros { db }, outros função query direto
const query =
  typeof db?.query === "function"
    ? db.query.bind(db)
    : typeof db?.default?.query === "function"
      ? db.default.query.bind(db.default)
      : typeof db === "function"
        ? db
        : db?.db?.query?.bind(db.db);

// transação helpers (pg: BEGIN/COMMIT/ROLLBACK)
async function withTx(fn) {
  await query("BEGIN");
  try {
    const out = await fn();
    await query("COMMIT");
    return out;
  } catch (e) {
    await query("ROLLBACK");
    throw e;
  }
}

/* =========================================================
   Helpers premium (sem “pulo” de fuso / datas-only)
   ========================================================= */
const TZ = "America/Sao_Paulo";

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
    .reduce((o, p) => ((o[p.type] = p.value), o), {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizePerfis(user) {
  const perf = user?.perfil ?? user?.perfis ?? [];
  const arr = Array.isArray(perf)
    ? perf.map(String)
    : String(perf)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  return Array.from(new Set(arr));
}

function isAdminLike(user) {
  const perfis = normalizePerfis(user);
  return perfis.includes("administrador");
}

/** fim real da turma (datas_turma > turmas), em string "YYYY-MM-DD HH:MM" (SP) */
async function fimRealTurmaStr(turmaId) {
  const q = await query(
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

  return q.rows?.[0]?.fim_real || null;
}

/** total de encontros reais (datas_turma > fallback generate_series) */
async function totalEncontrosTurma(turmaId) {
  const q = await query(
    `
    WITH dts AS (
      SELECT COUNT(*)::int AS n
      FROM datas_turma
      WHERE turma_id = $1
    ),
    fallback AS (
      SELECT COUNT(*)::int AS n
      FROM turmas t
      CROSS JOIN LATERAL generate_series(t.data_inicio::date, t.data_fim::date, interval '1 day') gs
      WHERE t.id = $1
    )
    SELECT
      CASE WHEN (SELECT n FROM dts) > 0 THEN (SELECT n FROM dts)
           ELSE (SELECT n FROM fallback)
      END AS total;
    `,
    [Number(turmaId)]
  );
  return Number(q.rows?.[0]?.total || 0);
}

/** presentes do usuário (dias distintos com presente=TRUE) */
async function presentesUsuarioTurma(usuarioId, turmaId) {
  const q = await query(
    `
    SELECT COUNT(DISTINCT data_presenca::date)::int AS presentes
    FROM presencas
    WHERE turma_id = $1 AND usuario_id = $2 AND presente = TRUE;
    `,
    [Number(turmaId), Number(usuarioId)]
  );
  return Number(q.rows?.[0]?.presentes || 0);
}

/** confere se usuário está inscrito na turma */
async function ensureInscrito(usuarioId, turmaId) {
  const q = await query(
    `SELECT 1 FROM inscricoes WHERE usuario_id = $1 AND turma_id = $2 LIMIT 1`,
    [Number(usuarioId), Number(turmaId)]
  );
  return q.rowCount > 0;
}

/** confere se questionário pertence ao evento da turma */
async function ensureQuestionarioDaTurma(questionarioId, turmaId) {
  const q = await query(
    `
    SELECT 1
    FROM questionarios_evento q
    JOIN turmas t ON t.evento_id = q.evento_id
    WHERE q.id = $1 AND t.id = $2
    LIMIT 1
    `,
    [Number(questionarioId), Number(turmaId)]
  );
  return q.rowCount > 0;
}

/** checa elegibilidade real (turma encerrada + presença >= 75%) */
async function checarElegibilidadeAluno({ usuarioId, turmaId, allowAdminOverride = false }) {
  const fimReal = await fimRealTurmaStr(turmaId);
  if (!fimReal) return { ok: false, motivo: "TURMA_INVALIDA" };

  const agora = nowSP_YMDHM();
  if (agora < fimReal) {
    return { ok: false, motivo: "TURMA_NAO_ENCERRADA", agora, fimReal };
  }

  const total = await totalEncontrosTurma(turmaId);
  if (total <= 0) return { ok: false, motivo: "TURMA_SEM_DATAS" };

  const presentes = await presentesUsuarioTurma(usuarioId, turmaId);
  const freq = presentes / total;

  if (freq < 0.75) {
    return { ok: false, motivo: "FREQUENCIA_INSUFICIENTE", presentes, total, freq };
  }

  return { ok: true, presentes, total, freq, agora, fimReal };
}

/* =========================================================
   1) INSTRUTOR/ADMIN: CRIAR/EDITAR
   ========================================================= */

// POST /api/questionarios/evento/:evento_id/rascunho
async function criarOuObterRascunhoPorEvento(req, res) {
  try {
    const eventoId = toInt(req.params.evento_id);
    const userId = toInt(req.user?.id);
    if (!eventoId) return res.status(400).json({ error: "evento_id inválido." });

    // idempotente
    const existe = await query(
      `SELECT * FROM questionarios_evento WHERE evento_id = $1 LIMIT 1`,
      [eventoId]
    );
    if (existe.rowCount) return res.json(existe.rows[0]);

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

    return res.status(201).json(created.rows[0]);
  } catch (err) {
    console.error("[questionarios] criarOuObterRascunhoPorEvento", err?.message || err);
    return res.status(500).json({ error: "Erro ao criar/obter rascunho." });
  }
}

// GET /api/questionarios/evento/:evento_id
async function obterQuestionarioPorEvento(req, res) {
  try {
    const eventoId = toInt(req.params.evento_id);
    if (!eventoId) return res.status(400).json({ error: "evento_id inválido." });

    const q = await query(
      `SELECT * FROM questionarios_evento WHERE evento_id = $1 LIMIT 1`,
      [eventoId]
    );
    if (!q.rowCount) return res.status(404).json({ error: "Questionário não encontrado." });

    const questionarioId = q.rows[0].id;

    const questoes = await query(
      `
      SELECT * FROM questoes_questionario
      WHERE questionario_id = $1
      ORDER BY ordem ASC, id ASC
      `,
      [questionarioId]
    );

    const questoesIds = questoes.rows.map((r) => r.id);
    let alternativas = [];
    if (questoesIds.length) {
      const alt = await query(
        `
        SELECT * FROM alternativas_questao
        WHERE questao_id = ANY($1::int[])
        ORDER BY questao_id ASC, ordem ASC, id ASC
        `,
        [questoesIds]
      );
      alternativas = alt.rows;
    }

    return res.json({
      ...q.rows[0],
      questoes: questoes.rows.map((qq) => ({
        ...qq,
        alternativas: alternativas.filter((a) => a.questao_id === qq.id),
      })),
    });
  } catch (err) {
    console.error("[questionarios] obterQuestionarioPorEvento", err?.message || err);
    return res.status(500).json({ error: "Erro ao obter questionário." });
  }
}

// PUT /api/questionarios/:questionario_id
async function atualizarQuestionario(req, res) {
  try {
    const questionarioId = toInt(req.params.questionario_id);
    if (!questionarioId) return res.status(400).json({ error: "questionario_id inválido." });

    const { titulo, descricao, obrigatorio, min_nota, tentativas_max, status } = req.body || {};

    // hardening leve
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
    return res.json(upd.rows[0]);
  } catch (err) {
    console.error("[questionarios] atualizarQuestionario", err?.message || err);
    return res.status(500).json({ error: "Erro ao atualizar questionário." });
  }
}

// POST /api/questionarios/:questionario_id/questoes
async function adicionarQuestao(req, res) {
  try {
    const questionarioId = toInt(req.params.questionario_id);
    const { tipo, enunciado, ordem, peso } = req.body || {};

    if (!questionarioId) return res.status(400).json({ error: "questionario_id inválido." });
    if (!tipo || !["multipla_escolha", "dissertativa"].includes(tipo)) {
      return res.status(400).json({ error: "tipo inválido." });
    }
    if (!enunciado?.trim()) return res.status(400).json({ error: "enunciado é obrigatório." });

    const ord = Number.isFinite(Number(ordem)) ? Number(ordem) : 1;
    const ps = Number.isFinite(Number(peso)) ? Number(peso) : 1;
    if (ps <= 0 || ps > 100) return res.status(400).json({ error: "peso inválido (1..100)." });

    const ins = await query(
      `
      INSERT INTO questoes_questionario (questionario_id, tipo, enunciado, ordem, peso)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [questionarioId, tipo, enunciado.trim(), ord, ps]
    );

    return res.status(201).json(ins.rows[0]);
  } catch (err) {
    console.error("[questionarios] adicionarQuestao", err?.message || err);
    return res.status(500).json({ error: "Erro ao adicionar questão." });
  }
}

// PUT /api/questionarios/:questionario_id/questoes/:questao_id
async function atualizarQuestao(req, res) {
  try {
    const questaoId = toInt(req.params.questao_id);
    const { enunciado, ordem, peso, tipo } = req.body || {};

    if (!questaoId) return res.status(400).json({ error: "questao_id inválido." });
    if (tipo && !["multipla_escolha", "dissertativa"].includes(tipo)) {
      return res.status(400).json({ error: "tipo inválido." });
    }

    const ord = Number.isFinite(Number(ordem)) ? Number(ordem) : null;
    const ps = Number.isFinite(Number(peso)) ? Number(peso) : null;
    if (ps != null && (ps <= 0 || ps > 100)) return res.status(400).json({ error: "peso inválido (1..100)." });

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
      [questaoId, enunciado?.trim() ? enunciado.trim() : null, ord, ps, tipo ?? null]
    );

    if (!upd.rowCount) return res.status(404).json({ error: "Questão não encontrada." });
    return res.json(upd.rows[0]);
  } catch (err) {
    console.error("[questionarios] atualizarQuestao", err?.message || err);
    return res.status(500).json({ error: "Erro ao atualizar questão." });
  }
}

// DELETE /api/questionarios/:questionario_id/questoes/:questao_id
async function removerQuestao(req, res) {
  try {
    const questaoId = toInt(req.params.questao_id);
    if (!questaoId) return res.status(400).json({ error: "questao_id inválido." });

    await query(`DELETE FROM questoes_questionario WHERE id = $1`, [questaoId]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[questionarios] removerQuestao", err?.message || err);
    return res.status(500).json({ error: "Erro ao remover questão." });
  }
}

// POST /api/questionarios/questoes/:questao_id/alternativas
async function adicionarAlternativa(req, res) {
  try {
    const questaoId = toInt(req.params.questao_id);
    const { texto, correta, ordem } = req.body || {};

    if (!questaoId) return res.status(400).json({ error: "questao_id inválido." });
    if (!texto?.trim()) return res.status(400).json({ error: "texto é obrigatório." });

    const ord = Number.isFinite(Number(ordem)) ? Number(ordem) : 1;

    const ins = await query(
      `
      INSERT INTO alternativas_questao (questao_id, texto, correta, ordem)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [questaoId, texto.trim(), typeof correta === "boolean" ? correta : false, ord]
    );

    return res.status(201).json(ins.rows[0]);
  } catch (err) {
    console.error("[questionarios] adicionarAlternativa", err?.message || err);
    return res.status(500).json({ error: "Erro ao adicionar alternativa." });
  }
}

// PUT /api/questionarios/alternativas/:alt_id
async function atualizarAlternativa(req, res) {
  try {
    const altId = toInt(req.params.alt_id);
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
      [altId, texto?.trim() ? texto.trim() : null, typeof correta === "boolean" ? correta : null, ord]
    );

    if (!upd.rowCount) return res.status(404).json({ error: "Alternativa não encontrada." });
    return res.json(upd.rows[0]);
  } catch (err) {
    console.error("[questionarios] atualizarAlternativa", err?.message || err);
    return res.status(500).json({ error: "Erro ao atualizar alternativa." });
  }
}

// DELETE /api/questionarios/alternativas/:alt_id
async function removerAlternativa(req, res) {
  try {
    const altId = toInt(req.params.alt_id);
    if (!altId) return res.status(400).json({ error: "alt_id inválido." });

    await query(`DELETE FROM alternativas_questao WHERE id = $1`, [altId]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[questionarios] removerAlternativa", err?.message || err);
    return res.status(500).json({ error: "Erro ao remover alternativa." });
  }
}

/* =========================================================
   PUBLICAR: valida conteúdo + regra "antes da 1ª turma finalizar"
   ========================================================= */

// POST /api/questionarios/:questionario_id/publicar
async function publicarQuestionario(req, res) {
  try {
    const questionarioId = toInt(req.params.questionario_id);
    if (!questionarioId) return res.status(400).json({ error: "questionario_id inválido." });

    const q = await query(
      `SELECT id, evento_id, status FROM questionarios_evento WHERE id = $1 LIMIT 1`,
      [questionarioId]
    );
    if (!q.rowCount) return res.status(404).json({ error: "Questionário não encontrado." });

    const eventoId = q.rows[0].evento_id;

    // regra do prazo: antes de encerrar a 1ª turma do evento (admin pode publicar mesmo após)
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

    // valida: tem questões
    const questoes = await query(
      `SELECT id, tipo, peso FROM questoes_questionario WHERE questionario_id = $1`,
      [questionarioId]
    );
    if (!questoes.rowCount) {
      return res.status(400).json({ error: "Não é possível publicar: adicione ao menos 1 questão." });
    }
    
    // ✅ (NOVO) — pesos precisam fechar 10
    const soma = questoes.rows.reduce((acc, qx) => acc + Number(qx.peso || 0), 0);
    const somaArred = Math.round(soma * 100) / 100;
    if (somaArred !== 10) {
      return res.status(400).json({
        error: "Não é possível publicar: a soma dos pesos das questões deve fechar exatamente 10.",
        soma_pesos: somaArred,
      });
    }

    // valida MCQ: cada questão MCQ tem >=2 alternativas e exatamente 1 correta
    const mcqIds = questoes.rows.filter((r) => r.tipo === "multipla_escolha").map((r) => r.id);
    if (mcqIds.length) {
      const alt = await query(
        `
        SELECT questao_id,
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

    return res.json(upd.rows[0]);
  } catch (err) {
    console.error("[questionarios] publicarQuestionario", err?.message || err);
    return res.status(500).json({ error: "Erro ao publicar questionário." });
  }
}

/* =========================================================
   2) ALUNO: DISPONÍVEIS / RESPONDER / ENVIAR (com regras reais)
   ========================================================= */

// GET /api/questionarios/disponiveis/usuario/:usuario_id
async function listarDisponiveisParaUsuario(req, res) {
  try {
    const usuarioId = toInt(req.params.usuario_id);
    if (!usuarioId) return res.status(400).json({ error: "usuario_id inválido." });

    // segurança: aluno só pode ver o próprio / admin pode ver qualquer
    const authUserId = toInt(req.user?.id);
    if (!isAdminLike(req.user) && authUserId !== usuarioId) {
      return res.status(403).json({ error: "Sem permissão para consultar este usuário." });
    }

    // traz candidatas (inscrição + questionário publicado e obrigatório)
    const base = await query(
      `
      SELECT
        t.id AS turma_id,
        t.nome AS turma_nome,
        to_char(t.data_inicio::date,'YYYY-MM-DD') AS data_inicio,
        to_char(t.data_fim::date,'YYYY-MM-DD') AS data_fim,
        to_char(COALESCE(t.horario_inicio::time,'00:00'::time),'HH24:MI') AS horario_inicio,
        to_char(COALESCE(t.horario_fim::time,'23:59'::time),'HH24:MI')   AS horario_fim,
        e.id AS evento_id,
        e.titulo AS evento_titulo,
        q.id AS questionario_id,
        q.titulo AS questionario_titulo,
        q.min_nota,
        q.tentativas_max,
        q.obrigatorio,
        q.status
      FROM inscricoes i
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

    // filtra elegíveis: turma encerrada + freq >= 75%
    const out = [];
    for (const r of base.rows) {
      const elig = await checarElegibilidadeAluno({ usuarioId, turmaId: r.turma_id });
      if (!elig.ok) continue;

      // tenta contar tentativas já enviadas e bloquear se excedeu
      const tent = await query(
        `
        SELECT
          COUNT(*) FILTER (WHERE status='enviada')::int AS enviadas,
          MAX(id)::int AS ultima_id,
          MAX(nota)::numeric AS ultima_nota
        FROM tentativas_questionario
        WHERE questionario_id = $1 AND usuario_id = $2 AND turma_id = $3
        `,
        [r.questionario_id, usuarioId, r.turma_id]
      );
      const enviadas = Number(tent.rows?.[0]?.enviadas || 0);
      const tentMax = r.tentativas_max == null ? null : Number(r.tentativas_max);

      out.push({
        ...r,
        elegivel: true,
        frequencia: Math.round((elig.freq || 0) * 1000) / 10, // 1 casa
        presentes: elig.presentes,
        total_encontros: elig.total,
        fim_real: elig.fimReal,
        tentativas_enviadas: enviadas,
        bloqueado_por_tentativas: tentMax != null ? enviadas >= tentMax : false,
        ultima_tentativa_id: tent.rows?.[0]?.ultima_id ?? null,
        ultima_nota: tent.rows?.[0]?.ultima_nota ?? null,
      });
    }

    return res.json(out);
  } catch (err) {
    console.error("[questionarios] listarDisponiveisParaUsuario", err?.message || err);
    return res.status(500).json({ error: "Erro ao listar questionários disponíveis." });
  }
}

// GET /api/questionarios/:questionario_id/responder/turma/:turma_id
async function obterQuestionarioParaResponder(req, res) {
  try {
    const questionarioId = toInt(req.params.questionario_id);
    const turmaId = toInt(req.params.turma_id);
    const usuarioId = toInt(req.user?.id);

    if (!questionarioId || !turmaId || !usuarioId) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    // segurança: questionário precisa ser do evento da turma
    const okQT = await ensureQuestionarioDaTurma(questionarioId, turmaId);
    if (!okQT) return res.status(404).json({ error: "Questionário não pertence a esta turma." });

    // precisa estar inscrito (admin pode visualizar)
    if (!isAdminLike(req.user)) {
      const inscrito = await ensureInscrito(usuarioId, turmaId);
      if (!inscrito) return res.status(403).json({ error: "Você não está inscrito nesta turma." });
    }

    // precisa estar elegível (encerrada + 75%) — admin pode ver mesmo assim
    if (!isAdminLike(req.user)) {
      const elig = await checarElegibilidadeAluno({ usuarioId, turmaId });
      if (!elig.ok) {
        return res.status(409).json({ error: "Questionário indisponível para esta turma.", motivo: elig.motivo });
      }
    }

    const q = await query(
      `SELECT * FROM questionarios_evento WHERE id = $1 LIMIT 1`,
      [questionarioId]
    );
    if (!q.rowCount) return res.status(404).json({ error: "Questionário não encontrado." });

    if (String(q.rows[0].status) !== "publicado" && !isAdminLike(req.user)) {
      return res.status(409).json({ error: "Questionário ainda não foi publicado." });
    }

    const questoes = await query(
      `
      SELECT * FROM questoes_questionario
      WHERE questionario_id = $1
      ORDER BY ordem ASC, id ASC
      `,
      [questionarioId]
    );

    const ids = questoes.rows.map((r) => r.id);
    let alternativas = [];
    if (ids.length) {
      const alt = await query(
        `
        SELECT id, questao_id, texto, ordem
        FROM alternativas_questao
        WHERE questao_id = ANY($1::int[])
        ORDER BY questao_id ASC, ordem ASC, id ASC
        `,
        [ids]
      );
      alternativas = alt.rows;
    }

    function shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
    
    const questoesMix = shuffle(questoes.rows);
    
    return res.json({
      id: q.rows[0].id,
      titulo: q.rows[0].titulo,
      descricao: q.rows[0].descricao,
      min_nota: q.rows[0].min_nota,
      tentativas_max: q.rows[0].tentativas_max,
      turma_id: turmaId,
      questoes: questoesMix.map((qq) => {
        const alts = qq.tipo === "multipla_escolha"
          ? shuffle(alternativas.filter((a) => a.questao_id === qq.id))
          : [];
    
        return {
          id: qq.id,
          tipo: qq.tipo,
          enunciado: qq.enunciado,
          ordem: qq.ordem,
          peso: qq.peso,
          alternativas: alts,
        };
      }),
    });
    
  } catch (err) {
    console.error("[questionarios] obterQuestionarioParaResponder", err?.message || err);
    return res.status(500).json({ error: "Erro ao obter questionário." });
  }
}

// POST /api/questionarios/:questionario_id/iniciar/turma/:turma_id
async function iniciarTentativa(req, res) {
  try {
    const questionarioId = toInt(req.params.questionario_id);
    const turmaId = toInt(req.params.turma_id);
    const usuarioId = toInt(req.user?.id);

    if (!questionarioId || !turmaId || !usuarioId) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    // sanity: questionário da turma
    const okQT = await ensureQuestionarioDaTurma(questionarioId, turmaId);
    if (!okQT) return res.status(404).json({ error: "Questionário não pertence a esta turma." });

    // inscrito (admin override)
    if (!isAdminLike(req.user)) {
      const inscrito = await ensureInscrito(usuarioId, turmaId);
      if (!inscrito) return res.status(403).json({ error: "Você não está inscrito nesta turma." });
    }

    // elegibilidade (admin override)
    if (!isAdminLike(req.user)) {
      const elig = await checarElegibilidadeAluno({ usuarioId, turmaId });
      if (!elig.ok) return res.status(409).json({ error: "Você ainda não está elegível.", motivo: elig.motivo });
    }

    // tentativas_max
    const qq = await query(`SELECT tentativas_max, status FROM questionarios_evento WHERE id = $1 LIMIT 1`, [questionarioId]);
    if (!qq.rowCount) return res.status(404).json({ error: "Questionário não encontrado." });
    if (String(qq.rows[0].status) !== "publicado" && !isAdminLike(req.user)) {
      return res.status(409).json({ error: "Questionário ainda não foi publicado." });
    }

    const tentMax = qq.rows[0].tentativas_max == null ? null : Number(qq.rows[0].tentativas_max);

    // se existe tentativa "iniciada" => devolve (idempotente)
    const last = await query(
      `
      SELECT *
      FROM tentativas_questionario
      WHERE questionario_id = $1 AND usuario_id = $2 AND turma_id = $3
      ORDER BY id DESC
      LIMIT 1
      `,
      [questionarioId, usuarioId, turmaId]
    );

    if (last.rowCount && ["iniciada", "enviada"].includes(last.rows[0].status)) {
      // se última foi enviada e ainda há tentativas, o frontend chamará iniciar de novo → criamos uma nova
      if (last.rows[0].status === "iniciada") {
        return res.json(last.rows[0]);
      }
    }

    // conta enviadas para bloquear
    if (tentMax != null) {
      const cnt = await query(
        `
        SELECT COUNT(*)::int AS enviadas
        FROM tentativas_questionario
        WHERE questionario_id = $1 AND usuario_id = $2 AND turma_id = $3 AND status='enviada'
        `,
        [questionarioId, usuarioId, turmaId]
      );
      const enviadas = Number(cnt.rows?.[0]?.enviadas || 0);
      if (enviadas >= tentMax) {
        return res.status(409).json({ error: "Limite de tentativas atingido.", tentativas_max: tentMax });
      }
    }

    // cria nova tentativa iniciada
    const ins = await query(
      `
      INSERT INTO tentativas_questionario (questionario_id, usuario_id, turma_id, status, iniciado_em)
      VALUES ($1, $2, $3, 'iniciada', NOW())
      RETURNING *
      `,
      [questionarioId, usuarioId, turmaId]
    );

    return res.status(201).json(ins.rows[0]);
  } catch (err) {
    console.error("[questionarios] iniciarTentativa", err?.message || err);
    return res.status(500).json({ error: "Erro ao iniciar tentativa." });
  }
}

// POST /api/questionarios/:questionario_id/enviar/turma/:turma_id
// body: { respostas: [{ questao_id, alternativa_id?, resposta_texto? }, ...] }
async function enviarTentativa(req, res) {
  try {
    const questionarioId = toInt(req.params.questionario_id);
    const turmaId = toInt(req.params.turma_id);
    const usuarioId = toInt(req.user?.id);
    const respostas = Array.isArray(req.body?.respostas) ? req.body.respostas : [];

    if (!questionarioId || !turmaId || !usuarioId) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    // sanity: questionário da turma
    const okQT = await ensureQuestionarioDaTurma(questionarioId, turmaId);
    if (!okQT) return res.status(404).json({ error: "Questionário não pertence a esta turma." });

    // inscrito (admin override)
    if (!isAdminLike(req.user)) {
      const inscrito = await ensureInscrito(usuarioId, turmaId);
      if (!inscrito) return res.status(403).json({ error: "Você não está inscrito nesta turma." });
    }

    // elegibilidade (admin override)
    if (!isAdminLike(req.user)) {
      const elig = await checarElegibilidadeAluno({ usuarioId, turmaId });
      if (!elig.ok) return res.status(409).json({ error: "Você ainda não está elegível.", motivo: elig.motivo });
    }

    // transação (evita estado quebrado entre tentativa/respostas/nota)
    const result = await withTx(async () => {
      // locka a tentativa mais recente para evitar “duplo submit” (race)
      const tent = await query(
        `
        SELECT *
        FROM tentativas_questionario
        WHERE questionario_id = $1 AND usuario_id = $2 AND turma_id = $3
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

      // confere status do questionário
      const qq = await query(`SELECT min_nota, tentativas_max, status FROM questionarios_evento WHERE id = $1 LIMIT 1`, [questionarioId]);
      if (!qq.rowCount) return { http: 404, body: { error: "Questionário não encontrado." } };
      if (String(qq.rows[0].status) !== "publicado" && !isAdminLike(req.user)) {
        return { http: 409, body: { error: "Questionário ainda não foi publicado." } };
      }

      // tentativas_max (garante no submit também)
      const tentMax = qq.rows[0].tentativas_max == null ? null : Number(qq.rows[0].tentativas_max);
      if (tentMax != null) {
        const cnt = await query(
          `
          SELECT COUNT(*)::int AS enviadas
          FROM tentativas_questionario
          WHERE questionario_id = $1 AND usuario_id = $2 AND turma_id = $3 AND status='enviada'
          `,
          [questionarioId, usuarioId, turmaId]
        );
        const enviadas = Number(cnt.rows?.[0]?.enviadas || 0);
        if (enviadas >= tentMax) {
          return { http: 409, body: { error: "Limite de tentativas atingido.", tentativas_max: tentMax } };
        }
      }

      const tentativaId = tent.rows[0].id;

      // carrega questões
      const questoes = await query(
        `SELECT id, tipo, peso FROM questoes_questionario WHERE questionario_id = $1`,
        [questionarioId]
      );
      const questMap = new Map(questoes.rows.map((q) => [Number(q.id), q]));

      // carrega alternativas (inclui correta server-side)
      const mcqIds = questoes.rows
        .filter((q) => q.tipo === "multipla_escolha")
        .map((q) => q.id);

      let altCorretas = [];
      if (mcqIds.length) {
        const alt = await query(
          `
          SELECT id, questao_id, correta
          FROM alternativas_questao
          WHERE questao_id = ANY($1::int[])
          `,
          [mcqIds]
        );
        altCorretas = alt.rows;
      }

      const altMap = new Map(
        altCorretas.map((a) => [
          Number(a.id),
          { questao_id: Number(a.questao_id), correta: !!a.correta },
        ])
      );

      // hardening: valida payload (não deixa enviar alternativa de outra questão)
      // e garante que dissertativa envia texto (opcional no MVP, mas útil)
      const respostasValidas = [];
      for (const r of respostas) {
        const qid = toInt(r?.questao_id);
        if (!qid) continue;
        const q = questMap.get(qid);
        if (!q) continue;

        if (q.tipo === "multipla_escolha") {
          const altId = toInt(r?.alternativa_id);
          if (!altId) continue;
          const info = altMap.get(altId);
          if (!info || info.questao_id !== qid) continue; // tentativa de burlar
          respostasValidas.push({ qid, altId, texto: null });
        } else {
          const texto = r?.resposta_texto != null ? String(r.resposta_texto) : "";
          respostasValidas.push({ qid, altId: null, texto: texto.trim() || null });
        }
      }

      // limpa respostas antigas desta tentativa (idempotência)
      await query(`DELETE FROM respostas_questionario WHERE tentativa_id = $1`, [tentativaId]);

      let totalPesoMCQ = 0;
      let totalPontos = 0;

      // insere respostas
      for (const r of respostasValidas) {
        const q = questMap.get(r.qid);
        const peso = Number(q?.peso || 1);

        let correta = null;
        let pontuacao = null;

        if (q.tipo === "multipla_escolha") {
          totalPesoMCQ += peso;
          const info = altMap.get(r.altId);
          const ok = !!(info && info.questao_id === r.qid && info.correta === true);
          correta = ok;
          pontuacao = ok ? peso : 0;
          totalPontos += pontuacao;
        } else {
          // dissertativa: sem pontuação no MVP (corrigir manualmente futuramente)
        }

        await query(
          `
          INSERT INTO respostas_questionario (tentativa_id, questao_id, alternativa_id, resposta_texto, correta, pontuacao)
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [tentativaId, r.qid, r.altId, r.texto, correta, pontuacao]
        );
      }

      // nota percentual (0..100) baseado só em MCQ
      let nota = null;
      if (mcqIds.length > 0 && totalPesoMCQ > 0) {
        nota = Math.round((totalPontos / totalPesoMCQ) * 10000) / 100; // 2 casas
      }

      const upd = await query(
        `
        UPDATE tentativas_questionario
        SET status = 'enviada', nota = $2, enviado_em = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [tentativaId, nota]
      );

      // flag: passou min_nota?
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

    return res.status(result.http).json(result.body);
  } catch (err) {
    console.error("[questionarios] enviarTentativa", err?.message || err);
    return res.status(500).json({ error: "Erro ao enviar tentativa." });
  }
}

// GET /api/questionarios/:questionario_id/minha-tentativa/turma/:turma_id
async function obterMinhaTentativaPorTurma(req, res) {
  try {
    const questionarioId = toInt(req.params.questionario_id);
    const turmaId = toInt(req.params.turma_id);
    const usuarioId = toInt(req.user?.id);

    if (!questionarioId || !turmaId || !usuarioId) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    // sanity: questionário da turma
    const okQT = await ensureQuestionarioDaTurma(questionarioId, turmaId);
    if (!okQT) return res.status(404).json({ error: "Questionário não pertence a esta turma." });

    // inscrito (admin override)
    if (!isAdminLike(req.user)) {
      const inscrito = await ensureInscrito(usuarioId, turmaId);
      if (!inscrito) return res.status(403).json({ error: "Você não está inscrito nesta turma." });
    }

    const last = await query(
      `
      SELECT *
      FROM tentativas_questionario
      WHERE questionario_id = $1 AND usuario_id = $2 AND turma_id = $3
      ORDER BY id DESC
      LIMIT 1
      `,
      [questionarioId, usuarioId, turmaId]
    );

    if (!last.rowCount) return res.status(404).json({ error: "Sem tentativa." });
    return res.json(last.rows[0]);
  } catch (err) {
    console.error("[questionarios] obterMinhaTentativaPorTurma", err?.message || err);
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
