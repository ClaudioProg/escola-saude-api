// 📁 src/components/DateRangePicker.jsx
import PropTypes from "prop-types";
import { useId, useMemo, useRef, useState, useCallback } from "react";

/** Formata Date → "YYYY-MM-DD" no FUSO LOCAL, sem shift de UTC */
function toLocalYMD(v) {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Normaliza valor de prop (Date | ISO | null) → string "YYYY-MM-DD" */
function normalizePair(value) {
  const a = Array.isArray(value) ? value : [null, null];
  return [toLocalYMD(a[0]), toLocalYMD(a[1])];
}

/** Compara strings YYYY-MM-DD sem criar Date (estável e rápido) */
function isAfter(a, b) {
  if (!a || !b) return false;
  return a > b; // lexical funciona para YYYY-MM-DD
}

export default function DateRangePicker({
  label = "Período",
  value = [null, null],
  onChange,
  disabled = false,
  className = "",
}) {
  const groupId = useId();
  const [inicioProp, fimProp] = normalizePair(value);

  // estado de mensagem a11y quando ocorre auto-ajuste
  const [statusMsg, setStatusMsg] = useState("");
  const liveRef = useRef(null);

  const ids = useMemo(
    () => ({
      start: `${groupId}-start`,
      end: `${groupId}-end`,
      hint: `${groupId}-hint`,
      status: `${groupId}-status`,
    }),
    [groupId]
  );

  const announce = useCallback((msg) => {
    setStatusMsg(msg);
    // força re-leitura mesmo se o mesmo texto repetir
    requestAnimationFrame(() => {
      if (liveRef.current) {
        liveRef.current.textContent = "";
        requestAnimationFrame(() => {
          if (liveRef.current) liveRef.current.textContent = msg;
        });
      }
    });
  }, []);

  /** Dispara onChange mantendo ordem cronológica (início ≤ fim) */
  const setRange = useCallback(
    (start, end, announceSwap = true) => {
      let s = start || "";
      let e = end || "";

      if (s && e && isAfter(s, e)) {
        // auto-inverte para manter coesão
        const tmp = s;
        s = e;
        e = tmp;
        if (announceSwap) announce("Datas invertidas automaticamente para manter o período válido.");
      }

      onChange?.([s || null, e || null]);
    },
    [onChange, announce]
  );

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

      <div className="flex items-center gap-2">
        <input
          id={ids.start}
          name="data-inicio"
          type="date"
          value={inicioProp}
          onChange={(e) => setRange(e.target.value, fimProp)}
          aria-label="Data inicial"
          disabled={disabled}
          max={fimProp || undefined} // evita selecionar início > fim
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
          onChange={(e) => setRange(inicioProp, e.target.value)}
          aria-label="Data final"
          disabled={disabled}
          min={inicioProp || undefined} // evita selecionar fim < início
          className="
            flex-1 p-2 rounded-md border border-gray-300
            dark:border-gray-600 dark:bg-zinc-800 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-green-600
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        />

        {/* Botão limpar (opcional, não quebra API) */}
        <button
          type="button"
          onClick={() => setRange("", "", false)}
          disabled={disabled || (!inicioProp && !fimProp)}
          className="
            shrink-0 px-3 py-2 rounded-md text-xs font-medium
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

      {/* Região de status para leitores de tela */}
      <p
        id={ids.status}
        ref={liveRef}
        role="status"
        aria-live="polite"
        className="sr-only"
      >
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
};
