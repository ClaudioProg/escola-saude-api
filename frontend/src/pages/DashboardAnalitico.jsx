// ✅ src/pages/DashboardAnalitico.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, Pie } from "react-chartjs-2";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import { motion, useReducedMotion } from "framer-motion";
import Footer from "../components/Footer";
import { apiGet } from "../services/api";

import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend);

/* ==================== Helpers de módulo (fora do componente) ==================== */
// Paleta base p/ doughnut
const COLORS = [
  "#14532d", "#0ea5e9", "#9333ea", "#f59e0b", "#ef4444",
  "#14b8a6", "#3b82f6", "#f43f5e", "#84cc16", "#eab308",
  "#8b5cf6", "#06b6d4", "#f97316", "#22c55e", "#0f766e",
];
const colorAt = (i) => (i < COLORS.length ? COLORS[i] : `hsl(${(i * 47) % 360} 65% 45%)`);

const sanitizeArr = (arr) =>
  Array.isArray(arr)
    ? arr.map((x) => ({
        label: String(x?.label ?? "Não informado").trim() || "Não informado",
        value: Number.isFinite(Number(x?.value)) ? Math.max(0, Number(x.value)) : 0,
      }))
    : [];

const toPieDataset = (arr) => {
  const clean = sanitizeArr(arr);
  const labels = clean.map((i) => i.label);
  const data = clean.map((i) => i.value);
  const backgroundColor = clean.map((_, i) => colorAt(i));
  const borderColor = backgroundColor.map(() => "rgba(255,255,255,0.9)");
  return {
    labels,
    datasets: [
      {
        data,
        backgroundColor,
        borderColor,
        borderWidth: 2,
        hoverOffset: 4,
        cutout: "60%", // doughnut
      },
    ],
    _total: data.reduce((a, b) => a + b, 0),
  };
};

// 🔧 Opções do Pie/Doughnut — agora é função de módulo (não depende do escopo do componente)
const pieOptions = (total, reduceMotion) => ({
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        boxWidth: 10,
        usePointStyle: true,
        pointStyle: "circle",
        font: { size: 12 },
        generateLabels: (chart) => {
          const ds = chart.data.datasets?.[0] || {};
          const bg = ds.backgroundColor || [];
          return (chart.data.labels || []).map((raw, i) => {
            const label = String(raw ?? "—");
            return {
              text: label.length > 22 ? label.slice(0, 21) + "…" : label,
              fillStyle: bg[i],
              strokeStyle: bg[i],
              hidden: false,
              index: i,
            };
          });
        },
      },
    },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const label = ctx.label ?? "—";
          const v = Number(ctx.parsed) || 0;
          const pct = total ? ((v / total) * 100).toFixed(1) : "0.0";
          return `${label}: ${v} (${pct}%)`;
        },
      },
    },
  },
  animation: reduceMotion ? false : undefined,
  maintainAspectRatio: false,
});

