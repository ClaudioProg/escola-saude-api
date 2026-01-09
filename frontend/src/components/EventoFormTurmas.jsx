// ✅ src/components/EventoFormTurmas.jsx (Premium Plus)
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import ModalTurma from "./ModalTurma";
import ModalConfirmacao from "./ModalConfirmacao";
import { Trash2, Pencil, Plus, CalendarDays, Clock3, Users, Layers, ArrowUpDown } from "lucide-react";

/* ------------------------------------------------------------------ *
 * Utils de data/apresentação (sem fuso/shift)
 * Aceita "YYYY-MM-DD" ou ISO completo "YYYY-MM-DDTHH:mm..."
 * ------------------------------------------------------------------ */
const getYMD = (s) => {
  if (typeof s !== "string") return "";
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
};
const isISODate = (s) => !!getYMD(s);
const iso = (s) => getYMD(s);

const br = (s) => {
  const ymd = getYMD(String(s || ""));
  if (!ymd) return "";
  const [Y, M, D] = ymd.split("-");
  return `${D}/${M}/${Y}`;
};

function hhmmOrNull(v) {
  if (!v || typeof v !== "string") return null;
  const m = v.match(/^(\d{1,2}):(\d{1,2})(?::\d{2})?$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function ymdToTime(ymd) {
  const s = iso(ymd);
  if (!s) return Number.POSITIVE_INFINITY;
  const [Y, M, D] = s.split("-").map((x) => parseInt(x, 10));
  if (!Number.isFinite(Y) || !Number.isFinite(M) || !Number.isFinite(D)) return Number.POSITIVE_INFINITY;
  return new Date(Y, (M || 1) - 1, D || 1, 12, 0, 0, 0).getTime(); // meio-dia local
}

// status de turma por janela (di/df + hi/hf)
function getStatusTurma({ di, df, hi, hf, agora = new Date() }) {
  const diISO = iso(di);
  const dfISO = iso(df);
  if (!diISO || !dfISO) return "Programada";

  const [Y1, M1, D1] = diISO.split("-").map((x) => parseInt(x, 10));
  const [Y2, M2, D2] = dfISO.split("-").map((x) => parseInt(x, 10));
  const [h1, m1] = String(hi || "00:00").split(":").map((x) => parseInt(x || "0", 10));
  const [h2, m2] = String(hf || "23:59").split(":").map((x) => parseInt(x || "0", 10));

  const start = new Date(Y1, (M1 || 1) - 1, D1 || 1, Number.isFinite(h1) ? h1 : 0, Number.isFinite(m1) ? m1 : 0, 0, 0);
  const end = new Date(Y2, (M2 || 1) - 1, D2 || 1, Number.isFinite(h2) ? h2 : 23, Number.isFinite(m2) ? m2 : 59, 59, 999);

  if (Number.isNaN(+start) || Number.isNaN(+end)) return "Programada";
  if (agora < start) return "Programada";
  if (agora > end) return "Encerrada";
  return "Em andamento";
}

function statusBadgeClass(status) {
  if (status === "Em andamento")
    return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/25 dark:text-amber-200 dark:border-amber-800";
  if (status === "Encerrada")
    return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/25 dark:text-rose-200 dark:border-rose-800";
  return "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-200 dark:border-emerald-800";
}

function topBarByStatus(status) {
  if (status === "Em andamento") return "from-amber-600 via-orange-500 to-yellow-400";
  if (status === "Encerrada") return "from-rose-700 via-red-600 to-orange-500";
  return "from-emerald-700 via-emerald-600 to-teal-500";
}

const listaDatas = (encontros = []) => {
  const ds = (Array.isArray(encontros) ? encontros : [])
    .map((e) => (typeof e === "string" ? iso(e) : iso(e?.data)))
    .filter(Boolean)
    .map((d) => {
      const [Y, M, D] = d.split("-");
      return `${D}/${M}/${Y}`;
    });
  if (ds.length <= 2) return ds.join(" e ");
  return `${ds.slice(0, -1).join(", ")} e ${ds.at(-1)}`;
};

/* ------------------------------------------------------------------ *
 * Componente
 * ------------------------------------------------------------------ */
export default function EventoFormTurmas({ turmas = [], setTurmas }) {
  const [open, setOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null); // índice real no array original
  const [initial, setInitial] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState(null);

  const addBtnRef = useRef(null);
  const srLiveRef = useRef(null);

  const addTurma = useCallback((t) => setTurmas((arr) => [...arr, t]), [setTurmas]);

  const startCreate = useCallback(() => {
    setInitial(null);
    setEditIndex(null);
    setOpen(true);
  }, []);

  const startEdit = useCallback(
    (originalIndex) => {
      if (!Number.isInteger(originalIndex) || originalIndex < 0) return;
      setInitial(turmas[originalIndex] || null);
      setEditIndex(originalIndex);
      setOpen(true);
    },
    [turmas]
  );

  const applySave = useCallback(
    (t) => {
      if (editIndex == null) addTurma(t);
      else setTurmas((arr) => arr.map((item, i) => (i === editIndex ? t : item)));
    },
    [editIndex, addTurma, setTurmas]
  );

  const requestRemove = useCallback((idx) => {
    if (!Number.isInteger(idx) || idx < 0) return;
    setPendingRemoveIndex(idx);
    setConfirmOpen(true);
  }, []);

  const doRemove = useCallback(async () => {
    const idx = pendingRemoveIndex;
    if (!Number.isInteger(idx) || idx < 0) return false;

    setTurmas((arr) => arr.filter((_, i) => i !== idx));

    setConfirmOpen(false);
    setPendingRemoveIndex(null);

    setTimeout(() => addBtnRef.current?.focus(), 0);
    return true;
  }, [pendingRemoveIndex, setTurmas]);

  // live region contagem
  useEffect(() => {
    if (srLiveRef.current) {
      const count = turmas.length;
      srLiveRef.current.textContent = `${count} turma${count === 1 ? "" : "s"} listada${count === 1 ? "" : "s"}.`;
    }
  }, [turmas.length]);

  // lista ordenada mantendo índice original
  const turmasOrdenadas = useMemo(() => {
    const withIndex = (turmas || []).map((t, originalIndex) => ({ t, originalIndex }));
    withIndex.sort((a, b) => {
      const adi = iso(a.t?.data_inicio || a.t?.encontros?.[0]?.data || "");
      const bdi = iso(b.t?.data_inicio || b.t?.encontros?.[0]?.data || "");
      const ta = ymdToTime(adi);
      const tb = ymdToTime(bdi);
      if (ta === tb) return a.originalIndex - b.originalIndex;
      return ta - tb;
    });
    return withIndex;
  }, [turmas]);

  // detectar se ordem atual difere da “natural”
  const isOutOfOrder = useMemo(() => {
    if (!turmasOrdenadas.length) return false;
    const ord = turmasOrdenadas.map((x) => x.originalIndex).join(",");
    const natural = (turmas || []).map((_, i) => i).join(",");
    return ord !== natural;
  }, [turmasOrdenadas, turmas]);

  const ordenarAgora = useCallback(() => {
    // reordena o array real conforme a ordenação atual calculada
    const next = turmasOrdenadas.map(({ t }) => t);
    setTurmas(next);
    setTimeout(() => addBtnRef.current?.focus(), 0);
  }, [turmasOrdenadas, setTurmas]);

  const onCardKeyDown = useCallback(
    (e, originalIndex) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        requestRemove(originalIndex);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        startEdit(originalIndex);
      }
    },
    [requestRemove, startEdit]
  );

  return (
    <>
      <p ref={srLiveRef} className="sr-only" aria-live="polite" />

      <div className="mt-4">
        {/* Header premium (título + ações) */}
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              Turmas Cadastradas
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Enter para editar • Delete para remover • Mobile-first
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            {isOutOfOrder && (
              <button
                type="button"
                onClick={ordenarAgora}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 shadow-sm hover:shadow-md transition focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label="Ordenar turmas por data"
                title="Ordenar por data"
              >
                <ArrowUpDown className="w-4 h-4" aria-hidden="true" />
                Ordenar por data
              </button>
            )}

            <button
              type="button"
              ref={addBtnRef}
              onClick={startCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-white shadow-md hover:shadow-xl hover:brightness-[1.03] transition focus-visible:ring-2 focus-visible:ring-emerald-400"
              aria-label="Adicionar nova turma"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Adicionar Turma
            </button>
          </div>
        </div>

        {turmasOrdenadas.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Nenhuma turma adicionada ainda.
            </p>
          </div>
        ) : (
          <ul role="list" className="mt-3 space-y-3">
            {turmasOrdenadas.map(({ t, originalIndex }) => {
              const diISO = iso(t.data_inicio || t?.encontros?.[0]?.data || "");
              const dfISO = iso(t.data_fim || t?.encontros?.[t.encontros?.length - 1]?.data || "");

              const hi = hhmmOrNull(t.horario_inicio) || "--:--";
              const hf = hhmmOrNull(t.horario_fim) || "--:--";

              const totalVagas = Number.isFinite(Number(t.vagas_total)) ? Number(t.vagas_total) : 0;
              const ch = Number.isFinite(Number(t.carga_horaria)) ? Number(t.carga_horaria) : 0;
              const encontrosQtd = Array.isArray(t.encontros) ? t.encontros.length : 0;

              const status = getStatusTurma({
                di: diISO,
                df: dfISO,
                hi: hi !== "--:--" ? hi : "00:00",
                hf: hf !== "--:--" ? hf : "23:59",
              });

              const key =
                t.id ??
                `${t.nome || "turma"}-${diISO || "di"}-${dfISO || "df"}-${originalIndex}`;

              const periodoLabel =
                diISO && dfISO ? `${br(diISO)} a ${br(dfISO)}` : "Datas a definir";

              return (
                <li key={key} role="listitem">
                  <article
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => onCardKeyDown(e, originalIndex)}
                    onClick={() => startEdit(originalIndex)}
                    aria-label={`Turma ${t.nome || originalIndex + 1}. Pressione Enter para editar ou Delete para remover.`}
                    className={[
                      "relative rounded-3xl overflow-hidden",
                      "border border-zinc-200/80 dark:border-zinc-800",
                      "bg-white dark:bg-neutral-900",
                      "shadow-[0_10px_30px_-20px_rgba(0,0,0,0.35)] hover:shadow-[0_18px_50px_-28px_rgba(0,0,0,0.55)]",
                      "transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                      "cursor-pointer",
                    ].join(" ")}
                  >
                    {/* barra premium por status */}
                    <div className={`h-1.5 w-full bg-gradient-to-r ${topBarByStatus(status)}`} />

                    {/* glow sutil */}
                    <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-fuchsia-500/10 blur-3xl" />

                    <div className="relative p-4 sm:p-5">
                      {/* topo: título + badge status */}
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="min-w-0">
                          <h5
                            className="text-lg font-extrabold tracking-tight text-zinc-900 dark:text-white truncate"
                            title={t.nome || "Turma"}
                          >
                            {t.nome || "Turma"}
                          </h5>

                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                            <MiniStat icon={CalendarDays} label="Período" value={periodoLabel} />
                            <MiniStat icon={Clock3} label="Horário" value={`${hi}–${hf}`} />
                            <MiniStat icon={Layers} label="Encontros" value={`${encontrosQtd}`} />
                            <MiniStat icon={Users} label="Vagas" value={`${totalVagas}`} />
                          </div>

                          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                            {ch ? (
                              <>
                                Carga horária: <span className="font-semibold text-zinc-900 dark:text-white">{ch}h</span>
                              </>
                            ) : (
                              "Carga horária: —"
                            )}
                          </div>

                          {encontrosQtd > 0 && (
                            <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                              <span className="font-semibold">Datas:</span> {listaDatas(t.encontros)}
                            </div>
                          )}
                        </div>

                        <div
                          className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full border ${statusBadgeClass(
                            status
                          )}`}
                          title="Status calculado automaticamente"
                          aria-label={`Status: ${status}`}
                        >
                          {status}
                        </div>
                      </div>

                      {/* ações */}
                      <div
                        className="mt-4 flex flex-wrap gap-2 justify-end"
                        role="group"
                        aria-label={`Ações da turma ${t.nome || originalIndex + 1}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm font-extrabold
                                     bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100
                                     hover:brightness-110 focus-visible:ring-2 focus-visible:ring-emerald-500 transition"
                          onClick={() => startEdit(originalIndex)}
                          aria-label={`Editar turma ${t.nome || originalIndex + 1}`}
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                          Editar
                        </button>

                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm font-extrabold
                                     bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200
                                     hover:brightness-110 focus-visible:ring-2 focus-visible:ring-rose-500 transition"
                          onClick={() => requestRemove(originalIndex)}
                          aria-label={`Remover turma ${t.nome || originalIndex + 1}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                          Remover
                        </button>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Modal criação/edição */}
      <ModalTurma
        open={open}
        initial={initial}
        onClose={() => {
          setOpen(false);
          setInitial(null);
          setEditIndex(null);
        }}
        onSave={(turma) => {
          applySave(turma);
          setOpen(false);
          setInitial(null);
          setEditIndex(null);
        }}
      />

      {/* Confirmação premium */}
      <ModalConfirmacao
        isOpen={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setPendingRemoveIndex(null);
        }}
        onConfirmar={doRemove}
        titulo="Remover turma"
        mensagem={
          <div className="space-y-2">
            <p>Tem certeza que deseja remover esta turma?</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Esta ação remove a turma da lista do formulário. Se a turma já existir no backend, a remoção real depende do fluxo
              de salvar/atualizar o evento.
            </p>
          </div>
        }
        textoBotaoConfirmar="Sim, remover"
        textoBotaoCancelar="Cancelar"
        variant="danger"
        level={2}
      />
    </>
  );
}

/* ======================== MiniStat ======================== */
function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/40 backdrop-blur px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="grid place-items-center w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800">
          <Icon className="w-4 h-4 text-zinc-700 dark:text-zinc-200" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{label}</div>
          <div className="text-sm font-extrabold text-zinc-900 dark:text-white truncate">{value}</div>
        </div>
      </div>
    </div>
  );
}

MiniStat.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
};

EventoFormTurmas.propTypes = {
  turmas: PropTypes.arrayOf(PropTypes.object),
  setTurmas: PropTypes.func.isRequired,
};
