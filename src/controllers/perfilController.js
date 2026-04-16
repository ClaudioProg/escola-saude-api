/* eslint-disable no-console */
// 📁 src/controllers/perfilController.js — PREMIUM++
// - Date-only safe
// - Compat DB robusta (req.db + fallback)
// - Validação mais segura
// - Fallback de schema nos lookups
// - Logs com RID
// - Shape consistente

"use strict";

const dbMod = require("../db");
const { isPerfilIncompleto } = require("../utils/perfil");

/* ────────────────────────────────────────────────────────────────
   Compat DB
──────────────────────────────────────────────────────────────── */
const pgpDb = dbMod?.db ?? null;
const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;

const baseQuery =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null) ||
  (pgpDb?.query ? pgpDb.query.bind(pgpDb) : null);

if (typeof baseQuery !== "function") {
  console.error("[perfilController] DB inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em perfilController.js (query ausente)");
}

function getDb(req) {
  const reqDb = req?.db;
  if (reqDb?.query && typeof reqDb.query === "function") return reqDb;
  return { query: baseQuery };
}

async function queryDb(req, sql, params = []) {
  const db = getDb(req);
  return db.query(sql, params);
}

const IS_DEV = process.env.NODE_ENV !== "production";

/* ────────────────────────────────────────────────────────────────
   Logger premium (RID)
──────────────────────────────────────────────────────────────── */
function mkRid(prefix = "PERFIL") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function log(rid, level, msg, extra) {
  const prefix = `[PERFIL][RID=${rid}]`;

  if (level === "error") {
    return console.error(
      `${prefix} ✖ ${msg}`,
      extra?.stack || extra?.message || extra
    );
  }

  if (!IS_DEV) return undefined;

  if (level === "warn") return console.warn(`${prefix} ⚠ ${msg}`, extra || "");
  return console.log(`${prefix} • ${msg}`, extra || "");
}

/* ────────────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────────────── */
function setPerfilHeader(res, incompleto) {
  try {
    res.set("X-Perfil-Incompleto", incompleto ? "1" : "0");
  } catch {}
}

function isMissingColumnOrRelation(err) {
  const code = err?.code || err?.original?.code;
  return code === "42703" || code === "42P01";
}

