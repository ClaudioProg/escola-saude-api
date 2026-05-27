// ✅ frontend/src/pages/DashboardAnalitico.jsx — v2.0
/* eslint-disable no-console */
/**
 * Plataforma Escola da Saúde
 *
 * Dashboard analítico premium.
 *
 * Função:
 * - Exibir indicadores analíticos de eventos.
 * - Filtrar por ano, mês e tipo.
 * - Exibir gráficos de eventos, presença e população cadastrada.
 *
 * Contrato esperado no api.js:
 * - apiDashboardAnalitico(params)
 * - apiUsuarioEstatistica()
 *
 * Padrão:
 * - Sem apiGet direto no componente.
 * - Sem "/api" nas chamadas do frontend.
 * - Sem rota antiga /dashboard-analitico no componente.
 * - Sem campos camelCase legados como fonte principal.
 * - Mobile-first.
 * - Acessível.
 * - Visual premium real.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bar, Pie } from "react-chartjs-2";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "react-toastify";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Filter,
  Info,
  Percent,
  PieChart,
  RefreshCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Users2,
  X,
} from "lucide-react";

import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";

import useEscolaTheme from "../hooks/useEscolaTheme";
import {
  apiDashboardAnalitico,
  apiUsuarioEstatistica,
} from "../services/api";

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend
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

function clampPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 0;

  return Math.max(0, Math.min(100, number));
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeChartPayload(value) {
  if (!value || !Array.isArray(value.labels) || !Array.isArray(value.datasets)) {
    return {
      labels: [],
      datasets: [],
    };
  }

  return {
    labels: value.labels,
    datasets: value.datasets,
    meta: Array.isArray(value.meta) ? value.meta : [],
  };
}

function normalizeMetricPayload(payload = {}) {
  return {
    total_evento: toNumber(payload.total_evento, 0),
    inscrito_unico: toNumber(payload.inscrito_unico, 0),
    media_avaliacao: toNumber(payload.media_avaliacao, 0),
    percentual_presenca: clampPercent(payload.percentual_presenca),
    total_inscrito: toNumber(payload.total_inscrito, 0),
    total_elegivel: toNumber(payload.total_elegivel, 0),
    evento_por_mes: normalizeChartPayload(payload.evento_por_mes),
    evento_por_tipo: normalizeChartPayload(payload.evento_por_tipo),
    presenca_por_evento: normalizeChartPayload(payload.presenca_por_evento),
  };
}

function normalizeStatsPayload(payload = {}) {
  return {
    total_usuario: toNumber(payload.total_usuario, 0),
    faixa_etaria: normalizeArray(payload.faixa_etaria),
    por_unidade: normalizeArray(payload.por_unidade),
    por_escolaridade: normalizeArray(payload.por_escolaridade),
    por_cargo: normalizeArray(payload.por_cargo),
    por_orientacao_sexual: normalizeArray(payload.por_orientacao_sexual),
    por_genero: normalizeArray(payload.por_genero),
    por_deficiencia: normalizeArray(payload.por_deficiencia),
    por_cor_raca: normalizeArray(payload.por_cor_raca),
  };
}

function sanitizePieArray(value) {
  return normalizeArray(value)
    .map((item) => {
      const label = String(item?.label || "").trim();
      const numericValue = Number(item?.value);

      return {
        label: label || "Não informado",
        value: Number.isFinite(numericValue)
          ? Math.max(0, numericValue)
          : 0,
      };
    })
    .filter((item) => item.value > 0);
}

function toPieDataset(value) {
  const clean = sanitizePieArray(value);
  const labels = clean.map((item) => item.label);
  const data = clean.map((item) => item.value);

  return {
    labels,
    datasets: [
      {
        data,
        borderWidth: 2,
        hoverOffset: 4,
        cutout: "62%",
      },
    ],
    _total: data.reduce((sum, item) => sum + item, 0),
  };
}

function getAnoOptions() {
  const atual = new Date().getFullYear();
  const anos = [];

  for (let ano = atual; ano >= atual - 6; ano -= 1) {
    anos.push({
      value: String(ano),
      label: String(ano),
    });
  }

  return [
    {
      value: "",
      label: "Todos os anos",
    },
    ...anos,
  ];
}

function getMesOptions() {
  return [
    {
      value: "",
      label: "Todos os meses",
    },
    ...Array.from({ length: 12 }).map((_, index) => ({
      value: String(index + 1),
      label: new Date(2000, index, 1)
        .toLocaleString("pt-BR", { month: "long" })
        .replace(/^\w/, (letter) => letter.toUpperCase()),
    })),
  ];
}

function getTipoOptions() {
  return [
    { value: "", label: "Todos os tipos" },
    { value: "Congresso", label: "Congresso" },
    { value: "Curso", label: "Curso" },
    { value: "Oficina", label: "Oficina" },
    { value: "Palestra", label: "Palestra" },
    { value: "Seminário", label: "Seminário" },
    { value: "Simpósio", label: "Simpósio" },
    { value: "Outros", label: "Outros" },
  ];
}

/* ─────────────────────────────────────────────────────────────
   Componentes locais
────────────────────────────────────────────────────────────── */

