// 📁 src/componentes/CardTurma.jsx
import PropTypes from "prop-types";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Users, CalendarDays, Clock3 } from "lucide-react";
import { formatarDataBrasileira } from "../utils/data";
import BadgeStatus from "../components/BadgeStatus";

/* ===== Helpers de data no fuso local ===== */
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
  const [h1, m1] = hhmmIni.split(":").map(Number);
  const [h2, m2] = hhmmFim.split(":").map(Number);
  if (![h1, m1, h2, m2].every((n) => Number.isFinite(n))) return 0;
  return h2 * 60 + m2 - (h1 * 60 + m1);
}

/* ===== Status key (usa datas reais da turma + agora = 'hoje') ===== */
function getStatusKeyByDates(minData, maxData, horarioFimUltimoDia = "23:59", agora = new Date()) {
  if (!minData || !maxData) return "desconhecido";
  const dataInicio = startOfDayLocal(minData);
  const dataFim = endOfDayLocal(maxData);

  if (horarioFimUltimoDia) {
    const [h, m] = horarioFimUltimoDia.split(":").map(Number);
    dataFim.setHours(Number.isFinite(h) ? h : 23, Number.isFinite(m) ? m : 59, 59, 999);
  }

  if (agora < dataInicio) return "programado";
  if (agora > dataFim) return "encerrado";
  return "andamento";
}

/* ===== Mapeamentos visuais por status ===== */
const BAR_GRADIENT = {
  programado: "bg-gradient-to-r from-emerald-700 via-teal-600 to-lime-600",
  andamento: "bg-gradient-to-r from-amber-600 via-yellow-600 to-orange-600",
  encerrado: "bg-gradient-to-r from-rose-700 via-red-700 to-rose-600",
  desconhecido: "bg-gradient-to-r from-gray-500 via-gray-600 to-gray-700",
};

const PERCENT_BADGE = {
  full: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  high: "bg-orange-100 text-orange-900 dark:bg-orange-900/30 dark:text-orange-200",
  ok: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
};

