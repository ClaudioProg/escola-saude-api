// ✅ src/routes/unidadeRoute.js — PREMIUM/UNIFICADO
/* eslint-disable no-console */
"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

const router = express.Router();

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */
function getDb(req) {
  try {
    if (req?.db && typeof req.db.query === "function") return req.db;

    const mod = require("../db");
    if (mod && typeof mod.query === "function") return mod;
    if (mod?.db && typeof mod.db.query === "function") return mod.db;
  } catch (_) {}

  throw new Error("DB não inicializado.");
}

function parseQueryParams(qs = {}) {
  const {
    q = "",
    limit = "200",
    offset = "0",
    orderBy = "nome",
    direction = "asc",
    fields = "",
    legacy = "0",
  } = qs;

  const safeOrderBy = ["id", "nome", "sigla"].includes(String(orderBy).toLowerCase())
    ? String(orderBy).toLowerCase()
    : "nome";

  const safeDirection = String(direction).toLowerCase() === "desc" ? "DESC" : "ASC";

  const lim = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);

  const allowed = new Set(["id", "nome", "sigla"]);
  const selectedFields = String(fields)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((f) => allowed.has(f));

  const finalFields = selectedFields.length ? selectedFields : ["id", "nome", "sigla"];

  return {
    q: String(q).trim(),
    limit: lim,
    offset: off,
    orderBy: safeOrderBy,
    direction: safeDirection,
    fields: finalFields,
    legacy: String(legacy) === "1",
  };
}

function buildETag(payload) {
  return `"u-${crypto.createHash("sha1").update(payload).digest("base64")}"`;
}

function setCachingHeaders(res, etag) {
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
}

function routeTag(tag) {
  return (_req, res, next) => {
    res.setHeader("X-Route-Handler", tag);
    return next();
  };
}

function asPositiveInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ──────────────────────────────────────────────────────────────
   Rate limit
────────────────────────────────────────────────────────────── */
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Aguarde alguns instantes." },
});

/* ──────────────────────────────────────────────────────────────
   Middleware base
────────────────────────────────────────────────────────────── */
router.use(routeTag("unidadeRoute"));

/* ──────────────────────────────────────────────────────────────
   🏥 GET /unidade
   Lista com filtros/paginação/ordenação
   Compatível com ?legacy=1
────────────────────────────────────────────────────────────── */
router.get("/", limiter, async (req, res) => {
  const db = getDb(req);

  try {
    const { q, limit, offset, orderBy, direction, fields, legacy } = parseQueryParams(req.query);

    const where = [];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      params.push(`%${q}%`);
      where.push("(unidades.nome ILIKE $1 OR unidades.sigla ILIKE $2)");
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const selectCols = fields.map((f) => `unidades.${f}`).join(", ");

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM unidades
      ${whereSql};
    `;
    const countRes = await db.query(countSql, params);
    const total = countRes.rows?.[0]?.total ?? 0;

    const orderSql =
      orderBy === "sigla"
        ? `ORDER BY unidades.sigla ${direction} NULLS LAST, unidades.nome ASC, unidades.id ASC`
        : orderBy === "nome"
          ? `ORDER BY unidades.nome ${direction} NULLS LAST, unidades.sigla ASC, unidades.id ASC`
          : `ORDER BY unidades.id ${direction}`;

    const dataSql = `
      SELECT ${selectCols}
      FROM unidades
      ${whereSql}
      ${orderSql}
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2};
    `;
    const dataParams = [...params, limit, offset];
    const dataRes = await db.query(dataSql, dataParams);
    const rows = dataRes.rows || [];

    console.log(
      `[UNIDADES] q="${q}" | total=${total} | returned=${rows.length} | limit=${limit} | offset=${offset} | order=${orderBy} ${direction}`
    );

    const payloadPreview = JSON.stringify({
      q,
      limit,
      offset,
      orderBy,
      direction,
      fields,
      total,
      rows,
    });

    const etag = buildETag(payloadPreview);
    setCachingHeaders(res, etag);

    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    if (legacy) {
      return res.status(200).json(rows);
    }

    return res.status(200).json({
      data: rows,
      meta: {
        total,
        count: rows.length,
        limit,
        offset,
        has_more: offset + rows.length < total,
        orderBy,
        direction: direction.toLowerCase(),
        q,
        fields,
      },
    });
  } catch (err) {
    console.error("❌ Erro ao listar unidades:", err);
    return res.status(500).json({ erro: "Erro ao listar unidades." });
  }
});

/* ──────────────────────────────────────────────────────────────
   🆔 GET /unidade/:id
   Busca uma unidade específica
────────────────────────────────────────────────────────────── */
router.get("/:id", limiter, async (req, res) => {
  const db = getDb(req);
  const id = asPositiveInt(req.params.id);

  if (!id) {
    return res.status(400).json({ erro: "Parâmetro :id inválido." });
  }

  try {
    const sql = `
      SELECT id, nome, sigla
      FROM unidades
      WHERE id = $1
      LIMIT 1;
    `;

    const result = await db.query(sql, [id]);
    const row = result.rows?.[0];

    if (!row) {
      return res.status(404).json({ erro: "Unidade não encontrada." });
    }

    const etag = buildETag(JSON.stringify(row));
    setCachingHeaders(res, etag);

    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    return res.status(200).json({ data: row });
  } catch (err) {
    console.error(`❌ Erro ao buscar unidade ${id}:`, err);
    return res.status(500).json({ erro: "Erro ao buscar unidade." });
  }
});

module.exports = router;