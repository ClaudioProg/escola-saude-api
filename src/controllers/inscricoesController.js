/* eslint-disable no-console */
const db = require('../db');
const { send: enviarEmail } = require('../utils/email');
const { criarNotificacao } = require('./notificacoesController');

/* ──────────────────────────────────────────────────────────────
   Helpers de datas/horários (sem "pulo" de fuso)
   ────────────────────────────────────────────────────────────── */

/** Normaliza qualquer valor para "YYYY-MM-DD" (string) sem criar Date p/ date-only. */
function toYmd(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;                 // já YMD
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);    // ISO → recorta
  }
  // fallback (usa UTC para não sofrer fuso)
  const d = new Date(value);
  if (isNaN(d)) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** "YYYY-MM-DD" -> "dd/MM/aaaa" (sem criar Date). */
function ymdToBr(ymd) {
  if (!ymd || typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

/** Monta string de período amigável. */
function montarPeriodo(inicioYmd, fimYmd) {
  const a = toYmd(inicioYmd);
  const b = toYmd(fimYmd);
  if (a && b) {
    if (a === b) return ymdToBr(a); // 1 dia só
    return `${ymdToBr(a)} a ${ymdToBr(b)}`;
  }
  if (a) return ymdToBr(a);
  if (b) return ymdToBr(b);
  return 'não informado';
}

/** Formata hora para "HH:mm". Aceita "HH:mm:ss" / "HH:mm". */
function toHm(h) {
  if (!h) return '';
  if (typeof h === 'string') return h.slice(0, 5);
  // se vier como Date (improvável aqui), usa UTC:
  const d = new Date(h);
  if (isNaN(d)) return '';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Retorna {inicioYmd, fimYmd} a partir de datas_turma da turma. */
async function obterPeriodoDaTurma(turmaId) {
  const q = await db.query(
    `SELECT MIN(data) AS di, MAX(data) AS df
       FROM datas_turma
      WHERE turma_id = $1`,
    [turmaId]
  );
  const row = q.rows[0] || {};
  return {
    inicioYmd: toYmd(row.di),
    fimYmd: toYmd(row.df),
  };
}

/** Retorna horários "moda" da turma (par mais frequente). */
async function obterHorariosModaDaTurma(turmaId) {
  const q = await db.query(
    `SELECT horario_inicio, horario_fim, COUNT(*) AS c
       FROM datas_turma
      WHERE turma_id = $1
   GROUP BY horario_inicio, horario_fim
   ORDER BY COUNT(*) DESC, horario_inicio NULLS LAST, horario_fim NULLS LAST
      LIMIT 1`,
    [turmaId]
  );
  const row = q.rows[0];
  if (!row) return { inicio: '', fim: '' };
  return {
    inicio: toHm(row.horario_inicio),
    fim: toHm(row.horario_fim),
  };
}

/* ──────────────────────────────────────────────────────────────
   ➕ Inscrever-se em uma turma
   ────────────────────────────────────────────────────────────── */
async function inscreverEmTurma(req, res) {
  const usuario_id = req.usuario.id;
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

    // 5) NOVA REGRA: uma turma por evento (exceto congresso)
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
        return res.status(409).json({
          erro: 'Você já está inscrito em uma turma deste evento.'
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

    // 8.1) Período da TURMA via datas_turma
    const { inicioYmd, fimYmd } = await obterPeriodoDaTurma(turma_id);
    const periodoStr = montarPeriodo(inicioYmd, fimYmd);

    // 8.2) Horários: par mais frequente em datas_turma (fallback: campos da turma)
    let { inicio: horaIni, fim: horaFim } = await obterHorariosModaDaTurma(turma_id);
    if (!horaIni && turma.horario_inicio) horaIni = toHm(turma.horario_inicio);
    if (!horaFim && turma.horario_fim)   horaFim = toHm(turma.horario_fim);
    const horarioStr = (horaIni && horaFim) ? `${horaIni} às ${horaFim}` : (horaIni || horaFim || '—');

    // 9) Notificação (best-effort)
    try {
      const mensagem = `
✅ Sua inscrição foi confirmada com sucesso no evento "${evento.titulo}".

- Turma: ${turma.nome}
- Período: ${periodoStr}
- Horário: ${horarioStr}
- Carga horária: ${turma.carga_horaria} horas
- Local: ${evento.local}
      `.trim();

      await criarNotificacao(usuario_id, mensagem, null, "/eventos");
    } catch (e) {
      console.error('⚠️ Falha ao criar notificação (não bloqueante):', e?.message);
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
            <strong>Horário:</strong> ${horarioStr}<br/>
            <strong>Carga horária:</strong> ${turma.carga_horaria} horas<br/>
            <strong>Local:</strong> ${evento.local}
          </p>
          <p>📍 Em caso de dúvidas, entre em contato com a equipe da Escola da Saúde.</p>
          <p>Atenciosamente,<br/><strong>Equipe da Escola da Saúde</strong></p>
        `;

        await enviarEmail({
          to: usuario.email,
          subject: '✅ Inscrição Confirmada – Escola da Saúde',
          text: `Olá, ${usuario.nome}!

Sua inscrição foi confirmada com sucesso no evento "${evento.titulo}".

Turma: ${turma.nome}
Período: ${periodoStr}
Horário: ${horarioStr}
Carga horária: ${turma.carga_horaria} horas
Local: ${evento.local}

Atenciosamente,
Equipe da Escola da Saúde`,
          html
        });
      } else {
        console.warn('⚠️ E-mail do usuário ausente — pulando envio.');
      }
    } catch (e) {
      console.error('⚠️ Falha ao enviar e-mail (não bloqueante):', e?.message);
    }

    return res.status(201).json({ mensagem: 'Inscrição realizada com sucesso' });

  } catch (err) {
    if (err?.code === 'P0001' ||
        (typeof err?.message === 'string' &&
         err.message.toLowerCase().includes('inscrito em uma turma deste evento'))) {
      return res.status(409).json({
        erro: 'Você já está inscrito em uma turma deste evento.'
      });
    }
    if (err?.code === '23505') {
      return res.status(409).json({ erro: 'Usuário já inscrito nesta turma.' });
    }

    console.error('❌ Erro ao processar inscrição:', {
      message: err?.message,
      detail: err?.detail,
      code: err?.code,
      stack: err?.stack
    });
    return res.status(500).json({ erro: 'Erro ao processar inscrição.' });
  }
}

/* ──────────────────────────────────────────────────────────────
   ❌ Cancelar inscrição
   ────────────────────────────────────────────────────────────── */
async function cancelarMinhaInscricao(req, res) {
  const usuario_id = req.usuario.id;
  const { id } = req.params;

  try {
    const result = await db.query('SELECT * FROM inscricoes WHERE id = $1', [id]);
    const inscricao = result.rows[0];

    if (!inscricao) {
      return res.status(404).json({ erro: 'Inscrição não encontrada.' });
    }

    if (inscricao.usuario_id !== usuario_id && !req.usuario.perfil?.includes('administrador')) {
      return res.status(403).json({ erro: 'Você não tem permissão para cancelar esta inscrição.' });
    }

    await db.query('DELETE FROM inscricoes WHERE id = $1', [id]);

    return res.json({ mensagem: 'Inscrição cancelada com sucesso.' });
  } catch (err) {
    console.error('❌ Erro ao cancelar inscrição:', {
      message: err?.message, detail: err?.detail, code: err?.code
    });
    return res.status(500).json({ erro: 'Erro ao cancelar inscrição.' });
  }
}

/* ──────────────────────────────────────────────────────────────
   🔍 Minhas inscrições (datas agregadas de datas_turma)
   ────────────────────────────────────────────────────────────── */
async function obterMinhasInscricoes(req, res) {
  try {
    const usuario_id = req.usuario.id;

    const resultado = await db.query(
      `SELECT 
          i.id AS inscricao_id, 
          e.id AS evento_id, 
          t.id AS turma_id,
          e.titulo, 
          e.local,
          -- período agregado da turma
          (SELECT MIN(d.data) FROM datas_turma d WHERE d.turma_id = t.id) AS data_inicio,
          (SELECT MAX(d.data) FROM datas_turma d WHERE d.turma_id = t.id) AS data_fim,
          -- horários (mantém campos antigos se existir)
          t.horario_inicio,
          t.horario_fim,
          i.data_inscricao,
          string_agg(DISTINCT u.nome, ', ' ORDER BY u.nome) AS instrutor
        FROM inscricoes i
        JOIN turmas t ON i.turma_id = t.id
        JOIN eventos e ON t.evento_id = e.id
        LEFT JOIN evento_instrutor tp ON t.evento_id = tp.evento_id
        LEFT JOIN usuarios u ON u.id = tp.instrutor_id
        WHERE i.usuario_id = $1
        GROUP BY i.id, e.id, t.id
        ORDER BY 3 DESC, 2 DESC`,
      [usuario_id]
    );

    // normaliza date-only p/ string "YYYY-MM-DD"
    const rows = resultado.rows.map(r => ({
      ...r,
      data_inicio: toYmd(r.data_inicio),
      data_fim: toYmd(r.data_fim),
      horario_inicio: toHm(r.horario_inicio) || null,
      horario_fim: toHm(r.horario_fim) || null,
    }));

    return res.json(rows);
  } catch (err) {
    console.error('❌ Erro ao buscar inscrições:', {
      message: err?.message, detail: err?.detail, code: err?.code
    });
    return res.status(500).json({ erro: 'Erro ao buscar inscrições.' });
  }
}

/* ──────────────────────────────────────────────────────────────
   📋 Inscritos por turma
   ────────────────────────────────────────────────────────────── */
async function listarInscritosPorTurma(req, res) {
  const { turma_id } = req.params;

  try {
    const result = await db.query(
      `SELECT 
         u.id AS usuario_id, 
         u.nome, 
         u.cpf,
         EXISTS (
           SELECT 1 
           FROM presencas p
           WHERE p.usuario_id = u.id 
             AND p.turma_id = $1 
             AND p.data_presenca = CURRENT_DATE
         ) AS presente
       FROM inscricoes i
       JOIN usuarios u ON u.id = i.usuario_id
       WHERE i.turma_id = $1
       ORDER BY u.nome`,
      [turma_id]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar inscritos:", {
      message: err?.message, detail: err?.detail, code: err?.code
    });
    return res.status(500).json({ erro: "Erro ao buscar inscritos." });
  }
}

/* ──────────────────────────────────────────────────────────────
   ✅ Exportar
   ────────────────────────────────────────────────────────────── */
module.exports = {
  inscreverEmTurma,
  cancelarMinhaInscricao,
  obterMinhasInscricoes,
  listarInscritosPorTurma,
};
