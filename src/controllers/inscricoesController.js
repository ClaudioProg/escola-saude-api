const db = require('../db');
const { send: enviarEmail } = require('../utils/email');
const { formatarDataBR } = require('../utils/data');
const { criarNotificacao } = require('./notificacoesController');

// ➕ Inscrever-se em uma turma
async function inscreverEmTurma(req, res) {
  const usuario_id = req.usuario.id;
  const { turma_id } = req.body;

  if (!turma_id) {
    return res.status(400).json({ erro: 'ID da turma é obrigatório.' });
  }

  try {
    const turmaResult = await db.query('SELECT * FROM turmas WHERE id = $1', [turma_id]);
    if (turmaResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Turma não encontrada.' });
    }

    const turma = turmaResult.rows[0];

    const duplicado = await db.query(
      'SELECT 1 FROM inscricoes WHERE usuario_id = $1 AND turma_id = $2',
      [usuario_id, turma_id]
    );
    if (duplicado.rows.length > 0) {
      return res.status(409).json({ erro: 'Usuário já inscrito nesta turma.' });
    }

    const inscricoesAtuais = await db.query(
      'SELECT COUNT(*) FROM inscricoes WHERE turma_id = $1',
      [turma_id]
    );
    const totalInscritos = parseInt(inscricoesAtuais.rows[0].count, 10);
    const totalVagas = parseInt(turma.vagas_total, 10);

    if (isNaN(totalVagas)) {
      return res.status(500).json({ erro: 'Número de vagas inválido para a turma.' });
    }

    if (totalInscritos >= totalVagas) {
      return res.status(400).json({ erro: 'Turma lotada. Vagas esgotadas.' });
    }

    const result = await db.query(
      `INSERT INTO inscricoes (usuario_id, turma_id, data_inscricao) 
       VALUES ($1, $2, NOW()) 
       RETURNING *`,
      [usuario_id, turma_id]
    );

    if (result.rowCount === 0) {
      return res.status(500).json({ erro: 'Erro ao registrar inscrição no banco.' });
    }

    // Buscar título do evento e local
    const eventoResult = await db.query(
      'SELECT titulo, local FROM eventos WHERE id = $1',
      [turma.evento_id]
    );
    const evento = eventoResult.rows[0];
    const tituloEvento = evento?.titulo || "Evento";
    const localEvento = evento?.local || "A definir";

    // ✅ Notificação detalhada
    const mensagem = `
✅ Sua inscrição foi confirmada com sucesso no evento "${tituloEvento}".

- Turma: ${turma.nome}
- Período: ${formatarDataBR(turma.data_inicio)} a ${formatarDataBR(turma.data_fim)}
- Horário: ${turma.horario_inicio?.slice(0,5)} às ${turma.horario_fim?.slice(0,5)}
- Carga horária: ${turma.carga_horaria} horas
- Local: ${localEvento}
    `.trim();

    await criarNotificacao(
      usuario_id,
      mensagem,
      null,
      "/eventos"
    );

    // Buscar dados do usuário
    const usuarioResult = await db.query('SELECT nome, email FROM usuarios WHERE id = $1', [usuario_id]);
    const usuario = usuarioResult.rows[0];

    if (!usuario || !usuario.email) {
      console.error('❌ E-mail do usuário não encontrado.');
      return res.status(400).json({ erro: 'E-mail do usuário não está cadastrado.' });
    }

    const html = `
      <h2>Olá, ${usuario.nome}!</h2>
      <p>Sua inscrição foi confirmada com sucesso.</p>

      <h3>📌 Detalhes da Inscrição</h3>
      <p>
        <strong>Evento:</strong> ${tituloEvento}<br/>
        <strong>Turma:</strong> ${turma.nome}<br/>
        <strong>Período:</strong> ${formatarDataBR(turma.data_inicio)} a ${formatarDataBR(turma.data_fim)}<br/>
        <strong>Horário:</strong> ${turma.horario_inicio?.slice(0,5)} às ${turma.horario_fim?.slice(0,5)}<br/>
        <strong>Carga horária:</strong> ${turma.carga_horaria} horas<br/>
        <strong>Local:</strong> ${localEvento}
      </p>

      <p>📍 Em caso de dúvidas, entre em contato com a equipe da Escola da Saúde.</p>

      <p>Atenciosamente,<br/>
      <strong>Equipe da Escola da Saúde</strong></p>
    `;

    await enviarEmail({
      to: usuario.email,
      subject: '✅ Inscrição Confirmada – Escola da Saúde',
      text: `Olá, ${usuario.nome}!

Sua inscrição foi confirmada com sucesso no evento "${tituloEvento}".

Turma: ${turma.nome}
Período: ${formatarDataBR(turma.data_inicio)} a ${formatarDataBR(turma.data_fim)}
Horário: ${turma.horario_inicio?.slice(0,5)} às ${turma.horario_fim?.slice(0,5)}
Carga horária: ${turma.carga_horaria} horas
Local: ${localEvento}

Atenciosamente,
Equipe da Escola da Saúde`,
      html: html
    });

    return res.status(201).json({ mensagem: 'Inscrição realizada com sucesso' });

  } catch (err) {
    console.error('❌ Erro ao processar inscrição:', err);
    res.status(500).json({ erro: 'Erro ao processar inscrição.' });
  }
}

// ❌ Cancelar inscrição
async function cancelarMinhaInscricao(req, res) {
  const usuario_id = req.usuario.id;
  const { id } = req.params;

  try {
    const result = await db.query('SELECT * FROM inscricoes WHERE id = $1', [id]);
    const inscricao = result.rows[0];

    if (!inscricao) {
      return res.status(404).json({ erro: 'Inscrição não encontrada.' });
    }

    if (inscricao.usuario_id !== usuario_id && !req.usuario.perfil.includes('administrador')) {
      return res.status(403).json({ erro: 'Você não tem permissão para cancelar esta inscrição.' });
    }

    await db.query('DELETE FROM inscricoes WHERE id = $1', [id]);

    res.json({ mensagem: 'Inscrição cancelada com sucesso.' });
  } catch (err) {
    console.error('❌ Erro ao cancelar inscrição:', err);
    res.status(500).json({ erro: 'Erro ao cancelar inscrição.' });
  }
}

// 🔍 Minhas inscrições
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
  t.data_inicio, 
  t.data_fim, 
  t.horario_inicio,  -- ✅ adicionado
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
ORDER BY t.data_fim DESC, t.horario_fim DESC NULLS LAST`,
      [usuario_id]
    );

    res.json(resultado.rows);
  } catch (err) {
    console.error('❌ Erro ao buscar inscrições:', err);
    res.status(500).json({ erro: 'Erro ao buscar inscrições.' });
  }
}

// 📋 Inscritos por turma
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

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar inscritos:", err);
    res.status(500).json({ erro: "Erro ao buscar inscritos." });
  }
}

// ✅ Exportar
module.exports = {
  inscreverEmTurma,
  cancelarMinhaInscricao,
  obterMinhasInscricoes,
  listarInscritosPorTurma,
};
