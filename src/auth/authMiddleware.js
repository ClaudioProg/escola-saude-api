// src/auth/authMiddleware.js
const jwt = require('jsonwebtoken');
const db = require('../db'); // ✅ Importa a conexão com o banco

/**
 * 🔐 Middleware para autenticação via token JWT
 * - Verifica se o token está presente e é válido
 * - Decodifica o token e injeta os dados do usuário em `req.usuario`
 * - Injeta a conexão com o banco em `req.db`
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  // 🚫 Verifica se o header de autorização está presente e começa com 'Bearer '
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token de autenticação ausente ou mal formatado.' });
  }

  const token = authHeader.split(' ')[1]; // Extrai apenas o token após 'Bearer'

  try {
    // ✅ Verifica e decodifica o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔄 Garante que o perfil esteja sempre como array
    const perfil = Array.isArray(decoded.perfil)
      ? decoded.perfil
      : typeof decoded.perfil === 'string'
        ? decoded.perfil.split(',').map(p => p.trim())
        : [];

    // 🔁 Injeta os dados do usuário e a conexão com o banco na requisição
    req.usuario = {
      id: decoded.id,
      cpf: decoded.cpf,
      nome: decoded.nome,
      perfil,
    };

    req.db = db; // ✅ Agora todos os middlewares e controllers autenticados terão acesso ao banco

    next(); // 🟢 Libera a requisição para a próxima função
  } catch (error) {
    console.error('🔴 Erro ao verificar token JWT:', error.message);
    return res.status(403).json({ erro: 'Token inválido ou expirado.' });
  }
}

module.exports = authMiddleware;
