/* eslint-disable no-console */
// ✅ src/controllers/calendarioController.js — PREMIUM+++
// - Compat DB robusta
// - Logs com RID
// - Tipos alinhados ao CHECK real do Postgres
// - Normalização forte de tipo/data
// - Date-only safe (YYYY-MM-DD)
// - CRUD consistente
// - Respostas padronizadas
// - Tratamento melhor de erros PG/pg-promise
"use strict";

const dbMod = require("../db");

const IS_DEV = process.env.NODE_ENV !== "production";

/* =========================================================================
   Compat DB
=========================================================================== */
const pgpDb = dbMod?.db ?? null;
const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;

const query =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null) ||
  (pgpDb?.query ? pgpDb.query.bind(pgpDb) : null);

if (typeof query !== "function") {
  console.error("[calendarioController] DB inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em calendarioController.js (query ausente)");
}

function getDb(req) {
  const reqDb = req?.db;
  if (reqDb?.query && typeof reqDb.query === "function") return reqDb;
  return { query };
}

/* =========================================================================
   Logger premium
=========================================================================== */
function mkRid(prefix = "CAL") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function reqRid(req, prefix = "CAL") {
  return req?.requestId || req?.rid || mkRid(prefix);
}

function _log(rid, level, msg, extra) {
  const prefix = `[${rid}]`;

  if (level === "error") {
    return console.error(
      `${prefix} ✖ ${msg}`,
      extra?.stack || extra?.message || extra
    );
  }

  if (level === "warn") {
    return console.warn(`${prefix} ⚠ ${msg}`, extra || "");
  }

  if (IS_DEV) {
    return console.log(`${prefix} • ${msg}`, extra || "");
  }

  return undefined;
}

const logInfo = (rid, msg, extra) => _log(rid, "info", msg, extra);
const logWarn = (rid, msg, extra) => _log(rid, "warn", msg, extra);
const logErr = (rid, msg, err) => _log(rid, "error", msg, err);

/* =========================================================================
   Regras do domínio
=========================================================================== */
// ✅ CHECK real do banco: calendario_bloqueios_tipo_check
const TIPOS_PERMITIDOS = new Set([
  "feriado_nacional",
  "feriado_municipal",
  "ponto_facultativo",
  "bloqueio_interno",
]);

/* =========================================================================
   Helpers
=========================================================================== */
function toIntId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function isYmd(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function pickTipoInput(tipo) {
  if (tipo == null) return "";

  if (typeof tipo === "object") {
    if (tipo.value != null) return String(tipo.value);
    if (tipo.tipo != null) return String(tipo.tipo);
    return "";
  }

  return String(tipo);
}

function normTipo(tipo) {
  return pickTipoInput(tipo).trim().toLowerCase();
}

function normDescricao(descricao) {
  if (descricao == null) return null;
  const t = String(descricao).trim();
  if (!t) return null;
  return t.length > 2000 ? t.slice(0, 2000) : t;
}

function normalizeRowDateOnly(row) {
  if (!row) return row;

  if (row.data instanceof Date) {
    const iso = row.data.toISOString().slice(0, 10);
    return { ...row, data: iso };
  }

  if (typeof row.data === "string" && row.data.includes("T")) {
    return { ...row, data: row.data.slice(0, 10) };
  }

  return row;
}

function normalizeRowsDateOnly(rows = []) {
  return rows.map(normalizeRowDateOnly);
}

/* =========================================================================
   Query compat (pg + pg-promise)
=========================================================================== */
async function q(db, sql, params = []) {
  if (db?.query) {
    return db.query(sql, params);
  }

  if (db?.any) {
    const sqlTrim = String(sql).trim().toUpperCase();

    if (sqlTrim.startsWith("SELECT")) {
      const rows = await db.any(sql, params);
      return { rows, rowCount: rows.length };
    }

    if (/RETURNING/i.test(sql)) {
      const row = await db.oneOrNone(sql, params);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }

    await db.none(sql, params);
    return { rows: [], rowCount: 0 };
  }

  throw new Error("DB inválido: não possui query/any.");
}

/* =========================================================================
   Helpers de resposta
=========================================================================== */
function badRequest(res, msg, extra) {
  return res.status(400).json({ erro: msg, ...(extra || {}) });
}

function conflict(res, msg, extra) {
  return res.status(409).json({ erro: msg, ...(extra || {}) });
}

function notFound(res, msg, extra) {
  return res.status(404).json({ erro: msg, ...(extra || {}) });
}

function serverError(res, msg, err) {
  return res.status(500).json({
    erro: msg,
    detalhe: IS_DEV ? err?.message : undefined,
  });
}

/* =========================================================================
   SQL builders
=========================================================================== */
function sqlSelectBase() {
  return `
    SELECT
      id,
      to_char(data::date,'YYYY-MM-DD') AS data,
      tipo,
      descricao,
      criado_em,
      atualizado_em
    FROM calendario_bloqueios
  `;
}

/* =========================================================================
   Controller
=========================================================================== */
async function listar(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);

  try {
    const sql = `
      ${sqlSelectBase()}
      ORDER BY data ASC, id ASC
    `;

    const r = await q(db, sql);
    const rows = normalizeRowsDateOnly(r.rows || []);

    res.set?.("X-Calendario-Handler", "calendarioController:listar@premium+++");

    logInfo(rid, "listar OK", { total: rows.length });

    return res.json(rows);
  } catch (e) {
    logErr(rid, "listar erro", e);
    return serverError(res, "Erro ao listar datas.", e);
  }
}

