/* eslint-disable no-console */
/**
 * ✅ src/routes/chamadaRoute.js — PREMIUM/UNIFICADO (singular + compat)
 *
 * ⚠️ IMPORTANTE:
 * Este router foi pensado para ser montado em:
 *   - /api/chamada
 *   - /api/chamadas
 *
 * Se você precisar manter LEGADO do tipo:
 *   - /api/admin/chamada ...
 * então faça no index um forward/bridge específico.
 *
 * Aqui dentro: NUNCA prefixar as rotas com "/chamada/..." porque o mount já faz isso.
 */

"use strict";

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const mime = require("mime-types");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { param, validationResult } = require("express-validator");

const router = express.Router();

/* ───────────────── Controllers ───────────────── */
const ctrl = require("../controllers/chamadaController");
const trabCtrl = require("../controllers/trabalhoController");

/* ───────────────── Middlewares do projeto ───────────────── */
const injectDb = require("../middlewares/injectDb");

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default ||
      _auth?.authMiddleware ||
      _auth?.authAny ||
      _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[chamadaRoute] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

/* ───────────────── Authorize resiliente ───────────────── */
const authorizeMod = require("../middlewares/authorize");
const authorizeRoles =
  authorizeMod?.authorizeRoles ||
  authorizeMod?.authorizeRole ||
  authorizeMod?.authorize?.any ||
  authorizeMod?.authorize;

if (typeof authorizeRoles !== "function") {
  console.error("[chamadaRoute] authorizeRoles inválido:", authorizeMod);
  throw new Error("authorizeRoles não exportado corretamente em src/middlewares/authorize.js");
}

/* ───────────────── Serviços / Paths ───────────────── */
const storage = require("../services/storage");
const { MODELOS_CHAMADAS_DIR } = require("../paths");

/* =========================
   Helpers
========================= */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  return res.status(400).json({
    erro: "Parâmetros inválidos.",
    detalhes: errors.array().map((e) => ({ campo: e.path || e.param, msg: e.msg })),
    requestId: res.getHeader?.("X-Request-Id"),
  });
}

function getUserId(req) {
  return (
    req.userId ??
    req.user?.id ??
    req.usuario?.id ??
    req.auth?.userId ??
    null
  );
}

function buildLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) =>
      String(
        getUserId(req) ||
          req.ip ||
          req.headers["x-forwarded-for"] ||
          "anon"
      ),
    message,
  });
}

// Cache curtinho para arquivos públicos
function cachePublicoCurto(_req, res, next) {
  res.setHeader("Cache-Control", "public, max-age=3600, immutable");
  next();
}

// Admin -> no-store
function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
}

async function q(req, text, params) {
  const db = req.db;
  if (!db || typeof db.query !== "function") {
    throw new Error("DB não disponível em req.db");
  }
  return db.query(text, params);
}

/* ✅ injeta DB uma vez */
router.use(injectDb);

/* ===================================================================
   🌐 PÚBLICO / USUÁRIO
=================================================================== */

// ✅ Modelo de banner padrão (legado/global)
router.get("/modelo/banner-padrao.pptx", cachePublicoCurto, asyncHandler(ctrl.exportarModeloBanner));
router.get("/modelos/banner-padrao.pptx", cachePublicoCurto, asyncHandler(ctrl.exportarModeloBanner));
router.get("/banner-padrao.pptx", cachePublicoCurto, asyncHandler(ctrl.exportarModeloBanner));

// ✅ Lista chamadas publicadas (com flag dentro_prazo)
router.get("/ativa", asyncHandler(ctrl.listarAtivas));
router.get("/ativas", asyncHandler(ctrl.listarAtivas));
router.get("/publicadas", asyncHandler(ctrl.listarAtivas));

// ✅ Detalhe de uma chamada
router.get(
  "/:id(\\d+)",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(ctrl.obterChamada)
);

/* ===================================================================
   📦 MODELOS DA CHAMADA (BANNER / ORAL)
=================================================================== */

/* ========================= Limiter (upload) ========================= */
const uploadModeloLimiter = buildLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { erro: "Muitos envios em pouco tempo. Aguarde alguns minutos." },
});

