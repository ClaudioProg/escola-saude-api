// ✅ src/pages/SolicitacaoCursoAdmin.jsx — premium (admin)
// Upgrades (sem perder nada do que você já tem):
// - HeaderHero premium (paleta exclusiva admin) + refresh + live region a11y
// - Ministats premium + contagens por status (inclui “visíveis no mês”)
// - Filtros: unidade/tipo/status + busca (debounce) + limpar + persistência (localStorage)
// - Cards premium com barrinha por status + botões acessíveis
// - Calendário premium (clique abre modal) + melhores focus/hover
// - Mantém rotas e o ModalSolicitacaoCurso (com podeEditarStatus=true)
// - ✅ Exclusão com modal nativo (Modal) — sem window.confirm

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "react-toastify";
import {
  CalendarDays,
  MapPin,
  Users,
  Lock,
  Clock,
  School,
  Filter,
  Edit2,
  Trash2,
  Globe2,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Sparkles,
  RefreshCcw,
  AlertTriangle,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";

import api from "../services/api";
import NadaEncontrado from "../components/NadaEncontrado";
import Footer from "../components/Footer";
import ModalSolicitacaoCurso from "../components/ModalSolicitacaoCurso";
import Modal from "../components/Modal";

const MESES = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

/* ---------------- Helpers ---------------- */
const cx = (...c) => c.filter(Boolean).join(" ");

const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const brDate = (ymd) => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return String(ymd || "—");
  const [y, m, d] = String(ymd).split("-");
  return `${d}/${m}/${y}`;
};

function resumirDatas(datas = []) {
  if (!datas.length) return "Datas a definir";
  const ordenadas = [...datas].filter((d) => d?.data).sort((a, b) => a.data.localeCompare(b.data));
  if (!ordenadas.length) return "Datas a definir";
  const primeira = ordenadas[0].data;
  const ultima = ordenadas[ordenadas.length - 1].data;
  if (primeira === ultima) return `Dia ${brDate(primeira)}`;
  return `De ${brDate(primeira)} a ${brDate(ultima)}`;
}

function resumirHorarios(datas = []) {
  const horarios = datas
    .map((d) => d?.horario_inicio)
    .filter(Boolean)
    .slice(0, 2);
  if (!horarios.length) return "Horários a definir";
  if (horarios.length === 1) return `A partir das ${horarios[0]}h`;
  return `Início às ${horarios[0]}h (demais dias similares)`;
}

function badgeStatus(status) {
  switch (status) {
    case "planejado":
      return {
        label: "Planejado",
        className: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
      };
    case "em_analise":
      return {
        label: "Em análise",
        className: "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200",
      };
    case "confirmado":
      return {
        label: "Confirmado",
        className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
      };
    case "cancelado":
      return {
        label: "Cancelado",
        className: "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200 line-through",
      };
    default:
      return {
        label: "Sem status",
        className: "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200",
      };
  }
}

const STRIPES_BY_STATUS = {
  planejado: "from-amber-600 to-yellow-500",
  em_analise: "from-sky-600 to-cyan-500",
  confirmado: "from-emerald-600 to-teal-500",
  cancelado: "from-rose-600 to-red-500",
  default: "from-indigo-600 to-sky-600",
};
const stripeForStatus = (s) => STRIPES_BY_STATUS[s] || STRIPES_BY_STATUS.default;

const STORAGE_KEY = "solicitacaoCursoAdmin:filtros:v1";