/* ------------------------- HeaderHero (novo) ------------------------- */
function HeaderHero({ onRefresh, carregando }) {
  return (
    <header
      className="bg-gradient-to-br from-sky-900 via-cyan-800 to-emerald-700 text-white"
      role="banner"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
          Painel de Indicadores
        </h1>
        <p className="text-sm text-white/90 max-w-2xl">
          Visão analítica dos eventos, inscrições e presenças. Use os filtros abaixo para refinar a análise.
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={carregando}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70
              ${carregando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"} text-white`}
            aria-label="Atualizar indicadores"
          >
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------- Página ------------------------- */
export default function DashboardAnalitico() {
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState({
    totalEventos: 0,
    inscritosUnicos: 0,
    mediaAvaliacoes: 0,
    percentualPresenca: 0,
    eventosPorMes: null,
    eventosPorTipo: null,
    presencaPorEvento: null,
  });

  // 📊 Estatísticas demográficas (usuarios/estatisticas)
  const [stats, setStats] = useState({
    total_usuarios: 0,
    faixa_etaria: [],
    por_unidade: [],
    por_escolaridade: [],
    por_cargo: [],
    por_orientacao_sexual: [],
    por_genero: [],
    por_deficiencia: [],
    por_cor_raca: [],
  });

  const [ano, setAno] = useState("");
  const [mes, setMes] = useState("");
  const [tipo, setTipo] = useState("");
  const [erro, setErro] = useState("");

  const reduceMotion = useReducedMotion();
  const liveRef = useRef(null);

  // ---------- helpers ----------
  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  const safeNumber = (n, d = 0) => {
    const v = Number(n);
    return Number.isFinite(v) ? v : d;
  };

  const clampPct = (n) => {
    const v = Number(n);
    if (Number.isNaN(v)) return 0;
    return Math.min(100, Math.max(0, v));
  };

  const ensureChart = (src) => {
    if (!src || !Array.isArray(src.labels) || !Array.isArray(src.datasets)) {
      return { labels: [], datasets: [] };
    }
    return src;
  };

  async function carregarDados() {
    try {
      setCarregando(true);
      setErro("");
      setLive("Carregando dados…");

      const qs = new URLSearchParams();
      if (ano) qs.append("ano", ano);
      if (mes) qs.append("mes", mes);
      if (tipo) qs.append("tipo", tipo);

      const data = await apiGet(`/api/dashboard-analitico?${qs.toString()}`);
      setDados(data || {});
      setLive("Dados atualizados.");
    } catch (e) {
      console.error(e);
      setErro("Erro ao carregar dados do painel analítico.");
      toast.error("Erro ao carregar dados do painel analítico");
      setLive("Falha ao carregar os dados.");
    } finally {
      setCarregando(false);
    }
  }

  // 🔁 Estatísticas demográficas (chamada separada; sem filtros por enquanto)
  async function carregarStats() {
    try {
      const res = await apiGet(`/api/usuarios/estatisticas`, { on403: "silent" });
      if (res && typeof res === "object") setStats(res);
    } catch (e) {
      console.error("Erro ao carregar /usuarios/estatisticas:", e);
      // Não bloqueia a página
    }
  }

  useEffect(() => {
    carregarDados();
    carregarStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mes, tipo]);

  const limparFiltros = () => {
    setAno("");
    setMes("");
    setTipo("");
  };

  // ======== datasets seguros existentes ========
  const evPorMesData = useMemo(() => ensureChart(dados?.eventosPorMes), [dados]);
  const evPorTipoData = useMemo(() => ensureChart(dados?.eventosPorTipo), [dados]);

  const presencaPorEventoData = useMemo(() => {
    const base = ensureChart(dados?.presencaPorEvento);
    if (!base.datasets.length) return base;
    const datasets = base.datasets.map((ds) => ({
      ...ds,
      data: (ds.data || []).map((v) => Number(clampPct(v).toFixed(1))),
    }));
    return { ...base, datasets };
  }, [dados]);

  const barPctOptions = useMemo(
    () => ({
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y}%` } },
      },
      animation: reduceMotion ? false : undefined,
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } },
      },
      maintainAspectRatio: false,
    }),
    [reduceMotion]
  );

  const temGraficoMes = evPorMesData.labels.length && evPorMesData.datasets.length;
  const temGraficoTipo = evPorTipoData.labels.length && evPorTipoData.datasets.length;
  const temGraficoPres = presencaPorEventoData.labels.length && presencaPorEventoData.datasets.length;

  // ======== datasets dos DOUGHNUTS (usuarios/estatisticas) ========
  const pieFaixa   = useMemo(() => toPieDataset(stats.faixa_etaria || []), [stats]);
  const pieUnidade = useMemo(() => toPieDataset(stats.por_unidade || []), [stats]);
  const pieEscol   = useMemo(() => toPieDataset(stats.por_escolaridade || []), [stats]);
  const pieCargo   = useMemo(() => toPieDataset(stats.por_cargo || []), [stats]);
  const pieOriSex  = useMemo(() => toPieDataset(stats.por_orientacao_sexual || []), [stats]);
  const pieGenero  = useMemo(() => toPieDataset(stats.por_genero || []), [stats]);
  const pieDefic   = useMemo(() => toPieDataset(stats.por_deficiencia || []), [stats]);
  const pieCor     = useMemo(() => toPieDataset(stats.por_cor_raca || []), [stats]);

  /* ----------------------------- UI ----------------------------- */
  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* Header novo */}
      <HeaderHero onRefresh={carregarDados} carregando={carregando} />

      <main className="flex-1 max-w-6xl mx-auto px-3 sm:px-4 py-6">
        {/* Região viva para leitores de tela */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {/* 🎯 Filtros */}
        <section
          aria-label="Filtros do painel"
          className="bg-white dark:bg-gray-800 rounded-xl shadow p-3 sm:p-4 mb-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-end">
            <div className="flex flex-col">
              <label className="text-xs mb-1 text-slate-700 dark:text-slate-200" htmlFor="filtro-ano">
                Ano
              </label>
              <select
                id="filtro-ano"
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                className="p-2 rounded border dark:bg-zinc-800 dark:text-white"
              >
                <option value="">Todos os Anos</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs mb-1 text-slate-700 dark:text-slate-200" htmlFor="filtro-mes">
                Mês
              </label>
              <select
                id="filtro-mes"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="p-2 rounded border dark:bg-zinc-800 dark:text-white"
              >
                <option value="">Todos os Meses</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString("pt-BR", { month: "long" })
                      .replace(/^\w/, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs mb-1 text-slate-700 dark:text-slate-200" htmlFor="filtro-tipo">
                Tipo
              </label>
              <select
                id="filtro-tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="p-2 rounded border dark:bg-zinc-800 dark:text-white"
              >
                <option value="">Todos os Tipos</option>
                <option value="Congresso">Congresso</option>
                <option value="Curso">Curso</option>
                <option value="Oficina">Oficina</option>
                <option value="Palestra">Palestra</option>
                <option value="Seminário">Seminário</option>
                <option value="Simpósio">Simpósio</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div className="flex gap-2 sm:justify-end">
              <button
                type="button"
                onClick={carregarDados}
                disabled={carregando}
                className={`px-3 py-2 text-sm rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
                  ${carregando
                    ? "opacity-60 cursor-not-allowed bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
                aria-label="Atualizar indicadores"
              >
                {carregando ? "Atualizando…" : "Aplicar"}
              </button>

              {(ano || mes || tipo) && (
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="px-3 py-2 text-sm rounded-md bg-red-100 text-red-700 dark:bg-red-900 dark:text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  aria-label="Limpar filtros do painel"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Conteúdo */}
        {carregando ? (
          <div className="space-y-4" aria-busy="true" aria-live="polite">
            <Skeleton height={90} />
            <Skeleton height={220} count={2} />
            <Skeleton height={360} />
          </div>
        ) : erro ? (
          <div
            className="bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-xl p-4"
            role="alert"
          >
            {erro}
          </div>
        ) : (
          <>
            {/* 🔢 Indicadores */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Indicador
                titulo="Total de Eventos"
                valor={safeNumber(dados?.totalEventos, 0)}
                descricao="Quantidade total de eventos no período filtrado"
              />
              <Indicador
                titulo="Inscritos Únicos"
                valor={safeNumber(dados?.inscritosUnicos, 0)}
                descricao="Total de pessoas únicas inscritas nos eventos"
              />
              <Indicador
                titulo="Média de Avaliações"
                valor={`${safeNumber(dados?.mediaAvaliacoes, 0).toFixed(1)} ⭐`}
                descricao="Média geral das avaliações dos eventos"
              />
              <Indicador
                titulo="% Presença Média"
                valor={`${clampPct(dados?.percentualPresenca ?? 0).toFixed(1)}%`}
                descricao="Percentual médio de presença entre inscritos"
              />
            </section>

            {/* 📊 Gráficos existentes */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              <ChartCard
                title="Eventos por Mês"
                ariaLabel="Gráfico de barras mostrando a quantidade de eventos por mês"
              >
                {temGraficoMes ? (
                  <div style={{ height: 320 }}>
                    <Bar
                      data={evPorMesData}
                      options={{ maintainAspectRatio: false, animation: reduceMotion ? false : undefined }}
                    />
                  </div>
                ) : (
                  <NoData />
                )}
              </ChartCard>

              <ChartCard
                title="Eventos por Tipo"
                ariaLabel="Gráfico de pizza com a distribuição de eventos por tipo"
              >
                {temGraficoTipo ? (
                  <div style={{ height: 320 }}>
                    <Pie
                      data={evPorTipoData}
                      options={{ maintainAspectRatio: false, animation: reduceMotion ? false : undefined }}
                    />
                  </div>
                ) : (
                  <NoData />
                )}
              </ChartCard>
            </section>

            <ChartCard
              title="Presença por Evento (%)"
              ariaLabel="Gráfico de barras com o percentual de presença por evento"
            >
              {temGraficoPres ? (
                <div style={{ height: 360 }}>
                  <Bar data={presencaPorEventoData} options={barPctOptions} />
                </div>
              ) : (
                <NoData />
              )}
            </ChartCard>

            {/* 🧑‍🤝‍🧑 Demografia — GRÁFICOS DE ROSCA */}
            <section className="mt-10">
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
                População Cadastrada
              </h2>

              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-3">
                <strong>Total de usuários:</strong> {stats?.total_usuarios ?? 0}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <PieCard title="Faixa etária" data={pieFaixa} />
                <PieCard title="Unidade (sigla)" data={pieUnidade} />
                <PieCard title="Escolaridade" data={pieEscol} />
                <PieCard title="Cargo" data={pieCargo} />
                <PieCard title="Orientação sexual" data={pieOriSex} />
                <PieCard title="Gênero" data={pieGenero} />
                <PieCard title="Deficiência" data={pieDefic} />
                <PieCard title="Raça/Cor" data={pieCor} />
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

/* ============== UI Helpers ============== */
function ChartCard({ title, children, ariaLabel }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow p-4"
      role="img"
      aria-label={ariaLabel || title}
    >
      <h2 className="text-center font-semibold mb-4">{title}</h2>
      {children}
    </motion.section>
  );
}

function Indicador({ titulo, valor, descricao }) {
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center"
      role="group"
      aria-label={descricao || titulo}
    >
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{titulo}</p>
      <p className="text-2xl font-bold text-lousa dark:text-white">{valor}</p>
    </div>
  );
}

function NoData() {
  return (
    <div className="h-40 flex items-center justify-center text-gray-600 dark:text-gray-300 text-sm italic">
      Sem dados para exibir.
    </div>
  );
}

/* ====== PieCard: card pronto para DOUGHNUT ====== */
function PieCard({ title, data }) {
  const reduceMotion = useReducedMotion();
  const hasData = (data?._total || 0) > 0;

  const options = useMemo(
    () => pieOptions(data?._total || 0, reduceMotion),
    [data?._total, reduceMotion]
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow p-4"
      role="img"
      aria-label={`Gráfico de rosca: ${title}`}
    >
      <h3 className="text-center font-semibold mb-3">{title}</h3>
      {hasData ? (
        <div style={{ height: 280 }}>
          <Pie data={data} options={options} />
        </div>
      ) : (
        <NoData />
      )}
      <p className="mt-3 text-xs sm:text-sm text-gray-600 dark:text-gray-300 text-center">
        <strong>Total:</strong> {data?._total || 0}
      </p>
    </motion.section>
  );
}
