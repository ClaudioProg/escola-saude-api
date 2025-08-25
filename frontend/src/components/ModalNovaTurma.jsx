// frontend/src/components/ModalNovaTurma.jsx
import { useState } from "react";
import PropTypes from "prop-types";
import TurmaDatasFieldset from "./TurmaDatasFieldset";
import { apiPost } from "../services/api";
import { toast } from "react-toastify";

const isHHMM = (s) => typeof s === "string" && /^\d{2}:\d{2}$/.test(s.trim());
const hhmm = (s) => {
  if (typeof s !== "string") return "";
  const v = s.trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(v)) return v.slice(0, 5);
  if (/^\d{3,4}$/.test(v)) {
    const pad = v.padStart(4, "0");
    return `${pad.slice(0, 2)}:${pad.slice(2, 4)}`;
  }
  return "";
};

export default function ModalNovaTurma({ eventoId, onClose, onSaved }) {
  const [nome, setNome] = useState("");
  const [vagas, setVagas] = useState("");
  const [datas, setDatas] = useState([{ data: "", horario_inicio: "", horario_fim: "" }]);
  const [saving, setSaving] = useState(false);

  function buildDatasValidas(rows) {
    const limpas = (rows || [])
      .map((d) => ({
        data: (d?.data || "").slice(0, 10),
        horario_inicio: hhmm(d?.horario_inicio),
        horario_fim: hhmm(d?.horario_fim),
      }))
      .filter((d) => d.data && isHHMM(d.horario_inicio) && isHHMM(d.horario_fim));

    const seen = new Set();
    const unicas = [];
    for (const d of limpas) {
      const key = `${d.data}-${d.horario_inicio}-${d.horario_fim}`;
      if (!seen.has(key)) {
        seen.add(key);
        unicas.push(d);
      }
    }
    return unicas;
  }

  async function handleSave() {
    if (saving) return;

    const datasValidas = buildDatasValidas(datas);
    if (!nome.trim()) return toast.error("Informe o nome da turma.");
    if (datasValidas.length === 0)
      return toast.error("Inclua ao menos uma data completa (data, início e fim).");

    // ⇩⇩ Se quiser manter 'datas', troque 'encontros' por 'datas' e os campos 'inicio/fim' por 'horario_inicio/horario_fim'
    const payload = {
      evento_id: Number(eventoId),
      nome: nome.trim(),
      vagas_total: vagas ? Number(vagas) : null,
      encontros: datasValidas.map((d) => ({
        data: d.data,
        inicio: d.horario_inicio, // HH:MM
        fim: d.horario_fim,       // HH:MM
      })),
    };

    try {
      setSaving(true);
      await apiPost("/api/turmas", payload); // backend aceita 'encontros' OU 'datas'
      toast.success("Turma criada com sucesso!");
      onSaved?.();
      onClose?.();
    } catch (e) {
      console.error(e);
      const msg = e?.data?.erro || e?.message || "Erro ao criar turma.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-5">
        <h3 className="text-lg font-bold text-emerald-800 mb-3">Nova Turma</h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-600">Nome da turma</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome da turma"
            />
          </div>

          <TurmaDatasFieldset value={datas} onChange={setDatas} />

          <div>
            <label className="text-xs text-gray-600">Quantidade de vagas</label>
            <input
              type="number"
              min="0"
              className="w-full border rounded px-3 py-2"
              value={vagas}
              onChange={(e) => setVagas(e.target.value)}
              placeholder="ex.: 30"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="px-4 py-2 rounded border border-gray-300 text-gray-700"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar Turma"}
          </button>
        </div>
      </div>
    </div>
  );
}

ModalNovaTurma.propTypes = {
  eventoId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onClose: PropTypes.func,
  onSaved: PropTypes.func,
};
