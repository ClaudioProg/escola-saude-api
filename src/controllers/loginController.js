// 📁 src/controllers/loginController.js
const db = require("../db");
const bcrypt = require("bcrypt");
const generateToken = require("../auth/generateToken");
const formatarPerfil = require("../utils/formatarPerfil");
const { gerarNotificacoesDeAvaliacao } = require("./notificacoesController");

/**
 * 🎯 Login de usuário via CPF e senha
 * @route POST /api/usuarios/login
 */
async function loginUsuario(req, res) {
  try {
    const cpfRaw = String(req.body?.cpf || "");
    const senha = String(req.body?.senha || "");

    // ✅ validação básica
    if (!cpfRaw || !senha) {
      return res.status(400).json({ erro: "CPF e senha são obrigatórios." });
    }

    // 🔢 normaliza CPF para apenas dígitos (compatível com cadastro)
    const cpf = cpfRaw.replace(/\D/g, "");

    // 🔎 busca usuário + assinatura (se houver)
    const result = await db.query(
      `
      SELECT u.*, a.imagem_base64
      FROM usuarios u
      LEFT JOIN assinaturas a ON a.usuario_id = u.id
      WHERE u.cpf = $1
      `,
      [cpf]
    );

    if (result.rows.length === 0) {
      // não revela se cpf existe — mantém mensagem genérica
      return res.status(401).json({ erro: "Usuário ou senha inválidos." });
    }

    const usuario = result.rows[0];

    // 🔐 valida senha
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: "Usuário ou senha inválidos." });
    }

    // 👤 perfil sempre array
    const perfilArray = formatarPerfil(usuario.perfil);

    // 🔑 JWT (usa helper generateToken do projeto)
    const token = generateToken({
      id: usuario.id,
      cpf: usuario.cpf,
      nome: usuario.nome,
      perfil: perfilArray,
    });

    // 🛎️ notifs de avaliação
    try {
      await gerarNotificacoesDeAvaliacao(usuario.id);
    } catch (e) {
      // não bloqueia o login em caso de falha nas notificações
      console.warn("⚠️ Falha ao gerar notificações de avaliação:", e?.message || e);
    }

    // 📦 resposta padronizada
    return res.status(200).json({
      mensagem: "Login realizado com sucesso.",
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        cpf: usuario.cpf,
        perfil: perfilArray,
        imagem_base64: usuario.imagem_base64 || null,
      },
    });
  } catch (error) {
    console.error("❌ Erro no login:", error?.message || error);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
}

module.exports = { loginUsuario };
