const db = require('../db');
const bcrypt = require('bcrypt');
const generateToken = require('../auth/generateToken');
const formatarPerfil = require('../utils/formatarPerfil');

/**
 * 🎯 Controlador de login de usuário via CPF e senha
 * @route POST /api/login
 */
async function loginUsuario(req, res) {
  const { cpf, senha } = req.body;

  try {
    // 🔎 Busca o usuário pelo CPF
    const result = await db.query('SELECT * FROM usuarios WHERE cpf = $1', [cpf]);

    if (result.rows.length === 0) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }

    const usuario = result.rows[0];

    // 🔐 Compara a senha enviada com o hash no banco
    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }

    // 🔄 Garante que o perfil seja sempre um array
    const perfilArray = formatarPerfil(usuario.perfil);

    // 🔐 Gera token JWT com os dados essenciais
    const token = generateToken({
      id: usuario.id,
      cpf: usuario.cpf,
      nome: usuario.nome,
      perfil: perfilArray, // Sempre array!
    });

    // 📦 Retorna dados essenciais ao frontend
    res.json({
      token,
      perfil: perfilArray, // Sempre array!
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        cpf: usuario.cpf,
        perfil: perfilArray, // Sempre array!
      },
    });
  } catch (error) {
    console.error('❌ Erro no login:', error.message);
    res.status(500).json({ erro: 'Erro interno no servidor' });
  }
}

module.exports = { loginUsuario };
