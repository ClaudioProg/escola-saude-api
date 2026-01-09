// 📁 src/routes/uploadRoutes.js
/* eslint-disable no-console */
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");

const requireAuth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

// 🔁 Diretórios centralizados (persistentes)
const { MODELOS_CHAMADAS_DIR, ensureDir } = require("../paths");

const router = express.Router();

/* ───────── Helpers ───────── */

function isNumericId(v) {
  return /^\d+$/.test(String(v || "").trim());
}

function getChamadaPaths(chamadaId) {
  const id = String(chamadaId || "").trim();
  if (!isNumericId(id)) return null;

  const dir = path.join(MODELOS_CHAMADAS_DIR, id);
  const destAbs = path.join(dir, "banner.pptx");               // binário final
  const tmpAbs  = path.join(dir, "banner.tmp");                // escrita atômica
  const metaAbs = path.join(dir, "banner-meta.json");          // metadados
  const publicUrl = `/api/modelos/chamadas/${id}/banner.pptx`; // servido pelo server.js
  return { id, dir, destAbs, tmpAbs, metaAbs, publicUrl };
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
    /* ignore */
  }
}

/** gravação atômica (tmp → rename) */
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
  // ETag forte combinando size + mtime + sha256 pequeno (primeiros 16 chars)
  const smallHash = sha256(absPath).slice(0, 16);
  return `"pptx-${sizeHex}-${Number(stats.mtimeMs).toString(36)}-${smallHash}"`;
}

function setNoStore(res) {
  res.setHeader("Cache-Control", "no-store");
}

function setDownloadSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Download-Options", "noopen");
}

function safeDownloadName(name, fallback) {
  const base = String(name || "").trim() || fallback || "download.pptx";
  // remove path traversal e caracteres problemáticos
  return base.replace(/[/\\?%*:|"<>]/g, "_");
}

const PPT_MIMES = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
];

/* ───────── Multer (validação) ───────── */

const fileFilter = (_req, file, cb) => {
  const ok =
    PPT_MIMES.includes(file.mimetype) ||
    /\.(ppt|pptx)$/i.test(file.originalname);
  if (!ok) return cb(new Error("Apenas arquivos .ppt ou .pptx"));
  cb(null, true);
};

// Upload em memória (gravamos manualmente)
const uploadMem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB (igual ao front)
  fileFilter,
});

/* ───────────────────── Rotas POR CHAMADA ───────────────────── */

/** HEAD metadata do modelo da chamada */
router.head("/admin/chamadas/:chamadaId/modelo-banner", requireAdmin, (req, res) => {
  try {
    const ps = getChamadaPaths(req.params.chamadaId);
    if (!ps) return res.status(400).end();

    setNoStore(res);

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
});

/** GET metadata do modelo da chamada */
router.get("/admin/chamadas/:chamadaId/modelo-banner", requireAdmin, (req, res) => {
  try {
    const ps = getChamadaPaths(req.params.chamadaId);
    if (!ps) return res.status(400).json({ erro: "Parâmetro chamadaId inválido" });

    setNoStore(res);

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
      size: st.size,
      mtime: st.mtime, // (serializa como ISO)
      filename: meta.originalname || "banner.pptx",
      uploaded_at: meta.uploaded_at || st.mtime,
      checksum_sha256: sha256(ps.destAbs),
    });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
});

/** POST upload do modelo da chamada (grava atômica)
 *  Params:
 *   - overwrite: "0" | "1" (default "1") — se "0", não sobrescreve se já existir.
 */
