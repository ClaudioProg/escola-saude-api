// ✅ frontend/src/pages/CancelarInscricaoAdmin.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Página administrativa para cancelamento de inscrições.
//
// Contratos aplicados:
// - Eventos administrativos: /evento/administrador via eventoService;
// - Turmas do evento: /evento/:evento_id/turma via eventoService;
// - Inscritos da turma: /inscricao/turma/:turma_id via eventoService;
// - Cancelamento administrativo: /inscricao/turma/:turma_id/usuario/:usuario_id via eventoService;
// - Sem /api diretamente no frontend;
// - Sem rotas antigas em tentativa múltipla;
// - Sem /eventos, /turmas ou /inscricoes como fallback;
// - Sem status em_andamento;
// - Status oficial: programado | andamento | encerrado | sem_datas;
// - "todos" é apenas filtro visual da UI;
// - Sem Spinner antigo;
// - Sem Footer antigo;
// - Sem toast direto;
// - Sem apiGet/apiDelete direto;
// - CPF protegido por padrão;
// - Mobile-first, acessível, com aria-live e confirmação antes de ação destrutiva.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Filter,
  Info,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
  Square,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";

import {
  isAbortLike,
  listarEventosAdmin,
  listarInscritosDaTurma,
  listarTurmasDoEvento,
} from "../services/eventoService";

import {
  notifyError,
  notifyInfo,
  notifySuccess,
} from "../components/ui/AppToast";

import api from "../services/api";

/* ─────────────────────────────────────────────────────────────
   Constantes
────────────────────────────────────────────────────────────── */

const STATUS_EVENTO = Object.freeze({
  TODOS: "todos",
  PROGRAMADO: "programado",
  ANDAMENTO: "andamento",
  ENCERRADO: "encerrado",
  SEM_DATAS: "sem_datas",
});

const FILTROS_STATUS = Object.freeze([
  { key: STATUS_EVENTO.TODOS, label: "Todos" },
  { key: STATUS_EVENTO.PROGRAMADO, label: "Programados" },
  { key: STATUS_EVENTO.ANDAMENTO, label: "Em andamento" },
  { key: STATUS_EVENTO.ENCERRADO, label: "Encerrados" },
  { key: STATUS_EVENTO.SEM_DATAS, label: "Sem datas" },
]);

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function toPositiveInt(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function ymd(value) {
  if (typeof value !== "string") return "";

  const valueSafe = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(valueSafe)) return valueSafe;
  if (/^\d{4}-\d{2}-\d{2}T/.test(valueSafe)) return valueSafe.slice(0, 10);

  return "";
}

function hhmm(value, fallback = "") {
  if (typeof value !== "string") return fallback;

  const valueSafe = value.trim();

  if (!valueSafe) return fallback;
  if (/^\d{2}:\d{2}$/.test(valueSafe)) return valueSafe;
  if (/^\d{2}:\d{2}:\d{2}$/.test(valueSafe)) return valueSafe.slice(0, 5);

  return fallback;
}

