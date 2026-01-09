// 📁 server/services/storage.js
/* eslint-disable no-console */

const path = require("path");
const fs = require("fs/promises");
const fsRaw = require("fs");
const crypto = require("crypto");

// Reusa seus paths (BASE/local de modelos já garantido no server.js)
const { MODELOS_CHAMADAS_DIR, ensureDir } = require("../paths");

// extensões permitidas
const ALLOWED_EXT = new Set([".ppt", ".pptx"]);
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

function assertSafeStorageKey(storageKey) {
  // impede ../ e paths absolutos
  if (
    storageKey.includes("..") ||
    path.isAbsolute(storageKey) ||
    storageKey.startsWith("/") ||
    storageKey.startsWith("\\")
  ) {
    throw new Error("storageKey inválida");
  }
}

/**
 * Salva o arquivo de modelo da chamada no disco.
 * @param {number|string} chamadaId
 * @param {{originalname:string, mimetype?:string, size?:number, buffer:Buffer}} file (multer memory)
 * @returns {{ storageKey: string, sha256: string }}
 */
async function saveChamadaModelo(chamadaId, file) {
  const id = String(chamadaId);
  if (!id || !file || !Buffer.isBuffer(file.buffer)) {
    throw new Error("Arquivo inválido para salvar modelo.");
  }
  if (file.size && file.size > MAX_SIZE_BYTES) {
    throw new Error("Arquivo excede o tamanho máximo permitido.");
  }

  // força extensão conhecida
  let ext = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    // se vier sem extensão (depende do SO/navegador), assume .pptx
    ext = ".pptx";
  }

  // Nome único “estável” por chamada
  const safeName = `modelo_banner${ext}`;

  // pasta: <MODELOS_CHAMADAS_DIR>/<chamadaId>/
  const dir = path.join(MODELOS_CHAMADAS_DIR, id);
  await ensureDir(dir);

  // storageKey relativa à base MODELOS_CHAMADAS_DIR (sempre posix)
  const storageKey = path.posix.join(id, safeName);
  assertSafeStorageKey(storageKey);

  // caminho absoluto
  const fullPath = path.join(MODELOS_CHAMADAS_DIR, storageKey);

  // hash para auditoria/cache-busting
  const buf = file.buffer;
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

  // escrita atômica: escreve num tmp e renomeia
  const tmpPath = `${fullPath}.tmp-${Date.now()}`;
  await fs.writeFile(tmpPath, buf);
  await fs.rename(tmpPath, fullPath);

  return { storageKey, sha256 };
}

/**
 * Retorna um ReadStream do arquivo salvo (para fazer pipe no response).
 * @param {string} storageKey  (ex.: "123/modelo_banner.pptx")
 * @returns {import("fs").ReadStream}
 */
function stream(storageKey) {
  assertSafeStorageKey(storageKey);
  const fullPath = path.join(MODELOS_CHAMADAS_DIR, storageKey);
  return fsRaw.createReadStream(fullPath);
}

/**
 * (Opcional) Headers prontos para download/inline
 */
function getDownloadHeaders(filename) {
  return {
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "X-Content-Type-Options": "nosniff",
  };
}

module.exports = { saveChamadaModelo, stream, getDownloadHeaders };
