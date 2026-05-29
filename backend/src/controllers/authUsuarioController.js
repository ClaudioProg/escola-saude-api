/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/authUsuarioController.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Cadastro público de usuário com perfil preenchido no cadastro.
 * - Recuperação de senha.
 * - Redefinição de senha.
 *
 * Contrato oficial:
 * - Cadastro público sempre cria perfil "usuario".
 * - Perfil é string única, não array.
 * - Redefinição de senha recebe token somente pelo body.
 * - Não aceitar token por req.params.
 * - Link enviado por e-mail pode conter token na rota do frontend.
 * - A API oficial permanece POST /api/auth/redefinir-senha.
 *
 * Padrão:
 * - Sem aliases.
 * - Sem múltiplas possibilidades.
 * - Sem compatibilidade legada.
 * - Celular obrigatório.
 * - Perfil institucional preenchido no cadastro.
 * - Campos obrigatórios no cadastro:
 *   nome, CPF, e-mail, celular, senha,
 *   unidade_id, cargo_id, escolaridade_id, deficiencia_id, data_nascimento.
 * - Campos opcionais no cadastro:
 *   genero_id, orientacao_sexual_id, cor_raca_id, registro.
 * - Respostas com fieldErrors para o frontend apontar o campo correto.
 */

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;

const { sendEmail: enviarEmail } = require("../services/mailer");

/* ─────────────────────────────────────────────────────────────
   Config
────────────────────────────────────────────────────────────── */

const FRONTEND_URL_STATIC =
  (process.env.FRONTEND_URL && String(process.env.FRONTEND_URL).trim()) ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173");

const JWT_ISS = process.env.JWT_ISSUER || undefined;
const JWT_AUD = process.env.JWT_AUDIENCE || undefined;

/* ─────────────────────────────────────────────────────────────
   Regex / regras
────────────────────────────────────────────────────────────── */

const SENHA_FORTE_RE =
  /^(?=\S{8,}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CPF_DIGITS_RE = /^\d{11}$/;
const CELULAR_DIGITS_RE = /^\d{10,11}$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const REGISTRO_MASK_RE = /^\d{2}\.\d{3}-\d$/;

const PERFIL_CADASTRO_PUBLICO = "usuario";

const FK_TABLES = new Set([
  "unidades",
  "cargos",
  "generos",
  "orientacoes_sexuais",
  "cores_racas",
  "escolaridades",
  "deficiencias",
]);

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}

function normNome(v) {
  return String(v || "").trim();
}

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function safePreview(value, start = 6, end = 4) {
  const s = String(value || "");
  if (!s) return "";
  if (s.length <= start + end) return "***";
  return `${s.slice(0, start)}...${s.slice(-end)}`;
}

function removeTrailingSlash(v) {
  return String(v || "").replace(/\/+$/, "");
}

function isHttpsUrl(v) {
  return /^https:\/\/.+/i.test(String(v || "").trim());
}

function normalizeFrontendBase(raw) {
  const base = removeTrailingSlash(String(raw || "").trim());
  if (!base) return "";
  if (/^https?:\/\/.+/i.test(base)) return base;
  return "";
}

function getFrontendBaseFromRequest(req) {
  const reqOrigin = String(req.headers.origin || "").trim();
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .trim()
    .toLowerCase();
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").trim();
  const host = String(req.headers.host || "").trim();

  const staticBase = normalizeFrontendBase(FRONTEND_URL_STATIC);
  if (staticBase) return staticBase;

  if (process.env.NODE_ENV === "production") {
    if (isHttpsUrl(reqOrigin)) return removeTrailingSlash(reqOrigin);

    if (forwardedProto === "https" && forwardedHost) {
      return `https://${removeTrailingSlash(forwardedHost)}`;
    }

    if (host && !/localhost|127\.0\.0\.1/i.test(host)) {
      return `https://${removeTrailingSlash(host)}`;
    }
  }

  if (isHttpsUrl(reqOrigin) || /^http:\/\/.+/i.test(reqOrigin)) {
    return removeTrailingSlash(reqOrigin);
  }

  return "http://localhost:5173";
}

