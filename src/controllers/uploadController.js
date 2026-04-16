/* eslint-disable no-console */
// ✅ src/controllers/uploadController.js (banner: DB BYTEA) — PREMIUM++
"use strict";

const crypto = require("crypto");
const dbMod = require("../db");

const db = dbMod?.db ?? dbMod;
const getDB = (req) => (req && req.db ? req.db : db);

/* ───────────────────────── Constantes ───────────────────────── */
const MAX_BYTES = 50 * 1024 * 1024; // 50MB

const PPT_MIMES = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/octet-stream", // alguns browsers/uploads antigos mandam isso
];

const DEFAULT_PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/* ───────────────────────── Helpers ───────────────────────── */
function sha256(buf) {
  const h = crypto.createHash("sha256");
  h.update(buf);
  return h.digest("hex");
}

function safeFilename(name, fallback = "modelo-banner.pptx") {
  const base = String(name || "").trim() || fallback;
  return base.replace(/[/\\?%*:|"<>]/g, "_");
}

function ensurePptxName(name, fallbackBase = "modelo-banner") {
  const clean = safeFilename(name || fallbackBase, `${fallbackBase}.pptx`);
  return clean.replace(/\.(ppt|pptx)$/i, "") + ".pptx";
}

function setDownloadSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Download-Options", "noopen");
}

function isMissingColumn(err) {
  return err?.code === "42703";
}

function isMissingTable(err) {
  return err?.code === "42P01";
}

function isMissingRelationBits(err) {
  return isMissingColumn(err) || isMissingTable(err);
}

function isPptFilename(name = "") {
  return /\.(ppt|pptx)$/i.test(String(name || "").trim());
}

function isPptMime(mime = "") {
  const m = String(mime || "").toLowerCase().trim();
  return PPT_MIMES.includes(m) || m.includes("powerpoint") || m.includes("presentation");
}

function getActorId(req) {
  return req?.user?.id ?? req?.usuario?.id ?? null;
}

function getActorLabel(req) {
  return (
    req?.user?.cpf ||
    req?.user?.email ||
    req?.user?.id ||
    req?.usuario?.cpf ||
    req?.usuario?.email ||
    req?.usuario?.id ||
    "admin"
  );
}

/* ───────────────────────── Exec compatível pg / pg-promise ───────────────────────── */
async function qQuery(DB, sql, params = []) {
  if (typeof DB?.query === "function") return DB.query(sql, params);
  throw new Error("DB inválido: query ausente.");
}

async function qOneOrNone(DB, sql, params = []) {
  if (typeof DB?.oneOrNone === "function") return DB.oneOrNone(sql, params);

  const r = await qQuery(DB, sql, params);
  return r?.rows?.[0] || null;
}

async function qNone(DB, sql, params = []) {
  if (typeof DB?.none === "function") return DB.none(sql, params);
  return qQuery(DB, sql, params);
}

async function qResult(DB, sql, params = []) {
  if (typeof DB?.result === "function") return DB.result(sql, params);
  return qQuery(DB, sql, params);
}

/* ───────────────────────── Schema helpers ───────────────────────── */
async function hasColumn(DB, tableName, columnName) {
  const row = await qOneOrNone(
    DB,
    `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    LIMIT 1
    `,
    [tableName, columnName]
  );
  return !!row;
}

async function getModelTableCapabilities(DB) {
  const table = "trabalhos_modelos";

  const [hasAtualizadoPor, hasAtualizadoEm, hasCriadoEm, hasNome, hasMime, hasTamanho, hasArquivo] =
    await Promise.all([
      hasColumn(DB, table, "atualizado_por"),
      hasColumn(DB, table, "atualizado_em"),
      hasColumn(DB, table, "criado_em"),
      hasColumn(DB, table, "nome"),
      hasColumn(DB, table, "mime"),
      hasColumn(DB, table, "tamanho"),
      hasColumn(DB, table, "arquivo"),
    ]);

  return {
    hasAtualizadoPor,
    hasAtualizadoEm,
    hasCriadoEm,
    hasNome,
    hasMime,
    hasTamanho,
    hasArquivo,
  };
}

/* ───────────────────────── GET (público) ───────────────────────── */
/**
 * GET /api/modelos/banner.pptx
 * Público
 * Fonte de verdade: BYTEA em trabalhos_modelos.arquivo
 */
exports.baixarModeloBanner = async (req, res, next) => {
  const DB = getDB(req);

  try {
    const caps = await getModelTableCapabilities(DB);

    if (!caps.hasArquivo) {
      const e = new Error("A tabela trabalhos_modelos não possui a coluna 'arquivo'.");
      e.status = 500;
      throw e;
    }

    let row = null;

    // tentativa com updated/created timestamps
    try {
      const tsExpr = caps.hasAtualizadoEm && caps.hasCriadoEm
        ? "COALESCE(atualizado_em, criado_em)"
        : caps.hasAtualizadoEm
        ? "atualizado_em"
        : caps.hasCriadoEm
        ? "criado_em"
        : "NOW()";

      row = await qOneOrNone(
        DB,
        `
        SELECT
          ${caps.hasNome ? "nome" : "'modelo-banner' AS nome"},
          ${caps.hasMime ? "mime" : `'${DEFAULT_PPTX_MIME}' AS mime`},
          ${caps.hasTamanho ? "tamanho" : "NULL::bigint AS tamanho"},
          arquivo,
          ${tsExpr} AS ts_ref
        FROM trabalhos_modelos
        WHERE tipo = 'banner'
        LIMIT 1
        `
      );
    } catch (err) {
      if (!isMissingRelationBits(err)) throw err;

      row = await qOneOrNone(
        DB,
        `
        SELECT
          'modelo-banner' AS nome,
          '${DEFAULT_PPTX_MIME}' AS mime,
          NULL::bigint AS tamanho,
          arquivo,
          NOW() AS ts_ref
        FROM trabalhos_modelos
        WHERE tipo = 'banner'
        LIMIT 1
        `
      );
    }

    if (!row) {
      const e = new Error("Modelo de banner não encontrado.");
      e.status = 404;
      throw e;
    }

    const buffer = row.arquivo;
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      const e = new Error("Arquivo inválido no banco.");
      e.status = 500;
      throw e;
    }

    const filename = ensurePptxName(row.nome || "modelo-banner");
    const mime = isPptMime(row.mime) ? row.mime : DEFAULT_PPTX_MIME;
    const size = Number(row.tamanho) > 0 ? Number(row.tamanho) : buffer.length;
    const ts = row.ts_ref ? new Date(row.ts_ref) : new Date();

    const digest = sha256(buffer).slice(0, 16);
    const etag = `"pptx-${size.toString(16)}-${Number(ts.getTime()).toString(36)}-${digest}"`;

    res.setHeader("ETag", etag);
    res.setHeader("Last-Modified", ts.toUTCString());
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    setDownloadSecurityHeaders(res);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", String(size));
    res.setHeader("X-Checksum-SHA256", sha256(buffer));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );

    return res.send(buffer);
  } catch (err) {
    console.error("[uploadController.baixarModeloBanner] erro", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
    });
    next(err);
  }
};

