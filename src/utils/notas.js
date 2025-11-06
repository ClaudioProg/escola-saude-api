// utils/notas.js
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function nota10Normalizada({ itens, criterios }) {
  // itens: [{ criterio_id, nota }]  ou [{ criterio_oral_id, nota }]
  // criterios: [{ id, escala_min, escala_max, peso? }]
  const byId = new Map(criterios.map(c => [c.id, c]));
  let num = 0; // soma ponderada
  let den = 0; // soma dos pesos

  for (const it of itens) {
    const id = it.criterio_id ?? it.criterio_oral_id;
    const def = byId.get(id);
    if (!def) continue;

    const min = Number(def.escala_min ?? 0);
    const max = Number(def.escala_max ?? 10);
    const w   = Number.isFinite(def.peso) ? Number(def.peso) : 1;
    const r   = Number(it.nota);

    if (!Number.isFinite(r) || max <= min) continue;

    const score = clamp01((r - min) / (max - min));
    num += w * score;
    den += w;
  }

  if (den === 0) return null; // sem itens válidos
  const n10 = 10 * (num / den);
  return Number(n10.toFixed(1));
}

module.exports = { nota10Normalizada };
