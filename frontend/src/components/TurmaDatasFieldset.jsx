// 📁 src/components/TurmaDatasFieldset.jsx
import { useId, useMemo } from "react";
import PropTypes from "prop-types";
import { Plus, Trash2 } from "lucide-react";

export default function TurmaDatasFieldset({ value, onChange, className = "" }) {
  const idBase = useId();

  // Garante pelo menos uma linha visível
  const rows = useMemo(() => {
    if (Array.isArray(value) && value.length > 0) return value;
    return [{ data: "", horario_inicio: "", horario_fim: "" }];
  }, [value]);

  /* ─────────────── helpers ─────────────── */

  // Normaliza "H", "HH", "H:MM", "HHMM", "8:0" etc → "HH:MM"
  const toHHMM = (raw) => {
    if (typeof raw !== "string") return "";
    const s = raw.trim();
    if (!s) return "";

    // "800" | "08:00" | "8:0" | "08:00:00"
    if (/^\d{3,4}$/.test(s)) {
      const pad = s.length === 3 ? "0" + s : s;
      const H = pad.slice(0, 2);
      const M = pad.slice(2, 4);
      return `${String(Math.min(23, +H)).padStart(2, "0")}:${String(Math.min(59, +M)).padStart(2, "0")}`;
    }

    const m = s.match(/^(\d{1,2})(?::?(\d{1,2}))?(?::?\d{1,2})?$/);
    if (!m) return "";
    const H = String(Math.min(23, parseInt(m[1] || "0", 10))).padStart(2, "0");
    const M = String(Math.min(59, parseInt(m[2] || "0", 10))).padStart(2, "0");
    return `${H}:${M}`;
  };

  const toMinutes = (hhmm) => {
    const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm));
    if (!m) return NaN;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  };

  const horarioInvalido = (ini, fim) => {
    const a = toMinutes(toHHMM(ini));
    const b = toMinutes(toHHMM(fim));
    return Number.isFinite(a) && Number.isFinite(b) && b < a; // fim deve ser ≥ ini
  };

  /* ─────────────── mutações ─────────────── */

  const setRows = (next) => onChange(Array.isArray(next) ? next : []);

  const addRow = () => {
    const base = Array.isArray(value) ? value : [];
    const last = base[base.length - 1] || {};
    setRows([
      ...base,
      {
        data: "",
        horario_inicio: toHHMM(last.horario_inicio || ""),
        horario_fim: toHHMM(last.horario_fim || ""),
      },
    ]);
  };

  const removeRow = (idx) => {
    const arr = [...rows];
    arr.splice(idx, 1);
    setRows(arr.length ? arr : [{ data: "", horario_inicio: "", horario_fim: "" }]);
  };

  const updateRow = (idx, field, v) => {
    const arr = [...rows];
    const val =
      field === "horario_inicio" || field === "horario_fim"
        ? toHHMM(v)
        : String(v || "").slice(0, 10); // data "YYYY-MM-DD"
    arr[idx] = { ...arr[idx], [field]: val };
    setRows(arr);
  };

  const podeRemover = rows.length > 1;

  return (
    <fieldset className={`space-y-3 ${className}`}>
      <legend className="sr-only">Datas da turma</legend>

      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">
          Datas da turma
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
            ({rows.length} {rows.length > 1 ? "linhas" : "linha"})
          </span>
        </span>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 text-sm px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-700/40"
        >
          <Plus size={16} /> Adicionar data
        </button>
      </div>

      {rows.map((row, i) => {
        const dataId = `${idBase}-data-${i}`;
        const iniId = `${idBase}-ini-${i}`;
        const fimId = `${idBase}-fim-${i}`;
        const msgId = `${idBase}-msg-${i}`;

        const dataVal = row?.data || "";
        const iniVal = toHHMM(row?.horario_inicio || "");
        const fimVal = toHHMM(row?.horario_fim || "");
        const isInvalid = horarioInvalido(iniVal, fimVal);

        return (
          <div key={`${idBase}-${i}`} className="grid grid-cols-12 gap-2 items-end">
            {/* Data */}
            <div className="col-span-12 sm:col-span-4">
              <label htmlFor={dataId} className="text-xs text-gray-600 dark:text-gray-300">
                Data
              </label>
              <input
                id={dataId}
                type="date"
                className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white border-gray-300 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-700/40"
                value={dataVal}
                onChange={(e) => updateRow(i, "data", e.target.value)}
                required
              />
            </div>

            {/* Início */}
            <div className="col-span-6 sm:col-span-3">
              <label htmlFor={iniId} className="text-xs text-gray-600 dark:text-gray-300">
                Início
              </label>
              <input
                id={iniId}
                type="time"
                step={300}
                className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white border-gray-300 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-700/40"
                value={iniVal}
                onChange={(e) => updateRow(i, "horario_inicio", e.target.value)}
                required
                aria-invalid={isInvalid}
                aria-describedby={isInvalid ? msgId : undefined}
              />
            </div>

            {/* Fim */}
            <div className="col-span-6 sm:col-span-3">
              <label htmlFor={fimId} className="text-xs text-gray-600 dark:text-gray-300">
                Fim
              </label>
              <input
                id={fimId}
                type="time"
                step={300}
                className={`w-full border rounded px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white border-gray-300 dark:border-zinc-600 focus:outline-none focus:ring-2 ${
                  isInvalid ? "focus:ring-red-600/40 border-red-400" : "focus:ring-green-700/40"
                }`}
                value={fimVal}
                onChange={(e) => updateRow(i, "horario_fim", e.target.value)}
                required
                aria-invalid={isInvalid}
                aria-describedby={isInvalid ? msgId : undefined}
              />
            </div>

            {/* Ação remover */}
            <div className="col-span-12 sm:col-span-2 flex">
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="ml-auto inline-flex items-center gap-1 px-3 py-2 rounded border text-red-700 border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!podeRemover}
                title={podeRemover ? "Remover esta data" : "Mantenha ao menos uma data"}
                aria-disabled={!podeRemover}
              >
                <Trash2 size={16} /> Remover
              </button>
            </div>

            {/* Mensagem de erro de horário */}
            {isInvalid && (
              <p id={msgId} className="col-span-12 text-xs text-red-600 dark:text-red-400 -mt-1">
                O horário de término deve ser maior ou igual ao horário de início.
              </p>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}

TurmaDatasFieldset.propTypes = {
  value: PropTypes.arrayOf(
    PropTypes.shape({
      data: PropTypes.string,           // "YYYY-MM-DD"
      horario_inicio: PropTypes.string, // "HH:MM"
      horario_fim: PropTypes.string,    // "HH:MM"
    })
  ).isRequired,
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string,
};
