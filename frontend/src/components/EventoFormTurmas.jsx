// ✅ src/components/eventos/EventoFormTurmas.jsx
import React, { useRef, useState } from "react";
import PropTypes from "prop-types";
import ModalTurma from "./ModalTurma";
import { Trash2, Pencil, Plus } from "lucide-react";

/* ------------------------------------------------------------------ *
 * Utils de data/apresentação
 * ------------------------------------------------------------------ */
const isISODate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

const iso = (s) => (isISODate(s) ? s.slice(0, 10) : "");
const br = (s) => (isISODate(s) ? s.split("-").reverse().join("/") : s || "");

const listaDatas = (encontros = []) => {
  const ds = (Array.isArray(encontros) ? encontros : [])
    .map((e) => (typeof e === "string" ? iso(e) : iso(e?.data)))
    .filter(Boolean)
    .map(br);
  if (ds.length <= 2) return ds.join(" e ");
  return `${ds.slice(0, -1).join(", ")} e ${ds.at(-1)}`;
};

/* ------------------------------------------------------------------ *
 * Normalização/validação de horários
 * ------------------------------------------------------------------ */
function hhmmOrNull(v) {
  if (!v || typeof v !== "string") return null;
  const s = v.slice(0, 5);
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  // normaliza 7:5 → 07:05
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

const toTime = (d) => (isISODate(d) ? new Date(`${d}T00:00:00`).getTime() : Number.POSITIVE_INFINITY);

/* ------------------------------------------------------------------ *
 * Payload seguro p/ backend
 * ------------------------------------------------------------------ */
export const buildTurmasPayload = (turmas = []) =>
  (Array.isArray(turmas) ? turmas : []).map((t) => {
    // Normaliza encontros (obj {data,inicio,fim}) e filtra os sem data
    const encontrosArr = (Array.isArray(t.encontros) ? t.encontros : [])
      .map((e) =>
        typeof e === "string"
          ? { data: iso(e) }
          : { data: iso(e?.data), inicio: hhmmOrNull(e?.inicio), fim: hhmmOrNull(e?.fim) }
      )
      .filter((e) => isISODate(e.data))
      .sort((a, b) => toTime(a.data) - toTime(b.data));

    const first = encontrosArr[0];
    const last = encontrosArr[encontrosArr.length - 1];

    const data_inicio =
      iso(t.data_inicio) || (first ? first.data : null);

    const data_fim =
      iso(t.data_fim) || (last ? last.data : null);

    const horario_inicio = hhmmOrNull(t.horario_inicio);
    const horario_fim = hhmmOrNull(t.horario_fim);

    // números (não-negativos)
    const vagas_total_raw =
      t?.vagas_total ?? t?.vagas_totais ?? t?.vagas ?? t?.capacidade ?? 0;
    const vagas_total_num = Number.isFinite(Number(vagas_total_raw)) ? Math.max(0, Math.trunc(Number(vagas_total_raw))) : 0;

    const carga_horaria_raw = t?.carga_horaria ?? t?.carga_total ?? 0;
    const carga_horaria_num = Number.isFinite(Number(carga_horaria_raw)) ? Math.max(0, Number(carga_horaria_raw)) : 0;

    return {
      // mantenha id se existir (útil para edições)
      id: t?.id ?? undefined,
      nome: (t.nome || "").trim(),
      data_inicio: data_inicio || null,
      data_fim: data_fim || null,
      horario_inicio: horario_inicio || null,
      horario_fim: horario_fim || null,
      vagas_total: vagas_total_num,
      carga_horaria: carga_horaria_num,
      encontros: encontrosArr.map((e) => ({
        data: e.data,
        // fallback para horário global da turma se encontro não tiver
        inicio: e.inicio || horario_inicio || null,
        fim: e.fim || horario_fim || null,
      })),
    };
  });

/* ------------------------------------------------------------------ *
 * Componente
 * ------------------------------------------------------------------ */
export default function EventoFormTurmas({ turmas = [], setTurmas }) {
  const [open, setOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [initial, setInitial] = useState(null);
  const addBtnRef = useRef(null);
  const srLiveRef = useRef(null);

  const addTurma = (t) => setTurmas((arr) => [...arr, t]);
  const rmTurma = (idx) => {
    setTurmas((arr) => arr.filter((_, i) => i !== idx));
    // devolve foco para o botão "Adicionar Turma" após remoção
    setTimeout(() => addBtnRef.current?.focus(), 0);
  };

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

  // Atualiza aria-live com a contagem (ajuda screen readers)
  const announceCount = (count) => {
    if (!srLiveRef.current) return;
    srLiveRef.current.textContent = `${count} turma${count === 1 ? "" : "s"} listada${count === 1 ? "" : "s"}.`;
  };

  return (
    <>
      {/* Região "live" invisível para leitores de tela */}
      <p ref={srLiveRef} className="sr-only" aria-live="polite" />

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-green-900 dark:text-green-200">
            Turmas Cadastradas
          </h4>

          <button
            type="button"
            ref={addBtnRef}
            onClick={startCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-green-900 text-white shadow-sm hover:brightness-110 focus-visible:ring-2 focus-visible:ring-green-600"
            aria-label="Adicionar nova turma"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Adicionar Turma
          </button>
        </div>

        {(() => {
          // avisa sempre que renderiza com nova quantidade
          requestAnimationFrame(() => announceCount(turmas.length));
          return null;
        })()}

        {turmas.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
            Nenhuma turma adicionada ainda.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {turmas.map((t, i) => {
              const di = br(iso(t.data_inicio || t?.encontros?.[0]?.data || ""));
              const df = br(iso(t.data_fim || t?.encontros?.[t.encontros?.length - 1]?.data || ""));
              const hi = hhmmOrNull(t.horario_inicio) || "--:--";
              const hf = hhmmOrNull(t.horario_fim) || "--:--";
              const totalVagas = Number.isFinite(Number(t.vagas_total)) ? Number(t.vagas_total) : 0;
              const ch = Number.isFinite(Number(t.carga_horaria)) ? Number(t.carga_horaria) : 0;
              const encontrosQtd = Array.isArray(t.encontros) ? t.encontros.length : 0;

              // chave estável: prefira id; senão, derive de dados principais + índice como fallback
              const key =
                t.id ??
                `${t.nome || "turma"}-${iso(t.data_inicio) || "di"}-${iso(t.data_fim) || "df"}-${i}`;

              return (
                <div
                  key={key}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 sm:p-4 flex items-start justify-between gap-3"
                  aria-label={`Turma ${t.nome || i + 1}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate" title={t.nome || "Turma"}>
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
        initial={initial} // 👈 permite editar preenchendo o modal
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

EventoFormTurmas.propTypes = {
  turmas: PropTypes.arrayOf(PropTypes.object),
  setTurmas: PropTypes.func.isRequired,
};
