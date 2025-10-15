// 📁 server/routes/chamadasModelo.routes.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const { authMiddleware } = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const storage = require("../services/storage");

const router = express.Router();

/* Multer em memória + validação */
const allowedMimes = new Set([
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (allowedMimes.has(file.mimetype) || ext === ".ppt" || ext === ".pptx") {
      return cb(null, true);
    }
    cb(new Error("Apenas arquivos .ppt ou .pptx"));
  },
});

/* Helper seguro do DB via req.db */
async function q(req, text, params) {
  const db = req.db;
  if (!db || typeof db.query !== "function") {
    throw new Error("DB não disponível em req.db");
  }
  return db.query(text, params);
}

/* ───────── HEAD /api/chamadas/:id/modelo-banner ─────────
   200 se existe | 404 se não existe
*/
router.head("/chamadas/:id/modelo-banner", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).end();

  const { rows } = await q(
    req,
    "SELECT 1 FROM trabalhos_chamadas_modelos WHERE chamada_id = $1 LIMIT 1",
    [id]
  );
  return rows.length ? res.status(200).end() : res.status(404).end();
});

/* ───────── GET /api/chamadas/:id/modelo-banner ─────────
   Download/stream do modelo
*/
router.get("/chamadas/:id/modelo-banner", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ erro: "ID inválido" });
  }

  const { rows } = await q(
    req,
    `SELECT nome_arquivo, mime, storage_key, tamanho_bytes, updated_at
       FROM trabalhos_chamadas_modelos
      WHERE chamada_id = $1`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ erro: "Modelo não encontrado" });

  const m = rows[0];

  // If-Modified-Since → 304
  const ifMod = req.headers["if-modified-since"];
  if (ifMod) {
    const mod = new Date(ifMod);
    const last = m.updated_at ? new Date(m.updated_at) : null;
    if (last && !isNaN(mod) && last <= mod) {
      return res.status(304).end();
    }
  }

  res.setHeader("Content-Type", m.mime || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(m.nome_arquivo)}"`
  );
  if (m.tamanho_bytes) res.setHeader("Content-Length", String(m.tamanho_bytes));
  res.setHeader("Cache-Control", "public, max-age=3600");
  if (m.updated_at) res.setHeader("Last-Modified", new Date(m.updated_at).toUTCString());

  try {
    const stream = await storage.stream(m.storage_key);
    stream.on("error", (e) => {
      console.error("[modelo-banner stream]", e);
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (e) {
    // arquivo foi removido do disco, mas registro existe
    if (e && (e.code === "ENOENT" || e.code === "ENAMETOOLONG")) {
      return res.status(410).json({ erro: "Arquivo do modelo não está disponível" });
    }
    console.error("[modelo-banner stream catch]", e);
    return res.status(500).json({ erro: "Falha ao transmitir o arquivo" });
  }
});

/* ───────── POST /api/chamadas/:id/modelo-banner ─────────
   Upsert do modelo (somente administradores)
   multipart/form-data com campo "file"
*/
router.post(
  "/chamadas/:id/modelo-banner",
  authMiddleware,
  authorizeRoles("administrador"),
  upload.single("file"),
  async (req, res) => {
    const chamadaId = Number(req.params.id);
    if (!Number.isFinite(chamadaId) || chamadaId <= 0) {
      return res.status(400).json({ erro: "ID inválido" });
    }

    const f = req.file; // { originalname, mimetype, size, buffer }
    if (!f) return res.status(400).json({ erro: "Arquivo ausente" });
    if (!allowedMimes.has(f.mimetype)) {
      // passa no fileFilter por extensão, mas aqui reforçamos por MIME
      return res.status(400).json({ erro: "Apenas arquivos .ppt ou .pptx" });
    }

    // 1) salva no storage e obtém a chave (e hash opcional)
    const { storageKey, sha256 } = await storage.saveChamadaModelo(chamadaId, f);

    // 2) UPSERT na tabela
    const qtext = `
      INSERT INTO trabalhos_chamadas_modelos
        (chamada_id, nome_arquivo, mime, storage_key, tamanho_bytes, hash_sha256)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (chamada_id)
      DO UPDATE SET
        nome_arquivo   = EXCLUDED.nome_arquivo,
        mime           = EXCLUDED.mime,
        storage_key    = EXCLUDED.storage_key,
        tamanho_bytes  = EXCLUDED.tamanho_bytes,
        hash_sha256    = EXCLUDED.hash_sha256,
        updated_at     = now()
      RETURNING id, chamada_id, nome_arquivo, mime, storage_key, tamanho_bytes, hash_sha256, updated_at;
    `;
    const params = [
      chamadaId,
      f.originalname,
      f.mimetype,
      storageKey,
      f.size ?? null,
      sha256 ?? null,
    ];
    const { rows } = await q(req, qtext, params);
    return res.json(rows[0]);
  }
);

module.exports = router;