/* ---------------- Página ---------------- */
export default function SolicitacaoCursoAdmin() {
  const reduceMotion = useReducedMotion();

  const [cursos, setCursos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // ✅ modal confirmação exclusão (nativo)
  const [confirmacao, setConfirmacao] = useState(null); // { id, titulo }
  const [excluindo, setExcluindo] = useState(false);

  // filtros (persistidos)
  const loadPersisted = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const persisted = loadPersisted();

  const [filtroUnidade, setFiltroUnidade] = useState(persisted?.filtroUnidade || "");
  const [filtroTipo, setFiltroTipo] = useState(persisted?.filtroTipo || "");
  const [filtroStatus, setFiltroStatus] = useState(persisted?.filtroStatus || "");
  const [busca, setBusca] = useState(persisted?.busca || "");
  const [buscaDeb, setBuscaDeb] = useState(persisted?.busca || "");

  const [unidades, setUnidades] = useState([]);
  const [tipos, setTipos] = useState([]);

  const hoje = new Date();
  const [currentMonthYear, setCurrentMonthYear] = useState({
    year: hoje.getFullYear(),
    month: hoje.getMonth(),
  });

  const [modalAberto, setModalAberto] = useState(false);
  const [solicitacaoEmEdicao, setSolicitacaoEmEdicao] = useState(null);

  // a11y live
  const liveRef = useRef(null);
  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  // persist filtros
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ filtroUnidade, filtroTipo, filtroStatus, busca })
      );
    } catch {}
  }, [filtroUnidade, filtroTipo, filtroStatus, busca]);

  // debounce busca
  useEffect(() => {
    const t = setTimeout(() => setBuscaDeb(busca), 250);
    return () => clearTimeout(t);
  }, [busca]);

  /* -------- carregar dados -------- */
  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true);
      setLive("Carregando solicitações…");

      const [cursosRes, unidadesRes, tiposRes] = await Promise.all([
        api.get("/api/solicitacoes-curso"),
        api.get("/api/unidades"),
        api.get("/api/solicitacoes-curso/tipos"),
      ]);

      setCursos(Array.isArray(cursosRes) ? cursosRes : cursosRes?.data || []);
      setUnidades(Array.isArray(unidadesRes) ? unidadesRes : unidadesRes?.data || []);
      setTipos(Array.isArray(tiposRes) ? tiposRes : tiposRes?.data || []);

      setLive("Solicitações carregadas.");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      toast.error("Não foi possível carregar as solicitações de curso.");
      setLive("Falha ao carregar solicitações.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  /* -------- filtros do mês + filtros admin + busca -------- */
  const cursosFiltrados = useMemo(() => {
    const { year, month } = currentMonthYear;
    const mesStr = String(month + 1).padStart(2, "0");
    const q = norm(buscaDeb);

    return cursos.filter((curso) => {
      const datas = Array.isArray(curso?.datas) ? curso.datas : [];

      const temNoMes = datas.some((d) => {
        if (!d?.data) return false;
        const [ano, mes] = String(d.data).split("-");
        return ano === String(year) && mes === mesStr;
      });
      if (!temNoMes) return false;

      if (filtroUnidade && String(curso.unidade_id) !== String(filtroUnidade)) return false;
      if (filtroTipo && String(curso.tipo) !== String(filtroTipo)) return false;
      if (filtroStatus && String(curso.status) !== String(filtroStatus)) return false;

      if (q) {
        const palestrantesStr = (curso.palestrantes || [])
          .map((p) => p?.nome)
          .filter(Boolean)
          .join(" ");

        const hay = norm(
          [
            curso.titulo,
            curso.descricao,
            curso.unidade_nome,
            curso.local,
            curso.publico_alvo,
            curso.modalidade,
            curso.tipo,
            curso.status,
            curso.restricao_descricao,
            curso.criador_nome,
            palestrantesStr,
          ]
            .filter(Boolean)
            .join(" | ")
        );

        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [cursos, currentMonthYear, filtroUnidade, filtroTipo, filtroStatus, buscaDeb]);

  const cursosPorDia = useMemo(() => {
    const map = {};
    const { year, month } = currentMonthYear;
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;

    for (const curso of cursosFiltrados) {
      for (const d of curso.datas || []) {
        if (!d?.data?.startsWith(prefix)) continue;
        const dia = d.data.slice(-2);
        if (!map[dia]) map[dia] = [];
        map[dia].push(curso);
      }
    }
    return map;
  }, [cursosFiltrados, currentMonthYear]);

  /* -------- KPIs admin -------- */
  const kpis = useMemo(() => {
    const total = cursos.length;
    const planejados = cursos.filter((c) => c.status === "planejado").length;
    const emAnalise = cursos.filter((c) => c.status === "em_analise").length;
    const confirmados = cursos.filter((c) => c.status === "confirmado").length;
    const cancelados = cursos.filter((c) => c.status === "cancelado").length;
    return { total, planejados, emAnalise, confirmados, cancelados };
  }, [cursos]);

  const totalVisiveisMes = cursosFiltrados.length;
  const monthLabel = `${MESES[currentMonthYear.month].label} de ${currentMonthYear.year}`;

  const temChips = !!(filtroUnidade || filtroTipo || filtroStatus || buscaDeb);

  const removerChip = (qual) => {
    if (qual === "unidade") setFiltroUnidade("");
    if (qual === "tipo") setFiltroTipo("");
    if (qual === "status") setFiltroStatus("");
    if (qual === "busca") {
      setBusca("");
      setBuscaDeb("");
    }
    setLive("Filtro removido.");
  };

  const limparFiltros = () => {
    setFiltroUnidade("");
    setFiltroTipo("");
    setFiltroStatus("");
    setBusca("");
    setBuscaDeb("");
    setLive("Filtros limpos.");
  };

  /* -------- ações -------- */
  function handleEditar(curso) {
    setSolicitacaoEmEdicao(curso);
    setModalAberto(true);
  }

  function pedirExclusao(curso) {
    setConfirmacao({ id: curso.id, titulo: curso.titulo });
  }

  const confirmarExclusao = useCallback(async () => {
    if (!confirmacao?.id) return;

    try {
      setExcluindo(true);
      setLive("Excluindo solicitação…");

      await api.delete(`/api/solicitacoes-curso/${confirmacao.id}`);

      toast.success("Solicitação excluída com sucesso.");
      setCursos((prev) => prev.filter((c) => String(c.id) !== String(confirmacao.id)));
      setLive("Solicitação excluída.");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      toast.error("Erro ao excluir solicitação. Tente novamente.");
      setLive("Falha ao excluir solicitação.");
    } finally {
      setExcluindo(false);
      setConfirmacao(null);
    }
  }, [confirmacao?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white">
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      {/* ✅ Modal confirmação exclusão (nativo) */}
      <Modal
        isOpen={!!confirmacao}
        onClose={() => {
          if (excluindo) return;
          setConfirmacao(null);
        }}
        level={999}
        maxWidth="max-w-lg"
        closeOnBackdrop={!excluindo}
        closeOnEsc={!excluindo}
        className="p-0 overflow-hidden"
        labelledBy="confirm-excluir-title"
        describedBy="confirm-excluir-desc"
      >
        <div className="p-5 sm:p-6 bg-gradient-to-br from-rose-900 via-red-800 to-amber-700 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                id="confirm-excluir-title"
                className="text-lg sm:text-xl font-extrabold tracking-tight flex items-center gap-2"
              >
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                Excluir solicitação?
              </h3>
              <p id="confirm-excluir-desc" className="mt-2 text-sm text-white/90">
                Tem certeza que deseja excluir{" "}
                {confirmacao?.titulo ? (
                  <span className="font-extrabold">“{confirmacao.titulo}”</span>
                ) : (
                  "esta solicitação"
                )}
                ?<br />
                <span className="text-white/80">Esta ação não pode ser desfeita.</span>
              </p>
            </div>

            <button
              type="button"
              onClick={excluindo ? undefined : () => setConfirmacao(null)}
              disabled={excluindo}
              className="p-2 rounded-xl hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-60"
              aria-label="Fechar confirmação"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="px-5 sm:px-6 py-4 flex flex-wrap items-center justify-end gap-2 bg-white dark:bg-zinc-950">
          <button
            type="button"
            onClick={excluindo ? undefined : () => setConfirmacao(null)}
            disabled={excluindo}
            className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition disabled:opacity-60"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={excluindo ? undefined : confirmarExclusao}
            disabled={excluindo}
            className="px-4 py-2 rounded-xl text-white font-extrabold bg-rose-600 hover:bg-rose-700 transition disabled:opacity-60 inline-flex items-center gap-2"
            aria-busy={excluindo ? "true" : "false"}
          >
            {excluindo ? (
              <>
                <span className="inline-flex h-4 w-4 items-center justify-center">
                  <span className="h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin" />
                </span>
                Excluindo…
              </>
            ) : (
              "Sim, excluir"
            )}
          </button>
        </div>
      </Modal>

      {/* HeaderHero administrador premium */}
      <header className="relative overflow-hidden bg-gradient-to-br from-sky-900 via-indigo-800 to-fuchsia-700 text-white shadow-lg">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(52% 60% at 50% 0%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 32%, rgba(255,255,255,0) 60%)",
          }}
          aria-hidden="true"
        />
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10 relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                <span>Painel do Administrador</span>
              </div>

              <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl tracking-tight">
                Gestão do calendário de cursos
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-white/90">
                Visualize, acompanhe e atualize o status das solicitações de cursos cadastradas
                por toda a rede de saúde.
              </p>

              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>
                  Mês: <strong>{monthLabel}</strong> • {totalVisiveisMes} visíveis
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={carregarDados}
                disabled={carregando}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/15 hover:bg-white/20 px-4 py-2 text-sm font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-70"
                aria-label="Atualizar dados"
              >
                <RefreshCcw
                  className={cx("h-4 w-4", carregando ? "animate-spin" : "")}
                  aria-hidden="true"
                />
                {carregando ? "Atualizando…" : "Atualizar"}
              </button>
              <p className="text-[11px] text-white/80">Dica: use filtros + busca para encontrar rápido.</p>
            </div>
          </div>

          {/* Ministats admin */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MiniStat label="Total" value={kpis.total} icon={CalendarDays} variant="default" />
            <MiniStat label="Planejados" value={kpis.planejados} icon={Clock} variant="amber" />
            <MiniStat label="Em análise" value={kpis.emAnalise} icon={School} variant="sky" />
            <MiniStat label="Confirmados" value={kpis.confirmados} icon={School} variant="emerald" />
            <MiniStat label="Cancelados" value={kpis.cancelados} icon={Lock} variant="rose" />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
      </header>

      {/* Conteúdo */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {/* Agenda + filtros admin premium */}
        <section className="mb-6 rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-white/10">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-extrabold text-slate-700 dark:text-zinc-100">
              <Filter className="h-4 w-4" aria-hidden="true" />
              <span>Agenda mensal de solicitações (admin)</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() =>
                  setCurrentMonthYear((prev) =>
                    prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 }
                  )
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950/30 hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>

              <span className="min-w-[170px] text-center text-sm font-extrabold text-slate-800 dark:text-zinc-100">
                {monthLabel}
              </span>

              <button
                type="button"
                onClick={() =>
                  setCurrentMonthYear((prev) =>
                    prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 }
                  )
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950/30 hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mb-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              label="Unidade"
              value={filtroUnidade}
              onChange={setFiltroUnidade}
              placeholder="Todas"
              options={unidades.map((u) => ({ value: String(u.id), label: u.nome }))}
            />

            <FilterSelect
              label="Tipo"
              value={filtroTipo}
              onChange={setFiltroTipo}
              placeholder="Todos"
              options={tipos.map((t) => ({ value: String(t), label: String(t) }))}
            />

            <FilterSelect
              label="Status"
              value={filtroStatus}
              onChange={setFiltroStatus}
              placeholder="Todos"
              options={[
                { value: "planejado", label: "Planejado" },
                { value: "em_analise", label: "Em análise" },
                { value: "confirmado", label: "Confirmado" },
                { value: "cancelado", label: "Cancelado" },
              ]}
            />

            <div className="flex flex-col gap-1 text-xs">
              <label className="font-semibold text-slate-600 dark:text-zinc-300">Busca</label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por título, criador, unidade, local…"
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 pl-10 pr-10 py-2 text-sm bg-white dark:bg-zinc-950/30 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  aria-label="Buscar solicitações"
                />
                {!!busca && (
                  <button
                    type="button"
                    onClick={() => setBusca("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                    aria-label="Limpar busca"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Visíveis no mês: <strong className="tabular-nums">{totalVisiveisMes}</strong>
                </span>
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="ml-auto inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          </div>

          {/* Chips de filtros ativos (premium) */}
          {temChips && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {filtroUnidade && (
                <Chip
                  text={`Unidade: ${unidades.find((u) => String(u.id) === String(filtroUnidade))?.nome ?? filtroUnidade}`}
                  onClear={() => removerChip("unidade")}
                  tone="sky"
                />
              )}
              {filtroTipo && <Chip text={`Tipo: ${filtroTipo}`} onClear={() => removerChip("tipo")} tone="sky" />}
              {filtroStatus && (
                <Chip
                  text={`Status: ${
                    { planejado: "Planejado", em_analise: "Em análise", confirmado: "Confirmado", cancelado: "Cancelado" }[
                      filtroStatus
                    ] || filtroStatus
                  }`}
                  onClear={() => removerChip("status")}
                  tone="sky"
                />
              )}
              {buscaDeb && <Chip text={`Busca: “${buscaDeb}”`} onClear={() => removerChip("busca")} tone="sky" />}

              <button
                type="button"
                onClick={limparFiltros}
                className="text-[11px] underline decoration-dotted hover:opacity-80"
                aria-label="Limpar todos os filtros"
              >
                Limpar tudo
              </button>
            </div>
          )}

          <CalendarioMensalAdmin
            currentMonthYear={currentMonthYear}
            cursosPorDia={cursosPorDia}
            onCursoClick={handleEditar}
          />
        </section>

        {/* Lista detalhada */}
        <section aria-label="Solicitações de curso (admin)" className="space-y-3">
          {carregando ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-white/10">
                <Skeleton height={18} width="60%" />
                <div className="mt-2 space-y-2">
                  <Skeleton height={12} />
                  <Skeleton height={12} width="80%" />
                  <Skeleton height={12} width="50%" />
                </div>
              </div>
            ))
          ) : cursosFiltrados.length === 0 ? (
            <NadaEncontrado
              titulo="Nenhuma solicitação encontrada nos filtros selecionados."
              descricao="Altere o mês, ajuste os filtros ou aguarde novas solicitações da rede."
            />
          ) : (
            cursosFiltrados.map((curso) => {
              const statusInfo = badgeStatus(curso.status);
              const stripe = stripeForStatus(curso.status);

              const palestrantesStr =
                (curso.palestrantes || []).map((p) => p?.nome).filter(Boolean).join(", ") || "A definir";

              return (
                <motion.article
                  key={curso.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="relative group rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-white/10 hover:shadow-md hover:ring-sky-200/60"
                >
                  <div
                    className={cx("pointer-events-none absolute inset-x-0 -top-px h-2 rounded-t-2xl bg-gradient-to-r", stripe)}
                    aria-hidden="true"
                  />

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pt-1">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-extrabold text-slate-800 dark:text-white break-words">
                          {curso.titulo}
                        </h2>

                        <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", statusInfo.className)}>
                          {statusInfo.label}
                        </span>

                        <span className="inline-flex items-center rounded-full bg-sky-50 dark:bg-sky-900/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-sky-800 dark:text-sky-200">
                          Criado por: {curso.criador_nome || "Não informado"}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-zinc-300 line-clamp-2">
                        {curso.descricao || "Sem descrição detalhada informada."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 sm:mt-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditar(curso)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950/30 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        aria-label={`Editar ${curso.titulo}`}
                      >
                        <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => pedirExclusao(curso)}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-200 hover:bg-rose-100/70 dark:hover:bg-rose-950/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        aria-label={`Excluir ${curso.titulo}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Excluir
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-xs text-slate-600 dark:text-zinc-300 sm:grid-cols-2 lg:grid-cols-4">
                    <InfoBox icon={CalendarDays} title="Datas" value={resumirDatas(curso.datas)} />
                    <InfoBox icon={Clock} title="Horários" value={resumirHorarios(curso.datas)} />
                    <InfoBox
                      icon={MapPin}
                      title="Local / Unidade"
                      value={`${curso.local || "Local a definir"}${curso.unidade_nome ? ` — ${curso.unidade_nome}` : ""}`}
                    />
                    <InfoBox icon={Users} title="Público-alvo" value={curso.publico_alvo || "Público a definir"} />
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-slate-600 dark:text-zinc-300 sm:grid-cols-2 lg:grid-cols-[2fr,1fr]">
                    <InfoBox icon={School} title="Palestrantes" value={palestrantesStr} />

                    <div className="flex flex-wrap items-center gap-2">
                      {curso.restrito ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/25 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                          Restrito: {curso.restricao_descricao || "Acesso limitado"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/25 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900 dark:text-emerald-200">
                          <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Acesso livre na rede
                        </span>
                      )}

                      {curso.modalidade && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-zinc-200">
                          {curso.modalidade === "presencial"
                            ? "Presencial"
                            : curso.modalidade === "online"
                            ? "On-line"
                            : "Híbrido"}
                        </span>
                      )}

                      {typeof curso.carga_horaria_total === "number" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-zinc-200">
                          {curso.carga_horaria_total}h
                        </span>
                      )}
                    </div>
                  </div>
                </motion.article>
              );
            })
          )}
        </section>
      </main>

      <Footer />

      {/* Modal admin com edição de status liberada */}
      <ModalSolicitacaoCurso
        aberto={modalAberto}
        onClose={() => {
          setModalAberto(false);
          setSolicitacaoEmEdicao(null);
        }}
        onSaved={() => {
          setModalAberto(false);
          setSolicitacaoEmEdicao(null);
          carregarDados();
        }}
        solicitacao={solicitacaoEmEdicao}
        unidades={unidades}
        podeEditarStatus={true}
      />
    </div>
  );
}

/* ---------------- UI: Chip ---------------- */
function Chip({ text, onClear, tone = "emerald" }) {
  const tones = {
    emerald: {
      wrap: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-100",
      hover: "hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40",
      ring: "focus-visible:ring-emerald-500",
    },
    sky: {
      wrap: "bg-sky-50 dark:bg-sky-900/20 text-sky-900 dark:text-sky-100",
      hover: "hover:bg-sky-100/70 dark:hover:bg-sky-900/40",
      ring: "focus-visible:ring-sky-500",
    },
  }[tone];

  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold", tones.wrap)}>
      {text}
      <button
        type="button"
        onClick={onClear}
        className={cx(
          "ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full",
          tones.hover,
          "focus:outline-none focus-visible:ring-2",
          tones.ring
        )}
        aria-label={`Remover filtro: ${text}`}
        title="Remover filtro"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}

/* ---------------- UI: InfoBox ---------------- */
function InfoBox({ icon: Icon, title, value }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 rounded-lg bg-sky-50 dark:bg-sky-900/20 p-1.5">
        <Icon className="h-4 w-4 text-sky-700 dark:text-sky-200" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-slate-700 dark:text-zinc-200">{title}</p>
        <p className="truncate" title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}

/* ---------------- UI: FilterSelect ---------------- */
function FilterSelect({ label, value, onChange, options, placeholder }) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <label className="font-semibold text-slate-600 dark:text-zinc-300">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950/30 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        aria-label={`Filtrar por ${label}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ---------------- Calendário mensal admin premium ---------------- */
function CalendarioMensalAdmin({ currentMonthYear, cursosPorDia, onCursoClick }) {
  const { year, month } = currentMonthYear;

  const diasSemana = ["D", "S", "T", "Q", "Q", "S", "S"];
  const primeiroDiaSemana = new Date(year, month, 1).getDay();
  const diasNoMes = new Date(year, month + 1, 0).getDate();

  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push({ tipo: "vazio", key: `blank-${i}` });

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const diaStr = String(dia).padStart(2, "0");
    celulas.push({ tipo: "dia", key: `dia-${dia}`, dia, cursos: cursosPorDia[diaStr] || [] });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-700">
      <div className="grid grid-cols-7 bg-slate-50 dark:bg-zinc-950/30 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {diasSemana.map((d, idx) => (
          <div key={`${d}-${idx}`} className="px-1 py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 bg-white dark:bg-zinc-900 text-xs">
        {celulas.map((cell) => {
          if (cell.tipo === "vazio") {
            return <div key={cell.key} className="h-28 border border-slate-50 dark:border-zinc-800" />;
          }

          const { dia, cursos } = cell;

          return (
            <div key={cell.key} className="flex h-32 flex-col border border-slate-50 dark:border-zinc-800 p-1.5">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-extrabold text-slate-700 dark:text-zinc-200">{dia}</span>
                {cursos.length > 0 && (
                  <span className="rounded-full bg-sky-50 dark:bg-sky-900/20 px-2 py-0.5 text-[10px] font-semibold text-sky-800 dark:text-sky-200 tabular-nums">
                    {cursos.length}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                {cursos.slice(0, 3).map((curso) => (
                  <button
                    key={curso.id}
                    type="button"
                    onClick={() => onCursoClick && onCursoClick(curso)}
                    className="truncate rounded-lg bg-sky-50 dark:bg-sky-900/20 px-2 py-1 text-[10px] font-semibold text-sky-900 dark:text-sky-100 text-left hover:bg-sky-100/70 dark:hover:bg-sky-900/35 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    title={curso.titulo}
                    aria-label={`Abrir solicitação: ${curso.titulo}`}
                  >
                    {curso.titulo}
                  </button>
                ))}

                {cursos.length > 3 && (
                  <div className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
                    + {cursos.length - 3} curso(s)
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- MiniStat admin premium ---------------- */
function MiniStat({ label, value, icon: Icon, variant = "default" }) {
  const variants = {
    default: "border-white/15 bg-white/10 text-white",
    sky: "border-sky-200/35 bg-sky-500/10 text-white",
    emerald: "border-emerald-200/35 bg-emerald-500/10 text-white",
    amber: "border-amber-200/35 bg-amber-500/10 text-white",
    rose: "border-rose-200/35 bg-rose-500/10 text-white",
  };

  return (
    <div className={cx("flex items-center justify-between rounded-2xl border px-4 py-3 text-xs shadow-sm", variants[variant] || variants.default)}>
      <div className="min-w-0">
        <p className="text-[11px] opacity-85">{label}</p>
        <p className="text-xl font-extrabold leading-tight tabular-nums">{value}</p>
      </div>

      <div className="rounded-2xl bg-black/10 p-2">
        <Icon className="h-5 w-5 opacity-95" aria-hidden="true" />
      </div>
    </div>
  );
}
