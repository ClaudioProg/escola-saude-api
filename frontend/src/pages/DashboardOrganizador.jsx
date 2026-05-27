// ✅ frontend/src/pages/Dashboardorganizador.jsx — v2.0
/* eslint-disable no-console */
/**
 * Plataforma Escola da Saúde
 *
 * Dashboard premium do organizador.
 *
 * Função:
 * - Exibir indicadores consolidados do organizador autenticado.
 * - Exibir presença média por turma.
 * - Exibir nota média por evento.
 * - Exibir carga de aulas nos próximos 14 dias.
 *
 * Contrato esperado no api.js:
 * - apiorganizadorMinhaTurmaListar()
 * - apiorganizadorEventoAvaliacaoListar()
 * - apiPresencaTurmaDetalhe(turmaId)
 *
 * Padrão:
 * - Sem apiGet direto no componente.
 * - Sem "/api" nas chamadas do frontend.
 * - Sem leitura de localStorage para usuario.id.
 * - Sem rota com ID do organizador no frontend.
 * - Sem aliases.
 * - Mobile-first.
 * - Acessível.
 * - Premium real, sem perder função.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "react-toastify";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  LineChart,
  Presentation,
  RefreshCw,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";

import useEscolaTheme from "../hooks/useEscolaTheme";
import {
  apiorganizadorMinhasTurmas,
  apiDashboardAvaliacaoRecenteorganizador,
  apiPresencaTurmaDetalhe,
} from "../services/api";

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  PointElement,
  LineElement
);

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function unwrap(response) {
  return response?.data ?? response;
}

function getErrorMessage(error, fallback) {
  const data = error?.response?.data || error?.data || {};

  return data?.message || data?.erro || error?.message || fallback;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) return min;

  return Math.max(min, Math.min(max, number));
}

function ymd(value) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function todayYmd() {
  const date = new Date();
  const pad = (item) => String(item).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function addDaysYmd(baseYmd, days) {
  const [year, month, day] = String(baseYmd).split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);

  date.setDate(date.getDate() + days);

  const pad = (item) => String(item).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function formatDateShort(value) {
  const date = ymd(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "—";

  const [, month, day] = date.split("-");

  return `${day}/${month}`;
}

function isHoje(value) {
  return ymd(value) === todayYmd();
}

function isProximosDias(value, dias = 7) {
  const date = ymd(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const hoje = todayYmd();

  return date > hoje && date <= addDaysYmd(hoje, dias);
}

function normalizeTurmaList(response) {
  const payload = unwrap(response);

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.turma)) return payload.turma;
  if (Array.isArray(payload?.turmas)) return payload.turmas;

  return [];
}

function normalizeEventoAvaliacaoList(response) {
  const payload = unwrap(response);

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.evento)) return payload.evento;
  if (Array.isArray(payload?.eventos)) return payload.eventos;

  return [];
}

function getTurmaNome(turma) {
  return String(turma?.nome || turma?.turma_nome || `Turma ${turma?.id || ""}`).trim();
}

function getEventoTitulo(evento) {
  return String(evento?.titulo || evento?.evento || evento?.evento_titulo || "Evento").trim();
}

function getNotaEvento(evento) {
  const candidates = [
    evento?.nota_media_10,
    evento?.nota_10,
    evento?.nota_media,
    evento?.media_avaliacao,
  ];

  for (const item of candidates) {
    const value = Number(item);

    if (Number.isFinite(value)) {
      return clamp(value, 0, 10);
    }
  }

  if (Array.isArray(evento?.turma)) {
    const notas = evento.turma
      .map((turma) => Number(turma?.nota_media_10 ?? turma?.nota_10))
      .filter(Number.isFinite);

    if (notas.length) {
      return clamp(notas.reduce((sum, item) => sum + item, 0) / notas.length, 0, 10);
    }
  }

  return null;
}

function getDatasTurma(turma) {
  const datas = Array.isArray(turma?.datas) ? turma.datas : [];

  if (datas.length) {
    return datas
      .map((item) => ymd(item?.data || item))
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item));
  }

  const inicio = ymd(turma?.data_inicio);
  const fim = ymd(turma?.data_fim);

  if (inicio && fim && inicio === fim) return [inicio];
  if (inicio && !fim) return [inicio];

  return [];
}

async function calcularPresencaTurma(turmaId, signal) {
  const response = await apiPresencaTurmaDetalhe(turmaId, {
    on403: "silent",
    signal,
  });

  const payload = unwrap(response) || {};
  const datas = Array.isArray(payload?.datas) ? payload.datas : [];
  const usuarios = Array.isArray(payload?.usuarios) ? payload.usuarios : [];

  const hoje = todayYmd();

  const encontrosPassados = datas
    .map((item) => ymd(item?.data || item))
    .filter((item) => item && item <= hoje);

  const totalEncontrosPassados = encontrosPassados.length;

  if (!totalEncontrosPassados || !usuarios.length) {
    return {
      turma_id: turmaId,
      percentual: 0,
    };
  }

  let presencasConfirmadas = 0;

  for (const usuario of usuarios) {
    const presencas = Array.isArray(usuario?.presencas)
      ? usuario.presencas
      : [];

    const presencaMap = new Map(
      presencas.map((presenca) => [
        ymd(presenca?.data_presenca || presenca?.data),
        presenca?.presente === true,
      ])
    );

    for (const data of encontrosPassados) {
      if (presencaMap.get(data) === true) {
        presencasConfirmadas += 1;
      }
    }
  }

  const totalPossivel = totalEncontrosPassados * usuarios.length;
  const percentual =
    totalPossivel > 0
      ? Math.round((presencasConfirmadas / totalPossivel) * 1000) / 10
      : 0;

  return {
    turma_id: turmaId,
    percentual: clamp(percentual, 0, 100),
  };
}

/* ─────────────────────────────────────────────────────────────
   Componentes locais
────────────────────────────────────────────────────────────── */

