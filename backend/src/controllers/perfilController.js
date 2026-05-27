/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/perfilController.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Contrato oficial:
 * - Usuário autenticado: req.userId
 * - Rotas:
 *   GET /api/perfil/opcao
 *   GET /api/perfil/me
 *   PUT /api/perfil/me
 *
 * Regras:
 * - Perfil institucional obrigatório:
 *   cargo_id, unidade_id, data_nascimento, escolaridade_id, deficiencia_id
 *
 * - Campos opcionais:
 *   registro, genero_id, orientacao_sexual_id, cor_raca_id
 *
 * Sem aliases:
 * - sem orientacaoSexuais
 * - sem coresRacas
 * - sem req.usuario
 * - sem req.auth
 * - sem fallback silencioso de schema
 */

const dbModule = require("../db");

/* ────────────────────────────────────────────────────────────────
   DB
──────────────────────────────────────────────────────────────── */

const defaultDb = dbModule?.db ?? dbModule;

if (!defaultDb?.query || typeof defaultDb.query !== "function") {
  console.error("[perfilController] DB inválido:", Object.keys(dbModule || {}));
  throw new Error("DB inválido em perfilController.js: query ausente.");
}

function getDb(req) {
  return req?.db?.query ? req.db : defaultDb;
}

async function queryDb(req, sql, params = []) {
  const db = getDb(req);
  return db.query(sql, params);
}

/* ────────────────────────────────────────────────────────────────
   Config
──────────────────────────────────────────────────────────────── */

const IS_DEV = process.env.NODE_ENV !== "production";

const CAMPOS_PERFIL_OBRIGATORIOS = [
  "cargo_id",
  "unidade_id",
  "data_nascimento",
  "escolaridade_id",
  "deficiencia_id",
];

const FK_TABLES = new Set([
  "cargos",
  "unidades",
  "generos",
  "orientacoes_sexuais",
  "cores_racas",
  "escolaridades",
  "deficiencias",
]);

const REGISTRO_MASK_RE = /^\d{2}\.\d{3}-\d$/;

/* ────────────────────────────────────────────────────────────────
   Logger
──────────────────────────────────────────────────────────────── */

function mkRid(prefix = "PERFIL") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function log(rid, level, message, extra) {
  const prefix = `[PERFIL][RID=${rid}]`;

  if (level === "error") {
    return console.error(
      `${prefix} ✖ ${message}`,
      extra?.stack || extra?.message || extra
    );
  }

  if (!IS_DEV) return undefined;

  if (level === "warn") {
    return console.warn(`${prefix} ⚠ ${message}`, extra || "");
  }

  return console.log(`${prefix} • ${message}`, extra || "");
}

/* ────────────────────────────────────────────────────────────────
   Helpers de resposta
──────────────────────────────────────────────────────────────── */

function sendOk(res, { code, message, data, extra = {} }) {
  return res.status(200).json({
    ok: true,
    code,
    message,
    data,
    requestId: res.getHeader("X-Request-Id"),
    ...extra,
  });
}

function sendError(res, status, { code, message, fieldErrors, extra = {} }) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    erro: message,
    requestId: res.getHeader("X-Request-Id"),
    ...(fieldErrors ? { fieldErrors } : {}),
    ...extra,
  });
}

function setPerfilHeader(res, incompleto) {
  try {
    res.set("X-Perfil-Incompleto", incompleto ? "1" : "0");
  } catch {
    // noop
  }
}

/* ────────────────────────────────────────────────────────────────
   Helpers de validação
──────────────────────────────────────────────────────────────── */

