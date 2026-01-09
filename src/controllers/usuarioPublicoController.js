// 📁 src/controllers/usuarioPublicoController.js
/* eslint-disable no-console */
const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { send: enviarEmail } = require("../utils/email");

// Base do Frontend para links de e-mail (Vercel em prod; localhost no dev)
const FRONTEND_URL_STATIC =
  (process.env.FRONTEND_URL && String(process.env.FRONTEND_URL).trim()) ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173");

/* ──────────────────────────────────────────────────────────────
   🔧 Utils/Normalizações
   ────────────────────────────────────────────────────────────── */
const SENHA_FORTE_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
const REGISTRO_MASK_RE = /^\d{2}\.\d{3}-\d$/; // ex.: 28.053-7 (opcional)

const REQUIRED_PROFILE_FIELDS = [
  "cargo_id",
  "unidade_id",
  "genero_id",
  "orientacao_sexual_id",
  "cor_raca_id",
  "escolaridade_id",
  "deficiencia_id",
  "data_nascimento",
];

// JWT extras opcionais (não quebra se ausentes)
const JWT_ISS = process.env.JWT_ISSUER || undefined;
const JWT_AUD = process.env.JWT_AUDIENCE || undefined;

function normEmail(v) { return String(v || "").trim().toLowerCase(); }
function onlyDigits(v) { return String(v || "").replace(/\D/g, ""); }
function normNome(v) { return String(v || "").trim(); }
function toDateOnly(v) {
  const s = String(v || "").slice(0, 10);
  return DATE_ONLY_RE.test(s) ? s : "";
}

/** Sempre formata o registro como 00.000-0 (usa somente os 6 primeiros dígitos) */
function toRegistroMasked(v) {
  const d = onlyDigits(v).slice(0, 6);
  if (d.length !== 6) return ""; // inválido
  return `${d.slice(0, 2)}.${d.slice(2, 5)}-${d.slice(5)}`;
}

/** Array -> CSV sem "usuario"; string/undefined -> "usuario" por padrão */
function toPerfilString(perfil) {
  if (Array.isArray(perfil)) {
    const arr = perfil.map((p) => String(p || "").toLowerCase().trim()).filter(Boolean);
    const semUsuario = arr.filter((p) => p !== "usuario");
    const finalArr = semUsuario.length ? semUsuario : ["usuario"];
    return finalArr.join(",");
  }
  return String(perfil || "usuario").toLowerCase().trim() || "usuario";
}
/** CSV -> array minúsculo, sem vazios */
function perfilToArray(perfilStr) {
  return String(perfilStr || "").split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
}

function camposFaltantes(u = {}) {
  return REQUIRED_PROFILE_FIELDS.filter((k) => u[k] === null || u[k] === undefined || u[k] === "");
}
function isPerfilIncompleto(u = {}) { return camposFaltantes(u).length > 0; }

/** Mapeia constraint -> campo provável (para 23514) */
const CHECK_TO_FIELD = {
  chk_cpf_valido: "cpf",
  chk_data_nascimento: "data_nascimento",
  chk_registro: "registro",
};

/** Converte erros do PG em mensagens amigáveis e por campo */
function traduzPgError(err) {
  const base = { message: "Erro ao processar solicitação.", fieldErrors: {} };
  const code = err?.code;

  if (code === "23505") {
    const c = String(err.constraint || "").toLowerCase();
    if (c.includes("cpf") || /cpf/i.test(err.detail || "")) {
      return { message: "CPF já cadastrado.", fieldErrors: { cpf: "Este CPF já está em uso." } };
    }
    if (c.includes("email") || /email/i.test(err.detail || "")) {
      return { message: "E-mail já cadastrado.", fieldErrors: { email: "Este e-mail já está em uso." } };
    }
    return { ...base, message: "Registro já existente." };
  }

  if (code === "23502") {
    const col = err?.column || "";
    if (col) base.fieldErrors[col] = "Campo obrigatório.";
    return { ...base, message: "Há campos obrigatórios não preenchidos." };
  }

  if (code === "22P02") {
    const msg = String(err.message || "").toLowerCase();
    if (msg.includes("date")) base.fieldErrors.data_nascimento = "Data inválida.";
    return { ...base, message: "Valor inválido em um ou mais campos." };
  }

  if (code === "23514") {
    const check = String(err.constraint || "").toLowerCase();
    for (const k in CHECK_TO_FIELD) {
      if (check.includes(k)) {
        const campo = CHECK_TO_FIELD[k];
        const fieldErrors = {};
        fieldErrors[campo] = campo === "registro"
          ? "Formato inválido. Use 00.000-0."
          : "Valor inválido.";
        return { message: "Algum campo não atende às regras de validação.", fieldErrors };
      }
    }
    return { ...base, message: "Algum campo não atende às regras de validação." };
  }

  if (code === "23503") {
    const d = String(err.detail || "").toLowerCase();
    const fieldErrors = {};
    ["unidade_id","cargo_id","genero_id","orientacao_sexual_id","cor_raca_id","escolaridade_id","deficiencia_id"]
      .forEach((k) => { if (d.includes(k)) fieldErrors[k] = "ID inexistente na referência."; });
    return { message: "Alguma referência informada não existe.", fieldErrors };
  }

  if (code === "42703") {
    return { ...base, message: "Erro de configuração no servidor." };
  }

  return base;
}

