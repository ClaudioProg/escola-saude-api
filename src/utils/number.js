export function toIntOrNull(v) {
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    }