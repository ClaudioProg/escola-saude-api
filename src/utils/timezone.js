// src/utils/timezone.js
/* eslint-disable no-console */
const { DateTime } = require("luxon");

// Zona padrão do projeto
const ZONA = process.env.TZ_PADRAO || "America/Sao_Paulo";

function isValidDateOnly(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parseHora(hora) {
  let hh = 0, mm = 0, ss = 0;
  if (typeof hora === "string" && hora.trim()) {
    const parts = hora.trim().split(":").map((x) => Number(x));
    hh = Number.isFinite(parts[0]) ? parts[0] : 0;
    mm = Number.isFinite(parts[1]) ? parts[1] : 0;
    ss = Number.isFinite(parts[2]) ? parts[2] : 0;
  }
  return { hh, mm, ss };
}

/**
 * Converte pares (data-only "YYYY-MM-DD", hora "HH:mm" ou "HH:mm:ss") para DateTime zonado.
 * Aceita também um ISO BR "DD/MM/YYYY HH:mm" (ou "DD/MM/YYYY HH:mm:ss") via brIso.
 *
 * @param {{ data?:string, hora?:string, brIso?:string, zone?:string }} args
 * @returns {DateTime} DateTime (pode ser inválido se entrada ruim; checar dt.isValid)
 */
function dateHourToZoned({ data, hora, brIso, zone = ZONA }) {
  // ✅ caminho BR: "21/10/2025 19:00" ou "21/10/2025 19:00:00"
  if (brIso) {
    const s = String(brIso).trim();

    // tenta com segundos e sem segundos
    let dt = DateTime.fromFormat(s, "dd/MM/yyyy HH:mm:ss", { zone });
    if (!dt.isValid) {
      dt = DateTime.fromFormat(s, "dd/MM/yyyy HH:mm", { zone });
    }

    return dt;
  }

  // ✅ caminho data/hora
  if (!isValidDateOnly(data)) {
    return DateTime.invalid("Data inválida (esperado YYYY-MM-DD)");
  }

  const [Y, M, D] = data.split("-").map((x) => Number(x));
  const { hh, mm, ss } = parseHora(hora);

  const dt = DateTime.fromObject(
    { year: Y, month: M, day: D, hour: hh, minute: mm, second: ss },
    { zone }
  );

  return dt;
}

/** Agora (sempre na zona do projeto) */
function nowZoned(zone = ZONA) {
  return DateTime.now().setZone(zone);
}

/** Compara se ainda pode submeter até o prazo (inclusive) */
function canSubmitUntil(deadlineZoned, now = nowZoned()) {
  if (!deadlineZoned || typeof deadlineZoned.toMillis !== "function") return false;
  if (!deadlineZoned.isValid) return false;
  if (!now || !now.isValid) return false;

  return now.toMillis() <= deadlineZoned.toMillis();
}

/** Utilidades de log/debug */
function fmt(dt, zone = ZONA) {
  if (!dt || typeof dt.toISO !== "function") {
    return { valid: false, reason: "not_a_datetime" };
  }
  if (!dt.isValid) {
    return { valid: false, reason: dt.invalidReason, explanation: dt.invalidExplanation };
  }
  const z = dt.setZone(zone);
  return {
    valid: true,
    zoned: z.toISO({ suppressMilliseconds: true }),
    utc: z.toUTC().toISO({ suppressMilliseconds: true }),
    epoch: z.toMillis(),
    zone,
  };
}

module.exports = { ZONA, dateHourToZoned, nowZoned, canSubmitUntil, fmt };
