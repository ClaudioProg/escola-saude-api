// ✅ src/routes/chamadasModeloRoutes.js
/* eslint-disable no-console */
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const mime = require("mime-types");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { param, validationResult } = require("express-validator");

const injectDb = require("../middlewares/injectDb");

// 🔐 auth resiliente (igual padrão premium do projeto)
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware || _auth?.auth;
if (typeof requireAuth !== "function") {
  console.error("[chamadasModeloRoutes] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

const _roles = require("../auth/authorizeRoles");
const authorizeRoles =
  typeof _roles === "function" ? _roles : _roles?.default || _roles?.authorizeRoles;
if (typeof authorizeRoles !== "function") {
  console.error("[chamadasModeloRoutes] authorizeRoles inválido:", _roles);
  throw new Error("authorizeRoles não é função (verifique exports em src/auth/authorizeRoles.js)");
}

const storage = require("../services/storage");
const { MODELOS_CHAMADAS_DIR } = require("../paths");

const router = express.Router();

// ✅ injeta DB uma vez (menos repetição)
router.use(injectDb);

/* ========================= Helpers ========================= */

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({
    erro: "Parâmetros inválidos.",
    detalhes: errors.array().map((e) => ({ campo: e.path, msg: e.msg })),
  });
}

async function q(req, text, params) {
  const db = req.db;
  if (!db || typeof db.query !== "function") throw new Error("DB não disponível em req.db");
  return db.query(text, params);
}

function resolveAbsPath(storageKey) {
  if (!storageKey) return null;
  const key = String(storageKey).replace(/^\/+/, "");
  return path.isAbsolute(key) ? key : path.join(MODELOS_CHAMADAS_DIR, key);
}

async function getLatestModeloRow(req, chamadaId, tipo) {
  const { rows } = await q(
    req,
    `SELECT chamada_id, nome_arquivo, mime, storage_key, tamanho_bytes, updated_at, hash_sha256, tipo
       FROM trabalhos_chamadas_modelos
      WHERE chamada_id = $1 AND tipo = $2
      ORDER BY updated_at DESC
      LIMIT 1`,
    [chamadaId, tipo]
  );
  return rows[0] || null;
}

function setNoStore(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

function setPublicCache(res, stat) {
  // ETag forte baseado em size+mtime (bom o suficiente aqui)
  const etag = `"${crypto
    .createHash("sha1")
    .update(`${stat.size}:${stat.mtimeMs}`)
    .digest("hex")}"`;

  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("ETag", etag);
  res.setHeader("Last-Modified", stat.mtime.toUTCString());
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, Content-Length, Last-Modified, ETag");
}

function checkConditionalHeaders(req, res, stat) {
  const inm = req.headers["if-none-match"];
  if (inm) {
    const etagNow = res.getHeader("ETag");
    if (etagNow && String(inm).trim() === String(etagNow)) {
      res.status(304).end();
      return true;
    }
  }

  const ifMod = req.headers["if-modified-since"];
  if (ifMod) {
    const mod = new Date(ifMod);
    if (!Number.isNaN(mod.getTime()) && stat.mtime <= mod) {
      res.status(304).end();
      return true;
    }
  }

  return false;
}

/* ========================= Limiter (upload) ========================= */

const uploadModeloLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitos envios em pouco tempo. Aguarde alguns minutos." },
});

/* ========================= Upload config ========================= */

const allowedMimes = new Set([
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

// (best-effort) valida assinatura do arquivo: pptx é ZIP (PK), ppt é OLE (D0 CF 11 E0)
function looksLikePpt(buffer, ext) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) return true; // não trava
  const sig4 = buffer.subarray(0, 4).toString("hex");
  const sig8 = buffer.subarray(0, 8).toString("hex");

  if (ext === ".pptx") return sig4 === "504b0304" || sig4 === "504b0506" || sig4 === "504b0708"; // PK..
  if (ext === ".ppt") return sig8 === "d0cf11e0a1b11ae1"; // OLE
  return true;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = (path.extname(file.originalname || "").toLowerCase()) || "";
    if (allowedMimes.has(file.mimetype) || ext === ".ppt" || ext === ".pptx") return cb(null, true);
    return cb(new Error("Apenas arquivos .ppt ou .pptx"));
  },
});

/* ========================= Factories (reuso) ========================= */

function modeloTipoCfg(alias) {
  if (alias === "banner") return { tipo: "template_banner", defaultName: "modelo-banner.pptx" };
  if (alias === "oral") return { tipo: "template_slide_oral", defaultName: "modelo-oral.pptx" };
  throw new Error("tipo de modelo inválido");
}