/* ========================= Upload config ========================= */
const allowedMimes = new Set([
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function looksLikePpt(buffer, ext) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) return true;

  const sig4 = buffer.subarray(0, 4).toString("hex");
  const sig8 = buffer.subarray(0, 8).toString("hex");

  if (ext === ".pptx") {
    return sig4 === "504b0304" || sig4 === "504b0506" || sig4 === "504b0708";
  }

  if (ext === ".ppt") {
    return sig8 === "d0cf11e0a1b11ae1";
  }

  return true;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || "";
    if (allowedMimes.has(file.mimetype) || ext === ".ppt" || ext === ".pptx") {
      return cb(null, true);
    }
    return cb(new Error("Apenas arquivos .ppt ou .pptx"));
  },
});

/* ========================= Cache helpers ========================= */
function resolveAbsPath(storageKey) {
  if (!storageKey) return null;
  const key = String(storageKey).replace(/^\/+/, "");
  return path.isAbsolute(key) ? key : path.join(MODELOS_CHAMADAS_DIR, key);
}

async function getLatestModeloRow(req, chamadaId, tipo) {
  const { rows } = await q(
    req,
    `
    SELECT
      chamada_id,
      nome_arquivo,
      mime,
      storage_key,
      tamanho_bytes,
      updated_at,
      hash_sha256,
      tipo
    FROM trabalhos_chamadas_modelos
    WHERE chamada_id = $1
      AND tipo = $2
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [Number(chamadaId), String(tipo)]
  );
  return rows[0] || null;
}

function setPublicCache(res, stat) {
  const etag = `"${crypto
    .createHash("sha1")
    .update(`${stat.size}:${stat.mtimeMs}`)
    .digest("hex")}"`;

  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("ETag", etag);
  res.setHeader("Last-Modified", stat.mtime.toUTCString());
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Disposition, Content-Length, Last-Modified, ETag"
  );
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

/* ========================= Factories ========================= */
function modeloTipoCfg(alias) {
  if (alias === "banner") {
    return { tipo: "template_banner", defaultName: "modelo-banner.pptx" };
  }
  if (alias === "oral") {
    return { tipo: "template_slide_oral", defaultName: "modelo-oral.pptx" };
  }
  throw new Error("tipo de modelo inválido");
}

/* ---------- ADMIN: meta/download/upload ---------- */
function adminMetaRoute(alias) {
  const cfg = modeloTipoCfg(alias);

  return [
    `/admin/:id/${alias === "banner" ? "modelo-banner" : "modelo-oral"}/meta`,
    requireAuth,
    authorizeRoles("administrador"),
    noStore,
    [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
    validate,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      const row = await getLatestModeloRow(req, id, cfg.tipo);

      if (!row) {
        return res.status(404).json({ erro: "Modelo não encontrado" });
      }

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
    `/admin/:id/${alias === "banner" ? "modelo-banner" : "modelo-oral"}/download`,
    requireAuth,
    authorizeRoles("administrador"),
    noStore,
    [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
    validate,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      const row = await getLatestModeloRow(req, id, cfg.tipo);

      if (!row) {
        return res.status(404).json({ erro: "Modelo não encontrado" });
      }

      const absPath = resolveAbsPath(row.storage_key);
      if (!absPath || !fs.existsSync(absPath)) {
        return res.status(410).json({ erro: "Arquivo não está disponível" });
      }

      return res.download(absPath, row.nome_arquivo || cfg.defaultName);
    }),
  ];
}