function buildPasswordResetLink(req, token) {
  const base = getFrontendBaseFromRequest(req);
  const encodedToken = encodeURIComponent(String(token || "").trim());

  return `${base}/redefinir-senha/${encodedToken}`;
}

function toDateOnly(v) {
  const s = String(v || "").slice(0, 10);
  return DATE_ONLY_RE.test(s) ? s : "";
}

function numOrNull(v) {
  if (v === undefined || v === null || v === "") return null;

  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizarCelular(v) {
  return onlyDigits(v).slice(0, 11);
}

function validarCelularObrigatorio(v) {
  const digits = normalizarCelular(v);

  if (!digits) {
    return {
      ok: false,
      value: "",
      message: "Celular é obrigatório.",
    };
  }

  if (!CELULAR_DIGITS_RE.test(digits)) {
    return {
      ok: false,
      value: digits,
      message: "Celular inválido. Informe DDD + número.",
    };
  }

  return {
    ok: true,
    value: digits,
    message: null,
  };
}

function toRegistroMasked(v) {
  const digits = onlyDigits(v).slice(0, 7);

  if (digits.length === 6) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}-${digits.slice(5)}`;
  }

  if (digits.length === 7) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}-${digits.slice(5, 6)}`;
  }

  return "";
}

function validarRegistroOpcional(registro) {
  if (registro === undefined || registro === null || registro === "") {
    return {
      ok: true,
      value: null,
      message: null,
    };
  }

  const masked = String(registro).trim();
  const digits = onlyDigits(registro);

  if (REGISTRO_MASK_RE.test(masked)) {
    return {
      ok: true,
      value: masked,
      message: null,
    };
  }

  if (/^\d{6,7}$/.test(digits)) {
    const value = toRegistroMasked(digits);

    if (value) {
      return {
        ok: true,
        value,
        message: null,
      };
    }
  }

  return {
    ok: false,
    value: "",
    message: "Formato inválido. Ex.: 28.053-7.",
  };
}

function validarDataNascimentoObrigatoria(value) {
  const dateOnly = toDateOnly(value);

  if (!dateOnly) {
    return {
      ok: false,
      value: "",
      message: "Data de nascimento é obrigatória.",
    };
  }

  const now = new Date();
  const dt = new Date(`${dateOnly}T00:00:00Z`);

  const hojeUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  const dtUTC = Date.UTC(
    dt.getUTCFullYear(),
    dt.getUTCMonth(),
    dt.getUTCDate()
  );

  if (Number.isNaN(dt.getTime())) {
    return {
      ok: false,
      value: dateOnly,
      message: "Data inválida.",
    };
  }

  if (dtUTC > hojeUTC) {
    return {
      ok: false,
      value: dateOnly,
      message: "Data não pode ser futura.",
    };
  }

  if (dt.getUTCFullYear() < 1900) {
    return {
      ok: false,
      value: dateOnly,
      message: "Ano inválido.",
    };
  }

  return {
    ok: true,
    value: dateOnly,
    message: null,
  };
}

async function assertExists(table, id, field = "id") {
  if (id === null || id === undefined || id === "") return true;

  const tableName = String(table || "").trim();
  const fieldName = String(field || "id").trim();

  if (!FK_TABLES.has(tableName)) {
    throw new Error(`Tabela não permitida em assertExists: ${tableName}`);
  }

  if (fieldName !== "id") {
    throw new Error(`Campo não permitido em assertExists: ${fieldName}`);
  }

  const result = await db.query(
    `SELECT 1 FROM ${tableName} WHERE id = $1 LIMIT 1`,
    [id]
  );

  return result.rowCount > 0;
}