/** Verifica se um id existe em uma tabela (FK friendly) */
async function assertExists(table, id, field = "id") {
  if (id == null) return true;
  const q = `SELECT 1 FROM ${table} WHERE ${field} = $1 LIMIT 1`;
  const r = await db.query(q, [id]);
  return r.rowCount > 0;
}

/** Valida conjunto de campos do perfil complementar e retorna {ok, fieldErrors, message} */
async function validarPerfilComplementar({
  unidade_id, cargo_id, genero_id, orientacao_sexual_id,
  cor_raca_id, escolaridade_id, deficiencia_id,
  data_nascimento, registro,
}) {
  const fieldErrors = {};

  // obrigatórios
  const obrig = { unidade_id, cargo_id, genero_id, orientacao_sexual_id, cor_raca_id, escolaridade_id, deficiencia_id, data_nascimento };
  Object.entries(obrig).forEach(([k, v]) => { if (v === null || v === undefined || v === "") fieldErrors[k] = "Campo obrigatório."; });

  // data
  if (data_nascimento) {
    const d = toDateOnly(data_nascimento);
    if (!DATE_ONLY_RE.test(d)) {
      fieldErrors.data_nascimento = "Data inválida (use YYYY-MM-DD).";
    } else {
      const hoje = new Date();
      const dt = new Date(`${d}T00:00:00Z`);
      if (isNaN(dt.getTime())) fieldErrors.data_nascimento = "Data inválida.";
      else if (dt > hoje) fieldErrors.data_nascimento = "Data não pode ser futura.";
      else if (dt.getUTCFullYear() < 1900) fieldErrors.data_nascimento = "Ano inválido.";
    }
  }

  // registro (opcional): aceita máscara 00.000-0 ou somente dígitos (6–7)
  if (registro) {
    const masked = String(registro).trim();
    const digits = onlyDigits(registro);
    if (!(REGISTRO_MASK_RE.test(masked) || /^\d{6,7}$/.test(digits))) {
      fieldErrors.registro = "Formato inválido. Ex.: 28.053-7 (ou somente 6–7 dígitos).";
    }
  }

  // FKs
  const checks = [
    ["unidades", "unidade_id", unidade_id],
    ["cargos", "cargo_id", cargo_id],
    ["generos", "genero_id", genero_id],
    ["orientacoes_sexuais", "orientacao_sexual_id", orientacao_sexual_id],
    ["cores_racas", "cor_raca_id", cor_raca_id],
    ["escolaridades", "escolaridade_id", escolaridade_id],
    ["deficiencias", "deficiencia_id", deficiencia_id],
  ];

  for (const [table, key, value] of checks) {
    if (value != null) {
      const ok = await assertExists(table, value);
      if (!ok) fieldErrors[key] = "ID inexistente na referência.";
    }
  }

  const ok = Object.keys(fieldErrors).length === 0;
  return { ok, fieldErrors, message: ok ? null : "Erros de validação no formulário." };
}

/* ──────────────────────────────────────────────────────────────
   👤 Cadastro de novo usuário
   ────────────────────────────────────────────────────────────── */
