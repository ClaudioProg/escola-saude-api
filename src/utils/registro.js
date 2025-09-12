// 📁 src/utils/registro.js
/**
 * Normaliza um único registro: mantém apenas dígitos.
 */
function normalizeRegistro(value) {
  return String(value ?? "").replace(/\D+/g, "");
}

/**
 * Recebe string CSV, array, textarea, etc.
 * → retorna array de registros únicos, só números.
 */
function normalizeListaRegistros(input) {
  if (!input) return [];

  // transforma em array (split por vírgula, espaço, ;, quebra de linha…)
  const arr = Array.isArray(input)
    ? input
    : String(input).split(/[\s,;|\n\r\t]+/);

  const limpos = arr.map(normalizeRegistro).filter(Boolean);

  // deduplica preservando ordem
  const seen = new Set();
  return limpos.filter((r) => {
    if (seen.has(r)) return false;
    seen.add(r);
    return true;
  });
}

module.exports = {
  normalizeRegistro,
  normalizeListaRegistros,
};
