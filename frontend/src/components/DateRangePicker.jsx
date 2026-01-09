// 📁 src/components/DateRangePicker.jsx
import PropTypes from "prop-types";
import { useId, useMemo, useRef, useState, useCallback } from "react";

/* ──────────────────────────────────────────────
   Helpers: sempre em "YYYY-MM-DD", no fuso local
   ────────────────────────────────────────────── */
function toLocalYMD(v) {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// value (Date | ISO | null) -> [YYYY-MM-DD, YYYY-MM-DD]
function normalizePair(value) {
  const a = Array.isArray(value) ? value : [null, null];
  return [toLocalYMD(a[0]), toLocalYMD(a[1])];
}

// Comparadores lexicais estáveis p/ YYYY-MM-DD
const isAfter = (a, b) => (a && b ? a > b : false);
const isBefore = (a, b) => (a && b ? a < b : false);

// clamp por limites (strings YYYY-MM-DD)
function clampByLimits(v, min, max) {
  if (!v) return v;
  if (min && v < min) return min;
  if (max && v > max) return max;
  return v;
}

/* Presets default (opcionais) */
function getTodayYMD() {
  const d = new Date();
  return toLocalYMD(d);
}
function addDays(ymd, delta) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return toLocalYMD(dt);
}
function monthBoundsOf(ymd) {
  if (!ymd) return ["", ""];
  const [y, m] = ymd.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  return [toLocalYMD(first), toLocalYMD(last)];
}