async function cadastrarUsuario(req, res) {
  const nome = normNome(req.body?.nome);
  const cpf = onlyDigits(req.body?.cpf);
  const email = normEmail(req.body?.email);
  const senha = String(req.body?.senha || "");
  const perfil = req.body?.perfil;

  // campos de perfil (opcionais no momento do cadastro)
  const unidade_id = req.body?.unidade_id ?? null;
  const cargo_id = req.body?.cargo_id ?? null;
  const genero_id = req.body?.genero_id ?? null;
  const orientacao_sexual_id = req.body?.orientacao_sexual_id ?? null;
  const cor_raca_id = req.body?.cor_raca_id ?? null;
  const escolaridade_id = req.body?.escolaridade_id ?? null;
  const deficiencia_id = req.body?.deficiencia_id ?? null;
  const data_nascimento = req.body?.data_nascimento ? toDateOnly(req.body.data_nascimento) : null;
  const registro = req.body?.registro ? toRegistroMasked(req.body.registro) : null;

  const fieldErrors = {};
  if (!nome) fieldErrors.nome = "Nome é obrigatório.";
  if (!cpf) fieldErrors.cpf = "CPF é obrigatório.";
  if (!email) fieldErrors.email = "E-mail é obrigatório.";
  if (email && !EMAIL_RE.test(email)) fieldErrors.email = "E-mail inválido.";
  if (!senha) fieldErrors.senha = "Senha é obrigatória.";
  if (senha && !SENHA_FORTE_RE.test(senha)) {
    fieldErrors.senha = "Mín. 8 caracteres com maiúscula, minúscula, número e símbolo.";
  }
  if (Object.keys(fieldErrors).length) {
    return res.status(422).json({ message: "Erros de validação.", fieldErrors });
  }

  try {
    const existente = await db.query(
      "SELECT id FROM usuarios WHERE cpf = $1 OR LOWER(email) = LOWER($2)",
      [cpf, email]
    );
    if (existente.rows.length > 0) {
      return res.status(409).json({
        message: "CPF ou e-mail já cadastrado.",
        fieldErrors: { cpf: "Verifique o CPF.", email: "Verifique o e-mail." },
      });
    }

    const senhaCriptografada = await bcrypt.hash(senha, 10);
    const perfilFinal = toPerfilString(perfil);

    const insertSql = `
      INSERT INTO usuarios (
        nome, cpf, email, senha, perfil,
        unidade_id, cargo_id, genero_id, orientacao_sexual_id,
        cor_raca_id, escolaridade_id, deficiencia_id,
        data_nascimento, registro
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING
        id, nome, cpf, email, perfil,
        unidade_id, cargo_id, genero_id, orientacao_sexual_id,
        cor_raca_id, escolaridade_id, deficiencia_id, data_nascimento, registro
    `;

    const values = [
      nome, cpf, email, senhaCriptografada, perfilFinal,
      unidade_id, cargo_id, genero_id, orientacao_sexual_id,
      cor_raca_id, escolaridade_id, deficiencia_id,
      data_nascimento, registro,
    ];

    const result = await db.query(insertSql, values);
    const row = result.rows[0];

    const incompleto = isPerfilIncompleto(row);
    const faltantes = camposFaltantes(row);
    res.set("X-Perfil-Incompleto", incompleto ? "1" : "0");

    return res.status(201).json({
      ...row,
      perfil: perfilToArray(perfilFinal),
      perfilIncompleto: incompleto,
      camposFaltantes: faltantes,
    });
  } catch (err) {
    console.error("❌ Erro ao cadastrar usuário:", err);
    const payload = traduzPgError(err);
    const status = (err?.code === "23505") ? 409 : 500;
    return res.status(status).json(payload);
  }
}

/* ──────────────────────────────────────────────────────────────
   🔐 Recuperação de senha (idempotente)
   ────────────────────────────────────────────────────────────── */
