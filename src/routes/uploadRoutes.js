// 📁 src/routes/uploadRoutes.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const requireAuth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

// 🔁 Diretórios centralizados (persistentes)
const { MODELOS_CHAMADAS_DIR, ensureDir } = require("../paths");

const router = express.Router();

/* ───────── Helpers ───────── */

function getChamadaPaths(chamadaId) {
  const id = String(chamadaId || "").trim();
  if (!/^\d+$/.test(id)) return null;

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

/* ───────── Multer (validação) ───────── */

const fileFilter = (_req, file, cb) => {
  const ok =
    /vnd\.openxmlformats-officedocument\.presentationml\.presentation/.test(file.mimetype) ||
    /vnd\.ms-powerpoint/.test(file.mimetype) ||
    /\.(ppt|pptx)$/i.test(file.originalname);
  if (!ok) return cb(new Error("Apenas arquivos .ppt ou .pptx"));
  cb(null, true);
};

// Upload em memória (vamos gravar no volume persistente manualmente)
const uploadMem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB (igual ao front)
  fileFilter,
});

/* ───────────────────── Rotas POR CHAMADA ───────────────────── */

/** HEAD/GET metadata do modelo da chamada */
router.head("/admin/chamadas/:chamadaId/modelo-banner", requireAdmin, (req, res) => {
  try {
    const ps = getChamadaPaths(req.params.chamadaId);
    if (!ps) return res.status(400).end();

    res.setHeader("Cache-Control", "no-store");

    if (!fs.existsSync(ps.destAbs)) return res.status(404).end();

    const st = fs.statSync(ps.destAbs);
    res.setHeader("X-Model-Size", String(st.size));
    res.setHeader("X-Model-MTime", new Date(st.mtime).toISOString());
    return res.status(200).end();
  } catch {
    return res.status(500).end();
  }
});

router.get("/admin/chamadas/:chamadaId/modelo-banner", requireAdmin, (req, res) => {
  try {
    const ps = getChamadaPaths(req.params.chamadaId);
    if (!ps) return res.status(400).json({ erro: "Parâmetro chamadaId inválido" });

    res.setHeader("Cache-Control", "no-store");

    if (!fs.existsSync(ps.destAbs)) {
      return res.json({ exists: false, url: null });
    }

    const st = fs.statSync(ps.destAbs);
    const meta = readJsonSafe(ps.metaAbs);

    return res.json({
      exists: true,
      url: ps.publicUrl,
      size: st.size,
      mtime: st.mtime, // (serializa como ISO)
      filename: meta.originalname || "banner.pptx",
      uploaded_at: meta.uploaded_at || st.mtime,
    });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
});

/** POST upload do modelo da chamada (grava atômica) */
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

      // grava físico no diretório persistente (atômico)
      atomicWrite(ps.tmpAbs, ps.destAbs, f.buffer);

      // metadados
      writeJsonSafe(ps.metaAbs, {
        originalname: f.originalname || "banner.pptx",
        uploaded_at: new Date().toISOString(),
      });

      return res.status(201).json({
        ok: true,
        url: ps.publicUrl,
        size: f.size ?? fs.statSync(ps.destAbs).size,
        filename: f.originalname || "banner.pptx",
      });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }
);

/** GET download forçado do modelo da chamada (admin) */
router.get("/admin/chamadas/:chamadaId/modelo-banner/download", requireAdmin, (req, res) => {
  const ps = getChamadaPaths(req.params.chamadaId);
  if (!ps) return res.status(400).json({ erro: "Parâmetro chamadaId inválido" });

  if (!fs.existsSync(ps.destAbs)) return res.status(404).json({ erro: "Modelo não encontrado" });

  const meta = readJsonSafe(ps.metaAbs);
  const downloadName = meta.originalname || "modelo-banner.pptx";
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

// HEAD/GET status global (legado)
router.head("/admin/modelos/banner", requireAdmin, (_req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    if (!fs.existsSync(destAbsGlobal)) return res.status(404).end();
    const st = fs.statSync(destAbsGlobal);
    res.setHeader("X-Model-Size", String(st.size));
    res.setHeader("X-Model-MTime", new Date(st.mtime).toISOString());
    return res.status(200).end();
  } catch {
    return res.status(500).end();
  }
});

router.get("/admin/modelos/banner", requireAdmin, (_req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    if (!fs.existsSync(destAbsGlobal)) return res.json({ exists: false, url: null });

    const st = fs.statSync(destAbsGlobal);
    const meta = readJsonSafe(metaAbsGlobal);
    return res.json({
      exists: true,
      url: publicUrlGlobal,
      size: st.size,
      mtime: st.mtime,
      filename: meta.originalname || "banner-padrao.pptx",
      uploaded_at: meta.uploaded_at || st.mtime,
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
      writeJsonSafe(metaAbsGlobal, {
        originalname: f.originalname || "banner-padrao.pptx",
        uploaded_at: new Date().toISOString(),
      });

      return res.status(201).json({ ok: true, url: publicUrlGlobal });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }
);

// Download global (legado)
router.get("/admin/modelos/banner/download", requireAdmin, (_req, res) => {
  if (!fs.existsSync(destAbsGlobal)) return res.status(404).json({ erro: "Modelo não encontrado" });
  const meta = readJsonSafe(metaAbsGlobal);
  const downloadName = meta.originalname || "modelo-banner.pptx";
  res.download(destAbsGlobal, downloadName);
});

module.exports = router;