async function criar(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);

  try {
    const body = req.body || {};
    const data = typeof body.data === "string" ? body.data.trim() : "";
    const tipoNorm = normTipo(body.tipo);
    const descNorm = normDescricao(body.descricao);

    logInfo(rid, "criar:start", {
      data,
      tipo: tipoNorm,
      hasDescricao: !!descNorm,
    });

    if (!data || !tipoNorm) {
      return badRequest(res, "Data e tipo são obrigatórios.");
    }

    if (!isYmd(data)) {
      return badRequest(res, "Data em formato inválido. Use o padrão AAAA-MM-DD.");
    }

    if (!TIPOS_PERMITIDOS.has(tipoNorm)) {
      return badRequest(res, "Tipo inválido.", {
        tipos_permitidos: Array.from(TIPOS_PERMITIDOS),
        recebido: tipoNorm,
      });
    }

    const sql = `
      INSERT INTO calendario_bloqueios (data, tipo, descricao)
      VALUES ($1::date, $2, $3)
      RETURNING
        id,
        to_char(data::date,'YYYY-MM-DD') AS data,
        tipo,
        descricao,
        criado_em,
        atualizado_em
    `;

    const r = await q(db, sql, [data, tipoNorm, descNorm]);
    const row = normalizeRowDateOnly(r.rows?.[0] || null);

    logInfo(rid, "criar OK", {
      id: row?.id || null,
      data: row?.data || null,
      tipo: row?.tipo || null,
    });

    return res.status(201).json(row);
  } catch (e) {
    logErr(rid, "criar erro", e);

    if (e?.code === "23505") {
      return conflict(res, "Esta data já foi cadastrada.");
    }

    if (e?.code === "23514") {
      return badRequest(res, "Tipo inválido (restrição do banco).", {
        tipos_permitidos: Array.from(TIPOS_PERMITIDOS),
      });
    }

    if (e?.code === "22007") {
      return badRequest(res, "Data em formato inválido. Use o padrão AAAA-MM-DD.");
    }

    return serverError(res, "Erro ao criar data.", e);
  }
}