function adminUploadRoute(alias) {
  const cfg = modeloTipoCfg(alias);

  return [
    `/admin/:id/${alias === "banner" ? "modelo-banner" : "modelo-oral"}`,
    requireAuth,
    authorizeRoles("administrador"),
    noStore,
    uploadModeloLimiter,
    upload.single("file"),
    [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
    validate,
    asyncHandler(async (req, res) => {
      const chamadaId = req.params.id;
      const f = req.file;

      if (!f) {
        return res.status(400).json({ erro: "Arquivo ausente" });
      }

      const ext = path.extname(f.originalname || "").toLowerCase();
      if (!allowedMimes.has(f.mimetype) && ext !== ".ppt" && ext !== ".pptx") {
        return res.status(400).json({ erro: "Apenas arquivos .ppt ou .pptx" });
      }

      if (!looksLikePpt(f.buffer, ext)) {
        return res.status(400).json({
          erro: "Arquivo inválido (assinatura não compatível com PPT/PPTX).",
        });
      }

      const { storageKey, sha256 } = await storage.saveChamadaModelo(
        chamadaId,
        f,
        cfg.tipo
      );

      const { rows } = await q(
        req,
        `
        INSERT INTO trabalhos_chamadas_modelos
          (chamada_id, nome_arquivo, mime, storage_key, tamanho_bytes, hash_sha256, tipo, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7, now())
        ON CONFLICT (chamada_id, tipo) DO UPDATE
        SET nome_arquivo  = EXCLUDED.nome_arquivo,
            mime          = EXCLUDED.mime,
            storage_key   = EXCLUDED.storage_key,
            tamanho_bytes = EXCLUDED.tamanho_bytes,
            hash_sha256   = EXCLUDED.hash_sha256,
            updated_at    = now()
        RETURNING chamada_id, nome_arquivo, mime, storage_key, tamanho_bytes, hash_sha256, updated_at, tipo
        `,
        [
          Number(chamadaId),
          f.originalname,
          f.mimetype,
          storageKey,
          f.size ?? null,
          sha256 ?? null,
          cfg.tipo,
        ]
      );

      return res.json(rows[0]);
    }),
  ];
}

/* ---------- PÚBLICO: HEAD/GET por chamada ---------- */
function publicHeadRoute(alias) {
  const cfg = modeloTipoCfg(alias);

  return [
    `/:id(\\d+)/${alias === "banner" ? "modelo-banner" : "modelo-oral"}`,
    [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
    validate,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      const row = await getLatestModeloRow(req, id, cfg.tipo);

      if (!row) return res.status(404).end();

      const abs = resolveAbsPath(row.storage_key);
      const exists = abs && fs.existsSync(abs);
      if (!exists) return res.status(404).end();

      try {
        const stat = await fsp.stat(abs);
        res.setHeader(
          "Content-Type",
          row.mime || mime.lookup(row.nome_arquivo) || "application/octet-stream"
        );
        res.setHeader(
          "X-Modelo-Filename",
          encodeURIComponent(row.nome_arquivo || cfg.defaultName)
        );
        setPublicCache(res, stat);
      } catch {
        // best effort
      }

      return res.status(204).end();
    }),
  ];
}

