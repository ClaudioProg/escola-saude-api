// 📁 src/pages/AnaliticDashboard.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";

// ⚠️ Chart.js (registro obrigatório p/ evitar erros em runtime)
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
  Title,
} from "chart.js";
import { Bar, Pie, Line } from "react-chartjs-2";

import { apiGet } from "../services/api";

// Design system
import HeaderHero from "../components/ui/HeaderHero";
import MiniStat from "../components/charts/MiniStat";
import Botao from "../components/ui/Botao";
import TituloSecao from "../components/ui/TituloSecao";
import Loader from "../components/ui/Loader";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
  Title
);

/* ===================== Utils ===================== */
const clean = (obj) =>
  Object.fromEntries(
    Object.entries(obj || {}).filter(
      ([, v]) => v !== "" && v !== null && v !== undefined
    )
  );

const fmtPercent = (v) => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  const n = Number(v);
  return `${Math.round(n)}%`;
};

// Paleta acessível e elegante (sem fixar duro em datasets)
const DEFAULT_COLORS = [
  "#14532d", "#0ea5e9", "#9333ea", "#f59e0b", "#ef4444",
  "#14b8a6", "#3b82f6", "#f43f5e", "#84cc16", "#eab308",
  "#8b5cf6", "#06b6d4", "#f97316", "#22c55e", "#0f766e",
];

// Determina dark mode
function useDarkMode() {
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains("dark") ||
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () =>
      setIsDark(
        document.documentElement.classList.contains("dark") ||
          mq?.matches
      );
    mq?.addEventListener?.("change", onChange);
    const obs = new MutationObserver(onChange);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      mq?.removeEventListener?.("change", onChange);
      obs.disconnect();
    };
  }, []);
  return isDark;
}

// Gera opções de chart conforme tema (tooltip, grade, fontes, etc.)
function useChartOptions() {
  const isDark = useDarkMode();
  return useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, color: isDark ? "#e5e7eb" : "#111827" },
        },
        tooltip: {
          mode: "index",
          intersect: false,
          backgroundColor: isDark ? "#111827" : "#111827",
          titleColor: "#f9fafb",
          bodyColor: "#f9fafb",
          borderColor: "transparent",
          borderWidth: 0,
        },
        title: {
          display: false,
        },
      },
      interaction: { mode: "nearest", intersect: false },
      elements: { line: { tension: 0.25, borderWidth: 2 }, point: { radius: 2 } },
      scales: {
        x: {
          ticks: { color: isDark ? "#d1d5db" : "#374151" },
          grid: { color: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" },
        },
        y: {
          ticks: { color: isDark ? "#d1d5db" : "#374151" },
          grid: { color: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" },
        },
      },
    }),
    [isDark]
  );
}

// Aplica cores default se o backend não mandou cores
function withDefaultColors(chartData) {
  if (!chartData || !Array.isArray(chartData?.datasets)) return chartData;
  const ds = chartData.datasets.map((d, i) => {
    const color = DEFAULT_COLORS[i % DEFAULT_COLORS.length];
    return {
      ...d,
      borderColor: d.borderColor ?? color,
      backgroundColor:
        d.backgroundColor ??
        (d.type === "line" ? color : `${color}33`), // 20% opacidade para barras/pizza
      hoverBackgroundColor: d.hoverBackgroundColor ?? color,
    };
  });
  return { ...chartData, datasets: ds };
}

