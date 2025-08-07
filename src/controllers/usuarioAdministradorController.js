// src/controllers/usuarioAdministradorController.js

const db = require('../db');

// Listar todos os usuários (administrador)
async function listarUsuarios(req, res) {
  try {
    const result = await db.query(
      'SELECT id, nome, cpf, email, perfil FROM usuarios ORDER BY nome'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao listar usuários:', err);
    res.status(500).json({ erro: 'Erro ao listar usuários.' });
  }
}

// Buscar usuário por ID (administrador ou o próprio usuário)
async function buscarUsuarioPorId(req, res) {
  const { id } = req.params;
  const solicitanteId = req.usuario.id;
  const isadministrador = req.usuario.perfil.includes('administrador');

  if (!isadministrador && Number(id) !== solicitanteId) {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }

  try {
    const result = await db.query(
      'SELECT id, nome, cpf, email, perfil FROM usuarios WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erro ao buscar usuário:', err);
    res.status(500).json({ erro: 'Erro ao buscar usuário.' });
  }
}

// Atualizar usuário (administrador ou o próprio usuário)
async function atualizarUsuario(req, res) {
  const { id } = req.params;
  const { nome, email, perfil } = req.body;
  const solicitanteId = req.usuario.id;
  const isadministrador = req.usuario.perfil.includes('administrador');

  if (!isadministrador && Number(id) !== solicitanteId) {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }
  if (!nome || !email) {
    return res.status(400).json({ erro: 'Nome e e-mail são obrigatórios.' });
  }

  let perfilFinal = undefined;
  if (perfil && isadministrador) {
    perfilFinal = Array.isArray(perfil)
      ? perfil.map(p => p.toLowerCase().trim()).join(',')
      : perfil.toLowerCase().trim();
  }

  try {
    const result = await db.query(
      `UPDATE usuarios
         SET nome = $1,
             email = $2
             ${perfilFinal !== undefined ? ', perfil = $3' : ''}
       WHERE id = $4
       RETURNING id, nome, cpf, email, perfil`,
      perfilFinal !== undefined
        ? [nome, email, perfilFinal, id]
        : [nome, email, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erro ao atualizar usuário:', err);
    res.status(500).json({ erro: 'Erro ao atualizar usuário.' });
  }
}

// Excluir usuário (apenas administrador)
async function excluirUsuario(req, res) {
  const { id } = req.params;
  const isadministrador = req.usuario.perfil.includes('administrador');

  if (!isadministrador) {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }

  try {
    const result = await db.query(
      'DELETE FROM usuarios WHERE id = $1 RETURNING id, nome, cpf, email, perfil',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }
    res.json({ mensagem: 'Usuário excluído com sucesso.', usuario: result.rows[0] });
  } catch (err) {
    console.error('❌ Erro ao excluir usuário:', err);
    res.status(500).json({ erro: 'Erro ao excluir usuário.' });
  }
}

/// 📋 Listar usuários que já atuaram como instrutor
async function listarinstrutor(req, res) {
  try {
    const result = await db.query(`
      SELECT 
        u.id, 
        u.nome, 
        u.email,

        COUNT(DISTINCT ei.evento_id) AS eventos_ministrados,

        ROUND(AVG(
          CASE a.desempenho_instrutor
            WHEN 'Ótimo' THEN 5
            WHEN 'Bom' THEN 4
            WHEN 'Regular' THEN 3
            WHEN 'Ruim' THEN 2
            WHEN 'Péssimo' THEN 1
            ELSE NULL
          END
        )::numeric, 1) AS media_avaliacao,

        CASE WHEN s.id IS NOT NULL THEN true ELSE false END AS possui_assinatura

      FROM usuarios u
      JOIN evento_instrutor ei ON ei.instrutor_id = u.id
      JOIN eventos e ON e.id = ei.evento_id
      LEFT JOIN turmas t ON t.evento_id = e.id
      LEFT JOIN avaliacoes a ON a.turma_id = t.id AND a.instrutor_id = u.id
      LEFT JOIN assinaturas s ON s.usuario_id = u.id

      GROUP BY u.id, u.nome, u.email, s.id
      ORDER BY u.nome
    `);

    const instrutor = result.rows.map(row => ({
      id: row.id,
      nome: row.nome,
      email: row.email,
      eventosMinistrados: row.eventos_ministrados,
      mediaAvaliacao: parseFloat(row.media_avaliacao) || null,
      possuiAssinatura: row.possui_assinatura,
    }));

    res.json(instrutor);
  } catch (err) {
    console.error('❌ Erro ao listar instrutor:', err);
    res.status(500).json({ erro: 'Erro ao listar instrutor.' });
  }
}

// Atualizar perfil do usuário (apenas administrador)
async function atualizarPerfil(req, res) {
  const { id } = req.params;
  const { perfil } = req.body;

  if (!req.usuario.perfil.includes("administrador")) {
    return res.status(403).json({ erro: "Acesso negado." });
  }

  const perfilValido = ['usuario', 'instrutor', 'administrador'];
  const perfilFinal = Array.isArray(perfil)
    ? perfil
        .map(p => p.toLowerCase().trim())
        .filter(p => perfilValido.includes(p))
        .join(',')
    : '';

  if (!perfilFinal) {
    return res.status(400).json({ erro: 'Perfil inválido ou vazio.' });
  }

  try {
    const result = await db.query(
      'UPDATE usuarios SET perfil = $1 WHERE id = $2 RETURNING id, nome, email, perfil',
      [perfilFinal, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erro ao atualizar perfil:', err);
    res.status(500).json({ erro: 'Erro ao atualizar perfil.' });
  }
}

module.exports = {
  listarUsuarios,
  buscarUsuarioPorId,
  atualizarUsuario,
  excluirUsuario,
  listarinstrutor,
  atualizarPerfil,
};
