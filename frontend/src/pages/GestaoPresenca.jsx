// ✅ frontend/src/pages/GestaoPresenca.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Página administrativa/organizador para gestão de presenças.
//
// Contratos aplicados:
// - Sem toast direto;
// - Sem Footer antigo;
// - Sem Spinner antigo;
// - Sem apiGet/apiGetFile direto;
// - Sem /api manual no frontend;
// - Sem /presencas;
// - Presença administrativa: api.presenca.administrador();
// - Inscritos por turma: api.inscricao.listarPorTurma(turma_id);
// - PDF de presença: api.presenca.turmaPdf(turma_id);
// - Status oficial: programado | andamento | encerrado;
// - "todos" é apenas filtro visual;
// - Date-only seguro em YYYY-MM-DD;
// - ListaTurmasPresenca permanece como componente detalhado atualizado;
// - Mobile-first, acessível, com aria-live, loading local, filtros persistidos;
// - Upgrade visual v2.0 real, sem preservar visual antigo por padrão.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Filter,
  Layers,
  RefreshCcw,
  Search,
  Sparkles,
  TrendingUp,
  UsersRound,
  X,
} from "lucide-react";

import { api, downloadBlob } from "../services/api";
import ListaTurmasPresenca from "../components/presencas/ListaTurmasPresenca";
import { notifyError, notifySuccess } from "../components/ui/AppToast";

/* ─────────────────────────────────────────────────────────────
 * localStorage keys
 * ───────────────────────────────────────────────────────────── */

const LS_KEYS = Object.freeze({
  agrupamento: "presenca:agrupamento",
  busca: "presenca:busca",
  status: "presenca:status",
  mes: "presenca:mes",
});

/* ─────────────────────────────────────────────────────────────
 * Helpers base
 * ───────────────────────────────────────────────────────────── */

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

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
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
}

function nowSPComparable() {
  const parts = nowSPParts();

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function normalizeYMD(value) {
  const safe = String(value || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(safe)) return safe;
  if (/^\d{4}-\d{2}-\d{2}T/.test(safe)) return safe.slice(0, 10);

  return "";
}

function normalizeHHMM(value, fallback = "00:00") {
  const safe = String(value || "").trim();

  if (/^\d{2}:\d{2}$/.test(safe)) return safe;
  if (/^\d{2}:\d{2}:\d{2}$/.test(safe)) return safe.slice(0, 5);

  return fallback;
}

function normalizarTexto(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function turmaStartComparable(turma) {
  const dataInicio = normalizeYMD(turma?.data_inicio);
  const horarioInicio = normalizeHHMM(turma?.horario_inicio, "00:00");

  return dataInicio ? `${dataInicio}T${horarioInicio}:00` : "";
}

function turmaEndComparable(turma) {
  const dataFim = normalizeYMD(turma?.data_fim);
  const horarioFim = normalizeHHMM(turma?.horario_fim, "23:59");

  return dataFim ? `${dataFim}T${horarioFim}:59` : "";
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
    const comparable = turmaStartComparable(turma);

    if (comparable && (!latest || comparable > latest)) {
      latest = comparable;
    }
  }

  return latest;
}

function sortTurmasDesc(turmas = []) {
  return [...turmas].sort((a, b) => {
    const dataA = turmaStartComparable(a);
    const dataB = turmaStartComparable(b);

    if (dataB !== dataA) return dataB.localeCompare(dataA);

    return String(b?.id || b?.turma_id || "").localeCompare(
      String(a?.id || a?.turma_id || "")
    );
  });
}

function sortEventosDesc(eventos = []) {
  return [...eventos].sort((a, b) => {
    const dataA = eventLatestComparable(a);
    const dataB = eventLatestComparable(b);

    if (dataB !== dataA) return dataB.localeCompare(dataA);

    return String(a?.titulo || "").localeCompare(
      String(b?.titulo || ""),
      "pt-BR"
    );
  });
}

function isAbortLike(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || error || "").trim().toLowerCase();

  return (
    name === "AbortError" ||
    message === "new-request" ||
    message === "unmount" ||
    message.includes("abort") ||
    message.includes("aborted") ||
    message.includes("canceled") ||
    message.includes("cancelled")
  );
}

