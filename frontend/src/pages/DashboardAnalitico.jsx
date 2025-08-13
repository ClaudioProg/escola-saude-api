// src/pages/DashboardAnalitico.jsx
import { useEffect, useMemo, useState } from "react";
import { Bar, Pie } from "react-chartjs-2";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import Breadcrumbs from "../components/Breadcrumbs";
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

  useEffect(() => {
    async function carregarDados() {
      try {
        setCarregando(true);
        const qs = new URLSearchParams();
        if (ano) qs.append("ano", ano);
        if (mes) qs.append("mes", mes);
        if (tipo) qs.append("tipo", tipo);

        const data = await apiGet(`/api/dashboard-analitico?${qs.toString()}`);
        setDados(data || {});
      } catch (e) {
        console.error(e);
        toast.error("Erro ao carregar dados do painel analítico");
      } finally {
        setCarregando(false);
      }
    }
    carregarDados();
  }, [ano, mes, tipo]);

  const limparFiltros = () => {
    setAno("");
    setMes("");
    setTipo("");
  };

  // ---------- helpers ----------
  const clampPct = (n) => {
    const v = Number(n);
    if (Number.isNaN(v)) return 0;
    return Math.min(100, Math.max(0, v));
  };

  const evPorMesData = useMemo(() => {
    const src = dados?.eventosPorMes;
    if (!src || !Array.isArray(src.labels) || !Array.isArray(src.datasets)) return null;
    return src; // já no formato chart.js
  }, [dados]);

  const evPorTipoData = useMemo(() => {
    const src = dados?.eventosPorTipo;
    if (!src || !Array.isArray(src.labels) || !Array.isArray(src.datasets)) return null;
    return src;
  }, [dados]);

  const presencaPorEventoData = useMemo(() => {
    const src = dados?.presencaPorEvento;
    if (!src || !Array.isArray(src.labels) || !Array.isArray(src.datasets)) return null;
    // garante 0–100 e 1 casa
    const datasets = src.datasets.map((ds) => ({
      ...ds,
      data: (ds.data || []).map((v) => Number(clampPct(v).toFixed(1))),
    }));
    return { ...src, datasets };
  }, [dados]);

  const barPctOptions = useMemo(
    () => ({
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y}%` } } },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: (v) => `${v}%` },
        },
      },
      maintainAspectRatio: false,
    }),
    []
  );
  // --------------------------------

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-4 py-6">
      <Breadcrumbs trilha={[{ label: "Painel administrador" }, { label: "Dashboard Analítico" }]} />
      <h1 className="text-3xl font-bold text-black dark:text-white text-center mb-8">
        📊 Painel de Indicadores
      </h1>

      {/* 🎯 Filtros */}
      <div className="flex flex-wrap justify-center gap-4 mb-6">
        <select value={ano} onChange={(e) => setAno(e.target.value)} className="p-2 rounded border dark:bg-zinc-800 dark:text-white">
          <option value="">Todos os Anos</option>
          <option value="2024">2024</option>
          <option value="2025">2025</option>
        </select>

        <select value={mes} onChange={(e) => setMes(e.target.value)} className="p-2 rounded border dark:bg-zinc-800 dark:text-white">
          <option value="">Todos os Meses</option>
          {[...Array(12)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Date(0, i).toLocaleString("pt-BR", { month: "long" }).replace(/^\w/, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>

        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="p-2 rounded border dark:bg-zinc-800 dark:text-white">
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
            className="px-4 py-2 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-white hover:opacity-80"
          >
            Limpar Filtros
          </button>
        )}
      </div>

      {carregando ? (
        <div className="space-y-4">
          <Skeleton height={90} count={1} />
          <Skeleton height={200} count={2} />
        </div>
      ) : (
        <>
          {/* 🔢 Indicadores */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Indicador titulo="Total de Eventos" valor={dados?.totalEventos ?? 0} />
            <Indicador titulo="Inscritos Únicos" valor={dados?.inscritosUnicos ?? 0} />
            <Indicador titulo="Média de Avaliações" valor={`${Number(dados?.mediaAvaliacoes || 0).toFixed(1)} ⭐`} />
            <Indicador titulo="% Presença Média" valor={`${clampPct(dados?.percentualPresenca ?? 0).toFixed(1)}%`} />
          </div>

          {/* 📊 Gráficos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <h2 className="text-center font-semibold mb-4">Eventos por Mês</h2>
              {evPorMesData ? <Bar data={evPorMesData} /> : <NoData />}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <h2 className="text-center font-semibold mb-4">Eventos por Tipo</h2>
              {evPorTipoData ? <Pie data={evPorTipoData} /> : <NoData />}
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 mb-10">
            <h2 className="text-center font-semibold mb-4">Presença por Evento (%)</h2>
            {presencaPorEventoData ? (
              <div style={{ height: 320 }}>
                <Bar data={presencaPorEventoData} options={barPctOptions} />
              </div>
            ) : (
              <NoData />
            )}
          </motion.div>
        </>
      )}
    </main>
  );
}

function Indicador({ titulo, valor }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center">
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{titulo}</p>
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
