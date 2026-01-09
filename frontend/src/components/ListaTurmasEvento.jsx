// ✅ frontend/src/components/ListaTurmasEvento.jsx (premium polish + perf + date-safe)
/* eslint-disable no-console */
import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  CalendarDays,
  Clock3,
  Users,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/* ========================== Helpers ========================== */
const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, n));

const toPct = (num, den) => {
  const n = Number(num) || 0;
  const d = Number(den) || 0;
  return d <= 0 ? 0 : clamp(Math.round((n / d) * 100));
};

const pad2 = (s) => String(s ?? "").padStart(2, "0");

// "0800" → "08:00"; "8:0" → "08:00"; "08:00:00" → "08:00"
const parseHora = (val) => {
  if (typeof val !== "string") return null;
  const s = val.trim();
  if (!s) return null;

  if (/^\d{3,4}$/.test(s)) {
    const raw = s.length === 3 ? "0" + s : s;
    const H = raw.slice(0, 2);
    const M = raw.slice(2, 4);
    const hh = String(Math.min(23, Math.max(0, parseInt(H || "0", 10)))).padStart(2, "0");
    const mm = String(Math.min(59, Math.max(0, parseInt(M || "0", 10)))).padStart(2, "0");
    return hh === "00" && mm === "00" ? null : `${hh}:${mm}`;
  }

  const m = s.match(/^(\d{1,2})(?::?(\d{1,2}))?(?::?(\d{1,2}))?$/);
  if (!m) return null;
  const H = Math.min(23, Math.max(0, parseInt(m[1] || "0", 10)));
  const M = Math.min(59, Math.max(0, parseInt(m[2] || "0", 10)));
  const hh = String(H).padStart(2, "0");
  const mm = String(M).padStart(2, "0");
  return hh === "00" && mm === "00" ? null : `${hh}:${mm}`;
};

const isDateOnly = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