function isYmd(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function normStr(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseNullablePositiveInt(v, fieldName) {
  if (v === undefined) return { value: undefined };
  if (v === null || v === "") return { value: null };

  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return { error: `${fieldName} inválido.` };
  }

  return { value: n };
}

function badRequest(res, msg) {
  return res.status(400).json({ erro: msg });
}

async function tryQuery(req, rid, sqlPrimary, sqlFallback, massageFallbackRows) {
  try {
    const { rows } = await queryDb(req, sqlPrimary);
    return rows || [];
  } catch (e) {
    if (!isMissingColumnOrRelation(e)) {
      log(rid, "error", "Lookup primary falhou", e);
      throw e;
    }

    log(rid, "warn", "Lookup primary -> fallback", {
      code: e?.code,
      message: e?.message,
    });

    const { rows } = await queryDb(req, sqlFallback);
    const out = rows || [];
    return typeof massageFallbackRows === "function"
      ? massageFallbackRows(out)
      : out;
  }
}

function withDisplayOrder(rows = []) {
  return rows.map((x) => ({
    ...x,
    display_order: x.display_order ?? null,
  }));
}

function withSigla(rows = []) {
  return rows.map((x) => ({
    ...x,
    sigla: x.sigla ?? null,
  }));
}

function withPerfilFlags(res, payload) {
  const incompleto = isPerfilIncompleto(payload);
  setPerfilHeader(res, incompleto);
  return { ...payload, perfil_incompleto: incompleto };
}

async function genericLookup(req, rid, config) {
  return tryQuery(
    req,
    rid,
    config.sqlPrimary,
    config.sqlFallback,
    config.massageFallbackRows
  );
}

/* ────────────────────────────────────────────────────────────────
   GET /api/perfil/opcao
──────────────────────────────────────────────────────────────── */
async function listarOpcaoPerfil(req, res) {
  const rid = mkRid();

  try {
    const [
      cargos,
      unidades,
      generos,
      orientacao,
      cores,
      escolaridades,
      deficiencias,
    ] = await Promise.all([
      genericLookup(req, rid, {
        sqlPrimary: `
          SELECT id, nome, display_order
          FROM cargos
          WHERE is_active = TRUE
          ORDER BY display_order NULLS LAST, nome ASC
        `,
        sqlFallback: `SELECT id, nome FROM cargos ORDER BY nome ASC`,
        massageFallbackRows: withDisplayOrder,
      }),

      genericLookup(req, rid, {
        sqlPrimary: `
          SELECT id, nome, sigla
          FROM unidades
          ORDER BY nome ASC
        `,
        sqlFallback: `SELECT id, nome FROM unidades ORDER BY nome ASC`,
        massageFallbackRows: withSigla,
      }),

      genericLookup(req, rid, {
        sqlPrimary: `
          SELECT id, nome, display_order
          FROM generos
          WHERE is_active = TRUE
          ORDER BY display_order NULLS LAST, id ASC
        `,
        sqlFallback: `SELECT id, nome FROM generos ORDER BY nome ASC`,
        massageFallbackRows: withDisplayOrder,
      }),

      genericLookup(req, rid, {
        sqlPrimary: `
          SELECT id, nome, display_order
          FROM orientacoes_sexuais
          WHERE is_active = TRUE
          ORDER BY display_order NULLS LAST, id ASC
        `,
        sqlFallback: `SELECT id, nome FROM orientacoes_sexuais ORDER BY nome ASC`,
        massageFallbackRows: withDisplayOrder,
      }),

      genericLookup(req, rid, {
        sqlPrimary: `
          SELECT id, nome, display_order
          FROM cores_racas
          WHERE is_active = TRUE
          ORDER BY display_order NULLS LAST, id ASC
        `,
        sqlFallback: `SELECT id, nome FROM cores_racas ORDER BY nome ASC`,
        massageFallbackRows: withDisplayOrder,
      }),

      genericLookup(req, rid, {
        sqlPrimary: `
          SELECT id, nome, display_order
          FROM escolaridades
          WHERE is_active = TRUE
          ORDER BY display_order NULLS LAST, id ASC
        `,
        sqlFallback: `SELECT id, nome FROM escolaridades ORDER BY nome ASC`,
        massageFallbackRows: withDisplayOrder,
      }),

      genericLookup(req, rid, {
        sqlPrimary: `
          SELECT id, nome, display_order
          FROM deficiencias
          WHERE is_active = TRUE
          ORDER BY display_order NULLS LAST, id ASC
        `,
        sqlFallback: `SELECT id, nome FROM deficiencias ORDER BY nome ASC`,
        massageFallbackRows: withDisplayOrder,
      }),
    ]);

    const payload = {
      cargos,
      unidades,
      generos,

      // padrão oficial
      orientacoes_sexuais: orientacao,
      cores_racas: cores,
      escolaridades,
      deficiencias,

      // compat retro
      orientacaoSexuais: orientacao,
      coresRacas: cores,
    };

    log(rid, "info", "listarOpcaoPerfil OK", {
      cargos: cargos.length,
      unidades: unidades.length,
      generos: generos.length,
      orientacoes_sexuais: orientacao.length,
      cores_racas: cores.length,
      escolaridades: escolaridades.length,
      deficiencias: deficiencias.length,
    });

    return res.json(payload);
  } catch (err) {
    log(rid, "error", "listarOpcaoPerfil erro", err);
    return res.status(500).json({ erro: "Falha ao listar opções." });
  }
}

/* ────────────────────────────────────────────────────────────────
   GET /api/perfil/me
──────────────────────────────────────────────────────────────── */
async function meuPerfil(req, res) {
  const rid = mkRid();

  try {
    const userId = Number(req.user?.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ erro: "Não autorizado" });
    }

    const { rows } = await queryDb(
      req,
      `
      SELECT
        id,
        nome,
        email,
        registro,
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
      `,
      [userId]
    );

    const u = rows?.[0];
    if (!u) return res.status(404).json({ erro: "Usuário não encontrado." });

    log(rid, "info", "meuPerfil OK", { userId });
    return res.json(withPerfilFlags(res, u));
  } catch (err) {
    log(rid, "error", "meuPerfil erro", err);
    return res.status(500).json({ erro: "Falha ao carregar perfil." });
  }
}

