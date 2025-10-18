// 📁 src/pages/AnaliticDashboard.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Bar, Pie, Line } from "react-chartjs-2";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import PropTypes from "prop-types";

import { apiGet } from "../services/api";

// ⚠️ Componentes novos/padronizados do seu design system
import HeaderHero from "../components/ui/HeaderHero";
import MiniStat from "../components/charts/MiniStat";
import Botao from "../components/ui/Botao";
import TituloSecao from "../components/ui/TituloSecao";

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

/* ===================== Página ===================== */
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

  const recarregar = useCallback(() => {
    // forçamos re-fetch mantendo filtros
    setFiltros((prev) => ({ ...prev }));
  }, []);

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

  // opções base para gráficos (sem definir cores fixas aqui)
  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true } },
        tooltip: { mode: "index", intersect: false },
      },
      interaction: { mode: "nearest", intersect: false },
      elements: { line: { tension: 0.25 } },
    }),
    []
  );

  const temSeries =
    dados &&
    (dados.eventosPorMes || dados.eventosPorTipo || dados.presencaPorEvento);

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

          {/* Espaço flex e botão de atualizar */}
          <div className="hidden lg:block" />
          <div className="flex items-end">
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
          </div>
        </section>

        {/* Status de carregamento/erro para leitores de tela */}
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
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

/* ===================== Subcomponentes ===================== */
function GraficoBox({ titulo, children }) {
  return (
    <section
      className="rounded-2xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-gray-700 p-4"
      role="group"
      aria-label={titulo}
    >
      <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">{titulo}</h4>
      {children}
    </section>
  );
}
GraficoBox.propTypes = {
  titulo: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};
