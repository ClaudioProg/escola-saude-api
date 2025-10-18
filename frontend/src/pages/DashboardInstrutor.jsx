// ✅ src/pages/DashboardInstrutor.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "react-toastify";
import {
  RefreshCw,
  Presentation,
  CalendarDays,
  BarChart3,
  Star,
  Users,
} from "lucide-react";

import Footer from "../components/Footer";
import { apiGet } from "../services/api";

/* ───────────── Chart.js ───────────── */
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
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, PointElement, LineElement);

/* ───────────── Helpers ───────────── */
const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const hojeYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const isHoje = (d) => ymd(d) === hojeYMD();
const isProximosDias = (d, dias = 7) => {
  const base = new Date(hojeYMD());
  const alvo = new Date(`${ymd(d)}T12:00:00`);
  const diff = (alvo - base) / (1000 * 60 * 60 * 24);
  return diff > 0 && diff <= dias;
};
const clampPct = (n) => Math.min(100, Math.max(0, Number(n) || 0));

/* ───────────── Header/Hero (padronizado app-wide) ───────────── */
function DashboardHero({ onRefresh, carregando }) {
  return (
    <header
      className="bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-700 text-white"
      role="banner"
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <Presentation className="w-6 h-6" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Painel do Instrutor
          </h1>
        </div>
        <p className="text-sm sm:text-base text-white/90 max-w-2xl">
          Visão geral das suas turmas, presenças e avaliações.
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={carregando}
          className={[
            "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold",
            "bg-white/15 hover:bg-white/25 border border-white/20",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
            carregando ? "opacity-60 cursor-not-allowed" : "",
          ].join(" ")}
          aria-label="Atualizar painel do instrutor"
          title="Atualizar"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          {carregando ? "Atualizando…" : "Atualizar"}
        </button>
      </div>
    </header>
  );
}

