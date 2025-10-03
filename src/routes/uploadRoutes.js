// 📁 src/routes/uploadRoutes.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const requireAuth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const requireAdmin = [requireAuth, authorizeRoles("administrador")];

const router = express.Router();

/* ───────── Paths base ───────── */
// (novo) base por chamada: uploads/modelos/chamadas/:id
const basePorChamadaDir = path.join(process.cwd(), "uploads", "modelos", "chamadas");
if (!fs.existsSync(basePorChamadaDir)) fs.mkdirSync(basePorChamadaDir, { recursive: true });

// (legado) modelo global em public/modelos
const modelosDirGlobal = path.join(__dirname, "..", "public", "modelos");
if (!fs.existsSync(modelosDirGlobal)) fs.mkdirSync(modelosDirGlobal, { recursive: true });

/* Helpers por chamada */
function getChamadaPaths(chamadaId) {
  const id = String(chamadaId || "").trim();
  if (!id || !/^\d+$/.test(id)) return null;

  const dir = path.join(basePorChamadaDir, id);
  const destAbs = path.join(dir, "banner.pptx");          // binário salvo sempre com esse nome
  const metaAbs = path.join(dir, "banner-meta.json");     // metadados por chamada
  const publicUrl = `/api/modelos/chamadas/${id}/banner.pptx`; // servido pelo server.js
  return { id, dir, destAbs, metaAbs, publicUrl };
}

function readJsonSafe(file) {
  try {
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, "utf8") || "{}");
  } catch { return {}; }
}

function writeJsonSafe(file, obj) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(obj || {}, null, 2));
  } catch { /* ignore */ }
}

/* ───────── Multer: validação comum ───────── */
const fileFilter = (_req, file, cb) => {
  const ok =
    /vnd\.openxmlformats-officedocument\.presentationml\.presentation/.test(file.mimetype) ||
    /vnd\.ms-powerpoint/.test(file.mimetype) ||
    /\.(ppt|pptx)$/i.test(file.originalname);
  if (!ok) return cb(new Error("Apenas arquivos .ppt ou .pptx"));
  cb(null, true);
};

/* ───────── Multer: storage dinâmico por chamada ───────── */
const storagePerChamada = multer.diskStorage({
  destination: (req, _file, cb) => {
    const ps = getChamadaPaths(req.params.chamadaId);
    if (!ps) return cb(new Error("chamadaId inválido"));
    fs.mkdirSync(ps.dir, { recursive: true });
    cb(null, ps.dir);
  },
  filename: (_req, _file, cb) => cb(null, "banner.pptx"),
});

const uploadPerChamada = multer({
  storage: storagePerChamada,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter,
});

/* ───────────────────── Rotas POR CHAMADA ───────────────────── */

/** GET status/metadata do modelo da chamada */
router.get("/admin/chamadas/:chamadaId/modelo-banner", requireAdmin, (req, res) => {
  try {
    const ps = getChamadaPaths(req.params.chamadaId);
    if (!ps) return res.status(400).json({ erro: "Parâmetro chamadaId inválido" });

    if (!fs.existsSync(ps.destAbs)) {
      return res.json({ exists: false, url: null });
    }

    const st = fs.statSync(ps.destAbs);
    const meta = readJsonSafe(ps.metaAbs);

    return res.json({
      exists: true,
      url: ps.publicUrl,
      size: st.size,                 // bytes
      mtime: st.mtime,               // Date -> serializa como ISO
      filename: meta.originalname || "banner.pptx",
      uploaded_at: meta.uploaded_at || st.mtime,
    });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
});

/** POST upload do modelo da chamada (aceita vários nomes de campo) */
router.post(
  "/admin/chamadas/:chamadaId/modelo-banner",
  requireAdmin,
  uploadPerChamada.fields([
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

      // metadados
      writeJsonSafe(ps.metaAbs, {
        originalname: f.originalname || "banner.pptx",
        uploaded_at: new Date().toISOString(),
      });

      return res.json({ ok: true, url: ps.publicUrl });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }
);

/** GET download forçado do modelo da chamada */
router.get("/admin/chamadas/:chamadaId/modelo-banner/download", requireAdmin, (req, res) => {
  const ps = getChamadaPaths(req.params.chamadaId);
  if (!ps) return res.status(400).json({ erro: "Parâmetro chamadaId inválido" });

  if (!fs.existsSync(ps.destAbs)) return res.status(404).json({ erro: "Modelo não encontrado" });

  const meta = readJsonSafe(ps.metaAbs);
  const downloadName = meta.originalname || "modelo-banner.pptx";
  res.download(ps.destAbs, downloadName);
});

/* ───────────────────── Rotas LEGADAS (globais) ─────────────────────
   Mantidas para compatibilidade com telas antigas. Remova se não precisar. */

const destAbsGlobal = path.join(modelosDirGlobal, "banner-padrao.pptx");
const metaAbsGlobal = path.join(modelosDirGlobal, "banner-meta.json");
const publicUrlGlobal = "/api/modelos/banner-padrao.pptx";

const storageGlobal = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, modelosDirGlobal),
  filename: (_req, _file, cb) => cb(null, "banner-padrao.pptx"),
});
const uploadGlobal = multer({
  storage: storageGlobal,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

// GET status global (legado)
router.get("/admin/modelos/banner", requireAdmin, (_req, res) => {
  try {
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

// POST upload global (legado)
router.post(
  "/admin/modelos/banner",
  requireAdmin,
  uploadGlobal.fields([
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

      writeJsonSafe(metaAbsGlobal, {
        originalname: f.originalname || "banner-padrao.pptx",
        uploaded_at: new Date().toISOString(),
      });

      return res.json({ ok: true, url: publicUrlGlobal });
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
