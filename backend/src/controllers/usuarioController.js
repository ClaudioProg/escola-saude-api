/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/usuarioController.js — v2.1
 * Atualizado em: 18/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Gestão autenticada/admin de usuários.
 *
 * Não faz:
 * - Cadastro público.
 * - Recuperação/redefinição de senha.
 * - Estatísticas.
 * - Assinatura.
 * - Exclusão física de usuário.
 *
 * Regras oficiais:
 * - Perfil administrativo oficial: "administrador".
 * - Perfil é string única.
 * - Perfis válidos: "usuario", "organizador", "administrador".
 * - Cadastro básico obrigatório fica no authUsuarioController.
 * - Perfil institucional obrigatório:
 *   unidade_id, cargo_id, escolaridade_id, deficiencia_id, data_nascimento.
 * - Campos não obrigatórios:
 *   genero_id, orientacao_sexual_id, cor_raca_id.
 *
 * Contrato oficial de organizador:
 * - turma_responsavel.usuario_id.
 * - turma_responsavel.turma_id.
 * - turma_responsavel.papel = 'organizador'.
 *
 * Sem aliases:
 * - sem perfil array
 * - sem perfis
 * - sem role/roles
 * - sem admin
 * - sem CSV de perfil
 * - sem LIKE para perfil
 * - sem req.usuario
 * - sem req.auth
 * - sem req.userId
 * - sem turma_organizador
 * - sem evento_organizador
 * - sem organizador_id em turma_responsavel
 */

const bcrypt = require("bcrypt");

const forcarAtualizacaoCadastro = require("../auth/forcarAtualizacaoCadastro");

const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;

/* ──────────────────────────────────────────────────────────────
   Constantes oficiais
────────────────────────────────────────────────────────────── */

const PERFIS_VALIDOS = ["usuario", "organizador", "administrador"];
const PERFIL_ADMINISTRADOR = "administrador";
const PAPEL_ORGANIZADOR = "organizador";

