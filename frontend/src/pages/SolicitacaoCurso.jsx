// ✅ src/pages/SolicitacaoCurso.jsx — premium (mobile-first + a11y + debounce + chips + persistência + calendário clicável + “cards premium”)

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  Plus,
  Edit2,
  Trash2,
  Globe2,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Sparkles,
  RefreshCcw,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";

import api from "../services/api";
import NadaEncontrado from "../components/NadaEncontrado";
import Footer from "../components/Footer";
import ModalSolicitacaoCurso from "../components/ModalSolicitacaoCurso";
import ModalConfirmacao from "../components/ModalConfirmacao";

/* ---------------- Constantes ---------------- */
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
  // ymd: YYYY-MM-DD
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
  const horarios = datas.map((d) => d?.horario_inicio).filter(Boolean).slice(0, 2);
  if (!horarios.length) return "Horários a definir";
  if (horarios.length === 1) return `A partir das ${horarios[0]}h`;
  return `Início às ${horarios[0]}h (demais dias similares)`;
}

function badgeStatus(status) {
  switch (status) {
    case "planejado":
      return { label: "Planejado", className: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200" };
    case "em_analise":
      return { label: "Em análise", className: "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200" };
    case "confirmado":
      return { label: "Confirmado", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200" };
    case "cancelado":
      return { label: "Cancelado", className: "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200 line-through" };
    default:
      return { label: "Sem status", className: "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200" };
  }
}

const STRIPES_BY_STATUS = {
  planejado: "from-amber-600 to-yellow-500",
  em_analise: "from-sky-600 to-cyan-500",
  confirmado: "from-emerald-600 to-teal-500",
  cancelado: "from-rose-600 to-red-500",
  default: "from-slate-500 to-zinc-500",
};

function stripeForStatus(status) {
  return STRIPES_BY_STATUS[status] || STRIPES_BY_STATUS.default;
}

const STORAGE_KEY = "solicitacaoCurso:filtros:v1";

/* ---------------- Página ---------------- */
export default function SolicitacaoCurso() {
  const reduceMotion = useReducedMotion();

  const [cursos, setCursos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [unidades, setUnidades] = useState([]);
  const [tipos, setTipos] = useState([]);

  const hoje = new Date();
  const [currentMonthYear, setCurrentMonthYear] = useState({
    year: hoje.getFullYear(),
    month: hoje.getMonth(), // 0-11
  });

  // filtros persistidos
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
  const [busca, setBusca] = useState(persisted?.busca || "");
  const [buscaDeb, setBuscaDeb] = useState(persisted?.busca || "");

  const liveRef = useRef(null);
  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  const [modalAberto, setModalAberto] = useState(false);
  const [solicitacaoEmEdicao, setSolicitacaoEmEdicao] = useState(null);

  // Modal de confirmação (excluir)
  const [confirmacao, setConfirmacao] = useState(null); // { id, titulo }

  // persistência
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ filtroUnidade, filtroTipo, busca }));
    } catch {}
  }, [filtroUnidade, filtroTipo, busca]);

  // debounce busca
  useEffect(() => {
    const t = setTimeout(() => setBuscaDeb(busca), 250);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------- Carregar dados -------- */
  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true);
      setLive("Carregando solicitações…");

      const [cursosRes, unidadesRes, tiposRes] = await Promise.all([
        api.get("/api/solicitacoes-curso"),
        api.get("/api/unidades"),
        api.get("/api/solicitacoes-curso/tipos"),
      ]);

      const cursosArr = Array.isArray(cursosRes) ? cursosRes : cursosRes?.data || [];
      const unidadesArr = Array.isArray(unidadesRes) ? unidadesRes : unidadesRes?.data || [];
      const tiposArr = Array.isArray(tiposRes) ? tiposRes : tiposRes?.data || [];

      setCursos(cursosArr);
      setUnidades(unidadesArr);
      setTipos(tiposArr);

      setLive(`Solicitações carregadas: ${cursosArr.length}.`);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível carregar as solicitações de curso.");
      setLive("Falha ao carregar solicitações.");
    } finally {
      setCarregando(false);
    }
  }, []);

  /* -------- KPIs -------- */
  const kpis = useMemo(
    () => ({
      total: cursos.length,
      meus: cursos.filter((c) => c.pode_editar).length,
      confirmados: cursos.filter((c) => c.status === "confirmado").length,
      restritos: cursos.filter((c) => c.restrito).length,
    }),
    [cursos]
  );

  /* -------- Filtragem por mês + filtros -------- */
  const cursosFiltrados = useMemo(() => {
    const { year, month } = currentMonthYear;
    const mesStr = String(month + 1).padStart(2, "0");

    const q = norm(buscaDeb);

    return cursos.filter((curso) => {
      const datas = Array.isArray(curso?.datas) ? curso.datas : [];

      // tem pelo menos um encontro no mês
      const temNoMes = datas.some((d) => {
        if (!d?.data) return false;
        const [ano, mes] = String(d.data).split("-");
        return ano === String(year) && mes === mesStr;
      });

      if (!temNoMes) return false;
      if (filtroUnidade && String(curso.unidade_id) !== String(filtroUnidade)) return false;
      if (filtroTipo && String(curso.tipo) !== String(filtroTipo)) return false;

      if (q) {
        const palestrantesStr = (curso.palestrantes || []).map((p) => p?.nome).filter(Boolean).join(" ");
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
            palestrantesStr,
          ]
            .filter(Boolean)
            .join(" | ")
        );
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [cursos, currentMonthYear, filtroUnidade, filtroTipo, buscaDeb]);

  /* -------- Map dia -> cursos (para o calendário) -------- */
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

  /* -------- Ações -------- */
  const handleCriar = () => {
    setSolicitacaoEmEdicao(null);
    setModalAberto(true);
  };

  const handleEditar = (curso) => {
    setSolicitacaoEmEdicao(curso);
    setModalAberto(true);
  };

  const pedirExclusao = (curso) => {
    setConfirmacao({ id: curso.id, titulo: curso.titulo });
  };

  const confirmarExclusao = async () => {
    if (!confirmacao?.id) return;
    try {
      await api.delete(`/api/solicitacoes-curso/${confirmacao.id}`);
      toast.success("Solicitação excluída.");
      setCursos((prev) => prev.filter((c) => c.id !== confirmacao.id));
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir.");
    } finally {
      setConfirmacao(null);
    }
  };

  const limparFiltros = () => {
    setFiltroUnidade("");
    setFiltroTipo("");
    setBusca("");
    setBuscaDeb("");
    setLive("Filtros limpos.");
  };

  const monthLabel = `${MESES[currentMonthYear.month].label} de ${currentMonthYear.year}`;
  const totalVisiveis = cursosFiltrados.length;

  const removerChip = (qual) => {
    if (qual === "unidade") setFiltroUnidade("");
    if (qual === "tipo") setFiltroTipo("");
    if (qual === "busca") {
      setBusca("");
      setBuscaDeb("");
    }
  };

  const temChips = !!(filtroUnidade || filtroTipo || buscaDeb);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white">
      {/* a11y live */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      {/* Modal Confirmacao (excluir) */}
      <ModalConfirmacao
        open={!!confirmacao}
        onClose={() => setConfirmacao(null)}
        onConfirm={confirmarExclusao}
        titulo="Excluir solicitação"
        confirmarTexto="Excluir"
        cancelarTexto="Cancelar"
        danger
      >
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Tem certeza que deseja <strong>excluir</strong> a solicitação
          {confirmacao?.titulo ? (
            <> <em className="font-semibold">“{confirmacao.titulo}”</em> </>
          ) : null}
          ?
        </p>
      </ModalConfirmacao>

      {/* HEADER HERO  */}
      <header className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-700 text-white shadow-lg">
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
                Solicitação de Cursos
              </div>
              <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl tracking-tight">
                Propostas de cursos para a rede de saúde
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-emerald-100">
                Registre suas propostas e acompanhe as iniciativas de educação em saúde da rede.
              </p>

              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>
                  Visualizando: <strong>{monthLabel}</strong> • {totalVisiveis} no mês
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <button
                onClick={handleCriar}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-extrabold text-emerald-900 shadow-md hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Nova solicitação
              </button>
              <p className="text-xs text-emerald-100">
                Você só pode editar/excluir suas próprias solicitações.
              </p>

              <button
                onClick={carregarDados}
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/20 px-3 py-1.5 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                aria-label="Atualizar lista"
                disabled={carregando}
              >
                <RefreshCcw className={cx("h-4 w-4", carregando ? "animate-spin" : "")} aria-hidden="true" />
                {carregando ? "Atualizando…" : "Atualizar"}
              </button>
            </div>
          </div>

          {/* Ministats */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Solicitações cadastradas" value={kpis.total} icon={CalendarDays} />
            <MiniStat label="Minhas solicitações" value={kpis.meus} icon={Users} variant="accent" />
            <MiniStat label="Cursos confirmados" value={kpis.confirmados} icon={School} variant="success" />
            <MiniStat label="Acesso restrito" value={kpis.restritos} icon={Lock} variant="warning" />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {/* 🌙 Agenda Mensal */}
        <section className="mb-6 rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-white/10">
          {/* Cabeçalho da agenda */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-extrabold text-slate-700 dark:text-zinc-100">
              <Filter className="h-4 w-4" aria-hidden="true" />
              Agenda mensal de solicitações
            </div>

            {/* Navegação mês a mês */}
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() =>
                  setCurrentMonthYear((prev) =>
                    prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 }
                  )
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950/30 hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>

              <span className="min-w-[160px] text-center text-sm font-extrabold text-slate-800 dark:text-zinc-100">
                {MESES[currentMonthYear.month].label} de {currentMonthYear.year}
              </span>

              <button
                onClick={() =>
                  setCurrentMonthYear((prev) =>
                    prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 }
                  )
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950/30 hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="mb-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1 text-xs">
              <label className="font-semibold text-slate-600 dark:text-zinc-300">Unidade</label>
              <select
                value={filtroUnidade}
                onChange={(e) => setFiltroUnidade(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-2 text-sm bg-white dark:bg-zinc-950/30 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label="Filtrar por unidade"
              >
                <option value="">Todas</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 text-xs">
              <label className="font-semibold text-slate-600 dark:text-zinc-300">Tipo</label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-2 text-sm bg-white dark:bg-zinc-950/30 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label="Filtrar por tipo"
              >
                <option value="">Todos</option>
                {tipos.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 text-xs lg:col-span-2">
              <label className="font-semibold text-slate-600 dark:text-zinc-300">Busca</label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por título, descrição, unidade, palestrante…"
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 pl-10 pr-10 py-2 text-sm bg-white dark:bg-zinc-950/30 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Mostrando <strong className="tabular-nums">{totalVisiveis}</strong> no mês
                </span>
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="ml-auto inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          </div>

          {/* Chips de filtros ativos */}
          {temChips && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {filtroUnidade && (
                <Chip text={`Unidade: ${unidades.find((u) => String(u.id) === String(filtroUnidade))?.nome ?? filtroUnidade}`} onClear={() => removerChip("unidade")} />
              )}
              {filtroTipo && <Chip text={`Tipo: ${filtroTipo}`} onClear={() => removerChip("tipo")} />}
              {buscaDeb && <Chip text={`Busca: “${buscaDeb}”`} onClear={() => removerChip("busca")} />}
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

          {/* 🗓️ Calendário */}
          <CalendarioMensal
            currentMonthYear={currentMonthYear}
            cursosPorDia={cursosPorDia}
            onCursoClick={handleEditar}
          />
        </section>

        {/* LISTAGEM DETALHADA */}
        <section className="space-y-3">
          {carregando ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-white/10">
                <Skeleton height={18} width="60%" />
                <div className="mt-2 space-y-2">
                  <Skeleton height={12} />
                  <Skeleton height={12} width="80%" />
                  <Skeleton height={12} width="50%" />
                </div>
              </div>
            ))
          ) : cursosFiltrados?.length === 0 ? (
            <NadaEncontrado
              titulo="Nenhuma solicitação encontrada."
              descricao="Altere o mês, ajuste os filtros ou cadastre uma nova solicitação."
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
                  className="relative group rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-white/10 hover:ring-emerald-200/60"
                >
                  {/* barrinha superior */}
                  <div className={cx("pointer-events-none absolute inset-x-0 -top-px h-2 rounded-t-2xl bg-gradient-to-r", stripe)} aria-hidden="true" />

                  {/* Cabeçalho */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pt-1">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-extrabold text-slate-800 dark:text-white break-words">
                          {curso.titulo}
                        </h2>

                        <span className={cx(statusInfo.className, "px-2.5 py-0.5 text-[11px] rounded-full font-semibold")}>
                          {statusInfo.label}
                        </span>

                        {curso.pode_editar && (
                          <span className="bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                            Minha solicitação
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-zinc-300 line-clamp-2">
                        {curso.descricao || "Sem descrição detalhada informada."}
                      </p>
                    </div>

                    {/* Botões */}
                    {curso.pode_editar && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditar(curso)}
                          className="inline-flex items-center gap-2 bg-white dark:bg-zinc-950/30 border border-slate-200 dark:border-zinc-700 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                          aria-label={`Editar ${curso.titulo}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" aria-hidden="true" /> Editar
                        </button>
                        <button
                          onClick={() => pedirExclusao(curso)}
                          className="inline-flex items-center gap-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-200 hover:bg-rose-100/70 dark:hover:bg-rose-950/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                          aria-label={`Excluir ${curso.titulo}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Excluir
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Linha de detalhes */}
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

                  {/* Linha secundária */}
                  <div className="mt-3 grid gap-2 text-xs text-slate-600 dark:text-zinc-300 sm:grid-cols-2 lg:grid-cols-[2fr,1fr]">
                    <InfoBox icon={School} title="Palestrantes" value={palestrantesStr} />

                    <div className="flex flex-wrap items-center gap-2">
                      {curso.restrito ? (
                        <span className="bg-amber-50 text-amber-900 dark:bg-amber-900/25 dark:text-amber-200 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                          <Lock className="inline h-3.5 w-3.5 mr-1" aria-hidden="true" />
                          Restrito: {curso.restricao_descricao}
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-900 dark:bg-emerald-900/25 dark:text-emerald-200 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                          <Globe2 className="inline h-3.5 w-3.5 mr-1" aria-hidden="true" />
                          Acesso livre
                        </span>
                      )}

                      {curso.modalidade && (
                        <span className="bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                          {curso.modalidade === "presencial"
                            ? "Presencial"
                            : curso.modalidade === "online"
                            ? "On-line"
                            : "Híbrido"}
                        </span>
                      )}

                      {typeof curso.carga_horaria_total === "number" && (
                        <span className="bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">
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

      {/* MODAL CRUD */}
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
        podeEditarStatus={false}
      />
    </div>
  );
}

/* ---------------- Chip de Filtro ---------------- */
function Chip({ text, onClear }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-100 px-2.5 py-1 text-[11px] font-semibold">
      {text}
      <button
        type="button"
        onClick={onClear}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-label={`Remover filtro: ${text}`}
        title="Remover filtro"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}

/* ---------------- InfoBox ---------------- */
function InfoBox({ icon: Icon, title, value }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-1.5">
        <Icon className="h-4 w-4 text-emerald-700 dark:text-emerald-200" aria-hidden="true" />
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

/* -----------------------------------------------------------
 * 🗓️ Calendário Mensal — clique no curso (premium + a11y)
 * ----------------------------------------------------------- */
function CalendarioMensal({ currentMonthYear, cursosPorDia, onCursoClick }) {
  const { year, month } = currentMonthYear;

  const diasSemana = ["D", "S", "T", "Q", "Q", "S", "S"];
  const primeiroDiaSemana = new Date(year, month, 1).getDay();
  const diasNoMes = new Date(year, month + 1, 0).getDate();

  const celulas = [];

  for (let i = 0; i < primeiroDiaSemana; i++) {
    celulas.push({ tipo: "vazio", key: `blank-${i}` });
  }

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const diaStr = String(dia).padStart(2, "0");
    celulas.push({
      tipo: "dia",
      key: `dia-${dia}`,
      dia,
      cursos: cursosPorDia[diaStr] || [],
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-700">
      {/* Cabeçalho */}
      <div className="grid grid-cols-7 bg-slate-50 dark:bg-zinc-950/30 text-center text-[11px] uppercase tracking-wide">
        {diasSemana.map((d, idx) => (
          <div key={`${d}-${idx}`} className="px-1 py-2 text-slate-500 dark:text-zinc-400 font-semibold">
            {d}
          </div>
        ))}
      </div>

      {/* Dias */}
      <div className="grid grid-cols-7 bg-white dark:bg-zinc-900 text-xs">
        {celulas.map((cell) => {
          if (cell.tipo === "vazio") {
            return <div key={cell.key} className="h-24 border border-slate-50 dark:border-zinc-800" />;
          }

          const { dia, cursos } = cell;

          return (
            <div
              key={cell.key}
              className="flex h-28 flex-col border border-slate-50 dark:border-zinc-800 p-1.5"
            >
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-extrabold text-slate-700 dark:text-zinc-200">{dia}</span>
                {cursos.length > 0 && (
                  <span className="bg-emerald-50 text-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-semibold tabular-nums">
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
                    className="truncate rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 text-emerald-900 dark:text-emerald-100 text-[10px] text-left hover:bg-emerald-100/70 dark:hover:bg-emerald-900/35 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    title={curso.titulo}
                    aria-label={`Abrir solicitação: ${curso.titulo}`}
                  >
                    {curso.titulo}
                  </button>
                ))}

                {cursos.length > 3 && (
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-semibold">
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

/* -----------------------------------------------------------
 * 🧮 MiniStat (premium)
 * ----------------------------------------------------------- */
function MiniStat({ label, value, icon: Icon, variant = "default" }) {
  const variants = {
    default: "border-white/15 bg-white/10",
    accent: "border-amber-200/40 bg-amber-500/10",
    success: "border-emerald-200/40 bg-emerald-500/10",
    warning: "border-rose-200/40 bg-rose-500/10",
  };

  return (
    <div className={cx("flex items-center justify-between rounded-2xl border px-4 py-3 text-xs shadow-sm", variants[variant])}>
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
