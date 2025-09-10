// 📁 src/utils/registro.js
function normalizeRegistro(v) {
    return String(v || "").replace(/\D/g, ""); // só dígitos
  }
  module.exports = { normalizeRegistro };