// ✅ src/controllers/questionariosController.js
const { query } = require("../db");

/* =========================================================
   Helpers de data/hora (anti-fuso, comparação por string)
   ========================================================= */
function nowStrLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function dtFimTurmaStr(t) {
  const d = String(t.data_fim); // "YYYY-MM-DD"
  const h = String(t.horario_fim || "23:59").slice(0, 5);
  return `${d} ${h}`;
}

function isAdminLike(user) {
  const perfil = user?.perfil;
  if (!perfil) return false;
  const arr = Array.isArray(perfil)
    ? perfil.map(String)
    : String(perfil).split(",").map((s) => s.trim());
  return arr.includes("administrador");
}

/* =========================================================
   1) INSTRUTOR/ADMIN: CRIAR/EDITAR
   ========================================================= */

// POST /api/questionarios/evento/:evento_id/rascunho
async function criarOuObterRascunhoPorEvento(req, res) {
  try {
    const eventoId = Number(req.params.evento_id);
    const userId = Number(req.user?.id);

    if (!eventoId) return res.status(400).json({ error: "evento_id inválido." });

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
    console.error("[questionarios] criarOuObterRascunhoPorEvento", err);
    return res.status(500).json({ error: "Erro ao criar/obter rascunho." });
  }
}

// GET /api/questionarios/evento/:evento_id
async function obterQuestionarioPorEvento(req, res) {
  try {
    const eventoId = Number(req.params.evento_id);
    if (!eventoId) return res.status(400).json({ error: "evento_id inválido." });

    const q = await query(
      `SELECT * FROM questionarios_evento WHERE evento_id = $1 LIMIT 1`,
      [eventoId]
    );
    if (!q.rowCount) return res.status(404).json({ error: "Questionário não encontrado." });

    // carrega questões e alternativas
    const questoes = await query(
      `
      SELECT * FROM questoes_questionario
      WHERE questionario_id = $1
      ORDER BY ordem ASC, id ASC
      `,
      [q.rows[0].id]
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
    console.error("[questionarios] obterQuestionarioPorEvento", err);
    return res.status(500).json({ error: "Erro ao obter questionário." });
  }
}

// PUT /api/questionarios/:questionario_id
async function atualizarQuestionario(req, res) {
  try {
    const questionarioId = Number(req.params.questionario_id);
    if (!questionarioId) return res.status(400).json({ error: "questionario_id inválido." });

    const { titulo, descricao, obrigatorio, min_nota, tentativas_max, status } = req.body || {};

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
        min_nota === "" ? null : min_nota ?? null,
        tentativas_max === "" ? null : tentativas_max ?? null,
        status ?? null,
      ]
    );

    if (!upd.rowCount) return res.status(404).json({ error: "Questionário não encontrado." });
    return res.json(upd.rows[0]);
  } catch (err) {
    console.error("[questionarios] atualizarQuestionario", err);
    return res.status(500).json({ error: "Erro ao atualizar questionário." });
  }
}

