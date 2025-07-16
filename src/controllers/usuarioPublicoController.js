const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const enviarEmail = require('../utils/email');
const formatarPerfil = require('../utils/formatarPerfil');

// 🔐 Cadastro de novo usuário
async function cadastrarUsuario(req, res) {
  const { nome, cpf, email, senha, perfil } = req.body;

  if (!nome || !cpf || !email || !senha) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios.' });
  }

  const senhaForte = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  if (!senhaForte.test(senha)) {
    return res.status(400).json({
      erro: 'A senha deve conter ao menos 8 caracteres, incluindo letra maiúscula, minúscula, número e símbolo.'
    });
  }

  try {
    const existente = await db.query(
      'SELECT id FROM usuarios WHERE cpf = $1 OR email = $2',
      [cpf, email]
    );

    if (existente.rows.length > 0) {
      return res.status(400).json({ erro: 'CPF ou e-mail já cadastrado.' });
    }

    const senhaCriptografada = await bcrypt.hash(senha, 10);
    const perfilFinal = Array.isArray(perfil)
      ? perfil.map(p => p.toLowerCase().trim()).filter(p => p !== 'usuario').join(',')
      : perfil.toLowerCase().trim();

    const result = await db.query(
      `INSERT INTO usuarios (nome, cpf, email, senha, perfil)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nome, cpf, email, perfil`,
      [nome, cpf, email, senhaCriptografada, perfilFinal]
    );

    res.status(201).json({
      ...result.rows[0],
      perfil: perfilFinal.split(',')
    });
  } catch (err) {
    console.error('❌ Erro ao cadastrar usuário:', err);
    res.status(500).json({ erro: 'Erro ao cadastrar usuário.' });
  }
}

// 🔐 Recuperação de senha via e-mail
async function recuperarSenha(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ erro: 'E-mail é obrigatório.' });
  }

  try {
    const result = await db.query('SELECT id FROM usuarios WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(200).json({ mensagem: 'Se o e-mail estiver cadastrado, enviaremos as instruções.' });
    }

    const usuarioId = result.rows[0].id;
    const token = jwt.sign({ id: usuarioId }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const link = `http://localhost:5173/redefinir-senha/${token}`;

    await enviarEmail(email, 'Recuperação de Senha - Escola da Saúde', `
      <h3>Olá!</h3>
      <p>Você solicitou a redefinição de senha. Clique no link abaixo para criar uma nova senha:</p>
      <a href="${link}" target="_blank">Redefinir Senha</a>
      <p>Este link é válido por 1 hora.</p>
    `);

    res.status(200).json({ mensagem: 'Se o e-mail estiver cadastrado, enviamos um link de redefinição.' });

  } catch (err) {
    console.error('❌ Erro ao solicitar recuperação de senha:', err);
    res.status(500).json({ erro: 'Erro ao processar solicitação.' });
  }
}

