// ✅ src/controllers/uploadController.js (banner: DB BYTEA)
/* eslint-disable no-console */
const crypto = require("crypto");
const { db } = require("../db");

const getDB = (req) => (req && req.db) ? req.db : db;

// ───────────────────────── helpers ─────────────────────────
const PPT_MIMES = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
];

function sha256(buf) {
  const h = crypto.createHash("sha256");
  h.update(buf);
  return h.digest("hex");
}

function safeFilename(name, fallback = "modelo-banner.pptx") {
  const base = String(name || "").trim() || fallback;
  return base.replace(/[/\\?%*:|"<>]/g, "_");
}

function setDownloadSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Download-Options", "noopen");
}

// Executores compatíveis pg-promise / node-postgres
async function qOneOrNone(DB, sql, params = []) {
  if (typeof DB.oneOrNone === "function") return DB.oneOrNone(sql, params);
  const r = await DB.query(sql, params);
  return r?.rows?.[0] || null;
}
async function qNone(DB, sql, params = []) {
  if (typeof DB.none === "function") return DB.none(sql, params);
  return DB.query(sql, params);
}

// ───────────────────────── GET (público) ─────────────────────────
// GET /api/modelos/banner.pptx  (público)
exports.baixarModeloBanner = async (req, res, next) => {
  const DB = getDB(req);
  try {
    // Inclui campos de auditoria caso existam (atualizado_em, atualizado_por)
    const row = await qOneOrNone(
      DB,
      `
      SELECT nome, mime, tamanho, arquivo
           , COALESCE(atualizado_em, criado_em) AS ts_ref
      FROM trabalhos_modelos
      WHERE tipo = 'banner'
      `
    );

    if (!row) {
      const e = new Error("Modelo de banner não encontrado.");
      e.status = 404;
      throw e;
    }

    const buffer = row.arquivo; // BYTEA -> Buffer
    if (!buffer || !Buffer.isBuffer(buffer)) {
      const e = new Error("Arquivo inválido no banco.");
      e.status = 500;
      throw e;
    }

    const filename = safeFilename(`${(row.nome || "modelo-banner").replace(/\.(pptx?|PPTX?)$/, "")}.pptx`);
    const mime = row.mime && PPT_MIMES.includes(row.mime)
      ? row.mime
      : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    const size = Number(row.tamanho) || buffer.length;
    const ts = row.ts_ref ? new Date(row.ts_ref) : new Date();

    // ETag/Last-Modified/Cache
    const digest = sha256(buffer).slice(0, 16); // pequeno para ETag
    const etag = `"pptx-${size.toString(16)}-${Number(ts.getTime()).toString(36)}-${digest}"`;

    res.setHeader("ETag", etag);
    res.setHeader("Last-Modified", ts.toUTCString());
    // curto, com SWR para CDNs / PWA
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

    // Conditional GET
    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    // Headers de download
    setDownloadSecurityHeaders(res);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", String(size));
    res.setHeader("X-Checksum-SHA256", sha256(buffer));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(filename)}"`
    );

    return res.send(buffer);
  } catch (err) {
    console.error("[uploadController.baixarModeloBanner] erro", err);
    next(err);
  }
};

// ───────────────────────── POST (admin) ─────────────────────────
// POST /api/admin/modelos/banner  (admin, multipart: file)
//  - campo aceito: "file" (multer single)
//  - body.nome (opcional) define o nome-base
//  - valida .ppt/.pptx + mimetype
//  - upsert em tipo='banner'
exports.subirModeloBanner = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const f = req.file;
    if (!f) {
      const e = new Error("Arquivo é obrigatório (campo 'file').");
      e.status = 400;
      throw e;
    }

    // Limite defensivo (igual ao front): 50MB
    const MAX_BYTES = 50 * 1024 * 1024;
    if (!Buffer.isBuffer(f.buffer) || f.buffer.length === 0) {
      const e = new Error("Arquivo vazio ou inválido.");
      e.status = 400;
      throw e;
    }
    if (f.size > MAX_BYTES) {
      const e = new Error("Arquivo excede 50MB.");
      e.status = 413;
      throw e;
    }

    const isPptByName = (f.originalname || "").toLowerCase().match(/\.(pptx?|ppt)$/);
    const isPptByMime = (f.mimetype || "").includes("presentation");
    if (!isPptByName && !isPptByMime) {
      const e = new Error("Formato inválido: envie um .pptx/.ppt.");
      e.status = 400;
      throw e;
    }

    const nomeBase = String(req.body?.nome || "Modelo de banner").replace(/\.(pptx?|PPTX?)$/, "");
    const nomeFinal = `${nomeBase}.pptx`;
    const mime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    const size = f.size;
    const checksum = sha256(f.buffer);

    // Upsert por tipo (único)
    const sql = `
      INSERT INTO trabalhos_modelos (tipo, nome, mime, tamanho, arquivo, atualizado_por, atualizado_em)
      VALUES ('banner', $1, $2, $3, $4, $5, NOW())
      ON CONFLICT (tipo)
      DO UPDATE SET
        nome = EXCLUDED.nome,
        mime = EXCLUDED.mime,
        tamanho = EXCLUDED.tamanho,
        arquivo = EXCLUDED.arquivo,
        atualizado_por = EXCLUDED.atualizado_por,
        atualizado_em = NOW()
    `;
    const params = [nomeBase, mime, size, f.buffer, req.user?.id || null];

    await qNone(DB, sql, params);

    console.log(
      `[UPLOAD:BANNER] nome="${nomeFinal}" | size=${size} | by=${req.user?.cpf || req.user?.email || req.user?.id || "admin"}`
    );

    return res.status(201).json({
      ok: true,
      tipo: "banner",
      nome: nomeFinal,
      tamanho: size,
      checksum_sha256: checksum,
    });
  } catch (err) {
    console.error("[uploadController.subirModeloBanner] erro", err);
    next(err);
  }
};
