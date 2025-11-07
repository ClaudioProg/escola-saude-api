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
import {
  CalendarDays,
  Users2,
  Star,
  Percent,
  RefreshCcw,
  Info,
} from "lucide-react";

ChartJS.register(BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend);

/* =========================================================
   Helpers de módulo
========================================================= */
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
        cutout: "60%",
      },
    ],
    _total: data.reduce((a, b) => a + b, 0),
  };
};

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

/* =========================================================
   HeaderHero
========================================================= */
function HeaderHero({ onRefresh, carregando }) {
  return (
    <header
      className="bg-gradient-to-br from-indigo-900 via-fuchsia-800 to-rose-700 text-white"
      role="banner"
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col items-center text-center gap-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Painel de Indicadores
        </h1>
        <p className="text-sm sm:text-base text-white/90 max-w-2xl">
          Visão analítica dos eventos, inscrições e presenças. Use os filtros abaixo para refinar a análise.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={carregando}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70
              ${carregando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"} text-white`}
            aria-label="Atualizar indicadores"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>
    </header>
  );
}

/* =========================================================
   Página principal
========================================================= */
export default function DashboardAnalitico() {
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState({
    totalEventos: 0,
    inscritosUnicos: 0,
    mediaAvaliacoes: 0,
    percentualPresenca: 0,
    totalInscritos: 0,
    totalElegiveis: 0,
    eventosPorMes: null,
    eventosPorTipo: null,
    presencaPorEvento: null,
  });

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

  // -------- Helpers --------
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

  // 📈 cálculo da % de presença média geral
  function porcentagemPresencaGeral() {
    try {
      const totalInscritos = Number(dados?.totalInscritos || 0);
      const totalElegiveis = Number(dados?.totalElegiveis || 0);
      if (!totalInscritos) return 0;
      const pct = (totalElegiveis / totalInscritos) * 100;
      return Math.min(100, Math.max(0, pct));
    } catch (e) {
      console.error("Erro ao calcular % presença média:", e);
      return 0;
    }
  }

  // ---------- Fetchs ----------
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

  async function carregarStats() {
    try {
      const res = await apiGet(`/api/usuarios/estatisticas`, { on403: "silent" });
      if (res && typeof res === "object") setStats(res);
    } catch (e) {
      console.error("Erro ao carregar /usuarios/estatisticas:", e);
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

  // -------- Charts --------
  const evPorMesData = useMemo(() => ensureChart(dados?.eventosPorMes), [dados]);
  const evPorTipoData = useMemo(() => ensureChart(dados?.eventosPorTipo), [dados]);

  const presencaPorEventoData = useMemo(() => {
    const base = ensureChart(dados?.presencaPorEvento);
    if (!base.datasets.length) return base;
  
    const labels = Array.isArray(base.labels) ? base.labels : [];
    const datasets = Array.isArray(base.datasets) ? base.datasets : [];
    const meta = Array.isArray(base.meta) ? base.meta : (Array.isArray(dados?.presencaPorEventoMeta) ? dados.presencaPorEventoMeta : null);
  
    let indices = labels.map((_, i) => i);
  
    // Tenta filtrar/sortear por eventos encerrados usando metadados (quando existirem)
    if (Array.isArray(meta) && meta.length === labels.length) {
      const normalizados = meta.map((m, i) => ({
        i,
        status: String(m?.status ?? "").toLowerCase(),
        encerradoEm:
          m?.encerradoEm || m?.data_fim || m?.dataFim || m?.fim || null,
      }));
  
      // Considera "encerrado" se status = encerrado ou se houver data de encerramento
      let encerrados = normalizados.filter(
        (m) => m.status === "encerrado" || !!m.encerradoEm
      );
  
      if (encerrados.length) {
        // Ordena por data de encerramento quando disponível; sem data vai para o início
        encerrados.sort((a, b) => {
          const da = a.encerradoEm ? new Date(a.encerradoEm).getTime() : 0;
          const db = b.encerradoEm ? new Date(b.encerradoEm).getTime() : 0;
          return da - db;
        });
        indices = encerrados.map((m) => m.i).slice(-5); // 5 mais recentes
      } else {
        indices = indices.slice(-5); // fallback
      }
    } else {
      indices = indices.slice(-5); // fallback quando não há meta
    }
  
    const fLabels = indices.map((i) => labels[i]);
    const fDatasets = datasets.map((ds) => ({
      ...ds,
      data: indices.map((i) =>
        Number(clampPct((ds.data || [])[i]).toFixed(1))
      ),
    }));
  
    return { labels: fLabels, datasets: fDatasets };
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

  const pieFaixa = useMemo(() => toPieDataset(stats.faixa_etaria || []), [stats]);
  const pieUnidade = useMemo(() => {
    const arr = (stats.por_unidade || []).map((x) => ({
      ...x,
      label: String(x?.label ?? "Não informado").trim() || "Não informado",
    }));
    return toPieDataset(arr);
  }, [stats]);
  const pieEscol = useMemo(() => toPieDataset(stats.por_escolaridade || []), [stats]);
  const pieCargo = useMemo(() => toPieDataset(stats.por_cargo || []), [stats]);
  const pieOriSex = useMemo(() => toPieDataset(stats.por_orientacao_sexual || []), [stats]);
  const pieGenero = useMemo(() => toPieDataset(stats.por_genero || []), [stats]);
  const pieDefic = useMemo(() => toPieDataset(stats.por_deficiencia || []), [stats]);
  const pieCor = useMemo(() => toPieDataset(stats.por_cor_raca || []), [stats]);

  // -------- UI --------
  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero onRefresh={carregarDados} carregando={carregando} />
      <main id="conteudo" className="flex-1 max-w-6xl mx-auto px-3 sm:px-4 py-6">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {/* Filtros */}
        <section
          aria-label="Filtros do painel"
          className="bg-white dark:bg-gray-800 rounded-2xl shadow p-3 sm:p-4 mb-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-end">
            <FieldSelect
              id="filtro-ano"
              label="Ano"
              value={ano}
              onChange={(e) => setAno(e.target.value)}
              options={[
                { value: "", label: "Todos os Anos" },
                { value: "2024", label: "2024" },
                { value: "2025", label: "2025" },
              ]}
            />
            <FieldSelect
              id="filtro-mes"
              label="Mês"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              options={[
                { value: "", label: "Todos os Meses" },
                ...[...Array(12)].map((_, i) => ({
                  value: String(i + 1),
                  label: new Date(0, i)
                    .toLocaleString("pt-BR", { month: "long" })
                    .replace(/^\w/, (c) => c.toUpperCase()),
                })),
              ]}
            />
            <FieldSelect
              id="filtro-tipo"
              label="Tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              options={[
                { value: "", label: "Todos os Tipos" },
                "Congresso", "Curso", "Oficina", "Palestra", "Seminário", "Simpósio", "Outros",
              ].map((t) => (typeof t === "string" ? { value: t, label: t } : t))}
            />

            <div className="flex gap-2 sm:justify-end">
              <button
                type="button"
                onClick={carregarDados}
                disabled={carregando}
                className={`px-3 py-2 text-sm rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500
                  ${carregando
                    ? "opacity-60 cursor-not-allowed bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    : "bg-rose-600 text-white hover:bg-rose-700"}`}
              >
                {carregando ? "Atualizando…" : "Aplicar"}
              </button>
              {(ano || mes || tipo) && (
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="px-3 py-2 text-sm rounded-lg bg-red-100 text-red-700 dark:bg-red-900 dark:text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Conteúdo principal */}
        {carregando ? (
          <div className="space-y-4" aria-busy="true">
            <Skeleton height={90} />
            <Skeleton height={220} count={2} />
            <Skeleton height={360} />
          </div>
        ) : erro ? (
          <AlertCard message={erro} />
        ) : (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MiniStat
                icon={CalendarDays}
                titulo="Total de Eventos"
                valor={safeNumber(dados?.totalEventos, 0)}
                descricao="Total no período filtrado"
                accent="from-violet-600 to-fuchsia-600"
              />
              <MiniStat
                icon={Users2}
                titulo="Inscritos Únicos"
                valor={safeNumber(dados?.inscritosUnicos, 0)}
                descricao="Pessoas únicas inscritas"
                accent="from-sky-600 to-cyan-600"
              />
              <MiniStat
                icon={Star}
                titulo="Média de Avaliações"
                valor={`${safeNumber(dados?.mediaAvaliacoes, 0).toFixed(1)} ⭐`}
                descricao="Média geral dos eventos"
                accent="from-amber-600 to-orange-600"
              />
              <MiniStat
  icon={Percent}
  titulo="% Presença Média"
  valor={`${safeNumber(dados?.percentualPresenca, 0).toFixed(1)}%`}
  descricao="Entre inscritos (freq ≥75%)"
  accent="from-emerald-600 to-teal-600"
/>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              <ChartCard title="Eventos por Mês">
                <div style={{ height: 320 }}>
                  {evPorMesData.labels.length ? <Bar data={evPorMesData} /> : <NoData />}
                </div>
              </ChartCard>
              <ChartCard title="Eventos por Tipo">
                <div style={{ height: 320 }}>
                  {evPorTipoData.labels.length ? <Pie data={evPorTipoData} /> : <NoData />}
                </div>
              </ChartCard>
            </section>

            <ChartCard title="Presença por Evento (%)">
              <div style={{ height: 360 }}>
                {presencaPorEventoData.labels.length ? (
                  <Bar data={presencaPorEventoData} options={barPctOptions} />
                ) : (
                  <NoData />
                )}
              </div>
            </ChartCard>

            {/* 🧑‍🤝‍🧑 Demografia — GRÁFICOS DE ROSCA */}
            <section className="mt-10">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <h2 className="text-base sm:text-lg font-semibold">População Cadastrada</h2>
                <span className="inline-flex items-center text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                  <Info className="h-4 w-4 mr-1" aria-hidden="true" />
                  Total de usuários: <strong className="ml-1">{stats?.total_usuarios ?? 0}</strong>
                </span>
              </div>

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

/* =========================================================
   Componentes de UI
========================================================= */
function FieldSelect({ id, label, value, onChange, options }) {
  return (
    <div className="flex flex-col">
      <label className="text-xs mb-1 text-slate-700 dark:text-slate-200" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        className="p-2 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
      >
        {options.map((opt) => (
          <option key={opt.value ?? opt} value={opt.value ?? opt}>
            {opt.label ?? opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function AlertCard({ message }) {
  return (
    <div
      className="bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-2xl p-4"
      role="alert"
    >
      {message}
    </div>
  );
}

function ChartCard({ title, children, ariaLabel }) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4"
      role="group"
      aria-label={ariaLabel || title}
    >
      <figcaption className="text-center font-semibold mb-4">{title}</figcaption>
      {children}
    </motion.figure>
  );
}

function MiniStat({ icon: Icon, titulo, valor, descricao, accent = "from-slate-600 to-slate-700" }) {
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4"
      role="group"
      aria-label={descricao || titulo}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`rounded-xl px-2 py-1 text-white text-xs font-medium bg-gradient-to-r ${accent}`}>
          {titulo}
        </div>
        <Icon className="h-5 w-5 text-black/60 dark:text-white/70" aria-hidden="true" />
      </div>
      <p className="text-3xl font-extrabold text-lousa dark:text-white leading-tight">{valor}</p>
      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{descricao}</p>
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

function PieCard({ title, data }) {
  const reduceMotion = useReducedMotion();
  const hasData = (data?._total || 0) > 0;
  const options = useMemo(() => pieOptions(data?._total || 0, reduceMotion), [data?._total, reduceMotion]);

  return (
    <motion.figure
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4"
      role="group"
      aria-label={`Gráfico de rosca: ${title}`}
    >
      <figcaption className="text-center font-semibold mb-3">{title}</figcaption>
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
    </motion.figure>
  );
}
