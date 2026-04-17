/* eslint-disable no-console */
// ✅ src/pages/GestaoPresenca.jsx (premium + mobile/PWA + a11y + filtros + ordenação desc + export PDF real)
// - HeaderHero com identidade própria (teal + glow) + ministats
// - Persistência do agrupamento e filtros (localStorage)
// - AbortController + mountedRef (evita setState em unmount)
// - Estados de erro premium + "Tentar novamente"
// - Barra de progresso fina + live region
// - Filtros premium: busca, status e mês
// - Ordenação: data mais nova -> mais antiga (turmas e eventos)
// - Export PDF real via backend
// - Mantém regra: ListaTurmasPresenca continua “dona” do fluxo de presenças

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  RefreshCcw,
  UsersRound,
  CalendarDays,
  AlertTriangle,
  Sparkles,
  Layers,
  Search,
  Filter,
  X,
 Clock3,
  Download,
} from "lucide-react";

import { apiGet, apiGetFile, downloadBlob } from "../services/api";
import Footer from "../components/Footer";
import Spinner from "../components/Spinner";
import ListaTurmasPresenca from "../components/ListaTurmasPresenca";

/* ---------------- localStorage keys ---------------- */
const LS_KEYS = {
  agrupamento: "presenca:agrupamento",
  busca: "presenca:busca",
  status: "presenca:status",
  mes: "presenca:mes",
};

/* ---------------- helpers de tempo (TZ BR / anti-fuso) ---------------- */
function nowBR() {
  return new Date();
}

function nowSPParts() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
}

