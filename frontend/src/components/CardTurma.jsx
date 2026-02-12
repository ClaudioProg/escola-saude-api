/* eslint-disable no-console */
// 📁 src/componentes/CardTurma.jsx — PREMIUM+++++
// (mobile-first + tech discreto + instrutores + ministats + sem “primário/secundário”)

import PropTypes from "prop-types";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Users,
  CalendarDays,
  Clock3,
  Megaphone,
  UserRound,
  BadgeCheck,
  Ban,
  Loader2,
  Sparkles,
  FileText,
} from "lucide-react";
import { formatarDataBrasileira } from "../utils/dateTime";
import BadgeStatus from "../components/BadgeStatus"; // ajuste se seu projeto usa "../componentes/BadgeStatus"

/* ===== Helpers de data no fuso local (sem shift) ===== */
function isDateOnly(str) {
  return typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str);
}
function toLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === "string") {
    if (isDateOnly(input)) {
      const [y, m, d] = input.split("-").map(Number);
      return new Date(y, m - 1, d); // 00:00 local
    }
    return new Date(input);
  }
  return new Date(input);
}
function startOfDayLocal(d) {
  const dt = toLocalDate(d);
  if (!dt) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
function endOfDayLocal(d) {
  const dt = toLocalDate(d);
  if (!dt) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23, 59, 59, 999);
}
function minutesBetween(hhmmIni, hhmmFim) {
  if (!hhmmIni || !hhmmFim) return 0;
  const [h1, m1] = String(hhmmIni).slice(0, 5).split(":").map(Number);
  const [h2, m2] = String(hhmmFim).slice(0, 5).split(":").map(Number);
  if (![h1, m1, h2, m2].every((n) => Number.isFinite(n))) return 0;
  const v = h2 * 60 + m2 - (h1 * 60 + m1);
  return Math.max(0, v);
}

/* ===== Status key (datas reais + horário do último dia) ===== */
function getStatusKeyByDates(minData, maxData, horarioFimUltimoDia = "23:59", agora = new Date()) {
  if (!minData || !maxData) return "desconhecido";
  const dataInicio = startOfDayLocal(minData);
  const dataFim = endOfDayLocal(maxData);

  if (horarioFimUltimoDia) {
    const [h, m] = String(horarioFimUltimoDia).slice(0, 5).split(":").map(Number);
    dataFim.setHours(Number.isFinite(h) ? h : 23, Number.isFinite(m) ? m : 59, 59, 999);
  }

  if (agora < dataInicio) return "programado";
  if (agora > dataFim) return "encerrado";
  return "em_andamento";
}

/* ===== Mapeamentos visuais por status (padrão do projeto) ===== */
const BAR_GRADIENT = {
  programado: "bg-gradient-to-r from-emerald-700 via-teal-600 to-lime-600",
  em_andamento: "bg-gradient-to-r from-amber-600 via-yellow-600 to-orange-600",
  encerrado: "bg-gradient-to-r from-rose-700 via-red-700 to-rose-600",
  desconhecido: "bg-gradient-to-r from-gray-500 via-gray-600 to-gray-700",
};

const PERCENT_BADGE = {
  full: "bg-rose-50 text-rose-900 border-rose-200/80 dark:bg-rose-900/20 dark:text-rose-200 dark:border-rose-900/40",
  high: "bg-amber-50 text-amber-900 border-amber-200/80 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40",
  ok: "bg-emerald-50 text-emerald-900 border-emerald-200/80 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40",
};

