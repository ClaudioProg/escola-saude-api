// src/utils/timezone.js
const { DateTime } = require("luxon");

// Zona padrão do projeto
const ZONA = "America/Sao_Paulo";

/**
 * Converte pares (data-only "YYYY-MM-DD", hora "HH:mm" ou "HH:mm:ss") para DateTime zonado.
 * Aceita também um ISO BR "DD/MM/YYYY HH:mm".
 */
function dateHourToZoned({ data, hora, brIso }) {
  if (brIso) {
    // "21/10/2025 19:00"
    const [d, m, y_h] = brIso.split("/");
    const [y, rest] = [y_h.slice(0,4), y_h.slice(5)];
    // rest: "2025 19:00" (se o formato vier com espaço)
    const [hh, mm] = rest.trim().split(" ")[1].split(":");
    const yyyy = y, DD = d, MM = m;
    return DateTime.fromObject(
      { year: +yyyy, month: +MM, day: +DD, hour: +hh, minute: +mm },
      { zone: ZONA }
    );
  }

  // data "YYYY-MM-DD"
  const [Y, M, D] = data.split("-").map(Number);

  let hh = 0, mm = 0, ss = 0;
  if (typeof hora === "string" && hora.trim()) {
    const parts = hora.split(":").map(Number);
    hh = parts[0] ?? 0; mm = parts[1] ?? 0; ss = parts[2] ?? 0;
  }

  return DateTime.fromObject({ year: Y, month: M, day: D, hour: hh, minute: mm, second: ss }, { zone: ZONA });
}

/** Agora (sempre na zona do projeto) */
function nowZoned() {
  return DateTime.now().setZone(ZONA);
}

/** Compara se ainda pode (<= prazo) */
function canSubmitUntil(deadlineZoned, now = nowZoned()) {
  return now <= deadlineZoned;
}

/** Utilidades de log */
function fmt(dt) {
  return {
    zoned: dt.setZone(ZONA).toISO({ suppressMilliseconds: true }),
    utc: dt.toUTC().toISO({ suppressMilliseconds: true }),
    epoch: dt.toMillis()
  };
}

module.exports = { ZONA, dateHourToZoned, nowZoned, canSubmitUntil, fmt };
