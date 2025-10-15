// 📁 src/routes/chamadasModeloRoutes.js
const express = require("express");
const multer = require("multer");
const path = require("path");

// Middlewares / serviços do projeto
const injectDb = require("../middlewares/injectDb");
const { authMiddleware } = require("../auth/authMiddleware"); // se quiser exigir auth no POST
const authorizeRoles = require("../auth/authorizeRoles");
const storage = require("../services/storage"); // deve expor .stream(key) e .saveChamadaModelo(id, file)

const router = express.Router();

/* ───────────────── Config upload ───────────────── */
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

/* ───────── Helper: DB via req.db ───────── */
async function q(req, text, params) {
  const db = req.db;
  if (!db || typeof db.query !== "function") {
    throw new Error("DB não disponível em req.db");
  }
  return db.query(text, params);
}

/* =================================================================== */
/* Público                                                              */
/* =================================================================== */

/**
 * HEAD /api/chamadas/:id/modelo-banner
 * 200 se existe um registro na tabela | 404 se não
 *
 * Obs.: Slim/rápido, não toca no FS/S3 — serve só para o front decidir
 * se mostra o botão (é exatamente o seu caso).
 */
router.head(
  "/chamadas/:id/modelo-banner",
  injectDb(),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).end();

    try {
      const { rows } = await q(
        req,
        "SELECT 1 FROM trabalhos_chamadas_modelos WHERE chamada_id = $1 LIMIT 1",
        [id]
      );
      return rows.length ? res.status(200).end() : res.status(404).end();
    } catch (e) {
      console.error("[HEAD modelo-banner]", e);
      return res.status(500).end();
    }
  }
);

/**
 * GET /api/chamadas/:id/modelo-banner
 * Stream do arquivo real (FS/S3) + headers de cache.
 */
router.get(
  "/chamadas/:id/modelo-banner",
  injectDb(),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ erro: "ID inválido" });
    }

    try {
      const { rows } = await q(
        req,
        `SELECT nome_arquivo, mime, storage_key, tamanho_bytes, updated_at
           FROM trabalhos_chamadas_modelos
          WHERE chamada_id = $1
          ORDER BY updated_at DESC
          LIMIT 1`,
        [id]
      );
      if (!rows.length) return res.status(404).json({ erro: "Modelo não encontrado" });

      const m = rows[0];

      // If-Modified-Since → 304
      const ifMod = req.headers["if-modified-since"];
      if (ifMod) {
        const mod = new Date(ifMod);
        const last = m.updated_at ? new Date(m.updated_at) : null;
        if (last && !isNaN(mod) && last <= last) {
          return res.status(304).end();
        }
      }

      // Headers
      res.setHeader("Content-Type", m.mime || "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(m.nome_arquivo)}`
      );
      if (m.tamanho_bytes) {
        res.setHeader("Content-Length", String(m.tamanho_bytes));
      }
      if (m.updated_at) {
        res.setHeader("Last-Modified", new Date(m.updated_at).toUTCString());
      }
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, Content-Length, Last-Modified");

      // Stream
      const stream = await storage.stream(m.storage_key);
      stream.on("error", (e) => {
        console.error("[GET modelo-banner stream error]", e);
        if (!res.headersSent) res.status(500).end();
      });
      stream.pipe(res);
    } catch (e) {
      // Se o registro existe mas o arquivo sumiu do storage
      if (e && (e.code === "ENOENT" || e.code === "ENAMETOOLONG")) {
        return res.status(410).json({ erro: "Arquivo do modelo não está disponível" });
      }
      console.error("[GET modelo-banner]", e);
      return res.status(500).json({ erro: "Falha ao transmitir o arquivo" });
    }
  }
);

/* =================================================================== */
/* Admin (upload)                                                       */
/* =================================================================== */

router.post(
  "/chamadas/:id/modelo-banner",
  injectDb(),
  authMiddleware,
  authorizeRoles("administrador"),
  upload.single("file"),
  async (req, res) => {
    const chamadaId = Number(req.params.id);
    if (!Number.isFinite(chamadaId) || chamadaId <= 0) {
      return res.status(400).json({ erro: "ID inválido" });
    }

    const f = req.file;
    if (!f) return res.status(400).json({ erro: "Arquivo ausente" });
    if (!allowedMimes.has(f.mimetype)) {
      return res.status(400).json({ erro: "Apenas arquivos .ppt ou .pptx" });
    }

    try {
      // salva no storage e retorna storageKey + hash
      const { storageKey, sha256 } = await storage.saveChamadaModelo(chamadaId, f);

      // UPSERT no banco
      const { rows } = await q(
        req,
        `
          INSERT INTO trabalhos_chamadas_modelos
            (chamada_id, nome_arquivo, mime, storage_key, tamanho_bytes, hash_sha256, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6, now())
          ON CONFLICT (chamada_id)
          DO UPDATE SET
            nome_arquivo   = EXCLUDED.nome_arquivo,
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

module.exports = router;
