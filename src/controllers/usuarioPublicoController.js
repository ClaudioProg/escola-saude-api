// 📁 src/controllers/usuarioPublicoController.js
const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { send: enviarEmail } = require("../utils/email");

// Base do Frontend para links de e-mail (Vercel em prod; localhost no dev)
const FRONTEND_URL_STATIC =
  (process.env.FRONTEND_URL && String(process.env.FRONTEND_URL).trim()) ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173");

// 🔐 util: normalizações
function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}
function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}
function normNome(v) {
  return String(v || "").trim();
}
function toPerfilString(perfil) {
  if (Array.isArray(perfil)) {
    return perfil
      .map((p) => String(p || "").toLowerCase().trim())
      .filter((p) => p && p !== "usuario")
      .join(",");
  }
  return String(perfil || "usuario").toLowerCase().trim();
}
function perfilToArray(perfilStr) {
  return String(perfilStr || "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

// 🔐 Regex de senha forte (mesma do frontend)
const SENHA_FORTE_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

// 🔐 Cadastro de novo usuário
async function cadastrarUsuario(req, res) {
  const nome = normNome(req.body?.nome);
  const cpf = onlyDigits(req.body?.cpf);
  const email = normEmail(req.body?.email);
  const senha = String(req.body?.senha || "");
  const perfil = req.body?.perfil;

  if (!nome || !cpf || !email || !senha) {
    return res.status(400).json({ erro: "Todos os campos são obrigatórios." });
  }
  if (!SENHA_FORTE_RE.test(senha)) {
    return res.status(400).json({
      erro:
        "A senha deve conter ao menos 8 caracteres, incluindo letra maiúscula, minúscula, número e símbolo.",
    });
  }

  try {
    const existente = await db.query(
      "SELECT id FROM usuarios WHERE cpf = $1 OR LOWER(email) = LOWER($2)",
      [cpf, email]
    );

    if (existente.rows.length > 0) {
      return res.status(400).json({ erro: "CPF ou e-mail já cadastrado." });
    }

    const senhaCriptografada = await bcrypt.hash(senha, 10);
    const perfilFinal = toPerfilString(perfil);

    const result = await db.query(
      `INSERT INTO usuarios (nome, cpf, email, senha, perfil)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nome, cpf, email, perfil`,
      [nome, cpf, email, senhaCriptografada, perfilFinal]
    );

    return res.status(201).json({
      ...result.rows[0],
      perfil: perfilToArray(perfilFinal),
    });
  } catch (err) {
    console.error("❌ Erro ao cadastrar usuário:", err);
    return res.status(500).json({ erro: "Erro ao cadastrar usuário." });
  }
}

// 🔐 Recuperação de senha via e-mail (idempotente)
async function recuperarSenha(req, res) {
  const email = normEmail(req.body?.email);
  if (!email) {
    return res.status(400).json({ erro: "E-mail é obrigatório." });
  }
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!isEmail) {
    return res.status(400).json({ erro: "E-mail inválido." });
  }

  try {
    const result = await db.query(
      "SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    // Sempre retorna 200 (não revela se existe ou não)
    if (result.rows.length === 0) {
      return res.status(200).json({
        mensagem: "Se o e-mail estiver cadastrado, enviaremos as instruções.",
      });
    }

    const usuarioId = result.rows[0].id;

    if (!process.env.JWT_SECRET) {
      console.error("⚠️ JWT_SECRET ausente no ambiente.");
      return res.status(500).json({ erro: "Configuração do servidor ausente." });
    }

    // Token com propósito explícito
    const token = jwt.sign(
      { id: usuarioId, typ: "pwd-reset" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Base do link
    const reqOrigin = req.headers.origin || "";
    const baseUrl =
      FRONTEND_URL_STATIC ||
      (process.env.NODE_ENV === "production" && /^https:\/\/.+/i.test(reqOrigin)
        ? reqOrigin
        : "https://seu-frontend-no-vercel.vercel.app");

    const safeBase = String(baseUrl).replace(/\/+$/, "");
    // ❗️Se sua página usa /redefinir-senha/:token, mantenha a linha abaixo:
    const link = `${safeBase}/redefinir-senha/${encodeURIComponent(token)}`;
    // alternativa com querystring:
    // const link = `${safeBase}/redefinir-senha?token=${encodeURIComponent(token)}`;

    // Envio de e-mail (formato objeto)
    await enviarEmail({
      to: email,
      subject: "Recuperação de Senha - Escola da Saúde",
      text: `Você solicitou a redefinição de senha. Acesse: ${link} (válido por 1h).`,
      // se seu util suportar html, pode enviar html também
      // html: `<p>...</p>`
    });

    return res.status(200).json({
      mensagem: "Se o e-mail estiver cadastrado, enviaremos as instruções.",
    });
  } catch (err) {
    console.error("❌ Erro ao solicitar recuperação de senha:", err);
    return res.status(500).json({ erro: "Erro ao processar solicitação." });
  }
}

// 🔐 Redefinição da senha
async function redefinirSenha(req, res) {
  const token = String(req.body?.token || "");
  const novaSenha = String(req.body?.novaSenha || "");

  if (!token || !novaSenha) {
    return res
      .status(400)
      .json({ erro: "Token e nova senha são obrigatórios." });
  }
  if (!SENHA_FORTE_RE.test(novaSenha)) {
    return res.status(400).json({
      erro:
        "A nova senha deve conter ao menos 8 caracteres, incluindo letra maiúscula, minúscula, número e símbolo.",
    });
  }
  if (!process.env.JWT_SECRET) {
    console.error("⚠️ JWT_SECRET ausente no ambiente.");
    return res.status(500).json({ erro: "Configuração do servidor ausente." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded?.typ !== "pwd-reset" || !decoded?.id) {
      return res.status(400).json({ erro: "Token inválido." });
    }

    const usuarioId = decoded.id;
    const senhaCriptografada = await bcrypt.hash(novaSenha, 10);

    await db.query("UPDATE usuarios SET senha = $1 WHERE id = $2", [
      senhaCriptografada,
      usuarioId,
    ]);

    return res.status(200).json({ mensagem: "Senha atualizada com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao redefinir senha:", err);
    // jwt.verify pode lançar TokenExpiredError, JsonWebTokenError, etc.
    return res.status(400).json({ erro: "Token inválido ou expirado." });
  }
}

// 🔍 Obter dados do usuário por ID
async function obterUsuarioPorId(req, res) {
  const { id } = req.params;
  const usuarioLogado = req.usuario || {};

  if (
    Number(id) !== Number(usuarioLogado.id) &&
    !Array.isArray(usuarioLogado.perfil) ||
    (Array.isArray(usuarioLogado.perfil) && !usuarioLogado.perfil.includes("administrador"))
  ) {
    return res
      .status(403)
      .json({ erro: "Sem permissão para acessar este usuário." });
  }

  try {
    const result = await db.query(
      "SELECT id, nome, email FROM usuarios WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erro ao obter usuário:", err);
    return res.status(500).json({ erro: "Erro ao buscar dados." });
  }
}

// ✏️ Atualizar nome, email ou senha
async function atualizarUsuario(req, res) {
  const { id } = req.params;
  const usuarioLogado = req.usuario || {};

  const ehAdmin = Array.isArray(usuarioLogado.perfil) && usuarioLogado.perfil.includes("administrador");
  if (Number(id) !== Number(usuarioLogado.id) && !ehAdmin) {
    return res
      .status(403)
      .json({ erro: "Sem permissão para alterar este usuário." });
  }

  const nome = req.body?.nome != null ? normNome(req.body.nome) : undefined;
  const email = req.body?.email != null ? normEmail(req.body.email) : undefined;
  const senha = req.body?.senha != null ? String(req.body.senha) : undefined;

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
    if (!SENHA_FORTE_RE.test(senha)) {
      return res.status(400).json({
        erro:
          "A senha deve conter ao menos 8 caracteres, incluindo letra maiúscula, minúscula, número e símbolo.",
      });
    }
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
    return res.status(200).json({ mensagem: "Usuário atualizado com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao atualizar usuário:", err);
    return res.status(500).json({ erro: "Erro ao atualizar dados." });
  }
}

// 🔐 Login do usuário (por CPF e senha)
async function loginUsuario(req, res) {
  const cpf = onlyDigits(req.body?.cpf);
  const senha = String(req.body?.senha || "");

  if (!cpf || !senha) {
    return res.status(400).json({ erro: "CPF e senha são obrigatórios." });
  }

  try {
    const result = await db.query("SELECT * FROM usuarios WHERE cpf = $1", [
      cpf,
    ]);
    const usuario = result.rows[0];

    if (!usuario) {
      return res.status(401).json({ erro: "Usuário não encontrado." });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: "Senha incorreta." });
    }

    const perfilArray = perfilToArray(usuario.perfil);

    if (!process.env.JWT_SECRET) {
      console.error("⚠️ JWT_SECRET ausente no ambiente.");
      return res.status(500).json({ erro: "Configuração do servidor ausente." });
    }

    const token = jwt.sign(
      { id: usuario.id, perfil: perfilArray },
      process.env.JWT_SECRET,
      { expiresIn: "4h" }
    );

    return res.status(200).json({
      mensagem: "Login realizado com sucesso.",
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        cpf: usuario.cpf,
        email: usuario.email,
        perfil: perfilArray,
      },
    });
  } catch (err) {
    console.error("❌ Erro ao realizar login:", err);
    return res.status(500).json({ erro: "Erro ao realizar login." });
  }
}

// 🔍 Obter assinatura do usuário autenticado
async function obterAssinatura(req, res) {
  const usuarioId = req.usuario?.id;
  const perfil = req.usuario?.perfil || [];

  if (!usuarioId) {
    return res.status(401).json({ erro: "Usuário não autenticado." });
  }

  if (!perfil.includes("instrutor") && !perfil.includes("administrador")) {
    return res
      .status(403)
      .json({ erro: "Acesso restrito a instrutor ou administradores." });
  }

  try {
    const result = await db.query(
      "SELECT assinatura FROM usuarios WHERE id = $1",
      [usuarioId]
    );

    const assinatura = result.rows[0]?.assinatura || null;
    return res.status(200).json({ assinatura });
  } catch (err) {
    console.error("❌ Erro ao buscar assinatura:", err);
    return res.status(500).json({ erro: "Erro ao buscar assinatura." });
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
