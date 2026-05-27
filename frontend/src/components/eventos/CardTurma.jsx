/* eslint-disable no-console */
// ✅ frontend/src/components/eventos/CardTurma.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Card público/base premium de turma.
//
// Contratos aplicados:
// - Pasta do domínio: src/components/eventos/
// - BadgeStatus vem de ../ui/BadgeStatus
// - Status oficial: programado | andamento | encerrado | sem_datas
// - Date-only seguro em YYYY-MM-DD
// - Sem new Date("YYYY-MM-DD")
// - Sem status em_andamento
// - Sem campo encontros
// - Sem múltiplos formatos paralelos para inscritos
// - Turma usa contrato oficial:
//   {
//     id,
//     nome,
//     datas: [{ data, horario_inicio, horario_fim }],
//     data_inicio,
//     data_fim,
//     horario_inicio,
//     horario_fim,
//     vagas_total,
//     vagas_preenchidas,
//     carga_horaria,
//     organizadores,
//     organizador_assinante_id
//   }
//
// Diretriz visual:
// - Layout público mais claro para escolha de turma
// - Separação forte entre informação, lotação e ação
// - Mobile-first, acessível, com CTA evidente
// - Mantém compatibilidade funcional com o CardEvento

import PropTypes from "prop-types";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  Loader2,
  Megaphone,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

import BadgeStatus from "../ui/BadgeStatus";

/* ─────────────────────────────────────────────────────────────
   Constantes oficiais
────────────────────────────────────────────────────────────── */

const TURMA_STATUS = Object.freeze({
  PROGRAMADO: "programado",
  ANDAMENTO: "andamento",
  ENCERRADO: "encerrado",
  SEM_DATAS: "sem_datas",
});

/* ─────────────────────────────────────────────────────────────
   Helpers date-only / horário
────────────────────────────────────────────────────────────── */

function pad2(value) {
  return String(value).padStart(2, "0");
}

