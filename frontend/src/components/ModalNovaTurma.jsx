// frontend/src/components/ModalNovaTurma.jsx
import { useState } from "react";
import PropTypes from "prop-types";
import TurmaDatasFieldset from "./TurmaDatasFieldset";
import { apiPost } from "../services/api";
import { toast } from "react-toastify";
import Modal from "./Modal"; // ✅ usa o modal reutilizável (Esc, foco, acessível)

/* =========================
   Helpers de horário/data
   ========================= */

// Retorna "HH:MM" válida OU "" (sem fallback!)
const parseHora = (val) => {
  if (typeof val !== "string") return "";
  const s = val.trim();
  if (!s) return "";

  // "0800" -> "08:00"
  if (/^\d{3,4}$/.test(s)) {
    const raw = s.length === 3 ? "0" + s : s;
    const H = raw.slice(0, 2);
    const M = raw.slice(2, 4);
    const hh = String(Math.min(23, Math.max(0, parseInt(H || "0", 10)))).padStart(2, "0");
    const mm = String(Math.min(59, Math.max(0, parseInt(M || "0", 10)))).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  // "8:0", "08:00", "08:00:00"
  const m = s.match(/^(\d{1,2})(?::?(\d{1,2}))?(?::?(\d{1,2}))?$/);
  if (!m) return "";
  const H = Math.min(23, Math.max(0, parseInt(m[1] || "0", 10)));
  const M = Math.min(59, Math.max(0, parseInt(m[2] || "0", 10)));
  const hh = String(H).padStart(2, "0");
  const mm = String(M).padStart(2, "0");
  return `${hh}:${mm}`;
};

const isHHMM = (s) => typeof s === "string" && /^\d{2}:\d{2}$/.test(s.trim());

/** Normaliza linhas vindas do fieldset -> [{data, horario_inicio, horario_fim}] únicas e válidas */
function buildDatasValidas(rows) {
  const limpas = (rows || [])
    .map((d) => ({
      data: (d?.data || "").slice(0, 10),
      horario_inicio: parseHora(d?.horario_inicio || ""),
      horario_fim: parseHora(d?.horario_fim || ""),
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
  return unicas.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

/* =========================
   Componente
   ========================= */

export default function ModalNovaTurma({ eventoId, onClose, onSaved }) {
  const [nome, setNome] = useState("");
  const [vagas, setVagas] = useState("");
  const [datas, setDatas] = useState([{ data: "", horario_inicio: "", horario_fim: "" }]);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;

    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      toast.error("Informe o nome da turma.");
      return;
    }

    const datasValidas = buildDatasValidas(datas);
    if (datasValidas.length === 0) {
      toast.error("Inclua ao menos uma data completa (data, início e fim).");
      return;
    }

    if (vagas && (!Number.isFinite(Number(vagas)) || Number(vagas) < 0)) {
      toast.error("Quantidade de vagas deve ser um número válido.");
      return;
    }

    // Backend aceita 'encontros' OU 'datas'. Preferimos 'encontros' para consistência do projeto.
    const payload = {
      evento_id: Number(eventoId),
      nome: nomeTrim,
      vagas_total: vagas ? Number(vagas) : null,
      encontros: datasValidas.map((d) => ({
        data: d.data,
        inicio: d.horario_inicio, // HH:MM
        fim: d.horario_fim,       // HH:MM
      })),
    };

    try {
      setSaving(true);
      await apiPost("/api/turmas", payload);
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
    <Modal open={true} onClose={onClose}>
      <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-200 mb-3">
        Nova Turma
      </h3>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-300">Nome da turma</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2 dark:bg-zinc-800 dark:text-white"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome da turma"
          />
        </div>

        <TurmaDatasFieldset value={datas} onChange={setDatas} />

        <div>
          <label className="text-xs text-gray-600 dark:text-gray-300">Quantidade de vagas</label>
          <input
            type="number"
            min="0"
            className="w-full border rounded px-3 py-2 dark:bg-zinc-800 dark:text-white"
            value={vagas}
            onChange={(e) => setVagas(e.target.value)}
            placeholder="ex.: 30"
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          className="px-4 py-2 rounded border border-gray-300 text-gray-700 dark:text-white dark:border-gray-600"
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
    </Modal>
  );
}

ModalNovaTurma.propTypes = {
  eventoId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onClose: PropTypes.func,
  onSaved: PropTypes.func,
};
