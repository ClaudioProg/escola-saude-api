// ✅ src/controllers/unidadesController.js
/* eslint-disable no-console */
const crypto = require("crypto");

function getDb(req) {
  try {
    if (req?.db?.query) return req.db;
    const mod = require("../db");
    if (mod?.query) return mod;
    if (mod?.db?.query) return mod.db;
  } catch (_) {}
  throw new Error("DB não inicializado.");
}

function parseQueryParams(qs = {}) {
  const {
    q = "",
    limit = "50",
    offset = "0",
    orderBy = "sigla",
    direction = "asc",
    fields = "", // ex.: "id,nome,sigla"
  } = qs;

  const safeOrderBy = ["id", "nome", "sigla"].includes(String(orderBy).toLowerCase())
    ? String(orderBy).toLowerCase()
    : "sigla";

  const safeDirection = String(direction).toLowerCase() === "desc" ? "DESC" : "ASC";

  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200); // 1..200
  const off = Math.max(parseInt(offset, 10) || 0, 0);

  const allowed = new Set(["id", "nome", "sigla"]);
  const selectedFields = String(fields)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((f) => allowed.has(f));

  const finalFields = selectedFields.length ? selectedFields : ["id", "sigla", "nome"];

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
   GET /unidades — lista com filtros/paginação/ordenação
   (compat: ?legacy=1 retorna apenas array)
────────────────────────────────────────────────────────────── */
exports.listar = async (req, res) => {
  const db = getDb(req);

  try {
    const { q, limit, offset, orderBy, direction, fields } = parseQueryParams(req.query);

    const where = [];
    const params = [];

    if (q) {
      params.push(`%${q}%`, `%${q}%`);
      where.push("(unidades.nome ILIKE $1 OR unidades.sigla ILIKE $2)");
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const selectCols = fields.map((f) => `unidades.${f}`).join(", ");

    // total
    const countSql = `SELECT COUNT(*)::int AS total FROM unidades ${whereSql};`;
    const countRes = await db.query(countSql, params);
    const total = countRes.rows?.[0]?.total ?? 0;

    // dados
    const orderSql =
      orderBy === "sigla"
        ? `ORDER BY unidades.sigla ${direction} NULLS LAST, unidades.nome ASC`
        : `ORDER BY unidades.${orderBy} ${direction}`;

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

    const snapshot = JSON.stringify({ q, limit, offset, orderBy, direction, fields, total, rows });
    const etag = buildETag(snapshot);
    setCachingHeaders(res, etag);
    if (req.headers["if-none-match"] === etag) return res.status(304).end();

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
      return res.status(200).json(rows);
    }

    return res.status(200).json(body);
  } catch (err) {
    console.error("❌ Erro ao listar unidades:", err);
    return res.status(500).json({ message: "Erro ao listar unidades." });
  }
};

/* ──────────────────────────────────────────────────────────────
   GET /unidades/:id — detalhe de uma unidade
────────────────────────────────────────────────────────────── */
exports.obterPorId = async (req, res) => {
  const db = getDb(req);
  const { id } = req.params;

  const uid = Number(id);
  if (!Number.isInteger(uid) || uid <= 0) {
    return res.status(400).json({ message: "Parâmetro :id inválido." });
    }
  try {
    const sql = `SELECT id, sigla, nome FROM unidades WHERE id = $1 LIMIT 1;`;
    const r = await db.query(sql, [uid]);
    if (!r.rows?.length) return res.status(404).json({ message: "Unidade não encontrada." });

    const etag = buildETag(JSON.stringify(r.rows[0]));
    setCachingHeaders(res, etag);
    if (req.headers["if-none-match"] === etag) return res.status(304).end();

    return res.status(200).json({ data: r.rows[0] });
  } catch (err) {
    console.error(`❌ Erro ao obter unidade ${id}:`, err);
    return res.status(500).json({ message: "Erro ao buscar unidade." });
  }
};
