// ✅ src/components/eventos/EventoFormTurmas.jsx
import React, { useState } from "react";
import ModalTurma from "./ModalTurma";

const iso = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const br = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
const listaDatas = (encontros = []) => {
  const ds = encontros.map((e) => br(typeof e === "string" ? e : e.data));
  if (ds.length <= 2) return ds.join(" e ");
  return `${ds.slice(0, -1).join(", ")} e ${ds.at(-1)}`;
};

// Use isso ao enviar o formulário do evento (POST/PUT)
export const buildTurmasPayload = (turmas = []) =>
  turmas.map((t) => ({
    nome: t.nome,
    data_inicio: t.data_inicio || (t.encontros?.[0]?.data ? t.encontros[0].data : null),
    data_fim:
      t.data_fim ||
      (t.encontros?.length ? t.encontros[t.encontros.length - 1].data : null),
    horario_inicio: t.horario_inicio,
    horario_fim: t.horario_fim,
    vagas_total: Number(t.vagas_total) || 0,
    carga_horaria: Number(t.carga_horaria) || 0,
    encontros: (t.encontros || []).map((e) => ({
      data: typeof e === "string" ? e : e.data,
      inicio: typeof e === "string" ? t.horario_inicio : e.inicio || t.horario_inicio,
      fim: typeof e === "string" ? t.horario_fim : e.fim || t.horario_fim,
    })),
  }));

export default function EventoFormTurmas({ turmas, setTurmas }) {
  const [open, setOpen] = useState(false);

  const addTurma = (t) => setTurmas((arr) => [...arr, t]);
  const rmTurma = (idx) => setTurmas((arr) => arr.filter((_, i) => i !== idx));

  return (
    <>
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">Turmas Cadastradas</h4>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="px-4 py-2 rounded bg-emerald-600 text-white"
          >
            + Adicionar Turma
          </button>
        </div>

        {turmas.length === 0 ? (
          <p className="text-sm text-slate-500 mt-2">Nenhuma turma adicionada ainda.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {turmas.map((t, i) => (
              <div
                key={i}
                className="rounded-xl border p-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">{t.nome}</div>
                  <div className="text-sm text-slate-600">
                    {br(iso(t.data_inicio))} a {br(iso(t.data_fim))}
                  </div>
                  <div className="text-sm text-slate-600">
                    {t.horario_inicio} às {t.horario_fim}
                  </div>

                  <div className="text-sm text-slate-700 mt-1">
                    <strong>{t.encontros?.length || 0} encontro(s):</strong>{" "}
                    {t.encontros?.length ? listaDatas(t.encontros) : "—"}
                  </div>

                  <div className="text-xs text-slate-500 mt-1">
                    {Number(t.vagas_total) || 0} vagas •{" "}
                    {Number(t.carga_horaria) || 0}h
                  </div>
                </div>

                <div className="flex gap-2">
                  {/* (Opcional) botão para editar: abrir o modal com initial=t e substituir no índice i */}
                  {/* <button className="px-3 py-1 rounded border">Editar</button> */}
                  <button
                    type="button"
                    className="px-3 py-1 rounded bg-rose-100 text-rose-700"
                    onClick={() => rmTurma(i)}
                    title="Remover turma"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModalTurma
        open={open}
        onClose={() => setOpen(false)}
        onSave={(turma) => {
          addTurma(turma);
        }}
      />
    </>
  );
}