function adminMetaRoute(alias) {
  const cfg = modeloTipoCfg(alias);

  return [
    "/admin/chamadas/:id/" + (alias === "banner" ? "modelo-banner" : "modelo-oral"),
    requireAuth,
    authorizeRoles("administrador"),
    [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
    validate,
    asyncHandler(async (req, res) => {
      setNoStore(res);

      const id = req.params.id;
      const row = await getLatestModeloRow(req, id, cfg.tipo);
      if (!row) return res.status(404).json({ erro: "Modelo não encontrado" });

      const absPath = resolveAbsPath(row.storage_key);
      const exists = absPath ? fs.existsSync(absPath) : false;

      return res.json({
        chamada_id: row.chamada_id,
        filename: row.nome_arquivo,
        mime: row.mime,
        size: row.tamanho_bytes,
        updated_at: row.updated_at,
        exists,
      });
    }),
  ];
}

function adminDownloadRoute(alias) {
  const cfg = modeloTipoCfg(alias);

  return [
    "/admin/chamadas/:id/" + (alias === "banner" ? "modelo-banner/download" : "modelo-oral/download"),
    requireAuth,
    authorizeRoles("administrador"),
    [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
    validate,
    asyncHandler(async (req, res) => {
      setNoStore(res);

      const id = req.params.id;
      const row = await getLatestModeloRow(req, id, cfg.tipo);
      if (!row) return res.status(404).json({ erro: "Modelo não encontrado" });

      const absPath = resolveAbsPath(row.storage_key);
      if (!absPath || !fs.existsSync(absPath)) return res.status(410).json({ erro: "Arquivo não está disponível" });

      return res.download(absPath, row.nome_arquivo || cfg.defaultName);
    }),
  ];
}

function adminUploadRoute(alias) {
  const cfg = modeloTipoCfg(alias);

  return [
    "/chamadas/:id/" + (alias === "banner" ? "modelo-banner" : "modelo-oral"),
    requireAuth,
    authorizeRoles("administrador"),
    uploadModeloLimiter,
    upload.single("file"),
    [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
    validate,
    asyncHandler(async (req, res) => {
      setNoStore(res);

      const chamadaId = req.params.id;
      const f = req.file;

      if (!f) return res.status(400).json({ erro: "Arquivo ausente" });

      const ext = path.extname(f.originalname || "").toLowerCase();
      if (!allowedMimes.has(f.mimetype) && ext !== ".ppt" && ext !== ".pptx") {
        return res.status(400).json({ erro: "Apenas arquivos .ppt ou .pptx" });
      }
      if (!looksLikePpt(f.buffer, ext)) {
        return res.status(400).json({ erro: "Arquivo inválido (assinatura não compatível com PPT/PPTX)." });
      }

      const { storageKey, sha256 } = await storage.saveChamadaModelo(chamadaId, f, cfg.tipo);

      const { rows } = await q(
        req,
        `
        INSERT INTO trabalhos_chamadas_modelos
          (chamada_id, nome_arquivo, mime, storage_key, tamanho_bytes, hash_sha256, tipo, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7, now())
        ON CONFLICT (chamada_id, tipo) DO UPDATE
        SET nome_arquivo   = EXCLUDED.nome_arquivo,
            mime           = EXCLUDED.mime,
            storage_key    = EXCLUDED.storage_key,
            tamanho_bytes  = EXCLUDED.tamanho_bytes,
            hash_sha256    = EXCLUDED.hash_sha256,
            updated_at     = now()
        RETURNING chamada_id, nome_arquivo, mime, storage_key, tamanho_bytes, hash_sha256, updated_at, tipo
        `,
        [chamadaId, f.originalname, f.mimetype, storageKey, f.size ?? null, sha256 ?? null, cfg.tipo]
      );

      return res.json(rows[0]);
    }),
  ];
}

function publicHeadRoute(alias) {
  const cfg = modeloTipoCfg(alias);

  return [
    "/chamadas/:id/" + (alias === "banner" ? "modelo-banner" : "modelo-oral"),
    [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
    validate,
    asyncHandler(async (req, res) => {
      const id = req.params.id;

      const row = await getLatestModeloRow(req, id, cfg.tipo);
      if (!row) return res.status(404).end();

      const abs = resolveAbsPath(row.storage_key);
      const exists = abs && fs.existsSync(abs);

      // HEAD “limpo”
      if (exists) {
        res.setHeader("Cache-Control", "public, max-age=3600");
        return res.status(200).end();
      }
      return res.status(410).end();
    }),
  ];
}

function publicGetRoute(alias) {
  const cfg = modeloTipoCfg(alias);

  return [
    "/chamadas/:id/" + (alias === "banner" ? "modelo-banner" : "modelo-oral"),
    [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
    validate,
    asyncHandler(async (req, res) => {
      const id = req.params.id;

      const m = await getLatestModeloRow(req, id, cfg.tipo);
      if (!m) return res.status(404).json({ erro: "Modelo não encontrado" });

      const absPath = resolveAbsPath(m.storage_key);
      if (!absPath || !fs.existsSync(absPath)) {
        console.error(`[modelo-${alias}] arquivo ausente:`, { absPath, storage_key: m.storage_key });
        return res.status(410).json({ erro: "Arquivo do modelo não está disponível" });
      }

      const stat = await fsp.stat(absPath);
      const mimeType =
        m.mime ||
        mime.lookup(m.nome_arquivo) ||
        "application/vnd.openxmlformats-officedocument.presentationml.presentation";

      res.setHeader("Content-Type", mimeType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(m.nome_arquivo || cfg.defaultName)}`
      );
      res.setHeader("Content-Length", String(stat.size));

      setPublicCache(res, stat);

      // 304?
      if (checkConditionalHeaders(req, res, stat)) return;

      const stream = fs.createReadStream(absPath);
      stream.on("error", (e) => {
        console.error(`[modelo-${alias} stream error]`, {
          code: e.code,
          message: e.message,
          stack: e.stack,
          absPath,
        });
        if (!res.headersSent) res.status(500).json({ erro: "Falha ao transmitir o arquivo" });
      });

      return stream.pipe(res);
    }),
  ];
}

/* =================================================================== */
/* 🔒 ADMIN — colocar antes das rotas públicas                          */
/* =================================================================== */

// Meta
router.get(...adminMetaRoute("banner"));
router.get(...adminMetaRoute("oral"));

// Download
router.get(...adminDownloadRoute("banner"));
router.get(...adminDownloadRoute("oral"));

// Upload
router.post(...adminUploadRoute("banner"));
router.post(...adminUploadRoute("oral"));

/* =================================================================== */
/* 🌐 Público — apenas HEAD/GET                                         */
/* =================================================================== */

router.head(...publicHeadRoute("banner"));
router.get(...publicGetRoute("banner"));

router.head(...publicHeadRoute("oral"));
router.get(...publicGetRoute("oral"));

module.exports = router;