function SectionShell({
  title,
  subtitle,
  action,
  icon: Icon = BarChart3,
  gradient = "from-indigo-700 via-fuchsia-700 to-rose-600",
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
              Indicadores
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

function InfoRibbon() {
  return (
    <div className="rounded-[26px] border border-indigo-200/70 bg-gradient-to-r from-indigo-50 via-white to-rose-50 p-4 shadow-sm dark:border-indigo-400/15 dark:from-indigo-950/30 dark:via-zinc-900/40 dark:to-rose-950/20 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-2xl bg-indigo-600/10 p-3 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">
            Visão estratégica para gestão e planejamento
          </p>

          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            Analise eventos, inscrições, presença e perfil da população cadastrada
            para apoiar decisões da Escola da Saúde.
          </p>
        </div>
      </div>
    </div>
  );
}

function GhostAction({ icon: Icon, children, onClick, loading = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5"
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

function FieldSelect({ id, label, value, onChange, options }) {
  return (
    <div className="flex min-w-0 flex-col">
      <label
        className="mb-1 text-xs font-bold text-slate-700 dark:text-slate-200"
        htmlFor={id}
      >
        {label}
      </label>

      <select
        id={id}
        value={value}
        onChange={onChange}
        className="min-h-[44px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-indigo-500/60 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  hint,
  tone = "indigo",
}) {
  const toneMap = {
    indigo: {
      soft: "bg-indigo-600/10 text-indigo-700 dark:text-indigo-200 dark:bg-indigo-400/10",
      bar: "from-indigo-600 via-violet-600 to-fuchsia-600",
    },
    sky: {
      soft: "bg-sky-600/10 text-sky-700 dark:text-sky-200 dark:bg-sky-400/10",
      bar: "from-sky-500 via-cyan-500 to-blue-500",
    },
    amber: {
      soft: "bg-amber-600/10 text-amber-800 dark:text-amber-200 dark:bg-amber-400/10",
      bar: "from-amber-400 via-orange-400 to-amber-500",
    },
    emerald: {
      soft: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-200 dark:bg-emerald-400/10",
      bar: "from-emerald-500 via-teal-500 to-cyan-500",
    },
  };

  const cfg = toneMap[tone] || toneMap.indigo;

  return (
    <div
      className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white text-left shadow-sm dark:border-white/10 dark:bg-zinc-900/55"
      role="group"
      aria-label={`${label}: ${value}`}
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

function AlertCard({ message, onRetry }) {
  return (
    <div
      className="rounded-[26px] border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
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
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Tentar novamente
            </button>
          ) : null}
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
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-rose-600" />

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

function NoData({ message = "Sem dados para exibir." }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
      {message}
    </div>
  );
}

function PieCard({ title, data }) {
  const reduceMotion = useReducedMotion();
  const total = data?._total || 0;

  const options = useMemo(
    () => ({
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 10,
            usePointStyle: true,
            pointStyle: "circle",
            font: { size: 12 },
            generateLabels: (chart) => {
              const dataset = chart.data.datasets?.[0] || {};

              return (chart.data.labels || []).map((raw, index) => {
                const label = String(raw ?? "—");

                return {
                  text: label.length > 22 ? `${label.slice(0, 21)}…` : label,
                  fillStyle: dataset.backgroundColor?.[index],
                  strokeStyle: dataset.backgroundColor?.[index],
                  hidden: false,
                  index,
                };
              });
            },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const label = ctx.label ?? "—";
              const value = Number(ctx.parsed) || 0;
              const pct = total ? ((value / total) * 100).toFixed(1) : "0.0";

              return `${label}: ${value} (${pct}%)`;
            },
          },
        },
      },
      animation: reduceMotion ? false : undefined,
      maintainAspectRatio: false,
    }),
    [reduceMotion, total]
  );

  return (
    <motion.figure
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900/55"
      role="group"
      aria-label={`Gráfico de rosca: ${title}`}
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-slate-500 via-slate-600 to-zinc-700" />

      <div className="p-4 sm:p-5">
        <figcaption className="mb-3 text-center font-extrabold text-slate-900 dark:text-zinc-100">
          {title}
        </figcaption>

        {total > 0 ? (
          <div style={{ height: 280 }}>
            <Pie data={data} options={options} />
          </div>
        ) : (
          <NoData />
        )}

        <p className="mt-3 text-center text-xs text-zinc-600 dark:text-zinc-300 sm:text-sm">
          <strong>Total:</strong> {total}
        </p>
      </div>
    </motion.figure>
  );
}

/* ─────────────────────────────────────────────────────────────
   Página
────────────────────────────────────────────────────────────── */

export default function DashboardAnalitico() {
  const { isDark } = useEscolaTheme();
  const reduceMotion = useReducedMotion();

  const liveRef = useRef(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState(() => normalizeMetricPayload({}));
  const [stats, setStats] = useState(() => normalizeStatsPayload({}));

  const [ano, setAno] = useState("");
  const [mes, setMes] = useState("");
  const [tipo, setTipo] = useState("");
  const [erro, setErro] = useState("");

  const setLive = useCallback((message) => {
    if (liveRef.current) {
      liveRef.current.textContent = message || "";
    }
  }, []);

  useEffect(() => {
    document.title = "Dashboard Analítico — Escola da Saúde";
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort?.("unmount");
    };
  }, []);

  const carregarDados = useCallback(async () => {
    try {
      abortRef.current?.abort?.("nova-requisicao");

      const controller = new AbortController();
      abortRef.current = controller;

      setCarregando(true);
      setErro("");
      setLive("Carregando dashboard analítico...");

      const params = {
        ano: ano || undefined,
        mes: mes || undefined,
        tipo: tipo || undefined,
      };

      const [dashboardResponse, estatisticaResponse] = await Promise.all([
        apiDashboardAnalitico(params, {
          signal: controller.signal,
        }),
        apiUsuarioEstatistica({
          on403: "silent",
          signal: controller.signal,
        }),
      ]);

      if (!mountedRef.current) return;

      setDados(normalizeMetricPayload(unwrap(dashboardResponse) || {}));
      setStats(normalizeStatsPayload(unwrap(estatisticaResponse) || {}));
      setLive("Dashboard analítico atualizado.");
    } catch (error) {
      if (error?.name === "AbortError") return;

      console.error("[DashboardAnalitico] erro ao carregar dados", {
        message: error?.message,
      });

      const message = getErrorMessage(
        error,
        "Erro ao carregar dados do painel analítico."
      );

      if (!mountedRef.current) return;

      setErro(message);
      toast.error(message);
      setLive("Falha ao carregar dashboard analítico.");
    } finally {
      if (mountedRef.current) {
        setCarregando(false);
      }
    }
  }, [ano, mes, tipo, setLive]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const limparFiltros = useCallback(() => {
    setAno("");
    setMes("");
    setTipo("");
  }, []);

  const filtrosAtivos = Boolean(ano || mes || tipo);

  const eventoPorMesData = useMemo(
    () => dados.evento_por_mes,
    [dados.evento_por_mes]
  );

  const eventoPorTipoData = useMemo(
    () => dados.evento_por_tipo,
    [dados.evento_por_tipo]
  );

  const presencaPorEventoData = useMemo(() => {
    const base = dados.presenca_por_evento;

    if (!base?.datasets?.length) return base;

    const labels = Array.isArray(base.labels) ? base.labels : [];
    const datasets = Array.isArray(base.datasets) ? base.datasets : [];
    const meta = Array.isArray(base.meta) ? base.meta : [];

    let indices = labels.map((_, index) => index);

    if (meta.length === labels.length) {
      const normalizados = meta.map((item, index) => ({
        index,
        status: String(item?.status || "").toLowerCase(),
        encerrado_em: item?.encerrado_em || item?.data_fim || null,
      }));

      const encerrados = normalizados
        .filter((item) => item.status === "encerrado" || item.encerrado_em)
        .sort((a, b) => {
          const da = a.encerrado_em ? new Date(a.encerrado_em).getTime() : 0;
          const db = b.encerrado_em ? new Date(b.encerrado_em).getTime() : 0;

          return da - db;
        });

      indices = encerrados.length
        ? encerrados.map((item) => item.index).slice(-5)
        : indices.slice(-5);
    } else {
      indices = indices.slice(-5);
    }

    return {
      labels: indices.map((index) => labels[index]),
      datasets: datasets.map((dataset) => ({
        ...dataset,
        data: indices.map((index) =>
          Number(clampPercent(dataset.data?.[index]).toFixed(1))
        ),
      })),
    };
  }, [dados.presenca_por_evento]);

  const barPercentOptions = useMemo(
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

  const chartOptions = useMemo(
    () => ({
      plugins: {
        legend: { display: false },
      },
      animation: reduceMotion ? false : undefined,
      maintainAspectRatio: false,
    }),
    [reduceMotion]
  );

  const pieFaixa = useMemo(() => toPieDataset(stats.faixa_etaria), [stats]);
  const pieUnidade = useMemo(() => toPieDataset(stats.por_unidade), [stats]);
  const pieEscolaridade = useMemo(
    () => toPieDataset(stats.por_escolaridade),
    [stats]
  );
  const pieCargo = useMemo(() => toPieDataset(stats.por_cargo), [stats]);
  const pieOrientacaoSexual = useMemo(
    () => toPieDataset(stats.por_orientacao_sexual),
    [stats]
  );
  const pieGenero = useMemo(() => toPieDataset(stats.por_genero), [stats]);
  const pieDeficiencia = useMemo(
    () => toPieDataset(stats.por_deficiencia),
    [stats]
  );
  const pieCorRaca = useMemo(() => toPieDataset(stats.por_cor_raca), [stats]);

  return (
    <>
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

        <HeaderHero
          title="Dashboard Analítico"
          subtitle="Visão estratégica dos eventos, inscrições, presenças e população cadastrada."
          badge="Indicadores • Gestão • Escola da Saúde"
          icon={BarChart3}
          gradient="from-indigo-900 via-fuchsia-800 to-rose-700"
          isDark={isDark}
        />

        {carregando ? (
          <div
            className="sticky top-0 z-40 mt-4 h-1 w-full overflow-hidden rounded-full bg-fuchsia-100 dark:bg-fuchsia-950/30"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Carregando dashboard analítico"
          >
            <div
              className={cx(
                "h-full w-1/3 bg-fuchsia-600",
                reduceMotion ? "" : "animate-pulse"
              )}
            />
          </div>
        ) : null}

        <div className="mt-6">
          <InfoRibbon />
        </div>

        <SectionShell
          title="Filtros analíticos"
          subtitle="Refine a análise por período e tipo de evento."
          icon={SlidersHorizontal}
          gradient="from-indigo-700 via-fuchsia-700 to-rose-600"
          action={
            <div className="flex flex-wrap items-center gap-2">
              {filtrosAtivos ? (
                <GhostAction icon={X} onClick={limparFiltros}>
                  Limpar filtros
                </GhostAction>
              ) : null}

              <GhostAction
                icon={RefreshCcw}
                onClick={carregarDados}
                loading={carregando}
              >
                {carregando ? "Atualizando…" : "Atualizar"}
              </GhostAction>
            </div>
          }
        >
          <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/55">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FieldSelect
                id="filtro-ano"
                label="Ano"
                value={ano}
                onChange={(event) => setAno(event.target.value)}
                options={getAnoOptions()}
              />

              <FieldSelect
                id="filtro-mes"
                label="Mês"
                value={mes}
                onChange={(event) => setMes(event.target.value)}
                options={getMesOptions()}
              />

              <FieldSelect
                id="filtro-tipo"
                label="Tipo"
                value={tipo}
                onChange={(event) => setTipo(event.target.value)}
                options={getTipoOptions()}
              />

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={carregarDados}
                  disabled={carregando}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-indigo-700 px-4 py-2 text-sm font-extrabold text-white transition hover:bg-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Filter className="h-4 w-4" aria-hidden="true" />
                  {carregando ? "Aplicando..." : "Aplicar filtros"}
                </button>
              </div>
            </div>
          </div>
        </SectionShell>

        {erro ? (
          <SectionShell
            title="Erro no carregamento"
            subtitle="Houve falha ao carregar os dados analíticos."
            icon={AlertTriangle}
            gradient="from-rose-600 via-red-600 to-orange-600"
          >
            <AlertCard message={erro} onRetry={carregarDados} />
          </SectionShell>
        ) : null}

        <SectionShell
          title="Resumo executivo"
          subtitle="Indicadores principais do período selecionado."
          icon={Sparkles}
          gradient="from-violet-600 via-fuchsia-600 to-rose-600"
        >
          {carregando ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} height={118} className="rounded-[26px]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MiniStat
                icon={CalendarDays}
                label="Total de eventos"
                value={dados.total_evento}
                hint="Eventos no período filtrado"
                tone="indigo"
              />

              <MiniStat
                icon={Users2}
                label="Inscritos únicos"
                value={dados.inscrito_unico}
                hint="Pessoas únicas inscritas"
                tone="sky"
              />

              <MiniStat
                icon={Star}
                label="Média de avaliações"
                value={dados.media_avaliacao.toFixed(1)}
                hint="Média geral dos eventos"
                tone="amber"
              />

              <MiniStat
                icon={Percent}
                label="Presença média"
                value={`${dados.percentual_presenca.toFixed(1)}%`}
                hint="Inscritos com frequência ≥75%"
                tone="emerald"
              />
            </div>
          )}
        </SectionShell>

        <SectionShell
          title="Eventos e presença"
          subtitle="Distribuição dos eventos e presença média consolidada."
          icon={BarChart3}
          gradient="from-slate-600 via-slate-700 to-zinc-800"
        >
          {carregando ? (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Skeleton height={350} className="rounded-[30px]" />
              <Skeleton height={350} className="rounded-[30px]" />
              <Skeleton height={380} className="rounded-[30px] xl:col-span-2" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <ChartCard
                  title="Eventos por mês"
                  subtitle="Quantidade de eventos distribuída por mês."
                  ariaLabel="Gráfico de barras com eventos por mês"
                  reduceMotion={reduceMotion}
                >
                  <div style={{ height: 320 }}>
                    {eventoPorMesData.labels.length ? (
                      <Bar data={eventoPorMesData} options={chartOptions} />
                    ) : (
                      <NoData />
                    )}
                  </div>
                </ChartCard>

                <ChartCard
                  title="Eventos por tipo"
                  subtitle="Distribuição por modalidade/tipo de evento."
                  ariaLabel="Gráfico de pizza com eventos por tipo"
                  reduceMotion={reduceMotion}
                >
                  <div style={{ height: 320 }}>
                    {eventoPorTipoData.labels.length ? (
                      <Pie data={eventoPorTipoData} />
                    ) : (
                      <NoData />
                    )}
                  </div>
                </ChartCard>
              </div>

              <div className="mt-6">
                <ChartCard
                  title="Presença por evento"
                  subtitle="Últimos eventos encerrados com percentual de presença."
                  ariaLabel="Gráfico de barras com percentual de presença por evento"
                  reduceMotion={reduceMotion}
                >
                  <div style={{ height: 360 }}>
                    {presencaPorEventoData.labels.length ? (
                      <Bar
                        data={presencaPorEventoData}
                        options={barPercentOptions}
                      />
                    ) : (
                      <NoData />
                    )}
                  </div>
                </ChartCard>
              </div>
            </>
          )}
        </SectionShell>

        <SectionShell
          title="População cadastrada"
          subtitle="Distribuição demográfica e institucional dos usuários cadastrados."
          icon={PieChart}
          gradient="from-emerald-600 via-teal-600 to-cyan-600"
          action={
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              Total: {stats.total_usuario}
            </span>
          }
        >
          {carregando ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} height={350} className="rounded-[30px]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <PieCard title="Faixa etária" data={pieFaixa} />
              <PieCard title="Unidade" data={pieUnidade} />
              <PieCard title="Escolaridade" data={pieEscolaridade} />
              <PieCard title="Cargo" data={pieCargo} />
              <PieCard title="Orientação sexual" data={pieOrientacaoSexual} />
              <PieCard title="Gênero" data={pieGenero} />
              <PieCard title="Deficiência" data={pieDeficiencia} />
              <PieCard title="Cor/raça" data={pieCorRaca} />
            </div>
          )}
        </SectionShell>
      </main>

      <Footer />
    </>
  );
}