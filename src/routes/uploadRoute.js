// ✅ src/routes/uploadRoute.js — PREMIUM/UNIFICADO
/* eslint-disable no-console */
"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");

const router = express.Router();

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default || _auth?.authMiddleware || _auth?.protect || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[uploadRoute] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

const authorizeMod = require("../middlewares/authorize");
const authorizeRoles =
  (typeof authorizeMod === "function" ? authorizeMod : authorizeMod?.authorizeRoles) ||
  authorizeMod?.authorizeRole ||
  authorizeMod?.authorize?.any ||
  authorizeMod?.authorize;

if (typeof authorizeRoles !== "function") {
  throw new Error("authorizeRoles não exportado corretamente em src/middlewares/authorize.js");
}

const requireAdmin = [requireAuth, authorizeRoles("administrador")];

/* ───────────────── Paths centralizados ───────────────── */
const { MODELOS_CHAMADAS_DIR, ensureDir } = require("../paths");

const IS_DEV = process.env.NODE_ENV !== "production";

/* ───────────────── Helpers ───────────────── */
function routeTag(tag) {
  return (_req, res, next) => {
    res.setHeader("X-Route-Handler", tag);
    return next();
  };
}

function setNoStore(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

function setDownloadSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Download-Options", "noopen");
}

function isNumericId(v) {
  return /^\d+$/.test(String(v || "").trim());
}

function safeDownloadName(name, fallback) {
  const base = String(name || "").trim() || fallback || "download.pptx";
  return base.replace(/[/\\?%*:|"<>]/g, "_");
}

function readJsonSafe(file) {
  try {
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, "utf8") || "{}");
  } catch {
    return {};
  }
}

function writeJsonSafe(file, obj) {
  try {
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(obj || {}, null, 2), "utf8");
  } catch {
    // noop
  }
}

function atomicWrite(destTmp, destFinal, buffer) {
  ensureDir(path.dirname(destFinal));
  fs.writeFileSync(destTmp, buffer);
  fs.renameSync(destTmp, destFinal);
}

function sha256(bufOrFile) {
  const hash = crypto.createHash("sha256");

  if (Buffer.isBuffer(bufOrFile)) {
    hash.update(bufOrFile);
    return hash.digest("hex");
  }

  const fd = fs.readFileSync(bufOrFile);
  hash.update(fd);
  return hash.digest("hex");
}

function buildEtagFromFile(absPath) {
  const stats = fs.statSync(absPath);
  const sizeHex = stats.size.toString(16);
  const smallHash = sha256(absPath).slice(0, 16);
  return `"pptx-${sizeHex}-${Number(stats.mtimeMs).toString(36)}-${smallHash}"`;
}

function logDev(tag, payload) {
  if (!IS_DEV) return;
  console.log(`[uploadRoute][${tag}]`, payload || "");
}

/**
 * Canonicaliza os caminhos por chamada.
 * ⚠️ O arquivo físico continua sendo salvo localmente,
 * mas a URL pública retornada precisa apontar para o chamadaRoute,
 * que já é quem expõe o download público do modelo.
 */
function getChamadaPaths(chamadaId) {
  const id = String(chamadaId || "").trim();
  if (!isNumericId(id)) return null;

  const dir = path.join(MODELOS_CHAMADAS_DIR, id);
  const destAbs = path.join(dir, "banner.pptx");
  const tmpAbs = path.join(dir, "banner.tmp");
  const metaAbs = path.join(dir, "banner-meta.json");

  return {
    id,
    dir,
    destAbs,
    tmpAbs,
    metaAbs,

    // ✅ alinhado ao chamadaRoute.js atual
    publicUrl: `/api/chamada/${id}/modelo-banner`,
    publicUrlAlias: `/api/chamadas/${id}/modelo-banner`,
  };
}

/* ───────────────── Arquivo legado global ───────────────── */
const modelosDirGlobal = path.join(MODELOS_CHAMADAS_DIR, "_global");
ensureDir(modelosDirGlobal);

const destAbsGlobal = path.join(modelosDirGlobal, "banner-padrao.pptx");
const tmpAbsGlobal = path.join(modelosDirGlobal, "banner-padrao.tmp");
const metaAbsGlobal = path.join(modelosDirGlobal, "banner-meta.json");

