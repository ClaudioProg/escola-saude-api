// 📁 src/paths.js
const path = require("path");
const fs = require("fs");

const IS_DEV = process.env.NODE_ENV !== "production";

// Base **persistente** para arquivos. Em prod, monte um volume e aponte FILES_BASE para ele.
// DEV: ./data    |   PROD: /var/data  (ou o que você definir em FILES_BASE)
const DATA_ROOT =
  process.env.FILES_BASE ||
  (IS_DEV ? path.join(process.cwd(), "data") : "/var/data");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// Estrutura:
// DATA_ROOT/
//   uploads/
//     modelos/chamadas/:id/banner.pptx
const UPLOADS_DIR = path.join(DATA_ROOT, "uploads");
const MODELOS_CHAMADAS_DIR = path.join(UPLOADS_DIR, "modelos", "chamadas");

// garante que existem
[DATA_ROOT, UPLOADS_DIR, MODELOS_CHAMADAS_DIR].forEach(ensureDir);

// logs úteis no boot
if (process.env.NODE_ENV !== "test") {
  console.log("[FILES] DATA_ROOT:", DATA_ROOT);
  console.log("[FILES] UPLOADS_DIR:", UPLOADS_DIR);
  console.log("[FILES] MODELOS_CHAMADAS_DIR:", MODELOS_CHAMADAS_DIR);
}

module.exports = {
  DATA_ROOT,
  UPLOADS_DIR,
  MODELOS_CHAMADAS_DIR,
  ensureDir,
};