/* ===== Componente ===== */
export default function CardTurma({
  turma,
  eventoId,
  hoje,
  carregarInscritos,
  carregarAvaliacoes,
  gerarRelatorioPDF,
  inscritos,
  avaliacoes,
  inscrever,
  inscrevendo,
  inscricoesConfirmadas,
  bloquearInscricao = false,
}) {
  const [exibeInscritos] = useState(false);
  const [exibeAvaliacoes] = useState(false);

  const total = Number(turma.vagas_total || 0);
  const ocupadas = Array.isArray(turma.inscritos)
    ? turma.inscritos.length
    : Number(turma.vagas_preenchidas ?? turma.inscritos_confirmados ?? turma.inscritos ?? 0);

  const percentual = total > 0 ? Math.max(0, Math.min(100, Math.round((ocupadas / total) * 100))) : 0;

  // ================== Deriva dados a partir de turma.datas ==================
  const { minData, maxData, horasTotal, horarioFimUltimoDia, datasOrdenadas } = useMemo(() => {
    const arr = Array.isArray(turma.datas) ? [...turma.datas] : [];
    // normaliza strings e ordena por data
    arr.sort((a, b) => String(a?.data || "").localeCompare(String(b?.data || "")));

    const first = arr[0];
    const last = arr[arr.length - 1];

    const minD = first?.data || turma.data_inicio || null;
    const maxD = last?.data || turma.data_fim || null;

    // soma de horas por dia (regra do almoço: −1h quando >= 6h)
    let totalMin = 0;
    for (const d of arr) {
      const mins = minutesBetween(d?.horario_inicio, d?.horario_fim);
      if (mins > 0) totalMin += mins >= 360 ? mins - 60 : mins;
    }

    // fallback: 1 dia com horário global
    if (arr.length === 0 && turma.horario_inicio && turma.horario_fim && minD) {
      let mins = minutesBetween(turma.horario_inicio, turma.horario_fim);
      if (mins > 0) totalMin += mins >= 360 ? mins - 60 : mins;
    }

    const hfUltimo =
      (last?.horario_fim && String(last.horario_fim).slice(0, 5)) ||
      (turma.horario_fim && String(turma.horario_fim).slice(0, 5)) ||
      "23:59";

    return {
      minData: minD,
      maxData: maxD,
      horasTotal: totalMin / 60,
      horarioFimUltimoDia: hfUltimo,
      datasOrdenadas: arr,
    };
  }, [turma]);

  // ======= Status (BadgeStatus) — usa 'hoje' quando informado =======
  const agoraRef = (hoje instanceof Date ? hoje : new Date());
  const statusKey = getStatusKeyByDates(minData, maxData, horarioFimUltimoDia, agoraRef);

  // ======= Texto do período =======
  const periodoTexto =
    minData && maxData
      ? `${formatarDataBrasileira(minData)} a ${formatarDataBrasileira(maxData)}`
      : minData
      ? formatarDataBrasileira(minData)
      : "Datas a definir";

  // ======= Carga horária =======
  const cargaTotal = Number.isFinite(Number(turma.carga_horaria_real))
    ? Number(turma.carga_horaria_real)
    : Number.isFinite(horasTotal)
    ? horasTotal
    : 0;

  // ======= Bloqueio de inscrição por data real =======
  function bloquearInscricaoPorData() {
    const fimTurma = endOfDayLocal(maxData || turma.data_fim);
    return fimTurma ? fimTurma < agoraRef : false;
  }
  const bloquear = bloquearInscricao || bloquearInscricaoPorData();

  // ======= Visual: barra superior por status =======
  const barClass = BAR_GRADIENT[statusKey] || BAR_GRADIENT.desconhecido;

  // ======= Barra de progresso (cores com bom contraste) =======
  const corBarra =
    percentual >= 100 ? "bg-red-600" : percentual >= 75 ? "bg-orange-500" : "bg-green-600";

  const badgePercentClasses =
    percentual >= 100 ? PERCENT_BADGE.full : percentual >= 75 ? PERCENT_BADGE.high : PERCENT_BADGE.ok;

  // ======= Prévia de datas (opcional) =======
  const previewDatas =
    (datasOrdenadas?.length || 0) > 1
      ? datasOrdenadas.slice(0, 3).map((d) => formatarDataBrasileira(d.data)).join(" • ")
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      layout
      className="relative rounded-2xl bg-white dark:bg-neutral-900 shadow border border-gray-200 dark:border-gray-700 overflow-hidden"
      aria-label={`Cartão da turma ${turma.nome}`}
      tabIndex={0}
    >
      {/* Barrinha superior com gradiente por status */}
      <div className={`h-1.5 w-full ${barClass}`} aria-hidden="true" />

      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
          <div className="w-full min-w-0">
            {/* Título + badge de status */}
            <div className="flex items-center gap-2 mb-1">
              <h4
                className="text-base font-bold text-lousa dark:text-green-200 truncate"
                title={turma.nome}
                aria-live="polite"
              >
                {turma.nome}
              </h4>
              <BadgeStatus status={statusKey} size="sm" variant="soft" />
            </div>

            {/* Evento (opcional) */}
            {turma.evento_titulo && (
              <span
                className="text-xs text-gray-500 dark:text-gray-400 block mb-1 truncate"
                title={turma.evento_titulo}
              >
                <CalendarDays size={14} className="inline mr-1" /> Evento: {turma.evento_titulo}
              </span>
            )}

            {/* Período */}
            <span className="text-xs text-gray-600 dark:text-gray-300 block">
              <CalendarDays size={14} className="inline mr-1" />
              {periodoTexto}
            </span>

            {/* Horário compacto quando for um único dia */}
            {turma.horario_inicio && turma.horario_fim && (datasOrdenadas?.length || 0) <= 1 && (
              <span className="text-xs text-gray-600 dark:text-gray-300 block mt-0.5">
                <Clock3 size={14} className="inline mr-1" />
                Horário: {String(turma.horario_inicio).slice(0, 5)} às {String(turma.horario_fim).slice(0, 5)}
              </span>
            )}

            {/* Carga horária total */}
            <span className="text-xs text-gray-600 dark:text-gray-300 block mt-0.5">
              ⏱️ Carga horária total: {cargaTotal.toFixed(1)}h
            </span>

            {/* Prévia de datas (ministats) */}
            {previewDatas && (
              <span className="text-xs text-gray-500 dark:text-gray-400 block mt-0.5">
                📅 Próximas datas: {previewDatas}
                {datasOrdenadas.length > 3 ? ` +${datasOrdenadas.length - 3}` : ""}
              </span>
            )}

            {/* Barra de Progresso */}
            <div className="mt-3" aria-label="Progresso de ocupação de vagas">
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
                <span>
                  <Users size={14} className="inline mr-1" />
                  {ocupadas} de {total} vagas preenchidas
                </span>
                <span className={`ml-2 px-2 py-0.5 rounded ${badgePercentClasses} text-xs`} aria-live="polite">
                  {percentual}%
                </span>
              </div>
              <div
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
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
        </div>

        {/* CTA de inscrição, no padrão dos novos botões */}
        <div className="mt-4 flex justify-end">
          {inscrever && (
            inscricoesConfirmadas.includes(turma.id) ? (
              <span
                className="inline-flex items-center rounded-full border font-semibold px-4 py-1 cursor-default
                           bg-emerald-50 text-emerald-800 border-emerald-300
                           dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800/60"
                aria-label="Inscrição confirmada"
              >
                ✅ Inscrito
              </span>
            ) : bloquear ? (
              <span
                className="inline-flex items-center rounded-full border font-semibold px-4 py-1 cursor-not-allowed
                           bg-gray-200 text-gray-500 border-gray-300 dark:bg-gray-800 dark:text-gray-300/60 dark:border-gray-700"
                aria-label="Inscrição indisponível"
              >
                Inscrição indisponível
              </span>
            ) : (
              <button
                className="px-4 py-2 rounded-full font-semibold text-white transition
                           bg-lousa hover:opacity-90
                           focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500/60
                           dark:focus-visible:ring-offset-neutral-900"
                onClick={() => inscrever(Number(turma.id))}
                disabled={inscrevendo === Number(turma.id)}
                aria-busy={inscrevendo === Number(turma.id) || undefined}
                aria-label="Inscrever-se nesta turma"
                title="Inscrever-se nesta turma"
              >
                {inscrevendo === Number(turma.id) ? "Inscrevendo..." : "Inscrever-se"}
              </button>
            )
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ===== PropTypes / Defaults ===== */
CardTurma.propTypes = {
  turma: PropTypes.object.isRequired,
  eventoId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  hoje: PropTypes.instanceOf(Date).isRequired,
  carregarInscritos: PropTypes.func.isRequired,
  carregarAvaliacoes: PropTypes.func.isRequired,
  gerarRelatorioPDF: PropTypes.func.isRequired,
  inscritos: PropTypes.array,
  avaliacoes: PropTypes.array,
  inscrever: PropTypes.func.isRequired,
  inscrevendo: PropTypes.number,
  inscricoesConfirmadas: PropTypes.array,
  bloquearInscricao: PropTypes.bool,
};

CardTurma.defaultProps = {
  inscritos: [],
  avaliacoes: [],
  inscrevendo: null,
  inscricoesConfirmadas: [],
  bloquearInscricao: false,
};
