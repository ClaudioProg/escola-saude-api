// 📁 src/utils/tempo.js
// Datas-only (“YYYY-MM-DD”) e horas “HH:mm” — comparações por string (sem fuso/Date).

function isYmd(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function isHhmm(s) {
  return typeof s === "string" && /^\d{2}:\d{2}$/.test(s);
}

const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const hhmm = (s) => {
  if (typeof s !== "string") return "";
  // aceita "HH:mm:ss" e corta
  return s.length >= 5 ? s.slice(0, 5) : "";
};

function normalizeRange(a, b) {
  // se invertido, troca
  return a <= b ? [a, b] : [b, a];
}

/**
 * Verifica se dois ranges de datas [aIni..aFim] e [bIni..bFim] se sobrepõem.
 * @param {string} aIni YYYY-MM-DD
 * @param {string} aFim YYYY-MM-DD
 * @param {string} bIni YYYY-MM-DD
 * @param {string} bFim YYYY-MM-DD
 * @param {Object} [opts]
 * @param {boolean} [opts.inclusive=true] Se true, encostar na borda conta como sobreposição (datas)
 */
export function rangesDeDatasSobrepoem(aIni, aFim, bIni, bFim, opts = {}) {
  const { inclusive = true } = opts;

  const ai0 = ymd(aIni), af0 = ymd(aFim), bi0 = ymd(bIni), bf0 = ymd(bFim);
  if (!isYmd(ai0) || !isYmd(af0) || !isYmd(bi0) || !isYmd(bf0)) return false;

  const [ai, af] = normalizeRange(ai0, af0);
  const [bi, bf] = normalizeRange(bi0, bf0);

  // inclusive: considera sobreposição se encostarem
  if (inclusive) return !(af < bi || bf < ai);

  // exclusivo: precisa realmente cruzar
  return af > bi && bf > ai;
}

/**
 * Verifica sobreposição entre intervalos horários [h1i..h1f] e [h2i..h2f].
 * Padrão (premium): fim == início NÃO conflita (exclusivo).
 * @param {string} h1i HH:mm ou HH:mm:ss
 * @param {string} h1f HH:mm ou HH:mm:ss
 * @param {string} h2i HH:mm ou HH:mm:ss
 * @param {string} h2f HH:mm ou HH:mm:ss
 * @param {Object} [opts]
 * @param {boolean} [opts.inclusive=false] Se true, encostar na borda conta como conflito
 */
export function horasSobrepoem(h1i, h1f, h2i, h2f, opts = {}) {
  const { inclusive = false } = opts;

  const A0 = hhmm(h1i), B0 = hhmm(h1f), C0 = hhmm(h2i), D0 = hhmm(h2f);
  if (!isHhmm(A0) || !isHhmm(B0) || !isHhmm(C0) || !isHhmm(D0)) return false;

  const [A, B] = normalizeRange(A0, B0);
  const [C, D] = normalizeRange(C0, D0);

  // Regra:
  // exclusivo (padrão): (A < D) && (C < B)
  // inclusive: (A <= D) && (C <= B)
  return inclusive ? (A <= D && C <= B) : (A < D && C < B);
}

/**
 * Conflito de turmas = sobreposição de datas + sobreposição de horários
 * @param {Object} t1 { data_inicio, data_fim, horario_inicio, horario_fim }
 * @param {Object} t2 { data_inicio, data_fim, horario_inicio, horario_fim }
 * @param {Object} [opts] repassado para as funções internas
 */
export function turmasConflitam(t1, t2, opts = {}) {
  return (
    rangesDeDatasSobrepoem(t1?.data_inicio, t1?.data_fim, t2?.data_inicio, t2?.data_fim, { inclusive: true, ...opts }) &&
    horasSobrepoem(t1?.horario_inicio, t1?.horario_fim, t2?.horario_inicio, t2?.horario_fim, { inclusive: false, ...opts })
  );
}