function publicGetRoute(alias) {
  const cfg = modeloTipoCfg(alias);

  return [
    `/:id(\\d+)/${alias === "banner" ? "modelo-banner" : "modelo-oral"}`,
    [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
    validate,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      const m = await getLatestModeloRow(req, id, cfg.tipo);

      if (!m) {
        return res.status(404).json({ erro: "Modelo não encontrado" });
      }

      const absPath = resolveAbsPath(m.storage_key);
      if (!absPath || !fs.existsSync(absPath)) {
        console.error(`[modelo-${alias}] arquivo ausente:`, {
          absPath,
          storage_key: m.storage_key,
        });
        return res.status(404).json({ erro: "Arquivo do modelo não está disponível" });
      }

      const stat = await fsp.stat(absPath);
      const mimeType =
        m.mime ||
        mime.lookup(m.nome_arquivo) ||
        "application/vnd.openxmlformats-officedocument.presentationml.presentation";

      res.setHeader("Content-Type", mimeType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(
          m.nome_arquivo || cfg.defaultName
        )}`
      );
      res.setHeader("Content-Length", String(stat.size));

      setPublicCache(res, stat);
      if (checkConditionalHeaders(req, res, stat)) return;

      const stream = fs.createReadStream(absPath);
      stream.on("error", (e) => {
        console.error(`[modelo-${alias} stream error]`, {
          code: e.code,
          message: e.message,
          absPath,
        });

        if (!res.headersSent) {
          res.status(500).json({ erro: "Falha ao transmitir o arquivo" });
        }
      });

      return stream.pipe(res);
    }),
  ];
}

/* ✅ Admin modelos */
router.get(...adminMetaRoute("banner"));
router.get(...adminMetaRoute("oral"));
router.get(...adminDownloadRoute("banner"));
router.get(...adminDownloadRoute("oral"));
router.post(...adminUploadRoute("banner"));
router.post(...adminUploadRoute("oral"));

/* ✅ Público (por chamada) */
router.head(...publicHeadRoute("banner"));
router.get(...publicGetRoute("banner"));
router.head(...publicHeadRoute("oral"));
router.get(...publicGetRoute("oral"));

/* ===================================================================
   🔒 ADMIN — Chamadas + Submissões
=================================================================== */

// protege TODO /admin de uma vez
router.use("/admin", requireAuth, authorizeRoles("administrador"), noStore);

/* =========================
   Admin — Chamadas
========================= */
router.get("/admin/chamada", asyncHandler(ctrl.listarAdmin));
router.get("/admin/chamadas", asyncHandler(ctrl.listarAdmin));

router.post("/admin/chamada", asyncHandler(ctrl.criar));
router.post("/admin/chamadas", asyncHandler(ctrl.criar));

router.put(
  "/admin/chamada/:id(\\d+)",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(ctrl.atualizar)
);

router.put(
  "/admin/chamadas/:id(\\d+)",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(ctrl.atualizar)
);

// Publicar / Despublicar chamada
["post", "put", "patch"].forEach((m) => {
  router[m](
    "/admin/chamada/:id(\\d+)/publicar",
    [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
    validate,
    asyncHandler(ctrl.publicar)
  );

  router[m](
    "/admin/chamadas/:id(\\d+)/publicar",
    [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
    validate,
    asyncHandler(ctrl.publicar)
  );
});

router.delete(
  "/admin/chamada/:id(\\d+)",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(ctrl.remover)
);

router.delete(
  "/admin/chamadas/:id(\\d+)",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(ctrl.remover)
);

/* =========================
   Admin — Submissões
========================= */
if (typeof trabCtrl.listarsubmissaoAdminTodas === "function") {
  router.get("/admin/submissao", asyncHandler(trabCtrl.listarsubmissaoAdminTodas));
  router.get("/admin/submissoes", asyncHandler(trabCtrl.listarsubmissaoAdminTodas));
}

router.get(
  "/admin/chamada/:chamadaId(\\d+)/submissao",
  [param("chamadaId").isInt({ min: 1 }).withMessage("chamadaId inválido.").toInt()],
  validate,
  asyncHandler(trabCtrl.listarsubmissaoAdmin)
);

router.get(
  "/admin/chamadas/:chamadaId(\\d+)/submissao",
  [param("chamadaId").isInt({ min: 1 }).withMessage("chamadaId inválido.").toInt()],
  validate,
  asyncHandler(trabCtrl.listarsubmissaoAdmin)
);

router.get(
  "/admin/chamada/:chamadaId(\\d+)/submissoes",
  [param("chamadaId").isInt({ min: 1 }).withMessage("chamadaId inválido.").toInt()],
  validate,
  asyncHandler(trabCtrl.listarsubmissaoAdmin)
);

router.get(
  "/admin/chamadas/:chamadaId(\\d+)/submissoes",
  [param("chamadaId").isInt({ min: 1 }).withMessage("chamadaId inválido.").toInt()],
  validate,
  asyncHandler(trabCtrl.listarsubmissaoAdmin)
);

router.post(
  "/admin/submissao/:id(\\d+)/avaliar",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(trabCtrl.avaliarEscrita)
);

router.post(
  "/admin/submissao/:id(\\d+)/avaliar-oral",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(trabCtrl.avaliarOral)
);

router.post(
  "/admin/submissao/:id(\\d+)/status",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido.").toInt()],
  validate,
  asyncHandler(trabCtrl.definirStatusFinal)
);

router.post(
  "/admin/chamada/:chamadaId(\\d+)/classificar",
  [param("chamadaId").isInt({ min: 1 }).withMessage("chamadaId inválido.").toInt()],
  validate,
  asyncHandler(trabCtrl.consolidarClassificacao)
);

router.post(
  "/admin/chamadas/:chamadaId(\\d+)/classificar",
  [param("chamadaId").isInt({ min: 1 }).withMessage("chamadaId inválido.").toInt()],
  validate,
  asyncHandler(trabCtrl.consolidarClassificacao)
);

module.exports = router;