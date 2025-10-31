// 📁 src/controllers/inscricoesController.js
/* eslint-disable no-console */
const db = require('../db');
const { send: enviarEmail } = require('../utils/email');
const { formatarDataBR } = require('../utils/data');
const { criarNotificacao } = require('./notificacoesController');

/* ────────────────────────────────────────────────────────────────
   Helpers de datas/horários a partir de datas_turma
   ──────────────────────────────────────────────────────────────── */

/**
 * Retorna um “resumo” consistente da turma:
 *  - data_inicio/data_fim: MIN/MAX de datas_turma; fallback presenças; fallback colunas da turma
 *  - horario_inicio/horario_fim: par mais frequente em datas_turma; fallback colunas da turma; fallback 08:00–17:00
 */
async function getResumoTurma(turmaId) {
  const sql = `
    SELECT
      t.id,

      /* período calculado - como STRING YYYY-MM-DD */
      COALESCE(
        (SELECT to_char(MIN(dt.data)::date, 'YYYY-MM-DD') FROM datas_turma dt WHERE dt.turma_id = t.id),
        (SELECT to_char(MIN(p.data_presenca)::date, 'YYYY-MM-DD') FROM presencas p WHERE p.turma_id = t.id),
        to_char(t.data_inicio, 'YYYY-MM-DD')
      ) AS data_inicio,

      COALESCE(
        (SELECT to_char(MAX(dt.data)::date, 'YYYY-MM-DD') FROM datas_turma dt WHERE dt.turma_id = t.id),
        (SELECT to_char(MAX(p.data_presenca)::date, 'YYYY-MM-DD') FROM presencas p WHERE p.turma_id = t.id),
        to_char(t.data_fim, 'YYYY-MM-DD')
      ) AS data_fim,

      /* horários calculados (mais frequente) -> HH:MM */
      COALESCE(
        (
          SELECT to_char(z.hi, 'HH24:MI') FROM (
            SELECT dt.horario_inicio AS hi, COUNT(*) c
            FROM datas_turma dt
            WHERE dt.turma_id = t.id
            GROUP BY dt.horario_inicio
            ORDER BY COUNT(*) DESC, hi
            LIMIT 1
          ) z
        ),
        to_char(t.horario_inicio, 'HH24:MI'),
        '08:00'
      ) AS horario_inicio,

      COALESCE(
        (
          SELECT to_char(z.hf, 'HH24:MI') FROM (
            SELECT dt.horario_fim AS hf, COUNT(*) c
            FROM datas_turma dt
            WHERE dt.turma_id = t.id
            GROUP BY dt.horario_fim
            ORDER BY COUNT(*) DESC, hf
            LIMIT 1
          ) z
        ),
        to_char(t.horario_fim, 'HH24:MI'),
        '17:00'
      ) AS horario_fim

    FROM turmas t
    WHERE t.id = $1
  `;
  const { rows } = await db.query(sql, [turmaId]);
  return rows[0] || null;
}

/* ────────────────────────────────────────────────────────────────
   Helpers de conflito (datas/horários em formato string)
   ──────────────────────────────────────────────────────────────── */

const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const hhmm = (s, fb = "00:00") =>
  typeof s === "string" && /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : fb;

// interseção de períodos (YYYY-MM-DD) via comparação lexical
function datasIntersectam(aIni, aFim, bIni, bFim) {
  if (!aIni || !aFim || !bIni || !bFim) return false;
  return aIni <= bFim && bIni <= aFim;
}

// sobreposição de faixas horárias (HH:MM) — regra: (Aini < Bfim) && (Bini < Afim)
function horariosSobrepoem(ai, af, bi, bf) {
  const [AAi, AAf, Bbi, Bbf] = [ai, af, bi, bf].map((x) => hhmm(x, "00:00"));
  return AAi < Bbf && Bbi < AAf;
}

