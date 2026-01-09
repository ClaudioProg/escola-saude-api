// 📁 src/middlewares/uploadModelo.js
/* eslint-disable no-console */

const os = require("os");
const path = require("path");
const multer = require("multer");

/* =========================
   Configurações
========================= */
const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// extensões permitidas
const ALLOWED_EXTENSIONS = [".ppt", ".pptx"];

// mimetypes comuns para PowerPoint
const ALLOWED_MIME = [
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // fallback (alguns browsers)
  "application/octet-stream",
];

/* =========================
   Storage (tmp do SO)
========================= */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // usa diretório temporário do sistema (seguro e portátil)
    cb(null, os.tmpdir());
  },

  filename: (_req, file, cb) => {
    const original = String(file.originalname || "arquivo");
    const ext = path.extname(original).toLowerCase() || ".pptx";

    // remove caracteres estranhos
    const base = path
      .basename(original, ext)
      .replace(/[^\w.-]+/g, "_")
      .slice(0, 80); // evita nomes gigantes

    const safeName = `${Date.now()}_${base}${ext}`;
    cb(null, safeName);
  },
});

/* =========================
   Filtro de arquivos
========================= */
function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mime = String(file.mimetype || "").toLowerCase();

  const extOk = ALLOWED_EXTENSIONS.includes(ext);
  const mimeOk = ALLOWED_MIME.includes(mime);

  // exige extensão válida; mime ajuda mas não é único critério
  if (!extOk) {
    return cb(new Error("Envie apenas arquivos .ppt ou .pptx"), false);
  }

  if (!mimeOk) {
    // não bloqueia por completo se a extensão for válida,
    // mas registra para auditoria
    console.warn(
      "[uploadModelo] MIME inesperado:",
      mime,
      "arquivo:",
      file.originalname
    );
  }

  return cb(null, true);
}

/* =========================
   Instância Multer
========================= */
const uploadModelo = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_SIZE_BYTES,
  },
});

/* =========================
   Export
========================= */
module.exports = uploadModelo;