const REQUIRED_PROFILE_FIELDS = [
  "unidade_id",
  "cargo_id",
  "escolaridade_id",
  "deficiencia_id",
  "data_nascimento",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const REGISTRO_MASK_RE = /^\d{2}\.\d{3}-\d$/;
const CELULAR_DIGITS_RE = /^\d{10,11}$/;
const SENHA_FORTE_RE =
  /^(?=\S{8,}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/;

const FK_TABLES = new Set([
  "unidades",
  "cargos",
  "generos",
  "orientacoes_sexuais",
  "cores_racas",
  "escolaridades",
  "deficiencias",
]);

/* ──────────────────────────────────────────────────────────────
   Contratos obrigatórios
────────────────────────────────────────────────────────────── */

if (!db || typeof db.query !== "function") {
  console.error("[usuarioController] db.query inválido:", db);
  throw new Error("Contrato inválido: backend/src/db deve exportar query.");
}

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function normStr(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normNome(value) {
  return String(value || "").trim();
}

function normEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function toDateOnly(value) {
  const text = String(value || "").slice(0, 10);
  return DATE_ONLY_RE.test(text) ? text : "";
}

function validarYmdReal(value) {
  const dateOnly = toDateOnly(value);

  if (!dateOnly) {
    return {
      ok: false,
      value: "",
      message: "Data inválida. Use YYYY-MM-DD.",
    };
  }

  const [anoRaw, mesRaw, diaRaw] = dateOnly.split("-");
  const ano = Number(anoRaw);
  const mes = Number(mesRaw);
  const dia = Number(diaRaw);

  const date = new Date(Date.UTC(ano, mes - 1, dia));

  const existe =
    date.getUTCFullYear() === ano &&
    date.getUTCMonth() === mes - 1 &&
    date.getUTCDate() === dia;

  if (!existe) {
    return {
      ok: false,
      value: dateOnly,
      message: "Data inválida.",
    };
  }

  const hoje = new Date();
  const hojeUTC = Date.UTC(
    hoje.getUTCFullYear(),
    hoje.getUTCMonth(),
    hoje.getUTCDate()
  );

  const dataUTC = Date.UTC(ano, mes - 1, dia);

  if (dataUTC > hojeUTC) {
    return {
      ok: false,
      value: dateOnly,
      message: "Data não pode ser futura.",
    };
  }

  if (ano < 1900) {
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

function numOrNull(value) {
  if (value === undefined || value === null || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveIntOrNull(value) {
  if (value === undefined || value === null || value === "") return null;

  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function clamp(number, min, max) {
  return Math.min(Math.max(number, min), max);
}

function perfilOficial(value) {
  const perfil = String(value || "").trim();

  if (!perfil) return "";

  return PERFIS_VALIDOS.includes(perfil) ? perfil : "";
}

function isAdmin(perfil) {
  return perfilOficial(perfil) === PERFIL_ADMINISTRADOR;
}

function getUserId(req) {
  const id = Number(req?.user?.id);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function toRegistroMasked(value) {
  const digits = onlyDigits(value).slice(0, 7);

  if (digits.length === 6) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}-${digits.slice(5)}`;
  }

  if (digits.length === 7) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}-${digits.slice(5, 6)}`;
  }

  return "";
}

function normalizarCelular(value) {
  return onlyDigits(value).slice(0, 11);
}

function validarCelularObrigatorio(value) {
  const digits = normalizarCelular(value);

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

function validarCelularOpcional(value) {
  if (value === undefined) {
    return {
      provided: false,
      ok: true,
      value: undefined,
      message: null,
    };
  }

  const digits = normalizarCelular(value);

  if (!digits) {
    return {
      provided: true,
      ok: false,
      value: "",
      message: "Celular é obrigatório.",
    };
  }

  if (!CELULAR_DIGITS_RE.test(digits)) {
    return {
      provided: true,
      ok: false,
      value: digits,
      message: "Celular inválido. Informe DDD + número.",
    };
  }

  return {
    provided: true,
    ok: true,
    value: digits,
    message: null,
  };
}

function camposFaltantes(usuario = {}) {
  return REQUIRED_PROFILE_FIELDS.filter(
    (campo) =>
      usuario[campo] === null ||
      usuario[campo] === undefined ||
      usuario[campo] === ""
  );
}

function isPerfilInstitucionalIncompleto(usuario = {}) {
  return camposFaltantes(usuario).length > 0;
}

function respostaErro(res, status, code, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    ...extra,
  });
}

function traduzPgError(err) {
  const code = err?.code;
  const constraint = String(err?.constraint || "").toLowerCase();
  const detail = String(err?.detail || "").toLowerCase();

  if (code === "23505") {
    if (constraint.includes("cpf") || detail.includes("cpf")) {
      return {
        status: 409,
        payload: {
          ok: false,
          code: "USUARIO-409-CPF-DUPLICADO",
          message: "CPF já cadastrado.",
          fieldErrors: { cpf: "Este CPF já está em uso." },
        },
      };
    }

    if (constraint.includes("email") || detail.includes("email")) {
      return {
        status: 409,
        payload: {
          ok: false,
          code: "USUARIO-409-EMAIL-DUPLICADO",
          message: "E-mail já cadastrado.",
          fieldErrors: { email: "Este e-mail já está em uso." },
        },
      };
    }

    if (constraint.includes("celular") || detail.includes("celular")) {
      return {
        status: 409,
        payload: {
          ok: false,
          code: "USUARIO-409-CELULAR-DUPLICADO",
          message: "Celular já cadastrado.",
          fieldErrors: { celular: "Este celular já está em uso." },
        },
      };
    }
  }

  if (code === "23503") {
    return {
      status: 422,
      payload: {
        ok: false,
        code: "USUARIO-422-REFERENCIA-INEXISTENTE",
        message: "Alguma referência informada não existe.",
      },
    };
  }

  if (code === "23514") {
    return {
      status: 422,
      payload: {
        ok: false,
        code: "USUARIO-422-CHECK-VIOLADO",
        message: "Algum campo não atende às regras de validação.",
      },
    };
  }

  if (code === "23502") {
    return {
      status: 422,
      payload: {
        ok: false,
        code: "USUARIO-422-CAMPO-OBRIGATORIO",
        message: "Há campos obrigatórios não preenchidos.",
        fieldErrors: err?.column ? { [err.column]: "Campo obrigatório." } : {},
      },
    };
  }

  return {
    status: 500,
    payload: {
      ok: false,
      code: "USUARIO-500-ERRO-BANCO",
      message: "Erro ao processar solicitação.",
    },
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
    ["generos", "genero_id", payload.genero_id],
    ["orientacoes_sexuais", "orientacao_sexual_id", payload.orientacao_sexual_id],
    ["cores_racas", "cor_raca_id", payload.cor_raca_id],
    ["escolaridades", "escolaridade_id", payload.escolaridade_id],
    ["deficiencias", "deficiencia_id", payload.deficiencia_id],
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

function validarDataNascimentoObrigatoria(value) {
  if (value === undefined || value === null || value === "") {
    return {
      ok: false,
      value: "",
      message: "Data de nascimento é obrigatória.",
    };
  }

  return validarYmdReal(value);
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

function montarPerfilInstitucionalPayload(body = {}) {
  return {
    unidade_id: positiveIntOrNull(body.unidade_id),
    cargo_id: positiveIntOrNull(body.cargo_id),
    escolaridade_id: positiveIntOrNull(body.escolaridade_id),
    deficiencia_id: positiveIntOrNull(body.deficiencia_id),
    data_nascimento: body.data_nascimento || "",
    genero_id: positiveIntOrNull(body.genero_id),
    orientacao_sexual_id: positiveIntOrNull(body.orientacao_sexual_id),
    cor_raca_id: positiveIntOrNull(body.cor_raca_id),
    registro: body.registro,
    celular: body.celular,
  };
}

async function validarPerfilInstitucional(payload) {
  const fieldErrors = {};

  if (!payload.unidade_id) fieldErrors.unidade_id = "Unidade é obrigatória.";
  if (!payload.cargo_id) fieldErrors.cargo_id = "Cargo é obrigatório.";

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

  const celularInfo = validarCelularOpcional(payload.celular);
  if (celularInfo.provided && !celularInfo.ok) {
    fieldErrors.celular = celularInfo.message;
  }

  const registroInfo = validarRegistroOpcional(payload.registro);
  if (!registroInfo.ok) {
    fieldErrors.registro = registroInfo.message;
  }

  const refErrors = await validarReferenciasPerfil(payload);
  Object.assign(fieldErrors, refErrors);

  return {
    ok: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    data_nascimento: dataInfo.value,
    celular: celularInfo,
    registro: registroInfo,
  };
}

function sanitizeUsuario(row = {}) {
  return {
    ...row,
    perfil: perfilOficial(row.perfil),
    perfil_incompleto: isPerfilInstitucionalIncompleto(row),
    campos_faltantes: camposFaltantes(row),
  };
}

function logAuditoriaPlaceholder(req, acao, detalhes = {}) {
  console.log("[AUDITORIA:USUARIO]", {
    acao,
    adminId: req.user?.id ?? null,
    usuarioAlvoId: detalhes.usuarioAlvoId ?? null,
    detalhes,
    ip: req.ip,
    userAgent: req.headers["user-agent"] || null,
    data: new Date().toISOString(),
  });
}

/* ──────────────────────────────────────────────────────────────
   Campos SELECT
────────────────────────────────────────────────────────────── */

const SELECT_USUARIO_COMPLETO = `
  u.id,
  u.nome,
  u.cpf,
  u.email,
  u.celular,
  u.registro,
  to_char(u.data_nascimento::date, 'YYYY-MM-DD') AS data_nascimento,
  u.perfil,
  u.unidade_id,
  u.escolaridade_id,
  u.cargo_id,
  u.deficiencia_id,
  u.genero_id,
  u.orientacao_sexual_id,
  u.cor_raca_id,
  un.sigla AS unidade_sigla,
  un.nome  AS unidade_nome,
  es.nome  AS escolaridade_nome,
  ca.nome  AS cargo_nome,
  de.nome  AS deficiencia_nome,
  ge.nome  AS genero_nome,
  os.nome  AS orientacao_sexual_nome,
  cr.nome  AS cor_raca_nome
`;

const JOIN_USUARIO_COMPLETO = `
  LEFT JOIN unidades             un ON un.id = u.unidade_id
  LEFT JOIN escolaridades        es ON es.id = u.escolaridade_id
  LEFT JOIN cargos               ca ON ca.id = u.cargo_id
  LEFT JOIN deficiencias         de ON de.id = u.deficiencia_id
  LEFT JOIN generos              ge ON ge.id = u.genero_id
  LEFT JOIN orientacoes_sexuais  os ON os.id = u.orientacao_sexual_id
  LEFT JOIN cores_racas          cr ON cr.id = u.cor_raca_id
`;

/* ──────────────────────────────────────────────────────────────
   ADMIN — listar usuários
────────────────────────────────────────────────────────────── */

async function listar(req, res) {
  try {
    const page = clamp(numOrNull(req.query.page) ?? 1, 1, 1000000);
    const pageSize = clamp(numOrNull(req.query.pageSize) ?? 50, 1, 200);

    const busca = normStr(req.query.q);
    const unidadeId = positiveIntOrNull(req.query.unidade_id);
    const cargoId = positiveIntOrNull(req.query.cargo_id);
    const perfilFiltro = normStr(req.query.perfil);

    const where = [];
    const params = [];
    let index = 1;

    if (busca) {
      where.push(
        `(u.nome ILIKE $${index} OR u.email ILIKE $${index} OR u.cpf ILIKE $${index} OR u.celular ILIKE $${index} OR u.registro ILIKE $${index})`
      );
      params.push(`%${busca}%`);
      index++;
    }

    if (unidadeId !== null) {
      where.push(`u.unidade_id = $${index++}`);
      params.push(unidadeId);
    }

    if (cargoId !== null) {
      where.push(`u.cargo_id = $${index++}`);
      params.push(cargoId);
    }

    if (perfilFiltro) {
      const perfil = perfilOficial(perfilFiltro);

      if (!perfil) {
        return respostaErro(
          res,
          400,
          "USUARIO-400-PERFIL-FILTRO-INVALIDO",
          "Perfil de filtro inválido.",
          { permitidos: PERFIS_VALIDOS }
        );
      }

      where.push(`u.perfil = $${index++}`);
      params.push(perfil);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const totalQ = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM usuarios u
      ${whereSql}
      `,
      params
    );

    const total = Number(totalQ.rows?.[0]?.total || 0);
    const offset = (page - 1) * pageSize;

    const rowsQ = await db.query(
      `
      SELECT ${SELECT_USUARIO_COMPLETO}
      FROM usuarios u
      ${JOIN_USUARIO_COMPLETO}
      ${whereSql}
      ORDER BY u.nome ASC
      LIMIT $${index++} OFFSET $${index++}
      `,
      [...params, pageSize, offset]
    );

    const data = (rowsQ.rows || []).map(sanitizeUsuario);
    const pages = Math.max(1, Math.ceil(total / pageSize));

    return res.status(200).json({
      ok: true,
      data,
      meta: {
        total,
        page,
        pageSize,
        pages,
      },
    });
  } catch (err) {
    console.error("[usuarioController.listar] ERRO", err);

    return respostaErro(
      res,
      500,
      "USUARIO-500-LISTAR",
      "Erro ao listar usuários."
    );
  }
}

/* ──────────────────────────────────────────────────────────────
   SELF/ADMIN — obter usuário por ID
────────────────────────────────────────────────────────────── */

async function obterPorId(req, res) {
  const id = Number(req.params.id);
  const usuarioLogadoId = getUserId(req);

  if (!Number.isInteger(id) || id <= 0) {
    return respostaErro(res, 400, "USUARIO-400-ID-INVALIDO", "ID inválido.");
  }

  if (id !== usuarioLogadoId && !isAdmin(req.user?.perfil)) {
    return respostaErro(
      res,
      403,
      "USUARIO-403-SEM-PERMISSAO",
      "Sem permissão para acessar este usuário."
    );
  }

  try {
    const { rows } = await db.query(
      `
      SELECT ${SELECT_USUARIO_COMPLETO}
      FROM usuarios u
      ${JOIN_USUARIO_COMPLETO}
      WHERE u.id = $1
      `,
      [id]
    );

    if (!rows.length) {
      return respostaErro(
        res,
        404,
        "USUARIO-404-NAO-ENCONTRADO",
        "Usuário não encontrado."
      );
    }

    const usuario = sanitizeUsuario(rows[0]);

    res.set("X-Perfil-Incompleto", usuario.perfil_incompleto ? "1" : "0");

    return res.status(200).json({
      ok: true,
      data: usuario,
    });
  } catch (err) {
    console.error("[usuarioController.obterPorId] ERRO", err);

    return respostaErro(
      res,
      500,
      "USUARIO-500-OBTER",
      "Erro ao buscar usuário."
    );
  }
}

/* ──────────────────────────────────────────────────────────────
   AUTENTICADO — buscar/autocomplete
────────────────────────────────────────────────────────────── */

async function buscar(req, res) {
  const busca = normStr(req.query.q);

  if (!busca || busca.length < 3) {
    return respostaErro(
      res,
      400,
      "USUARIO-400-BUSCA-CURTA",
      "Envie ao menos 3 caracteres para busca.",
      { fieldErrors: { q: "Mínimo de 3 caracteres." } }
    );
  }

  const perfilFiltro = normStr(req.query.perfil);
  const perfil = perfilFiltro ? perfilOficial(perfilFiltro) : "";

  if (perfilFiltro && !perfil) {
    return respostaErro(
      res,
      400,
      "USUARIO-400-PERFIL-BUSCA-INVALIDO",
      "Perfil inválido.",
      { permitidos: PERFIS_VALIDOS }
    );
  }

  try {
    const like = `%${busca}%`;
    const params = [like];
    const where = ["(u.nome ILIKE $1 OR u.email ILIKE $1 OR u.celular ILIKE $1)"];
    let index = 2;

    const unidadeId = positiveIntOrNull(req.query.unidade_id);

    if (unidadeId !== null) {
      where.push(`u.unidade_id = $${index++}`);
      params.push(unidadeId);
    }

    if (perfil) {
      where.push(`u.perfil = $${index++}`);
      params.push(perfil);
    }

    const { rows } = await db.query(
      `
      SELECT
        u.id,
        u.nome,
        u.email,
        u.celular,
        u.perfil,
        u.unidade_id
      FROM usuarios u
      WHERE ${where.join(" AND ")}
      ORDER BY u.nome ASC
      LIMIT 20
      `,
      params
    );

    return res.status(200).json({
      ok: true,
      data: (rows || []).map((usuario) => ({
        ...usuario,
        perfil: perfilOficial(usuario.perfil),
      })),
    });
  } catch (err) {
    console.error("[usuarioController.buscar] ERRO", err);

    return respostaErro(
      res,
      500,
      "USUARIO-500-BUSCAR",
      "Erro ao buscar usuários."
    );
  }
}

/* ──────────────────────────────────────────────────────────────
   SELF/ADMIN — atualizar dados básicos
────────────────────────────────────────────────────────────── */

async function atualizarBasico(req, res) {
  const id = Number(req.params.id);
  const usuarioLogadoId = getUserId(req);

  if (!Number.isInteger(id) || id <= 0) {
    return respostaErro(res, 400, "USUARIO-400-ID-INVALIDO", "ID inválido.");
  }

  if (id !== usuarioLogadoId && !isAdmin(req.user?.perfil)) {
    return respostaErro(
      res,
      403,
      "USUARIO-403-SEM-PERMISSAO",
      "Sem permissão para alterar este usuário."
    );
  }

  const nome = req.body?.nome !== undefined ? normNome(req.body.nome) : undefined;
  const email =
    req.body?.email !== undefined ? normEmail(req.body.email) : undefined;
  const celular = validarCelularOpcional(req.body?.celular);
  const senha = req.body?.senha !== undefined ? String(req.body.senha) : undefined;

  const fieldErrors = {};

  if (nome !== undefined && !nome) {
    fieldErrors.nome = "Nome é obrigatório.";
  }

  if (email !== undefined && (!email || !EMAIL_RE.test(email))) {
    fieldErrors.email = "E-mail inválido.";
  }

  if (celular.provided && !celular.ok) {
    fieldErrors.celular = celular.message;
  }

  if (senha !== undefined && senha !== "" && !SENHA_FORTE_RE.test(senha)) {
    fieldErrors.senha =
      "Mín. 8 caracteres com maiúscula, minúscula, número, símbolo e sem espaços.";
  }

  if (Object.keys(fieldErrors).length) {
    return respostaErro(
      res,
      422,
      "USUARIO-422-BASICO-VALIDACAO",
      "Erros de validação.",
      { fieldErrors }
    );
  }

  try {
    if (email !== undefined) {
      const dupQ = await db.query(
        `
        SELECT id
        FROM usuarios
        WHERE LOWER(email) = LOWER($1)
          AND id <> $2
        LIMIT 1
        `,
        [email, id]
      );

      if (dupQ.rows?.length) {
        return respostaErro(
          res,
          409,
          "USUARIO-409-EMAIL-DUPLICADO",
          "E-mail já cadastrado.",
          { fieldErrors: { email: "Este e-mail já está em uso." } }
        );
      }
    }

    const campos = [];
    const valores = [];
    let index = 1;

    if (nome !== undefined) {
      campos.push(`nome = $${index++}`);
      valores.push(nome);
    }

    if (email !== undefined) {
      campos.push(`email = $${index++}`);
      valores.push(email);
    }

    if (celular.provided) {
      campos.push(`celular = $${index++}`);
      valores.push(celular.value);
    }

    if (senha !== undefined && senha !== "") {
      const senhaHash = await bcrypt.hash(senha, 10);
      campos.push(`senha = $${index++}`);
      valores.push(senhaHash);
    }

    if (!campos.length) {
      return respostaErro(
        res,
        422,
        "USUARIO-422-NENHUM-CAMPO",
        "Nenhum campo válido para atualizar."
      );
    }

    valores.push(id);

   await db.query(
  `
  UPDATE usuarios
     SET ${campos.join(", ")}
   WHERE id = $${index}
  `,
  valores
);

// ✅ v2.1 — limpa imediatamente o cache do diagnóstico de cadastro incompleto.
// Sem isso, o middleware pode continuar devolvendo X-Perfil-Incompleto: 1
// por alguns segundos mesmo depois do cadastro salvo no banco.
forcarAtualizacaoCadastro.clearCache(id);

const { rows } = await db.query(
  `
  SELECT ${SELECT_USUARIO_COMPLETO}
  FROM usuarios u
  ${JOIN_USUARIO_COMPLETO}
  WHERE u.id = $1
  `,
  [id]
);

    const usuario = sanitizeUsuario(rows[0] || {});

    res.set("X-Perfil-Incompleto", usuario.perfil_incompleto ? "1" : "0");

    return res.status(200).json({
      ok: true,
      code: "USUARIO-200-BASICO-ATUALIZADO",
      message: "Dados atualizados com sucesso.",
      data: usuario,
    });
  } catch (err) {
    console.error("[usuarioController.atualizarBasico] ERRO", err);

    const translated = traduzPgError(err);
    return res.status(translated.status).json(translated.payload);
  }
}

/* ──────────────────────────────────────────────────────────────
   ADMIN — atualizar dados administrativos
────────────────────────────────────────────────────────────── */

async function atualizarDadosAdministrativos(req, res) {
  const id = Number(req.params.id);

  if (!isAdmin(req.user?.perfil)) {
    return respostaErro(
      res,
      403,
      "USUARIO-403-ADMINISTRADOR-NECESSARIO",
      "Acesso negado."
    );
  }

  if (!Number.isInteger(id) || id <= 0) {
    return respostaErro(res, 400, "USUARIO-400-ID-INVALIDO", "ID inválido.");
  }

  const body = req.body || {};
  const fieldErrors = {};
  const campos = [];
  const valores = [];
  let index = 1;

  if (body.nome !== undefined) {
    const nome = normNome(body.nome);
    if (!nome) fieldErrors.nome = "Nome é obrigatório.";
    campos.push(`nome = $${index++}`);
    valores.push(nome);
  }

  if (body.email !== undefined) {
    const email = normEmail(body.email);
    if (!email || !EMAIL_RE.test(email)) {
      fieldErrors.email = "E-mail inválido.";
    }
    campos.push(`email = $${index++}`);
    valores.push(email);
  }

  if (body.celular !== undefined) {
    const celular = validarCelularObrigatorio(body.celular);
    if (!celular.ok) fieldErrors.celular = celular.message;
    campos.push(`celular = $${index++}`);
    valores.push(celular.value);
  }

  if (body.registro !== undefined) {
    const registro = validarRegistroOpcional(body.registro);
    if (!registro.ok) fieldErrors.registro = registro.message;
    campos.push(`registro = $${index++}`);
    valores.push(registro.value);
  }

  const camposNumericos = [
    "unidade_id",
    "cargo_id",
    "escolaridade_id",
    "deficiencia_id",
    "genero_id",
    "orientacao_sexual_id",
    "cor_raca_id",
  ];

  const referenciasParaValidar = {};

  for (const campo of camposNumericos) {
    if (body[campo] !== undefined) {
      const value = positiveIntOrNull(body[campo]);

      if (
        body[campo] !== null &&
        body[campo] !== "" &&
        body[campo] !== undefined &&
        value === null
      ) {
        fieldErrors[campo] = "Valor inválido.";
      }

      campos.push(`${campo} = $${index++}`);
      valores.push(value);
      referenciasParaValidar[campo] = value;
    }
  }

  if (body.data_nascimento !== undefined) {
    const dataInfo =
      body.data_nascimento === null || body.data_nascimento === ""
        ? { ok: true, value: null }
        : validarYmdReal(body.data_nascimento);

    if (!dataInfo.ok) {
      fieldErrors.data_nascimento = dataInfo.message;
    }

    campos.push(`data_nascimento = $${index++}`);
    valores.push(dataInfo.value);
  }

  if (Object.keys(fieldErrors).length) {
    return respostaErro(
      res,
      422,
      "USUARIO-422-ADMIN-VALIDACAO",
      "Erros de validação.",
      { fieldErrors }
    );
  }

  const refErrors = await validarReferenciasPerfil(referenciasParaValidar);

  if (Object.keys(refErrors).length) {
    return respostaErro(
      res,
      422,
      "USUARIO-422-REFERENCIA",
      "Revise os campos destacados.",
      { fieldErrors: refErrors }
    );
  }

  if (!campos.length) {
    return respostaErro(
      res,
      422,
      "USUARIO-422-NENHUM-CAMPO",
      "Nenhum campo válido para atualizar."
    );
  }

  try {
    if (body.email !== undefined) {
      const email = normEmail(body.email);
      const dupQ = await db.query(
        `
        SELECT id
        FROM usuarios
        WHERE LOWER(email) = LOWER($1)
          AND id <> $2
        LIMIT 1
        `,
        [email, id]
      );

      if (dupQ.rows?.length) {
        return respostaErro(
          res,
          409,
          "USUARIO-409-EMAIL-DUPLICADO",
          "E-mail já cadastrado.",
          { fieldErrors: { email: "Este e-mail já está em uso." } }
        );
      }
    }

    valores.push(id);

    await db.query(
      `
      UPDATE usuarios
         SET ${campos.join(", ")}
       WHERE id = $${index}
      `,
      valores
    );

    logAuditoriaPlaceholder(req, "USUARIO_DADOS_ADMINISTRATIVOS_ATUALIZADOS", {
      usuarioAlvoId: id,
      camposAlterados: campos.map((campo) => campo.split("=")[0].trim()),
    });

    const { rows } = await db.query(
      `
      SELECT ${SELECT_USUARIO_COMPLETO}
      FROM usuarios u
      ${JOIN_USUARIO_COMPLETO}
      WHERE u.id = $1
      `,
      [id]
    );

    return res.status(200).json({
      ok: true,
      code: "USUARIO-200-DADOS-ADMIN-ATUALIZADOS",
      message: "Dados administrativos atualizados com sucesso.",
      data: sanitizeUsuario(rows[0] || {}),
    });
  } catch (err) {
    console.error("[usuarioController.atualizarDadosAdministrativos] ERRO", err);

    const translated = traduzPgError(err);
    return res.status(translated.status).json(translated.payload);
  }
}

/* ──────────────────────────────────────────────────────────────
   SELF/ADMIN — atualizar perfil institucional
────────────────────────────────────────────────────────────── */

async function atualizarPerfilInstitucional(req, res) {
  const id = Number(req.params.id);
  const usuarioLogadoId = getUserId(req);

  if (!Number.isInteger(id) || id <= 0) {
    return respostaErro(res, 400, "USUARIO-400-ID-INVALIDO", "ID inválido.");
  }

  if (id !== usuarioLogadoId && !isAdmin(req.user?.perfil)) {
    return respostaErro(
      res,
      403,
      "USUARIO-403-SEM-PERMISSAO",
      "Sem permissão para alterar este usuário."
    );
  }

  const payload = montarPerfilInstitucionalPayload(req.body);
  const validacao = await validarPerfilInstitucional(payload);

  if (!validacao.ok) {
    return respostaErro(
      res,
      422,
      "USUARIO-422-PERFIL-INSTITUCIONAL-VALIDACAO",
      "Erros de validação no perfil institucional.",
      { fieldErrors: validacao.fieldErrors }
    );
  }

  const toSave = {
    unidade_id: payload.unidade_id,
    cargo_id: payload.cargo_id,
    escolaridade_id: payload.escolaridade_id,
    deficiencia_id: payload.deficiencia_id,
    data_nascimento: validacao.data_nascimento,
    genero_id: payload.genero_id,
    orientacao_sexual_id: payload.orientacao_sexual_id,
    cor_raca_id: payload.cor_raca_id,
    registro: validacao.registro.value,
  };

  if (validacao.celular.provided) {
    toSave.celular = validacao.celular.value;
  }

  const campos = [];
  const valores = [];
  let index = 1;

  Object.entries(toSave).forEach(([campo, valor]) => {
    campos.push(`${campo} = $${index++}`);
    valores.push(valor === "" ? null : valor);
  });

  valores.push(id);

  try {
    await db.query(
      `
      UPDATE usuarios
         SET ${campos.join(", ")}
       WHERE id = $${index}
      `,
      valores
    );

    const { rows } = await db.query(
      `
      SELECT ${SELECT_USUARIO_COMPLETO}
      FROM usuarios u
      ${JOIN_USUARIO_COMPLETO}
      WHERE u.id = $1
      `,
      [id]
    );

    const usuario = sanitizeUsuario(rows[0] || {});

    res.set("X-Perfil-Incompleto", usuario.perfil_incompleto ? "1" : "0");

    return res.status(200).json({
      ok: true,
      code: "USUARIO-200-PERFIL-INSTITUCIONAL-ATUALIZADO",
      message: "Perfil institucional atualizado com sucesso.",
      data: usuario,
    });
  } catch (err) {
    console.error("[usuarioController.atualizarPerfilInstitucional] ERRO", err);

    const translated = traduzPgError(err);
    return res.status(translated.status).json(translated.payload);
  }
}

/* ──────────────────────────────────────────────────────────────
   ADMIN — atualizar perfil/permissão
────────────────────────────────────────────────────────────── */

async function atualizarPerfil(req, res) {
  const id = Number(req.params.id);
  const adminId = getUserId(req);

  if (!isAdmin(req.user?.perfil)) {
    return respostaErro(
      res,
      403,
      "USUARIO-403-ADMINISTRADOR-NECESSARIO",
      "Acesso negado."
    );
  }

  if (!Number.isInteger(id) || id <= 0) {
    return respostaErro(res, 400, "USUARIO-400-ID-INVALIDO", "ID inválido.");
  }

  const perfilNovo = perfilOficial(req.body?.perfil);

  if (!perfilNovo) {
    return respostaErro(
      res,
      422,
      "USUARIO-422-PERFIL-INVALIDO",
      "Perfil inválido.",
      {
        recebido: req.body?.perfil ?? null,
        permitidos: PERFIS_VALIDOS,
      }
    );
  }

  if (adminId === id && perfilNovo !== PERFIL_ADMINISTRADOR) {
    return respostaErro(
      res,
      422,
      "USUARIO-422-AUTO-REMOCAO-ADMINISTRADOR",
      "Você não pode remover o próprio perfil de administrador por esta tela."
    );
  }

  try {
    const atualQ = await db.query(
      `
      SELECT id, nome, email, celular, perfil
      FROM usuarios
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (!atualQ.rows?.length) {
      return respostaErro(
        res,
        404,
        "USUARIO-404-NAO-ENCONTRADO",
        "Usuário não encontrado."
      );
    }

    const atual = atualQ.rows[0];
    const perfilAtual = perfilOficial(atual.perfil);

    if (perfilAtual === perfilNovo) {
      return res.status(200).json({
        ok: true,
        code: "USUARIO-200-PERFIL-SEM-ALTERACAO",
        message: "Perfil já estava atualizado.",
        data: {
          ...atual,
          perfil: perfilAtual,
        },
      });
    }

    const result = await db.query(
      `
      UPDATE usuarios
         SET perfil = $1
       WHERE id = $2
       RETURNING id, nome, email, celular, perfil
      `,
      [perfilNovo, id]
    );

    logAuditoriaPlaceholder(req, "USUARIO_PERFIL_ATUALIZADO", {
      usuarioAlvoId: id,
      perfilAnterior: perfilAtual,
      perfilNovo,
    });

    return res.status(200).json({
      ok: true,
      code: "USUARIO-200-PERFIL-ATUALIZADO",
      message: "Perfil atualizado com sucesso.",
      data: {
        ...result.rows[0],
        perfil: perfilOficial(result.rows[0].perfil),
      },
    });
  } catch (err) {
    console.error("[usuarioController.atualizarPerfil] ERRO", err);

    const translated = traduzPgError(err);
    return res.status(translated.status).json(translated.payload);
  }
}

/* ──────────────────────────────────────────────────────────────
   ADMIN — listar organizadores
────────────────────────────────────────────────────────────── */

async function listarorganizador(_req, res) {
  try {
    const { rows } = await db.query(
      `
      WITH organizadores_base AS (
        SELECT DISTINCT
          u.id,
          u.nome,
          u.email,
          u.celular,
          u.perfil
        FROM usuarios u
        LEFT JOIN turma_responsavel tr
          ON tr.usuario_id = u.id
         AND tr.papel = $1
        WHERE u.perfil IN ('organizador', 'administrador')
           OR tr.usuario_id IS NOT NULL
      ),
      vinculos AS (
        SELECT DISTINCT
          tr.usuario_id AS usuario_id,
          t.evento_id,
          t.id AS turma_id
        FROM turma_responsavel tr
        JOIN turmas t ON t.id = tr.turma_id
        WHERE tr.papel = $1
      ),
      eventos_por_organizador AS (
        SELECT
          usuario_id,
          COUNT(DISTINCT evento_id)::int AS eventos_ministrados
        FROM vinculos
        GROUP BY usuario_id
      ),
      turmas_por_organizador AS (
        SELECT
          usuario_id,
          COUNT(DISTINCT turma_id)::int AS turmas_vinculadas
        FROM vinculos
        GROUP BY usuario_id
      ),
      notas_por_organizador AS (
        SELECT
          v.usuario_id,
          CASE a.desempenho_instrutor::text
            WHEN 'Péssimo' THEN 2
            WHEN 'Ruim' THEN 4
            WHEN 'Regular' THEN 6
            WHEN 'Bom' THEN 8
            WHEN 'Ótimo' THEN 10
            ELSE NULL
          END AS nota
        FROM vinculos v
        LEFT JOIN avaliacoes a ON a.turma_id = v.turma_id
      ),
      agg_notas AS (
        SELECT
          usuario_id,
          COUNT(nota)::int AS total_respostas,
          ROUND(AVG(nota)::numeric, 2) AS media_avaliacao
        FROM notas_por_organizador
        GROUP BY usuario_id
      ),
      assinaturas_agg AS (
        SELECT
          s.usuario_id,
          BOOL_OR(s.imagem_base64 IS NOT NULL AND BTRIM(s.imagem_base64) <> '') AS possui_assinatura
        FROM assinaturas s
        GROUP BY s.usuario_id
      )
      SELECT
        b.id,
        b.nome,
        b.email,
        b.celular,
        b.perfil,
        COALESCE(ep.eventos_ministrados, 0) AS eventos_ministrados,
        COALESCE(tp.turmas_vinculadas, 0) AS turmas_vinculadas,
        COALESCE(an.total_respostas, 0) AS total_respostas,
        an.media_avaliacao,
        COALESCE(aa.possui_assinatura, false) AS possui_assinatura
      FROM organizadores_base b
      LEFT JOIN eventos_por_organizador ep ON ep.usuario_id = b.id
      LEFT JOIN turmas_por_organizador tp ON tp.usuario_id = b.id
      LEFT JOIN agg_notas an ON an.usuario_id = b.id
      LEFT JOIN assinaturas_agg aa ON aa.usuario_id = b.id
      ORDER BY b.nome ASC
      `,
      [PAPEL_ORGANIZADOR]
    );

    return res.status(200).json({
      ok: true,
      data: (rows || []).map((row) => ({
        id: row.id,
        nome: row.nome,
        email: row.email,
        celular: row.celular,
        perfil: perfilOficial(row.perfil),
        eventos_ministrados: Number(row.eventos_ministrados) || 0,
        turmas_vinculadas: Number(row.turmas_vinculadas) || 0,
        total_respostas: Number(row.total_respostas) || 0,
        media_avaliacao:
          row.media_avaliacao !== null ? Number(row.media_avaliacao) : null,
        possui_assinatura: !!row.possui_assinatura,
      })),
    });
  } catch (err) {
    console.error("[usuarioController.listarorganizador] ERRO", err);

    return respostaErro(
      res,
      500,
      "USUARIO-500-LISTAR-ORGANIZADOR",
      "Erro ao listar organizadores."
    );
  }
}

/* ──────────────────────────────────────────────────────────────
   ADMIN — listar avaliadores
────────────────────────────────────────────────────────────── */

async function listarAvaliador(req, res) {
  const perfilFiltro = normStr(req.query.perfil);

  if (perfilFiltro && !["organizador", "administrador"].includes(perfilFiltro)) {
    return respostaErro(
      res,
      400,
      "USUARIO-400-PERFIL-AVALIADOR-INVALIDO",
      "Perfil inválido para avaliador.",
      { permitidos: ["organizador", "administrador"] }
    );
  }

  try {
    const params = [];
    let whereSql = "WHERE u.perfil IN ('organizador', 'administrador')";

    if (perfilFiltro) {
      params.push(perfilFiltro);
      whereSql = "WHERE u.perfil = $1";
    }

    const { rows } = await db.query(
      `
      SELECT u.id, u.nome, u.email, u.celular, u.perfil
      FROM usuarios u
      ${whereSql}
      ORDER BY u.nome ASC
      `,
      params
    );

    return res.status(200).json({
      ok: true,
      data: (rows || []).map((usuario) => ({
        ...usuario,
        perfil: perfilOficial(usuario.perfil),
      })),
    });
  } catch (err) {
    console.error("[usuarioController.listarAvaliador] ERRO", err);

    return respostaErro(
      res,
      500,
      "USUARIO-500-LISTAR-AVALIADOR",
      "Erro ao listar avaliadores."
    );
  }
}

/* ──────────────────────────────────────────────────────────────
   ADMIN — resumo do usuário
────────────────────────────────────────────────────────────── */

async function obterResumo(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return respostaErro(res, 400, "USUARIO-400-ID-INVALIDO", "ID inválido.");
  }

  try {
    const sqlCursos75 = `
      WITH minhas_turmas AS (
        SELECT t.id AS turma_id, t.data_inicio::date AS di_raw, t.data_fim::date AS df_raw
        FROM inscricoes i
        JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1
      ),
      datas_base AS (
        SELECT mt.turma_id, dt.data::date AS d
        FROM minhas_turmas mt
        JOIN datas_turma dt ON dt.turma_id = mt.turma_id

        UNION ALL

        SELECT mt.turma_id, gs::date AS d
        FROM minhas_turmas mt
        LEFT JOIN datas_turma dt ON dt.turma_id = mt.turma_id
        CROSS JOIN LATERAL generate_series(mt.di_raw, mt.df_raw, interval '1 day') AS gs
        WHERE dt.turma_id IS NULL
      ),
      pres AS (
        SELECT p.turma_id, p.data_presenca::date AS d, BOOL_OR(p.presente) AS presente
        FROM presencas p
        WHERE p.usuario_id = $1
        GROUP BY p.turma_id, p.data_presenca::date
      ),
      agreg AS (
        SELECT
          mt.turma_id,
          MAX(db.d) AS df,
          COUNT(*) AS total_encontros,
          COUNT(*) FILTER (WHERE p.presente IS TRUE AND db.d <= CURRENT_DATE) AS presentes_passados
        FROM minhas_turmas mt
        JOIN datas_base db ON db.turma_id = mt.turma_id
        LEFT JOIN pres p ON p.turma_id = mt.turma_id AND p.d = db.d
        GROUP BY mt.turma_id
      )
      SELECT
        COALESCE(COUNT(*) FILTER (
          WHERE CURRENT_DATE > df
            AND total_encontros > 0
            AND (presentes_passados::numeric / total_encontros) >= 0.75
        ), 0)::int AS total
      FROM agreg
    `;

    const sqlCertificados = `
      SELECT COALESCE(COUNT(*)::int, 0) AS total
      FROM certificados
      WHERE usuario_id = $1
        AND tipo = 'usuario'
        AND status IN ('emitido', 'enviado')
    `;

    const [cursosQ, certificadosQ] = await Promise.all([
      db.query(sqlCursos75, [id]),
      db.query(sqlCertificados, [id]),
    ]);

    const cursos75 = Number(cursosQ.rows?.[0]?.total || 0);
    const certificados = Number(certificadosQ.rows?.[0]?.total || 0);

    return res.status(200).json({
      ok: true,
      data: {
        cursos_concluidos_75: Math.max(cursos75, certificados),
        certificados_emitidos: certificados,
      },
    });
  } catch (err) {
    console.error("[usuarioController.obterResumo] ERRO", err);

    return respostaErro(
      res,
      500,
      "USUARIO-500-RESUMO",
      "Erro ao obter resumo do usuário."
    );
  }
}

/* ──────────────────────────────────────────────────────────────
   Exports oficiais
────────────────────────────────────────────────────────────── */

module.exports = {
  listar,
  obterPorId,
  buscar,
  atualizarBasico,
  atualizarDadosAdministrativos,
  atualizarPerfilInstitucional,
  atualizarPerfil,
  listarorganizador,
  listarAvaliador,
  obterResumo,
};