/* ───────────── Página ───────────── */
export default function DashboardInstrutor() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [kpi, setKpi] = useState({
    totalTurmas: 0,
    aulasHoje: 0,
    proximasAulas: 0,
    presencaMediaGeral: 0, // %
    notaMediaGeral: 0,     // 0–10
    totalAvaliacoes: 0,
  });

  const [seriePresencaTurma, setSeriePresencaTurma] = useState({ labels: [], datasets: [] });
  const [serieNotaEvento, setSerieNotaEvento] = useState({ labels: [], datasets: [] });
  const [serieCargaProximos, setSerieCargaProximos] = useState({ labels: [], datasets: [] });

  const liveRef = useRef(null);
  const setLive = (m) => { if (liveRef.current) liveRef.current.textContent = m; };
  const reduceMotion = useReducedMotion();

  const usuarioId = (() => {
    try { return Number(JSON.parse(localStorage.getItem("usuario") || "{}")?.id) || null; }
    catch { return null; }
  })();

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");
      setLive("Carregando dados do painel…");

      // 1) Turmas do instrutor
      const turmas = await apiGet("/api/instrutor/minhas/turmas", { on403: "silent" }).catch(() => []);
      const turmasArr = Array.isArray(turmas) ? turmas : [];
      const totalTurmas = turmasArr.length;

      // 2) Eventos + notas médias (0–10 já ajustado no seu controller)
      let notasEventos = [];
      if (usuarioId) {
        const ev = await apiGet(`/api/instrutor/${usuarioId}/eventos-avaliacoes`, { on403: "silent" }).catch(() => []);
        notasEventos = Array.isArray(ev) ? ev : [];
      }

      // 3) Presenças por turma (concorrência limitada)
      const limit = 6; // top N para gráficos
      const turmasOrdenadas = turmasArr
        .slice()
        .sort((a, b) => (new Date(ymd(b.data_inicio || b.data_fim)) - new Date(ymd(a.data_inicio || a.data_fim))))
        .slice(0, limit);

      const fetchPresenca = async (tid) => {
        const det = await apiGet(`/presencas/turma/${tid}/detalhes`, { on403: "silent" }).catch(() => null);
        const datas = Array.isArray(det?.datas) ? det.datas : [];
        const usuarios = Array.isArray(det?.usuarios) ? det.usuarios : [];
        const passados = datas.filter((d) => ymd(d?.data) <= hojeYMD());
        const totalEncontrosPassados = passados.length;

        let presentesTotal = 0;
        if (totalEncontrosPassados > 0) {
          for (const u of usuarios) {
            const pres = Array.isArray(u.presencas) ? u.presencas : [];
            const set = new Map(pres.map((p) => [ymd(p.data_presenca || p.data), !!p.presente]));
            for (const d of passados) {
              if (set.get(ymd(d?.data)) === true) presentesTotal += 1;
            }
          }
        }
        const totalPossiveis = totalEncontrosPassados * usuarios.length;
        const pct = totalPossiveis > 0 ? Math.round((presentesTotal / totalPossiveis) * 1000) / 10 : 0; // 1 casa
        return { turmaId: tid, pct, datas, usuarios };
      };

      // concorrência simples (chunk de 3)
      const chunks = [];
      for (let i = 0; i < turmasOrdenadas.length; i += 3) chunks.push(turmasOrdenadas.slice(i, i + 3));
      const presPorTurma = [];
      for (const grupo of chunks) {
        const res = await Promise.allSettled(grupo.map((t) => fetchPresenca(Number(t.id))));
        res.forEach((r) => { if (r.status === "fulfilled" && r.value) presPorTurma.push(r.value); });
      }

      // KPIs derivados
      const aulasHoje = turmasArr.reduce((acc, t) => {
        const dI = ymd(t?.data_inicio), dF = ymd(t?.data_fim);
        const dts = Array.isArray(t?.datas) ? t.datas : [];
        if (dts.length) {
          return acc + dts.filter((d) => isHoje(ymd(d?.data || d))).length;
        }
        if (dI && dF && (isHoje(dI) || isHoje(dF))) return acc + 1; // correção de precedência
        return acc;
      }, 0);

      const proximasAulas = turmasArr.reduce((acc, t) => {
        const dts = Array.isArray(t?.datas) ? t.datas : [];
        if (!dts.length) return acc;
        return acc + dts.filter((d) => isProximosDias(ymd(d?.data || d), 7)).length;
      }, 0);

      const presGeral = (() => {
        if (!presPorTurma.length) return 0;
        const media = presPorTurma.reduce((s, it) => s + (Number(it.pct) || 0), 0) / presPorTurma.length;
        return Math.round(clampPct(media) * 10) / 10;
      })();

      const notaMediaGeral = (() => {
        if (!notasEventos.length) return 0;
        const vs = notasEventos.map((e) => Number(e?.nota_media)).filter((x) => Number.isFinite(x));
        if (!vs.length) return 0;
        const m = vs.reduce((a, b) => a + b, 0) / vs.length;
        return Math.round(m * 10) / 10; // 1 casa
      })();

      // Total de avaliações (aproximação)
      const totalAvaliacoes = notasEventos.length;

      setKpi({
        totalTurmas,
        aulasHoje,
        proximasAulas,
        presencaMediaGeral: presGeral,
        notaMediaGeral,
        totalAvaliacoes,
      });

      // Séries: Presença por Turma
      const labelsPres = turmasOrdenadas.map((t) => String(t?.nome || `Turma ${t?.id}`));
      const mapPct = new Map(presPorTurma.map((x) => [String(x.turmaId), x.pct]));
      const dataPres = turmasOrdenadas.map((t) => Number(mapPct.get(String(t.id)) || 0));
      setSeriePresencaTurma({
        labels: labelsPres,
        datasets: [{ label: "% Presença média", data: dataPres }],
      });

      // Séries: Nota por Evento
      const labelsNota = notasEventos.map((e) => String(e?.evento || `Evento ${e?.evento_id}`));
      const dataNota = notasEventos.map((e) => Number(e?.nota_media || 0));
      setSerieNotaEvento({
        labels: labelsNota,
        datasets: [{ label: "Nota média (0–10)", data: dataNota }],
      });

      // Série: Carga de aulas nos próximos 14 dias
      const prox14 = (() => {
        const mapa = new Map();
        const hoje = new Date(hojeYMD());
        for (let i = 0; i < 14; i++) {
          const d = new Date(hoje); d.setDate(d.getDate() + i);
          const key = d.toISOString().slice(0, 10);
          mapa.set(key, 0);
        }
        for (const t of turmasArr) {
          const dts = Array.isArray(t?.datas) ? t.datas : [];
          for (const d of dts) {
            const k = ymd(d?.data || d);
            if (mapa.has(k)) mapa.set(k, mapa.get(k) + 1);
          }
        }
        const labels = Array.from(mapa.keys());
        const values = labels.map((k) => mapa.get(k));
        return { labels, values };
      })();
      setSerieCargaProximos({
        labels: prox14.labels,
        datasets: [{ label: "Aulas agendadas", data: prox14.values, tension: 0.35, pointRadius: 3 }],
      });

      setLive("Painel atualizado.");
    } catch (e) {
      console.error(e);
      setErro("Não foi possível carregar o painel do instrutor.");
      toast.error("Erro ao carregar painel do instrutor.");
      setKpi({ totalTurmas: 0, aulasHoje: 0, proximasAulas: 0, presencaMediaGeral: 0, notaMediaGeral: 0, totalAvaliacoes: 0 });
      setSeriePresencaTurma({ labels: [], datasets: [] });
      setSerieNotaEvento({ labels: [], datasets: [] });
      setSerieCargaProximos({ labels: [], datasets: [] });
      setLive("Falha ao carregar o painel.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, []);

  const barPctOptions = useMemo(() => ({
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y}%` } },
    },
    animation: reduceMotion ? false : undefined,
    scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } } },
    maintainAspectRatio: false,
  }), [reduceMotion]);

  const barNotaOptions = useMemo(() => ({
    plugins: { legend: { display: false } },
    animation: reduceMotion ? false : undefined,
    scales: { y: { beginAtZero: true, max: 10 } },
    maintainAspectRatio: false,
  }), [reduceMotion]);

  const lineOptions = useMemo(() => ({
    plugins: { legend: { display: false } },
    animation: reduceMotion ? false : undefined,
    scales: { y: { beginAtZero: true } },
    maintainAspectRatio: false,
  }), [reduceMotion]);

  return (
    <>
      <DashboardHero onRefresh={carregar} carregando={carregando} />

      <main id="conteudo" className="min-h-screen bg-gelo dark:bg-zinc-900 px-3 sm:px-4 py-6">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {/* KPIs (MINISTATS) */}
        {carregando ? (
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} height={110} className="rounded-2xl" />)}
          </div>
        ) : erro ? (
          <AlertCard message={erro} />
        ) : (
          <motion.section
            className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            aria-label="Indicadores do instrutor"
          >
            <MiniStat icon={Presentation} titulo="Minhas Turmas" valor={kpi.totalTurmas} descricao="Turmas vinculadas" accent="from-cyan-600 to-sky-600" />
            <MiniStat icon={CalendarDays} titulo="Aulas Hoje" valor={kpi.aulasHoje} descricao="Encontros no dia" accent="from-emerald-600 to-teal-600" />
            <MiniStat icon={CalendarDays} titulo="Próximos 7 dias" valor={kpi.proximasAulas} descricao="Aulas agendadas" accent="from-indigo-600 to-violet-600" />
            <MiniStat icon={Users} titulo="% Presença Média" valor={`${kpi.presencaMediaGeral.toFixed(1)}%`} descricao="Entre seus alunos" accent="from-amber-600 to-orange-600" />
            <MiniStat icon={Star} titulo="Nota Média (0–10)" valor={kpi.notaMediaGeral.toFixed(1)} descricao="Avaliação dos eventos" accent="from-fuchsia-600 to-rose-600" />
            <MiniStat icon={BarChart3} titulo="Eventos Avaliados" valor={kpi.totalAvaliacoes} descricao="Com avaliações registradas" accent="from-slate-600 to-gray-700" />
          </motion.section>
        )}

        {/* Gráficos */}
        <section className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <ChartCard title="% Presença média por Turma" ariaLabel="Gráfico de barras de presença média por turma">
            {carregando ? (
              <Skeleton height={320} className="rounded-2xl" />
            ) : seriePresencaTurma.labels.length ? (
              <div style={{ height: 320 }}>
                <Bar data={seriePresencaTurma} options={barPctOptions} />
              </div>
            ) : <NoData /> }
          </ChartCard>

          <ChartCard title="Nota média por Evento" ariaLabel="Gráfico de barras de nota média por evento">
            {carregando ? (
              <Skeleton height={320} className="rounded-2xl" />
            ) : serieNotaEvento.labels.length ? (
              <div style={{ height: 320 }}>
                <Bar data={serieNotaEvento} options={barNotaOptions} />
              </div>
            ) : <NoData /> }
          </ChartCard>
        </section>

        <section className="max-w-6xl mx-auto mt-6">
          <ChartCard title="Aulas agendadas nos próximos 14 dias" ariaLabel="Gráfico de linha com aulas agendadas para os próximos 14 dias">
            {carregando ? (
              <Skeleton height={320} className="rounded-2xl" />
            ) : serieCargaProximos.labels.length ? (
              <div style={{ height: 320 }}>
                <Line data={serieCargaProximos} options={lineOptions} />
              </div>
            ) : <NoData /> }
          </ChartCard>
        </section>
      </main>

      <Footer />
    </>
  );
}

/* ───────────── UI helpers ───────────── */
function AlertCard({ message }) {
  return (
    <div className="max-w-6xl mx-auto bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-2xl p-4" role="alert">
      {message}
    </div>
  );
}

function MiniStat({ icon: Icon, titulo, valor, descricao, accent = "from-slate-600 to-slate-700" }) {
  return (
    <motion.div
      className="bg-white dark:bg-zinc-800 rounded-2xl shadow p-4"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      role="group" aria-label={`${titulo}: ${valor}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`rounded-xl px-2 py-1 text-white text-xs font-medium bg-gradient-to-r ${accent}`}>
          {titulo}
        </div>
        <Icon className="w-5 h-5 text-black/60 dark:text-white/70" aria-hidden="true" />
      </div>
      <p className="text-3xl font-extrabold text-lousa dark:text-white leading-tight">{valor}</p>
      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{descricao}</p>
    </motion.div>
  );
}

function ChartCard({ title, children, ariaLabel }) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4"
      role="group" aria-label={ariaLabel || title}
    >
      <figcaption className="text-center font-semibold mb-4">{title}</figcaption>
      {children}
    </motion.figure>
  );
}

function NoData() {
  return (
    <div className="h-40 flex items-center justify-center text-gray-500 dark:text-gray-300 text-sm italic">
      Sem dados para exibir.
    </div>
  );
}