/**
 * Verifica conflito para CONGRESSO: dentro do MESMO evento, se o usuário
 * já tem inscrição em outra turma cujo período (datas) intersecciona e
 * os horários se sobrepõem, deve bloquear.
 */
async function checarConflitoCongresso(dbConn, usuarioId, eventoId, turmaIdAlvo, resumoAlvo) {
  const { rows: outras } = await dbConn.query(
    `
      SELECT t2.id AS turma_id, t2.nome
        FROM inscricoes i
        JOIN turmas t2 ON t2.id = i.turma_id
       WHERE i.usuario_id = $1
         AND t2.evento_id = $2
         AND t2.id <> $3
    `,
    [usuarioId, eventoId, turmaIdAlvo]
  );

  const aIni = ymd(resumoAlvo?.data_inicio);
  const aFim = ymd(resumoAlvo?.data_fim);
  const aHi = hhmm(resumoAlvo?.horario_inicio);
  const aHf = hhmm(resumoAlvo?.horario_fim);

  for (const r of outras) {
    const res = await getResumoTurma(r.turma_id);
    const bIni = ymd(res?.data_inicio);
    const bFim = ymd(res?.data_fim);
    const bHi = hhmm(res?.horario_inicio);
    const bHf = hhmm(res?.horario_fim);

    if (datasIntersectam(aIni, aFim, bIni, bFim) && horariosSobrepoem(aHi, aHf, bHi, bHf)) {
      return {
        conflito: true,
        turma: {
          id: r.turma_id,
          nome: r.nome,
          data_inicio: bIni,
          data_fim: bFim,
          horario_inicio: bHi,
          horario_fim: bHf
        },
      };
    }
  }

  return { conflito: false };
}

/**
 * 🔎 Conflito GLOBAL: verifica se o usuário já tem QUALQUER inscrição
 * (em QUALQUER evento) cujo período e horário conflitam com a turma-alvo.
 */
async function checarConflitoGlobal(dbConn, usuarioId, turmaIdAlvo, resumoAlvo) {
  const { rows: outras } = await dbConn.query(
    `
      SELECT i.turma_id, t.evento_id, t.nome
        FROM inscricoes i
        JOIN turmas t ON t.id = i.turma_id
       WHERE i.usuario_id = $1
         AND i.turma_id <> $2
    `,
    [usuarioId, turmaIdAlvo]
  );

  const aIni = ymd(resumoAlvo?.data_inicio);
  const aFim = ymd(resumoAlvo?.data_fim);
  const aHi  = hhmm(resumoAlvo?.horario_inicio);
  const aHf  = hhmm(resumoAlvo?.horario_fim);

  for (const r of outras) {
    const res = await getResumoTurma(r.turma_id);
    const bIni = ymd(res?.data_inicio);
    const bFim = ymd(res?.data_fim);
    const bHi  = hhmm(res?.horario_inicio);
    const bHf  = hhmm(res?.horario_fim);

    if (datasIntersectam(aIni, aFim, bIni, bFim) && horariosSobrepoem(aHi, aHf, bHi, bHf)) {
      return {
        conflito: true,
        turma: {
          id: r.turma_id,
          nome: r.nome,
          data_inicio: bIni,
          data_fim: bFim,
          horario_inicio: bHi,
          horario_fim: bHf
        },
      };
    }
  }
  return { conflito: false };
}

/* ────────────────────────────────────────────────────────────────
   ➕ Inscrever-se em uma turma
   ──────────────────────────────────────────────────────────────── */