function nowSPComparable() {
  const p = nowSPParts();
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

function normalizeYMD(value) {
  const s = String(value || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

function normalizeHHMM(value, fallback = "00:00") {
  const s = String(value || "").trim();
  const m = s.match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : fallback;
}

function turmaStartComparable(turma) {
  const di = normalizeYMD(turma?.data_inicio);
  const hi = normalizeHHMM(turma?.horario_inicio, "00:00");
  return di ? `${di}T${hi}:00` : "";
}

function turmaEndComparable(turma) {
  const df = normalizeYMD(turma?.data_fim);
  const hf = normalizeHHMM(turma?.horario_fim, "23:59");
  return df ? `${df}T${hf}:59` : "";
}

function getTurmaStatus(turma) {
  const start = turmaStartComparable(turma);
  const end = turmaEndComparable(turma);
  const now = nowSPComparable();

  if (!start || !end) return "programado";
  if (now < start) return "programado";
  if (now > end) return "encerrado";
  return "andamento";
}

function eventLatestComparable(evento) {
  const turmas = Array.isArray(evento?.turmas) ? evento.turmas : [];
  let latest = "";

  for (const turma of turmas) {
    const cmp = turmaStartComparable(turma);
    if (cmp && (!latest || cmp > latest)) latest = cmp;
  }

  return latest;
}

function sortTurmasDesc(turmas = []) {
  return [...turmas].sort((a, b) => {
    const da = turmaStartComparable(a);
    const db = turmaStartComparable(b);
    if (db !== da) return db.localeCompare(da);
    return String(b?.id || "").localeCompare(String(a?.id || ""));
  });
}

function sortEventosDesc(eventos = []) {
  return [...eventos].sort((a, b) => {
    const da = eventLatestComparable(a);
    const db = eventLatestComparable(b);
    if (db !== da) return db.localeCompare(da);
    return String(b?.titulo || "").localeCompare(String(a?.titulo || ""), "pt-BR");
  });
}

function isAbortLike(err) {
  const msg = String(err?.message || err || "").trim().toLowerCase();
  return (
    err?.name === "AbortError" ||
    msg === "new-request" ||
    msg === "unmount" ||
    msg.includes("abort") ||
    msg.includes("aborted") ||
    msg.includes("canceled") ||
    msg.includes("cancelled")
  );
}

/* ---------------- MiniStats ---------------- */
function MiniStat({
  icon: Icon,
  label,
  value,
  accent = "from-teal-600 to-emerald-500",
}) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/10 backdrop-blur px-4 py-3 text-left shadow-sm">
      <div className="flex items-center gap-2 text-white/90">
        <span
          className={`inline-flex w-9 h-9 rounded-xl items-center justify-center bg-gradient-to-r ${accent}`}
        >
          <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="text-xs text-white/80">{label}</div>
          <div className="text-xl font-extrabold tracking-tight">{value}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- HeaderHero (teal premium) ---------------- */
function HeaderHero({
  onAtualizar,
  atualizando,
  agrupamento,
  setAgrupamento,
  kpis,
}) {
  return (
    <header className="text-white relative overflow-hidden" role="banner">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-950 via-teal-800 to-cyan-700" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.10),transparent_45%),radial-gradient(circle_at_85%_35%,rgba(255,255,255,0.08),transparent_45%)]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-[320px] w-[900px] -translate-x-1/2 rounded-full blur-3xl opacity-25 bg-cyan-300"
      />

      <a
        href="#conteudo"
        className="relative sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 md:py-12 min-h-[160px] sm:min-h-[190px]">
        <div className="flex flex-col items-center text-center gap-3 sm:gap-4">
          <div className="inline-flex items-center justify-center gap-2">
            <ClipboardCheck className="w-6 h-6" aria-hidden="true" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Gestão de presenças
            </h1>
          </div>

          <p className="text-sm sm:text-base text-white/90 max-w-2xl">
            Visualize turmas, consulte inscritos e acompanhe presenças com segurança.
          </p>

          <div className="mt-1 grid grid-cols-2 lg:grid-cols-4 gap-3 w-full max-w-5xl">
            <MiniStat
              icon={Layers}
              label="Eventos exibidos"
              value={kpis.eventos}
              accent="from-cyan-600 to-sky-500"
            />
            <MiniStat
              icon={CalendarDays}
              label="Turmas exibidas"
              value={kpis.turmas}
              accent="from-emerald-600 to-teal-500"
            />
            <MiniStat
              icon={Clock3}
              label="Em andamento"
              value={kpis.andamento}
              accent="from-amber-500 to-orange-500"
            />
            <MiniStat
              icon={Sparkles}
              label="Agrupamento"
              value={agrupamento === "pessoa" ? "Pessoas" : "Datas"}
              accent="from-teal-500 to-cyan-500"
            />
          </div>

          <div className="mt-2 sm:mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onAtualizar}
              disabled={atualizando}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                atualizando
                  ? "opacity-60 cursor-not-allowed bg-white/20"
                  : "bg-white/15 hover:bg-white/25"
              } text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}
              aria-label="Atualizar lista de eventos"
              aria-busy={atualizando ? "true" : "false"}
              title="Atualizar"
            >
              <RefreshCcw className="w-4 h-4" aria-hidden="true" />
              {atualizando ? "Atualizando…" : "Atualizar"}
            </button>
          </div>

          <div className="mt-2 inline-flex items-center gap-1 bg-white/10 rounded-2xl p-1 border border-white/10">
            <button
              type="button"
              onClick={() => setAgrupamento("pessoa")}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition ${
                agrupamento === "pessoa"
                  ? "bg-white text-teal-800"
                  : "text-white/90 hover:bg-white/10"
              }`}
              aria-pressed={agrupamento === "pessoa"}
              title="Agrupar por pessoa (cada usuário e suas datas)"
            >
              <UsersRound className="w-4 h-4" aria-hidden="true" />
              Pessoas
            </button>
            <button
              type="button"
              onClick={() => setAgrupamento("data")}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition ${
                agrupamento === "data"
                  ? "bg-white text-teal-800"
                  : "text-white/90 hover:bg-white/10"
              }`}
              aria-pressed={agrupamento === "data"}
              title="Agrupar por data (cada data e todos os usuários)"
            >
              <CalendarDays className="w-4 h-4" aria-hidden="true" />
              Datas
            </button>
          </div>
        </div>
      </div>

      <div className="relative h-px w-full bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* ---------------- Toolbar premium ---------------- */
function ToolbarFiltros({
  busca,
  setBusca,
  statusFiltro,
  setStatusFiltro,
  mesFiltro,
  setMesFiltro,
  mesesDisponiveis,
  limparFiltros,
  filtrosAtivos,
}) {
  return (
    <section
      aria-label="Ferramentas de busca e filtros"
      className="sticky top-1 z-30 mx-auto mb-5 w-full max-w-6xl rounded-2xl border border-zinc-200 bg-white/80 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80"
    >
      <div className="flex flex-col gap-3">
        <div className="relative w-full">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            aria-hidden="true"
          />
          <input
            type="text"
            autoComplete="off"
            placeholder="Buscar por evento ou turma…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-xl border px-9 py-2 text-sm ring-offset-2 focus:outline-none focus:ring-2 focus:ring-teal-700 dark:border-zinc-700 dark:bg-zinc-800"
            aria-label="Buscar por evento ou turma"
          />
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              Filtros:
            </span>

            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="rounded-xl border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-700 dark:border-zinc-700 dark:bg-zinc-800"
              aria-label="Filtrar por status"
              title="Filtrar por status"
            >
              <option value="todos">Todos os status</option>
              <option value="programado">Programados</option>
              <option value="andamento">Em andamento</option>
              <option value="encerrado">Encerrados</option>
            </select>

            <select
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="rounded-xl border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-700 dark:border-zinc-700 dark:bg-zinc-800"
              aria-label="Filtrar por mês"
              title="Filtrar por mês"
            >
              <option value="todos">Todos os meses</option>
              {mesesDisponiveis.map((mes) => (
                <option key={mes} value={mes}>
                  {mes}
                </option>
              ))}
            </select>

            {filtrosAtivos && (
              <button
                type="button"
                onClick={limparFiltros}
                className="inline-flex items-center gap-1 rounded-xl border border-white/0 bg-zinc-100 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                aria-label="Limpar filtros"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Limpar filtros
              </button>
            )}
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Ordenação automática: <strong>mais novas → mais antigas</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Página ---------------- */
export default function PaginaGestaoPresencas() {
  const navigate = useNavigate();

  const [eventos, setEventos] = useState([]);
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacaoPorTurma, setAvaliacaoPorTurma] = useState({});
  const [carregandoEventos, setCarregandoEventos] = useState(true);
  const [erro, setErro] = useState("");

  const [agrupamento, setAgrupamento] = useState(
    () => localStorage.getItem(LS_KEYS.agrupamento) || "pessoa"
  );

  const [busca, setBusca] = useState(
    () => localStorage.getItem(LS_KEYS.busca) || ""
  );
  const [statusFiltro, setStatusFiltro] = useState(
    () => localStorage.getItem(LS_KEYS.status) || "todos"
  );
  const [mesFiltro, setMesFiltro] = useState(
    () => localStorage.getItem(LS_KEYS.mes) || "todos"
  );

  const [q, setQ] = useState("");

  const liveRef = useRef(null);
  const erroRef = useRef(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort?.("unmount");
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.agrupamento, agrupamento);
    } catch {}
  }, [agrupamento]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.busca, busca);
    } catch {}
  }, [busca]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.status, statusFiltro);
    } catch {}
  }, [statusFiltro]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.mes, mesFiltro);
    } catch {}
  }, [mesFiltro]);

  useEffect(() => {
    const t = setTimeout(() => setQ(String(busca || "").trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [busca]);

  const carregarEventos = useCallback(async () => {
    try {
      setCarregandoEventos(true);
      setErro("");
      setLive("Carregando eventos…");

      abortRef.current?.abort?.("new-request");
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const data = await apiGet("/api/presencas/admin/listar-tudo", {
        on403: "silent",
        signal: ctrl.signal,
      });

      const listaEventos = Array.isArray(data?.eventos)
        ? data.eventos
        : Array.isArray(data)
        ? data
        : Array.isArray(data?.lista)
        ? data.lista
        : [];

      if (!mountedRef.current) return;

      setEventos(listaEventos);
      setLive(`Eventos carregados: ${listaEventos.length}.`);
    } catch (err) {
      if (isAbortLike(err)) return;

      const msg = err?.message || "Erro ao carregar eventos.";
      if (!mountedRef.current) return;

      setErro(msg);
      setEventos([]);
      toast.error(msg);
      setLive("Falha ao carregar eventos.");

      setTimeout(() => erroRef.current?.focus?.(), 0);
    } finally {
      if (mountedRef.current) setCarregandoEventos(false);
    }
  }, []);

  useEffect(() => {
    carregarEventos();
  }, [carregarEventos]);

  async function carregarInscritos(turmaId) {
    try {
      setLive(`Carregando inscritos da turma ${turmaId}…`);
      const data = await apiGet(`/api/inscricao/turma/${turmaId}`, { on403: "silent" });
      const lista = Array.isArray(data) ? data : data?.lista;
      if (!mountedRef.current) return;
      setInscritosPorTurma((prev) => ({
        ...prev,
        [turmaId]: Array.isArray(lista) ? lista : [],
      }));
      setLive(`Inscritos da turma ${turmaId} carregados.`);
    } catch {
      toast.error("Erro ao carregar inscritos.");
      setLive("Falha ao carregar inscritos.");
    }
  }

  async function carregarAvaliacao(turmaId) {
    try {
      setLive(`Carregando avaliações da turma ${turmaId}…`);
      const data = await apiGet(`/api/avaliacao/turma/${turmaId}`, { on403: "silent" });
      if (!mountedRef.current) return;
      setAvaliacaoPorTurma((prev) => ({
        ...prev,
        [turmaId]: Array.isArray(data) ? data : [],
      }));
      setLive("Avaliações carregadas.");
    } catch {
      toast.error("Erro ao carregar avaliações.");
      setLive("Falha ao carregar avaliações.");
    }
  }

  const gerarRelatorioPDF = useCallback(async (turmaId, turmaNome = "lista-presenca") => {
    try {
      setLive(`Gerando PDF da turma ${turmaId}…`);
      const { blob, filename } = await apiGetFile(`/api/presencas/turma/${turmaId}/pdf`);
      downloadBlob(filename || `lista_presenca_${turmaNome}_${turmaId}.pdf`, blob);
      toast.success("PDF gerado com sucesso.");
      setLive("PDF gerado com sucesso.");
    } catch (err) {
      console.error("[GestaoPresenca] erro ao gerar PDF", err);
      toast.error(err?.message || "Não foi possível gerar o PDF.");
      setLive("Falha ao gerar PDF.");
    }
  }, []);

  const mesesDisponiveis = useMemo(() => {
    const set = new Set();

    for (const evento of eventos || []) {
      for (const turma of evento?.turmas || []) {
        const ymd = normalizeYMD(turma?.data_inicio);
        if (ymd) set.add(ymd.slice(0, 7));
      }
    }

    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [eventos]);

  const eventosProcessados = useMemo(() => {
    const base = sortEventosDesc(
      (eventos || []).map((evento) => ({
        ...evento,
        turmas: sortTurmasDesc(Array.isArray(evento?.turmas) ? evento.turmas : []),
      }))
    );

    const filtrados = [];

    for (const evento of base) {
      const tituloEvento = String(evento?.titulo || "").toLowerCase();

      const turmasFiltradas = (evento?.turmas || []).filter((turma) => {
        const nomeTurma = String(turma?.nome || "").toLowerCase();
        const status = getTurmaStatus(turma);
        const mes = normalizeYMD(turma?.data_inicio)?.slice(0, 7) || "";

        const bateBusca =
          !q || tituloEvento.includes(q) || nomeTurma.includes(q);

        const bateStatus =
          statusFiltro === "todos" ? true : status === statusFiltro;

        const bateMes =
          mesFiltro === "todos" ? true : mes === mesFiltro;

        return bateBusca && bateStatus && bateMes;
      });

      if (turmasFiltradas.length > 0) {
        filtrados.push({
          ...evento,
          turmas: turmasFiltradas,
        });
      }
    }

    return sortEventosDesc(filtrados);
  }, [eventos, q, statusFiltro, mesFiltro]);

  const kpis = useMemo(() => {
    const evCount = Array.isArray(eventosProcessados) ? eventosProcessados.length : 0;

    let turmasCount = 0;
    let andamentoCount = 0;

    for (const ev of eventosProcessados || []) {
      const ts = Array.isArray(ev?.turmas) ? ev.turmas : [];
      turmasCount += ts.length;
      andamentoCount += ts.filter((t) => getTurmaStatus(t) === "andamento").length;
    }

    return {
      eventos: evCount,
      turmas: turmasCount,
      andamento: andamentoCount,
    };
  }, [eventosProcessados]);

  const filtrosAtivos =
    !!busca.trim() || statusFiltro !== "todos" || mesFiltro !== "todos";

  const limparFiltros = useCallback(() => {
    setBusca("");
    setStatusFiltro("todos");
    setMesFiltro("todos");
  }, []);

  const anyLoading = carregandoEventos;
  const agora = nowBR();

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <HeaderHero
        onAtualizar={carregarEventos}
        atualizando={carregandoEventos}
        agrupamento={agrupamento}
        setAgrupamento={setAgrupamento}
        kpis={kpis}
      />

      {anyLoading && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-emerald-100 dark:bg-emerald-950 z-40"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando dados"
        >
          <div className="h-full bg-emerald-700 dark:bg-emerald-600 animate-pulse w-1/3" />
        </div>
      )}

      <main id="conteudo" className="flex-1 max-w-6xl mx-auto px-3 sm:px-4 py-6 w-full">
        <ToolbarFiltros
          busca={busca}
          setBusca={setBusca}
          statusFiltro={statusFiltro}
          setStatusFiltro={setStatusFiltro}
          mesFiltro={mesFiltro}
          setMesFiltro={setMesFiltro}
          mesesDisponiveis={mesesDisponiveis}
          limparFiltros={limparFiltros}
          filtrosAtivos={filtrosAtivos}
        />

        {!!erro && !carregandoEventos && (
          <div
            ref={erroRef}
            tabIndex={-1}
            className="mb-4 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/25 p-4 outline-none"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 text-rose-600 dark:text-rose-300" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-semibold text-rose-800 dark:text-rose-200">
                  Não foi possível carregar a gestão de presenças
                </p>
                <p className="text-sm text-rose-800/90 dark:text-rose-200/90 break-words">{erro}</p>
                <button
                  type="button"
                  onClick={carregarEventos}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <RefreshCcw className="w-4 h-4" aria-hidden="true" />
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        )}

        {carregandoEventos ? (
          <div className="flex justify-center py-10" aria-busy="true" aria-live="polite">
            <Spinner label="Carregando eventos..." />
          </div>
        ) : eventosProcessados.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center shadow-sm">
            <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white">
              Nenhum resultado encontrado
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Ajuste os filtros ou limpe a busca para visualizar mais turmas.
            </p>
            {filtrosAtivos && (
              <button
                type="button"
                onClick={limparFiltros}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                <X className="w-4 h-4" />
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <ListaTurmasPresenca
            eventos={eventosProcessados}
            hoje={agora}
            carregarInscritos={carregarInscritos}
            carregarAvaliacao={carregarAvaliacao}
            gerarRelatorioPDF={gerarRelatorioPDF}
            inscritosPorTurma={inscritosPorTurma}
            avaliacaoPorTurma={avaliacaoPorTurma}
            navigate={navigate}
            modoadministradorPresencas
            agrupamento={agrupamento}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}