function toLocalDateTime(dateOnly, time = "00:00") {
  const data = ymd(dateOnly);
  const hora = hhmm(time, "00:00");

  if (!data || !hora) return null;

  const [year, month, day] = data.split("-").map(Number);
  const [hour, minute] = hora.split(":").map(Number);

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function formatarDataBR(value) {
  const data = ymd(value);

  if (!data) return "";

  const [year, month, day] = data.split("-");
  return `${day}/${month}/${year}`;
}

function cpfProtegido(value) {
  const digits = onlyDigits(value);

  if (digits.length !== 11) {
    return value ? String(value) : "—";
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.***-**`;
}

function normalizarTexto(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function deduzStatusEvento(evento) {
  const raw = String(evento?.status || "").trim().toLowerCase();

  if (raw === STATUS_EVENTO.PROGRAMADO) return STATUS_EVENTO.PROGRAMADO;
  if (raw === STATUS_EVENTO.ANDAMENTO) return STATUS_EVENTO.ANDAMENTO;
  if (raw === STATUS_EVENTO.ENCERRADO) return STATUS_EVENTO.ENCERRADO;
  if (raw === STATUS_EVENTO.SEM_DATAS) return STATUS_EVENTO.SEM_DATAS;

  const dataInicio = ymd(
    evento?.data_inicio_geral || evento?.data_inicio || evento?.data
  );

  const dataFim = ymd(
    evento?.data_fim_geral || evento?.data_fim || evento?.data
  );

  if (!dataInicio || !dataFim) return STATUS_EVENTO.SEM_DATAS;

  const inicio = toLocalDateTime(
    dataInicio,
    evento?.horario_inicio_geral || evento?.horario_inicio || "00:00"
  );

  const fim = toLocalDateTime(
    dataFim,
    evento?.horario_fim_geral || evento?.horario_fim || "23:59"
  );

  if (!inicio || !fim) return STATUS_EVENTO.SEM_DATAS;

  const agora = new Date();

  if (agora < inicio) return STATUS_EVENTO.PROGRAMADO;
  if (agora > fim) return STATUS_EVENTO.ENCERRADO;

  return STATUS_EVENTO.ANDAMENTO;
}

function labelStatus(status) {
  if (status === STATUS_EVENTO.ANDAMENTO) return "Em andamento";
  if (status === STATUS_EVENTO.ENCERRADO) return "Encerrado";
  if (status === STATUS_EVENTO.SEM_DATAS) return "Sem datas";

  return "Programado";
}

function barByStatus(status) {
  if (status === STATUS_EVENTO.PROGRAMADO) {
    return "bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-500";
  }

  if (status === STATUS_EVENTO.ANDAMENTO) {
    return "bg-gradient-to-r from-amber-700 via-amber-600 to-amber-400";
  }

  if (status === STATUS_EVENTO.ENCERRADO) {
    return "bg-gradient-to-r from-rose-800 via-rose-700 to-rose-500";
  }

  return "bg-gradient-to-r from-slate-500 via-slate-400 to-slate-300";
}

function statusChipClass(status) {
  if (status === STATUS_EVENTO.ANDAMENTO) {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100";
  }

  if (status === STATUS_EVENTO.ENCERRADO) {
    return "bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100";
  }

  if (status === STATUS_EVENTO.SEM_DATAS) {
    return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100";
  }

  return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100";
}

/* ─────────────────────────────────────────────────────────────
   Debounce
────────────────────────────────────────────────────────────── */

function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);

    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/* ─────────────────────────────────────────────────────────────
   Componentes locais
────────────────────────────────────────────────────────────── */

function LoadingInline({ pequeno = false, label = "Carregando..." }) {
  return (
    <div
      className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"
      role="status"
      aria-live="polite"
    >
      <RefreshCw
        className={pequeno ? "h-4 w-4 animate-spin" : "h-5 w-5 animate-spin"}
        aria-hidden="true"
      />

      <span>{label}</span>
    </div>
  );
}

function MiniKpi({ icon: Icon, value, label, hideSm = false, hideMd = false }) {
  return (
    <span
      className={classNames(
        "items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold ring-1 ring-white/10",
        hideSm ? "hidden sm:inline-flex" : "inline-flex",
        hideMd && "hidden md:inline-flex"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {value} {label}
    </span>
  );
}

function HeaderHero({
  totalEventos,
  totalTurmas,
  totalInscritos,
  onSearch,
  searchValue,
}) {
  const buscaRef = useRef(null);

  useEffect(() => {
    const onKey = (event) => {
      const mac = /(Mac|iPhone|iPad)/i.test(navigator.userAgent);
      const key = String(event.key || "").toLowerCase();

      if (
        (mac && event.metaKey && key === "k") ||
        (!mac && event.ctrlKey && key === "k")
      ) {
        event.preventDefault();
        buscaRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header
      className="bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 text-white"
      role="banner"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="inline-flex items-center justify-center gap-2">
            <XCircle className="h-5 w-5" aria-hidden="true" />

            <h1 className="text-xl font-black tracking-tight sm:text-2xl">
              Cancelar inscrições
            </h1>
          </div>

          <p className="max-w-3xl text-sm text-white/90">
            Expanda um evento, selecione a turma e cancele inscrições de
            participantes com confirmação explícita.
          </p>

          <div className="mt-2 grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="busca-cancelamento-inscricao" className="sr-only">
                Buscar por evento ou local
              </label>

              <div className="relative">
                <input
                  id="busca-cancelamento-inscricao"
                  ref={buscaRef}
                  type="search"
                  value={searchValue}
                  onChange={(event) => onSearch(event.target.value)}
                  placeholder="Buscar por título do evento ou local… (Ctrl/⌘+K)"
                  className="w-full rounded-2xl bg-white/95 px-4 py-3 pl-11 text-sm font-semibold text-slate-900 placeholder-slate-500 outline-none focus:ring-2 focus:ring-white/70"
                />

                <Search
                  className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <MiniKpi icon={Filter} value={totalEventos} label="eventos" />
              <MiniKpi icon={Layers} value={totalTurmas} label="turmas" hideSm />
              <MiniKpi icon={Users} value={totalInscritos} label="inscritos" hideMd />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function ConfirmModal({
  open,
  title,
  message,
  onCancel,
  onConfirm,
  confirmLabel = "Confirmar",
  danger = false,
  loading = false,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      window.setTimeout(() => ref.current?.focus(), 30);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event) => {
      if (event.key === "Escape" && !loading) {
        event.preventDefault();
        onCancel?.();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [loading, onCancel, open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        onClick={loading ? undefined : onCancel}
        aria-label="Fechar confirmação"
      />

      <div
        ref={ref}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-3xl bg-white text-slate-950 shadow-2xl ring-1 ring-black/10 outline-none dark:bg-zinc-900 dark:text-white"
      >
        <div className="p-5">
          <div className="mb-3 flex items-start gap-3">
            <span
              className={classNames(
                "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
                danger
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
              )}
            >
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>

            <div>
              <h2 id="confirm-title" className="text-lg font-black">
                {title}
              </h2>

              <p
                id="confirm-message"
                className="mt-1 text-sm text-slate-600 dark:text-zinc-300"
              >
                {message}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={classNames(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black text-white transition disabled:opacity-60",
              danger
                ? "bg-rose-700 hover:bg-rose-800"
                : "bg-emerald-700 hover:bg-emerald-800"
            )}
          >
            {loading && (
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Página
────────────────────────────────────────────────────────────── */

export default function CancelarInscricaoAdmin() {
  const [eventos, setEventos] = useState([]);
  const [loadingEventos, setLoadingEventos] = useState(true);

  const [abertoEvento, setAbertoEvento] = useState({});
  const [turmasPorEvento, setTurmasPorEvento] = useState({});
  const [loadingTurmas, setLoadingTurmas] = useState({});

  const [abertaTurma, setAbertaTurma] = useState({});
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [loadingInscritos, setLoadingInscritos] = useState({});

  const [selecionados, setSelecionados] = useState({});
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebounced(busca, 350);
  const [filtroStatus, setFiltroStatus] = useState(STATUS_EVENTO.TODOS);

  const [modal, setModal] = useState({
    open: false,
    turma_id: null,
    usuario_ids: [],
  });

  const [cancelando, setCancelando] = useState(false);
  const liveRef = useRef(null);

  const setLive = useCallback((message) => {
    if (liveRef.current) {
      liveRef.current.textContent = message;
    }
  }, []);

  const carregarEventos = useCallback(
    async ({ signal } = {}) => {
      setLoadingEventos(true);
      setLive("Carregando eventos.");

      try {
        const data = await listarEventosAdmin({ signal });

        if (signal?.aborted) return;

        setEventos(Array.isArray(data) ? data : []);
        setLive(`${Array.isArray(data) ? data.length : 0} evento(s) carregado(s).`);
      } catch (error) {
        if (isAbortLike(error)) return;

        notifyError(
          error?.data?.message || error?.message || "Falha ao carregar eventos."
        );
        setLive("Falha ao carregar eventos.");
        setEventos([]);
      } finally {
        if (!signal?.aborted) {
          setLoadingEventos(false);
        }
      }
    },
    [setLive]
  );

  useEffect(() => {
    const controller = new AbortController();

    carregarEventos({ signal: controller.signal });

    return () => controller.abort();
  }, [carregarEventos]);

  const carregarTurmasEvento = useCallback(
    async (evento_id) => {
      const eventoId = toPositiveInt(evento_id);

      if (!eventoId) return [];

      setLoadingTurmas((prev) => ({ ...prev, [eventoId]: true }));
      setLive(`Carregando turmas do evento ${eventoId}.`);

      try {
        const turmas = await listarTurmasDoEvento(eventoId);

        setTurmasPorEvento((prev) => ({
          ...prev,
          [eventoId]: Array.isArray(turmas) ? turmas : [],
        }));

        setLive(`${Array.isArray(turmas) ? turmas.length : 0} turma(s) carregada(s).`);

        return Array.isArray(turmas) ? turmas : [];
      } catch (error) {
        notifyError(
          error?.data?.message ||
            error?.message ||
            "Falha ao carregar turmas do evento."
        );

        setTurmasPorEvento((prev) => ({ ...prev, [eventoId]: [] }));
        setLive("Falha ao carregar turmas do evento.");

        return [];
      } finally {
        setLoadingTurmas((prev) => ({ ...prev, [eventoId]: false }));
      }
    },
    [setLive]
  );

  const carregarInscritos = useCallback(
    async (turma_id) => {
      const turmaId = toPositiveInt(turma_id);

      if (!turmaId) return [];

      setLoadingInscritos((prev) => ({ ...prev, [turmaId]: true }));
      setLive(`Carregando inscritos da turma ${turmaId}.`);

      try {
        const inscritos = await listarInscritosDaTurma(turmaId);

        setInscritosPorTurma((prev) => ({
          ...prev,
          [turmaId]: Array.isArray(inscritos) ? inscritos : [],
        }));

        setSelecionados((prev) => ({ ...prev, [turmaId]: new Set() }));
        setLive(`${Array.isArray(inscritos) ? inscritos.length : 0} inscrito(s) carregado(s).`);

        return Array.isArray(inscritos) ? inscritos : [];
      } catch (error) {
        notifyError(
          error?.data?.message || error?.message || "Falha ao carregar inscritos."
        );

        setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: [] }));
        setLive("Falha ao carregar inscritos.");

        return [];
      } finally {
        setLoadingInscritos((prev) => ({ ...prev, [turmaId]: false }));
      }
    },
    [setLive]
  );

  const toggleEvento = useCallback(
    async (evento_id) => {
      const eventoId = toPositiveInt(evento_id);

      if (!eventoId) return;

      const willOpen = !abertoEvento[eventoId];

      setAbertoEvento((prev) => ({ ...prev, [eventoId]: willOpen }));

      if (!willOpen) return;
      if (turmasPorEvento[eventoId] || loadingTurmas[eventoId]) return;

      await carregarTurmasEvento(eventoId);
    },
    [abertoEvento, carregarTurmasEvento, loadingTurmas, turmasPorEvento]
  );

  const toggleTurma = useCallback(
    async (turma_id) => {
      const turmaId = toPositiveInt(turma_id);

      if (!turmaId) return;

      const willOpen = !abertaTurma[turmaId];

      setAbertaTurma((prev) => ({ ...prev, [turmaId]: willOpen }));

      if (willOpen && !inscritosPorTurma[turmaId]) {
        await carregarInscritos(turmaId);
      }
    },
    [abertaTurma, carregarInscritos, inscritosPorTurma]
  );

  const totalTurmas = useMemo(
    () =>
      Object.values(turmasPorEvento).reduce(
        (acc, list) => acc + (Array.isArray(list) ? list.length : 0),
        0
      ),
    [turmasPorEvento]
  );

  const totalInscritos = useMemo(
    () =>
      Object.values(inscritosPorTurma).reduce(
        (acc, list) => acc + (Array.isArray(list) ? list.length : 0),
        0
      ),
    [inscritosPorTurma]
  );

  const eventosFiltrados = useMemo(() => {
    const query = normalizarTexto(buscaDebounced);

    return (Array.isArray(eventos) ? eventos : []).filter((evento) => {
      const status = deduzStatusEvento(evento);

      if (filtroStatus !== STATUS_EVENTO.TODOS && status !== filtroStatus) {
        return false;
      }

      if (!query) return true;

      return [evento?.titulo, evento?.local]
        .map(normalizarTexto)
        .some((value) => value.includes(query));
    });
  }, [buscaDebounced, eventos, filtroStatus]);

  const anyLoading =
    loadingEventos ||
    Object.values(loadingTurmas).some(Boolean) ||
    Object.values(loadingInscritos).some(Boolean);

  const totalSelecionados = useMemo(
    () =>
      Object.values(selecionados).reduce(
        (acc, setValue) => acc + (setValue?.size || 0),
        0
      ),
    [selecionados]
  );

  function toggleSelecionado(turma_id, usuario_id) {
    const turmaId = toPositiveInt(turma_id);
    const usuarioId = toPositiveInt(usuario_id);

    if (!turmaId || !usuarioId) return;

    setSelecionados((prev) => {
      const atual = new Set(prev[turmaId] || []);

      if (atual.has(usuarioId)) {
        atual.delete(usuarioId);
      } else {
        atual.add(usuarioId);
      }

      return {
        ...prev,
        [turmaId]: atual,
      };
    });
  }

  function selecionarTodos(turma_id) {
    const turmaId = toPositiveInt(turma_id);

    if (!turmaId) return;

    const lista = inscritosPorTurma[turmaId] || [];

    setSelecionados((prev) => ({
      ...prev,
      [turmaId]: new Set(
        lista
          .map((inscrito) => toPositiveInt(inscrito?.usuario_id))
          .filter(Boolean)
      ),
    }));
  }

  function limparSelecao(turma_id) {
    const turmaId = toPositiveInt(turma_id);

    if (!turmaId) return;

    setSelecionados((prev) => ({
      ...prev,
      [turmaId]: new Set(),
    }));
  }

  function confirmarCancelarIndividual(turma_id, usuario_id) {
    const turmaId = toPositiveInt(turma_id);
    const usuarioId = toPositiveInt(usuario_id);

    if (!turmaId || !usuarioId) return;

    setModal({
      open: true,
      turma_id: turmaId,
      usuario_ids: [usuarioId],
    });
  }

  function confirmarCancelarLote(turma_id) {
    const turmaId = toPositiveInt(turma_id);

    if (!turmaId) return;

    const setSelecionado = selecionados[turmaId] || new Set();

    if (setSelecionado.size === 0) {
      notifyInfo("Selecione pelo menos um participante.");
      return;
    }

    setModal({
      open: true,
      turma_id: turmaId,
      usuario_ids: Array.from(setSelecionado),
    });
  }

  const fecharModal = useCallback(() => {
    if (cancelando) return;

    setModal({
      open: false,
      turma_id: null,
      usuario_ids: [],
    });
  }, [cancelando]);

  async function efetivarCancelamento() {
    const turmaId = toPositiveInt(modal.turma_id);
    const usuarioIds = Array.isArray(modal.usuario_ids)
      ? modal.usuario_ids.map(toPositiveInt).filter(Boolean)
      : [];

    if (!turmaId || usuarioIds.length === 0) {
      fecharModal();
      return;
    }

    const snapshotInscritos = inscritosPorTurma[turmaId] || [];
    const snapshotSelecionados = selecionados[turmaId] || new Set();

    setCancelando(true);
    setLive(`Cancelando ${usuarioIds.length} inscrição(ões).`);

    setInscritosPorTurma((prev) => {
      const atuais = prev[turmaId] || [];

      return {
        ...prev,
        [turmaId]: atuais.filter(
          (inscrito) => !usuarioIds.includes(Number(inscrito?.usuario_id))
        ),
      };
    });

    setSelecionados((prev) => ({
      ...prev,
      [turmaId]: new Set(),
    }));

    try {
      for (const usuarioId of usuarioIds) {
        await api.inscricao.cancelarUsuarioNaTurma(turmaId, usuarioId);
      }

      notifySuccess(
        usuarioIds.length > 1
          ? "Inscrições canceladas com sucesso."
          : "Inscrição cancelada com sucesso."
      );

      setLive("Cancelamento concluído.");

      setModal({
        open: false,
        turma_id: null,
        usuario_ids: [],
      });
    } catch (error) {
      setInscritosPorTurma((prev) => ({
        ...prev,
        [turmaId]: snapshotInscritos,
      }));

      setSelecionados((prev) => ({
        ...prev,
        [turmaId]: new Set(snapshotSelecionados),
      }));

      notifyError(
        error?.data?.message || error?.message || "Erro ao cancelar inscrição."
      );

      setLive("Falha ao cancelar. Lista restaurada.");
      await carregarInscritos(turmaId);
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-zinc-950 dark:text-white">
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <HeaderHero
        totalEventos={eventosFiltrados.length}
        totalTurmas={totalTurmas}
        totalInscritos={totalInscritos}
        onSearch={setBusca}
        searchValue={busca}
      />

      <section
        className="mx-auto mt-4 w-full max-w-6xl px-3 sm:px-6"
        aria-label="Filtros de status"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-zinc-300">
            <Info className="h-4 w-4" aria-hidden="true" />
            Filtro rápido:
          </span>

          {FILTROS_STATUS.map((filtro) => (
            <button
              key={filtro.key}
              type="button"
              onClick={() => setFiltroStatus(filtro.key)}
              className={classNames(
                "rounded-full border px-3 py-1 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                filtroStatus === filtro.key
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              )}
              aria-pressed={filtroStatus === filtro.key}
            >
              {filtro.label}
            </button>
          ))}
        </div>
      </section>

      {anyLoading && (
        <div
          className="sticky top-0 z-40 h-1 w-full bg-emerald-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando dados"
        >
          <div className="h-full w-1/3 animate-pulse bg-emerald-700" />
        </div>
      )}

      <main className="mx-auto min-w-0 max-w-6xl flex-1 px-3 py-6 sm:px-6">
        {loadingEventos ? (
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-zinc-900">
            <div className="flex items-center justify-center p-8">
              <LoadingInline label="Carregando eventos..." />
            </div>
          </section>
        ) : eventosFiltrados.length === 0 ? (
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-zinc-900">
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-slate-600 dark:text-zinc-300">
                Nenhum evento encontrado{" "}
                {buscaDebounced ? "para o filtro aplicado." : "no momento."}
              </p>
            </div>
          </section>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:gap-6">
            {eventosFiltrados.map((evento) => {
              const eventoId = toPositiveInt(evento?.id);
              const aberto = !!abertoEvento[eventoId];
              const turmas = turmasPorEvento[eventoId] || [];
              const carregandoTurmas = !!loadingTurmas[eventoId];
              const status = deduzStatusEvento(evento);
              const bar = barByStatus(status);

              return (
                <li
                  key={eventoId}
                  className="relative overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-zinc-900"
                >
                  <div
                    className={classNames("absolute left-0 right-0 top-0 h-1.5", bar)}
                    aria-hidden="true"
                  />

                  <button
                    type="button"
                    onClick={() => toggleEvento(eventoId)}
                    className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-emerald-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:hover:bg-zinc-800/60"
                    aria-expanded={aberto}
                    aria-controls={`evento-${eventoId}-conteudo`}
                  >
                    {aberto ? (
                      <ChevronDown className="mt-0.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="mt-0.5 shrink-0" aria-hidden="true" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <div className="break-words font-black">
                          {evento?.titulo || `Evento #${eventoId}`}
                        </div>

                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-900">
                          {turmas.length} turmas
                        </span>

                        <span
                          className={classNames(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-black",
                            statusChipClass(status)
                          )}
                        >
                          {labelStatus(status)}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 dark:text-zinc-300">
                        <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="break-words">
                          {evento?.local || "Local a definir"}
                        </span>

                        <span aria-hidden="true">•</span>

                        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          Carga horária:{" "}
                          {evento?.carga_horaria_total ?? evento?.carga_horaria ?? "—"}
                        </span>
                      </div>
                    </div>
                  </button>

                  {aberto && (
                    <div
                      id={`evento-${eventoId}-conteudo`}
                      className="bg-slate-50/80 dark:bg-zinc-950/30"
                    >
                      {carregandoTurmas ? (
                        <div className="p-4 pl-10">
                          <LoadingInline pequeno label="Carregando turmas..." />
                        </div>
                      ) : turmas.length === 0 ? (
                        <div className="p-4 pl-10 text-sm font-semibold text-slate-600 dark:text-zinc-300">
                          Nenhuma turma para este evento.
                        </div>
                      ) : (
                        turmas.map((turma) => {
                          const turmaId = toPositiveInt(turma?.id);
                          const aberta = !!abertaTurma[turmaId];
                          const inscritos = inscritosPorTurma[turmaId] || [];
                          const carregandoInscritos = !!loadingInscritos[turmaId];
                          const setSelecionado = selecionados[turmaId] || new Set();
                          const allSelected =
                            inscritos.length > 0 &&
                            setSelecionado.size === inscritos.length;

                          return (
                            <div
                              key={turmaId}
                              className="border-t border-slate-100 dark:border-zinc-800"
                            >
                              <button
                                type="button"
                                onClick={() => toggleTurma(turmaId)}
                                className="flex w-full items-center gap-3 p-3 pl-10 text-left transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:hover:bg-zinc-800"
                                aria-expanded={aberta}
                                aria-controls={`turma-${turmaId}-conteudo`}
                              >
                                {aberta ? (
                                  <ChevronDown
                                    className="mt-0.5 shrink-0"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <ChevronRight
                                    className="mt-0.5 shrink-0"
                                    aria-hidden="true"
                                  />
                                )}

                                <div className="min-w-0 flex-1">
                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <div className="break-words font-bold">
                                      {turma?.nome || `Turma #${turmaId}`}{" "}
                                      <span className="text-xs font-semibold text-slate-500">
                                        ({turma?.carga_horaria ?? "—"}h)
                                      </span>
                                    </div>

                                    <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-black dark:bg-zinc-700">
                                      {inscritos.length} inscritos
                                    </span>
                                  </div>

                                  <div className="text-xs font-medium text-slate-600 dark:text-zinc-300">
                                    {turma?.data_inicio
                                      ? `Início: ${formatarDataBR(turma.data_inicio)}${
                                          turma?.horario_inicio
                                            ? ` às ${hhmm(turma.horario_inicio)}`
                                            : ""
                                        }`
                                      : "Datas a definir"}
                                  </div>
                                </div>
                              </button>

                              {aberta && (
                                <div className="flex flex-wrap items-center gap-2 px-3 pb-2 pl-14 sm:px-4">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      allSelected
                                        ? limparSelecao(turmaId)
                                        : selecionarTodos(turmaId)
                                    }
                                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-2 py-1 text-xs font-black transition hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                                  >
                                    {allSelected ? (
                                      <Square className="h-4 w-4" aria-hidden="true" />
                                    ) : (
                                      <CheckSquare
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                      />
                                    )}

                                    {allSelected ? "Limpar seleção" : "Selecionar todos"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => confirmarCancelarLote(turmaId)}
                                    className="inline-flex items-center gap-1 rounded-xl bg-rose-700 px-2 py-1 text-xs font-black text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={setSelecionado.size === 0}
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    Cancelar selecionados ({setSelecionado.size})
                                  </button>
                                </div>
                              )}

                              {aberta && (
                                <div
                                  id={`turma-${turmaId}-conteudo`}
                                  className="p-3 pl-14 sm:p-4"
                                >
                                  {carregandoInscritos ? (
                                    <div className="p-3">
                                      <LoadingInline
                                        pequeno
                                        label="Carregando inscritos..."
                                      />
                                    </div>
                                  ) : inscritos.length === 0 ? (
                                    <div className="text-sm font-semibold text-slate-600 dark:text-zinc-300">
                                      Nenhum inscrito nesta turma.
                                    </div>
                                  ) : (
                                    <>
                                      <div className="hidden overflow-x-auto md:block">
                                        <table className="min-w-full text-sm">
                                          <thead className="bg-slate-100 dark:bg-zinc-800">
                                            <tr className="text-left">
                                              <th className="w-10 px-3 py-2 font-black">
                                                <span className="sr-only">
                                                  Selecionar
                                                </span>
                                              </th>
                                              <th className="px-3 py-2 font-black">
                                                Nome
                                              </th>
                                              <th className="px-3 py-2 font-black">
                                                CPF
                                              </th>
                                              <th className="px-3 py-2 font-black">
                                                Frequência
                                              </th>
                                              <th className="px-3 py-2 text-right font-black">
                                                Ações
                                              </th>
                                            </tr>
                                          </thead>

                                          <tbody>
                                            {inscritos.map((inscrito) => {
                                              const usuarioId = toPositiveInt(
                                                inscrito?.usuario_id
                                              );
                                              const marcado =
                                                setSelecionado.has(usuarioId);

                                              return (
                                                <tr
                                                  key={`${turmaId}-${usuarioId}`}
                                                  className="border-t border-slate-200 dark:border-zinc-800"
                                                >
                                                  <td className="px-3 py-2 align-middle">
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        toggleSelecionado(
                                                          turmaId,
                                                          usuarioId
                                                        )
                                                      }
                                                      aria-pressed={marcado}
                                                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-zinc-700 dark:hover:bg-zinc-800"
                                                      title={
                                                        marcado
                                                          ? "Remover da seleção"
                                                          : "Selecionar para cancelamento"
                                                      }
                                                    >
                                                      {marcado ? (
                                                        <CheckSquare
                                                          className="h-4 w-4"
                                                          aria-hidden="true"
                                                        />
                                                      ) : (
                                                        <Square
                                                          className="h-4 w-4"
                                                          aria-hidden="true"
                                                        />
                                                      )}
                                                    </button>
                                                  </td>

                                                  <td className="break-words px-3 py-2 font-semibold">
                                                    {inscrito?.nome || "—"}
                                                  </td>

                                                  <td className="px-3 py-2 font-mono">
                                                    {cpfProtegido(inscrito?.cpf)}
                                                  </td>

                                                  <td className="px-3 py-2">
                                                    {inscrito?.frequencia || "—"}
                                                  </td>

                                                  <td className="px-3 py-2">
                                                    <div className="flex justify-end">
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          confirmarCancelarIndividual(
                                                            turmaId,
                                                            usuarioId
                                                          )
                                                        }
                                                        className="inline-flex items-center gap-1 rounded-xl bg-rose-700 px-3 py-1.5 text-sm font-black text-white transition hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                                                        title="Cancelar inscrição"
                                                      >
                                                        <Trash2
                                                          className="h-4 w-4"
                                                          aria-hidden="true"
                                                        />
                                                        Cancelar
                                                      </button>
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>

                                      <ul className="space-y-2 md:hidden">
                                        {inscritos.map((inscrito) => {
                                          const usuarioId = toPositiveInt(
                                            inscrito?.usuario_id
                                          );
                                          const marcado =
                                            setSelecionado.has(usuarioId);

                                          return (
                                            <li
                                              key={`${turmaId}-${usuarioId}`}
                                              className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                                            >
                                              <div className="flex items-start gap-3">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    toggleSelecionado(
                                                      turmaId,
                                                      usuarioId
                                                    )
                                                  }
                                                  aria-pressed={marcado}
                                                  className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-300 transition hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                                                  title={
                                                    marcado
                                                      ? "Remover da seleção"
                                                      : "Selecionar para cancelamento"
                                                  }
                                                >
                                                  {marcado ? (
                                                    <CheckSquare
                                                      className="h-4 w-4"
                                                      aria-hidden="true"
                                                    />
                                                  ) : (
                                                    <Square
                                                      className="h-4 w-4"
                                                      aria-hidden="true"
                                                    />
                                                  )}
                                                </button>

                                                <div className="min-w-0 flex-1">
                                                  <p className="break-words font-black">
                                                    {inscrito?.nome || "—"}
                                                  </p>

                                                  <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                                                    CPF: {cpfProtegido(inscrito?.cpf)}
                                                  </p>

                                                  <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                                                    Frequência:{" "}
                                                    {inscrito?.frequencia || "—"}
                                                  </p>
                                                </div>

                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    confirmarCancelarIndividual(
                                                      turmaId,
                                                      usuarioId
                                                    )
                                                  }
                                                  className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-rose-700 px-3 py-1.5 text-xs font-black text-white transition hover:bg-rose-800"
                                                  title="Cancelar inscrição"
                                                >
                                                  <Trash2
                                                    className="h-4 w-4"
                                                    aria-hidden="true"
                                                  />
                                                  Cancelar
                                                </button>
                                              </div>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {totalSelecionados > 0 && (
        <div className="sticky bottom-0 z-30">
          <div className="mx-auto max-w-6xl px-3 pb-4 sm:px-6">
            <div className="rounded-3xl border border-emerald-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-emerald-900 dark:bg-zinc-900/95">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-sm font-black text-emerald-900 dark:text-emerald-200">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  {totalSelecionados} selecionado(s)
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {Object.entries(selecionados).map(([turmaIdRaw, setValue]) => {
                    const turmaId = toPositiveInt(turmaIdRaw);
                    const quantidade = setValue?.size || 0;

                    if (!turmaId || quantidade <= 0) return null;

                    return (
                      <button
                        key={turmaId}
                        type="button"
                        onClick={() => confirmarCancelarLote(turmaId)}
                        className="inline-flex items-center gap-1 rounded-xl bg-rose-700 px-3 py-1.5 text-sm font-black text-white transition hover:bg-rose-800"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Cancelar ({quantidade}) • Turma {turmaId}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={modal.open}
        title={
          modal.usuario_ids.length > 1
            ? "Cancelar inscrições selecionadas"
            : "Cancelar inscrição"
        }
        message={
          modal.usuario_ids.length > 1
            ? `Você está prestes a cancelar ${modal.usuario_ids.length} inscrição(ões). Esta ação removerá a inscrição e os registros de presença vinculados. Deseja continuar?`
            : "Você está prestes a cancelar esta inscrição. Esta ação removerá a inscrição e os registros de presença vinculados. Deseja continuar?"
        }
        onCancel={fecharModal}
        onConfirm={efetivarCancelamento}
        confirmLabel="Confirmar cancelamento"
        danger
        loading={cancelando}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PropTypes
────────────────────────────────────────────────────────────── */

LoadingInline.propTypes = {
  pequeno: PropTypes.bool,
  label: PropTypes.string,
};

MiniKpi.propTypes = {
  icon: PropTypes.elementType.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  label: PropTypes.string.isRequired,
  hideSm: PropTypes.bool,
  hideMd: PropTypes.bool,
};

HeaderHero.propTypes = {
  totalEventos: PropTypes.number.isRequired,
  totalTurmas: PropTypes.number.isRequired,
  totalInscritos: PropTypes.number.isRequired,
  onSearch: PropTypes.func.isRequired,
  searchValue: PropTypes.string.isRequired,
};

ConfirmModal.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  confirmLabel: PropTypes.string,
  danger: PropTypes.bool,
  loading: PropTypes.bool,
};