async function inscreverEmTurma(req, res) {
  const usuario_id = req.user.id;
  const { turma_id } = req.body;

  if (!turma_id) {
    return res.status(400).json({ erro: 'ID da turma é obrigatório.' });
  }

  try {
    // 1) Turma
    const { rows: turmaRows } = await db.query(
      'SELECT * FROM turmas WHERE id = $1',
      [turma_id]
    );
    if (turmaRows.length === 0) {
      return res.status(404).json({ erro: 'Turma não encontrada.' });
    }
    const turma = turmaRows[0];

    // Resumo calculado (período e horários verdadeiros)
    const resumo = await getResumoTurma(turma_id);

    // 2) Evento (tipo + dados p/ notificação/e-mail)
    const { rows: evRows } = await db.query(
      `SELECT 
          id,
          (tipo::text) AS tipo,
          CASE WHEN tipo::text ILIKE 'congresso' THEN TRUE ELSE FALSE END AS is_congresso,
          COALESCE(titulo, 'Evento') AS titulo,
          COALESCE(local,  'A definir') AS local
       FROM eventos
       WHERE id = $1`,
      [turma.evento_id]
    );
    if (evRows.length === 0) {
      return res.status(404).json({ erro: 'Evento da turma não encontrado.' });
    }
    const evento = evRows[0];
    const isCongresso = !!evento.is_congresso;

    // 3) Bloqueio: instrutor do evento
    const ehInstrutor = await db.query(
      `SELECT 1 
         FROM evento_instrutor 
        WHERE evento_id = $1 AND instrutor_id = $2 
        LIMIT 1`,
      [turma.evento_id, usuario_id]
    );
    if (ehInstrutor.rowCount > 0) {
      return res.status(409).json({
        erro: 'Você é instrutor deste evento e não pode se inscrever como participante.'
      });
    }

    // 4) Duplicidade na MESMA turma
    const duplicado = await db.query(
      'SELECT 1 FROM inscricoes WHERE usuario_id = $1 AND turma_id = $2',
      [usuario_id, turma_id]
    );
    if (duplicado.rows.length > 0) {
      return res.status(409).json({ erro: 'Usuário já inscrito nesta turma.' });
    }

    // 5) Regra: uma turma por evento (exceto congresso)
    if (!isCongresso) {
      const { rows: jaRows } = await db.query(
        `SELECT 1
           FROM inscricoes i
           JOIN turmas t2 ON t2.id = i.turma_id
          WHERE i.usuario_id = $1
            AND t2.evento_id = $2
          LIMIT 1`,
        [usuario_id, turma.evento_id]
      );
      if (jaRows.length > 0) {
        return res
          .status(409)
          .json({ erro: 'Você já está inscrito em uma turma deste evento.' });
      }
    }

    // 5A) Regra congresso: bloquear conflito de horário dentro do mesmo evento
    if (isCongresso) {
      const conf = await checarConflitoCongresso(db, usuario_id, turma.evento_id, turma_id, resumo);
      if (conf?.conflito) {
        const c = conf.turma;
        return res.status(409).json({
          erro:
            `Conflito de horário dentro deste evento: você já está inscrito(a) na turma ` +
            `"${c.nome}" (${c.data_inicio}–${c.data_fim} ${c.horario_inicio}–${c.horario_fim}).`
        });
      }
    }

    // 5B) NOVA REGRA GLOBAL: bloquear conflito de horário com QUALQUER outra inscrição
    {
      const confGlobal = await checarConflitoGlobal(db, usuario_id, turma_id, resumo);
      if (confGlobal?.conflito) {
        const c = confGlobal.turma;
        return res.status(409).json({
          erro:
            `Conflito de horário com outra turma já inscrita: ` +
            `"${c.nome}" (${c.data_inicio}–${c.data_fim} ${c.horario_inicio}–${c.horario_fim}).`
        });
      }
    }

    // 6) Vagas
    const { rows: cnt } = await db.query(
      'SELECT COUNT(*) FROM inscricoes WHERE turma_id = $1',
      [turma_id]
    );
    const totalInscritos = parseInt(cnt[0].count, 10);
    const totalVagas = parseInt(turma.vagas_total, 10);
    if (Number.isNaN(totalVagas)) {
      return res.status(500).json({ erro: 'Número de vagas inválido para a turma.' });
    }
    if (totalInscritos >= totalVagas) {
      return res.status(400).json({ erro: 'Turma lotada. Vagas esgotadas.' });
    }

    // 7) Inserir inscrição
    let insert;
    try {
      insert = await db.query(
        `INSERT INTO inscricoes (usuario_id, turma_id, data_inscricao) 
         VALUES ($1, $2, NOW()) 
         RETURNING *`,
        [usuario_id, turma_id]
      );
    } catch (e) {
      if (e?.code === 'P0001') {
        // Pode vir de trigger que valida conflito — trate como 409
        return res.status(409).json({
          erro: e?.message || 'Inscrição bloqueada por conflito de horário no mesmo evento.'
        });
      }
      if (e?.code === '23505') {
        return res.status(409).json({
          erro: 'Usuário já inscrito nesta turma.'
        });
      }
      console.error('❌ Erro no INSERT (inscrições):', {
        message: e?.message, detail: e?.detail, code: e?.code, routine: e?.routine
      });
      throw e;
    }

    if (!insert || insert.rowCount === 0) {
      return res.status(500).json({ erro: 'Erro ao registrar inscrição no banco.' });
    }

    // 8) Dados do usuário (para e-mail)
    const { rows: userRows } = await db.query(
      'SELECT nome, email FROM usuarios WHERE id = $1',
      [usuario_id]
    );
    const usuario = userRows[0];

    // 9) Datas legíveis
    const dataIni = resumo?.data_inicio ? formatarDataBR(resumo.data_inicio) : '';
    const dataFim = resumo?.data_fim ? formatarDataBR(resumo.data_fim) : '';
    const hi = (resumo?.horario_inicio || '').slice(0, 5);
    const hf = (resumo?.horario_fim || '').slice(0, 5);
    const periodoStr =
      dataIni && dataFim ? `${dataIni} a ${dataFim}` :
      dataIni || dataFim ? (dataIni || dataFim) :
      'a definir';

    // --- NOTIFICAÇÃO (best-effort)
    try {
      const mensagem = [
        `✅ Sua inscrição foi confirmada com sucesso no evento "${evento.titulo}".`,
        '',
        `- Turma: ${turma.nome}`,
        `- Período: ${periodoStr}`,
        `- Horário: ${hi} às ${hf}`,
        `- Carga horária: ${turma.carga_horaria} horas`,
        `- Local: ${evento.local}`,
      ].join('\n');

      await criarNotificacao(usuario_id, mensagem, null);
    } catch (e) {
      console.warn('⚠️ Falha ao criar notificação (não bloqueante):', e?.message);
    }

    // 10) E-mail (best-effort)
    try {
      if (usuario?.email) {
        const html = `
          <h2>Olá, ${usuario.nome}!</h2>
          <p>Sua inscrição foi confirmada com sucesso.</p>
          <h3>📌 Detalhes da Inscrição</h3>
          <p>
            <strong>Evento:</strong> ${evento.titulo}<br/>
            <strong>Turma:</strong> ${turma.nome}<br/>
            <strong>Período:</strong> ${periodoStr}<br/>
            <strong>Horário:</strong> ${hi} às ${hf}<br/>
            <strong>Carga horária:</strong> ${turma.carga_horaria} horas<br/>
            <strong>Local:</strong> ${evento.local}
          </p>
          <p>📍 Em caso de dúvidas, entre em contato com a equipe da Escola da Saúde.</p>
          <p>Atenciosamente,<br/><strong>Equipe da Escola da Saúde</strong></p>
        `;

        const texto = `Olá, ${usuario.nome}!

Sua inscrição foi confirmada com sucesso no evento "${evento.titulo}".

Turma: ${turma.nome}
Período: ${periodoStr}
Horário: ${hi} às ${hf}
Carga horária: ${turma.carga_horaria} horas
Local: ${evento.local}

Atenciosamente,
Equipe da Escola da Saúde`;

        await enviarEmail({
          to: usuario.email,
          subject: '✅ Inscrição Confirmada – Escola da Saúde',
          text: texto,
          html,
        });
      } else {
        console.warn('⚠️ E-mail do usuário ausente — pulando envio.');
      }
    } catch (e) {
      console.error('⚠️ Falha ao enviar e-mail (não bloqueante):', e?.message);
    }

    // ✅ sucesso
    return res.status(201).json({ mensagem: 'Inscrição realizada com sucesso' });

  } catch (err) {
    if (
      err?.code === 'P0001' ||
      (typeof err?.message === 'string' &&
        err.message.toLowerCase().includes('inscrito em uma turma deste evento'))
    ) {
      return res.status(409).json({
        erro: 'Você já está inscrito em uma turma deste evento.'
      });
    }
    if (err?.code === '23505') {
      return res.status(409).json({ erro: 'Usuário já inscrito nesta turma.' });
    }

    console.error('❌ Erro ao processar inscrição:', {
      message: err?.message, detail: err?.detail, code: err?.code, stack: err?.stack
    });
    return res.status(500).json({ erro: 'Erro ao processar inscrição.' });
  }
}