function SectionShell({
  title,
  subtitle,
  action,
  icon: Icon = Activity,
  gradient = "from-emerald-600 via-teal-500 to-sky-600",
  children,
}) {
  return (
    <section
      className="mt-8 overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/90 shadow-sm dark:border-white/10 dark:bg-zinc-900/55"
      aria-label={title}
    >
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />

      <div className="p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              Painel
            </div>

            <h2 className="mt-3 text-xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100 sm:text-2xl">
              {title}
            </h2>

            {subtitle ? (
              <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-zinc-400">
                {subtitle}
              </p>
            ) : null}
          </div>

          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </section>
  );
}

function GhostAction({ icon: Icon, children, onClick, loading = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5"
    >
      {Icon ? (
        <Icon
          className={cx("h-4 w-4", loading ? "animate-spin" : "")}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}

function InfoRibbon() {
  return (
    <div className="rounded-[26px] border border-emerald-200/70 bg-gradient-to-r from-emerald-50 via-white to-sky-50 p-4 shadow-sm dark:border-emerald-400/15 dark:from-emerald-950/30 dark:via-zinc-900/40 dark:to-sky-950/20 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-2xl bg-emerald-600/10 p-3 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
          <Presentation className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">
            Visão operacional das suas atividades como organizador
          </p>

          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            Acompanhe turmas vinculadas, aulas próximas, presença média dos alunos
            e avaliações recebidas nos eventos.
          </p>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  hint,
  tone = "emerald",
}) {
  const toneMap = {
    emerald: {
      soft: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-200 dark:bg-emerald-400/10",
      bar: "from-emerald-500 via-teal-500 to-cyan-500",
    },
    sky: {
      soft: "bg-sky-600/10 text-sky-700 dark:text-sky-200 dark:bg-sky-400/10",
      bar: "from-sky-500 via-cyan-500 to-blue-500",
    },
    violet: {
      soft: "bg-violet-600/10 text-violet-700 dark:text-violet-200 dark:bg-violet-400/10",
      bar: "from-violet-500 via-fuchsia-500 to-pink-500",
    },
    amber: {
      soft: "bg-amber-600/10 text-amber-800 dark:text-amber-200 dark:bg-amber-400/10",
      bar: "from-amber-400 via-orange-400 to-amber-500",
    },
    rose: {
      soft: "bg-rose-600/10 text-rose-800 dark:text-rose-200 dark:bg-rose-400/10",
      bar: "from-rose-500 via-red-500 to-orange-500",
    },
    slate: {
      soft: "bg-slate-600/10 text-slate-800 dark:text-slate-200 dark:bg-white/10",
      bar: "from-slate-400 via-slate-500 to-slate-600",
    },
  };

  const cfg = toneMap[tone] || toneMap.emerald;

  return (
    <div
      className="group overflow-hidden rounded-[26px] border border-slate-200/80 bg-white text-left shadow-sm dark:border-white/10 dark:bg-zinc-900/55"
      role="group"
      aria-label={`${label}: ${value ?? "—"}`}
    >
      <div className={`h-1.5 w-full bg-gradient-to-r ${cfg.bar}`} />

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-400">
              {label}
            </div>

            <div className="mt-2 text-2xl font-extrabold leading-none tracking-tight text-slate-900 dark:text-zinc-100 sm:text-[1.75rem]">
              {value}
            </div>

            {hint ? (
              <div className="mt-2 text-[12px] leading-relaxed text-slate-600 dark:text-zinc-400 sm:text-[13px]">
                {hint}
              </div>
            ) : null}
          </div>

          <div className={`shrink-0 rounded-2xl p-3 ${cfg.soft}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, ariaLabel, reduceMotion }) {
  return (
    <motion.figure
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900/55"
      role="group"
      aria-label={ariaLabel || title}
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-slate-500 via-slate-600 to-slate-700" />

      <div className="p-4 sm:p-5">
        <figcaption className="mb-4">
          <p className="text-base font-extrabold text-slate-900 dark:text-zinc-100">
            {title}
          </p>

          {subtitle ? (
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              {subtitle}
            </p>
          ) : null}
        </figcaption>

        {children}
      </div>
    </motion.figure>
  );
}

function AlertCard({ message, onRetry }) {
  return (
    <div
      className="mx-auto max-w-6xl rounded-[26px] border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5" aria-hidden="true" />

        <div className="flex-1">
          <p className="font-extrabold">Não foi possível carregar.</p>
          <p className="mt-1 text-sm">{message}</p>

          {typeof onRetry === "function" ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-100 px-3 py-2 text-sm font-bold hover:bg-rose-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 dark:bg-rose-900/40 dark:hover:bg-rose-900/60"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Tentar novamente
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function NoData({ message = "Sem dados para exibir." }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
      {message}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Página
────────────────────────────────────────────────────────────── */

export default function Dashboardorganizador() {
  const { isDark } = useEscolaTheme();
  const reduceMotion = useReducedMotion();

  const liveRef = useRef(null);
  const mountedRef = useRef(true);
  const abortRef = useRef(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [kpi, setKpi] = useState({
    total_turma: 0,
    aula_hoje: 0,
    aula_proxima: 0,
    presenca_media: 0,
    nota_media: 0,
    evento_avaliado: 0,
  });

  const [seriePresencaTurma, setSeriePresencaTurma] = useState({
    labels: [],
    datasets: [],
  });

  const [serieNotaEvento, setSerieNotaEvento] = useState({
    labels: [],
    datasets: [],
  });

  const [serieCargaProxima, setSerieCargaProxima] = useState({
    labels: [],
    datasets: [],
  });

  const setLive = useCallback((message) => {
    if (liveRef.current) {
      liveRef.current.textContent = message || "";
    }
  }, []);

  const resetarGraficos = useCallback(() => {
    setSeriePresencaTurma({ labels: [], datasets: [] });
    setSerieNotaEvento({ labels: [], datasets: [] });
    setSerieCargaProxima({ labels: [], datasets: [] });
  }, []);

  useEffect(() => {
    document.title = "Dashboard do organizador — Escola da Saúde";
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort?.("unmount");
    };
  }, []);

  const carregar = useCallback(async () => {
    try {
      abortRef.current?.abort?.("nova-requisicao");

      const controller = new AbortController();
      abortRef.current = controller;

      setCarregando(true);
      setErro("");
      setLive("Carregando painel do organizador...");

const [turmaResponse, avaliacaoResponse] = await Promise.all([
  apiorganizadorMinhasTurmas(
    {},
    {
      on403: "silent",
      signal: controller.signal,
    }
  ),

  apiDashboardAvaliacaoRecenteorganizador({
    on403: "silent",
    signal: controller.signal,
  }),
]);

      const turmas = normalizeTurmaList(turmaResponse);
      const eventosAvaliacao = normalizeEventoAvaliacaoList(avaliacaoResponse);

      const turmasOrdenadas = [...turmas]
        .sort((a, b) =>
          String(ymd(b?.data_inicio || b?.data_fim)).localeCompare(
            String(ymd(a?.data_inicio || a?.data_fim))
          )
        )
        .slice(0, 6);

      const presencaPorTurma = [];

      for (let index = 0; index < turmasOrdenadas.length; index += 3) {
        const grupo = turmasOrdenadas.slice(index, index + 3);

        const result = await Promise.allSettled(
          grupo.map((turma) =>
            calcularPresencaTurma(Number(turma.id), controller.signal)
          )
        );

        for (const item of result) {
          if (item.status === "fulfilled" && item.value) {
            presencaPorTurma.push(item.value);
          }
        }
      }

      if (!mountedRef.current) return;

      const aulaHoje = turmas.reduce((total, turma) => {
        const datas = getDatasTurma(turma);

        return total + datas.filter(isHoje).length;
      }, 0);

      const aulaProxima = turmas.reduce((total, turma) => {
        const datas = getDatasTurma(turma);

        return total + datas.filter((data) => isProximosDias(data, 7)).length;
      }, 0);

      const presencaMedia =
        presencaPorTurma.length > 0
          ? Math.round(
              (presencaPorTurma.reduce(
                (sum, item) => sum + toNumber(item.percentual, 0),
                0
              ) /
                presencaPorTurma.length) *
                10
            ) / 10
          : 0;

      const notas = eventosAvaliacao
        .map(getNotaEvento)
        .filter((item) => Number.isFinite(item));

      const notaMedia =
        notas.length > 0
          ? Math.round(
              (notas.reduce((sum, item) => sum + item, 0) / notas.length) * 10
            ) / 10
          : 0;

      setKpi({
        total_turma: turmas.length,
        aula_hoje: aulaHoje,
        aula_proxima: aulaProxima,
        presenca_media: clamp(presencaMedia, 0, 100),
        nota_media: clamp(notaMedia, 0, 10),
        evento_avaliado: eventosAvaliacao.length,
      });

      const presencaMap = new Map(
        presencaPorTurma.map((item) => [Number(item.turma_id), item.percentual])
      );

      setSeriePresencaTurma({
        labels: turmasOrdenadas.map(getTurmaNome),
        datasets: [
          {
            label: "% presença média",
            data: turmasOrdenadas.map((turma) =>
              toNumber(presencaMap.get(Number(turma.id)), 0)
            ),
          },
        ],
      });

      setSerieNotaEvento({
        labels: eventosAvaliacao.map(getEventoTitulo),
        datasets: [
          {
            label: "Nota média",
            data: eventosAvaliacao.map((evento) => toNumber(getNotaEvento(evento), 0)),
          },
        ],
      });

      const hoje = todayYmd();
      const proximos14 = new Map();

      for (let index = 0; index < 14; index += 1) {
        const date = addDaysYmd(hoje, index);
        proximos14.set(date, 0);
      }

      for (const turma of turmas) {
        for (const data of getDatasTurma(turma)) {
          if (proximos14.has(data)) {
            proximos14.set(data, toNumber(proximos14.get(data), 0) + 1);
          }
        }
      }

      const labelsCarga = Array.from(proximos14.keys());

      setSerieCargaProxima({
        labels: labelsCarga.map(formatDateShort),
        datasets: [
          {
            label: "Aulas agendadas",
            data: labelsCarga.map((date) => proximos14.get(date)),
            tension: 0.35,
            pointRadius: 3,
          },
        ],
      });

      setLive("Painel do organizador atualizado.");
    } catch (error) {
  const abortado =
    error?.name === "AbortError" ||
    error === "nova-requisicao" ||
    error === "unmount" ||
    controller.signal.aborted;

  if (abortado) {
    return;
  }

  console.error("[Dashboardorganizador] erro ao carregar painel", {
    message: error?.message,
    data: error?.data,
    status: error?.status,
    code: error?.code,
    stack: error?.stack,
    error,
  });

  const message = getErrorMessage(
    error,
    "Não foi possível carregar o painel do organizador."
  );

  setErro(message);
  toast.error(message);

  setKpi({
    total_turma: 0,
    aula_hoje: 0,
    aula_proxima: 0,
    presenca_media: 0,
    nota_media: 0,
    evento_avaliado: 0,
  });

  resetarGraficos();
  setLive("Falha ao carregar painel do organizador.");
} finally {
      if (mountedRef.current) {
        setCarregando(false);
      }
    }
  }, [resetarGraficos, setLive]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const barPctOptions = useMemo(
    () => ({
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.y}%`,
          },
        },
      },
      animation: reduceMotion ? false : undefined,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: (value) => `${value}%`,
          },
        },
      },
      maintainAspectRatio: false,
    }),
    [reduceMotion]
  );

  const barNotaOptions = useMemo(
    () => ({
      plugins: {
        legend: { display: false },
      },
      animation: reduceMotion ? false : undefined,
      scales: {
        y: {
          beginAtZero: true,
          max: 10,
        },
      },
      maintainAspectRatio: false,
    }),
    [reduceMotion]
  );

  const lineOptions = useMemo(
    () => ({
      plugins: {
        legend: { display: false },
      },
      animation: reduceMotion ? false : undefined,
      scales: {
        y: {
          beginAtZero: true,
        },
      },
      maintainAspectRatio: false,
    }),
    [reduceMotion]
  );

  return (
    <>
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        <HeaderHero
          titulo="Dashboard do Organizador"
          subtitulo="Visão geral das suas turmas, aulas, presenças e avaliações."
          badge="organizador • Escola da Saúde • Indicadores"
          icon={Presentation}
          gradient="from-emerald-700 via-teal-600 to-cyan-700"
          isDark={isDark}
        />

        {carregando ? (
          <div
            className="sticky top-0 z-40 mt-4 h-1 w-full overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950/30"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Carregando painel do organizador"
          >
            <div
              className={cx(
                "h-full w-1/3 bg-emerald-700",
                reduceMotion ? "" : "animate-pulse"
              )}
            />
          </div>
        ) : null}

        <div className="mt-6">
          <InfoRibbon />
        </div>

        <SectionShell
          title="Indicadores do organizador"
          subtitulo="Resumo das suas turmas vinculadas, aulas próximas, presença média e avaliações recebidas."
          icon={TrendingUp}
          gradient="from-emerald-600 via-teal-500 to-cyan-600"
          action={
            <GhostAction icon={RefreshCw} onClick={carregar} loading={carregando}>
              {carregando ? "Atualizando…" : "Atualizar"}
            </GhostAction>
          }
        >
          {carregando ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} height={118} className="rounded-[26px]" />
              ))}
            </div>
          ) : erro ? (
            <AlertCard message={erro} onRetry={carregar} />
          ) : (
            <motion.div
              className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              aria-label="Indicadores do organizador"
            >
              <MiniStat
                icon={Presentation}
                label="Minhas turmas"
                value={kpi.total_turma}
                hint="Turmas vinculadas ao organizador"
                tone="sky"
              />

              <MiniStat
                icon={CalendarDays}
                label="Aulas hoje"
                value={kpi.aula_hoje}
                hint="Encontros agendados para hoje"
                tone="emerald"
              />

              <MiniStat
                icon={CalendarDays}
                label="Próximos 7 dias"
                value={kpi.aula_proxima}
                hint="Aulas agendadas no período"
                tone="violet"
              />

              <MiniStat
                icon={Users}
                label="Presença média"
                value={`${kpi.presenca_media.toFixed(1)}%`}
                hint="Média entre suas turmas recentes"
                tone="amber"
              />

              <MiniStat
                icon={Star}
                label="Nota média"
                value={kpi.nota_media.toFixed(1)}
                hint="Média das avaliações recebidas"
                tone="rose"
              />

              <MiniStat
                icon={BarChart3}
                label="Eventos avaliados"
                value={kpi.evento_avaliado}
                hint="Eventos com avaliação registrada"
                tone="slate"
              />
            </motion.div>
          )}
        </SectionShell>

        <SectionShell
          title="Análise visual"
          subtitulo="Gráficos para acompanhar presença, avaliações e carga de aulas próximas."
          icon={LineChart}
          gradient="from-slate-600 via-slate-700 to-zinc-800"
        >
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartCard
              title="Presença média por turma"
              subtitulo="Percentual médio calculado a partir das presenças registradas."
              ariaLabel="Gráfico de barras de presença média por turma"
              reduceMotion={reduceMotion}
            >
              {carregando ? (
                <Skeleton height={320} className="rounded-2xl" />
              ) : seriePresencaTurma.labels.length ? (
                <div style={{ height: 320 }}>
                  <Bar data={seriePresencaTurma} options={barPctOptions} />
                </div>
              ) : (
                <NoData message="Sem dados de presença para exibir." />
              )}
            </ChartCard>

            <ChartCard
              title="Nota média por evento"
              subtitulo="Notas consolidadas das avaliações recebidas."
              ariaLabel="Gráfico de barras de nota média por evento"
              reduceMotion={reduceMotion}
            >
              {carregando ? (
                <Skeleton height={320} className="rounded-2xl" />
              ) : serieNotaEvento.labels.length ? (
                <div style={{ height: 320 }}>
                  <Bar data={serieNotaEvento} options={barNotaOptions} />
                </div>
              ) : (
                <NoData message="Sem avaliações para exibir." />
              )}
            </ChartCard>
          </div>

          <div className="mt-6">
            <ChartCard
              title="Aulas agendadas nos próximos 14 dias"
              subtitulo="Distribuição diária da sua carga de aulas próximas."
              ariaLabel="Gráfico de linha com aulas agendadas nos próximos 14 dias"
              reduceMotion={reduceMotion}
            >
              {carregando ? (
                <Skeleton height={320} className="rounded-2xl" />
              ) : serieCargaProxima.labels.length ? (
                <div style={{ height: 320 }}>
                  <Line data={serieCargaProxima} options={lineOptions} />
                </div>
              ) : (
                <NoData message="Sem aulas agendadas nos próximos 14 dias." />
              )}
            </ChartCard>
          </div>
        </SectionShell>
      </main>

      <Footer />
    </>
  );
}