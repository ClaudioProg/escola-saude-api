// ✅ src/components/ui/DateRangePicker.jsx — v2.0
// Plataforma Escola da Saúde
//
// Seletor genérico oficial de período.
//
// Revisão premium:
// - componente genérico real de UI;
// - anti-fuso rigoroso: date-only tratado como string YYYY-MM-DD;
// - sem new Date("YYYY-MM-DD");
// - presets opcionais;
// - validação de ordem início/fim;
// - limites min/max;
// - acessibilidade com fieldset, legend, aria-live e descrições;
// - mobile-first;
// - visual premium consistente;
// - contrato limpo e previsível.

import PropTypes from "prop-types";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { CalendarDays, Eraser, Sparkles } from "lucide-react";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function isValidYMD(value) {
  if (typeof value !== "string") return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function dateToLocalYMD(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toYMD(value) {
  if (!value) return "";

  if (value instanceof Date) {
    return dateToLocalYMD(value);
  }

  const raw = String(value).trim();

  if (isValidYMD(raw.slice(0, 10))) {
    return raw.slice(0, 10);
  }

  return "";
}

function parseYMDToLocalDate(value) {
  const ymd = toYMD(value);
  if (!ymd) return null;

  const [year, month, day] = ymd.split("-").map(Number);

  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function addDaysYMD(ymd, amount) {
  const date = parseYMDToLocalDate(ymd);
  if (!date) return "";

  date.setDate(date.getDate() + Number(amount || 0));

  return dateToLocalYMD(date);
}

function todayYMD() {
  return dateToLocalYMD(new Date());
}

function monthBoundsYMD(ymd) {
  const date = parseYMDToLocalDate(ymd);
  if (!date) return ["", ""];

  const year = date.getFullYear();
  const month = date.getMonth();

  const first = new Date(year, month, 1, 12, 0, 0, 0);
  const last = new Date(year, month + 1, 0, 12, 0, 0, 0);

  return [dateToLocalYMD(first), dateToLocalYMD(last)];
}

function previousMonthBoundsYMD(ymd) {
  const date = parseYMDToLocalDate(ymd);
  if (!date) return ["", ""];

  const year = date.getFullYear();
  const month = date.getMonth();

  const first = new Date(year, month - 1, 1, 12, 0, 0, 0);
  const last = new Date(year, month, 0, 12, 0, 0, 0);

  return [dateToLocalYMD(first), dateToLocalYMD(last)];
}

function clampYMD(value, minDate, maxDate) {
  const ymd = toYMD(value);
  const min = toYMD(minDate);
  const max = toYMD(maxDate);

  if (!ymd) return "";

  if (min && ymd < min) return min;
  if (max && ymd > max) return max;

  return ymd;
}

function normalizePair(value) {
  const pair = Array.isArray(value) ? value : [null, null];

  return [toYMD(pair[0]), toYMD(pair[1])];
}

function buildDefaultPresets(enabled) {
  if (!enabled) return [];

  const today = todayYMD();
  const [monthStart, monthEnd] = monthBoundsYMD(today);
  const [previousMonthStart, previousMonthEnd] = previousMonthBoundsYMD(today);

  return [
    {
      label: "Últimos 7 dias",
      range: [addDaysYMD(today, -6), today],
    },
    {
      label: "Últimos 30 dias",
      range: [addDaysYMD(today, -29), today],
    },
    {
      label: "Este mês",
      range: [monthStart, monthEnd],
    },
    {
      label: "Mês passado",
      range: [previousMonthStart, previousMonthEnd],
    },
  ];
}

function normalizePresets({ presets, showPresets, minDate, maxDate }) {
  const defaultPresets = buildDefaultPresets(showPresets);

  const customPresets = Array.isArray(presets)
    ? presets.filter((preset) => preset?.label && Array.isArray(preset?.range))
    : [];

  return [...defaultPresets, ...customPresets].map((preset) => {
    const start = clampYMD(preset.range?.[0], minDate, maxDate);
    const end = clampYMD(preset.range?.[1], minDate, maxDate);

    return {
      label: preset.label,
      range: [start, end],
      disabled: !start || !end,
    };
  });
}

export default function DateRangePicker({
  label = "Período",
  value = [null, null],
  onChange,
  disabled = false,
  className = "",
  minDate,
  maxDate,
  showPresets = false,
  presets = [],
  allowSwap = true,
  onInvalidRange,
  placeholderStart = "Data inicial",
  placeholderEnd = "Data final",
  showClear = true,
  compact = false,
  required = false,
  helperText = "Selecione a data inicial e final do período.",
}) {
  const reactId = useId();
  const liveRef = useRef(null);

  const [statusMessage, setStatusMessage] = useState("");

  const [startValue, endValue] = normalizePair(value);

  const ids = useMemo(
    () => ({
      start: `${reactId}-inicio`,
      end: `${reactId}-fim`,
      hint: `${reactId}-hint`,
      live: `${reactId}-status`,
      presets: `${reactId}-presets`,
    }),
    [reactId]
  );

  const min = toYMD(minDate);
  const max = toYMD(maxDate);

  const allPresets = useMemo(
    () =>
      normalizePresets({
        presets,
        showPresets,
        minDate: min,
        maxDate: max,
      }),
    [max, min, presets, showPresets]
  );

  const hasValue = Boolean(startValue || endValue);
  const isInvalidRange = Boolean(startValue && endValue && startValue > endValue);

  const announce = useCallback((message) => {
    setStatusMessage("");

    window.requestAnimationFrame(() => {
      setStatusMessage(message);

      if (liveRef.current) {
        liveRef.current.textContent = message;
      }
    });
  }, []);

  const emitChange = useCallback(
    (start, end, { shouldAnnounce = true } = {}) => {
      let nextStart = clampYMD(start, min, max);
      let nextEnd = clampYMD(end, min, max);

      if (nextStart && nextEnd && nextStart > nextEnd) {
        if (!allowSwap) {
          onInvalidRange?.(nextStart, nextEnd);
          announce("Período inválido: a data inicial não pode ser maior que a data final.");
          return;
        }

        [nextStart, nextEnd] = [nextEnd, nextStart];

        if (shouldAnnounce) {
          announce("As datas foram invertidas automaticamente para manter o período válido.");
        }
      }

      onChange?.([nextStart || null, nextEnd || null]);
    },
    [allowSwap, announce, max, min, onChange, onInvalidRange]
  );

  const applyPreset = useCallback(
    (preset) => {
      if (!preset || preset.disabled) return;

      emitChange(preset.range[0], preset.range[1]);
      announce(`Preset aplicado: ${preset.label}.`);
    },
    [announce, emitChange]
  );

  const clearRange = useCallback(() => {
    emitChange("", "", { shouldAnnounce: false });
    announce("Período limpo.");
  }, [announce, emitChange]);

  const inputClass = classNames(
    "min-h-11 w-full rounded-2xl border bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400",
    "focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15",
    "disabled:cursor-not-allowed disabled:opacity-60",
    "dark:bg-slate-950 dark:text-slate-100",
    isInvalidRange
      ? "border-rose-300 dark:border-rose-800"
      : "border-slate-200 dark:border-slate-800"
  );

  return (
    <fieldset
      className={classNames(
        "w-full rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        compact && "p-3",
        disabled && "opacity-75",
        className
      )}
      disabled={disabled}
      aria-describedby={`${ids.hint} ${ids.live}`}
    >
      {label && (
        <legend className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
          <CalendarDays className="h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
          {label}
          {required && (
            <span className="text-rose-600" aria-label="obrigatório">
              *
            </span>
          )}
        </legend>
      )}

      {allPresets.length > 0 && (
        <div
          id={ids.presets}
          className="mb-3 flex flex-wrap gap-2"
          aria-label="Atalhos de período"
        >
          {allPresets.map((preset, index) => (
            <button
              key={`${preset.label}-${index}`}
              type="button"
              disabled={disabled || preset.disabled}
              onClick={() => applyPreset(preset)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-900 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950"
              aria-label={`Aplicar período: ${preset.label}`}
              title={preset.label}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {preset.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
        <label htmlFor={ids.start} className="block">
          <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {placeholderStart}
          </span>

          <input
            id={ids.start}
            name="data-inicio"
            type="date"
            value={startValue}
            onChange={(event) => emitChange(event.target.value, endValue)}
            disabled={disabled}
            min={min || undefined}
            max={endValue || max || undefined}
            required={required}
            className={inputClass}
            aria-invalid={isInvalidRange}
          />
        </label>

        <span
          className="hidden pb-3 text-sm font-black text-slate-400 dark:text-slate-500 sm:block"
          aria-hidden="true"
        >
          até
        </span>

        <label htmlFor={ids.end} className="block">
          <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {placeholderEnd}
          </span>

          <input
            id={ids.end}
            name="data-fim"
            type="date"
            value={endValue}
            onChange={(event) => emitChange(startValue, event.target.value)}
            disabled={disabled}
            min={startValue || min || undefined}
            max={max || undefined}
            required={required}
            className={inputClass}
            aria-invalid={isInvalidRange}
          />
        </label>

        {showClear && (
          <button
            type="button"
            onClick={clearRange}
            disabled={disabled || !hasValue}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Limpar período selecionado"
            title="Limpar período"
          >
            <Eraser className="h-4 w-4" aria-hidden="true" />
            Limpar
          </button>
        )}
      </div>

      <p
        id={ids.hint}
        className={classNames(
          "mt-3 text-xs font-medium",
          isInvalidRange
            ? "text-rose-700 dark:text-rose-300"
            : "text-slate-500 dark:text-slate-400"
        )}
      >
        {isInvalidRange
          ? "Período inválido: a data inicial não pode ser maior que a data final."
          : helperText}
      </p>

      <p id={ids.live} ref={liveRef} role="status" aria-live="polite" className="sr-only">
        {statusMessage}
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
  minDate: PropTypes.string,
  maxDate: PropTypes.string,
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
  showClear: PropTypes.bool,
  compact: PropTypes.bool,
  required: PropTypes.bool,
  helperText: PropTypes.string,
};