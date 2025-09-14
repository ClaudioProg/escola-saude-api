// 📁 src/components/TurmaDatasFieldset.jsx
import { useId } from "react";
import PropTypes from "prop-types";
import { Plus, Trash2 } from "lucide-react";

export default function TurmaDatasFieldset({ value, onChange, className = "" }) {
  const idBase = useId();
  const rows = Array.isArray(value) && value.length > 0
    ? value
    : [{ data: "", horario_inicio: "", horario_fim: "" }];

  const addRow = () => {
    const next = [
      ...(Array.isArray(value) ? value : []),
      { data: "", horario_inicio: "", horario_fim: "" },
    ];
    onChange(next);
  };

  const removeRow = (idx) => {
    const arr = [...rows];
    arr.splice(idx, 1);
    onChange(arr);
  };

  const updateRow = (idx, field, v) => {
    const arr = [...rows];
    arr[idx] = { ...arr[idx], [field]: v };
    onChange(arr);
  };

  // Validação simples: fim >= início, comparando strings "HH:MM"
  const isHoraInvalida = (ini, fim) =>
    Boolean(ini && fim && String(fim).slice(0, 5) < String(ini).slice(0, 5));

  // Opcional: restringir a data mínima para hoje (mantém datas-only como string)
  // const hoje = new Date();
  // const yyyy = hoje.getFullYear();
  // const mm = String(hoje.getMonth() + 1).padStart(2, "0");
  // const dd = String(hoje.getDate()).padStart(2, "0");
  // const minDate = `${yyyy}-${mm}-${dd}`;

  const podeRemover = rows.length > 1;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="font-semibold text-sm text-gray-700 dark:text-gray-200">
          Datas da turma
        </label>
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
        const iniVal = (row?.horario_inicio || "").slice(0, 5);
        const fimVal = (row?.horario_fim || "").slice(0, 5);

        const horaInvalida = isHoraInvalida(iniVal, fimVal);

        return (
          <div key={`${idBase}-${i}`} className="grid grid-cols-12 gap-2 items-end">
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
                // min={minDate} // habilite se quiser bloquear datas passadas
              />
            </div>

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
                aria-invalid={horaInvalida}
                aria-describedby={horaInvalida ? msgId : undefined}
              />
            </div>

            <div className="col-span-6 sm:col-span-3">
              <label htmlFor={fimId} className="text-xs text-gray-600 dark:text-gray-300">
                Fim
              </label>
              <input
                id={fimId}
                type="time"
                step={300}
                className={`w-full border rounded px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white border-gray-300 dark:border-zinc-600 focus:outline-none focus:ring-2 ${
                  horaInvalida ? "focus:ring-red-600/40 border-red-400" : "focus:ring-green-700/40"
                }`}
                value={fimVal}
                onChange={(e) => updateRow(i, "horario_fim", e.target.value)}
                required
                aria-invalid={horaInvalida}
                aria-describedby={horaInvalida ? msgId : undefined}
              />
            </div>

            <div className="col-span-12 sm:col-span-2 flex">
              <button
                type="button"
                onClick={() => removeRow(i)}
                className={`ml-auto inline-flex items-center gap-1 px-3 py-2 rounded border text-red-700 border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed`}
                disabled={!podeRemover}
                title={podeRemover ? "Remover esta data" : "Mantenha ao menos uma data"}
              >
                <Trash2 size={16} /> Remover
              </button>
            </div>

            {horaInvalida && (
              <p
                id={msgId}
                className="col-span-12 text-xs text-red-600 dark:text-red-400 -mt-1"
              >
                O horário de término deve ser maior ou igual ao horário de início.
              </p>
            )}
          </div>
        );
      })}
    </div>
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