// ✅ alinhado ao chamadaRoute.js atual
const publicUrlGlobal = "/api/chamada/modelo/banner-padrao.pptx";
const publicUrlGlobalAliasA = "/api/chamada/modelos/banner-padrao.pptx";
const publicUrlGlobalAliasB = "/api/chamada/banner-padrao.pptx";

/* ───────────────── Multer ───────────────── */
const PPT_MIMES = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
];

const fileFilter = (_req, file, cb) => {
  const ok =
    PPT_MIMES.includes(file.mimetype) ||
    /\.(ppt|pptx)$/i.test(file.originalname || "");

  if (!ok) {
    return cb(new Error("Apenas arquivos .ppt ou .pptx"));
  }

  return cb(null, true);
};

const uploadMem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter,
});

function resolveUploadedFile(req) {
  return (
    req.files?.banner?.[0] ||
    req.files?.file?.[0] ||
    req.files?.arquivo?.[0] ||
    req.files?.modelo?.[0] ||
    null
  );
}

const uploadModeloBanner = uploadMem.fields([
  { name: "banner", maxCount: 1 },
  { name: "file", maxCount: 1 },
  { name: "arquivo", maxCount: 1 },
  { name: "modelo", maxCount: 1 },
]);

/* ───────────────── Middleware global deste router ───────────────── */
router.use(routeTag("uploadRoute"));
router.use((_req, res, next) => {
  setNoStore(res);
  return next();
});

/* ──────────────────────────────────────────────────────────────
   POR CHAMADA — ADMIN
────────────────────────────────────────────────────────────── */

/** HEAD metadata do modelo da chamada */
router.head(
  "/admin/chamadas/:chamadaId/modelo-banner",
  ...requireAdmin,
  (req, res) => {
    try {
      const ps = getChamadaPaths(req.params.chamadaId);
      if (!ps) return res.status(400).end();

      if (!fs.existsSync(ps.destAbs)) return res.status(404).end();

      const st = fs.statSync(ps.destAbs);
      const etag = buildEtagFromFile(ps.destAbs);

      res.setHeader("ETag", etag);
      res.setHeader("Last-Modified", st.mtime.toUTCString());
      res.setHeader("X-Model-Size", String(st.size));
      res.setHeader("X-Model-MTime", new Date(st.mtime).toISOString());

      if (req.headers["if-none-match"] === etag) {
        return res.status(304).end();
      }

      return res.status(200).end();
    } catch {
      return res.status(500).end();
    }
  }
);