/* ────────────────────────────────────────────────────────────────
   ❌ Cancelar inscrição (usuário cancela a PRÓPRIA, por turmaId)
   ──────────────────────────────────────────────────────────────── */
async function cancelarMinhaInscricao(req, res) {
  const usuarioId = Number(req.user?.id || req.user?.id);
  const turmaId   = Number(req.params.turmaId || req.params.id);

  if (!usuarioId || !turmaId) {
    return res.status(400).json({ erro: "Parâmetros inválidos." });
  }

  try {
    const sel = await db.query(
      `SELECT id FROM inscricoes WHERE usuario_id = $1 AND turma_id = $2`,
      [usuarioId, turmaId]
    );
    if (!sel.rowCount) {
      return res
        .status(404)
        .json({ erro: "Inscrição não encontrada para este usuário nesta turma." });
    }

    await db.query("BEGIN");

    await db.query(
      `DELETE FROM presencas WHERE usuario_id = $1 AND turma_id = $2`,
      [usuarioId, turmaId]
    );

    await db.query(
      `DELETE FROM inscricoes WHERE usuario_id = $1 AND turma_id = $2`,
      [usuarioId, turmaId]
    );

    await db.query("COMMIT");

    return res.json({ mensagem: "Inscrição cancelada com sucesso." });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("❌ Erro ao cancelar inscrição (minha):", {
      message: err?.message, detail: err?.detail, code: err?.code
    });
    return res.status(500).json({ erro: "Erro ao cancelar inscrição." });
  }
}