async function recuperarSenha(req, res) {
  const email = normEmail(req.body?.email);
  if (!email) return res.status(422).json({ message: "Erros de validação.", fieldErrors: { email: "Informe o e-mail." } });
  if (!EMAIL_RE.test(email)) return res.status(422).json({ message: "Erros de validação.", fieldErrors: { email: "Formato inválido." } });

  try {
    const result = await db.query("SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)", [email]);
    if (result.rows.length === 0) {
      // Mensagem neutra (não vaza existência)
      return res.status(200).json({ mensagem: "Se o e-mail estiver cadastrado, enviaremos as instruções." });
    }

    const usuarioId = result.rows[0].id;
    if (!process.env.JWT_SECRET) {
      console.error("⚠️ JWT_SECRET ausente no ambiente.");
      return res.status(500).json({ message: "Configuração do servidor ausente." });
    }

    const token = jwt.sign(
      { id: usuarioId, typ: "pwd-reset" },
      process.env.JWT_SECRET,
      { expiresIn: "1h", issuer: JWT_ISS, audience: JWT_AUD }
    );

    const reqOrigin = req.headers.origin || "";
    const baseUrl =
      FRONTEND_URL_STATIC ||
      (process.env.NODE_ENV === "production" && /^https:\/\/.+/i.test(reqOrigin) ? reqOrigin : "https://seu-frontend-no-vercel.vercel.app");

    const safeBase = String(baseUrl).replace(/\/+$/, "");
    const link = `${safeBase}/redefinir-senha/${encodeURIComponent(token)}`;

    await enviarEmail({
      to: email,
      subject: "Recuperação de Senha - Escola da Saúde",
      text: `Você solicitou redefinição de senha. Acesse: ${link} (válido por 1h).`,
    });

    return res.status(200).json({ mensagem: "Se o e-mail estiver cadastrado, enviaremos as instruções." });
  } catch (err) {
    console.error("❌ Erro ao solicitar recuperação de senha:", err);
    return res.status(500).json({ message: "Erro ao processar solicitação." });
  }
}

/* ──────────────────────────────────────────────────────────────
   🔐 Redefinição da senha
   ────────────────────────────────────────────────────────────── */
