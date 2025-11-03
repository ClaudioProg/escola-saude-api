// 📁 src/controllers/inscricoesController.js
/* eslint-disable no-console */
const db = require('../db');
const { send: enviarEmail } = require('../utils/email');
const { formatarDataBR } = require('../utils/data');
const { criarNotificacao } = require('./notificacoesController');

/* ────────────────────────────────────────────────────────────────
   Helpers de datas/horários a partir de datas_turma
   (mantidos para compor e-mail e mensagens; sem usar Date())
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
   🔒 Checagens de conflito — 100% no SQL (sem fuso, sem Date())
   ──────────────────────────────────────────────────────────────── */

/**
 * Usa a função SQL criada: fn_tem_conflito_inscricao_mesmo_evento(usuario_id, turma_id)
 * Retorna true/false.
 */
async function conflitoMesmoEventoSQL(usuarioId, turmaId) {
  const q = `
    SELECT fn_tem_conflito_inscricao_mesmo_evento($1, $2) AS conflito
  `;
  const { rows } = await db.query(q, [usuarioId, turmaId]);
  return !!rows?.[0]?.conflito;
}

/**
 * 🧠 Conflito GLOBAL baseado em datas reais da tabela datas_turma.
 * Retorna true se houver pelo menos uma data coincidente entre a turma-alvo e
 * qualquer turma já inscrita pelo usuário, e se os horários se sobrepuserem.
 */
async function conflitoGlobalSQL(usuarioId, turmaIdAlvo) {
  const q = `
    WITH alvo AS (
      SELECT dt.data, dt.horario_inicio, dt.horario_fim
      FROM datas_turma dt
      WHERE dt.turma_id = $2
    )
    SELECT EXISTS (
      SELECT 1
      FROM inscricoes i
      JOIN datas_turma d2 ON d2.turma_id = i.turma_id
      JOIN alvo a ON a.data = d2.data
      WHERE i.usuario_id = $1
        AND i.turma_id <> $2
        AND (
          (a.horario_inicio, a.horario_fim)
          OVERLAPS
          (d2.horario_inicio, d2.horario_fim)
        )
    ) AS conflito;
  `;

  try {
    const { rows } = await db.query(q, [usuarioId, turmaIdAlvo]);
    const conflito = !!rows?.[0]?.conflito;

    // 🧩 Log estratégico em modo dev
    if (process.env.NODE_ENV !== "production") {
      console.log("[CONFLITO-GLOBAL]", {
        usuarioId,
        turmaIdAlvo,
        conflito,
      });
    }

    return conflito;
  } catch (err) {
    console.error("❌ Erro em conflitoGlobalSQL:", {
      message: err?.message,
      detail: err?.detail,
      code: err?.code,
      stack: err?.stack,
    });
    return false; // fallback seguro
  }
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

    // Resumo calculado (período e horários apenas para exibição/e-mail)
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

    // 5A) Congresso: bloquear conflito DENTRO DO MESMO EVENTO (via função SQL)
    if (isCongresso) {
      const temConflitoMesmoEvento = await conflitoMesmoEventoSQL(usuario_id, turma_id);
      if (temConflitoMesmoEvento) {
        return res.status(409).json({
          erro: 'Conflito de horário dentro deste evento com outra turma já inscrita.'
        });
      }
    }

    // 5B) Regra GLOBAL: bloquear conflito de horário com QUALQUER outra inscrição (via SQL)
    {
      const temConflitoGlobal = await conflitoGlobalSQL(usuario_id, turma_id);
      if (temConflitoGlobal) {
        return res.status(409).json({
          erro: 'Conflito de horário com outra turma já inscrita em seu histórico.'
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
          erro: e?.message || 'Inscrição bloqueada por conflito de horário.'
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

    // 9) Datas legíveis (sem criar Date())
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
        t.nome AS turma_nome,
        e.titulo, 
        e.local,
    
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

/* ────────────────────────────────────────────────────────────────
   🔎 Checagem de conflito para o frontend (uma turma específica)
   ──────────────────────────────────────────────────────────────── */
   async function conflitoPorTurma(req, res) {
    try {
      const usuarioId = Number(req.user?.id);
      const turmaId = Number(req.params?.turmaId || req.params?.turma_id);
  
      if (!usuarioId || !turmaId) {
        return res.status(400).json({ erro: "Parâmetros inválidos." });
      }
  
      // 1️⃣ Dados básicos da turma (para saber a que evento pertence)
      const { rows: trows } = await db.query(
        "SELECT evento_id FROM turmas WHERE id = $1",
        [turmaId]
      );
      if (!trows.length) {
        return res.status(404).json({ erro: "Turma não encontrada." });
      }
      const eventoId = trows[0].evento_id;
  
      // 2️⃣ Checagem de conflito dentro do mesmo evento (congressos etc.)
      const conflitoMesmoEvento = await conflitoMesmoEventoSQL(usuarioId, turmaId);
  
      // 3️⃣ Checagem global (qualquer outro evento)
      const conflitoGlobal = await conflitoGlobalSQL(usuarioId, turmaId);
  
      // 4️⃣ Consolidado (se houver qualquer conflito)
      const conflitoGeral = conflitoMesmoEvento || conflitoGlobal;
  
      return res.json({
        usuario_id: usuarioId,
        turma_id: turmaId,
        evento_id: eventoId,
        conflitoMesmoEvento,
        conflitoGlobal,
        conflito: conflitoGeral,
      });
    } catch (err) {
      console.error("❌ Erro em conflitoPorTurma:", {
        message: err?.message,
        detail: err?.detail,
        stack: err?.stack,
      });
      return res.status(500).json({ erro: "Erro ao verificar conflito de horários." });
    }
  }

/* ✅ Exportar */
module.exports = {
  inscreverEmTurma,
  cancelarMinhaInscricao,
  cancelarInscricaoAdmin,
  obterMinhasInscricoes,
  listarInscritosPorTurma,
  conflitoPorTurma,
};
