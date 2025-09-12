// 📁 src/utils/registro.js

/**
 * Mantém apenas dígitos.
 */
function normalizeRegistro(value) {
  return String(value ?? "").replace(/\D+/g, "");
}

/**
 * Testa se a string é exatamente 6 dígitos.
 */
function isRegistro6(str) {
  return /^\d{6}$/.test(str);
}

/**
 * Quebra um run de dígitos em blocos NÃO sobrepostos de 6 dígitos.
 * Ex.: "1234567890123" => ["123456","789012"]  (o "3" final é ignorado)
 */
function splitRunsIntoSix(digitsRun) {
  const run = normalizeRegistro(digitsRun);
  const out = [];
  for (let i = 0; i + 6 <= run.length; i += 6) {
    out.push(run.slice(i, i + 6));
  }
  return out;
}

/**
 * Deduplica preservando a ordem.
 */
function uniquePreserveOrder(arr) {
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/**
 * Recebe string CSV, array, textarea, etc.
 * → retorna **apenas sequências válidas de 6 dígitos**, deduplicadas e em ordem.
 *
 * Regras:
 * - Qualquer run de dígitos com tamanho > 6 é quebrado em blocos NÃO sobrepostos de 6.
 * - Fragmentos < 6 são ignorados.
 * - Se já vierem valores de 6 dígitos, são mantidos como estão.
 *
 * Exemplos:
 *  - "abc123456def"            → ["123456"]
 *  - "111111222222"            → ["111111","222222"]
 *  - "99-88-77-66"             → ["998877","66"] → após regras → ["998877"] (o "66" é descartado)
 *  - ["123456","1234567"]      → ["123456","123456"] → dedup → ["123456"]
 */
function normalizeListaRegistros(input) {
  if (!input) return [];

  const values = Array.isArray(input) ? input : [String(input)];

  const coletados = [];

  for (const item of values) {
    // Extrai todos os runs de dígitos de cada item
    const runs = String(item ?? "").match(/\d+/g) || [];

    for (const run of runs) {
      if (run.length === 6) {
        coletados.push(run);
      } else if (run.length > 6) {
        coletados.push(...splitRunsIntoSix(run));
      }
      // < 6 → ignora
    }
  }

  // Garante apenas 6 dígitos e deduplica preservando a ordem
  return uniquePreserveOrder(coletados.filter(isRegistro6));
}

module.exports = {
  normalizeRegistro,
  normalizeListaRegistros,
  // helpers extras (úteis em controllers/tests)
  isRegistro6,
  splitRunsIntoSix,
  uniquePreserveOrder,
};