// POST /api/questionarios/:questionario_id/questoes
async function adicionarQuestao(req, res) {
  try {
    const questionarioId = Number(req.params.questionario_id);
    const { tipo, enunciado, ordem, peso } = req.body || {};

    if (!questionarioId) return res.status(400).json({ error: "questionario_id inválido." });
    if (!tipo || !["multipla_escolha", "dissertativa"].includes(tipo)) {
      return res.status(400).json({ error: "tipo inválido." });
    }
    if (!enunciado?.trim()) return res.status(400).json({ error: "enunciado é obrigatório." });

    const ins = await query(
      `
      INSERT INTO questoes_questionario (questionario_id, tipo, enunciado, ordem, peso)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        questionarioId,
        tipo,
        enunciado.trim(),
        Number.isFinite(Number(ordem)) ? Number(ordem) : 1,
        Number.isFinite(Number(peso)) ? Number(peso) : 1,
      ]
    );

    return res.status(201).json(ins.rows[0]);
  } catch (err) {
    console.error("[questionarios] adicionarQuestao", err);
    return res.status(500).json({ error: "Erro ao adicionar questão." });
  }
}

// PUT /api/questionarios/:questionario_id/questoes/:questao_id
async function atualizarQuestao(req, res) {
  try {
    const questaoId = Number(req.params.questao_id);
    const { enunciado, ordem, peso, tipo } = req.body || {};

    if (!questaoId) return res.status(400).json({ error: "questao_id inválido." });
    if (tipo && !["multipla_escolha", "dissertativa"].includes(tipo)) {
      return res.status(400).json({ error: "tipo inválido." });
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
      [
        questaoId,
        enunciado?.trim() ? enunciado.trim() : null,
        Number.isFinite(Number(ordem)) ? Number(ordem) : null,
        Number.isFinite(Number(peso)) ? Number(peso) : null,
        tipo ?? null,
      ]
    );

    if (!upd.rowCount) return res.status(404).json({ error: "Questão não encontrada." });
    return res.json(upd.rows[0]);
  } catch (err) {
    console.error("[questionarios] atualizarQuestao", err);
    return res.status(500).json({ error: "Erro ao atualizar questão." });
  }
}

// DELETE /api/questionarios/:questionario_id/questoes/:questao_id
async function removerQuestao(req, res) {
  try {
    const questaoId = Number(req.params.questao_id);
    if (!questaoId) return res.status(400).json({ error: "questao_id inválido." });

    await query(`DELETE FROM questoes_questionario WHERE id = $1`, [questaoId]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[questionarios] removerQuestao", err);
    return res.status(500).json({ error: "Erro ao remover questão." });
  }
}

// POST /api/questionarios/questoes/:questao_id/alternativas
async function adicionarAlternativa(req, res) {
  try {
    const questaoId = Number(req.params.questao_id);
    const { texto, correta, ordem } = req.body || {};

    if (!questaoId) return res.status(400).json({ error: "questao_id inválido." });
    if (!texto?.trim()) return res.status(400).json({ error: "texto é obrigatório." });

    const ins = await query(
      `
      INSERT INTO alternativas_questao (questao_id, texto, correta, ordem)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        questaoId,
        texto.trim(),
        typeof correta === "boolean" ? correta : false,
        Number.isFinite(Number(ordem)) ? Number(ordem) : 1,
      ]
    );

    return res.status(201).json(ins.rows[0]);
  } catch (err) {
    console.error("[questionarios] adicionarAlternativa", err);
    return res.status(500).json({ error: "Erro ao adicionar alternativa." });
  }
}

// PUT /api/questionarios/alternativas/:alt_id
async function atualizarAlternativa(req, res) {
  try {
    const altId = Number(req.params.alt_id);
    const { texto, correta, ordem } = req.body || {};
    if (!altId) return res.status(400).json({ error: "alt_id inválido." });

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
      [
        altId,
        texto?.trim() ? texto.trim() : null,
        typeof correta === "boolean" ? correta : null,
        Number.isFinite(Number(ordem)) ? Number(ordem) : null,
      ]
    );

    if (!upd.rowCount) return res.status(404).json({ error: "Alternativa não encontrada." });
    return res.json(upd.rows[0]);
  } catch (err) {
    console.error("[questionarios] atualizarAlternativa", err);
    return res.status(500).json({ error: "Erro ao atualizar alternativa." });
  }
}