async function validarReferenciasPerfil(payload) {
  const checks = [
    ["unidades", "unidade_id", payload.unidade_id],
    ["cargos", "cargo_id", payload.cargo_id],
    ["escolaridades", "escolaridade_id", payload.escolaridade_id],
    ["deficiencias", "deficiencia_id", payload.deficiencia_id],
    ["generos", "genero_id", payload.genero_id],
    ["orientacoes_sexuais", "orientacao_sexual_id", payload.orientacao_sexual_id],
    ["cores_racas", "cor_raca_id", payload.cor_raca_id],
  ];

  const fieldErrors = {};

  for (const [table, key, value] of checks) {
    if (value !== null && value !== undefined && value !== "") {
      const exists = await assertExists(table, value);
      if (!exists) fieldErrors[key] = "ID inexistente na referência.";
    }
  }

  return fieldErrors;
}

function montarPayloadCadastro(reqBody = {}) {
  return {
    nome: normNome(reqBody.nome),
    cpf: onlyDigits(reqBody.cpf),
    email: normEmail(reqBody.email),
    celular: validarCelularObrigatorio(reqBody.celular),
    senha: String(reqBody.senha || ""),

    unidade_id: numOrNull(reqBody.unidade_id),
    cargo_id: numOrNull(reqBody.cargo_id),
    escolaridade_id: numOrNull(reqBody.escolaridade_id),
    deficiencia_id: numOrNull(reqBody.deficiencia_id),
    data_nascimento: reqBody.data_nascimento,

    genero_id: numOrNull(reqBody.genero_id),
    orientacao_sexual_id: numOrNull(reqBody.orientacao_sexual_id),
    cor_raca_id: numOrNull(reqBody.cor_raca_id),
    registro: validarRegistroOpcional(reqBody.registro),
  };
}

async function validarCadastroCompleto(payload) {
  const fieldErrors = {};

  if (!payload.nome) fieldErrors.nome = "Nome é obrigatório.";

  if (!payload.cpf) {
    fieldErrors.cpf = "CPF é obrigatório.";
  } else if (!CPF_DIGITS_RE.test(payload.cpf)) {
    fieldErrors.cpf = "CPF inválido.";
  }

  if (!payload.email) {
    fieldErrors.email = "E-mail é obrigatório.";
  } else if (!EMAIL_RE.test(payload.email)) {
    fieldErrors.email = "E-mail inválido.";
  }

  if (!payload.celular.ok) {
    fieldErrors.celular = payload.celular.message;
  }

  if (!payload.senha) {
    fieldErrors.senha = "Senha é obrigatória.";
  } else if (!SENHA_FORTE_RE.test(payload.senha)) {
    fieldErrors.senha =
      "Mín. 8 caracteres com maiúscula, minúscula, número, símbolo e sem espaços.";
  }

  if (!payload.unidade_id) {
    fieldErrors.unidade_id = "Unidade é obrigatória.";
  }

  if (!payload.cargo_id) {
    fieldErrors.cargo_id = "Cargo é obrigatório.";
  }

  if (!payload.escolaridade_id) {
    fieldErrors.escolaridade_id = "Escolaridade é obrigatória.";
  }

  if (!payload.deficiencia_id) {
    fieldErrors.deficiencia_id = "Deficiência é obrigatória.";
  }

  const dataInfo = validarDataNascimentoObrigatoria(payload.data_nascimento);
  if (!dataInfo.ok) {
    fieldErrors.data_nascimento = dataInfo.message;
  }

  if (!payload.registro.ok) {
    fieldErrors.registro = payload.registro.message;
  }

  const refErrors = await validarReferenciasPerfil(payload);
  Object.assign(fieldErrors, refErrors);

  return {
    ok: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    data_nascimento: dataInfo.value,
  };
}

