const db = require('../db');
const enviarEmail = require('../utils/email');
const { formatarDataBR } = require('../utils/data'); // ✅ Novo import

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

    const usuarioResult = await db.query('SELECT nome, email FROM usuarios WHERE id = $1', [usuario_id]);
    const eventoResult = await db.query(
      `SELECT e.titulo 
       FROM eventos e 
       JOIN turmas t ON t.evento_id = e.id 
       WHERE t.id = $1`,
      [turma_id]
    );

    const html = `
      <h2>Olá, ${usuarioResult.rows[0].nome}!</h2>
      <p>Sua inscrição no evento <strong>${eventoResult.rows[0].titulo}</strong> foi confirmada com sucesso.</p>
      <p><strong>Turma:</strong> ${turma.nome}<br/>
      <strong>Período:</strong> ${formatarDataBR(turma.data_inicio)} a ${formatarDataBR(turma.data_fim)}</p>
      <p>Leve seu QR Code no dia para registrar presença.</p>
      <p>Atenciosamente,<br/>Equipe da Escola da Saúde</p>`;

    await enviarEmail(
      usuarioResult.rows[0].email,
      '✅ Inscrição Confirmada – Escola da Saúde',
      html
    ).catch((erroEmail) => {
      console.error('⚠️ Erro ao enviar e-mail de confirmação:', erroEmail.message);
    });

    res.status(201).json({
      mensagem: 'Inscrição realizada com sucesso.',
      inscricao: result.rows[0],
      turma: {
        nome: turma.nome,
        data_inicio: turma.data_inicio,
        data_fim: turma.data_fim
      }
    });
  } catch (err) {
    console.error('❌ Erro geral ao realizar inscrição:', err);
    res.status(500).json({ erro: 'Erro interno ao realizar inscrição.' });
  }
}

// ❌ Cancelar inscrição (usuário pode cancelar só a própria)
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
        i.data_inscricao,
        string_agg(DISTINCT u.nome, ', ' ORDER BY u.nome) AS instrutor
      FROM inscricoes i
      JOIN turmas t ON i.turma_id = t.id
      JOIN eventos e ON t.evento_id = e.id
      LEFT JOIN evento_instrutor tp ON t.evento_id = tp.evento_id
      LEFT JOIN usuarios u ON u.id = tp.instrutor_id
      WHERE i.usuario_id = $1
      GROUP BY i.id, e.id, t.id
      ORDER BY i.data_inscricao DESC`,
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

module.exports = {
  inscreverEmTurma,
  cancelarMinhaInscricao,
  obterMinhasInscricoes,
  listarInscritosPorTurma
};
