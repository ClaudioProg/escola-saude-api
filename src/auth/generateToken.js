// src/auth/generateToken.js
const jwt = require('jsonwebtoken');

/**
 * 🔐 Gera um token JWT com base no payload do usuário
 *
 * @param {Object} payload - Ex: { id, cpf, nome, perfil: ['administrador', 'usuario'] }
 * @param {string} [expiresIn='1d'] - Tempo de expiração do token (ex: '1d', '2h')
 * @returns {string} Token JWT assinado
 */
function generateToken(payload, expiresIn = '1d') {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('❌ JWT_SECRET não definido no .env');
  }

  // 🛡️ Cria e retorna o token assinado
  return jwt.sign(payload, secret, { expiresIn });
}

module.exports = generateToken;