function traduzPgError(err) {
  const base = {
    ok: false,
    message: "Erro ao processar solicitação.",
    fieldErrors: {},
  };

  if (!err) {
    return {
      ...base,
      erro: "Erro desconhecido.",
    };
  }

  const code = err?.code;
  const constraint = String(err.constraint || "").toLowerCase();
  const detail = String(err.detail || "").toLowerCase();

  if (code === "23505") {
    if (constraint.includes("cpf") || detail.includes("cpf")) {
      return {
        ok: false,
        erro: "Registro duplicado.",
        message: "CPF já cadastrado.",
        fieldErrors: {
          cpf: "Este CPF já está em uso.",
        },
      };
    }

    if (constraint.includes("email") || detail.includes("email")) {
      return {
        ok: false,
        erro: "Registro duplicado.",
        message: "E-mail já cadastrado.",
        fieldErrors: {
          email: "Este e-mail já está em uso.",
        },
      };
    }

    if (constraint.includes("celular") || detail.includes("celular")) {
      return {
        ok: false,
        erro: "Registro duplicado.",
        message: "Celular já cadastrado.",
        fieldErrors: {
          celular: "Este celular já está em uso.",
        },
      };
    }

    return {
      ...base,
      erro: "Registro duplicado.",
      message: "Registro já existente.",
    };
  }

  if (code === "23502") {
    const col = err?.column || "";
    const fieldErrors = {};
    if (col) fieldErrors[col] = "Campo obrigatório.";

    return {
      ...base,
      erro: "Campo obrigatório.",
      message: "Há campos obrigatórios não preenchidos.",
      fieldErrors,
    };
  }

  if (code === "23503") {
    return {
      ...base,
      erro: "Violação de integridade referencial.",
      message: "Alguma referência informada não existe.",
    };
  }

  if (code === "23514") {
    if (constraint.includes("cpf")) {
      return {
        ...base,
        erro: "Restrição de validação violada.",
        message: "CPF inválido.",
        fieldErrors: {
          cpf: "CPF inválido.",
        },
      };
    }

    if (constraint.includes("celular")) {
      return {
        ...base,
        erro: "Restrição de validação violada.",
        message: "Celular inválido.",
        fieldErrors: {
          celular: "Celular inválido. Informe DDD + número.",
        },
      };
    }

    if (constraint.includes("registro")) {
      return {
        ...base,
        erro: "Restrição de validação violada.",
        message: "Registro inválido.",
        fieldErrors: {
          registro: "Formato inválido. Ex.: 28.053-7.",
        },
      };
    }

    return {
      ...base,
      erro: "Restrição de validação violada.",
      message: "Algum campo não atende às regras de validação.",
    };
  }

  if (code === "22P02") {
    return {
      ...base,
      erro: "Valor inválido.",
      message: "Valor inválido em um ou mais campos.",
    };
  }

  return {
    ...base,
    erro: err.message || "Erro de banco de dados.",
  };
}

/* ─────────────────────────────────────────────────────────────
   POST /api/auth/cadastro
────────────────────────────────────────────────────────────── */

async function cadastrar(req, res) {
  const payload = montarPayloadCadastro(req.body || {});
  const validacao = await validarCadastroCompleto(payload);

  if (!validacao.ok) {
    return res.status(422).json({
      ok: false,
      code: "AUTH-422-CADASTRO-VALIDACAO",
      message: "Erros de validação no cadastro.",
      fieldErrors: validacao.fieldErrors,
    });
  }

  try {
    const existente = await db.query(
      `
      SELECT id, cpf, email
      FROM usuarios
      WHERE cpf = $1
         OR LOWER(email) = LOWER($2)
      LIMIT 1
      `,
      [payload.cpf, payload.email]
    );

    if (existente.rows.length > 0) {
      const row = existente.rows[0];
      const fieldErrors = {};

      if (row.cpf === payload.cpf) {
        fieldErrors.cpf = "Este CPF já está em uso.";
      }

      if (String(row.email || "").toLowerCase() === payload.email) {
        fieldErrors.email = "Este e-mail já está em uso.";
      }

      return res.status(409).json({
        ok: false,
        code: "AUTH-409-CADASTRO-DUPLICADO",
        message: "CPF ou e-mail já cadastrado.",
        fieldErrors,
      });
    }

    const senhaCriptografada = await bcrypt.hash(payload.senha, 10);

    const result = await db.query(
      `
      INSERT INTO usuarios (
        nome,
        cpf,
        email,
        celular,
        senha,
        perfil,
        unidade_id,
        cargo_id,
        escolaridade_id,
        deficiencia_id,
        data_nascimento,
        genero_id,
        orientacao_sexual_id,
        cor_raca_id,
        registro
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15
      )
      RETURNING
        id,
        nome,
        cpf,
        email,
        celular,
        perfil,
        unidade_id,
        cargo_id,
        escolaridade_id,
        deficiencia_id,
        data_nascimento,
        genero_id,
        orientacao_sexual_id,
        cor_raca_id,
        registro
      `,
      [
        payload.nome,
        payload.cpf,
        payload.email,
        payload.celular.value,
        senhaCriptografada,
        PERFIL_CADASTRO_PUBLICO,
        payload.unidade_id,
        payload.cargo_id,
        payload.escolaridade_id,
        payload.deficiencia_id,
        validacao.data_nascimento,
        payload.genero_id,
        payload.orientacao_sexual_id,
        payload.cor_raca_id,
        payload.registro.value,
      ]
    );

    const usuario = result.rows[0];

    return res.status(201).json({
      ok: true,
      code: "AUTH-201-CADASTRO-CRIADO",
      message: "Cadastro realizado com sucesso.",
      data: {
        ...usuario,
        perfil: PERFIL_CADASTRO_PUBLICO,
        perfil_incompleto: false,
        campos_faltantes: [],
      },
    });
  } catch (err) {
    console.error("[authUsuarioController.cadastrar] ERRO", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint,
      email: payload.email,
      cpfPreview: safePreview(payload.cpf),
      celularPreview: safePreview(payload.celular?.value),
    });

    const payloadErro = traduzPgError(err);
    const status = err?.code === "23505" ? 409 : 500;

    return res.status(status).json(payloadErro);
  }
}