router.post(
  "/admin/chamadas/:chamadaId/modelo-banner",
  requireAdmin,
  uploadMem.fields([
    { name: "banner",  maxCount: 1 },
    { name: "file",    maxCount: 1 },
    { name: "arquivo", maxCount: 1 },
    { name: "modelo",  maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const ps = getChamadaPaths(req.params.chamadaId);
      if (!ps) return res.status(400).json({ erro: "Parâmetro chamadaId inválido" });

      const f =
        req.files?.banner?.[0] ||
        req.files?.file?.[0] ||
        req.files?.arquivo?.[0] ||
        req.files?.modelo?.[0];

      if (!f) return res.status(400).json({ erro: 'Arquivo não recebido (use o campo "banner").' });
      if (!Buffer.isBuffer(f.buffer) || f.buffer.length === 0) {
        return res.status(400).json({ erro: "Arquivo vazio ou inválido." });
      }

      const overwrite = String(req.query.overwrite ?? "1") === "1";
      if (!overwrite && fs.existsSync(ps.destAbs)) {
        return res.status(409).json({ erro: "Já existe um modelo para esta chamada (use ?overwrite=1 para substituir)." });
      }

      // grava físico no diretório persistente (atômico)
      atomicWrite(ps.tmpAbs, ps.destAbs, f.buffer);

      // metadados
      const meta = {
        originalname: f.originalname || "banner.pptx",
        uploaded_at: new Date().toISOString(),
        uploaded_by: req.user?.cpf || req.user?.email || "admin", // opcional (se middleware preencher)
        size: f.size ?? fs.statSync(ps.destAbs).size,
        checksum_sha256: sha256(ps.destAbs),
      };
      writeJsonSafe(ps.metaAbs, meta);

      console.log(`[UPLOAD] chamada=${ps.id} | name="${meta.originalname}" | size=${meta.size} | by=${meta.uploaded_by}`);

      return res.status(201).json({
        ok: true,
        url: ps.publicUrl,
        size: meta.size,
        filename: meta.originalname,
        checksum_sha256: meta.checksum_sha256,
      });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }
);

/** DELETE remove o modelo da chamada (admin) */
router.delete("/admin/chamadas/:chamadaId/modelo-banner", requireAdmin, (req, res) => {
  try {
    const ps = getChamadaPaths(req.params.chamadaId);
    if (!ps) return res.status(400).json({ erro: "Parâmetro chamadaId inválido" });

    if (!fs.existsSync(ps.destAbs)) {
      return res.status(404).json({ erro: "Modelo não encontrado" });
    }

    // remove arquivo e meta se existirem
    try { fs.unlinkSync(ps.destAbs); } catch {}
    try { fs.unlinkSync(ps.metaAbs); } catch {}

    console.log(`[UPLOAD:DELETE] chamada=${ps.id} | by=${req.user?.cpf || req.user?.email || "admin"}`);

    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
});

/** GET download forçado do modelo da chamada (admin) */
router.get("/admin/chamadas/:chamadaId/modelo-banner/download", requireAdmin, (req, res) => {
  const ps = getChamadaPaths(req.params.chamadaId);
  if (!ps) return res.status(400).json({ erro: "Parâmetro chamadaId inválido" });

  if (!fs.existsSync(ps.destAbs)) return res.status(404).json({ erro: "Modelo não encontrado" });

  const meta = readJsonSafe(ps.metaAbs);
  const downloadName = safeDownloadName(meta.originalname || "modelo-banner.pptx", "modelo-banner.pptx");

  setDownloadSecurityHeaders(res);
  res.type(PPT_MIMES[0]); // força pptx moderno
  res.download(ps.destAbs, downloadName);
});

/* ───────────────────── Rotas LEGADAS (globais) ─────────────────────
   Se ainda houver telas antigas usando um modelo “global”, mantemos.
*/

const modelosDirGlobal = path.join(__dirname, "..", "public", "modelos");
if (!fs.existsSync(modelosDirGlobal)) fs.mkdirSync(modelosDirGlobal, { recursive: true });

const destAbsGlobal = path.join(modelosDirGlobal, "banner-padrao.pptx");
const tmpAbsGlobal  = path.join(modelosDirGlobal, "banner-padrao.tmp");
const metaAbsGlobal = path.join(modelosDirGlobal, "banner-meta.json");
const publicUrlGlobal = "/api/modelos/banner-padrao.pptx";

// HEAD status global (legado)
router.head("/admin/modelos/banner", requireAdmin, (_req, res) => {
  try {
    setNoStore(res);
    if (!fs.existsSync(destAbsGlobal)) return res.status(404).end();

    const st = fs.statSync(destAbsGlobal);
    const etag = buildEtagFromFile(destAbsGlobal);
    res.setHeader("ETag", etag);
    res.setHeader("Last-Modified", st.mtime.toUTCString());
    res.setHeader("X-Model-Size", String(st.size));
    res.setHeader("X-Model-MTime", new Date(st.mtime).toISOString());

    if (_req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }
    return res.status(200).end();
  } catch {
    return res.status(500).end();
  }
});

// GET status global (legado)
router.get("/admin/modelos/banner", requireAdmin, (_req, res) => {
  try {
    setNoStore(res);
    if (!fs.existsSync(destAbsGlobal)) return res.json({ exists: false, url: null });

    const st = fs.statSync(destAbsGlobal);
    const meta = readJsonSafe(metaAbsGlobal);
    const etag = buildEtagFromFile(destAbsGlobal);

    res.setHeader("ETag", etag);
    res.setHeader("Last-Modified", st.mtime.toUTCString());
    if (_req.headers["if-none-match"] === etag) return res.status(304).end();

    return res.json({
      exists: true,
      url: publicUrlGlobal,
      size: st.size,
      mtime: st.mtime,
      filename: meta.originalname || "banner-padrao.pptx",
      uploaded_at: meta.uploaded_at || st.mtime,
      checksum_sha256: sha256(destAbsGlobal),
    });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
});

// POST upload global (legado) — também atômico
router.post(
  "/admin/modelos/banner",
  requireAdmin,
  uploadMem.fields([
    { name: "banner",  maxCount: 1 },
    { name: "file",    maxCount: 1 },
    { name: "arquivo", maxCount: 1 },
    { name: "modelo",  maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const f =
        req.files?.banner?.[0] ||
        req.files?.file?.[0] ||
        req.files?.arquivo?.[0] ||
        req.files?.modelo?.[0];

      if (!f) return res.status(400).json({ erro: 'Arquivo não recebido (use o campo "banner").' });
      if (!Buffer.isBuffer(f.buffer) || f.buffer.length === 0) {
        return res.status(400).json({ erro: "Arquivo vazio ou inválido." });
      }

      atomicWrite(tmpAbsGlobal, destAbsGlobal, f.buffer);
      const meta = {
        originalname: f.originalname || "banner-padrao.pptx",
        uploaded_at: new Date().toISOString(),
        uploaded_by: req.user?.cpf || req.user?.email || "admin",
        size: f.size ?? fs.statSync(destAbsGlobal).size,
        checksum_sha256: sha256(destAbsGlobal),
      };
      writeJsonSafe(metaAbsGlobal, meta);

      console.log(`[UPLOAD:GLOBAL] name="${meta.originalname}" | size=${meta.size} | by=${meta.uploaded_by}`);

      return res.status(201).json({
        ok: true,
        url: publicUrlGlobal,
        size: meta.size,
        filename: meta.originalname,
        checksum_sha256: meta.checksum_sha256,
      });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }
);

// DELETE global (legado)
router.delete("/admin/modelos/banner", requireAdmin, (req, res) => {
  try {
    if (!fs.existsSync(destAbsGlobal)) return res.status(404).json({ erro: "Modelo não encontrado" });

    try { fs.unlinkSync(destAbsGlobal); } catch {}
    try { fs.unlinkSync(metaAbsGlobal); } catch {}

    console.log(`[UPLOAD:GLOBAL:DELETE] by=${req.user?.cpf || req.user?.email || "admin"}`);

    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
});

// Download global (legado)
router.get("/admin/modelos/banner/download", requireAdmin, (req, res) => {
  if (!fs.existsSync(destAbsGlobal)) return res.status(404).json({ erro: "Modelo não encontrado" });
  const meta = readJsonSafe(metaAbsGlobal);
  const downloadName = safeDownloadName(meta.originalname || "modelo-banner.pptx", "modelo-banner.pptx");
  setDownloadSecurityHeaders(res);
  res.type(PPT_MIMES[0]);
  res.download(destAbsGlobal, downloadName);
});

module.exports = router;