/* ───────────────────────── POST (admin) ───────────────────────── */
/**
 * POST /api/admin/modelos/banner
 * Admin, multipart/form-data
 * Campo: file
 * Persistência real: BYTEA em trabalhos_modelos.arquivo
 */
exports.subirModeloBanner = async (req, res, next) => {
  const DB = getDB(req);

  try {
    const f = req.file;
    if (!f) {
      const e = new Error("Arquivo é obrigatório (campo 'file').");
      e.status = 400;
      throw e;
    }

    if (!Buffer.isBuffer(f.buffer) || f.buffer.length === 0) {
      const e = new Error("Arquivo vazio ou inválido.");
      e.status = 400;
      throw e;
    }

    if (f.buffer.length > MAX_BYTES || Number(f.size || 0) > MAX_BYTES) {
      const e = new Error("Arquivo excede 50MB.");
      e.status = 413;
      throw e;
    }

    const originalname = String(f.originalname || "").trim();
    const mimetype = String(f.mimetype || "").trim();

    const validByName = isPptFilename(originalname);
    const validByMime = isPptMime(mimetype);

    if (!validByName && !validByMime) {
      const e = new Error("Formato inválido: envie um arquivo .ppt ou .pptx.");
      e.status = 400;
      throw e;
    }

    const caps = await getModelTableCapabilities(DB);

    if (!caps.hasArquivo) {
      const e = new Error("A tabela trabalhos_modelos não possui a coluna 'arquivo'.");
      e.status = 500;
      throw e;
    }

    const nomeFinal = ensurePptxName(req.body?.nome || originalname || "modelo-banner");
    const nomeBase = nomeFinal.replace(/\.pptx$/i, "");
    const mimeFinal = validByMime ? mimetype : DEFAULT_PPTX_MIME;
    const size = Number(f.size || f.buffer.length || 0);
    const checksum = sha256(f.buffer);
    const actorId = getActorId(req);

    const insertCols = ["tipo"];
    const insertVals = ["'banner'"];
    const updateSet = [];

    const params = [];
    const pushParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (caps.hasNome) {
      const p = pushParam(nomeBase);
      insertCols.push("nome");
      insertVals.push(p);
      updateSet.push(`nome = EXCLUDED.nome`);
    }

    if (caps.hasMime) {
      const p = pushParam(mimeFinal);
      insertCols.push("mime");
      insertVals.push(p);
      updateSet.push(`mime = EXCLUDED.mime`);
    }

    if (caps.hasTamanho) {
      const p = pushParam(size);
      insertCols.push("tamanho");
      insertVals.push(p);
      updateSet.push(`tamanho = EXCLUDED.tamanho`);
    }

    {
      const p = pushParam(f.buffer);
      insertCols.push("arquivo");
      insertVals.push(p);
      updateSet.push(`arquivo = EXCLUDED.arquivo`);
    }

    if (caps.hasAtualizadoPor) {
      const p = pushParam(actorId);
      insertCols.push("atualizado_por");
      insertVals.push(p);
      updateSet.push(`atualizado_por = EXCLUDED.atualizado_por`);
    }

    if (caps.hasAtualizadoEm) {
      insertCols.push("atualizado_em");
      insertVals.push("NOW()");
      updateSet.push(`atualizado_em = NOW()`);
    }

    const sql = `
      INSERT INTO trabalhos_modelos (${insertCols.join(", ")})
      VALUES (${insertVals.join(", ")})
      ON CONFLICT (tipo)
      DO UPDATE SET
        ${updateSet.join(", ")}
    `;

    await qNone(DB, sql, params);

    console.log(
      `[UPLOAD:BANNER] nome="${nomeFinal}" | size=${size} | sha256=${checksum.slice(0, 12)}... | by=${getActorLabel(req)}`
    );

    return res.status(201).json({
      ok: true,
      tipo: "banner",
      nome: nomeFinal,
      tamanho: size,
      mime: mimeFinal,
      checksum_sha256: checksum,
      persistido_em: "banco",
    });
  } catch (err) {
    console.error("[uploadController.subirModeloBanner] erro", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
    });
    next(err);
  }
};