// DELETE /api/questionarios/alternativas/:alt_id
async function removerAlternativa(req, res) {
  try {
    const altId = Number(req.params.alt_id);
    if (!altId) return res.status(400).json({ error: "alt_id inválido." });

    await query(`DELETE FROM alternativas_questao WHERE id = $1`, [altId]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[questionarios] removerAlternativa", err);
    return res.status(500).json({ error: "Erro ao remover alternativa." });
  }
}

/* =========================================================
   PUBLICAR: valida conteúdo + regra "antes da 1ª turma finalizar"
   ========================================================= */

// POST /api/questionarios/:questionario_id/publicar
async function publicarQuestionario(req, res) {
  try {
    const questionarioId = Number(req.params.questionario_id);
    if (!questionarioId) return res.status(400).json({ error: "questionario_id inválido." });

    // pega questionário e evento
    const q = await query(
      `SELECT id, evento_id, status FROM questionarios_evento WHERE id = $1 LIMIT 1`,
      [questionarioId]
    );
    if (!q.rowCount) return res.status(404).json({ error: "Questionário não encontrado." });

    const eventoId = q.rows[0].evento_id;

    // regra do prazo: antes de encerrar a 1ª turma do evento
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
      const fimPrimeira = dtFimTurmaStr(turmas.rows[0]);
      const agora = nowStrLocal();

      const admin = isAdminLike(req.user);
      if (!admin && agora > fimPrimeira) {
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
      `SELECT id, tipo FROM questoes_questionario WHERE questionario_id = $1`,
      [questionarioId]
    );
    if (!questoes.rowCount) {
      return res.status(400).json({ error: "Não é possível publicar: adicione ao menos 1 questão." });
    }

    // valida MCQ: cada questão MCQ tem alternativas e exatamente 1 correta
    const mcqIds = questoes.rows.filter((r) => r.tipo === "multipla_escolha").map((r) => r.id);
    if (mcqIds.length) {
      const alt = await query(
        `
        SELECT questao_id,
               COUNT(*) AS total,
               SUM(CASE WHEN correta THEN 1 ELSE 0 END) AS corretas
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
    console.error("[questionarios] publicarQuestionario", err);
    return res.status(500).json({ error: "Erro ao publicar questionário." });
  }
}

/* =========================================================
   2) ALUNO: DISPONÍVEIS / RESPONDER / ENVIAR
   ========================================================= */

// GET /api/questionarios/disponiveis/usuario/:usuario_id
// (MVP: lista por turma em que ele está inscrito + turma encerrada + presença>=75 + questionário publicado e obrigatório)
async function listarDisponiveisParaUsuario(req, res) {
  try {
    const usuarioId = Number(req.params.usuario_id);
    if (!usuarioId) return res.status(400).json({ error: "usuario_id inválido." });

    // Turmas que o usuário está inscrito
    // OBS: você não usa status/cancelada em inscricoes, então basta join
    const rows = await query(
      `
      SELECT
        t.id AS turma_id,
        t.nome AS turma_nome,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim,
        e.id AS evento_id,
        e.titulo AS evento_titulo,
        q.id AS questionario_id,
        q.titulo AS questionario_titulo,
        q.min_nota,
        q.obrigatorio,
        q.status
      FROM inscricoes i
      JOIN turmas t ON t.id = i.turma_id
      JOIN eventos e ON e.id = t.evento_id
      JOIN questionarios_evento q ON q.evento_id = e.id
      WHERE i.usuario_id = $1
        AND q.status = 'publicado'
        AND q.obrigatorio = TRUE
      ORDER BY t.data_fim DESC, t.horario_fim DESC
      `,
      [usuarioId]
    );

    // Aqui a gente filtra por: turma encerrada + presença>=75.
    // Como você já tem a função/endpoint de frequência geral no projeto,
    // vou deixar essa parte como "TODO: integrar com sua lógica real".
    // Por enquanto, devolve o que existe, e o frontend pode chamar um endpoint
    // de "elegibilidade" por turma.
    return res.json(rows.rows);
  } catch (err) {
    console.error("[questionarios] listarDisponiveisParaUsuario", err);
    return res.status(500).json({ error: "Erro ao listar questionários disponíveis." });
  }
}

// GET /api/questionarios/:questionario_id/responder/turma/:turma_id
async function obterQuestionarioParaResponder(req, res) {
  try {
    const questionarioId = Number(req.params.questionario_id);
    if (!questionarioId) return res.status(400).json({ error: "questionario_id inválido." });

    const q = await query(
      `SELECT * FROM questionarios_evento WHERE id = $1 LIMIT 1`,
      [questionarioId]
    );
    if (!q.rowCount) return res.status(404).json({ error: "Questionário não encontrado." });

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

    // Importante: NÃO enviar "correta" para o aluno
    return res.json({
      id: q.rows[0].id,
      titulo: q.rows[0].titulo,
      descricao: q.rows[0].descricao,
      min_nota: q.rows[0].min_nota,
      tentativas_max: q.rows[0].tentativas_max,
      questoes: questoes.rows.map((qq) => ({
        id: qq.id,
        tipo: qq.tipo,
        enunciado: qq.enunciado,
        ordem: qq.ordem,
        peso: qq.peso,
        alternativas:
          qq.tipo === "multipla_escolha"
            ? alternativas.filter((a) => a.questao_id === qq.id)
            : [],
      })),
    });
  } catch (err) {
    console.error("[questionarios] obterQuestionarioParaResponder", err);
    return res.status(500).json({ error: "Erro ao obter questionário." });
  }
}

// POST /api/questionarios/:questionario_id/iniciar/turma/:turma_id
async function iniciarTentativa(req, res) {
  try {
    const questionarioId = Number(req.params.questionario_id);
    const turmaId = Number(req.params.turma_id);
    const usuarioId = Number(req.user?.id);

    if (!questionarioId || !turmaId || !usuarioId) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    // se já existe tentativa iniciada/enviada, devolve a última
    const last = await query(
      `
      SELECT * FROM tentativas_questionario
      WHERE questionario_id = $1 AND usuario_id = $2 AND turma_id = $3
      ORDER BY id DESC
      LIMIT 1
      `,
      [questionarioId, usuarioId, turmaId]
    );

    if (last.rowCount && ["iniciada", "enviada"].includes(last.rows[0].status)) {
      return res.json(last.rows[0]);
    }

    const ins = await query(
      `
      INSERT INTO tentativas_questionario (questionario_id, usuario_id, turma_id, status)
      VALUES ($1, $2, $3, 'iniciada')
      RETURNING *
      `,
      [questionarioId, usuarioId, turmaId]
    );

    return res.status(201).json(ins.rows[0]);
  } catch (err) {
    console.error("[questionarios] iniciarTentativa", err);
    return res.status(500).json({ error: "Erro ao iniciar tentativa." });
  }
}

// POST /api/questionarios/:questionario_id/enviar/turma/:turma_id
// body: { respostas: [{ questao_id, alternativa_id?, resposta_texto? }, ...] }
async function enviarTentativa(req, res) {
  try {
    const questionarioId = Number(req.params.questionario_id);
    const turmaId = Number(req.params.turma_id);
    const usuarioId = Number(req.user?.id);
    const respostas = Array.isArray(req.body?.respostas) ? req.body.respostas : [];

    if (!questionarioId || !turmaId || !usuarioId) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    // pega tentativa ativa
    const tent = await query(
      `
      SELECT * FROM tentativas_questionario
      WHERE questionario_id = $1 AND usuario_id = $2 AND turma_id = $3
      ORDER BY id DESC
      LIMIT 1
      `,
      [questionarioId, usuarioId, turmaId]
    );

    if (!tent.rowCount) {
      return res.status(400).json({ error: "Nenhuma tentativa iniciada." });
    }
    if (tent.rows[0].status === "enviada") {
      return res.json({ ...tent.rows[0], ja_enviada: true });
    }

    const tentativaId = tent.rows[0].id;

    // carrega questões e alternativas corretas (server-side)
    const questoes = await query(
      `SELECT id, tipo, peso FROM questoes_questionario WHERE questionario_id = $1`,
      [questionarioId]
    );
    const questMap = new Map(questoes.rows.map((q) => [Number(q.id), q]));

    const mcqIds = questoes.rows.filter((q) => q.tipo === "multipla_escolha").map((q) => q.id);
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
      altCorretas.map((a) => [Number(a.id), { questao_id: Number(a.questao_id), correta: !!a.correta }])
    );

    // limpa respostas anteriores (se existirem por reenvio futuro)
    await query(`DELETE FROM respostas_questionario WHERE tentativa_id = $1`, [tentativaId]);

    let totalPeso = 0;
    let totalPontos = 0;

    for (const r of respostas) {
      const qid = Number(r.questao_id);
      const q = questMap.get(qid);
      if (!q) continue;

      const peso = Number(q.peso || 1);
      totalPeso += peso;

      let correta = null;
      let pontuacao = null;

      if (q.tipo === "multipla_escolha") {
        const altId = Number(r.alternativa_id);
        const info = altMap.get(altId);
        const ok = info && info.questao_id === qid && info.correta === true;
        correta = !!ok;
        pontuacao = ok ? peso : 0;
        totalPontos += pontuacao;
      } else {
        // dissertativa: não calcula nota por enquanto (pontuação null)
        // se quiser pontuar no futuro, dá pra adicionar correção manual
      }

      await query(
        `
        INSERT INTO respostas_questionario (tentativa_id, questao_id, alternativa_id, resposta_texto, correta, pontuacao)
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          tentativaId,
          qid,
          r.alternativa_id ? Number(r.alternativa_id) : null,
          r.resposta_texto ? String(r.resposta_texto) : null,
          correta,
          pontuacao,
        ]
      );
    }

    // nota: percentual (0-100) baseado em múltipla escolha
    // se não houver MCQ, fica NULL (ou 0). Vou deixar NULL.
    let nota = null;
    const hasMCQ = mcqIds.length > 0;
    if (hasMCQ && totalPeso > 0) {
      nota = Math.round((totalPontos / totalPeso) * 10000) / 100; // 2 casas
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

    return res.json(upd.rows[0]);
  } catch (err) {
    console.error("[questionarios] enviarTentativa", err);
    return res.status(500).json({ error: "Erro ao enviar tentativa." });
  }
}

// GET /api/questionarios/:questionario_id/minha-tentativa/turma/:turma_id
async function obterMinhaTentativaPorTurma(req, res) {
  try {
    const questionarioId = Number(req.params.questionario_id);
    const turmaId = Number(req.params.turma_id);
    const usuarioId = Number(req.user?.id);

    if (!questionarioId || !turmaId || !usuarioId) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
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
    console.error("[questionarios] obterMinhaTentativaPorTurma", err);
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