export default function DateRangePicker({
  label = "Período",
  value = [null, null],
  onChange,
  disabled = false,
  className = "",
  // 🆕 extras opcionais (mantém compat)
  minDate,                 // "YYYY-MM-DD"
  maxDate,                 // "YYYY-MM-DD"
  showPresets = false,     // exibe presets padrões
  presets = [],            // [{ label, range: [start,end] }], sobrepõe/compõe com defaults
  allowSwap = true,        // se true, inverte automático quando início > fim
  onInvalidRange,          // callback(start, end) quando range inválido e allowSwap=false
  placeholderStart = "Início",
  placeholderEnd = "Fim",
}) {
  const groupId = useId();
  const [inicioProp, fimProp] = normalizePair(value);

  // a11y status (announce auto-ajustes)
  const [statusMsg, setStatusMsg] = useState("");
  const liveRef = useRef(null);

  const ids = useMemo(
    () => ({
      start: `${groupId}-start`,
      end: `${groupId}-end`,
      hint: `${groupId}-hint`,
      status: `${groupId}-status`,
      presets: `${groupId}-presets`,
    }),
    [groupId]
  );

  const announce = useCallback((msg) => {
    setStatusMsg(msg);
    requestAnimationFrame(() => {
      if (liveRef.current) {
        liveRef.current.textContent = "";
        requestAnimationFrame(() => {
          if (liveRef.current) liveRef.current.textContent = msg;
        });
      }
    });
  }, []);

  /** onChange unificado: mantém ordem (início ≤ fim) + respeita min/max */
  const setRange = useCallback(
    (start, end, { shouldAnnounce = true } = {}) => {
      let s = clampByLimits(start || "", minDate, maxDate);
      let e = clampByLimits(end || "", minDate, maxDate);

      if (s && e && isAfter(s, e)) {
        if (allowSwap) {
          const tmp = s;
          s = e;
          e = tmp;
          if (shouldAnnounce) announce("Datas invertidas automaticamente para manter o período válido.");
        } else {
          // mantém como está e avisa o consumidor
          onInvalidRange?.(s, e);
          return;
        }
      }

      onChange?.([s || null, e || null]);
    },
    [onChange, minDate, maxDate, allowSwap, announce, onInvalidRange]
  );

  /* Presets padrão (se habilitados) */
  const defaultPresets = useMemo(() => {
    if (!showPresets) return [];
    const today = getTodayYMD();
    const [mStart, mEnd] = monthBoundsOf(today);

    // mês passado
    const [y, m] = today.split("-").map(Number);
    const firstPrev = new Date(y, m - 2, 1);
    const lastPrev = new Date(y, m - 1, 0);
    const prevStart = toLocalYMD(firstPrev);
    const prevEnd = toLocalYMD(lastPrev);

    return [
      { label: "Últimos 7 dias", range: [addDays(today, -6), today] },
      { label: "Últimos 30 dias", range: [addDays(today, -29), today] },
      { label: "Este mês", range: [mStart, mEnd] },
      { label: "Mês passado", range: [prevStart, prevEnd] },
    ];
  }, [showPresets]);

  const allPresets = useMemo(() => {
    const custom = Array.isArray(presets) ? presets.filter(p => p?.label && Array.isArray(p?.range)) : [];
    return [...defaultPresets, ...custom];
  }, [defaultPresets, presets]);

  // limita min/max nas entradas
  const inputMin = minDate || undefined;
  const inputMax = maxDate || undefined;

  return (
    <fieldset
      className={`flex flex-col text-sm w-full ${className}`}
      disabled={disabled}
      aria-describedby={`${ids.hint} ${ids.status}`}
    >
      {label && (
        <legend className="mb-1 font-medium text-green-900 dark:text-green-200">
          {label}
        </legend>
      )}

      {/* Presets (opcional) */}
      {allPresets.length > 0 && (
        <div id={ids.presets} className="mb-2 flex flex-wrap gap-1.5">
          {allPresets.map((p, idx) => {
            const start = clampByLimits(toLocalYMD(p.range?.[0]), minDate, maxDate);
            const end = clampByLimits(toLocalYMD(p.range?.[1]), minDate, maxDate);
            const disabledPreset = !start || !end || (minDate && isBefore(end, minDate)) || (maxDate && isAfter(start, maxDate));
            return (
              <button
                key={`${p.label}-${idx}`}
                type="button"
                disabled={disabled || disabledPreset}
                onClick={() => setRange(start, end)}
                className="
                  px-2.5 py-1 rounded-full border text-xs font-medium
                  bg-white hover:bg-emerald-50 text-emerald-900 border-emerald-200
                  dark:bg-zinc-900 dark:text-emerald-200 dark:border-emerald-800 dark:hover:bg-emerald-900/20
                  disabled:opacity-50 disabled:cursor-not-allowed
                  focus:outline-none focus:ring-2 focus:ring-emerald-600
                "
                aria-label={`Aplicar preset: ${p.label}`}
                title={p.label}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          id={ids.start}
          name="data-inicio"
          type="date"
          value={inicioProp}
          placeholder={placeholderStart}
          onChange={(e) => setRange(e.target.value, fimProp)}
          aria-label="Data inicial"
          disabled={disabled}
          max={fimProp || inputMax}
          min={inputMin}
          className="
            flex-1 p-2 rounded-md border border-gray-300
            dark:border-gray-600 dark:bg-zinc-800 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-green-600
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        />

        <span id={ids.hint} className="text-gray-600 dark:text-gray-300 select-none">
          até
        </span>

        <input
          id={ids.end}
          name="data-fim"
          type="date"
          value={fimProp}
          placeholder={placeholderEnd}
          onChange={(e) => setRange(inicioProp, e.target.value)}
          aria-label="Data final"
          disabled={disabled}
          min={inicioProp || inputMin}
          max={inputMax}
          className="
            flex-1 p-2 rounded-md border border-gray-300
            dark:border-gray-600 dark:bg-zinc-800 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-green-600
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        />

        {/* Limpar */}
        <button
          type="button"
          onClick={() => setRange("", "", { shouldAnnounce: false })}
          disabled={disabled || (!inicioProp && !fimProp)}
          className="
            shrink-0 px-3 py-2 rounded-md text-xs font-semibold
            bg-transparent border border-gray-300 hover:bg-gray-100
            dark:border-gray-600 dark:text-gray-100 dark:hover:bg-zinc-700
            focus:outline-none focus:ring-2 focus:ring-green-600
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          aria-label="Limpar período"
          title="Limpar período"
        >
          Limpar
        </button>
      </div>

      {/* Status de acessibilidade (announce) */}
      <p id={ids.status} ref={liveRef} role="status" aria-live="polite" className="sr-only">
        {statusMsg}
      </p>
    </fieldset>
  );
}

DateRangePicker.propTypes = {
  label: PropTypes.string,
  value: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)])
  ),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  className: PropTypes.string,

  // 🆕 opcionais
  minDate: PropTypes.string, // "YYYY-MM-DD"
  maxDate: PropTypes.string, // "YYYY-MM-DD"
  showPresets: PropTypes.bool,
  presets: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      range: PropTypes.arrayOf(
        PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)])
      ).isRequired,
    })
  ),
  allowSwap: PropTypes.bool,
  onInvalidRange: PropTypes.func,
  placeholderStart: PropTypes.string,
  placeholderEnd: PropTypes.string,
};
