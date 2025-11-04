// 📁 src/routes/chamadasModeloRoutes.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mime = require("mime-types");
const rateLimit = require("express-rate-limit");

const injectDb = require("../middlewares/injectDb");
const { authMiddleware } = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const storage = require("../services/storage");
const { MODELOS_CHAMADAS_DIR } = require("../paths");

const router = express.Router();

/* ───────────────── Limiter específico (upload de .ppt/.pptx) ───────────────── */
const uploadModeloLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ───────────────── Config upload ───────────────── */
const allowedMimes = new Set([
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const ext = (path.extname(file.originalname || "").toLowerCase()) || "";
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
  return path.isAbsolute(key) ? key : path.join(MODELOS_CHAMADAS_DIR, key);
}

/* ───────── Helper: buscar último registro do modelo por tipo ───────── */
async function getLatestModeloRow(req, chamadaId, tipo) {
  const { rows } = await q(
    req,
    `SELECT chamada_id, nome_arquivo, mime, storage_key, tamanho_bytes, updated_at
       FROM trabalhos_chamadas_modelos
      WHERE chamada_id = $1 AND tipo = $2
      ORDER BY updated_at DESC
      LIMIT 1`,
    [chamadaId, tipo]
  );
  return rows[0] || null;
}

/* =================================================================== */
/* 🔒 ADMIN — colocar antes das rotas públicas                          */
/* =================================================================== */

/* Admin: meta — modelo banner */
router.get(
  "/admin/chamadas/:id/modelo-banner",
  injectDb,
  authMiddleware,
  authorizeRoles("administrador"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      return res.status(400).json({ erro: "ID inválido" });

    try {
      const row = await getLatestModeloRow(req, id, "template_banner");
      if (!row) return res.status(404).json({ erro: "Modelo não encontrado" });

      const absPath = resolveAbsPath(row.storage_key);
      const exists = absPath && fs.existsSync(absPath);

      return res.json({
        chamada_id: row.chamada_id,
        filename: row.nome_arquivo,
        mime: row.mime,
        size: row.tamanho_bytes,
        updated_at: row.updated_at,
        exists,
      });
    } catch (e) {
      console.error("[GET admin/modelo-banner]", e);
      return res.status(500).json({ erro: "Falha ao obter meta do modelo (banner)" });
    }
  }
);

/* Admin: download — modelo banner */
router.get(
  "/admin/chamadas/:id/modelo-banner/download",
  injectDb,
  authMiddleware,
  authorizeRoles("administrador"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      return res.status(400).json({ erro: "ID inválido" });

    try {
      const row = await getLatestModeloRow(req, id, "template_banner");
      if (!row) return res.status(404).json({ erro: "Modelo não encontrado" });

      const absPath = resolveAbsPath(row.storage_key);
      if (!absPath || !fs.existsSync(absPath))
        return res.status(410).json({ erro: "Arquivo não está disponível" });

      res.download(absPath, row.nome_arquivo || "modelo-banner.pptx");
    } catch (e) {
      console.error("[DOWNLOAD admin modelo-banner]", e);
      return res.status(500).json({ erro: "Falha ao baixar modelo (banner)" });
    }
  }
);

/* Admin: meta — modelo oral */
router.get(
  "/admin/chamadas/:id/modelo-oral",
  injectDb,
  authMiddleware,
  authorizeRoles("administrador"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      return res.status(400).json({ erro: "ID inválido" });

    try {
      const row = await getLatestModeloRow(req, id, "template_slide_oral");
      if (!row) return res.status(404).json({ erro: "Modelo não encontrado" });

      const absPath = resolveAbsPath(row.storage_key);
      const exists = absPath && fs.existsSync(absPath);

      return res.json({
        chamada_id: row.chamada_id,
        filename: row.nome_arquivo,
        mime: row.mime,
        size: row.tamanho_bytes,
        updated_at: row.updated_at,
        exists,
      });
    } catch (e) {
      console.error("[GET admin/modelo-oral]", e);
      return res.status(500).json({ erro: "Falha ao obter meta do modelo de slides (oral)" });
    }
  }
);

/* Admin: download — modelo oral */
router.get(
  "/admin/chamadas/:id/modelo-oral/download",
  injectDb,
  authMiddleware,
  authorizeRoles("administrador"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      return res.status(400).json({ erro: "ID inválido" });

    try {
      const row = await getLatestModeloRow(req, id, "template_slide_oral");
      if (!row) return res.status(404).json({ erro: "Modelo não encontrado" });

      const absPath = resolveAbsPath(row.storage_key);
      if (!absPath || !fs.existsSync(absPath))
        return res.status(410).json({ erro: "Arquivo não está disponível" });

      res.download(absPath, row.nome_arquivo || "modelo-oral.pptx");
    } catch (e) {
      console.error("[DOWNLOAD admin modelo-oral]", e);
      return res.status(500).json({ erro: "Falha ao baixar modelo (oral)" });
    }
  }
);

/* Admin: upload — modelo do banner/poster */
router.post(
  "/chamadas/:id/modelo-banner",
  injectDb,
  authMiddleware,
  authorizeRoles("administrador"),
  uploadModeloLimiter,
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
      const { storageKey, sha256 } = await storage.saveChamadaModelo(
        chamadaId,
        f,
        "template_banner"
      );

      const { rows } = await q(
        req,
        `
        INSERT INTO trabalhos_chamadas_modelos
          (chamada_id, nome_arquivo, mime, storage_key, tamanho_bytes, hash_sha256, tipo, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,'template_banner', now())
        ON CONFLICT (chamada_id, tipo) DO UPDATE
        SET nome_arquivo   = EXCLUDED.nome_arquivo,
            mime           = EXCLUDED.mime,
            storage_key    = EXCLUDED.storage_key,
            tamanho_bytes  = EXCLUDED.tamanho_bytes,
            hash_sha256    = EXCLUDED.hash_sha256,
            updated_at     = now()
        RETURNING chamada_id, nome_arquivo, mime, storage_key, tamanho_bytes, hash_sha256, updated_at, tipo
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

/* Admin: upload — modelo oral */
router.post(
  "/chamadas/:id/modelo-oral",
  injectDb,
  authMiddleware,
  authorizeRoles("administrador"),
  uploadModeloLimiter,
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
      const { storageKey, sha256 } = await storage.saveChamadaModelo(
        chamadaId,
        f,
        "template_slide_oral"
      );

      const { rows } = await q(
        req,
        `
        INSERT INTO trabalhos_chamadas_modelos
          (chamada_id, nome_arquivo, mime, storage_key, tamanho_bytes, hash_sha256, tipo, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,'template_slide_oral', now())
        ON CONFLICT (chamada_id, tipo) DO UPDATE
        SET nome_arquivo   = EXCLUDED.nome_arquivo,
            mime           = EXCLUDED.mime,
            storage_key    = EXCLUDED.storage_key,
            tamanho_bytes  = EXCLUDED.tamanho_bytes,
            hash_sha256    = EXCLUDED.hash_sha256,
            updated_at     = now()
        RETURNING chamada_id, nome_arquivo, mime, storage_key, tamanho_bytes, hash_sha256, updated_at, tipo
      `,
        [chamadaId, f.originalname, f.mimetype, storageKey, f.size ?? null, sha256 ?? null]
      );

      return res.json(rows[0]);
    } catch (e) {
      console.error("[POST modelo-oral]", e);
      return res.status(500).json({ erro: "Falha ao salvar o modelo de slides (oral)" });
    }
  }
);

/* =================================================================== */
/* 🌐 Público — apenas HEAD/GET                                         */
/* =================================================================== */

/* Público — HEAD banner */
router.head("/chamadas/:id/modelo-banner", injectDb, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).end();

  try {
    const row = await getLatestModeloRow(req, id, "template_banner");
    if (!row) return res.status(404).end();

    const abs = resolveAbsPath(row.storage_key);
    const exists = abs && fs.existsSync(abs);
    return exists ? res.status(200).end() : res.status(410).end();
  } catch (e) {
    console.error("[HEAD modelo-banner]", e);
    return res.status(500).end();
  }
});

/* Público — GET banner */
router.get("/chamadas/:id/modelo-banner", injectDb, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0)
    return res.status(400).json({ erro: "ID inválido" });

  try {
    const m = await getLatestModeloRow(req, id, "template_banner");
    if (!m) return res.status(404).json({ erro: "Modelo não encontrado" });

    const absPath = resolveAbsPath(m.storage_key);
    if (!absPath || !fs.existsSync(absPath)) {
      console.error("[modelo-banner] arquivo ausente:", { absPath, storage_key: m.storage_key });
      return res.status(410).json({ erro: "Arquivo do modelo não está disponível" });
    }

    const ifMod = req.headers["if-modified-since"];
    if (ifMod) {
      const mod = new Date(ifMod);
      const stat = fs.statSync(absPath);
      const last = stat.mtime;
      if (!Number.isNaN(mod.getTime()) && last <= mod) {
        return res.status(304).end();
      }
    }

    const mimeType = m.mime || mime.lookup(m.nome_arquivo) || "application/octet-stream";
    const stat = fs.statSync(absPath);

    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(m.nome_arquivo || "modelo-banner.pptx")}`
    );
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Last-Modified", stat.mtime.toUTCString());
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, Content-Length, Last-Modified");
    res.setHeader("Cache-Control", "public, max-age=3600");

    const stream = fs.createReadStream(absPath);
    stream.on("error", (e) => {
      console.error("[modelo-banner stream error]", { code: e.code, message: e.message, stack: e.stack, absPath });
      if (!res.headersSent) res.status(500).json({ erro: "Falha ao transmitir o arquivo" });
    });
    stream.pipe(res);
  } catch (e) {
    console.error("[GET modelo-banner catch]", { code: e.code, message: e.message, stack: e.stack });
    return res.status(500).json({ erro: "Erro interno ao servir o modelo" });
  }
});