// Exporta CSV simples a partir de { labels, datasets[] }
function exportChartCSV(filename, chartData) {
  if (!chartData?.labels || !chartData?.datasets) return;
  const labels = chartData.labels;
  const headers = ["Label", ...chartData.datasets.map((d) => d.label || "Série")];
  const rows = labels.map((lab, idx) => [
    lab,
    ...chartData.datasets.map((d) => {
      const v = Array.isArray(d.data) ? d.data[idx] : "";
      return typeof v === "number" && Number.isFinite(v) ? v : (v ?? "");
    }),
  ]);
  const all = [headers, ...rows];
  const csv = all.map((r) =>
    r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")
  ).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ===================== Página ===================== */
export default function DashboardAnalitico() {
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState({});
  const [erro, setErro] = useState("");
  const [filtros, setFiltros] = useState(() => {
    // inicializa com querystring (persistência/compartilhamento)
    const sp = new URLSearchParams(location.search);
    return {
      ano: sp.get("ano") ?? "",
      mes: sp.get("mes") ?? "",
      tipo: sp.get("tipo") ?? "",
    };
  });

  const abortRef = useRef(null);

  const handleFiltro = useCallback(
    (field) => (e) => {
      setFiltros((prev) => ({ ...prev, [field]: e.target.value }));
    },
    []
  );

  // forçar re-fetch mantendo filtros
  const recarregar = useCallback(() => {
    setFiltros((prev) => ({ ...prev }));
  }, []);

  // sincroniza filtros -> URL
  useEffect(() => {
    const query = new URLSearchParams(clean(filtros)).toString();
    const newUrl = `${location.pathname}${query ? `?${query}` : ""}`;
    // evita poluir history se for igual
    if (newUrl !== `${location.pathname}${location.search}`) {
      history.replaceState(null, "", newUrl);
    }
  }, [filtros]);

  // fetch de dados
  useEffect(() => {
    async function load() {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setCarregando(true);
      setErro("");

      try {
        const query = new URLSearchParams(clean(filtros)).toString();
        const url = `/api/dashboard-analitico${query ? `?${query}` : ""}`;
        const data = await apiGet(url, { signal: controller.signal });
        setDados(data || {});
      } catch (err) {
        if (err?.name === "AbortError") return;
        setDados({});
        setErro("Falha ao obter dados. Tente novamente.");
        toast.error("❌ Falha ao obter dados");
      } finally {
        setCarregando(false);
      }
    }
    load();
    return () => abortRef.current?.abort();
  }, [filtros]);

  const chartOptions = useChartOptions();

  const temSeries =
    dados &&
    (dados.eventosPorMes || dados.eventosPorTipo || dados.presencaPorEvento);

  // datasets com cores default
  const eventosPorMes = useMemo(
    () => withDefaultColors(dados?.eventosPorMes),
    [dados?.eventosPorMes]
  );
  const eventosPorTipo = useMemo(
    () => withDefaultColors(dados?.eventosPorTipo),
    [dados?.eventosPorTipo]
  );
  const presencaPorEvento = useMemo(
    () => withDefaultColors(dados?.presencaPorEvento),
    [dados?.presencaPorEvento]
  );

  return (
    <main
      className="min-h-dvh bg-gray-50 dark:bg-zinc-900"
      aria-busy={carregando}
      aria-live="polite"
      aria-describedby="dash-status"
    >
      {/* HeaderHero padronizado (sem breadcrumbs) */}
      <HeaderHero
        title="Dashboard Analítico"
        subtitle="Indicadores de eventos, inscrições, presenças e certificados"
        variant="petroleo" // cor exclusiva desta página
      />

      <div id="conteudo" className="px-4 sm:px-6 max-w-7xl mx-auto py-6">
        {/* Ações e filtros */}
        <section
          aria-label="Filtros do dashboard"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6"
        >
          <div className="flex flex-col">
            <label htmlFor="filtro-ano" className="text-xs sm:text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">
              Ano
            </label>
            <select
              id="filtro-ano"
              className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/60"
              value={filtros.ano}
              onChange={handleFiltro("ano")}
            >
              <option value="">Todos</option>
              <option>2026</option>
              <option>2025</option>
              <option>2024</option>
              <option>2023</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="filtro-mes" className="text-xs sm:text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">
              Mês
            </label>
            <select
              id="filtro-mes"
              className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/60"
              value={filtros.mes}
              onChange={handleFiltro("mes")}
            >
              <option value="">Todos</option>
              <option value="01">Janeiro</option>
              <option value="02">Fevereiro</option>
              <option value="03">Março</option>
              <option value="04">Abril</option>
              <option value="05">Maio</option>
              <option value="06">Junho</option>
              <option value="07">Julho</option>
              <option value="08">Agosto</option>
              <option value="09">Setembro</option>
              <option value="10">Outubro</option>
              <option value="11">Novembro</option>
              <option value="12">Dezembro</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="filtro-tipo" className="text-xs sm:text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">
              Tipo de evento
            </label>
            <select
              id="filtro-tipo"
              className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/60"
              value={filtros.tipo}
              onChange={handleFiltro("tipo")}
            >
              <option value="">Todos</option>
              <option value="curso">Curso</option>
              <option value="palestra">Palestra</option>
              <option value="oficina">Oficina</option>
              <option value="congresso">Congresso</option>
              <option value="simpósio">Simpósio</option>
            </select>
          </div>

          {/* Espaço flex e botões */}
          <div className="hidden lg:block" />
          <div className="flex items-end gap-2">
            <Botao
              onClick={recarregar}
              variant="secondary"
              size="md"
              className="w-full"
              ariaLabel="Recarregar dados do dashboard"
              title="Recarregar (mesmos filtros)"
            >
              Atualizar
            </Botao>
            <Botao
              onClick={() => setFiltros({ ano: "", mes: "", tipo: "" })}
              variant="outline"
              size="md"
              className="w-full"
              ariaLabel="Limpar filtros"
              title="Limpar filtros"
            >
              Limpar
            </Botao>
          </div>
        </section>

        {/* Status SR */}
        <p id="dash-status" className="sr-only">
          {carregando ? "Carregando dados…" : erro ? "Erro ao carregar dados" : "Dados carregados"}
        </p>

        {/* Mini-stats */}
        {carregando ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={100} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <MiniStat label="Eventos" value={dados.totalEventos ?? "—"} accent="teal" />
            <MiniStat label="Inscritos únicos" value={dados.totalInscritos ?? "—"} accent="violet" />
            <MiniStat label="Certificados emitidos" value={dados.totalCertificados ?? "—"} accent="amber" />
            <MiniStat
              label="Presença média"
              value={dados.mediaPresenca != null ? Math.round(dados.mediaPresenca) : "—"}
              unit="%"
              accent="rose"
            />
          </div>
        )}

        {/* Estados de erro / vazio */}
        {!carregando && erro && (
          <div className="rounded-2xl border border-red-300 bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800 p-4 mb-6">
            {erro}
          </div>
        )}

        {!carregando && !erro && !temSeries && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-center text-gray-700 dark:text-gray-300 mb-6">
            Nenhum dado encontrado para os filtros selecionados.
          </div>
        )}

        {/* Gráficos */}
        {!carregando && !erro && temSeries && (
          <section aria-label="Gráficos do dashboard" className="space-y-6">
            <TituloSecao accent="petroleo" size="md" noBorder>
              Gráficos do período selecionado
            </TituloSecao>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <GraficoBox
                titulo="📅 Eventos por Mês"
                onExport={() => exportChartCSV("eventos_por_mes", eventosPorMes)}
                hasData={Boolean(eventosPorMes?.labels?.length)}
              >
                <div className="h-64 md:h-72">
                  {eventosPorMes?.labels?.length ? (
                    <Bar data={eventosPorMes} options={chartOptions} />
                  ) : (
                    <GraficoEmpty />
                  )}
                </div>
              </GraficoBox>

              <GraficoBox
                titulo="📚 Tipo de Evento"
                onExport={() => exportChartCSV("eventos_por_tipo", eventosPorTipo)}
                hasData={Boolean(eventosPorTipo?.labels?.length)}
              >
                <div className="h-64 md:h-72">
                  {eventosPorTipo?.labels?.length ? (
                    <Pie data={eventosPorTipo} options={chartOptions} />
                  ) : (
                    <GraficoEmpty />
                  )}
                </div>
              </GraficoBox>

              <GraficoBox
                titulo="👥 Inscritos vs Presença (%)"
                onExport={() => exportChartCSV("inscritos_presenca", presencaPorEvento)}
                hasData={Boolean(presencaPorEvento?.labels?.length)}
              >
                <div className="h-64 md:h-72">
                  {presencaPorEvento?.labels?.length ? (
                    <Line data={presencaPorEvento} options={chartOptions} />
                  ) : (
                    <GraficoEmpty />
                  )}
                </div>
              </GraficoBox>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

/* ===================== Subcomponentes ===================== */
function GraficoBox({ titulo, onExport, hasData, children }) {
  return (
    <section
      className="rounded-2xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-gray-700 p-4"
      role="group"
      aria-label={titulo}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">{titulo}</h4>

        <div className="flex items-center gap-2">
          <Botao
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={!hasData}
            ariaLabel="Exportar gráfico em CSV"
            title="Exportar CSV"
          >
            Exportar CSV
          </Botao>
        </div>
      </div>
      {children}
    </section>
  );
}
GraficoBox.propTypes = {
  titulo: PropTypes.string.isRequired,
  onExport: PropTypes.func,
  hasData: PropTypes.bool,
  children: PropTypes.node.isRequired,
};

function GraficoEmpty() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
        Sem dados para este gráfico
      </div>
    </div>
  );
}
