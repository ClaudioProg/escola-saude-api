const db = require('../db');
const bcrypt = require('bcrypt');
const generateToken = require('../auth/generateToken');
const formatarPerfil = require('../utils/formatarPerfil');
const { gerarNotificacoesDeAvaliacao } = require('./notificacoesController');

/**
 * 🎯 Controlador de login de usuário via CPF e senha
 * @route POST /api/login
 */
async function loginUsuario(req, res) {
  const { cpf, senha } = req.body;

  try {
    console.log("⚡ Iniciando processo de login para o CPF:", cpf);

    // 🔎 Busca o usuário pelo CPF com possível imagem_base64 da assinatura
    const result = await db.query(`
      SELECT u.*, a.imagem_base64
      FROM usuarios u
      LEFT JOIN assinaturas a ON a.usuario_id = u.id
      WHERE u.cpf = $1
    `, [cpf]);

    console.log("🔍 Resultado da query:", result.rows);

    if (result.rows.length === 0) {
      console.warn("⚠️ Nenhum usuário encontrado para o CPF:", cpf);
      return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }

    const usuario = result.rows[0];
    console.log("🧾 Usuário encontrado:", {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      imagem_base64: usuario.imagem_base64 ? '🖊️ assinatura presente' : '🚫 assinatura ausente',
    });

    // 🔐 Compara a senha enviada com o hash no banco
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    console.log("🔐 Validação de senha:", senhaValida);

    if (!senhaValida) {
      console.warn("⛔ Senha inválida para CPF:", cpf);
      return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }

    // 🔄 Garante que o perfil seja sempre um array
    const perfilArray = formatarPerfil(usuario.perfil);
    console.log("👤 Perfil formatado:", perfilArray);

    // 🔐 Gera token JWT com os dados essenciais
    const token = generateToken({
      id: usuario.id,
      cpf: usuario.cpf,
      nome: usuario.nome,
      perfil: perfilArray,
    });
    console.log("🔑 Token JWT gerado com sucesso");

    // 🛎️ Verifica e cria notificações de avaliação, se necessário
    await gerarNotificacoesDeAvaliacao(usuario.id);
    console.log("📨 Notificações de avaliação verificadas/geradas");

    // 📦 Retorna dados essenciais ao frontend
    res.json({
      mensagem: "Login realizado com sucesso.",
      token,
      perfil: perfilArray,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        cpf: usuario.cpf,
        perfil: perfilArray,
        imagem_base64: usuario.imagem_base64 || null, // ← valor opcional
      },
    });

    console.log("✅ Login finalizado com sucesso para o usuário:", usuario.nome);

  } catch (error) {
    console.error('❌ Erro no login:', error.message);
    res.status(500).json({ erro: 'Erro interno no servidor' });
  }
}

module.exports = { loginUsuario };