// YYYY-MM-DD (LOCAL) a partir de Date (evita timezone shift)
const ymdLocal = (d) => {
  if (!(d instanceof Date) || Number.isNaN(+d)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Converte qualquer entrada em "YYYY-MM-DD" sem parse UTC perigoso
const isoDiaLocal = (v) => {
  if (!v) return "";

  // objetos {data: ...}
  if (typeof v === "object" && v?.data) {
    if (v.data instanceof Date) return ymdLocal(v.data);
    if (typeof v.data === "string") return v.data.slice(0, 10);
    return "";
  }

  // Date
  if (v instanceof Date) return ymdLocal(v);

  // string
  if (typeof v === "string") {
    // se já for YYYY-MM-DD, usa direto
    if (isDateOnly(v)) return v;
    // se for ISO completo, pega o dia sem depender do Date()
    // ex: "2026-01-09T12:00:00Z" -> "2026-01-09"
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
    // fallback conservador (se vier "2026/01/09", etc.)
    const m = v.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
  }

  // número/qualquer outra coisa: NÃO faz new Date(v) (pode virar UTC shift)
  return "";
};

const br = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

// Se todos os encontros tiverem o mesmo hi/hf, retorna; senão null
const extrairHorasDeEncontros = (encontrosInline) => {
  const his = new Set();
  const hfs = new Set();

  (encontrosInline || []).forEach((e) => {
    const hi = parseHora((typeof e === "object" && (e.inicio || e.horario_inicio)) || null);
    const hf = parseHora((typeof e === "object" && (e.fim || e.horario_fim)) || null);
    if (hi) his.add(hi);
    if (hf) hfs.add(hf);
  });

  return {
    hi: his.size === 1 ? [...his][0] : null,
    hf: hfs.size === 1 ? [...hfs][0] : null,
  };
};

const toDateLocal = (dateOnly, hhmm = "00:00") => {
  if (!dateOnly || !isDateOnly(dateOnly)) return null;
  const [h, m] = (hhmm || "00:00").split(":").map((x) => parseInt(x || "0", 10));
  const [Y, M, D] = dateOnly.split("-").map((x) => parseInt(x, 10));
  return new Date(
    Y,
    (M || 1) - 1,
    D || 1,
    Number.isFinite(h) ? h : 0,
    Number.isFinite(m) ? m : 0,
    0,
    0
  );
};

const getStatusPorJanela = ({ di, df, hi, hf, agora = new Date() }) => {
  const start = toDateLocal(di, hi || "00:00");
  const end = toDateLocal(df, hf || "23:59");
  if (!start || !end || Number.isNaN(+start) || Number.isNaN(+end)) return "Programado";
  if (agora < start) return "Programado";
  if (agora > end) return "Encerrado";
  return "Em andamento";
};

/* Normaliza números (aceita string/number) */
const toInt = (v, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

/* Extrai vagas e preenchidas com múltiplos aliases */
const getVagasTotal = (t) =>
  toInt(t?.vagas_total ?? t?.vagasTotais ?? t?.vagas ?? t?.capacidade, 0);

const getPreenchidas = (t) =>
  toInt(
    t?.inscritos_total ??
      t?.vagas_preenchidas ??
      t?.inscritos_confirmados ??
      t?.inscritos ??
      t?.confirmados ??
      t?.matriculados,
    0
  );

/* UI helpers */
const barraClassPorPerc = (p) => {
  if (p >= 90) return "bg-gradient-to-r from-rose-600 to-red-600";
  if (p >= 70) return "bg-gradient-to-r from-amber-500 to-orange-500";
  return "bg-gradient-to-r from-emerald-600 to-teal-600";
};

const chipBase =
  "text-[11px] px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 font-semibold whitespace-nowrap shadow-sm";

const chipStyles = {
  lotada:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/25 dark:text-rose-200 dark:border-rose-800",
  andamento:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/25 dark:text-amber-200 dark:border-amber-800",
  encerrado:
    "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-200 dark:border-zinc-700",
  programado:
    "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-200 dark:border-emerald-800",
  inscrito:
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/25 dark:text-indigo-200 dark:border-indigo-700",
  conflito:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/25 dark:text-amber-200 dark:border-amber-800",
};

function statusChipClass(status) {
  if (status === "Em andamento") return chipStyles.andamento;
  if (status === "Encerrado") return chipStyles.encerrado;
  return chipStyles.programado;
}

/* ======================== Mini components ======================== */
function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/40 backdrop-blur px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="grid place-items-center w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800">
          <Icon className="w-4 h-4 text-zinc-700 dark:text-zinc-200" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            {label}
          </div>
          <div className="text-sm font-extrabold text-zinc-900 dark:text-white truncate">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================== Componente ======================== */
export default function ListaTurmasEvento({
  turmas = [],
  eventoId,
  eventoTipo = "",
  hoje = new Date(),
  inscricoesConfirmadas = [],
  inscrever,
  inscrevendo,
  jaInscritoNoEvento = false,
  jaInstrutorDoEvento = false,
  mostrarStatusTurma = true,
  exibirRealizadosTotal = false,
  turmasEmConflito = [],
}) {
  const isCongresso = String(eventoTipo || "").toLowerCase() === "congresso";

  // ✅ perf: sets memoizados
  const inscritosSet = useMemo(
    () => new Set((inscricoesConfirmadas || []).map((x) => Number(x))),
    [inscricoesConfirmadas]
  );
  const conflitosSet = useMemo(
    () => new Set((turmasEmConflito || []).map((x) => Number(x))),
    [turmasEmConflito]
  );

  const HOJE_ISO = useMemo(() => ymdLocal(hoje), [hoje]);

  // ✅ UX: controlar “mostrar mais” por turma
  const [openMeetings, setOpenMeetings] = useState(() => ({})); // { [turmaId]: boolean }

  const toggleMeetings = (tid) =>
    setOpenMeetings((prev) => ({ ...prev, [tid]: !prev[tid] }));

  return (
    <div id={`turmas-${eventoId}`} className="mt-5 space-y-5">
      {(turmas || []).map((t) => {
        const tid = Number(t?.id);
        const jaInscrito = inscritosSet.has(tid);

        // bloquear outras turmas se não for congresso
        const bloquearOutras = !isCongresso && jaInscritoNoEvento && !jaInscrito;

        // vagas / preenchidas
        const vagas = getVagasTotal(t);
        const preenchidasRaw = getPreenchidas(t);
        const inscritos = jaInscrito && preenchidasRaw === 0 ? 1 : preenchidasRaw;

        const temLimiteVagas = vagas > 0;
        const perc = temLimiteVagas ? toPct(inscritos, vagas) : 0;

        const di = String(t?.data_inicio || "").slice(0, 10);
        const df = String(t?.data_fim || "").slice(0, 10);

        // encontros
        const encontrosInline =
          (Array.isArray(t?.encontros) && t.encontros.length ? t.encontros : null) ||
          (Array.isArray(t?.datas) && t.datas.length ? t.datas : null) ||
          (Array.isArray(t?._datas) && t._datas.length ? t._datas : null);

        const encontros = (encontrosInline || []).map((d) => isoDiaLocal(d)).filter(Boolean);
        const encontrosOrdenados = Array.from(new Set(encontros)).sort();
        const qtdEncontros = encontrosOrdenados.length;
        const realizados = encontrosOrdenados.filter((d) => d <= HOJE_ISO).length;

        // horários
        const { hi: hiEncontros, hf: hfEncontros } = extrairHorasDeEncontros(encontrosInline);
        const hi = parseHora(t?.horario_inicio) || hiEncontros || null;
        const hf = parseHora(t?.horario_fim) || hfEncontros || null;

        const lotada = temLimiteVagas && inscritos >= vagas;
        const carregando = Number(inscrevendo) === tid;

        const statusTurma = getStatusPorJanela({ di, df, hi, hf, agora: hoje });

        const bloqueadoPorInstrutor = Boolean(jaInstrutorDoEvento);
        const emConflito = conflitosSet.has(tid);
        const disabled =
          bloqueadoPorInstrutor || carregando || jaInscrito || lotada || bloquearOutras || emConflito;

        const motivo =
          (bloqueadoPorInstrutor && "Você é instrutor deste evento") ||
          (jaInscrito && "Você já está inscrito nesta turma") ||
          (bloquearOutras && "Você já está inscrito em uma turma deste evento") ||
          (emConflito && "Conflito de horário com outra turma já inscrita") ||
          (lotada && "Turma lotada") ||
          "";

        const idKey = t?.id || `${t?.nome || "Turma"}-${di}-${hi || "??"}`;

        const datasLabel =
          di && df
            ? `${br(di)} a ${br(df)}`
            : di
              ? `A partir de ${br(di)}`
              : df
                ? `Até ${br(df)}`
                : "Data a definir";

        const horarioLabel = hi && hf ? `${hi} às ${hf}` : "a definir";

        // ✅ encontros: colapsar se muitos
        const manyMeetings = qtdEncontros > 12;
        const isOpen = !!openMeetings[tid];
        const visibleMeetings = manyMeetings && !isOpen ? encontrosOrdenados.slice(0, 8) : encontrosOrdenados;

        return (
          <article
            key={idKey}
            className={[
              "relative rounded-3xl overflow-hidden",
              "border border-zinc-200/80 dark:border-zinc-800",
              "bg-white dark:bg-neutral-900",
              "shadow-[0_10px_30px_-20px_rgba(0,0,0,0.35)] hover:shadow-[0_18px_50px_-28px_rgba(0,0,0,0.55)]",
              "transition-all",
            ].join(" ")}
          >
            {/* Barra premium superior */}
            <div className="h-1.5 w-full bg-gradient-to-r from-fuchsia-500 via-indigo-500 to-emerald-500" />

            {/* glow sutil */}
            <div className="pointer-events-none absolute -top-28 -right-28 w-72 h-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 -left-28 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl" />

            <div className="relative p-4 sm:p-6">
              {/* TOP: título + chips */}
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-lg sm:text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white break-words">
                    {t?.nome || "Turma"}
                  </h4>

                  {/* ministats */}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <MiniStat icon={CalendarDays} label="Período" value={datasLabel} />
                    <MiniStat icon={Clock3} label="Horário" value={horarioLabel} />
                    <MiniStat
                      icon={Users}
                      label="Vagas"
                      value={
                        temLimiteVagas
                          ? `${inscritos}/${vagas} (${perc}%)`
                          : `${inscritos} (sem limite)`
                      }
                    />
                  </div>

                  {Number.isFinite(Number(t?.carga_horaria)) && (
                    <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Carga horária:{" "}
                      <span className="font-semibold">{Number(t.carga_horaria)}h</span>
                    </div>
                  )}
                </div>

                {/* Chips à direita */}
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {(lotada || mostrarStatusTurma) && (
                    <span
                      className={`${chipBase} ${lotada ? chipStyles.lotada : statusChipClass(statusTurma)}`}
                      aria-label={lotada ? "Turma lotada" : `Status: ${statusTurma}`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {lotada ? "Lotada" : statusTurma}
                    </span>
                  )}

                  {jaInscrito && (
                    <span className={`${chipBase} ${chipStyles.inscrito}`} title="Você está inscrito nesta turma">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Inscrito
                    </span>
                  )}

                  {emConflito && (
                    <span className={`${chipBase} ${chipStyles.conflito}`} title="Conflito de horário">
                      <AlertTriangle className="w-3.5 h-3.5" /> Conflito
                    </span>
                  )}
                </div>
              </div>

              {/* Encontros */}
              <div className="mt-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 p-3 sm:p-4">
                {qtdEncontros > 0 ? (
                  <>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                        {qtdEncontros} encontro{qtdEncontros > 1 ? "s" : ""}

                        {exibirRealizadosTotal && (
                          <span
                            className="ml-2 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full
                                       bg-emerald-50 text-emerald-700 border border-emerald-200
                                       dark:bg-emerald-900/25 dark:text-emerald-200 dark:border-emerald-800"
                            title="Encontros realizados até hoje"
                            aria-label={`Realizados: ${realizados} de ${qtdEncontros}`}
                          >
                            {realizados}/{qtdEncontros} realizados
                          </span>
                        )}
                      </div>

                      {temLimiteVagas && (
                        <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                          Ocupação: <span className="text-zinc-900 dark:text-white">{perc}%</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {visibleMeetings.map((d, idx) => {
                        const jaOcorreu = d <= HOJE_ISO;
                        return (
                          <span
                            key={`${idKey}-d-${idx}`}
                            className={[
                              "px-2.5 py-1 text-xs rounded-full border font-semibold",
                              "shadow-sm",
                              jaOcorreu
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-200 dark:border-emerald-800"
                                : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/25 dark:text-indigo-200 dark:border-indigo-700",
                            ].join(" ")}
                            title={jaOcorreu ? "Já ocorreu" : "Ainda por ocorrer"}
                          >
                            {br(d)}
                          </span>
                        );
                      })}

                      {manyMeetings && (
                        <button
                          type="button"
                          onClick={() => toggleMeetings(tid)}
                          className="px-2.5 py-1 text-xs rounded-full border font-semibold shadow-sm
                                     bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50
                                     dark:bg-zinc-900/40 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-900/60"
                          aria-expanded={isOpen}
                          aria-label={isOpen ? "Mostrar menos encontros" : "Mostrar mais encontros"}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {isOpen ? "Mostrar menos" : `+${Math.max(0, qtdEncontros - 8)} mais`}
                            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </span>
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Cronograma por encontros ainda não definido
                  </div>
                )}
              </div>

              {/* Barra de vagas */}
              {temLimiteVagas && (
                <div className="mt-4">
                  <div className="flex justify-between items-center text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                    <div className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>
                        {inscritos} de {vagas} vagas preenchidas
                      </span>
                    </div>
                    <span className="font-semibold">{perc}%</span>
                  </div>

                  <div className="h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-2.5 ${barraClassPorPerc(perc)} transition-all`}
                      style={{ width: `${perc}%` }}
                    />
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    if (jaInstrutorDoEvento) return;
                    inscrever?.(t.id);
                  }}
                  disabled={disabled}
                  aria-disabled={disabled}
                  title={motivo}
                  className={[
                    "w-full sm:w-auto min-w-[210px] px-5 py-2.5 rounded-2xl font-extrabold",
                    "transition-all",
                    "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500",
                    disabled
                      ? "bg-zinc-200 text-zinc-500 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-500"
                      : "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-md hover:shadow-xl hover:brightness-[1.03]",
                  ].join(" ")}
                  aria-label={
                    jaInstrutorDoEvento
                      ? "Você é instrutor do evento"
                      : jaInscrito
                        ? "Inscrito nesta turma"
                        : emConflito
                          ? "Conflito de horário com outra turma já inscrita"
                          : lotada
                            ? "Turma sem vagas"
                            : bloquearOutras
                              ? "Inscrição indisponível (já inscrito em outra turma do evento)"
                              : "Inscrever-se na turma"
                  }
                >
                  <span className="inline-flex items-center gap-2">
                    {Number(inscrevendo) === Number(t.id)
                      ? "Processando..."
                      : jaInstrutorDoEvento
                        ? "Instrutor do evento"
                        : jaInscrito
                          ? "Inscrito"
                          : emConflito
                            ? "Conflito de horário"
                            : bloquearOutras
                              ? "Indisponível"
                              : lotada
                                ? "Sem vagas"
                                : "Inscrever-se"}
                    {!disabled && <ArrowRight className="w-4 h-4" />}
                  </span>
                </button>
              </div>

              {/* Motivo (microfeedback) */}
              {disabled && motivo && (
                <div className="mt-2 text-center text-[12px] text-zinc-500 dark:text-zinc-400">
                  {motivo}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ======================== PropTypes ======================== */
ListaTurmasEvento.propTypes = {
  turmas: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      nome: PropTypes.string,
      data_inicio: PropTypes.string,
      data_fim: PropTypes.string,
      horario_inicio: PropTypes.string,
      horario_fim: PropTypes.string,
      vagas_total: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      vagas_preenchidas: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      inscritos_total: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      inscritos_confirmados: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      inscritos: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.string,
        PropTypes.array,
        PropTypes.object,
      ]),
      carga_horaria: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      encontros: PropTypes.array, // strings "YYYY-MM-DD" ou objetos {data,inicio/fim}
      datas: PropTypes.array,
      _datas: PropTypes.array,
    })
  ),
  eventoId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  eventoTipo: PropTypes.string,
  hoje: PropTypes.instanceOf(Date),
  inscricoesConfirmadas: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.number, PropTypes.string])
  ),
  inscrever: PropTypes.func,
  inscrevendo: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  jaInscritoNoEvento: PropTypes.bool,
  jaInstrutorDoEvento: PropTypes.bool,
  mostrarStatusTurma: PropTypes.bool,
  exibirRealizadosTotal: PropTypes.bool,
  turmasEmConflito: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.number, PropTypes.string])
  ),
};
