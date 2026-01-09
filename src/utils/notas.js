// utils/notas.js

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function toNumber(v, fallback = NaN) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Calcula nota final em escala 0..10 normalizando itens que podem ter escalas diferentes.
 *
 * @param {Object} args
 * @param {Array} args.itens - [{ criterio_id, nota }] ou [{ criterio_oral_id, nota }]
 * @param {Array} args.criterios - [{ id, escala_min, escala_max, peso? }]
 * @param {Object} [opts]
 * @param {number} [opts.decimals=1] - casas decimais no retorno
 * @param {boolean} [opts.withMeta=false] - se true, retorna { nota, meta }
 * @returns {number|null|{nota:number|null, meta:Object}}
 */
function nota10Normalizada({ itens, criterios }, opts = {}) {
  const { decimals = 1, withMeta = false } = opts;

  const itensArr = Array.isArray(itens) ? itens : [];
  const critArr = Array.isArray(criterios) ? criterios : [];

  const byId = new Map(critArr.map((c) => [c.id, c]));

  let num = 0; // soma ponderada do score (0..1)
  let den = 0; // soma dos pesos
  let validCount = 0;

  for (const it of itensArr) {
    const id = it?.criterio_id ?? it?.criterio_oral_id;
    if (id == null) continue;

    const def = byId.get(id);
    if (!def) continue;

    const min = toNumber(def.escala_min ?? 0);
    const max = toNumber(def.escala_max ?? 10);

    // peso padrão 1; ignora peso <= 0
    const wRaw = def?.peso;
    const w = Number.isFinite(Number(wRaw)) ? Number(wRaw) : 1;
    if (!(w > 0)) continue;

    const r = toNumber(it?.nota);
    if (!Number.isFinite(r) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) continue;

    const score = clamp01((r - min) / (max - min));

    num += w * score;
    den += w;
    validCount += 1;
  }

  const nota = den === 0 ? null : Number((10 * (num / den)).toFixed(decimals));

  if (!withMeta) return nota;

  return {
    nota,
    meta: {
      validCount,
      pesoTotal: den,
      score01: den === 0 ? null : Number((num / den).toFixed(4)),
      decimals,
    },
  };
}

module.exports = { nota10Normalizada };