/* ────────────────────────────────────────────────────────────────
   PUT/PATCH /api/perfil/me
──────────────────────────────────────────────────────────────── */
async function atualizarMeuPerfil(req, res) {
  const rid = mkRid();

  try {
    const userId = Number(req.user?.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ erro: "Não autorizado" });
    }

    const body = req.body || {};

    const registro = normStr(body.registro);

    const cargo = parseNullablePositiveInt(body.cargo_id, "cargo_id");
    if (cargo.error) return badRequest(res, cargo.error);

    const unidade = parseNullablePositiveInt(body.unidade_id, "unidade_id");
    if (unidade.error) return badRequest(res, unidade.error);

    const genero = parseNullablePositiveInt(body.genero_id, "genero_id");
    if (genero.error) return badRequest(res, genero.error);

    const orientacao = parseNullablePositiveInt(
      body.orientacao_sexual_id,
      "orientacao_sexual_id"
    );
    if (orientacao.error) return badRequest(res, orientacao.error);

    const corRaca = parseNullablePositiveInt(body.cor_raca_id, "cor_raca_id");
    if (corRaca.error) return badRequest(res, corRaca.error);

    const escolaridade = parseNullablePositiveInt(
      body.escolaridade_id,
      "escolaridade_id"
    );
    if (escolaridade.error) return badRequest(res, escolaridade.error);

    const deficiencia = parseNullablePositiveInt(
      body.deficiencia_id,
      "deficiencia_id"
    );
    if (deficiencia.error) return badRequest(res, deficiencia.error);

    let data_nascimento = body.data_nascimento;
    if (data_nascimento === undefined) {
      // não altera
    } else if (data_nascimento === null || data_nascimento === "") {
      data_nascimento = null;
    } else {
      data_nascimento = String(data_nascimento).trim();
      if (!isYmd(data_nascimento)) {
        return badRequest(res, "data_nascimento inválida. Use YYYY-MM-DD.");
      }
    }

    const sets = [];
    const vals = [];

    const push = (sqlFragment, value) => {
      vals.push(value);
      sets.push(sqlFragment.replace("?", `$${vals.length}`));
    };

    if (registro !== undefined) push("registro = ?", registro);

    if (cargo.value !== undefined) push("cargo_id = ?", cargo.value);
    if (unidade.value !== undefined) push("unidade_id = ?", unidade.value);

    if (data_nascimento !== undefined) push("data_nascimento = ?::date", data_nascimento);

    if (genero.value !== undefined) push("genero_id = ?", genero.value);
    if (orientacao.value !== undefined) {
      push("orientacao_sexual_id = ?", orientacao.value);
    }
    if (corRaca.value !== undefined) push("cor_raca_id = ?", corRaca.value);
    if (escolaridade.value !== undefined) {
      push("escolaridade_id = ?", escolaridade.value);
    }
    if (deficiencia.value !== undefined) push("deficiencia_id = ?", deficiencia.value);

    if (!sets.length) {
      return res.status(400).json({ erro: "Nada para atualizar." });
    }

    vals.push(userId);

    const { rows } = await queryDb(
      req,
      `
      UPDATE usuarios
         SET ${sets.join(", ")}
       WHERE id = $${vals.length}
      RETURNING
        id,
        nome,
        email,
        registro,
        cargo_id,
        unidade_id,
        to_char(data_nascimento::date, 'YYYY-MM-DD') AS data_nascimento,
        genero_id,
        orientacao_sexual_id,
        cor_raca_id,
        escolaridade_id,
        deficiencia_id
      `,
      vals
    );

    const u = rows?.[0];
    if (!u) return res.status(404).json({ erro: "Usuário não encontrado." });

    log(rid, "info", "atualizarMeuPerfil OK", {
      userId,
      camposAtualizados: sets.length,
    });

    return res.json(withPerfilFlags(res, u));
  } catch (err) {
    log(rid, "error", "atualizarMeuPerfil erro", err);
    return res.status(500).json({
      erro: "Falha ao atualizar perfil.",
      detalhe: IS_DEV ? err?.message : undefined,
    });
  }
}

module.exports = {
  listarOpcaoPerfil,
  meuPerfil,
  atualizarMeuPerfil,
};