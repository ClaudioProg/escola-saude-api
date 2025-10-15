// 📁 src/routes/chamadasModeloRoutes.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mime = require("mime-types");

const injectDb = require("../middlewares/injectDb");
const { authMiddleware } = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const storage = require("../services/storage");
const { MODELOS_CHAMADAS_DIR } = require("../paths");

const router = express.Router();

/* ───────────────── Config upload ───────────────── */
const allowedMimes = new Set([
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (allowedMimes.has(file.mimetype) || ext === ".ppt" || ext === ".pptx") {
      return cb(null, true);
    }
    cb(new Error("Apenas arquivos .ppt ou .pptx"));
  },
});

/* ───────── Helper: DB via req.db ───────── */
async function q(req, text, params) {
  const db = req.db;
  if (!db || typeof db.query !== "function") {
    throw new Error("DB não disponível em req.db");
  }
  return db.query(text, params);
}

/* ───────── Helper: resolve caminho absoluto ───────── */
function resolveAbsPath(storageKey) {
  if (!storageKey) return null;
  const key = String(storageKey).replace(/^\/+/, "");
  return path.isAbsolute(key)
    ? key
    : path.join(MODELOS_CHAMADAS_DIR, key);
}

/* =================================================================== */
/* Público                                                              */
/* =================================================================== */

/** HEAD → apenas indica se o modelo existe no banco/FS */
router.head("/chamadas/:id/modelo-banner", injectDb(), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).end();

  try {
    const { rows } = await q(
      req,
      "SELECT storage_key FROM trabalhos_chamadas_modelos WHERE chamada_id=$1 ORDER BY updated_at DESC LIMIT 1",
      [id]
    );
    if (!rows.length) return res.status(404).end();

    const abs = resolveAbsPath(rows[0].storage_key);
    const exists = abs && fs.existsSync(abs);
    return exists ? res.status(200).end() : res.status(410).end();
  } catch (e) {
    console.error("[HEAD modelo-banner]", e);
    return res.status(500).end();
  }
});

/** GET → stream do arquivo físico (FS/S3) */
router.get("/chamadas/:id/modelo-banner", injectDb(), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0)
    return res.status(400).json({ erro: "ID inválido" });

  try {
    const { rows } = await q(
      req,
      `SELECT nome_arquivo, mime, storage_key, tamanho_bytes, updated_at
         FROM trabalhos_chamadas_modelos
        WHERE chamada_id=$1
        ORDER BY updated_at DESC LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ erro: "Modelo não encontrado" });

    const m = rows[0];
    const absPath = resolveAbsPath(m.storage_key);

    if (!absPath || !fs.existsSync(absPath)) {
      console.error("[modelo-banner] arquivo ausente:", { absPath, storage_key: m.storage_key });
      return res.status(410).json({ erro: "Arquivo do modelo não está disponível" });
    }

    // If-Modified-Since → 304
    const ifMod = req.headers["if-modified-since"];
    if (ifMod) {
      const mod = new Date(ifMod);
      const last = m.updated_at ? new Date(m.updated_at) : null;
      if (last && !isNaN(mod) && last <= last) {
        return res.status(304).end();
      }
    }

    const mimeType =
      m.mime || mime.lookup(m.nome_arquivo) || "application/octet-stream";
    const stat = fs.statSync(absPath);

    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(m.nome_arquivo)}`
    );
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Last-Modified", stat.mtime.toUTCString());
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Disposition, Content-Length, Last-Modified"
    );
    res.setHeader("Cache-Control", "public, max-age=3600");

    const stream = fs.createReadStream(absPath);
    stream.on("error", (e) => {
      console.error("[modelo-banner stream error]", {
        code: e.code,
        message: e.message,
        stack: e.stack,
        absPath,
      });
      if (!res.headersSent)
        res.status(500).json({ erro: "Falha ao transmitir o arquivo" });
    });
    stream.pipe(res);
  } catch (e) {
    console.error("[GET modelo-banner catch]", {
      code: e.code,
      message: e.message,
      stack: e.stack,
    });
    return res.status(500).json({ erro: "Erro interno ao servir o modelo" });
  }
});

/* =================================================================== */
/* Admin: upload                                                        */
/* =================================================================== */
router.post(
  "/chamadas/:id/modelo-banner",
  injectDb(),
  authMiddleware,
  authorizeRoles("administrador"),
  upload.single("file"),
  async (req, res) => {
    const chamadaId = Number(req.params.id);
    if (!Number.isFinite(chamadaId) || chamadaId <= 0)
      return res.status(400).json({ erro: "ID inválido" });

    const f = req.file;
    if (!f) return res.status(400).json({ erro: "Arquivo ausente" });
    if (!allowedMimes.has(f.mimetype))
      return res.status(400).json({ erro: "Apenas arquivos .ppt ou .pptx" });

    try {
      const { storageKey, sha256 } = await storage.saveChamadaModelo(chamadaId, f);

      const { rows } = await q(
        req,
        `
        INSERT INTO trabalhos_chamadas_modelos
          (chamada_id, nome_arquivo, mime, storage_key, tamanho_bytes, hash_sha256, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6, now())
        ON CONFLICT (chamada_id) DO UPDATE
        SET nome_arquivo   = EXCLUDED.nome_arquivo,
            mime           = EXCLUDED.mime,
            storage_key    = EXCLUDED.storage_key,
            tamanho_bytes  = EXCLUDED.tamanho_bytes,
            hash_sha256    = EXCLUDED.hash_sha256,
            updated_at     = now()
        RETURNING id, chamada_id, nome_arquivo, mime, storage_key, tamanho_bytes, hash_sha256, updated_at
      `,
        [chamadaId, f.originalname, f.mimetype, storageKey, f.size ?? null, sha256 ?? null]
      );

      return res.json(rows[0]);
    } catch (e) {
      console.error("[POST modelo-banner]", e);
      return res.status(500).json({ erro: "Falha ao salvar o arquivo do modelo" });
    }
  }
);

/* =================================================================== */
/* Admin: leitura/meta (compat com painel admin)                       */
/* =================================================================== */
router.get(
  "/admin/chamadas/:id/modelo-banner",
  injectDb(),
  authMiddleware,
  authorizeRoles("administrador"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      return res.status(400).json({ erro: "ID inválido" });

    try {
      const { rows } = await q(
        req,
        `SELECT chamada_id, nome_arquivo, mime, tamanho_bytes, updated_at
           FROM trabalhos_chamadas_modelos
          WHERE chamada_id = $1
          ORDER BY updated_at DESC
          LIMIT 1`,
        [id]
      );

      if (!rows.length)
        return res.status(404).json({ erro: "Modelo não encontrado" });

      return res.json(rows[0]);
    } catch (e) {
      console.error("[GET admin/modelo-banner]", e);
      return res.status(500).json({ erro: "Falha ao obter meta do modelo" });
    }
  }
);

module.exports = router;
