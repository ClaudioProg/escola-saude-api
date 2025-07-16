import { useEffect, useState } from "react";
import { Bar, Pie } from "react-chartjs-2";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import Breadcrumbs from "../components/Breadcrumbs";

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
        const token = localStorage.getItem("token");
        const query = new URLSearchParams();
        if (ano) query.append("ano", ano);
        if (mes) query.append("mes", mes);
        if (tipo) query.append("tipo", tipo);

        const res = await fetch(`http://localhost:3000/api/dashboard-analitico?${query.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Erro ao carregar indicadores");
        const data = await res.json();
        setDados(data);
      } catch (e) {
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
          <option value="2023">2023</option>
          <option value="2024">2024</option>
          <option value="2025">2025</option>
        </select>

        <select value={mes} onChange={(e) => setMes(e.target.value)} className="p-2 rounded border dark:bg-zinc-800 dark:text-white">
          <option value="">Todos os Meses</option>
          {[...Array(12)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Date(0, i).toLocaleString("pt-BR", { month: "long" }).replace(/^\w/, c => c.toUpperCase())}
            </option>
          ))}
        </select>

        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="p-2 rounded border dark:bg-zinc-800 dark:text-white">
          <option value="">Todos os Tipos</option>
          <option value="congresso">Congresso</option>
          <option value="curso">Curso</option>
          <option value="oficina">Oficina</option>
          <option value="palestra">Palestra</option>
          <option value="seminario">Seminário</option>
          <option value="simposio">Simpósio</option>
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
            <Indicador titulo="Total de Eventos" valor={dados.totalEventos} />
            <Indicador titulo="Inscritos Únicos" valor={dados.inscritosUnicos} />
            <Indicador titulo="Média de Avaliações" valor={`${(dados.mediaAvaliacoes || 0).toFixed(1)} ⭐`} />
            <Indicador titulo="% Presença Média" valor={`${dados.percentualPresenca}%`} />
          </div>

          {/* 📊 Gráficos de Barras e Pizza */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow p-4"
            >
              <h2 className="text-center font-semibold mb-4">Eventos por Mês</h2>
              {dados.eventosPorMes && <Bar data={dados.eventosPorMes} />}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow p-4"
            >
              <h2 className="text-center font-semibold mb-4">Eventos por Tipo</h2>
              {dados.eventosPorTipo && <Pie data={dados.eventosPorTipo} />}
            </motion.div>
          </div>

          {/* ✅ Gráfico de Presença */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 mb-10"
          >
            <h2 className="text-center font-semibold mb-4">Presença por Evento (%)</h2>
            {dados.presencaPorEvento && (
              <Bar
                data={dados.presencaPorEvento}
                options={{
                  plugins: {
                    legend: { display: false },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 100,
                      ticks: {
                        callback: (value) => `${value}%`,
                      },
                    },
                  },
                }}
              />
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