/* ────────────────────────────────────────────────────────────────
   ❌ Cancelar inscrição (ADMIN cancela de QUALQUER usuário)
   ──────────────────────────────────────────────────────────────── */
async function cancelarInscricaoAdmin(req, res) {
  const usuarioId = Number(req.params.usuarioId);
  const turmaId   = Number(req.params.turmaId);

  if (!usuarioId || !turmaId) {
    return res.status(400).json({ erro: "Parâmetros inválidos." });
  }

  try {
    const sel = await db.query(
      `SELECT id FROM inscricoes WHERE usuario_id = $1 AND turma_id = $2`,
      [usuarioId, turmaId]
    );
    if (!sel.rowCount) {
      return res.status(404).json({ erro: "Inscrição não encontrada." });
    }

    await db.query("BEGIN");

    await db.query(
      `DELETE FROM presencas WHERE usuario_id = $1 AND turma_id = $2`,
      [usuarioId, turmaId]
    );

    await db.query(
      `DELETE FROM inscricoes WHERE usuario_id = $1 AND turma_id = $2`,
      [usuarioId, turmaId]
    );

    await db.query("COMMIT");

    return res.json({ mensagem: "Inscrição cancelada (admin)." });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("❌ Erro ao cancelar inscrição (admin):", {
      message: err?.message, detail: err?.detail, code: err?.code
    });
    return res.status(500).json({ erro: "Erro ao cancelar inscrição." });
  }
}