function hojeIsoLocal() {
  const d = new Date();

  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isDateOnly(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeDateOnly(value) {
  if (!value) return "";

  if (typeof value === "object" && value?.data) {
    return normalizeDateOnly(value.data);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(
      value.getDate()
    )}`;
  }

  if (typeof value === "string") {
    const raw = value.trim();

    if (isDateOnly(raw)) return raw;

    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : "";
  }

  return "";
}

function normalizeHHmm(value, fallback = "") {
  if (typeof value !== "string") return fallback;

  const raw = value.trim();

  if (!raw) return fallback;
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw.slice(0, 5);

  return fallback;
}

function formatDateBr(value) {
  const date = normalizeDateOnly(value);

  if (!date) return "";

  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function getHojeYmd(hoje) {
  return normalizeDateOnly(hoje) || hojeIsoLocal();
}

/* ─────────────────────────────────────────────────────────────
   Helpers de turma
────────────────────────────────────────────────────────────── */

function clamp(value, min = 0, max = 100) {
  const number = Number(value);

  if (!Number.isFinite(number)) return min;

  return Math.max(min, Math.min(max, number));
}

function toPositiveInt(value, fallback = 0) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 0) return fallback;

  return number;
}

function minutesBetween(startHHmm, endHHmm) {
  const start = normalizeHHmm(startHHmm, "");
  const end = normalizeHHmm(endHHmm, "");

  if (!start || !end) return 0;

  const [h1, m1] = start.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);

  if (![h1, m1, h2, m2].every(Number.isFinite)) return 0;

  return Math.max(0, h2 * 60 + m2 - (h1 * 60 + m1));
}

function getDatasTurma(turma) {
  const datas = Array.isArray(turma?.datas) ? turma.datas : [];

  if (datas.length) {
    return datas
      .map((item) => ({
        data: normalizeDateOnly(item?.data || item),
        horario_inicio: normalizeHHmm(
          item?.horario_inicio || turma?.horario_inicio || "",
          ""
        ),
        horario_fim: normalizeHHmm(
          item?.horario_fim || turma?.horario_fim || "",
          ""
        ),
      }))
      .filter((item) => item.data)
      .sort((a, b) => a.data.localeCompare(b.data));
  }

  const dataInicio = normalizeDateOnly(turma?.data_inicio);
  const dataFim = normalizeDateOnly(turma?.data_fim || turma?.data_inicio);
  const horarioInicio = normalizeHHmm(turma?.horario_inicio || "", "");
  const horarioFim = normalizeHHmm(turma?.horario_fim || "", "");

  if (!dataInicio) return [];

  if (dataFim && dataFim !== dataInicio) {
    return [
      {
        data: dataInicio,
        horario_inicio: horarioInicio,
        horario_fim: horarioFim,
      },
      {
        data: dataFim,
        horario_inicio: horarioInicio,
        horario_fim: horarioFim,
      },
    ];
  }

  return [
    {
      data: dataInicio,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
    },
  ];
}

function getRangeTurma(turma) {
  const datas = getDatasTurma(turma);

  const dataInicio =
    datas[0]?.data || normalizeDateOnly(turma?.data_inicio) || "";

  const dataFim =
    datas.at(-1)?.data ||
    normalizeDateOnly(turma?.data_fim) ||
    dataInicio ||
    "";

  const primeiroComHorario = datas.find((item) => item.horario_inicio);
  const ultimoComHorario = [...datas].reverse().find((item) => item.horario_fim);

  const horarioInicio =
    normalizeHHmm(turma?.horario_inicio || "", "") ||
    primeiroComHorario?.horario_inicio ||
    "";

  const horarioFim =
    normalizeHHmm(turma?.horario_fim || "", "") ||
    ultimoComHorario?.horario_fim ||
    "";

  return {
    datas,
    dataInicio,
    dataFim,
    horarioInicio,
    horarioFim,
  };
}

function getStatusKeyByTurma(turma, hoje) {
  const { dataInicio, dataFim } = getRangeTurma(turma);

  if (!dataInicio || !dataFim) return TURMA_STATUS.SEM_DATAS;

  const hojeYmd = getHojeYmd(hoje);

  if (hojeYmd < dataInicio) return TURMA_STATUS.PROGRAMADO;
  if (hojeYmd > dataFim) return TURMA_STATUS.ENCERRADO;

  return TURMA_STATUS.ANDAMENTO;
}

function getStatusLabel(statusKey) {
  if (statusKey === TURMA_STATUS.PROGRAMADO) return "Programada";
  if (statusKey === TURMA_STATUS.ANDAMENTO) return "Em andamento";
  if (statusKey === TURMA_STATUS.ENCERRADO) return "Encerrada";

  return "Datas a definir";
}

function calcularCargaHoraria(turma) {
  const cargaOficial = Number(turma?.carga_horaria);

  if (Number.isFinite(cargaOficial) && cargaOficial > 0) {
    return cargaOficial;
  }

  const datas = getDatasTurma(turma);

  let totalMinutos = 0;

  for (const item of datas) {
    const minutos = minutesBetween(item.horario_inicio, item.horario_fim);

    if (minutos > 0) {
      totalMinutos += minutos >= 360 ? minutos - 60 : minutos;
    }
  }

  return Math.max(0, totalMinutos / 60);
}

function periodoTexto(turma) {
  const { dataInicio, dataFim } = getRangeTurma(turma);

  if (dataInicio && dataFim) {
    return dataInicio === dataFim
      ? formatDateBr(dataInicio)
      : `${formatDateBr(dataInicio)} a ${formatDateBr(dataFim)}`;
  }

  if (dataInicio) return formatDateBr(dataInicio);

  return "Datas a definir";
}

function horarioTexto(turma) {
  const { horarioInicio, horarioFim } = getRangeTurma(turma);

  if (horarioInicio && horarioFim) return `${horarioInicio} às ${horarioFim}`;
  if (horarioInicio) return `A partir de ${horarioInicio}`;
  if (horarioFim) return `Até ${horarioFim}`;

  return "Horário a definir";
}

function getOcupacao(turma, inscritos) {
  const total = toPositiveInt(turma?.vagas_total, 0);

  const ocupadas = Array.isArray(inscritos)
    ? inscritos.length
    : toPositiveInt(turma?.vagas_preenchidas, 0);

  const percentual =
    total > 0 ? clamp(Math.round((ocupadas / total) * 100), 0, 100) : 0;

  return {
    total,
    ocupadas,
    percentual,
    disponiveis: total > 0 ? Math.max(0, total - ocupadas) : null,
  };
}

function getorganizadores(turma) {
  const raw = Array.isArray(turma?.organizadores) ? turma.organizadores : [];

  const map = new Map();

  for (const item of raw) {
    const id = Number(item?.id ?? item);

    if (!Number.isFinite(id) || map.has(id)) continue;

    map.set(id, {
      id,
      nome:
        typeof item === "object" && item?.nome
          ? String(item.nome).trim()
          : `organizador ${id}`,
    });
  }

  return [...map.values()];
}

function isTurmaEncerrada(turma, hoje) {
  const { dataFim } = getRangeTurma(turma);

  if (!dataFim) return false;

  return getHojeYmd(hoje) > dataFim;
}

/* ─────────────────────────────────────────────────────────────
   UI helpers
────────────────────────────────────────────────────────────── */

const BAR_GRADIENT = {
  [TURMA_STATUS.PROGRAMADO]: "from-emerald-500 via-teal-500 to-cyan-500",
  [TURMA_STATUS.ANDAMENTO]: "from-amber-500 via-orange-500 to-rose-500",
  [TURMA_STATUS.ENCERRADO]: "from-rose-600 via-red-600 to-zinc-700",
  [TURMA_STATUS.SEM_DATAS]: "from-zinc-400 via-zinc-500 to-zinc-600",
};

const AURA_BG = {
  [TURMA_STATUS.PROGRAMADO]: "bg-emerald-500/10",
  [TURMA_STATUS.ANDAMENTO]: "bg-amber-500/10",
  [TURMA_STATUS.ENCERRADO]: "bg-rose-500/10",
  [TURMA_STATUS.SEM_DATAS]: "bg-indigo-500/10",
};

const PERCENT_BADGE = {
  full:
    "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-900/20 dark:text-rose-200 dark:border-rose-900/40",
  high:
    "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40",
  ok:
    "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40",
  empty:
    "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800",
};

function InfoTile({ icon: Icon, label, value, tone = "zinc" }) {
  const tones = {
    zinc:
      "border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100",
    sky:
      "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100",
    amber:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
    violet:
      "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-100",
  };

  return (
    <div
      className={`rounded-2xl border p-3 shadow-sm ${tones[tone] || tones.zinc}`}
      role="group"
      aria-label={`${label}: ${value || "—"}`}
      title={`${label}: ${value || "—"}`}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/75 shadow-sm dark:bg-white/5">
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-wide opacity-65">
            {label}
          </div>
          <div className="truncate text-sm font-black leading-tight">
            {value || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

function TechButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  title,
  ariaLabel,
  variant = "ghost",
}) {
  const base = [
    "inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3",
    "text-sm font-black shadow-sm transition select-none hover:shadow",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2",
    "focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950",
  ].join(" ");

  const styles = {
    ghost: [
      "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
      "dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/70",
    ].join(" "),
    filled:
      "border-white/10 bg-gradient-to-r from-zinc-950 via-emerald-950 to-emerald-800 text-white hover:brightness-[1.06]",
    soft: [
      "border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100",
      "dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200 dark:hover:bg-indigo-950/45",
    ].join(" "),
    muted: [
      "border-zinc-200 bg-zinc-100 text-zinc-500",
      "dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500",
    ].join(" "),
  };

  const cls = [
    base,
    styles[variant] || styles.ghost,
    disabled || loading ? "pointer-events-none cursor-not-allowed opacity-60" : "",
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
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}

function OccupancyBlock({ total, ocupadas, disponiveis, percentual }) {
  const corBarra =
    percentual >= 100
      ? "bg-rose-600"
      : percentual >= 75
        ? "bg-amber-500"
        : "bg-emerald-600";

  const badgeClasses =
    total <= 0
      ? PERCENT_BADGE.empty
      : percentual >= 100
        ? PERCENT_BADGE.full
        : percentual >= 75
          ? PERCENT_BADGE.high
          : PERCENT_BADGE.ok;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-black text-zinc-950 dark:text-white">
            Vagas
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {total > 0
              ? `${ocupadas} inscrito(s), ${disponiveis} vaga(s) disponível(is)`
              : "Quantidade de vagas não informada"}
          </div>
        </div>

        <span
          className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-black ${badgeClasses}`}
          aria-live="polite"
        >
          {total > 0 ? `${percentual}%` : "—"}
        </span>
      </div>

      {total > 0 ? (
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentual}
          aria-valuetext={`${percentual}% das vagas preenchidas`}
        >
          <div
            className={`h-full ${corBarra} transition-all`}
            style={{ width: `${percentual}%` }}
            aria-hidden="true"
          />
        </div>
      ) : (
        <div className="h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-800" />
      )}
    </div>
  );
}

