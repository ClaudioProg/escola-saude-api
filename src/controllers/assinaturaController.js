// src/controllers/assinaturaController.js
const db = require('../db');

/**
 * 🖋️ Retorna a assinatura (imagem base64) do usuário autenticado
 * @route GET /api/assinatura
 */
async function getAssinatura(req, res) {
  const usuario_id = req.usuario?.id;

  if (!usuario_id) {
    return res.status(401).json({ erro: "Usuário não autenticado." });
  }

  try {
    const result = await db.query(
      'SELECT imagem_base64 FROM assinaturas WHERE usuario_id = $1',
      [usuario_id]
    );

    const assinatura = result.rows[0]?.imagem_base64 || null;
    res.status(200).json({ assinatura });
  } catch (error) {
    console.error('❌ Erro ao buscar assinatura:', error.message);
    res.status(500).json({ erro: 'Erro ao buscar assinatura.' });
  }
}

/**
 * ✍️ Salva ou atualiza a assinatura (imagem base64) do usuário autenticado
 * @route POST /api/assinatura
 */
async function salvarAssinatura(req, res) {
  const usuario_id = req.usuario?.id;
  const { assinatura } = req.body;

  if (!usuario_id) {
    return res.status(401).json({ erro: "Usuário não autenticado." });
  }

  if (!assinatura) {
    return res.status(400).json({ erro: 'Assinatura é obrigatória.' });
  }

  try {
    const existe = await db.query(
      'SELECT 1 FROM assinaturas WHERE usuario_id = $1',
      [usuario_id]
    );

    if (existe.rowCount > 0) {
      await db.query(
        'UPDATE assinaturas SET imagem_base64 = $1 WHERE usuario_id = $2',
        [assinatura, usuario_id]
      );
    } else {
      await db.query(
        'INSERT INTO assinaturas (usuario_id, imagem_base64) VALUES ($1, $2)',
        [usuario_id, assinatura]
      );
    }

    res.status(200).json({ mensagem: 'Assinatura salva com sucesso.' });
  } catch (error) {
    console.error('❌ Erro ao salvar assinatura:', error.message);
    res.status(500).json({ erro: 'Erro ao salvar assinatura.' });
  }
}

module.exports = {
  getAssinatura,
  salvarAssinatura,
};