/* ────────────────────────────────────────────────────────────────
   🔍 Minhas inscrições (com período/horário calculados)
   ──────────────────────────────────────────────────────────────── */
async function obterMinhasInscricoes(req, res) {
  try {
    const usuario_id = req.user.id;

    const resultado = await db.query(
      `
      SELECT 
        i.id AS inscricao_id, 
        e.id AS evento_id, 
        t.id AS turma_id,
        t.nome AS turma_nome,                       -- ✅ AQUI
        e.titulo, 
        e.local,                                    -- ✅ já temos o local
    
        to_char(
          COALESCE(
            (SELECT MIN(dt.data)::date FROM datas_turma dt WHERE dt.turma_id = t.id),
            (SELECT MIN(p.data_presenca)::date FROM presencas p WHERE p.turma_id = t.id),
            t.data_inicio
          )::date,
          'YYYY-MM-DD'
        ) AS data_inicio,
    
        to_char(
          COALESCE(
            (SELECT MAX(dt.data)::date FROM datas_turma dt WHERE dt.turma_id = t.id),
            (SELECT MAX(p.data_presenca)::date FROM presencas p WHERE p.turma_id = t.id),
            t.data_fim
          )::date,
          'YYYY-MM-DD'
        ) AS data_fim,
    
        COALESCE(
          (
            SELECT to_char(z.hi, 'HH24:MI') FROM (
              SELECT dt.horario_inicio AS hi, COUNT(*) c
              FROM datas_turma dt
              WHERE dt.turma_id = t.id
              GROUP BY dt.horario_inicio
              ORDER BY COUNT(*) DESC, hi
              LIMIT 1
            ) z
          ),
          to_char(t.horario_inicio, 'HH24:MI'),
          '08:00'
        ) AS horario_inicio,
    
        COALESCE(
          (
            SELECT to_char(z.hf, 'HH24:MI') FROM (
              SELECT dt.horario_fim As hf, COUNT(*) c
              FROM datas_turma dt
              WHERE dt.turma_id = t.id
              GROUP BY dt.horario_fim
              ORDER BY COUNT(*) DESC, hf
              LIMIT 1
            ) z
          ),
          to_char(t.horario_fim, 'HH24:MI'),
          '17:00'
        ) AS horario_fim,
    
        i.data_inscricao,
        string_agg(DISTINCT u.nome, ', ' ORDER BY u.nome) AS instrutor
    
      FROM inscricoes i
      JOIN turmas t ON i.turma_id = t.id
      JOIN eventos e ON t.evento_id = e.id
      LEFT JOIN evento_instrutor tp ON t.evento_id = tp.evento_id
      LEFT JOIN usuarios u ON u.id = tp.instrutor_id
      WHERE i.usuario_id = $1
      GROUP BY i.id, e.id, t.id
      ORDER BY COALESCE(
               (SELECT MAX(dt.data) FROM datas_turma dt WHERE dt.turma_id = t.id),
               t.data_fim
             ) DESC, 
               t.horario_fim DESC NULLS LAST;
      `,
      [usuario_id]
    );
    
    return res.json(resultado.rows);
  } catch (err) {
    console.error('❌ Erro ao buscar inscrições:', {
      message: err?.message, detail: err?.detail, code: err?.code
    });
    return res.status(500).json({ erro: 'Erro ao buscar inscrições.' });
  }
}

/* ────────────────────────────────────────────────────────────────
   📋 Inscritos por turma
   ──────────────────────────────────────────────────────────────── */
