// ✅ src/pages/DashboardAnalitico.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, Pie } from "react-chartjs-2";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import { motion } from "framer-motion";

import PageHeader from "../components/PageHeader";
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

  const [ano, setAno] = useState("");
  const [mes, setMes] = useState("");
  const [tipo, setTipo] = useState("");

  const liveRef = useRef(null);

  async function carregarDados() {
    try {
      setCarregando(true);
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
      toast.error("Erro ao carregar dados do painel analítico");
      setLive("Falha ao carregar os dados.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mes, tipo]);

  const limparFiltros = () => {
    setAno("");
    setMes("");
    setTipo("");
  };

  // ---------- helpers ----------
  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  const clampPct = (n) => {
    const v = Number(n);
    if (Number.isNaN(v)) return 0;
    return Math.min(100, Math.max(0, v));
  };

  // Garante formato seguro pro Chart.js (evita erro com undefined/null)
  const ensureChart = (src) => {
    if (!src || !Array.isArray(src.labels) || !Array.isArray(src.datasets)) {
      return { labels: [], datasets: [] };
    }
    return src;
  };

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
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } },
      },
      maintainAspectRatio: false,
    }),
    []
  );
  // --------------------------------

  const temGraficoMes = evPorMesData.labels.length && evPorMesData.datasets.length;
  const temGraficoTipo = evPorTipoData.labels.length && evPorTipoData.datasets.length;
  const temGraficoPres = presencaPorEventoData.labels.length && presencaPorEventoData.datasets.length;

  return (
    <>
      <PageHeader
        title="📊 Painel de Indicadores"
        subtitle="Visão analítica dos eventos e participações"
        actions={
          <button
            type="button"
            onClick={carregarDados}
            disabled={carregando}
            className={`px-3 py-1.5 text-sm rounded-md border transition
              ${carregando
                ? "opacity-60 cursor-not-allowed bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                : "bg-lousa text-white hover:bg-green-800"}`}
            aria-label="Atualizar indicadores"
          >
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        }
      />

      <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-3 sm:px-4 py-6">
        {/* Live region acessível */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {/* 🎯 Filtros */}
        <section
          aria-label="Filtros do painel"
          className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-6"
        >
          <label className="sr-only" htmlFor="filtro-ano">Ano</label>
          <select
            id="filtro-ano"
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            className="p-2 rounded border dark:bg-zinc-800 dark:text-white min-w-[160px]"
          >
            <option value="">Todos os Anos</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
          </select>

          <label className="sr-only" htmlFor="filtro-mes">Mês</label>
          <select
            id="filtro-mes"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="p-2 rounded border dark:bg-zinc-800 dark:text-white min-w-[160px]"
          >
            <option value="">Todos os Meses</option>
            {[...Array(12)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString("pt-BR", { month: "long" }).replace(/^\w/, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="filtro-tipo">Tipo</label>
          <select
            id="filtro-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="p-2 rounded border dark:bg-zinc-800 dark:text-white min-w-[160px]"
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

          {(ano || mes || tipo) && (
            <button
              onClick={limparFiltros}
              className="px-4 py-2 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-white hover:opacity-90"
              aria-label="Limpar filtros do painel"
            >
              Limpar Filtros
            </button>
          )}
        </section>

        {/* Conteúdo */}
        {carregando ? (
          <div className="space-y-4">
            <Skeleton height={90} count={1} />
            <Skeleton height={200} count={2} />
          </div>
        ) : (
          <>
            {/* 🔢 Indicadores */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Indicador titulo="Total de Eventos" valor={dados?.totalEventos ?? 0} />
              <Indicador titulo="Inscritos Únicos" valor={dados?.inscritosUnicos ?? 0} />
              <Indicador titulo="Média de Avaliações" valor={`${Number(dados?.mediaAvaliacoes || 0).toFixed(1)} ⭐`} />
              <Indicador titulo="% Presença Média" valor={`${clampPct(dados?.percentualPresenca ?? 0).toFixed(1)}%`} />
            </section>

            {/* 📊 Gráficos */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              <ChartCard title="Eventos por Mês">
                {temGraficoMes ? (
                  <div style={{ height: 320 }}>
                    <Bar data={evPorMesData} options={{ maintainAspectRatio: false }} />
                  </div>
                ) : (
                  <NoData />
                )}
              </ChartCard>

              <ChartCard title="Eventos por Tipo">
                {temGraficoTipo ? (
                  <div style={{ height: 320 }}>
                    <Pie data={evPorTipoData} options={{ maintainAspectRatio: false }} />
                  </div>
                ) : (
                  <NoData />
                )}
              </ChartCard>
            </section>

            <ChartCard title="Presença por Evento (%)">
              {temGraficoPres ? (
                <div style={{ height: 360 }}>
                  <Bar data={presencaPorEventoData} options={barPctOptions} />
                </div>
              ) : (
                <NoData />
              )}
            </ChartCard>
          </>
        )}
      </main>

      <Footer />
    </>
  );
}

/* ============== UI Helpers ============== */
function ChartCard({ title, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow p-4"
    >
      <h2 className="text-center font-semibold mb-4">{title}</h2>
      {children}
    </motion.div>
  );
}

function Indicador({ titulo, valor }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center">
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{titulo}</p>
      <p className="text-2xl font-bold text-lousa dark:text-white">{valor}</p>
    </div>
  );
}

function NoData() {
  return (
    <div className="h-40 flex items-center justify-center text-gray-500 dark:text-gray-300 text-sm italic">
      Sem dados para exibir.
    </div>
  );
}
