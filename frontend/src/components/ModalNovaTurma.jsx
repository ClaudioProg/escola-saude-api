// frontend/src/components/ModalNovaTurma.jsx
import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import TurmaDatasFieldset from "./TurmaDatasFieldset";
import { apiPost } from "../services/api";
import { toast } from "react-toastify";
import Modal from "./Modal"; // ✅ usa o modal reutilizável (Esc, foco, acessível)
import { CalendarDays, Clock3, Layers3 } from "lucide-react";

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

const br = (yyyy_mm_dd) => {
  if (!yyyy_mm_dd) return "";
  const s = String(yyyy_mm_dd).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
};

/* =========================
   Componente
   ========================= */

export default function ModalNovaTurma({ eventoId, onClose, onSaved }) {
  const [nome, setNome] = useState("");
  const [vagas, setVagas] = useState("");
  const [datas, setDatas] = useState([{ data: "", horario_inicio: "", horario_fim: "" }]);
  const [saving, setSaving] = useState(false);
  const [msgA11y, setMsgA11y] = useState("");

  const datasValidas = useMemo(() => buildDatasValidas(datas), [datas]);

  const minis = useMemo(() => {
    const qtd = datasValidas.length;
    const inicio = qtd ? br(datasValidas[0].data) : "—";
    const fim = qtd ? br(datasValidas[qtd - 1].data) : "—";
    return { qtd, inicio, fim };
  }, [datasValidas]);

  async function handleSave(e) {
    e?.preventDefault?.();
    if (saving) return;

    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      setMsgA11y("Informe o nome da turma.");
      toast.error("Informe o nome da turma.");
      return;
    }

    if (datasValidas.length === 0) {
      setMsgA11y("Inclua ao menos uma data completa (data, início e fim).");
      toast.error("Inclua ao menos uma data completa (data, início e fim).");
      return;
    }

    if (vagas && (!Number.isFinite(Number(vagas)) || Number(vagas) < 0)) {
      setMsgA11y("Quantidade de vagas deve ser um número válido.");
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
      setMsgA11y("Salvando turma...");
      await apiPost("/api/turmas", payload);
      toast.success("Turma criada com sucesso!");
      setMsgA11y("Turma criada com sucesso!");
      onSaved?.();
      onClose?.();
    } catch (e) {
      console.error(e);
      const msg = e?.data?.erro || e?.message || "Erro ao criar turma.";
      setMsgA11y(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={true}
      onClose={saving ? undefined : onClose} // bloqueia fechar durante salvamento
      labelledBy="titulo-nova-turma"
      describedBy="descricao-nova-turma"
      className="w-[96%] max-w-2xl p-0 overflow-hidden"
    >
      {/* Header hero (altura/tipografia padrão; degradê 3 cores exclusivo) */}
      <header
        className="px-4 sm:px-6 py-4 text-white bg-gradient-to-br from-emerald-900 via-teal-800 to-lime-700"
        role="group"
        aria-label="Criação de turma"
      >
        <h3 id="titulo-nova-turma" className="text-xl sm:text-2xl font-extrabold tracking-tight">
          Nova Turma
        </h3>
        <p id="descricao-nova-turma" className="text-white/90 text-sm mt-1">
          Defina nome, datas dos encontros e a quantidade de vagas.
        </p>
      </header>

      {/* Ministats */}
      <section className="px-4 sm:px-6 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900 p-3 shadow-sm bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-1">
            <Layers3 className="w-5 h-5" aria-hidden="true" />
            <span className="font-semibold">Encontros</span>
          </div>
          <div className="text-lg font-bold">{minis.qtd || "—"}</div>
          <div className="text-xs text-slate-600 dark:text-slate-300">Total adicionados</div>
        </div>

        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900 p-3 shadow-sm bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-5 h-5" aria-hidden="true" />
            <span className="font-semibold">Início</span>
          </div>
          <div className="text-lg font-bold">{minis.inicio}</div>
          <div className="text-xs text-slate-600 dark:text-slate-300">Primeira data válida</div>
        </div>

        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900 p-3 shadow-sm bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-1">
            <Clock3 className="w-5 h-5" aria-hidden="true" />
            <span className="font-semibold">Término</span>
          </div>
          <div className="text-lg font-bold">{minis.fim}</div>
          <div className="text-xs text-slate-600 dark:text-slate-300">Última data válida</div>
        </div>
      </section>

      {/* Live region A11y */}
      <div aria-live="polite" className="sr-only">
        {msgA11y}
      </div>

      {/* Formulário */}
      <form onSubmit={handleSave} className="px-4 sm:px-6 pt-4 pb-24 space-y-3">
        <div>
          <label className="text-xs text-slate-600 dark:text-slate-300">Nome da turma</label>
          <input
            type="text"
            className="w-full border rounded-xl px-3 py-2 dark:bg-slate-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome da turma"
            disabled={saving}
            autoComplete="off"
          />
        </div>

        <TurmaDatasFieldset value={datas} onChange={setDatas} disabled={saving} />

        <div>
          <label className="text-xs text-slate-600 dark:text-slate-300">Quantidade de vagas</label>
          <input
            type="number"
            min="0"
            className="w-full border rounded-xl px-3 py-2 dark:bg-slate-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={vagas}
            onChange={(e) => setVagas(e.target.value)}
            placeholder="ex.: 30"
            disabled={saving}
            inputMode="numeric"
          />
        </div>
      </form>

      {/* Rodapé sticky (excelente no mobile) */}
      <div className="sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-end gap-2">
        <button
          type="button"
          className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-60"
          onClick={onClose}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
          onClick={handleSave}
          disabled={saving}
          aria-busy={saving ? "true" : "false"}
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
