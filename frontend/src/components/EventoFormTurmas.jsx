// ✅ src/components/eventos/EventoFormTurmas.jsx
import React, { useState } from "react";
import ModalTurma from "./ModalTurma";
import { Trash2, Pencil, Plus } from "lucide-react";

/* ----------------------- Utils de data/apresentação ----------------------- */
const iso = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const br = (s) => (s ? s.split("-").reverse().join("/") : "");
const listaDatas = (encontros = []) => {
  const ds = encontros.map((e) => br(typeof e === "string" ? e : e?.data));
  if (ds.length <= 2) return ds.join(" e ");
  return `${ds.slice(0, -1).join(", ")} e ${ds.at(-1)}`;
};

/* ------------------------- Normalização de horários ----------------------- */
function hhmmOrNull(v) {
  if (!v || typeof v !== "string") return null;
  const s = v.slice(0, 5);
  return /^\d{2}:\d{2}$/.test(s) ? s : null;
}

/* ------------------------ Payload seguro p/ backend ----------------------- */
export const buildTurmasPayload = (turmas = []) =>
  (Array.isArray(turmas) ? turmas : []).map((t) => {
    // Normaliza e ordena encontros (YYYY-MM-DD asc)
    const encontrosArr = Array.isArray(t.encontros) ? [...t.encontros] : [];
    encontrosArr.sort((a, b) =>
      String(typeof a === "string" ? a : a?.data || "").localeCompare(
        String(typeof b === "string" ? b : b?.data || "")
      )
    );

    const firstDate = encontrosArr[0];
    const lastDate = encontrosArr[encontrosArr.length - 1];

    const data_inicio =
      t.data_inicio ||
      (firstDate ? (typeof firstDate === "string" ? firstDate : firstDate.data) : null);

    const data_fim =
      t.data_fim ||
      (lastDate ? (typeof lastDate === "string" ? lastDate : lastDate.data) : null);

    const horario_inicio = hhmmOrNull(t.horario_inicio);
    const horario_fim = hhmmOrNull(t.horario_fim);

    const vagas_total = Math.max(0, Number.isFinite(+t.vagas_total) ? +t.vagas_total : 0);
    const carga_horaria = Math.max(0, Number.isFinite(+t.carga_horaria) ? +t.carga_horaria : 0);

    return {
      nome: (t.nome || "").trim(),
      data_inicio,
      data_fim,
      horario_inicio,
      horario_fim,
      vagas_total,
      carga_horaria,
      encontros: encontrosArr.map((e) => {
        const data = typeof e === "string" ? e : e?.data;
        const inicio = hhmmOrNull(typeof e === "string" ? t.horario_inicio : e?.inicio) || horario_inicio;
        const fim = hhmmOrNull(typeof e === "string" ? t.horario_fim : e?.fim) || horario_fim;
        return { data, inicio, fim };
      }),
    };
  });

/* -------------------------------- Componente ------------------------------ */
export default function EventoFormTurmas({ turmas = [], setTurmas }) {
  const [open, setOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [initial, setInitial] = useState(null);

  const addTurma = (t) => setTurmas((arr) => [...arr, t]);
  const rmTurma = (idx) =>
    setTurmas((arr) => arr.filter((_, i) => i !== idx));

  const startCreate = () => {
    setInitial(null);
    setEditIdx(null);
    setOpen(true);
  };

  const startEdit = (idx) => {
    setInitial(turmas[idx]);
    setEditIdx(idx);
    setOpen(true);
  };

  const applySave = (t) => {
    if (editIdx == null) {
      addTurma(t);
    } else {
      setTurmas((arr) => arr.map((item, i) => (i === editIdx ? t : item)));
    }
  };

  return (
    <>
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-green-900 dark:text-green-200">
            Turmas Cadastradas
          </h4>

          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-green-900 text-white shadow-sm hover:brightness-110 focus-visible:ring-2 focus-visible:ring-green-600"
            aria-label="Adicionar nova turma"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Adicionar Turma
          </button>
        </div>

        {turmas.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
            Nenhuma turma adicionada ainda.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {turmas.map((t, i) => {
              const di = br(iso(t.data_inicio || t?.encontros?.[0]?.data || ""));
              const df = br(iso(t.data_fim || t?.encontros?.[t.encontros.length - 1]?.data || ""));
              const hi = hhmmOrNull(t.horario_inicio) || "--:--";
              const hf = hhmmOrNull(t.horario_fim) || "--:--";
              const totalVagas = Number(t.vagas_total) || 0;
              const ch = Number(t.carga_horaria) || 0;
              const encontrosQtd = t.encontros?.length || 0;

              return (
                <div
                  key={`${t.nome || "turma"}-${i}`}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 sm:p-4 flex items-start justify-between gap-3"
                  aria-label={`Turma ${t.nome || i + 1}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {t.nome || "Turma"}
                    </div>

                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      {di && df ? `${di} a ${df}` : "Datas a definir"}
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      {hi} às {hf}
                    </div>

                    <div className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                      <strong>{encontrosQtd} encontro(s):</strong>{" "}
                      {encontrosQtd ? listaDatas(t.encontros) : "—"}
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {totalVagas} vagas • {ch}h
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-green-600"
                      onClick={() => startEdit(i)}
                      title="Editar turma"
                      aria-label={`Editar turma ${t.nome || i + 1}`}
                    >
                      <Pencil className="w-4 h-4" />
                      Editar
                    </button>

                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-rose-500"
                      onClick={() => rmTurma(i)}
                      title="Remover turma"
                      aria-label={`Remover turma ${t.nome || i + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                      Remover
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de criação/edição */}
      <ModalTurma
        open={open}
        initial={initial}         // 👈 permite editar preenchendo o modal
        onClose={() => {
          setOpen(false);
          setInitial(null);
          setEditIdx(null);
        }}
        onSave={(turma) => {
          applySave(turma);
          setOpen(false);
          setInitial(null);
          setEditIdx(null);
        }}
      />
    </>
  );
}