async function listarInscritosPorTurma(req, res) {
  const turmaId = Number(req.params.turma_id || req.params.turmaId);
  if (!Number.isFinite(turmaId)) {
    return res.status(400).json({ erro: "turmaId inválido" });
  }

  try {
    // 1) total de encontros (datas_turma)
    const { rows: diasRows } = await db.query(
      `SELECT COUNT(*)::int AS total_dias
         FROM datas_turma
        WHERE turma_id = $1`,
      [turmaId]
    );
    const totalDias = diasRows?.[0]?.total_dias || 0;

    // 2) presentes por usuário
    const { rows: presRows } = await db.query(
      `
      SELECT usuario_id,
             SUM(CASE WHEN presente THEN 1 ELSE 0 END)::int AS presentes
        FROM presencas
       WHERE turma_id = $1
       GROUP BY usuario_id
      `,
      [turmaId]
    );
    const presentesMap = new Map(
      presRows.map(r => [Number(r.usuario_id), Number(r.presentes)])
    );

    // 3) inscritos + dados extras
    const { rows } = await db.query(
      `
      SELECT 
        u.id  AS usuario_id,
        u.nome,
        u.cpf,
        u.registro,
        u.data_nascimento,
        u.deficiencia,         

        /* idade calculada */
        CASE
          WHEN u.data_nascimento IS NULL THEN NULL
          ELSE EXTRACT(YEAR FROM age(CURRENT_DATE, u.data_nascimento))::int
        END AS idade,

        /* flags PcD derivadas do TEXTO da coluna 'deficiencia' */
        CASE WHEN u.deficiencia ILIKE '%visual%'                        THEN TRUE ELSE FALSE END AS pcd_visual,
        CASE WHEN u.deficiencia ILIKE '%auditiva%' OR u.deficiencia ILIKE '%surdez%' OR u.deficiencia ILIKE '%surdo%' THEN TRUE ELSE FALSE END AS pcd_auditiva,
        CASE WHEN u.deficiencia ILIKE '%fisic%' OR u.deficiencia ILIKE '%locomot%'                                  THEN TRUE ELSE FALSE END AS pcd_fisica,
        CASE WHEN u.deficiencia ILIKE '%intelectual%' OR u.deficiencia ILIKE '%mental%'                             THEN TRUE ELSE FALSE END AS pcd_intelectual,
        CASE WHEN u.deficiencia ILIKE '%múltipla%' OR u.deficiencia ILIKE '%multipla%'                              THEN TRUE ELSE FALSE END AS pcd_multipla,
        CASE WHEN u.deficiencia ILIKE '%tea%' OR u.deficiencia ILIKE '%autis%'                                      THEN TRUE ELSE FALSE END AS pcd_autismo

      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.turma_id = $1
      ORDER BY u.nome ASC
      `,
      [turmaId]
    );

    // 4) saída com frequência
    const lista = rows.map(r => {
      const presentes = presentesMap.get(Number(r.usuario_id)) || 0;
      const frequencia = totalDias > 0 ? Math.round((presentes / totalDias) * 100) : null;

      return {
        usuario_id: r.usuario_id,
        nome: r.nome,
        cpf: r.cpf,

        idade: Number.isFinite(r.idade) ? r.idade : null,
        registro: r.registro || null,

        deficiencia: r.deficiencia || null,
        pcd_visual: !!r.pcd_visual,
        pcd_auditiva: !!r.pcd_auditiva,
        pcd_fisica: !!r.pcd_fisica,
        pcd_intelectual: !!r.pcd_intelectual,
        pcd_multipla: !!r.pcd_multipla,
        pcd_autismo: !!r.pcd_autismo,

        frequencia_num: frequencia,
        frequencia: frequencia != null ? `${frequencia}%` : null,
      };
    });

    return res.json(lista);
  } catch (err) {
    console.error("❌ Erro ao buscar inscritos:", {
      message: err?.message, detail: err?.detail, code: err?.code
    });
    return res.status(500).json({ erro: "Erro ao buscar inscritos." });
  }
}

/* ✅ Exportar */
module.exports = {
  inscreverEmTurma,
  cancelarMinhaInscricao,
  cancelarInscricaoAdmin,
  obterMinhasInscricoes,
  listarInscritosPorTurma,
};