async function redefinirSenha(req, res) {
  const token = String(req.body?.token || "");
  const novaSenha = String(req.body?.novaSenha || "");
  if (!token || !novaSenha) {
    return res.status(422).json({
      message: "Erros de validação.",
      fieldErrors: {
        token: !token ? "Token ausente." : undefined,
        novaSenha: !novaSenha ? "Informe a nova senha." : undefined
      }
    });
  }
  if (!SENHA_FORTE_RE.test(novaSenha)) {
    return res.status(422).json({
      message: "Erros de validação.",
      fieldErrors: { novaSenha: "A nova senha deve conter ao menos 8 caracteres, incluindo letra maiúscula, minúscula, número e símbolo." },
    });
  }
  if (!process.env.JWT_SECRET) {
    console.error("⚠️ JWT_SECRET ausente no ambiente.");
    return res.status(500).json({ message: "Configuração do servidor ausente." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { issuer: JWT_ISS, audience: JWT_AUD });
    if (decoded?.typ !== "pwd-reset" || !decoded?.id) return res.status(400).json({ message: "Token inválido." });
    const usuarioId = decoded.id;

    const senhaCriptografada = await bcrypt.hash(novaSenha, 10);
    await db.query("UPDATE usuarios SET senha = $1 WHERE id = $2", [senhaCriptografada, usuarioId]);

    return res.status(200).json({ mensagem: "Senha atualizada com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao redefinir senha:", err);
    return res.status(400).json({ message: "Token inválido ou expirado." });
  }
}

/* ──────────────────────────────────────────────────────────────
   🔍 Obter dados do usuário por ID (com fallback para coluna ausente)
   ────────────────────────────────────────────────────────────── */
async function obterUsuarioPorId(req, res) {
  const { id } = req.params;
  const usuarioLogado = req.user || {};
  const perfilArr = Array.isArray(usuarioLogado.perfil) ? usuarioLogado.perfil : perfilToArray(usuarioLogado.perfil);
  const ehAdmin = perfilArr.includes("administrador");
  if (Number(id) !== Number(usuarioLogado.id) && !ehAdmin) {
    return res.status(403).json({ message: "Sem permissão para acessar este usuário." });
  }

  const baseSelect = `
    id, nome, cpf, email, perfil,
    unidade_id, cargo_id, genero_id, orientacao_sexual_id,
    cor_raca_id, escolaridade_id, deficiencia_id,
    data_nascimento, registro, assinatura
  `;

  try {
    let result;
    try {
      result = await db.query(`SELECT ${baseSelect} FROM usuarios WHERE id = $1`, [id]);
    } catch (e) {
      if (e?.code === "42703") {
        // coluna 'assinatura' não existe — tenta sem ela
        result = await db.query(`
          SELECT id, nome, cpf, email, perfil,
                 unidade_id, cargo_id, genero_id, orientacao_sexual_id,
                 cor_raca_id, escolaridade_id, deficiencia_id,
                 data_nascimento, registro
          FROM usuarios WHERE id = $1
        `, [id]);
      } else {
        throw e;
      }
    }

    if (result.rows.length === 0) return res.status(404).json({ message: "Usuário não encontrado." });

    const row = result.rows[0];
    const incompleto = isPerfilIncompleto(row);
    const faltantes = camposFaltantes(row);
    res.set("X-Perfil-Incompleto", incompleto ? "1" : "0");

    return res.status(200).json({
      ...row,
      perfil: perfilToArray(row.perfil),
      perfilIncompleto: incompleto,
      camposFaltantes: faltantes,
    });
  } catch (err) {
    console.error("❌ Erro ao obter usuário:", err);
    return res.status(500).json({ message: "Erro ao buscar dados." });
  }
}

/* ──────────────────────────────────────────────────────────────
   ✏️ Atualizar dados básicos (nome/email/senha)
   ────────────────────────────────────────────────────────────── */
async function atualizarUsuario(req, res) {
  const { id } = req.params;
  const usuarioLogado = req.user || {};
  const perfilArr = Array.isArray(usuarioLogado.perfil) ? usuarioLogado.perfil : perfilToArray(usuarioLogado.perfil);
  const ehAdmin = perfilArr.includes("administrador");
  if (Number(id) !== Number(usuarioLogado.id) && !ehAdmin) {
    return res.status(403).json({ message: "Sem permissão para alterar este usuário." });
  }

  const nome = req.body?.nome != null ? normNome(req.body.nome) : undefined;
  const email = req.body?.email != null ? normEmail(req.body.email) : undefined;
  const senha = req.body?.senha != null ? String(req.body.senha) : undefined;

  const fieldErrors = {};
  if (email != null && email !== "" && !EMAIL_RE.test(email)) fieldErrors.email = "E-mail inválido.";
  if (senha != null && senha !== "" && !SENHA_FORTE_RE.test(senha)) fieldErrors.senha = "Mín. 8 caracteres com maiúscula, minúscula, número e símbolo.";
  if (Object.keys(fieldErrors).length) return res.status(422).json({ message: "Erros de validação.", fieldErrors });

  const campos = [];
  const valores = [];
  let index = 1;
  if (nome != null && nome !== "") { campos.push(`nome = $${index++}`); valores.push(nome); }
  if (email != null && email !== "") { campos.push(`email = $${index++}`); valores.push(email); }
  if (senha != null && senha !== "") { const senhaHash = await bcrypt.hash(senha, 10); campos.push(`senha = $${index++}`); valores.push(senhaHash); }
  if (campos.length === 0) return res.status(422).json({ message: "Erros de validação.", fieldErrors: { _global: "Nenhum dado para atualizar." } });

  valores.push(id);
  const queryStr = `UPDATE usuarios SET ${campos.join(", ")} WHERE id = $${index}`;

  try {
    await db.query(queryStr, valores);
    const { rows } = await db.query(
      `SELECT unidade_id, cargo_id, genero_id, orientacao_sexual_id,
              cor_raca_id, escolaridade_id, deficiencia_id, data_nascimento
         FROM usuarios WHERE id = $1`, [id]
    );
    const u = rows[0] || {};
    const incompleto = isPerfilIncompleto(u);
    const faltantes = camposFaltantes(u);
    res.set("X-Perfil-Incompleto", incompleto ? "1" : "0");

    return res.status(200).json({ mensagem: "Usuário atualizado com sucesso.", perfilIncompleto: incompleto, camposFaltantes: faltantes });
  } catch (err) {
    console.error("❌ Erro ao atualizar usuário:", err);
    const payload = traduzPgError(err);
    const status = (err?.code === "23505") ? 409 : 500;
    return res.status(status).json(payload);
  }
}

/* ──────────────────────────────────────────────────────────────
   🧩 Atualização do PERFIL COMPLEMENTAR (tela “Atualizar cadastro”)
   ────────────────────────────────────────────────────────────── */
async function atualizarPerfilCompleto(req, res) {
  const { id } = req.params;
  const usuarioLogado = req.user || {};
  const perfilArr = Array.isArray(usuarioLogado.perfil) ? usuarioLogado.perfil : perfilToArray(usuarioLogado.perfil);
  const ehAdmin = perfilArr.includes("administrador");
  if (Number(id) !== Number(usuarioLogado.id) && !ehAdmin) {
    return res.status(403).json({ message: "Sem permissão para alterar este usuário." });
  }

  // Campos do perfil complementar
  const payload = {
    unidade_id: req.body?.unidade_id ?? null,
    cargo_id: req.body?.cargo_id ?? null,
    genero_id: req.body?.genero_id ?? null,
    orientacao_sexual_id: req.body?.orientacao_sexual_id ?? null,
    cor_raca_id: req.body?.cor_raca_id ?? null,
    escolaridade_id: req.body?.escolaridade_id ?? null,
    deficiencia_id: req.body?.deficiencia_id ?? null,
    data_nascimento: req.body?.data_nascimento ? toDateOnly(req.body.data_nascimento) : "",
    registro: req.body?.registro ? req.body.registro : "",
  };

  // Validação de formulário (por campo)
  const { ok, fieldErrors, message } = await validarPerfilComplementar(payload);
  if (!ok) return res.status(422).json({ message, fieldErrors });

  // Normalização final → salvar sempre MASCARADO
  const toSave = { ...payload, registro: payload.registro ? toRegistroMasked(payload.registro) : null };

  // Monta UPDATE dinâmico
  const campos = [];
  const valores = [];
  let i = 1;
  Object.entries(toSave).forEach(([k, v]) => {
    campos.push(`${k} = $${i++}`);
    valores.push(v === "" ? null : v);
  });
  valores.push(id);

  const sql = `UPDATE usuarios SET ${campos.join(", ")} WHERE id = $${i}`;

  try {
    await db.query(sql, valores);

    const { rows } = await db.query(
      `SELECT id, nome, cpf, email, perfil,
              unidade_id, cargo_id, genero_id, orientacao_sexual_id,
              cor_raca_id, escolaridade_id, deficiencia_id,
              data_nascimento, registro
         FROM usuarios WHERE id = $1`, [id]
    );
    const row = rows[0];
    const incompleto = isPerfilIncompleto(row);
    const faltantes = camposFaltantes(row);
    res.set("X-Perfil-Incompleto", incompleto ? "1" : "0");

    return res.status(200).json({
      mensagem: "Perfil atualizado com sucesso.",
      usuario: { ...row, perfil: perfilToArray(row.perfil) },
      perfilIncompleto: incompleto,
      camposFaltantes: faltantes,
    });
  } catch (err) {
    console.error("❌ Erro ao atualizar perfil:", err);
    const payload = traduzPgError(err);
    let status = 500;
    if (["23503","23514","23502","22P02"].includes(err?.code)) status = 422;
    if (err?.code === "23505") status = 409;
    return res.status(status).json(payload);
  }
}

/* ──────────────────────────────────────────────────────────────
   🔐 Login (CPF + senha)
   ────────────────────────────────────────────────────────────── */
async function loginUsuario(req, res) {
  const cpf = onlyDigits(req.body?.cpf);
  const senha = String(req.body?.senha || "");
  if (!cpf || !senha) {
    const fieldErrors = {};
    if (!cpf) fieldErrors.cpf = "Informe o CPF.";
    if (!senha) fieldErrors.senha = "Informe a senha.";
    return res.status(422).json({ message: "Erros de validação.", fieldErrors });
  }

  try {
    const result = await db.query("SELECT * FROM usuarios WHERE cpf = $1", [cpf]);
    const usuario = result.rows[0];
    if (!usuario) return res.status(401).json({ message: "Usuário não encontrado.", fieldErrors: { cpf: "Verifique o CPF." } });

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta) return res.status(401).json({ message: "Senha incorreta.", fieldErrors: { senha: "Senha inválida." } });

    const perfilArray = perfilToArray(usuario.perfil);
    if (!process.env.JWT_SECRET) {
      console.error("⚠️ JWT_SECRET ausente no ambiente.");
      return res.status(500).json({ message: "Configuração do servidor ausente." });
    }

    const incompleto = isPerfilIncompleto(usuario);
    const faltantes = camposFaltantes(usuario);
    res.set("X-Perfil-Incompleto", incompleto ? "1" : "0");

    const token = jwt.sign(
      { id: usuario.id, perfil: perfilArray },
      process.env.JWT_SECRET,
      { expiresIn: "4h", issuer: JWT_ISS, audience: JWT_AUD }
    );

    return res.status(200).json({
      mensagem: "Login realizado com sucesso.",
      token,
      usuario: { id: usuario.id, nome: usuario.nome, cpf: usuario.cpf, email: usuario.email, perfil: perfilArray },
      perfilIncompleto: incompleto,
      camposFaltantes: faltantes,
    });
  } catch (err) {
    console.error("❌ Erro ao realizar login:", err);
    return res.status(500).json({ message: "Erro ao realizar login." });
  }
}

/* ──────────────────────────────────────────────────────────────
   ✍️ Obter assinatura (instrutor/admin)
   ────────────────────────────────────────────────────────────── */
async function obterAssinatura(req, res) {
  const usuarioId = req.user?.id;
  const perfilArr = Array.isArray(req.user?.perfil) ? req.user.perfil : perfilToArray(req.user?.perfil);
  if (!usuarioId) return res.status(401).json({ message: "Usuário não autenticado." });
  if (!perfilArr.includes("instrutor") && !perfilArr.includes("administrador")) {
    return res.status(403).json({ message: "Acesso restrito a instrutor ou administradores." });
  }

  try {
    const result = await db.query("SELECT assinatura FROM usuarios WHERE id = $1", [usuarioId]);
    const assinatura = result.rows[0]?.assinatura || null;
    return res.status(200).json({ assinatura });
  } catch (err) {
    console.error("❌ Erro ao buscar assinatura:", err);
    return res.status(500).json({ message: "Erro ao buscar assinatura." });
  }
}

/* ──────────────────────────────────────────────────────────────
   🔎 Busca de usuários para autocomplete (palestrantes, etc.)
   GET /usuarios/busca?search=...&roles=instrutor,administrador&unidade_id=#
   (roles e unidade_id são opcionais; retrocompatível)
   ────────────────────────────────────────────────────────────── */
async function buscarUsuarios(req, res) {
  const search = String(req.query.search || "").trim();

  if (!search || search.length < 3) {
    return res.status(400).json({
      message: "Envie ao menos 3 caracteres para busca.",
      fieldErrors: { search: "Mínimo de 3 caracteres." },
    });
  }

  try {
    const like = `%${search}%`;

    // Filtros opcionais
    const rolesCsv = String(req.query.roles || "").trim();
    const roles = rolesCsv
      ? rolesCsv.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean)
      : null;

    const unidadeId = req.query.unidade_id != null ? Number(req.query.unidade_id) : null;
    const filtros = ["(nome ILIKE $1 OR email ILIKE $1)"];
    const params = [like];
    let idx = 2;

    if (unidadeId && Number.isFinite(unidadeId)) {
      filtros.push(`unidade_id = $${idx++}`);
      params.push(unidadeId);
    }

    // Consulta base
    const baseSql = `
      SELECT id, nome, email, perfil, unidade_id
        FROM usuarios
       WHERE ${filtros.join(" AND ")}
       ORDER BY nome
       LIMIT 20
    `;

    const { rows } = await db.query(baseSql, params);

    // Filtro por role (se fornecido) — feito em memória para manter compat
    const filtrado = roles && roles.length
      ? rows.filter((u) => {
          const p = perfilToArray(u.perfil);
          return roles.some((r) => p.includes(r));
        })
      : rows;

    const resultado = filtrado.map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      perfil: perfilToArray(u.perfil),
      unidade_id: u.unidade_id,
    }));

    return res.status(200).json(resultado);
  } catch (err) {
    console.error("❌ Erro ao buscar usuários:", err);
    return res.status(500).json({ message: "Erro ao buscar usuários." });
  }
}

module.exports = {
  cadastrarUsuario,
  recuperarSenha,
  redefinirSenha,
  obterUsuarioPorId,
  atualizarUsuario,         // dados básicos
  atualizarPerfilCompleto,  // cadastro complementar
  loginUsuario,
  obterAssinatura,
  buscarUsuarios,
};
