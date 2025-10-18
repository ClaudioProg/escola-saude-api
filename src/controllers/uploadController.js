/* eslint-disable no-console */
const { db } = require("../db");

const getDB = (req) => (req && req.db) ? req.db : db;

// GET /api/modelos/banner.pptx  (público)
exports.baixarModeloBanner = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const row = await (typeof DB.oneOrNone === "function"
      ? DB.oneOrNone(
          `SELECT nome, mime, tamanho, arquivo
             FROM trabalhos_modelos
            WHERE tipo='banner'`
        )
      : (async () => {
          const r = await DB.query(
            `SELECT nome, mime, tamanho, arquivo
               FROM trabalhos_modelos
              WHERE tipo='banner'`
          );
          return r?.rows?.[0] || null;
        })()
    );

    if (!row) {
      const e = new Error("Modelo de banner não encontrado.");
      e.status = 404;
      throw e;
    }

    res.setHeader(
      "Content-Type",
      row.mime ||
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    res.setHeader("Content-Length", row.tamanho);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(
        row.nome || "modelo-banner"
      )}.pptx"`
    );
    return res.send(row.arquivo); // Buffer vindo do BYTEA
  } catch (err) {
    console.error("[uploadController.baixarModeloBanner] erro", err);
    next(err);
  }
};

// POST /api/admin/modelos/banner  (admin, multipart: file)
exports.subirModeloBanner = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const f = req.file;
    if (!f) {
      const e = new Error("Arquivo é obrigatório (campo 'file').");
      e.status = 400;
      throw e;
    }

    const okMime =
      f.mimetype?.includes("presentation") ||
      f.originalname?.toLowerCase().endsWith(".pptx") ||
      f.originalname?.toLowerCase().endsWith(".ppt");
    if (!okMime) {
      const e = new Error("Formato inválido: envie um .pptx/.ppt.");
      e.status = 400;
      throw e;
    }

    const nomeBase = (req.body?.nome || "Modelo de banner").replace(
      /\.(pptx?|PPTX?)$/,
      ""
    );
    const mime =
      "application/vnd.openxmlformats-officedocument.presentationml.presentation";

    const sql = `
      INSERT INTO trabalhos_modelos (tipo, nome, mime, tamanho, arquivo, atualizado_por)
      VALUES ('banner', $1, $2, $3, $4, $5)
      ON CONFLICT (tipo)
      DO UPDATE SET
        nome=EXCLUDED.nome,
        mime=EXCLUDED.mime,
        tamanho=EXCLUDED.tamanho,
        arquivo=EXCLUDED.arquivo,
        atualizado_por=EXCLUDED.atualizado_por,
        atualizado_em=NOW()
    `;
    const params = [nomeBase, mime, f.size, f.buffer, req.user?.id || null];

    if (typeof DB.none === "function") await DB.none(sql, params);
    else if (typeof DB.query === "function") await DB.query(sql, params);
    else {
      const e = new Error("DB não expõe métodos de escrita.");
      e.status = 500;
      throw e;
    }

    res
      .status(201)
      .json({ ok: true, tipo: "banner", nome: `${nomeBase}.pptx`, tamanho: f.size });
  } catch (err) {
    console.error("[uploadController.subirModeloBanner] erro", err);
    next(err);
  }
};