function getUserId(req) {
  const id = Number(req?.userId);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isYmd(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validarYmdReal(value) {
  if (!isYmd(value)) {
    return {
      ok: false,
      value: "",
      message: "data_nascimento inválida. Use YYYY-MM-DD.",
    };
  }

  const [anoRaw, mesRaw, diaRaw] = value.split("-");
  const ano = Number(anoRaw);
  const mes = Number(mesRaw);
  const dia = Number(diaRaw);

  const date = new Date(Date.UTC(ano, mes - 1, dia));

  const dataExiste =
    date.getUTCFullYear() === ano &&
    date.getUTCMonth() === mes - 1 &&
    date.getUTCDate() === dia;

  if (!dataExiste) {
    return {
      ok: false,
      value,
      message: "data_nascimento inválida.",
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
      value,
      message: "data_nascimento não pode ser futura.",
    };
  }

  if (ano < 1900) {
    return {
      ok: false,
      value,
      message: "Ano de nascimento inválido.",
    };
  }

  return {
    ok: true,
    value,
    message: null,
  };
}

function normStr(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const text = String(value).trim();
  return text === "" ? null : text;
}

function parseRequiredPositiveInt(value, fieldName) {
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number <= 0) {
    return { error: `${fieldName} é obrigatório.` };
  }

  return { value: number };
}

function parseOptionalPositiveInt(value, fieldName) {
  if (value === undefined) return { value: undefined };
  if (value === null || value === "") return { value: null };

  const number = Number(value);

  if (!Number.isSafeInteger(number) || number <= 0) {
    return { error: `${fieldName} inválido.` };
  }

  return { value: number };
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

function validarRegistroOpcional(registro) {
  if (registro === undefined || registro === null || registro === "") {
    return {
      ok: true,
      value: null,
      message: null,
    };
  }

  const text = String(registro).trim();
  const digits = onlyDigits(text);

  if (REGISTRO_MASK_RE.test(text)) {
    return {
      ok: true,
      value: text,
      message: null,
    };
  }

  if (/^\d{6,7}$/.test(digits)) {
    const masked = toRegistroMasked(digits);

    if (masked) {
      return {
        ok: true,
        value: masked,
        message: null,
      };
    }
  }

  return {
    ok: false,
    value: "",
    message: "registro inválido. Use o formato 28.053-7.",
  };
}

function campoVazio(value) {
  return value === null || value === undefined || value === "";
}

function isPerfilInstitucionalIncompleto(usuario) {
  if (!usuario || typeof usuario !== "object") return true;

  return CAMPOS_PERFIL_OBRIGATORIOS.some((campo) => campoVazio(usuario[campo]));
}

function montarPerfilPayload(usuario) {
  const perfil_incompleto = isPerfilInstitucionalIncompleto(usuario);

  return {
    ...usuario,
    perfil_incompleto,
  };
}

async function assertExists(req, table, id, field = "id") {
  if (id === null || id === undefined || id === "") return true;

  const tableName = String(table || "").trim();
  const fieldName = String(field || "id").trim();

  if (!FK_TABLES.has(tableName)) {
    throw new Error(`Tabela não permitida em assertExists: ${tableName}`);
  }

  if (fieldName !== "id") {
    throw new Error(`Campo não permitido em assertExists: ${fieldName}`);
  }

  const result = await queryDb(
    req,
    `SELECT 1 FROM ${tableName} WHERE id = $1 LIMIT 1`,
    [id]
  );

  return result.rowCount > 0;
}

async function validarReferenciasPerfil(req, values) {
  const checks = [
    ["cargos", "cargo_id", values.cargo_id],
    ["unidades", "unidade_id", values.unidade_id],
    ["escolaridades", "escolaridade_id", values.escolaridade_id],
    ["deficiencias", "deficiencia_id", values.deficiencia_id],
    ["generos", "genero_id", values.genero_id],
    ["orientacoes_sexuais", "orientacao_sexual_id", values.orientacao_sexual_id],
    ["cores_racas", "cor_raca_id", values.cor_raca_id],
  ];

  const fieldErrors = {};

  for (const [table, key, value] of checks) {
    if (value !== null && value !== undefined && value !== "") {
      const exists = await assertExists(req, table, value);

      if (!exists) {
        fieldErrors[key] = "ID inexistente na referência.";
      }
    }
  }

  return fieldErrors;
}

/* ────────────────────────────────────────────────────────────────
   lookup
──────────────────────────────────────────────────────────────── */

async function listarOpcaoPerfil(req, res) {
  const rid = mkRid();

  try {
    const [
      cargosResult,
      unidadesResult,
      generosResult,
      orientacoesResult,
      coresResult,
      escolaridadesResult,
      deficienciasResult,
    ] = await Promise.all([
      queryDb(
        req,
        `
        SELECT
          id,
          nome,
          display_order
        FROM cargos
        WHERE is_active = TRUE
        ORDER BY display_order NULLS LAST, nome ASC
        `
      ),

      queryDb(
        req,
        `
        SELECT
          id,
          nome,
          sigla
        FROM unidades
        ORDER BY nome ASC
        `
      ),

      queryDb(
        req,
        `
        SELECT
          id,
          nome,
          display_order
        FROM generos
        WHERE is_active = TRUE
        ORDER BY display_order NULLS LAST, id ASC
        `
      ),

      queryDb(
        req,
        `
        SELECT
          id,
          nome,
          display_order
        FROM orientacoes_sexuais
        WHERE is_active = TRUE
        ORDER BY display_order NULLS LAST, id ASC
        `
      ),

      queryDb(
        req,
        `
        SELECT
          id,
          nome,
          display_order
        FROM cores_racas
        WHERE is_active = TRUE
        ORDER BY display_order NULLS LAST, id ASC
        `
      ),

      queryDb(
        req,
        `
        SELECT
          id,
          nome,
          display_order
        FROM escolaridades
        WHERE is_active = TRUE
        ORDER BY display_order NULLS LAST, id ASC
        `
      ),

      queryDb(
        req,
        `
        SELECT
          id,
          nome,
          display_order
        FROM deficiencias
        WHERE is_active = TRUE
        ORDER BY display_order NULLS LAST, id ASC
        `
      ),
    ]);

    const data = {
      cargos: cargosResult.rows || [],
      unidades: unidadesResult.rows || [],
      generos: generosResult.rows || [],
      orientacoes_sexuais: orientacoesResult.rows || [],
      cores_racas: coresResult.rows || [],
      escolaridades: escolaridadesResult.rows || [],
      deficiencias: deficienciasResult.rows || [],
    };

    log(rid, "info", "listarOpcaoPerfil OK", {
      cargos: data.cargos.length,
      unidades: data.unidades.length,
      generos: data.generos.length,
      orientacoes_sexuais: data.orientacoes_sexuais.length,
      cores_racas: data.cores_racas.length,
      escolaridades: data.escolaridades.length,
      deficiencias: data.deficiencias.length,
    });

    return sendOk(res, {
      code: "PERFIL-200-OPCAO",
      message: "Opções de perfil carregadas com sucesso.",
      data,
    });
  } catch (error) {
    log(rid, "error", "listarOpcaoPerfil erro", error);

    return sendError(res, 500, {
      code: "PERFIL-500-OPCAO",
      message: "Falha ao listar opções de perfil.",
      extra: IS_DEV ? { details: error?.message } : {},
    });
  }
}

/* ────────────────────────────────────────────────────────────────
   GET /api/perfil/me
──────────────────────────────────────────────────────────────── */

async function meuPerfil(req, res) {
  const rid = mkRid();

  try {
    const userId = getUserId(req);

    if (!userId) {
      return sendError(res, 401, {
        code: "PERFIL-401-NAO-AUTENTICADO",
        message: "Não autenticado.",
      });
    }

    const result = await queryDb(
      req,
      `
      SELECT
        id,
        nome,
        email,
        cpf,
        celular,
        registro,
        perfil,
        cargo_id,
        unidade_id,
        to_char(data_nascimento::date, 'YYYY-MM-DD') AS data_nascimento,
        genero_id,
        orientacao_sexual_id,
        cor_raca_id,
        escolaridade_id,
        deficiencia_id
      FROM usuarios
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    const usuario = result.rows?.[0] || null;

    if (!usuario) {
      return sendError(res, 404, {
        code: "PERFIL-404-USUARIO",
        message: "Usuário não encontrado.",
      });
    }

    const data = montarPerfilPayload(usuario);

    setPerfilHeader(res, data.perfil_incompleto);

    log(rid, "info", "meuPerfil OK", {
      userId,
      perfil_incompleto: data.perfil_incompleto,
    });

    return sendOk(res, {
      code: "PERFIL-200-ME",
      message: "Perfil carregado com sucesso.",
      data,
    });
  } catch (error) {
    log(rid, "error", "meuPerfil erro", error);

    return sendError(res, 500, {
      code: "PERFIL-500-ME",
      message: "Falha ao carregar perfil.",
      extra: IS_DEV ? { details: error?.message } : {},
    });
  }
}

/* ────────────────────────────────────────────────────────────────
   PUT /api/perfil/me
──────────────────────────────────────────────────────────────── */

async function atualizarMeuPerfil(req, res) {
  const rid = mkRid();

  try {
    const userId = getUserId(req);

    if (!userId) {
      return sendError(res, 401, {
        code: "PERFIL-401-NAO-AUTENTICADO",
        message: "Não autenticado.",
      });
    }

    const body = req.body || {};
    const fieldErrors = {};

    const registroInfo = validarRegistroOpcional(body.registro);

    if (!registroInfo.ok) {
      fieldErrors.registro = registroInfo.message;
    }

    const cargo = parseRequiredPositiveInt(body.cargo_id, "cargo_id");
    if (cargo.error) fieldErrors.cargo_id = cargo.error;

    const unidade = parseRequiredPositiveInt(body.unidade_id, "unidade_id");
    if (unidade.error) fieldErrors.unidade_id = unidade.error;

    const escolaridade = parseRequiredPositiveInt(
      body.escolaridade_id,
      "escolaridade_id"
    );
    if (escolaridade.error) fieldErrors.escolaridade_id = escolaridade.error;

    const deficiencia = parseRequiredPositiveInt(
      body.deficiencia_id,
      "deficiencia_id"
    );
    if (deficiencia.error) fieldErrors.deficiencia_id = deficiencia.error;

    let dataNascimento = body.data_nascimento;

    if (
      dataNascimento === undefined ||
      dataNascimento === null ||
      dataNascimento === ""
    ) {
      fieldErrors.data_nascimento = "data_nascimento é obrigatória.";
    } else {
      dataNascimento = String(dataNascimento).trim();

      const dataInfo = validarYmdReal(dataNascimento);

      if (!dataInfo.ok) {
        fieldErrors.data_nascimento = dataInfo.message;
      } else {
        dataNascimento = dataInfo.value;
      }
    }

    const genero = parseOptionalPositiveInt(body.genero_id, "genero_id");
    if (genero.error) fieldErrors.genero_id = genero.error;

    const orientacao = parseOptionalPositiveInt(
      body.orientacao_sexual_id,
      "orientacao_sexual_id"
    );
    if (orientacao.error) fieldErrors.orientacao_sexual_id = orientacao.error;

    const corRaca = parseOptionalPositiveInt(body.cor_raca_id, "cor_raca_id");
    if (corRaca.error) fieldErrors.cor_raca_id = corRaca.error;

    if (Object.keys(fieldErrors).length) {
      return sendError(res, 422, {
        code: "PERFIL-422-VALIDACAO",
        message: "Revise os campos destacados.",
        fieldErrors,
      });
    }

    const referenciaErrors = await validarReferenciasPerfil(req, {
      cargo_id: cargo.value,
      unidade_id: unidade.value,
      escolaridade_id: escolaridade.value,
      deficiencia_id: deficiencia.value,
      genero_id: genero.value ?? null,
      orientacao_sexual_id: orientacao.value ?? null,
      cor_raca_id: corRaca.value ?? null,
    });

    if (Object.keys(referenciaErrors).length) {
      return sendError(res, 422, {
        code: "PERFIL-422-REFERENCIA",
        message: "Revise os campos destacados.",
        fieldErrors: referenciaErrors,
      });
    }

    const result = await queryDb(
      req,
      `
      UPDATE usuarios
         SET
           registro = $1,
           cargo_id = $2,
           unidade_id = $3,
           data_nascimento = $4::date,
           genero_id = $5,
           orientacao_sexual_id = $6,
           cor_raca_id = $7,
           escolaridade_id = $8,
           deficiencia_id = $9
       WHERE id = $10
       RETURNING
           id,
           nome,
           email,
           cpf,
           celular,
           registro,
           perfil,
           cargo_id,
           unidade_id,
           to_char(data_nascimento::date, 'YYYY-MM-DD') AS data_nascimento,
           genero_id,
           orientacao_sexual_id,
           cor_raca_id,
           escolaridade_id,
           deficiencia_id
      `,
      [
        registroInfo.value,
        cargo.value,
        unidade.value,
        dataNascimento,
        genero.value ?? null,
        orientacao.value ?? null,
        corRaca.value ?? null,
        escolaridade.value,
        deficiencia.value,
        userId,
      ]
    );

    const usuario = result.rows?.[0] || null;

    if (!usuario) {
      return sendError(res, 404, {
        code: "PERFIL-404-USUARIO",
        message: "Usuário não encontrado.",
      });
    }

    const data = montarPerfilPayload(usuario);

    setPerfilHeader(res, data.perfil_incompleto);

    log(rid, "info", "atualizarMeuPerfil OK", {
      userId,
      perfil_incompleto: data.perfil_incompleto,
    });

    return sendOk(res, {
      code: "PERFIL-200-UPDATE",
      message: "Perfil atualizado com sucesso.",
      data,
    });
  } catch (error) {
    log(rid, "error", "atualizarMeuPerfil erro", error);

    return sendError(res, 500, {
      code: "PERFIL-500-UPDATE",
      message: "Falha ao atualizar perfil.",
      extra: IS_DEV ? { details: error?.message } : {},
    });
  }
}

module.exports = {
  listarOpcaoPerfil,
  meuPerfil,
  atualizarMeuPerfil,
};