// 🔐 Redefinição da senha
async function redefinirSenha(req, res) {
  const { token, novaSenha } = req.body;

  if (!token || !novaSenha) {
    return res.status(400).json({ erro: 'Token e nova senha são obrigatórios.' });
  }

  const senhaForte = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  if (!senhaForte.test(novaSenha)) {
    return res.status(400).json({
      erro: 'A nova senha deve conter ao menos 8 caracteres, incluindo letra maiúscula, minúscula, número e símbolo.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuarioId = decoded.id;
    const senhaCriptografada = await bcrypt.hash(novaSenha, 10);
    await db.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [senhaCriptografada, usuarioId]);
    res.status(200).json({ mensagem: 'Senha atualizada com sucesso.' });
  } catch (err) {
    console.error('❌ Erro ao redefinir senha:', err);
    res.status(400).json({ erro: 'Token inválido ou expirado.' });
  }
}

// 🆕 🔍 Obter dados do usuário por ID
async function obterUsuarioPorId(req, res) {
  const { id } = req.params;
  const usuarioLogado = req.usuario;

  if (Number(id) !== Number(usuarioLogado.id) && !usuarioLogado.perfil.includes("administrador")) {
    return res.status(403).json({ erro: "Sem permissão para acessar este usuário." });
  }

  try {
    const result = await db.query('SELECT id, nome, email FROM usuarios WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erro ao obter usuário:", err);
    res.status(500).json({ erro: "Erro ao buscar dados." });
  }
}

// 🆕 ✏️ Atualizar nome, email ou senha
async function atualizarUsuario(req, res) {
  const { id } = req.params;
  const usuarioLogado = req.usuario;

  if (Number(id) !== Number(usuarioLogado.id) && !usuarioLogado.perfil.includes("administrador")) {
    return res.status(403).json({ erro: "Sem permissão para alterar este usuário." });
  }

  const { nome, email, senha } = req.body;
  const campos = [];
  const valores = [];
  let index = 1;

  if (nome) {
    campos.push(`nome = $${index++}`);
    valores.push(nome);
  }
  if (email) {
    campos.push(`email = $${index++}`);
    valores.push(email);
  }
  if (senha) {
    const senhaHash = await bcrypt.hash(senha, 10);
    campos.push(`senha = $${index++}`);
    valores.push(senhaHash);
  }

  if (campos.length === 0) {
    return res.status(400).json({ erro: "Nenhum dado para atualizar." });
  }

  valores.push(id);
  const query = `UPDATE usuarios SET ${campos.join(", ")} WHERE id = $${index}`;

  try {
    await db.query(query, valores);
    res.status(200).json({ mensagem: "Usuário atualizado com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao atualizar usuário:", err);
    res.status(500).json({ erro: "Erro ao atualizar dados." });
  }
}

// 🔐 Login do usuário (por CPF e senha)
async function loginUsuario(req, res) {
  const { cpf, senha } = req.body; // ✅ Correto: usamos CPF

  if (!cpf || !senha) {
    return res.status(400).json({ erro: 'CPF e senha são obrigatórios.' });
  }

  try {
    const result = await db.query('SELECT * FROM usuarios WHERE cpf = $1', [cpf]); // ✅ Busca por CPF
    const usuario = result.rows[0];

    if (!usuario) {
      return res.status(401).json({ erro: 'Usuário não encontrado.' });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'Senha incorreta.' });
    }

    const perfilArray = usuario.perfil.split(',').map(p => p.trim().toLowerCase());

const token = jwt.sign(
  { id: usuario.id, perfil: perfilArray },
  process.env.JWT_SECRET,
  { expiresIn: '4h' }
);

res.status(200).json({
  mensagem: 'Login realizado com sucesso.',
  token,
  usuario: {
    id: usuario.id,
    nome: usuario.nome,
    cpf: usuario.cpf,
    email: usuario.email,
    perfil: perfilArray, // Agora é array em todo lugar!
  },
});
  } catch (err) {
    console.error('❌ Erro ao autenticar usuário:', err);
    res.status(500).json({ erro: 'Erro ao realizar login.' });
  }
}

// 🔍 Obter assinatura do usuário autenticado
async function obterAssinatura(req, res) {
  const usuarioId = req.usuario?.id;
  const perfil = req.usuario?.perfil || [];

  if (!usuarioId) {
    return res.status(401).json({ erro: 'Usuário não autenticado.' });
  }

  if (!perfil.includes("instrutor") && !perfil.includes("administrador")) {
    return res.status(403).json({ erro: 'Acesso restrito a instrutor ou administradoristradores.' });
  }

  try {
    const result = await db.query(
      'SELECT assinatura FROM usuarios WHERE id = $1',
      [usuarioId]
    );

    const assinatura = result.rows[0]?.assinatura || null;
    res.status(200).json({ assinatura });
  } catch (err) {
    console.error("❌ Erro ao buscar assinatura:", err);
    res.status(500).json({ erro: "Erro ao buscar assinatura." });
  }
}



module.exports = {
  cadastrarUsuario,
  recuperarSenha,
  redefinirSenha,
  obterUsuarioPorId,
  atualizarUsuario,
  loginUsuario,
  obterAssinatura,
};
