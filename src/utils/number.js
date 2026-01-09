// utils/number.js (ou onde você estiver usando)

export function toIntOrNull(v, opts = {}) {
  const {
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
  } = opts;

  // rejeita null/undefined
  if (v === null || v === undefined) return null;

  // rejeita boolean (true → 1 / false → 0)
  if (typeof v === "boolean") return null;

  // rejeita string vazia ou só espaços
  if (typeof v === "string" && !v.trim()) return null;

  const n = Number(v);
  if (!Number.isFinite(n)) return null;

  const i = Math.trunc(n);

  if (i < min || i > max) return null;

  return i;
}