/** GET metadata do modelo da chamada */
router.get(
  "/admin/chamadas/:chamadaId/modelo-banner",
  ...requireAdmin,
  (req, res) => {
    try {
      const ps = getChamadaPaths(req.params.chamadaId);
      if (!ps) {
        return res.status(400).json({ erro: "Parâmetro chamadaId inválido." });
      }

      if (!fs.existsSync(ps.destAbs)) {
        return res.json({ exists: false, url: null });
      }

      const st = fs.statSync(ps.destAbs);
      const meta = readJsonSafe(ps.metaAbs);
      const etag = buildEtagFromFile(ps.destAbs);

      res.setHeader("ETag", etag);
      res.setHeader("Last-Modified", st.mtime.toUTCString());

      if (req.headers["if-none-match"] === etag) {
        return res.status(304).end();
      }

      return res.json({
        exists: true,
        url: ps.publicUrl,
        url_alias: ps.publicUrlAlias,
        size: st.size,
        mtime: st.mtime,
        filename: meta.originalname || "banner.pptx",
        uploaded_at: meta.uploaded_at || st.mtime,
        checksum_sha256: sha256(ps.destAbs),
      });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }
);

/** POST upload do modelo da chamada */
router.post(
  "/admin/chamadas/:chamadaId/modelo-banner",
  ...requireAdmin,
  uploadModeloBanner,
  (req, res) => {
    try {
      const ps = getChamadaPaths(req.params.chamadaId);
      if (!ps) {
        return res.status(400).json({ erro: "Parâmetro chamadaId inválido." });
      }

      const f = resolveUploadedFile(req);
      if (!f) {
        return res.status(400).json({
          erro: 'Arquivo não recebido (use "banner", "file", "arquivo" ou "modelo").',
        });
      }

      if (!Buffer.isBuffer(f.buffer) || f.buffer.length === 0) {
        return res.status(400).json({ erro: "Arquivo vazio ou inválido." });
      }

      const overwrite = String(req.query.overwrite ?? "1") === "1";
      if (!overwrite && fs.existsSync(ps.destAbs)) {
        return res.status(409).json({
          erro: "Já existe um modelo para esta chamada (use ?overwrite=1 para substituir).",
        });
      }

      atomicWrite(ps.tmpAbs, ps.destAbs, f.buffer);

      const meta = {
        originalname: f.originalname || "banner.pptx",
        uploaded_at: new Date().toISOString(),
        uploaded_by: req.user?.cpf || req.user?.email || req.user?.id || "admin",
        size: f.size ?? fs.statSync(ps.destAbs).size,
        checksum_sha256: sha256(ps.destAbs),
      };

      writeJsonSafe(ps.metaAbs, meta);

      logDev("UPLOAD_CHAMADA", {
        chamada: ps.id,
        name: meta.originalname,
        size: meta.size,
        by: meta.uploaded_by,
      });

      return res.status(201).json({
        ok: true,
        url: ps.publicUrl,
        url_alias: ps.publicUrlAlias,
        size: meta.size,
        filename: meta.originalname,
        checksum_sha256: meta.checksum_sha256,
      });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }
);

/** DELETE remove o modelo da chamada */
router.delete(
  "/admin/chamadas/:chamadaId/modelo-banner",
  ...requireAdmin,
  (req, res) => {
    try {
      const ps = getChamadaPaths(req.params.chamadaId);
      if (!ps) {
        return res.status(400).json({ erro: "Parâmetro chamadaId inválido." });
      }

      if (!fs.existsSync(ps.destAbs)) {
        return res.status(404).json({ erro: "Modelo não encontrado." });
      }

      try {
        fs.unlinkSync(ps.destAbs);
      } catch {}
      try {
        fs.unlinkSync(ps.metaAbs);
      } catch {}

      logDev("DELETE_CHAMADA", {
        chamada: ps.id,
        by: req.user?.cpf || req.user?.email || req.user?.id || "admin",
      });

      return res.status(204).end();
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }
);

/** GET download forçado do modelo da chamada (admin) */
router.get(
  "/admin/chamadas/:chamadaId/modelo-banner/download",
  ...requireAdmin,
  (req, res) => {
    const ps = getChamadaPaths(req.params.chamadaId);
    if (!ps) {
      return res.status(400).json({ erro: "Parâmetro chamadaId inválido." });
    }

    if (!fs.existsSync(ps.destAbs)) {
      return res.status(404).json({ erro: "Modelo não encontrado." });
    }

    const meta = readJsonSafe(ps.metaAbs);
    const downloadName = safeDownloadName(
      meta.originalname || "modelo-banner.pptx",
      "modelo-banner.pptx"
    );

    setDownloadSecurityHeaders(res);
    res.type(PPT_MIMES[0]);
    return res.download(ps.destAbs, downloadName);
  }
);

/* ──────────────────────────────────────────────────────────────
   GLOBAL LEGADO — ADMIN
────────────────────────────────────────────────────────────── */

/** HEAD status global */
router.head(
  "/admin/modelos/banner",
  ...requireAdmin,
  (req, res) => {
    try {
      if (!fs.existsSync(destAbsGlobal)) return res.status(404).end();

      const st = fs.statSync(destAbsGlobal);
      const etag = buildEtagFromFile(destAbsGlobal);

      res.setHeader("ETag", etag);
      res.setHeader("Last-Modified", st.mtime.toUTCString());
      res.setHeader("X-Model-Size", String(st.size));
      res.setHeader("X-Model-MTime", new Date(st.mtime).toISOString());

      if (req.headers["if-none-match"] === etag) {
        return res.status(304).end();
      }

      return res.status(200).end();
    } catch {
      return res.status(500).end();
    }
  }
);

/** GET status global */
router.get(
  "/admin/modelos/banner",
  ...requireAdmin,
  (req, res) => {
    try {
      if (!fs.existsSync(destAbsGlobal)) {
        return res.json({ exists: false, url: null });
      }

      const st = fs.statSync(destAbsGlobal);
      const meta = readJsonSafe(metaAbsGlobal);
      const etag = buildEtagFromFile(destAbsGlobal);

      res.setHeader("ETag", etag);
      res.setHeader("Last-Modified", st.mtime.toUTCString());

      if (req.headers["if-none-match"] === etag) {
        return res.status(304).end();
      }

      return res.json({
        exists: true,
        url: publicUrlGlobal,
        url_aliases: [publicUrlGlobalAliasA, publicUrlGlobalAliasB],
        size: st.size,
        mtime: st.mtime,
        filename: meta.originalname || "banner-padrao.pptx",
        uploaded_at: meta.uploaded_at || st.mtime,
        checksum_sha256: sha256(destAbsGlobal),
      });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }
);

/** POST upload global */
router.post(
  "/admin/modelos/banner",
  ...requireAdmin,
  uploadModeloBanner,
  (req, res) => {
    try {
      const f = resolveUploadedFile(req);

      if (!f) {
        return res.status(400).json({
          erro: 'Arquivo não recebido (use "banner", "file", "arquivo" ou "modelo").',
        });
      }

      if (!Buffer.isBuffer(f.buffer) || f.buffer.length === 0) {
        return res.status(400).json({ erro: "Arquivo vazio ou inválido." });
      }

      atomicWrite(tmpAbsGlobal, destAbsGlobal, f.buffer);

      const meta = {
        originalname: f.originalname || "banner-padrao.pptx",
        uploaded_at: new Date().toISOString(),
        uploaded_by: req.user?.cpf || req.user?.email || req.user?.id || "admin",
        size: f.size ?? fs.statSync(destAbsGlobal).size,
        checksum_sha256: sha256(destAbsGlobal),
      };

      writeJsonSafe(metaAbsGlobal, meta);

      logDev("UPLOAD_GLOBAL", {
        name: meta.originalname,
        size: meta.size,
        by: meta.uploaded_by,
      });

      return res.status(201).json({
        ok: true,
        url: publicUrlGlobal,
        url_aliases: [publicUrlGlobalAliasA, publicUrlGlobalAliasB],
        size: meta.size,
        filename: meta.originalname,
        checksum_sha256: meta.checksum_sha256,
      });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }
);

/** DELETE global */
router.delete(
  "/admin/modelos/banner",
  ...requireAdmin,
  (req, res) => {
    try {
      if (!fs.existsSync(destAbsGlobal)) {
        return res.status(404).json({ erro: "Modelo não encontrado." });
      }

      try {
        fs.unlinkSync(destAbsGlobal);
      } catch {}
      try {
        fs.unlinkSync(metaAbsGlobal);
      } catch {}

      logDev("DELETE_GLOBAL", {
        by: req.user?.cpf || req.user?.email || req.user?.id || "admin",
      });

      return res.status(204).end();
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }
);

/** GET download global */
router.get(
  "/admin/modelos/banner/download",
  ...requireAdmin,
  (req, res) => {
    if (!fs.existsSync(destAbsGlobal)) {
      return res.status(404).json({ erro: "Modelo não encontrado." });
    }

    const meta = readJsonSafe(metaAbsGlobal);
    const downloadName = safeDownloadName(
      meta.originalname || "modelo-banner.pptx",
      "modelo-banner.pptx"
    );

    setDownloadSecurityHeaders(res);
    res.type(PPT_MIMES[0]);
    return res.download(destAbsGlobal, downloadName);
  }
);

/* ───────────────── Erro de upload (multer) ───────────────── */
router.use((err, _req, res, next) => {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ erro: "Arquivo muito grande (limite 50MB)." });
    }
    return res.status(400).json({ erro: `Erro no upload (${err.code}).` });
  }

  if (err?.message) {
    return res.status(Number(err.status) || 400).json({ erro: err.message });
  }

  return next(err);
});

module.exports = router;