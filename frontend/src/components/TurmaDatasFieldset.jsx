import { useId } from "react";
import PropTypes from "prop-types";
import { Plus, Trash2 } from "lucide-react";

export default function TurmaDatasFieldset({ value, onChange }) {
  const idBase = useId();

  const addRow = () => {
    onChange([...(value || []), { data: "", horario_inicio: "", horario_fim: "" }]);
  };

  const removeRow = (idx) => {
    const arr = [...value];
    arr.splice(idx, 1);
    onChange(arr);
  };

  const updateRow = (idx, field, v) => {
    const arr = [...value];
    arr[idx] = { ...arr[idx], [field]: v };
    onChange(arr);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="font-semibold text-sm text-gray-700">Datas da turma</label>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 text-sm px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Plus size={16}/> Adicionar data
        </button>
      </div>

      {(value?.length ? value : [{ data: "", horario_inicio: "", horario_fim: "" }]).map((row, i) => (
        <div key={`${idBase}-${i}`} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-4">
            <label className="text-xs text-gray-600">Data</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              value={row.data || ""}
              onChange={(e) => updateRow(i, "data", e.target.value)}
              required
            />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-gray-600">Início</label>
            <input
              type="time"
              className="w-full border rounded px-3 py-2"
              value={(row.horario_inicio || "").slice(0,5)}
              onChange={(e) => updateRow(i, "horario_inicio", e.target.value)}
              required
            />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-gray-600">Fim</label>
            <input
              type="time"
              className="w-full border rounded px-3 py-2"
              value={(row.horario_fim || "").slice(0,5)}
              onChange={(e) => updateRow(i, "horario_fim", e.target.value)}
              required
            />
          </div>
          <div className="col-span-2 flex">
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="ml-auto inline-flex items-center gap-1 px-3 py-2 rounded border text-red-700 border-red-300 hover:bg-red-50"
              disabled={(value?.length || 1) === 1}
              title="Remover esta data"
            >
              <Trash2 size={16}/> Remover
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

TurmaDatasFieldset.propTypes = {
  value: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
};