function InstructorPills({ organizadores, assinanteId }) {
  if (!organizadores.length) return null;

  return (
    <div className="flex flex-wrap gap-2" aria-label="organizadores da turma">
      {organizadores.map((organizador) => {
        const ehAssinante =
          assinanteId && Number(organizador.id) === Number(assinanteId);

        return (
          <span
            key={organizador.id}
            className={[
              "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold",
              ehAssinante
                ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                : "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200",
            ].join(" ")}
            title={
              ehAssinante
                ? `organizador assinante: ${organizador.nome}`
                : organizador.nome
            }
            aria-label={
              ehAssinante
                ? `organizador assinante: ${organizador.nome}`
                : `organizador: ${organizador.nome}`
            }
          >
            {ehAssinante ? (
              <Megaphone size={14} aria-hidden="true" />
            ) : (
              <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span className="truncate">{organizador.nome}</span>
          </span>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Componente
────────────────────────────────────────────────────────────── */

export default function CardTurma({
  turma,
  eventoId,
  hoje = "",
  carregarInscritos = null,
  carregarAvaliacao = null,
  gerarRelatorioPDF = null,
  inscritos = null,
  avaliacao = null,
  inscrever = null,
  inscrevendo = null,
  inscricaoConfirmadas = [],
  bloquearInscricao = false,
}) {
  const turmaIdNum = Number(turma?.id);
  const hasTurmaId = Number.isInteger(turmaIdNum) && turmaIdNum > 0;

  useEffect(() => {
    if (!hasTurmaId) return;

    if (typeof carregarInscritos === "function" && !Array.isArray(inscritos)) {
      carregarInscritos(turmaIdNum);
    }

    if (typeof carregarAvaliacao === "function" && !avaliacao) {
      carregarAvaliacao(turmaIdNum);
    }
  }, [
    avaliacao,
    carregarAvaliacao,
    carregarInscritos,
    hasTurmaId,
    inscritos,
    turmaIdNum,
  ]);

  const { total, ocupadas, percentual, disponiveis } = useMemo(
    () => getOcupacao(turma, inscritos),
    [inscritos, turma]
  );

  const {
    datas: datasOrdenadas,
    dataInicio,
    dataFim,
  } = useMemo(() => getRangeTurma(turma), [turma]);

  const statusKey = useMemo(
    () => getStatusKeyByTurma(turma, hoje),
    [hoje, turma]
  );

  const organizadores = useMemo(() => getorganizadores(turma), [turma]);

  const assinanteId = Number.isInteger(Number(turma?.organizador_assinante_id))
    ? Number(turma.organizador_assinante_id)
    : null;

  const confirmado = Array.isArray(inscricaoConfirmadas)
    ? inscricaoConfirmadas.map(Number).includes(turmaIdNum)
    : false;

  const loadingInscricao = hasTurmaId && Number(inscrevendo) === turmaIdNum;

  const turmaEncerrada = isTurmaEncerrada(turma, hoje);
  const lotada = total > 0 && ocupadas >= total;
  const bloquear = Boolean(bloquearInscricao || turmaEncerrada || lotada);

  const barClass = BAR_GRADIENT[statusKey] || BAR_GRADIENT[TURMA_STATUS.SEM_DATAS];
  const auraClass = AURA_BG[statusKey] || AURA_BG[TURMA_STATUS.SEM_DATAS];

  const periodo = periodoTexto(turma);
  const horario = horarioTexto(turma);
  const cargaTotal = calcularCargaHoraria(turma);
  const totalDatas = datasOrdenadas.length;

  const previewDatas =
    datasOrdenadas.length > 1
      ? datasOrdenadas
          .slice(0, 4)
          .map((item) => formatDateBr(item.data))
          .join(" • ")
      : null;

  const headingId = `turma-${eventoId}-${turma?.id}-titulo`;
  const progressId = `turma-${eventoId}-${turma?.id}-progress`;

  const motivoBloqueio =
    (turmaEncerrada && "Turma encerrada") ||
    (lotada && "Turma sem vagas") ||
    (bloquearInscricao && "Inscrição indisponível") ||
    "";

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      layout
      className="relative overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-[0_14px_50px_-38px_rgba(15,23,42,0.65)] dark:border-zinc-800 dark:bg-zinc-950"
      aria-labelledby={headingId}
      aria-describedby={progressId}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${barClass}`}
        aria-hidden="true"
      />

      <div
        className={`pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl ${auraClass}`}
        aria-hidden="true"
      />

      <div className="relative grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_230px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <BadgeStatus status={statusKey} size="sm" variant="soft" />

            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-bold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {getStatusLabel(statusKey)}
            </span>

            {confirmado && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Inscrito
              </span>
            )}
          </div>

          <h4
            id={headingId}
            className="break-words text-lg font-black leading-tight text-zinc-950 dark:text-white sm:text-xl"
            title={turma?.nome || "Turma"}
            aria-live="polite"
          >
            {turma?.nome || "Turma"}
          </h4>

          <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
            <InfoTile
              icon={CalendarDays}
              label="Período"
              value={periodo}
              tone="violet"
            />
            <InfoTile icon={Clock3} label="Horário" value={horario} tone="sky" />
            <InfoTile
              icon={GraduationCap}
              label="Datas"
              value={totalDatas || "—"}
              tone="zinc"
            />
            <InfoTile
              icon={ShieldCheck}
              label="Carga"
              value={
                Number(cargaTotal) > 0
                  ? `${Number(cargaTotal).toFixed(1)}h`
                  : "—"
              }
              tone="emerald"
            />
          </div>

          {previewDatas && (
            <div
              className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300"
              title={previewDatas}
            >
              Datas: {previewDatas}
              {datasOrdenadas.length > 4 ? ` +${datasOrdenadas.length - 4}` : ""}
            </div>
          )}

          {dataInicio && dataFim && dataInicio !== dataFim && (
            <span className="sr-only">
              Esta turma começa em {formatDateBr(dataInicio)} e termina em{" "}
              {formatDateBr(dataFim)}.
            </span>
          )}

          <div className="mt-4">
            <InstructorPills organizadores={organizadores} assinanteId={assinanteId} />
          </div>

          <div id={progressId} className="mt-4">
            <OccupancyBlock
              total={total}
              ocupadas={ocupadas}
              disponiveis={disponiveis}
              percentual={percentual}
            />
          </div>
        </div>

        <aside className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mb-3">
            <div className="text-sm font-black text-zinc-950 dark:text-white">
              Inscrição
            </div>
            <div className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Escolha esta turma conforme disponibilidade de vagas e regras do
              evento.
            </div>
          </div>

          <div className="grid gap-2">
            {confirmado ? (
              <div
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200"
                aria-label="Inscrição confirmada"
                title="Você já está inscrito nesta turma."
              >
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                <span className="text-sm font-black">Você está inscrito</span>
              </div>
            ) : bloquear ? (
              <div
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                aria-label="Inscrição indisponível"
                title={motivoBloqueio || "Inscrição indisponível."}
              >
                <Ban className="h-4 w-4" aria-hidden="true" />
                <span className="text-sm font-black">
                  {motivoBloqueio || "Indisponível"}
                </span>
              </div>
            ) : (
              <TechButton
                onClick={() => {
                  if (typeof inscrever === "function") {
                    inscrever(turmaIdNum);
                  }
                }}
                disabled={!hasTurmaId}
                loading={loadingInscricao}
                ariaLabel="Inscrever-se nesta turma"
                title="Inscrever-se nesta turma"
                variant="filled"
              >
                {loadingInscricao ? "Inscrevendo..." : "Inscrever-se"}
              </TechButton>
            )}

            {typeof gerarRelatorioPDF === "function" && hasTurmaId ? (
              <TechButton
                onClick={() => gerarRelatorioPDF?.(turmaIdNum)}
                ariaLabel="Gerar relatório PDF desta turma"
                title="Gerar relatório PDF"
                variant="ghost"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                Relatório PDF
              </TechButton>
            ) : null}
          </div>

          {total > 0 && !confirmado && !bloquear && (
            <p className="mt-3 text-center text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {disponiveis} vaga(s) disponível(is)
            </p>
          )}
        </aside>
      </div>
    </motion.article>
  );
}

/* ─────────────────────────────────────────────────────────────
   PropTypes
────────────────────────────────────────────────────────────── */

InfoTile.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  tone: PropTypes.oneOf(["zinc", "emerald", "sky", "amber", "violet"]),
};

TechButton.propTypes = {
  children: PropTypes.node,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  title: PropTypes.string,
  ariaLabel: PropTypes.string,
  variant: PropTypes.oneOf(["ghost", "filled", "soft", "muted"]),
};

OccupancyBlock.propTypes = {
  total: PropTypes.number,
  ocupadas: PropTypes.number,
  disponiveis: PropTypes.number,
  percentual: PropTypes.number,
};

InstructorPills.propTypes = {
  organizadores: PropTypes.array,
  assinanteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

CardTurma.propTypes = {
  turma: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    nome: PropTypes.string,

    datas: PropTypes.arrayOf(
      PropTypes.shape({
        data: PropTypes.string,
        horario_inicio: PropTypes.string,
        horario_fim: PropTypes.string,
      })
    ),

    data_inicio: PropTypes.string,
    data_fim: PropTypes.string,

    horario_inicio: PropTypes.string,
    horario_fim: PropTypes.string,

    vagas_total: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    vagas_preenchidas: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

    organizadores: PropTypes.arrayOf(
      PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.string,
        PropTypes.shape({
          id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
          nome: PropTypes.string,
          email: PropTypes.string,
        }),
      ])
    ),

    organizador_assinante_id: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string,
    ]),

    carga_horaria: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }).isRequired,

  eventoId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  hoje: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),

  carregarInscritos: PropTypes.func,
  carregarAvaliacao: PropTypes.func,
  gerarRelatorioPDF: PropTypes.func,

  inscritos: PropTypes.array,
  avaliacao: PropTypes.any,

  inscrever: PropTypes.func,
  inscrevendo: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  inscricaoConfirmadas: PropTypes.array,

  bloquearInscricao: PropTypes.bool,
};