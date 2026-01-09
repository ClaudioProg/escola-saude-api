// ✅ frontend/src/components/ModalNovaTurma.jsx
import { useEffect, useId, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import TurmaDatasFieldset from "./TurmaDatasFieldset";
import { apiPost } from "../services/api";
import { toast } from "react-toastify";
import Modal from "./Modal";
import { CalendarDays, Clock3, Layers3, Timer } from "lucide-react";

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

const hhmmToMinutes = (hhmm) => {
  if (!isHHMM(hhmm)) return NaN;
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
};

const isValidInterval = (ini, fim) => {
  const a = hhmmToMinutes(ini);
  const b = hhmmToMinutes(fim);
  return Number.isFinite(a) && Number.isFinite(b) && b > a;
};

// "YYYY-MM-DD" -> "DD/MM/YYYY"
const br = (yyyy_mm_dd) => {
  if (!yyyy_mm_dd) return "";
  const s = String(yyyy_mm_dd).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
};

/** Normaliza linhas vindas do fieldset -> [{data, horario_inicio, horario_fim}] únicas e válidas */
function buildDatasValidas(rows) {
  const limpas = (rows || [])
    .map((d) => ({
      data: (d?.data || "").slice(0, 10),
      horario_inicio: parseHora(d?.horario_inicio || ""),
      horario_fim: parseHora(d?.horario_fim || ""),
    }))
    .filter(
      (d) =>
        d.data &&
        isHHMM(d.horario_inicio) &&
        isHHMM(d.horario_fim) &&
        isValidInterval(d.horario_inicio, d.horario_fim)
    );

  // dedupe por DATA (1 encontro por dia) — evita duplicidade acidental
  const seen = new Set();
  const unicas = [];
  for (const d of limpas) {
    if (!seen.has(d.data)) {
      seen.add(d.data);
      unicas.push(d);
    }
  }

  return unicas.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

function calcularCargaHorariaEstimativa(datasValidas = []) {
  // regra do seu projeto: se >= 8h no dia, desconta 1h (almoço)
  let totalMin = 0;
  for (const d of datasValidas) {
    const ini = hhmmToMinutes(d.horario_inicio);
    const fim = hhmmToMinutes(d.horario_fim);
    if (!Number.isFinite(ini) || !Number.isFinite(fim) || fim <= ini) continue;
    let diff = fim - ini;
    if (diff >= 8 * 60) diff -= 60;
    totalMin += Math.max(0, diff);
  }
  return Math.round(totalMin / 60); // horas inteiras (igual sua lógica de evento)
}

/* =========================
   Componente
========================= */

export default function ModalNovaTurma({
  isOpen = true,
  eventoId,
  onClose,
  onSaved,
}) {
  const uid = useId();
  const titleId = `titulo-nova-turma-${uid}`;
  const descId = `descricao-nova-turma-${uid}`;

  const [nome, setNome] = useState("");
  const [vagas, setVagas] = useState("");
  const [datas, setDatas] = useState([{ data: "", horario_inicio: "", horario_fim: "" }]);
  const [saving, setSaving] = useState(false);
  const [msgA11y, setMsgA11y] = useState("");

  const firstInputRef = useRef(null);

  // foco inicial ao abrir (premium)
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => firstInputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [isOpen]);

  const datasValidas = useMemo(() => buildDatasValidas(datas), [datas]);

  const minis = useMemo(() => {
    const qtd = datasValidas.length;
    const inicio = qtd ? br(datasValidas[0].data) : "—";
    const fim = qtd ? br(datasValidas[qtd - 1].data) : "—";
    const carga = qtd ? calcularCargaHorariaEstimativa(datasValidas) : 0;
    return { qtd, inicio, fim, carga };
  }, [datasValidas]);

  const canSave = useMemo(() => {
    const nomeTrim = nome.trim();
    if (!nomeTrim) return false;
    if (datasValidas.length === 0) return false;
    if (vagas !== "" && (!Number.isFinite(Number(vagas)) || Number(vagas) < 0)) return false;
    return !saving;
  }, [nome, datasValidas.length, vagas, saving]);

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
      setMsgA11y("Inclua ao menos uma data completa e válida (fim deve ser maior que início).");
      toast.error("Inclua ao menos uma data completa e válida (fim deve ser maior que início).");
      return;
    }

    if (vagas !== "" && (!Number.isFinite(Number(vagas)) || Number(vagas) < 0)) {
      setMsgA11y("Quantidade de vagas deve ser um número válido.");
      toast.error("Quantidade de vagas deve ser um número válido.");
      return;
    }

    const cargaHorariaEstimada = calcularCargaHorariaEstimativa(datasValidas);

    // Preferimos 'encontros' (padrão que você usa no front), mas também mandamos 'datas' por compat.
    const encontros = datasValidas.map((d) => ({
      data: d.data,
      inicio: d.horario_inicio, // HH:MM
      fim: d.horario_fim,       // HH:MM
    }));

    const datasPayload = datasValidas.map((d) => ({
      data: d.data,
      horario_inicio: d.horario_inicio,
      horario_fim: d.horario_fim,
    }));

    const payload = {
      evento_id: Number(eventoId),
      nome: nomeTrim,
      vagas_total: vagas !== "" ? Number(vagas) : null,
      // opcional: se o backend aceitar/usar, já vai alinhado com seus cálculos
      carga_horaria: Number.isFinite(cargaHorariaEstimada) ? cargaHorariaEstimada : null,

      encontros,
      datas: datasPayload,
    };

    try {
      setSaving(true);
      setMsgA11y("Salvando turma...");
      await apiPost("/api/turmas", payload);
      toast.success("Turma criada com sucesso!");
      setMsgA11y("Turma criada com sucesso!");
      onSaved?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      const msg = err?.data?.erro || err?.data?.mensagem || err?.message || "Erro ao criar turma.";
      setMsgA11y(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={saving ? undefined : onClose}
      labelledBy={titleId}
      describedBy={descId}
      className="w-[96%] max-w-2xl p-0 overflow-hidden"
    >
      {/* Header hero */}
      <header
        className="px-4 sm:px-6 py-4 text-white bg-gradient-to-br from-emerald-900 via-teal-800 to-lime-700"
        role="group"
        aria-label="Criação de turma"
      >
        <h3 id={titleId} className="text-xl sm:text-2xl font-extrabold tracking-tight">
          Nova Turma
        </h3>
        <p id={descId} className="text-white/90 text-sm mt-1">
          Defina nome, datas dos encontros e a quantidade de vagas.
        </p>
      </header>

      {/* Ministats */}
      <section className="px-4 sm:px-6 pt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900 p-3 shadow-sm bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-1">
            <Layers3 className="w-5 h-5" aria-hidden="true" />
            <span className="font-semibold">Encontros</span>
          </div>
          <div className="text-lg font-bold">{minis.qtd || "—"}</div>
          <div className="text-xs text-slate-600 dark:text-slate-300">Datas válidas</div>
        </div>

        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900 p-3 shadow-sm bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-5 h-5" aria-hidden="true" />
            <span className="font-semibold">Início</span>
          </div>
          <div className="text-lg font-bold">{minis.inicio}</div>
          <div className="text-xs text-slate-600 dark:text-slate-300">Primeira data</div>
        </div>

        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900 p-3 shadow-sm bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-1">
            <Clock3 className="w-5 h-5" aria-hidden="true" />
            <span className="font-semibold">Término</span>
          </div>
          <div className="text-lg font-bold">{minis.fim}</div>
          <div className="text-xs text-slate-600 dark:text-slate-300">Última data</div>
        </div>

        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900 p-3 shadow-sm bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-1">
            <Timer className="w-5 h-5" aria-hidden="true" />
            <span className="font-semibold">Carga</span>
          </div>
          <div className="text-lg font-bold">{minis.qtd ? `${minis.carga}h` : "—"}</div>
          <div className="text-xs text-slate-600 dark:text-slate-300">Estimativa</div>
        </div>
      </section>

      {/* Live region A11y */}
      <div aria-live="polite" className="sr-only">
        {msgA11y}
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="px-4 sm:px-6 pt-4 pb-24 space-y-3">
        <div>
          <label className="text-xs text-slate-600 dark:text-slate-300" htmlFor={`nome-turma-${uid}`}>
            Nome da turma
          </label>
          <input
            ref={firstInputRef}
            id={`nome-turma-${uid}`}
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
          <label className="text-xs text-slate-600 dark:text-slate-300" htmlFor={`vagas-turma-${uid}`}>
            Quantidade de vagas
          </label>
          <input
            id={`vagas-turma-${uid}`}
            type="number"
            min="0"
            className="w-full border rounded-xl px-3 py-2 dark:bg-slate-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={vagas}
            onChange={(e) => setVagas(e.target.value)}
            placeholder="ex.: 30"
            disabled={saving}
            inputMode="numeric"
          />
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Dica: pode deixar vazio se não quiser limitar vagas.
          </p>
        </div>
      </form>

      {/* Footer sticky */}
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
          type="submit"
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={!canSave}
          aria-busy={saving ? "true" : "false"}
          title={!canSave ? "Preencha nome e ao menos uma data válida." : "Salvar turma"}
        >
          {saving ? "Salvando..." : "Salvar Turma"}
        </button>
      </div>
    </Modal>
  );
}

ModalNovaTurma.propTypes = {
  isOpen: PropTypes.bool,
  eventoId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onClose: PropTypes.func,
  onSaved: PropTypes.func,
};
