// 📁 src/utils/registro.js

/**
 * Mantém apenas dígitos.
 * @param {any} value
 * @param {Object} [opts]
 * @param {number} [opts.maxLen=50] - limita comprimento final para segurança
 */
function normalizeRegistro(value, opts = {}) {
  const { maxLen = 50 } = opts;
  const s = String(value ?? "").replace(/\D+/g, "");
  return Number.isFinite(maxLen) ? s.slice(0, Math.max(0, maxLen)) : s;
}

/** Testa se a string é exatamente 6 dígitos. */
function isRegistro6(str) {
  return /^\d{6}$/.test(String(str ?? ""));
}

/**
 * Quebra um run de dígitos em blocos de 6.
 * - mode="nonOverlapping" (padrão): NÃO sobrepostos (1234567890123 -> 123456, 789012)
 * - mode="sliding": janela deslizante (1234567 -> 123456, 234567) [mais agressivo]
 */
function splitRunsIntoSix(digitsRun, mode = "nonOverlapping") {
  const run = normalizeRegistro(digitsRun, { maxLen: 10_000 });
  const out = [];

  if (mode === "sliding") {
    for (let i = 0; i + 6 <= run.length; i += 1) {
      out.push(run.slice(i, i + 6));
    }
    return out;
  }

  // nonOverlapping (padrão)
  for (let i = 0; i + 6 <= run.length; i += 6) {
    out.push(run.slice(i, i + 6));
  }
  return out;
}

/** Deduplica preservando a ordem. */
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
 * Regras (padrão):
 * - Extrai runs de dígitos.
 * - Run=6: mantém.
 * - Run>6: quebra em blocos de 6 (não sobrepostos).
 * - Run<6: ignora.
 *
 * @param {any} input
 * @param {Object} [opts]
 * @param {"nonOverlapping"|"sliding"} [opts.mode="nonOverlapping"]
 * @param {number} [opts.maxItems=5000] - limita itens finais (segurança)
 * @param {number} [opts.maxRunLength=10000] - limita tamanho de cada run (segurança)
 * @returns {string[]}
 */
function normalizeListaRegistros(input, opts = {}) {
  const {
    mode = "nonOverlapping",
    maxItems = 5000,
    maxRunLength = 10000,
  } = opts;

  if (!input) return [];

  const values = Array.isArray(input) ? input : [String(input)];
  const coletados = [];

  for (const item of values) {
    if (coletados.length >= maxItems) break;

    // Extrai runs de dígitos
    const runs = String(item ?? "").match(/\d+/g) || [];

    for (const rawRun of runs) {
      if (coletados.length >= maxItems) break;

      const run = String(rawRun).slice(0, maxRunLength);

      if (run.length === 6) {
        coletados.push(run);
      } else if (run.length > 6) {
        coletados.push(...splitRunsIntoSix(run, mode));
      }
      // <6 ignora
    }
  }

  // Garante apenas 6 dígitos e deduplica preservando a ordem
  return uniquePreserveOrder(coletados.filter(isRegistro6)).slice(0, maxItems);
}

module.exports = {
  normalizeRegistro,
  normalizeListaRegistros,

  // helpers extras
  isRegistro6,
  splitRunsIntoSix,
  uniquePreserveOrder,
};
