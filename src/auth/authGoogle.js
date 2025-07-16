// src/auth/authGoogle.js
const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const db = require('../db');

// 🔑 Inicializa o cliente OAuth com o Client ID do Google
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * 🔐 Rota de autenticação com Google
 * POST /api/auth/google
 */
router.post('/google', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ erro: 'Credencial não fornecida.' });
  }

  try {
    // 📥 Verifica e decodifica o token recebido do Google
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const nome = payload.name;

    // 🔎 Verifica se o usuário já existe
    let result = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);

    // ➕ Se não existir, cria novo usuário padrão
    if (result.rows.length === 0) {
      result = await db.query(
        `INSERT INTO usuarios (nome, email, cpf, senha, perfil)
         VALUES ($1, $2, NULL, NULL, 'usuario')
         RETURNING *`,
        [nome, email]
      );
    }

    const usuario = result.rows[0];

    // 🔄 Garante que o perfil seja array
    const perfil = typeof usuario.perfil === 'string'
    ? [usuario.perfil.trim().toLowerCase()]
    : [];

    // 🔐 Gera o token JWT
    const token = jwt.sign(
      {
        id: usuario.id,
        cpf: usuario.cpf || null,
        nome: usuario.nome,
        perfil: perfil,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // ✅ Retorna os dados de autenticação
    return res.json({
      token,
      perfil,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        cpf: usuario.cpf,
        perfil,
      }
    });

  } catch (err) {
    console.error('🔴 Erro ao autenticar com Google:', err.message);
    return res.status(401).json({ erro: 'Falha na autenticação com Google.' });
  }
});

module.exports = router;