/* ===== UI: MiniChip (ministats) ===== */
function MiniChip({ icon, label, value }) {
  return (
    <div
      className={[
        "flex items-center gap-2",
        "rounded-2xl border",
        "bg-white/70 dark:bg-zinc-900/25",
        "border-slate-200/80 dark:border-zinc-700/70",
        "px-3 py-2",
        "min-w-[0]",
      ].join(" ")}
      role="group"
      aria-label={`${label}: ${value ?? "—"}`}
      title={`${label}: ${value ?? "—"}`}
    >
      <span className="opacity-80 shrink-0" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 leading-none">{label}</div>
        <div className="text-[13px] font-extrabold text-slate-900 dark:text-zinc-50 truncate">{value ?? "—"}</div>
      </div>
    </div>
  );
}
MiniChip.propTypes = {
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

/* ===== UI: Botão “tech discreto” (mesmo espírito do CardEvento) ===== */
function TechButton({ children, onClick, disabled, loading, title, ariaLabel, variant = "ghost" }) {
  const base = [
    "inline-flex items-center justify-center gap-2",
    "rounded-2xl px-4 py-2.5",
    "text-[13px] font-extrabold",
    "border transition select-none",
    "shadow-sm hover:shadow",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2",
    "focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900",
  ].join(" ");

  const styles = {
    ghost: [
      "bg-white/70 dark:bg-zinc-900/25",
      "border-slate-200/80 dark:border-zinc-700/70",
      "text-slate-900 dark:text-zinc-100",
      "hover:bg-slate-50 dark:hover:bg-zinc-800/40",
    ].join(" "),
    filled: [
      "bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950",
      "border-white/10 dark:border-white/10",
      "text-white",
      "hover:brightness-[1.05]",
    ].join(" "),
    soft: [
      "bg-indigo-50/80 dark:bg-indigo-900/20",
      "border-indigo-200/70 dark:border-indigo-800/60",
      "text-indigo-900 dark:text-indigo-200",
      "hover:bg-indigo-50 dark:hover:bg-indigo-900/25",
    ].join(" "),
  };

  const cls = [
    base,
    styles[variant] || styles.ghost,
    disabled || loading ? "opacity-60 cursor-not-allowed pointer-events-none" : "",
  ].join(" ");

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      className={cls}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

TechButton.propTypes = {
  children: PropTypes.node,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  title: PropTypes.string,
  ariaLabel: PropTypes.string,
  variant: PropTypes.oneOf(["ghost", "filled", "soft"]),
};

/* ===== Componente ===== */
export default function CardTurma({
  turma,
  eventoId,
  hoje,
  carregarInscritos,
  carregarAvaliacao,
  gerarRelatorioPDF,
  inscritos,
  avaliacao,
  inscrever,
  inscrevendo,
  inscricaoConfirmadas,
  bloquearInscricao = false,
}) {
  const turmaIdNum = Number(turma?.id);

  // ✅ Carregar dados (se esta tela usa/precisa)
  useEffect(() => {
    if (!turmaIdNum || !Number.isFinite(turmaIdNum)) return;
    if (typeof carregarInscritos === "function" && !Array.isArray(inscritos)) carregarInscritos(turmaIdNum);
    if (typeof carregarAvaliacao === "function" && !avaliacao) carregarAvaliacao(turmaIdNum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaIdNum]);

  const total = Number(turma.vagas_total || 0);

  const ocupadas = Array.isArray(turma.inscritos)
    ? turma.inscritos.length
    : Number(turma.vagas_preenchidas ?? turma.inscritos_confirmados ?? turma.inscritos ?? 0);

  const percentual = total > 0 ? Math.max(0, Math.min(100, Math.round((ocupadas / total) * 100))) : 0;

  // ================== Deriva dados a partir de turma.datas ==================
  const { minData, maxData, horasTotal, horarioFimUltimoDia, datasOrdenadas, horarioPreview } = useMemo(() => {
    const arr = Array.isArray(turma.datas) ? [...turma.datas] : [];
    arr.sort((a, b) => String(a?.data || "").localeCompare(String(b?.data || "")));

    const first = arr[0];
    const last = arr[arr.length - 1];

    const minD = first?.data || turma.data_inicio || null;
    const maxD = last?.data || turma.data_fim || null;

    let totalMin = 0;
    for (const d of arr) {
      const mins = minutesBetween(d?.horario_inicio, d?.horario_fim);
      if (mins > 0) totalMin += mins >= 360 ? mins - 60 : mins;
    }

    if (arr.length === 0 && turma.horario_inicio && turma.horario_fim && minD) {
      let mins = minutesBetween(turma.horario_inicio, turma.horario_fim);
      if (mins > 0) totalMin += mins >= 360 ? mins - 60 : mins;
    }

    const hfUltimo =
      (last?.horario_fim && String(last.horario_fim).slice(0, 5)) ||
      (turma.horario_fim && String(turma.horario_fim).slice(0, 5)) ||
      "23:59";

    const hi =
      (first?.horario_inicio && String(first.horario_inicio).slice(0, 5)) ||
      (turma.horario_inicio && String(turma.horario_inicio).slice(0, 5)) ||
      "";
    const hf =
      (first?.horario_fim && String(first.horario_fim).slice(0, 5)) ||
      (turma.horario_fim && String(turma.horario_fim).slice(0, 5)) ||
      "";

    const horarioTxt = hi && hf ? `${hi} às ${hf}` : hi ? hi : hf ? hf : "A definir";

    return {
      minData: minD,
      maxData: maxD,
      horasTotal: totalMin / 60,
      horarioFimUltimoDia: hfUltimo,
      datasOrdenadas: arr,
      horarioPreview: horarioTxt,
    };
  }, [turma]);

  const agoraRef = hoje instanceof Date ? hoje : new Date();
  const statusKey = getStatusKeyByDates(minData, maxData, horarioFimUltimoDia, agoraRef);

  const periodoTexto =
    minData && maxData
      ? `${formatarDataBrasileira(minData)} a ${formatarDataBrasileira(maxData)}`
      : minData
      ? formatarDataBrasileira(minData)
      : "Datas a definir";

  const cargaTotalRaw = Number.isFinite(Number(turma.carga_horaria_real))
    ? Number(turma.carga_horaria_real)
    : Number.isFinite(horasTotal)
    ? horasTotal
    : 0;
  const cargaTotal = Math.max(0, Number(cargaTotalRaw));

  function bloquearInscricaoPorData() {
    const fimTurma = endOfDayLocal(maxData || turma.data_fim);
    return fimTurma ? fimTurma < agoraRef : false;
  }
  const bloquear = Boolean(bloquearInscricao || bloquearInscricaoPorData());

  const barClass = BAR_GRADIENT[statusKey] || BAR_GRADIENT.desconhecido;

  const corBarra = percentual >= 100 ? "bg-rose-600" : percentual >= 75 ? "bg-amber-500" : "bg-emerald-600";
  const badgePercentClasses =
    percentual >= 100 ? PERCENT_BADGE.full : percentual >= 75 ? PERCENT_BADGE.high : PERCENT_BADGE.ok;

  const previewDatas =
    (datasOrdenadas?.length || 0) > 1
      ? datasOrdenadas.slice(0, 3).map((d) => formatarDataBrasileira(d.data)).join(" • ")
      : null;

  const instrutores = Array.isArray(turma.instrutores) ? turma.instrutores : [];
  const assinanteId = Number.isFinite(Number(turma.instrutor_assinante_id)) ? Number(turma.instrutor_assinante_id) : null;

  const confirmado = Array.isArray(inscricaoConfirmadas) && inscricaoConfirmadas.includes(turmaIdNum);
  const loadingInscricao = Number.isFinite(turmaIdNum) && inscrevendo === turmaIdNum;

  const headingId = `turma-${eventoId}-${turma.id}-titulo`;
  const progressId = `turma-${eventoId}-${turma.id}-progress`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      layout
      className="relative rounded-2xl bg-white dark:bg-neutral-900 shadow border border-slate-200/80 dark:border-zinc-700/70 overflow-hidden"
      aria-labelledby={headingId}
      aria-describedby={progressId}
    >
      {/* Barrinha superior com gradiente por status */}
      <div className={`h-1.5 w-full ${barClass}`} aria-hidden="true" />

      <div className="p-5 sm:p-6">
        {/* Header: título + status */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="w-full min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4
                id={headingId}
                className="text-base font-black text-slate-900 dark:text-zinc-50 truncate"
                title={turma.nome}
                aria-live="polite"
              >
                {turma.nome}
              </h4>
              <BadgeStatus status={statusKey} size="sm" variant="soft" />
            </div>

            {/* ministats topo */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <MiniChip icon={<CalendarDays className="w-4 h-4" />} label="Período" value={periodoTexto} />
              <MiniChip icon={<Clock3 className="w-4 h-4" />} label="Horário" value={horarioPreview} />
              <MiniChip
                icon={<Users className="w-4 h-4" />}
                label="Vagas"
                value={`${ocupadas}/${total || "—"} (${total > 0 ? percentual : 0}%)`}
              />
            </div>

            {/* instrutores */}
            {instrutores.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-4" aria-label="Instrutores da turma">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-extrabold text-slate-700 dark:text-zinc-200">
                  <UserRound className="w-4 h-4 opacity-80" aria-hidden="true" />
                  Instrutor{instrutores.length > 1 ? "es" : ""}:
                </span>

                {instrutores.map((p) => {
                  const ehAssinante = assinanteId && Number(p.id) === assinanteId;
                  return (
                    <span
                      key={p.id}
                      className={[
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                        "text-[12px] font-extrabold",
                        ehAssinante
                          ? "bg-amber-50/80 text-amber-900 border-amber-200/80 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800/60"
                          : "bg-slate-50/80 text-slate-800 border-slate-200/80 dark:bg-zinc-900/25 dark:text-zinc-200 dark:border-zinc-700/70",
                      ].join(" ")}
                      title={ehAssinante ? "Instrutor assinante" : "Instrutor"}
                      aria-label={ehAssinante ? `Instrutor (assinante): ${p.nome}` : `Instrutor: ${p.nome}`}
                    >
                      {ehAssinante ? (
                        <Megaphone size={14} aria-hidden="true" />
                      ) : (
                        <BadgeCheck className="w-4 h-4 opacity-80" aria-hidden="true" />
                      )}
                      <span className="truncate max-w-[260px]">{p.nome}</span>
                    </span>
                  );
                })}
              </div>
            )}

            {/* carga + datas */}
            <div className="mt-3 space-y-1">
              <span className="text-xs text-slate-600 dark:text-zinc-300 block">
                ⏱️ Carga horária total: <span className="font-extrabold text-slate-900 dark:text-zinc-50">{cargaTotal.toFixed(1)}h</span>
              </span>

              {previewDatas && (
                <span className="text-xs text-slate-500 dark:text-zinc-400 block" title={previewDatas}>
                  ✨ Datas: {previewDatas}
                  {datasOrdenadas.length > 3 ? ` +${datasOrdenadas.length - 3}` : ""}
                </span>
              )}
            </div>

            {/* progressbar */}
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 dark:text-zinc-200 mb-1">
                <span className="inline-flex items-center">
                  <Sparkles size={14} className="mr-1 opacity-80" aria-hidden="true" />
                  Ocupação
                </span>

                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-extrabold ${badgePercentClasses}`}
                  aria-live="polite"
                >
                  {percentual}%
                </span>
              </div>

              <div
                id={progressId}
                className="w-full h-2 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percentual}
                aria-valuetext={`${percentual}% das vagas preenchidas`}
              >
                <div className={`h-full ${corBarra}`} style={{ width: `${percentual}%` }} />
              </div>
            </div>
          </div>

          {/* ações (tech, discretas, alinhadas) */}
          <div className="shrink-0 w-full lg:w-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {confirmado ? (
                <div
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 border
                             bg-indigo-50/80 text-indigo-900 border-indigo-200/70
                             dark:bg-indigo-900/20 dark:text-indigo-200 dark:border-indigo-800/60"
                  aria-label="Inscrição confirmada"
                  title="Você já está inscrito nesta turma."
                >
                  <BadgeCheck className="w-4 h-4" aria-hidden="true" />
                  <span className="text-[13px] font-extrabold">Inscrito</span>
                </div>
              ) : bloquear ? (
                <div
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 border
                             bg-slate-50 text-slate-600 border-slate-200/80
                             dark:bg-zinc-900/25 dark:text-zinc-300 dark:border-zinc-700/70"
                  aria-label="Inscrição indisponível"
                  title="Inscrição indisponível (turma encerrada ou bloqueada)."
                >
                  <Ban className="w-4 h-4" aria-hidden="true" />
                  <span className="text-[13px] font-extrabold">Indisponível</span>
                </div>
              ) : (
                <TechButton
                  onClick={() => (typeof inscrever === "function" ? inscrever(turmaIdNum) : null)}
                  disabled={!Number.isFinite(turmaIdNum)}
                  loading={loadingInscricao}
                  ariaLabel="Inscrever-se nesta turma"
                  title="Inscrever-se nesta turma"
                  variant="filled"
                >
                  {loadingInscricao ? "Inscrevendo..." : "Inscrever-se"}
                </TechButton>
              )}

              {typeof gerarRelatorioPDF === "function" && Number.isFinite(turmaIdNum) ? (
                <TechButton
                  onClick={() => gerarRelatorioPDF?.(turmaIdNum)}
                  ariaLabel="Gerar relatório PDF desta turma"
                  title="Gerar relatório PDF"
                  variant="ghost"
                >
                  <FileText className="w-4 h-4" aria-hidden="true" />
                  Relatório PDF
                </TechButton>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ===== PropTypes / Defaults ===== */
CardTurma.propTypes = {
  turma: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    nome: PropTypes.string,
    evento_titulo: PropTypes.string,

    datas: PropTypes.arrayOf(
      PropTypes.shape({
        data: PropTypes.string,
        horario_inicio: PropTypes.string,
        horario_fim: PropTypes.string,
      })
    ),

    data_inicio: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    data_fim: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),

    horario_inicio: PropTypes.string,
    horario_fim: PropTypes.string,

    vagas_total: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    inscritos: PropTypes.array,
    vagas_preenchidas: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    inscritos_confirmados: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

    instrutores: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
        nome: PropTypes.string.isRequired,
        email: PropTypes.string,
      })
    ),
    instrutor_assinante_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

    carga_horaria_real: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }).isRequired,

  eventoId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  hoje: PropTypes.instanceOf(Date),

  carregarInscritos: PropTypes.func,
  carregarAvaliacao: PropTypes.func,
  gerarRelatorioPDF: PropTypes.func,

  inscritos: PropTypes.any,
  avaliacao: PropTypes.any,

  inscrever: PropTypes.func,
  inscrevendo: PropTypes.number,
  inscricaoConfirmadas: PropTypes.array,

  bloquearInscricao: PropTypes.bool,
};

CardTurma.defaultProps = {
  hoje: new Date(),
  inscritos: null,
  avaliacao: null,
  inscrever: null,
  inscrevendo: null,
  inscricaoConfirmadas: [],
  bloquearInscricao: false,
  carregarInscritos: null,
  carregarAvaliacao: null,
  gerarRelatorioPDF: null,
};