/* Público — HEAD oral */
router.head("/chamadas/:id/modelo-oral", injectDb, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).end();

  try {
    const row = await getLatestModeloRow(req, id, "template_slide_oral");
    if (!row) return res.status(404).end();

    const abs = resolveAbsPath(row.storage_key);
    const exists = abs && fs.existsSync(abs);
    return exists ? res.status(200).end() : res.status(410).end();
  } catch (e) {
    console.error("[HEAD modelo-oral]", e);
    return res.status(500).end();
  }
});

/* Público — GET oral */
router.get("/chamadas/:id/modelo-oral", injectDb, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0)
    return res.status(400).json({ erro: "ID inválido" });

  try {
    const m = await getLatestModeloRow(req, id, "template_slide_oral");
    if (!m) return res.status(404).json({ erro: "Modelo não encontrado" });

    const absPath = resolveAbsPath(m.storage_key);
    if (!absPath || !fs.existsSync(absPath)) {
      console.error("[modelo-oral] arquivo ausente:", absPath);
      return res.status(410).json({ erro: "Arquivo do modelo não está disponível" });
    }

    const mimeType =
      m.mime ||
      mime.lookup(m.nome_arquivo) ||
      "application/vnd.openxmlformats-officedocument.presentationml.presentation";

    const stat = fs.statSync(absPath);
    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(m.nome_arquivo || "modelo-oral.pptx")}`
    );
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Last-Modified", stat.mtime.toUTCString());
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, Content-Length, Last-Modified");
    res.setHeader("Cache-Control", "public, max-age=3600");

    fs.createReadStream(absPath).pipe(res);
  } catch (e) {
    console.error("[GET modelo-oral catch]", e);
    return res.status(500).json({ erro: "Erro ao servir modelo de slides" });
  }
});

module.exports = router;