function getErrorMessage(error, fallback) {
  return (
    error?.data?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function unwrapEventosAdministrativos(response) {
  const data = response?.data !== undefined ? response.data : response;

  if (Array.isArray(data?.eventos)) return data.eventos;
  if (Array.isArray(data)) return data;

  return [];
}

function unwrapArray(response) {
  const data = response?.data !== undefined ? response.data : response;

  return Array.isArray(data) ? data : [];
}

function sanitizeFileName(value) {
  return String(value || "lista-presenca")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 70)
    .toLowerCase();
}

/* ─────────────────────────────────────────────────────────────
 * Componentes locais v2.0
 * ───────────────────────────────────────────────────────────── */

function LoadingInline({ label = "Carregando..." }) {
  return (
    <div
      className="inline-flex items-center justify-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300"
      role="status"
      aria-live="polite"
    >
      <RefreshCcw className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  description,
  tone = "emerald",
}) {
  const toneClass = {
    emerald: "from-emerald-500 to-teal-400",
    cyan: "from-cyan-500 to-sky-400",
    amber: "from-amber-400 to-orange-400",
    rose: "from-rose-500 to-pink-400",
    slate: "from-slate-500 to-slate-400",
  };

  return (
    <article className="rounded-3xl border border-white/10 bg-white/10 p-3 text-left shadow-sm backdrop-blur">
      <div className="flex items-start gap-3">
        <span
          className={classNames(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm",
            toneClass[tone] || toneClass.emerald
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-white/75">
            {label}
          </p>

          <p className="mt-0.5 text-2xl font-black leading-none tracking-tight text-white">
            {value ?? "—"}
          </p>

          {description && (
            <p className="mt-1 text-[11px] font-medium leading-snug text-white/70">
              {description}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function HeaderHero({
  onAtualizar,
  atualizando,
  agrupamento,
  setAgrupamento,
  kpis,
}) {
  return (
    <header className="relative isolate overflow-hidden text-white" role="banner">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-teal-800 to-cyan-700" />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_82%_28%,rgba(125,211,252,0.22),transparent_42%),radial-gradient(circle_at_50%_100%,rgba(16,185,129,0.20),transparent_45%)]"
        aria-hidden="true"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-[360px] w-[960px] max-w-[95vw] -translate-x-1/2 rounded-full bg-cyan-300/25 blur-3xl"
      />

      <a
        href="#conteudo"
        className="relative sr-only px-3 py-2 text-sm focus:not-sr-only focus:block focus:bg-white/20 focus:text-white"
      >
        Ir para o conteúdo
      </a>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 md:py-12">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:items-end">
          <div className="min-w-0 text-center lg:text-left">
            <div className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide ring-1 ring-white/15">
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              Presença v2.0
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">
              Gestão de presenças
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/88 sm:text-base">
              Acompanhe turmas, inscritos, frequências e relatórios com fluxo
              rastreável, acessível e alinhado ao contrato oficial da plataforma.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <button
                type="button"
                onClick={onAtualizar}
                disabled={atualizando}
                className={classNames(
                  "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-black text-white shadow-sm transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
                  atualizando
                    ? "cursor-not-allowed bg-white/20 opacity-70"
                    : "bg-white/15 hover:bg-white/25"
                )}
                aria-label="Atualizar lista de eventos"
                aria-busy={atualizando ? "true" : "false"}
              >
                <RefreshCcw
                  className={classNames(
                    "h-4 w-4",
                    atualizando && "animate-spin"
                  )}
                  aria-hidden="true"
                />
                {atualizando ? "Atualizando..." : "Atualizar dados"}
              </button>

              <div className="inline-flex items-center gap-1 rounded-2xl border border-white/10 bg-white/10 p-1">
                <button
                  type="button"
                  onClick={() => setAgrupamento("pessoa")}
                  className={classNames(
                    "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold transition",
                    agrupamento === "pessoa"
                      ? "bg-white text-teal-900"
                      : "text-white/90 hover:bg-white/10"
                  )}
                  aria-pressed={agrupamento === "pessoa"}
                >
                  <UsersRound className="h-4 w-4" aria-hidden="true" />
                  Pessoas
                </button>

                <button
                  type="button"
                  onClick={() => setAgrupamento("data")}
                  className={classNames(
                    "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold transition",
                    agrupamento === "data"
                      ? "bg-white text-teal-900"
                      : "text-white/90 hover:bg-white/10"
                  )}
                  aria-pressed={agrupamento === "data"}
                >
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  Datas
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MiniStat
              icon={Layers}
              label="Eventos"
              value={kpis.eventos}
              description="na visualização"
              tone="cyan"
            />
            <MiniStat
              icon={CalendarDays}
              label="Turmas"
              value={kpis.turmas}
              description="após filtros"
              tone="emerald"
            />
            <MiniStat
              icon={Clock3}
              label="Andamento"
              value={kpis.andamento}
              description="turmas ativas"
              tone="amber"
            />
            <MiniStat
              icon={CheckCircle2}
              label="Encerradas"
              value={kpis.encerradas}
              description="prontas para apuração"
              tone="rose"
            />
          </div>
        </div>
      </div>

      <div className="relative h-px w-full bg-white/25" aria-hidden="true" />
    </header>
  );
}

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
  totalEventos,
  totalTurmas,
}) {
  return (
    <section
      aria-label="Ferramentas de busca e filtros"
      className="sticky top-1 z-30 mx-auto mb-5 w-full max-w-7xl rounded-[1.75rem] border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <label className="relative block">
          <span className="sr-only">Buscar por evento ou turma</span>

          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />

          <input
            type="search"
            autoComplete="off"
            placeholder="Buscar por evento ou turma..."
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            Filtros
          </span>

          <select
            value={statusFiltro}
            onChange={(event) => setStatusFiltro(event.target.value)}
            className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            aria-label="Filtrar por status"
          >
            <option value="todos">Todos os status</option>
            <option value="programado">Programadas</option>
            <option value="andamento">Em andamento</option>
            <option value="encerrado">Encerradas</option>
          </select>

          <select
            value={mesFiltro}
            onChange={(event) => setMesFiltro(event.target.value)}
            className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            aria-label="Filtrar por mês"
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
              className="inline-flex h-10 items-center gap-1 rounded-2xl bg-slate-100 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              aria-label="Limpar filtros"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span>
          {totalEventos} evento{totalEventos === 1 ? "" : "s"} • {totalTurmas}{" "}
          turma{totalTurmas === 1 ? "" : "s"} na visualização
        </span>

        <span className="inline-flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
          Ordenação: mais novas para mais antigas
        </span>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Página
 * ───────────────────────────────────────────────────────────── */

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

  const setLive = useCallback((message) => {
    if (liveRef.current) {
      liveRef.current.textContent = message;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      try {
        abortRef.current?.abort?.("unmount");
      } catch {
        // noop
      }
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.agrupamento, agrupamento);
    } catch {
      // noop
    }
  }, [agrupamento]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.busca, busca);
    } catch {
      // noop
    }
  }, [busca]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.status, statusFiltro);
    } catch {
      // noop
    }
  }, [statusFiltro]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.mes, mesFiltro);
    } catch {
      // noop
    }
  }, [mesFiltro]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(normalizarTexto(busca));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [busca]);

  const carregarEventos = useCallback(async () => {
    try {
      setCarregandoEventos(true);
      setErro("");
      setLive("Carregando eventos.");

      try {
        abortRef.current?.abort?.("new-request");
      } catch {
        // noop
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const response = await api.presenca.administrador({
        signal: controller.signal,
      });

      const listaEventos = unwrapEventosAdministrativos(response);

      if (!mountedRef.current) return;

      setEventos(listaEventos);
      setLive(`Eventos carregados: ${listaEventos.length}.`);
    } catch (error) {
      if (isAbortLike(error)) return;

      const message = getErrorMessage(error, "Erro ao carregar eventos.");

      if (!mountedRef.current) return;

      setErro(message);
      setEventos([]);
      notifyError(message);
      setLive("Falha ao carregar eventos.");

      window.setTimeout(() => erroRef.current?.focus?.(), 0);
    } finally {
      if (mountedRef.current) {
        setCarregandoEventos(false);
      }
    }
  }, [setLive]);

  useEffect(() => {
    carregarEventos();
  }, [carregarEventos]);

  const carregarInscritos = useCallback(
    async (turma_id) => {
      try {
        setLive(`Carregando inscritos da turma ${turma_id}.`);

        const response = await api.inscricao.listarPorTurma(turma_id, {
          on403: "silent",
        });

        const lista = unwrapArray(response);

        if (!mountedRef.current) return;

        setInscritosPorTurma((prev) => ({
          ...prev,
          [turma_id]: lista,
        }));

        setLive(`Inscritos da turma ${turma_id} carregados.`);
      } catch (error) {
        notifyError(getErrorMessage(error, "Erro ao carregar inscritos."));
        setLive("Falha ao carregar inscritos.");
      }
    },
    [setLive]
  );

  const carregarAvaliacao = useCallback(
    async (turma_id) => {
      try {
        if (typeof api.avaliacao?.porTurma !== "function") {
          setAvaliacaoPorTurma((prev) => ({
            ...prev,
            [turma_id]: [],
          }));
          return;
        }

        setLive(`Carregando avaliações da turma ${turma_id}.`);

        const response = await api.avaliacao.porTurma(turma_id, {
          on403: "silent",
        });

        const lista = unwrapArray(response);

        if (!mountedRef.current) return;

        setAvaliacaoPorTurma((prev) => ({
          ...prev,
          [turma_id]: lista,
        }));

        setLive("Avaliações carregadas.");
      } catch (error) {
        notifyError(getErrorMessage(error, "Erro ao carregar avaliações."));
        setLive("Falha ao carregar avaliações.");
      }
    },
    [setLive]
  );

  const gerarRelatorioPDF = useCallback(
    async (turma_id, turmaNome = "lista-presenca") => {
      try {
        setLive(`Gerando PDF da turma ${turma_id}.`);

        const { blob, filename } = await api.presenca.turmaPdf(turma_id);

        downloadBlob(
          filename ||
            `lista_presenca_${sanitizeFileName(turmaNome)}_${turma_id}.pdf`,
          blob
        );

        notifySuccess("PDF gerado com sucesso.");
        setLive("PDF gerado com sucesso.");
      } catch (error) {
        notifyError(getErrorMessage(error, "Não foi possível gerar o PDF."));
        setLive("Falha ao gerar PDF.");
      }
    },
    [setLive]
  );

  const mesesDisponiveis = useMemo(() => {
    const set = new Set();

    for (const evento of eventos || []) {
      for (const turma of evento?.turmas || []) {
        const data = normalizeYMD(turma?.data_inicio);

        if (data) {
          set.add(data.slice(0, 7));
        }
      }
    }

    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [eventos]);

  const eventosProcessados = useMemo(() => {
    const base = sortEventosDesc(
      (eventos || []).map((evento) => ({
        ...evento,
        turmas: sortTurmasDesc(
          Array.isArray(evento?.turmas) ? evento.turmas : []
        ),
      }))
    );

    const filtrados = [];

    for (const evento of base) {
      const tituloEvento = normalizarTexto(evento?.titulo);

      const turmasFiltradas = (evento?.turmas || []).filter((turma) => {
        const nomeTurma = normalizarTexto(turma?.nome);
        const status = getTurmaStatus(turma);
        const mes = normalizeYMD(turma?.data_inicio)?.slice(0, 7) || "";

        const bateBusca =
          !q || tituloEvento.includes(q) || nomeTurma.includes(q);

        const bateStatus =
          statusFiltro === "todos" ? true : status === statusFiltro;

        const bateMes = mesFiltro === "todos" ? true : mes === mesFiltro;

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
    const eventosCount = Array.isArray(eventosProcessados)
      ? eventosProcessados.length
      : 0;

    let turmasCount = 0;
    let programadoCount = 0;
    let andamentoCount = 0;
    let encerradoCount = 0;

    for (const evento of eventosProcessados || []) {
      const turmas = Array.isArray(evento?.turmas) ? evento.turmas : [];

      turmasCount += turmas.length;

      for (const turma of turmas) {
        const status = getTurmaStatus(turma);

        if (status === "programado") programadoCount += 1;
        if (status === "andamento") andamentoCount += 1;
        if (status === "encerrado") encerradoCount += 1;
      }
    }

    return {
      eventos: eventosCount,
      turmas: turmasCount,
      programado: programadoCount,
      andamento: andamentoCount,
      encerradas: encerradoCount,
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
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <p
        ref={liveRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />

      <HeaderHero
        onAtualizar={carregarEventos}
        atualizando={carregandoEventos}
        agrupamento={agrupamento}
        setAgrupamento={setAgrupamento}
        kpis={kpis}
      />

      {anyLoading && (
        <div
          className="sticky top-0 z-40 h-1 w-full bg-emerald-100 dark:bg-emerald-950"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando dados"
        >
          <div className="h-full w-1/3 animate-pulse bg-emerald-700 dark:bg-emerald-500" />
        </div>
      )}

      <main
        id="conteudo"
        className="mx-auto w-full max-w-7xl flex-1 px-3 py-6 sm:px-4 lg:px-6"
      >
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
          totalEventos={kpis.eventos}
          totalTurmas={kpis.turmas}
        />

        {!!erro && !carregandoEventos && (
          <section
            ref={erroRef}
            tabIndex={-1}
            className="mb-5 rounded-[1.75rem] border border-rose-200 bg-rose-50 p-5 outline-none dark:border-rose-900/50 dark:bg-rose-950/30"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>

              <div className="min-w-0">
                <h2 className="text-base font-black text-rose-900 dark:text-rose-100">
                  Não foi possível carregar a gestão de presenças
                </h2>

                <p className="mt-1 break-words text-sm text-rose-800/90 dark:text-rose-100/90">
                  {erro}
                </p>

                <button
                  type="button"
                  onClick={carregarEventos}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-rose-700 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                  Tentar novamente
                </button>
              </div>
            </div>
          </section>
        )}

        {carregandoEventos ? (
          <section
            className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"
            aria-busy="true"
            aria-live="polite"
          >
            <LoadingInline label="Carregando eventos e turmas..." />
          </section>
        ) : eventosProcessados.length === 0 ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-3xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
              <ClipboardCheck className="h-7 w-7" aria-hidden="true" />
            </div>

            <h2 className="text-lg font-black text-slate-950 dark:text-white">
              Nenhum resultado encontrado
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
              Ajuste os filtros, limpe a busca ou atualize os dados para
              visualizar outras turmas.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {filtrosAtivos && (
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Limpar filtros
                </button>
              )}

              <button
                type="button"
                onClick={carregarEventos}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                Atualizar
              </button>
            </div>
          </section>
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
    </div>
  );
}