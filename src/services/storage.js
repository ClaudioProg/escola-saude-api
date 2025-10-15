// 📁 server/services/storage.js
const path = require("path");
const fs = require("fs/promises");
const fsRaw = require("fs");
const crypto = require("crypto");

// Reusa seus paths (BASE/local de modelos já garantido no server.js)
const { MODELOS_CHAMADAS_DIR, ensureDir } = require("../paths");

/**
 * Salva o arquivo de modelo da chamada no disco.
 * @param {number} chamadaId
 * @param {{originalname:string, mimetype:string, size:number, buffer:Buffer}} file (multer memory)
 * @returns {{ storageKey: string, sha256: string }}
 */
async function saveChamadaModelo(chamadaId, file) {
  // força extensão conhecida
  let ext = path.extname(file.originalname || "").toLowerCase();
  if (!ext || ![".ppt", ".pptx"].includes(ext)) {
    // se vier sem extensão (depende do SO/navegador), assume .pptx
    ext = ".pptx";
  }

  // Nome único “estável” por chamada
  const safeName = `modelo_banner${ext}`;

  // pasta: <MODELOS_CHAMADAS_DIR>/<chamadaId>/
  const dir = path.join(MODELOS_CHAMADAS_DIR, String(chamadaId));
  await ensureDir(dir);

  // guardamos uma storageKey relativa à base MODELOS_CHAMADAS_DIR
  // (use sempre / para normalizar)
  const storageKey = path.posix.join(String(chamadaId), safeName);

  // caminho absoluto
  const fullPath = path.join(MODELOS_CHAMADAS_DIR, storageKey);

  // hash para auditoria/cache-busting
  const buf = file.buffer; // usando multer memoryStorage()
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

  // grava (substitui se já existe)
  await fs.writeFile(fullPath, buf);

  return { storageKey, sha256 };
}

/**
 * Retorna um ReadStream do arquivo salvo (para fazer pipe no response).
 * @param {string} storageKey  (ex.: "123/modelo_banner.pptx")
 * @returns {import("fs").ReadStream}
 */
function stream(storageKey) {
  const fullPath = path.join(MODELOS_CHAMADAS_DIR, storageKey);
  return fsRaw.createReadStream(fullPath);
}

module.exports = { saveChamadaModelo, stream };