/* ─────────────────────────────────────────────────────────────
   POST /api/auth/esqueci-senha
────────────────────────────────────────────────────────────── */

async function recuperarSenha(req, res) {
  const email = normEmail(req.body?.email);

  if (!email) {
    return res.status(422).json({
      ok: false,
      code: "AUTH-422-EMAIL-OBRIGATORIO",
      message: "Informe o e-mail.",
      fieldErrors: {
        email: "Informe o e-mail.",
      },
    });
  }

  if (!EMAIL_RE.test(email)) {
    return res.status(422).json({
      ok: false,
      code: "AUTH-422-EMAIL-INVALIDO",
      message: "E-mail inválido.",
      fieldErrors: {
        email: "Formato inválido.",
      },
    });
  }

  const respostaIdempotente = {
    ok: true,
    code: "AUTH-200-RECUPERACAO-SOLICITADA",
    message: "Se o e-mail estiver cadastrado, enviaremos as instruções.",
  };

  try {
    const result = await db.query(
      `
      SELECT id
      FROM usuarios
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      console.log(
        "[authUsuarioController.recuperarSenha] e-mail não encontrado; resposta idempotente",
        {
          emailPreview: safePreview(email),
        }
      );

      return res.status(200).json(respostaIdempotente);
    }

    const usuarioId = result.rows[0].id;
    const jwtSecret = String(process.env.JWT_SECRET || "").trim();

    if (!jwtSecret) {
      console.error(
        "[authUsuarioController.recuperarSenha] JWT_SECRET ausente no ambiente"
      );

      return res.status(200).json(respostaIdempotente);
    }

    const signOpts = {
      expiresIn: "1h",
    };

    if (JWT_ISS) signOpts.issuer = JWT_ISS;
    if (JWT_AUD) signOpts.audience = JWT_AUD;

    const token = jwt.sign(
      {
        sub: String(usuarioId),
        typ: "pwd-reset",
      },
      jwtSecret,
      signOpts
    );

    const link = buildPasswordResetLink(req, token);

    try {
      await enviarEmail({
        to: email,
        subject: "Recuperação de senha - Escola da Saúde",
        text:
          `Você solicitou redefinição de senha.\n\n` +
          `Acesse o link abaixo para criar uma nova senha:\n` +
          `${link}\n\n` +
          `Este link é válido por 1 hora.\n` +
          `Se você não fez essa solicitação, ignore esta mensagem.`,
      });

      console.log("[authUsuarioController.recuperarSenha] e-mail enviado", {
        usuarioId,
        emailPreview: safePreview(email),
        frontendBase: getFrontendBaseFromRequest(req),
      });
    } catch (mailErr) {
      console.error("[authUsuarioController.recuperarSenha] erro ao enviar e-mail", {
        message: mailErr?.message,
        emailPreview: safePreview(email),
        usuarioId,
        frontendBase: getFrontendBaseFromRequest(req),
      });
    }

    return res.status(200).json(respostaIdempotente);
  } catch (err) {
    console.error("[authUsuarioController.recuperarSenha] ERRO", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint,
      emailPreview: safePreview(email),
    });

    return res.status(200).json(respostaIdempotente);
  }
}

/* ─────────────────────────────────────────────────────────────
   POST /api/auth/redefinir-senha
────────────────────────────────────────────────────────────── */

async function redefinirSenha(req, res) {
  const tokenRaw = req.body?.token || "";
  const novaSenha = String(req.body?.novaSenha || "");

  let token = String(tokenRaw || "").trim();

  try {
    token = decodeURIComponent(token);
  } catch {
    // Mantém token bruto.
  }

  const fieldErrors = {};

  if (!token) {
    fieldErrors.token = "Token ausente.";
  }

  if (!novaSenha) {
    fieldErrors.novaSenha = "Informe a nova senha.";
  } else if (!SENHA_FORTE_RE.test(novaSenha)) {
    fieldErrors.novaSenha =
      "A nova senha deve conter ao menos 8 caracteres, incluindo letra maiúscula, minúscula, número, símbolo e sem espaços.";
  }

  if (Object.keys(fieldErrors).length) {
    return res.status(422).json({
      ok: false,
      code: "AUTH-422-REDEFINICAO-VALIDACAO",
      message: "Erros de validação.",
      fieldErrors,
    });
  }

  const jwtSecret = String(process.env.JWT_SECRET || "").trim();

  if (!jwtSecret) {
    console.error("[authUsuarioController.redefinirSenha] JWT_SECRET ausente.");

    return res.status(500).json({
      ok: false,
      code: "AUTH-500-JWT-SECRET-AUSENTE",
      message: "Configuração do servidor ausente.",
    });
  }

  try {
    const verifyOpts = {};
    if (JWT_ISS) verifyOpts.issuer = JWT_ISS;
    if (JWT_AUD) verifyOpts.audience = JWT_AUD;

    const decoded = jwt.verify(token, jwtSecret, verifyOpts);
    const usuarioId = decoded?.sub;
    const typ = decoded?.typ;

    if (typ !== "pwd-reset" || !usuarioId) {
      console.warn("[authUsuarioController.redefinirSenha] token inválido", {
        usuarioId: usuarioId || null,
        typ: typ || null,
      });

      return res.status(400).json({
        ok: false,
        code: "AUTH-400-TOKEN-INVALIDO",
        message: "Token inválido.",
      });
    }

    const senhaCriptografada = await bcrypt.hash(novaSenha, 10);

    const result = await db.query(
      `
      UPDATE usuarios
         SET senha = $1
       WHERE id = $2
       RETURNING id
      `,
      [senhaCriptografada, usuarioId]
    );

    if (!result.rows?.length) {
      console.warn(
        "[authUsuarioController.redefinirSenha] usuário do token não encontrado",
        {
          usuarioId,
        }
      );

      return res.status(400).json({
        ok: false,
        code: "AUTH-400-TOKEN-INVALIDO",
        message: "Token inválido.",
      });
    }

    console.log("[authUsuarioController.redefinirSenha] senha redefinida", {
      usuarioId,
    });

    return res.status(200).json({
      ok: true,
      code: "AUTH-200-SENHA-REDEFINIDA",
      message: "Senha atualizada com sucesso.",
    });
  } catch (err) {
    console.error("[authUsuarioController.redefinirSenha] ERRO", {
      message: err?.message,
      name: err?.name,
    });

    return res.status(400).json({
      ok: false,
      code: "AUTH-400-TOKEN-INVALIDO-EXPIRADO",
      message: "Token inválido ou expirado.",
    });
  }
}

module.exports = {
  cadastrar,
  recuperarSenha,
  redefinirSenha,
};