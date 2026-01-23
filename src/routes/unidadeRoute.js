// ✅ src/routes/unidadeRoute.js
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
    limit = "200", // ✅ default 200
    offset = "0",
    orderBy = "nome",
    direction = "asc",
    fields = "", // ex.: "id,nome,sigla"
  } = qs;

  const safeOrderBy = ["nome", "sigla", "id"].includes(String(orderBy).toLowerCase())
    ? String(orderBy).toLowerCase()
    : "nome";

  const safeDirection = String(direction).toLowerCase() === "desc" ? "DESC" : "ASC";

  // ✅ teto 200 (você disse que nunca passará disso)
  const lim = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 200); // 1..200
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
  };
}

function buildETag(payload) {
  return `"u-${crypto.createHash("sha1").update(payload).digest("base64")}"`;
}

function setCachingHeaders(res, etag) {
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
}

/* ──────────────────────────────────────────────────────────────
   Rate limit (defensivo)
────────────────────────────────────────────────────────────── */
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ──────────────────────────────────────────────────────────────
   🏥 GET /unidades — Lista com filtros/paginação/ordenação
   Compatível com a resposta antiga (array), porém agora envelopada.
   Para manter 100% de compatibilidade, permita ?legacy=1 para retornar array puro.
────────────────────────────────────────────────────────────── */
router.get("/", limiter, async (req, res) => {
  const db = getDb(req);

  try {
    const { q, limit, offset, orderBy, direction, fields } = parseQueryParams(req.query);

    // WHERE + params
    const where = [];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      params.push(`%${q}%`);
      where.push("(unidades.nome ILIKE $1 OR unidades.sigla ILIKE $2)");
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // Campos seguros
    const selectCols = fields.map((f) => `unidades.${f}`).join(", ");

    // Total
    const countSql = `SELECT COUNT(*)::int AS total FROM unidades ${whereSql};`;
    const countRes = await db.query(countSql, params);
    const total = countRes.rows?.[0]?.total ?? 0;

    // Dados
    const orderSql = `ORDER BY unidades.${orderBy} ${direction}`;
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

    // Logs “premium”
    console.log(
      `[UNIDADES] q="${q}" | total=${total} | returned=${rows.length} | limit=${limit} | offset=${offset} | order=${orderBy} ${direction}`
    );

    // ETag + Conditional GET
    const payloadPreview = JSON.stringify({ q, limit, offset, orderBy, direction, fields, total, rows });
    const etag = buildETag(payloadPreview);
    setCachingHeaders(res, etag);

    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    // Envelope moderno + fallback opcional de compat
    const body = {
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
    };

    if (String(req.query.legacy) === "1") {
      // Compat: apenas o array de linhas
      return res.status(200).json(rows);
    }

    return res.status(200).json(body);
  } catch (err) {
    console.error("❌ Erro ao buscar unidades:", err);
    return res.status(500).json({ erro: "Erro ao buscar unidades" });
  }
});

/* ──────────────────────────────────────────────────────────────
   🆔 GET /unidades/:id — Busca uma unidade específica
────────────────────────────────────────────────────────────── */
router.get("/:id", limiter, async (req, res) => {
  const db = getDb(req);
  const { id } = req.params;

  // Validação simples de ID numérico
  const uid = Number(id);
  if (!Number.isInteger(uid) || uid <= 0) {
    return res.status(400).json({ erro: "Parâmetro :id inválido." });
  }

  try {
    const sql = `
      SELECT id, nome, sigla
      FROM unidades
      WHERE id = $1
      LIMIT 1;
    `;
    const r = await db.query(sql, [uid]);
    if (!r.rows?.length) {
      return res.status(404).json({ erro: "Unidade não encontrada." });
    }

    // ETag individual
    const etag = buildETag(JSON.stringify(r.rows[0]));
    setCachingHeaders(res, etag);
    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    return res.status(200).json({ data: r.rows[0] });
  } catch (err) {
    console.error(`❌ Erro ao buscar unidade ${id}:`, err);
    return res.status(500).json({ erro: "Erro ao buscar unidade" });
  }
});

module.exports = router;
