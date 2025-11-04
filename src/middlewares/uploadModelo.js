// 📁 src/middlewares/uploadModelo.js
const os = require("os");
const path = require("path");
const multer = require("multer");

// salva temporariamente no diretório do sistema
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, os.tmpdir());
  },
  filename: function (req, file, cb) {
    const fname = (file.originalname || "arquivo").replace(/[^\w.\-]+/g, "_");
    cb(null, Date.now() + "_" + fname);
  },
});

function fileFilter(req, file, cb) {
  const ok = /powerpoint|\.pptx?$/.test(file.mimetype) || /\.pptx?$/i.test(file.originalname || "");
  if (!ok) return cb(new Error("Envie .ppt ou .pptx"), false);
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

module.exports = upload;