async function atualizar(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);

  try {
    const id = toIntId(req.params.id);
    if (!id) return badRequest(res, "id inválido.");

    const body = req.body || {};

    const dataEnviada = Object.prototype.hasOwnProperty.call(body, "data");
    const tipoEnviado = Object.prototype.hasOwnProperty.call(body, "tipo");
    const descEnviada = Object.prototype.hasOwnProperty.call(body, "descricao");

    const dataNorm = dataEnviada
      ? typeof body.data === "string"
        ? body.data.trim()
        : ""
      : null;

    const tipoNorm = tipoEnviado ? normTipo(body.tipo) : null;
    const descNorm = descEnviada ? normDescricao(body.descricao) : undefined;

    logInfo(rid, "atualizar:start", {
      id,
      dataEnviada,
      tipoEnviado,
      descEnviada,
      data: dataNorm,
      tipo: tipoNorm,
      hasDescricao: !!descNorm,
    });

    if (!dataEnviada && !tipoEnviado && !descEnviada) {
      return badRequest(
        res,
        "Nada para atualizar. Envie 'data', 'tipo' e/ou 'descricao'."
      );
    }

    if (dataEnviada) {
      if (!dataNorm || !isYmd(dataNorm)) {
        return badRequest(
          res,
          "Data em formato inválido. Use o padrão AAAA-MM-DD."
        );
      }
    }

    if (tipoEnviado) {
      if (!tipoNorm) return badRequest(res, "Tipo inválido.");

      if (!TIPOS_PERMITIDOS.has(tipoNorm)) {
        return badRequest(res, "Tipo inválido.", {
          tipos_permitidos: Array.from(TIPOS_PERMITIDOS),
          recebido: tipoNorm,
        });
      }
    }

    const sets = [];
    const params = [];
    let idx = 1;

    if (dataEnviada) {
      sets.push(`data = $${idx++}::date`);
      params.push(dataNorm);
    }

    if (tipoEnviado) {
      sets.push(`tipo = $${idx++}`);
      params.push(tipoNorm);
    }

    if (descEnviada) {
      sets.push(`descricao = $${idx++}`);
      params.push(descNorm ?? null);
    }

    sets.push(`atualizado_em = NOW()`);
    params.push(id);

    const sql = `
      UPDATE calendario_bloqueios
         SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING
         id,
         to_char(data::date,'YYYY-MM-DD') AS data,
         tipo,
         descricao,
         criado_em,
         atualizado_em
    `;

    const r = await q(db, sql, params);
    const row = normalizeRowDateOnly(r.rows?.[0] || null);

    if (!row) {
      return notFound(res, "Registro não encontrado.");
    }

    logInfo(rid, "atualizar OK", {
      id: row.id,
      data: row.data,
      tipo: row.tipo,
    });

    return res.json(row);
  } catch (e) {
    logErr(rid, "atualizar erro", e);

    if (e?.code === "23505") {
      return conflict(res, "Já existe um registro com esta data.");
    }

    if (e?.code === "23514") {
      return badRequest(res, "Tipo inválido (restrição do banco).", {
        tipos_permitidos: Array.from(TIPOS_PERMITIDOS),
      });
    }

    if (e?.code === "22007") {
      return badRequest(res, "Data em formato inválido. Use o padrão AAAA-MM-DD.");
    }

    return serverError(res, "Erro ao atualizar data.", e);
  }
}

async function excluir(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);

  try {
    const id = toIntId(req.params.id);
    if (!id) return badRequest(res, "id inválido.");

    logInfo(rid, "excluir:start", { id });

    const check = await q(
      db,
      `SELECT id FROM calendario_bloqueios WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (!check.rowCount) {
      return notFound(res, "Registro não encontrado.");
    }

    await q(db, `DELETE FROM calendario_bloqueios WHERE id = $1`, [id]);

    logInfo(rid, "excluir OK", { id });

    return res.json({ ok: true });
  } catch (e) {
    logErr(rid, "excluir erro", e);
    return serverError(res, "Erro ao excluir data.", e);
  }
}

module.exports = {
  listar,
  criar,
  atualizar,
  excluir,
};