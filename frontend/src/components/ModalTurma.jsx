/* eslint-disable no-console */
// 📁 src/components/ModalTurma.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Clock, Hash, Type, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import ModalBase from "./ModalBase";

/* ===================== Helpers ===================== */
const NOME_TURMA_MAX = 100;

const parseHora = (val) => {
  if (typeof val !== "string") return "";
  const s = val.trim();
  if (!s) return "";
  if (/^\d{3,4}$/.test(s)) {
    const raw = s.length === 3 ? "0" + s : s;
    const hh = String(Math.min(23, Math.max(0, parseInt(raw.slice(0, 2) || "0", 10)))).padStart(2, "0");
    const mm = String(Math.min(59, Math.max(0, parseInt(raw.slice(2, 4) || "0", 10)))).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  const m = s.match(/^(\d{1,2})(?::?(\d{1,2}))?(?::?(\d{1,2}))?$/);
  if (!m) return "";
  const H = Math.min(23, Math.max(0, parseInt(m[1] || "0", 10)));
  const M = Math.min(59, Math.max(0, parseInt(m[2] || "0", 10)));
  return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`;
};
const hhmm = (s, fb = "") => parseHora(s) || fb;

const isoDay = (v) => {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  try { return new Date(v).toISOString().slice(0, 10); } catch { return ""; }
};

const calcularCargaHorariaTotal = (arr) => {
  let horas = 0;
  for (const e of arr) {
    const [h1, m1] = hhmm(e.inicio, "00:00").split(":").map(Number);
    const [h2, m2] = hhmm(e.fim, "00:00").split(":").map(Number);
    const diffH = Math.max(0, (h2 * 60 + (m2 || 0) - (h1 * 60 + (m1 || 0))) / 60);
    horas += diffH >= 8 ? diffH - 1 : diffH;
  }
  return Math.round(horas);
};

const datasParaEncontros = (t) => {
  const baseHi = hhmm(t?.horario_inicio, "08:00");
  const baseHf = hhmm(t?.horario_fim, "17:00");
  if (!Array.isArray(t?.datas)) return null;
  const arr = t.datas
    .map((d) => ({ data: isoDay(d?.data), inicio: hhmm(d?.horario_inicio, baseHi), fim: hhmm(d?.horario_fim, baseHf) }))
    .filter((x) => x.data);
  return arr.length ? arr : null;
};

const encontrosDoInitial = (t) => {
  if (!t) return [{ data: "", inicio: "", fim: "" }];
  if (Array.isArray(t.encontros) && t.encontros.length) {
    const baseHi = hhmm(t?.horario_inicio, "08:00");
    const baseHf = hhmm(t?.horario_fim, "17:00");
    return t.encontros
      .map((e) => ({ data: isoDay(e?.data || e), inicio: hhmm(e?.inicio, baseHi), fim: hhmm(e?.fim, baseHf) }))
      .filter((x) => x.data);
  }
  const conv = datasParaEncontros(t);
  if (conv) return conv;
  return [{ data: "", inicio: "", fim: "" }];
};

/* ===================== Componente ===================== */
export default function ModalTurma({ isOpen, onClose, onSalvar, initialTurma = null, onExcluir }) {
  // estados controlados pelo usuário (não devem ser sobrescritos enquanto digita)
  const [nome, setNome] = useState("");
  const [vagasTotal, setVagasTotal] = useState("");
  const [encontros, setEncontros] = useState([{ data: "", inicio: "", fim: "" }]);

  // hidratar apenas ao ABRIR (ou quando muda o id)
  const refHydratedOpen = useRef(false);
  const initialKey = String(initialTurma?.id ?? "new");

  useEffect(() => {
    if (isOpen && !refHydratedOpen.current) {
      setNome(initialTurma?.nome || "");
      setVagasTotal(initialTurma?.vagas_total != null ? String(initialTurma.vagas_total) : "");
      setEncontros(encontrosDoInitial(initialTurma));
      refHydratedOpen.current = true;
      setTimeout(() => autosizeNome(), 0);
    }
    if (!isOpen) {
      refHydratedOpen.current = false; // permite reidratar quando abrir novamente
    }
    // reidrata se trocar de turma (id diferente) enquanto aberto
  }, [isOpen, initialKey]); // ← NÃO depende do objeto inteiro

  // auto-resize do título
  const refNome = useRef(null);
  const autosizeNome = () => {
    const el = refNome.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const encontrosOrdenados = useMemo(() => {
    const norm = [...(encontros || [])]
      .map((e) => ({ ...e, data: isoDay(e.data), inicio: hhmm(e.inicio, ""), fim: hhmm(e.fim, "") }))
      .filter((e) => e.data)
      .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
    return norm;
  }, [encontros]);

  const data_inicio = encontrosOrdenados[0]?.data || null;
  const data_fim = encontrosOrdenados.at(-1)?.data || null;
  const carga_horaria_preview = calcularCargaHorariaTotal(
    encontrosOrdenados.filter((e) => e.data && e.inicio && e.fim)
  );

  /* CRUD encontros */
  const addEncontro = () => {
    const last = encontros[encontros.length - 1] || {};
    setEncontros((prev) => [...prev, { data: "", inicio: hhmm(last.inicio, ""), fim: hhmm(last.fim, "") }]);
  };
  const removeEncontro = (idx) => {
    setEncontros((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };
  const updateEncontro = (idx, field, value) => {
    setEncontros((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  };

  /* validação/salvar */
  const validar = () => {
    if (!nome.trim()) return toast.warning("Informe o nome da turma."), false;
    if (nome.length > NOME_TURMA_MAX) return toast.error(`O nome não pode exceder ${NOME_TURMA_MAX} caracteres.`), false;
    if (vagasTotal === "" || Number(vagasTotal) <= 0 || !Number.isFinite(Number(vagasTotal)))
      return toast.warning("Quantidade de vagas deve ser número ≥ 1."), false;
    if (!encontrosOrdenados.length) return toast.warning("Inclua pelo menos uma data de encontro."), false;

    for (let i = 0; i < encontrosOrdenados.length; i++) {
      const e = encontrosOrdenados[i];
      if (!e.data || !e.inicio || !e.fim) return toast.error(`Preencha data e horários do encontro #${i + 1}.`), false;
      const [h1, m1] = hhmm(e.inicio, "00:00").split(":").map(Number);
      const [h2, m2] = hhmm(e.fim, "00:00").split(":").map(Number);
      if (h2 * 60 + (m2 || 0) <= h1 * 60 + (m1 || 0))
        return toast.error(`Horários inválidos no encontro #${i + 1}.`), false;
    }
    return true;
  };

  const montarPayload = () => {
    const horario_inicio_base = hhmm(encontrosOrdenados[0]?.inicio, "08:00");
    const horario_fim_base = hhmm(encontrosOrdenados[0]?.fim, "17:00");
    return {
      ...(initialTurma?.id ? { id: initialTurma.id } : {}),
      nome: nome.trim(),
      vagas_total: Number(vagasTotal),
      carga_horaria: calcularCargaHorariaTotal(encontrosOrdenados),
      data_inicio,
      data_fim,
      horario_inicio: horario_inicio_base,
      horario_fim: horario_fim_base,
      encontros: encontrosOrdenados.map((e) => ({ data: e.data, inicio: hhmm(e.inicio, horario_inicio_base), fim: hhmm(e.fim, horario_fim_base) })),
      datas: encontrosOrdenados.map((e) => ({ data: e.data, horario_inicio: hhmm(e.inicio, horario_inicio_base), horario_fim: hhmm(e.fim, horario_fim_base) })),
    };
  };

  const handleSalvar = () => {
    if (!validar()) return;
    onSalvar?.(montarPayload());
    if (!initialTurma) {
      setNome("");
      setVagasTotal("");
      setEncontros([{ data: "", inicio: "", fim: "" }]);
      setTimeout(autosizeNome, 0);
    }
  };

  const titleId = "modal-turma-title";
  const descId = "modal-turma-desc";

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      level={1}
      maxWidth="max-w-2xl"
      labelledBy={titleId}
      describedBy={descId}
      className="p-0 overflow-hidden"
    >
      <div className="flex flex-col max-h-[90vh] bg-white dark:bg-zinc-900">
        <header className="px-5 py-4 text-white bg-gradient-to-br from-teal-900 via-indigo-800 to-violet-700" role="group" aria-label="Edição de turma">
          <h2 id={titleId} className="text-xl sm:text-2xl font-extrabold tracking-tight">
            {initialTurma ? "Editar Turma" : "Nova Turma"}
          </h2>
          <p id={descId} className="text-white/90 text-sm mt-1">
            Defina nome, encontros e vagas. A carga horária é estimada automaticamente.
          </p>
        </header>

        <section className="px-5 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 p-3 shadow-sm bg-white dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-300 mb-1">Período</div>
            <div className="text-sm font-semibold">
              {data_inicio && data_fim ? `${data_inicio.split("-").reverse().join("/")} — ${data_fim.split("-").reverse().join("/")}` : "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 p-3 shadow-sm bg-white dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-300 mb-1">Encontros</div>
            <div className="text-sm font-semibold">{encontrosOrdenados.length || "—"}</div>
          </div>
          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 p-3 shadow-sm bg-white dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-300 mb-1">Carga estimada</div>
            <div className="text-sm font-semibold">{carga_horaria_preview ? `${carga_horaria_preview}h` : "—"}</div>
          </div>
        </section>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSalvar();
          }}
          className="px-5 pt-4 pb-24 overflow-y-auto max-h-[60vh] bg-white dark:bg-zinc-900"
        >
          {/* Nome */}
          <div className="relative mb-4">
            <Type className="absolute left-3 top-3 text-slate-500" size={18} aria-hidden />
            <textarea
              ref={refNome}
              data-initial-focus
              value={nome}
              onChange={(e) => {
                const v = e.target.value.slice(0, NOME_TURMA_MAX);
                setNome(v);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              placeholder="Nome da turma"
              maxLength={NOME_TURMA_MAX}
              rows={2}
              className="w-full pl-10 pr-14 py-2 border rounded-xl shadow-sm dark:bg-zinc-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[56px] max-h-[200px] overflow-y-auto resize-none"
              autoComplete="off"
              aria-describedby="nome-turma-help nome-turma-count"
            />
            <div
              id="nome-turma-count"
              className={`absolute right-3 top-2 text-xs ${nome.length >= NOME_TURMA_MAX * 0.9 ? "text-amber-600" : "text-slate-500"}`}
            >
              {nome.length}/{NOME_TURMA_MAX}
            </div>
            <p id="nome-turma-help" className="mt-1 text-xs text-slate-500">
              Máximo de {NOME_TURMA_MAX} caracteres.
            </p>
          </div>

          {/* Encontros */}
          <div className="space-y-3">
            <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">Encontros</div>
            {encontros.map((e, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-3 text-slate-500" size={18} aria-hidden />
                  <input
                    type="date"
                    value={isoDay(e.data)}
                    onChange={(ev) => updateEncontro(idx, "data", ev.target.value)}
                    className="w-full pl-10 py-2 border rounded-xl shadow-sm dark:bg-zinc-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 text-slate-500" size={18} aria-hidden />
                  <input
                    type="time"
                    value={hhmm(e.inicio, "")}
                    onChange={(ev) => updateEncontro(idx, "inicio", ev.target.value)}
                    className="w-full pl-10 py-2 border rounded-xl shadow-sm dark:bg-zinc-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 text-slate-500" size={18} aria-hidden />
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={hhmm(e.fim, "")}
                      onChange={(ev) => updateEncontro(idx, "fim", ev.target.value)}
                      className="w-full pl-10 py-2 border rounded-xl shadow-sm dark:bg-zinc-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                    {encontros.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEncontro(idx)}
                        className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200 dark:hover:bg-rose-900/30"
                        title="Remover este encontro"
                      >
                        <Trash2 size={16} aria-hidden />
                        <span className="sr-only">Remover encontro {idx + 1}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-center">
              <button
                type="button"
                onClick={addEncontro}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-full transition"
              >
                <PlusCircle size={16} />
                Adicionar data
              </button>
            </div>
          </div>

          {/* Vagas */}
          <div className="relative mt-5">
            <Hash className="absolute left-3 top-3 text-slate-500" size={18} aria-hidden />
            <input
              type="number"
              value={vagasTotal}
              onChange={(e) => setVagasTotal(e.target.value)}
              placeholder="Quantidade de vagas"
              className="w-full pl-10 py-2 border rounded-xl shadow-sm dark:bg-zinc-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              min={1}
              required
              inputMode="numeric"
            />
          </div>
        </form>

        <div className="mt-auto sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-5 py-3 flex justify-between gap-3">
          <div className="min-w-[1.5rem]">
            {initialTurma?.id && onExcluir ? (
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition"
                onClick={onExcluir}
                title="Excluir turma"
              >
                <Trash2 size={16} />
                Excluir turma
              </button>
            ) : null}
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition" type="button">
              Cancelar
            </button>
            <button onClick={handleSalvar} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition" type="button">
              Salvar Turma
            </button>
          </div>
        </div>
      </div>
    </ModalBase>
  );
}
