// 📁 src/pages/AnaliticDashboard.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Bar, Pie, Line } from "react-chartjs-2";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import Breadcrumbs from "../components/Breadcrumbs";
import { apiGet } from "../services/api";
import PropTypes from "prop-types";

/** Util helpers */
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

export default function DashboardAnalitico() {
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState({});
  const [erro, setErro] = useState("");
  const [filtros, setFiltros] = useState({ ano: "", mes: "", tipo: "" });

  const abortRef = useRef(null);

  const handleFiltro = useCallback(
    (field) => (e) => {
      setFiltros((prev) => ({ ...prev, [field]: e.target.value }));
    },
    []
  );

  useEffect(() => {
    async function load() {
      // aborta requisições anteriores
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setCarregando(true);
      setErro("");

      try {
        const query = new URLSearchParams(clean(filtros)).toString();
        const url = `/api/dashboard-analitico${query ? `?${query}` : ""}`;

        const data = await apiGet(url, {
          signal: controller.signal,
        });

        setDados(data || {});
      } catch (err) {
        if (err?.name === "AbortError") return; // ignora corrida
        setDados({});
        setErro("Falha ao obter dados. Tente novamente.");
        toast.error("❌ Falha ao obter dados");
      } finally {
        setCarregando(false);
      }
    }
    load();

    return () => {
      abortRef.current?.abort();
    };
  }, [filtros]);

  // opções base para gráficos (sem cores específicas)
  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true } },
        tooltip: { mode: "index", intersect: false },
      },
      interaction: { mode: "nearest", intersect: false },
    }),
    []
  );

  const temSeries =
    dados &&
    (dados.eventosPorMes || dados.eventosPorTipo || dados.presencaPorEvento);

  return (
    <main
      className="px-4 py-6"
      aria-busy={carregando}
      aria-live="polite"
      aria-describedby="dash-status"
    >
      <Breadcrumbs
        trilha={[
          { label: "Painel administrador", href: "/administrador" },
          { label: "Dashboard Analítico" },
        ]}
      />
      <h1 className="text-2xl md:text-3xl font-bold mb-4 text-verde-900 dark:text-verde-900/80">
        📊 Painel de Indicadores
      </h1>

      {/* Filtros */}
      <section
        aria-label="Filtros do dashboard"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"
      >
        <div className="flex flex-col">
          <label htmlFor="filtro-ano" className="text-sm font-medium mb-1">
            Ano
          </label>
          <select
            id="filtro-ano"
            className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-900/60"
            value={filtros.ano}
            onChange={handleFiltro("ano")}
          >
            <option value="">Todos</option>
            <option>2025</option>
            <option>2024</option>
            <option>2023</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label htmlFor="filtro-mes" className="text-sm font-medium mb-1">
            Mês
          </label>
          <select
            id="filtro-mes"
            className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-900/60"
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
          <label htmlFor="filtro-tipo" className="text-sm font-medium mb-1">
            Tipo de evento
          </label>
          <select
            id="filtro-tipo"
            className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-900/60"
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
      </section>

      {/* Status de carregamento/erro para leitores de tela */}
      <p id="dash-status" className="sr-only">
        {carregando ? "Carregando dados…" : erro ? "Erro ao carregar dados" : "Dados carregados"}
      </p>

      {/* Indicadores numéricos ou Skeleton */}
      {carregando ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={100} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Indicador titulo="Eventos" valor={dados.totalEventos} />
          <Indicador titulo="Inscritos únicos" valor={dados.totalInscritos} />
          <Indicador titulo="Certificados emitidos" valor={dados.totalCertificados} />
          <Indicador titulo="Presença média" valor={fmtPercent(dados.mediaPresenca)} sufixo="" />
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
        <section
          aria-label="Gráficos do dashboard"
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          <GraficoBox titulo="📅 Eventos por Mês">
            <div className="h-64 md:h-72">
              <Bar data={dados.eventosPorMes} options={chartOptions} />
            </div>
          </GraficoBox>

          <GraficoBox titulo="📚 Tipo de Evento">
            <div className="h-64 md:h-72">
              <Pie data={dados.eventosPorTipo} options={chartOptions} />
            </div>
          </GraficoBox>

          <GraficoBox titulo="👥 Inscritos vs Presença (%)">
            <div className="h-64 md:h-72">
              <Line data={dados.presencaPorEvento} options={chartOptions} />
            </div>
          </GraficoBox>
        </section>
      )}
    </main>
  );
}

/** Indicador numérico */
function Indicador({ titulo, valor, sufixo = "" }) {
  return (
    <div className="bg-verde-900 text-white p-4 rounded-2xl shadow-md text-center">
      <h3 className="text-xs md:text-sm opacity-90">{titulo}</h3>
      <p className="text-2xl md:text-3xl font-bold mt-1">{valor ?? "—"}{sufixo}</p>
    </div>
  );
}

Indicador.propTypes = {
  titulo: PropTypes.string.isRequired,
  valor: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  sufixo: PropTypes.string,
};

/** Wrapper de gráfico com título e acessibilidade */
function GraficoBox({ titulo, children }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-gray-700 p-4">
      <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">{titulo}</h4>
      {children}
    </section>
  );
}

GraficoBox.propTypes = {
  titulo: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};
