// ✅ frontend/src/pages/AgendaAdministrador.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

import {
  compareAsc,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isWithinInterval,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  CalendarDays,
  Clock,
  Download,
  MapPin,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { useReducedMotion } from "framer-motion";

import Footer from "../components/layout/Footer";
import LegendaEventos from "../components/eventos/LegendaEventos";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import { notifyError, notifyInfo } from "../components/ui/AppToast";
import { api } from "../services/api";

/* ─────────────────────────────────────────────
 * Constantes
 * ───────────────────────────────────────────── */

const STORAGE_VIEW_DATE_KEY = "agendaAdministrador:viewDate";
const STORAGE_BUSCA_KEY = "agendaAdministrador:busca";
const STORAGE_STATUS_KEY = "agendaAdministrador:status";

const STATUS_AGENDA = {
  TODOS: "todos",
  PROGRAMADO: "programado",
  ANDAMENTO: "andamento",
  ENCERRADO: "encerrado",
};

const STATUS_CONFIG = {
  programado: {
    label: "Programado",
    chip: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    card: "bg-emerald-50 text-emerald-950 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  andamento: {
    label: "Em andamento",
    chip: "bg-amber-50 text-amber-800 ring-amber-200",
    card: "bg-amber-50 text-amber-950 ring-amber-200",
    dot: "bg-amber-500",
  },
  encerrado: {
    label: "Encerrado",
    chip: "bg-rose-50 text-rose-800 ring-rose-200",
    card: "bg-rose-50 text-rose-950 ring-rose-200",
    dot: "bg-rose-500",
  },
};

/* ─────────────────────────────────────────────
 * Helpers date-only
 * ───────────────────────────────────────────── */

function stripTZ(value) {
  return String(value || "")
    .trim()
    .replace(/\.\d{3,}\s*Z?$/i, "")
    .replace(/([+-]\d{2}:\d{2}|Z)$/i, "");
}

function hh(value, fallback = "00:00") {
  if (typeof value === "string" && /^\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 5);
  }

  return fallback;
}

function toLocalDate(input) {
  if (!input) return null;

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  const value = stripTZ(input);
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (!match) return null;

  const [, year, month, day, hour = "00", minute = "00", second = "00"] =
    match;

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function ymd(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const head = stripTZ(value).slice(0, 10);

    if (/^\d{4}-\d{2}-\d{2}$/.test(head)) {
      return head;
    }
  }

  const date = toLocalDate(value);

  if (!date) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function rangeDiasYMD(dataInicio, dataFim) {
  const dias = [];

  if (!dataInicio) return dias;

  const inicio = toLocalDate(`${dataInicio}T12:00:00`);
  const fim = toLocalDate(`${dataFim || dataInicio}T12:00:00`);

  if (!inicio || !fim || inicio > fim) return dias;

  for (
    const cursor = new Date(inicio);
    cursor <= fim;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const dia = ymd(cursor);
    if (dia) dias.push(dia);
  }

  return dias;
}

function formatarDataBR(value) {
  const data = ymd(value);
  if (!data) return "—";

  const date = toLocalDate(`${data}T12:00:00`);
  if (!date) return "—";

  return format(date, "dd/MM/yyyy");
}

function formatarMesAno(value) {
  const date = value instanceof Date ? value : new Date();

  return format(date, "MMMM 'de' yyyy", { locale: ptBR }).replace(
    /^\w/,
    (char) => char.toUpperCase()
  );
}

/* ─────────────────────────────────────────────
 * Helpers de usuário/localStorage
 * ───────────────────────────────────────────── */

function obterNomeUsuarioLocal() {
  try {
    const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
    return usuario?.nome || "";
  } catch {
    return "";
  }
}

/* ─────────────────────────────────────────────
 * Helpers de agenda
 * ───────────────────────────────────────────── */

function deriveStatus(evento) {
  const statusBackend = String(evento?.status || "").trim().toLowerCase();

  if (
    statusBackend === STATUS_AGENDA.PROGRAMADO ||
    statusBackend === STATUS_AGENDA.ANDAMENTO ||
    statusBackend === STATUS_AGENDA.ENCERRADO
  ) {
    return statusBackend;
  }

  const dataInicio = ymd(evento?.data_inicio);
  const dataFim = ymd(evento?.data_fim || evento?.data_inicio);
  const horarioInicio = hh(evento?.horario_inicio, "00:00");
  const horarioFim = hh(evento?.horario_fim, "23:59");

  const inicio = dataInicio
    ? toLocalDate(`${dataInicio}T${horarioInicio}`)
    : null;

  const fim = dataFim ? toLocalDate(`${dataFim}T${horarioFim}`) : null;

  const agora = new Date();

  if (inicio && fim) {
    if (isBefore(agora, inicio)) return STATUS_AGENDA.PROGRAMADO;
    if (isWithinInterval(agora, { start: inicio, end: fim })) {
      return STATUS_AGENDA.ANDAMENTO;
    }
    if (isAfter(agora, fim)) return STATUS_AGENDA.ENCERRADO;
  }

  return STATUS_AGENDA.PROGRAMADO;
}

function normalizarAgendaResponse(response) {
  const lista = Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
      ? response
      : [];

  return lista.map((evento) => {
    const ocorrencias = Array.isArray(evento?.ocorrencias)
      ? evento.ocorrencias
          .map((item) => {
            const data = ymd(item?.data || item);

            if (!data) return null;

            return {
              data,
              horario_inicio: hh(
                item?.horario_inicio,
                hh(evento?.horario_inicio, "00:00")
              ),
              horario_fim: hh(
                item?.horario_fim,
                hh(evento?.horario_fim, "23:59")
              ),
            };
          })
          .filter(Boolean)
      : [];

    return {
      id: evento?.id,
      titulo: evento?.titulo || "Evento",
      local: evento?.local || null,
      data_inicio: ymd(evento?.data_inicio),
      data_fim: ymd(evento?.data_fim || evento?.data_inicio),
      horario_inicio: hh(evento?.horario_inicio, "00:00"),
      horario_fim: hh(evento?.horario_fim, "23:59"),
      status: deriveStatus(evento),
      organizadores: Array.isArray(evento?.organizadores)
        ? evento.organizadores
        : [],
      ocorrencias,
      _raw: evento,
    };
  });
}

function obterDiasDoEvento(evento) {
  if (Array.isArray(evento?.ocorrencias) && evento.ocorrencias.length > 0) {
    return evento.ocorrencias
      .map((item) => ymd(item?.data || item))
      .filter(Boolean);
  }

  return rangeDiasYMD(ymd(evento?.data_inicio), ymd(evento?.data_fim));
}

/* ─────────────────────────────────────────────
 * Componentes locais
 * ───────────────────────────────────────────── */

function HeaderHero({ nome, carregando, onRefresh, onHoje }) {
  return (
    <header
      className="bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-800 text-white"
      role="banner"
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-7 w-7" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Agenda Geral de Eventos
          </h1>
        </div>

        <p className="text-sm sm:text-base text-white/90 max-w-2xl">
          {nome ? `Bem-vindo(a), ${nome}. ` : ""}
          Visualize, filtre e consulte os eventos por dia no calendário geral.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onHoje}
            className="inline-flex justify-center items-center gap-2 px-4 py-2 text-sm rounded-lg bg-white/15 hover:bg-white/25 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 w-full sm:w-auto"
            aria-label="Ir para a data de hoje no calendário"
          >
            Hoje
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={carregando}
            className="inline-flex justify-center items-center gap-2 px-4 py-2 text-sm rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-60 disabled:cursor-not-allowed text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 w-full sm:w-auto"
            aria-label="Atualizar agenda"
          >
            <RefreshCw
              className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {carregando ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>
    </header>
  );
}

function StatusChip({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.programado;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${config.chip}`}
    >
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function TotalBadge({ label, value, status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.programado;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ring-1 ${config.chip} text-xs font-bold`}
      title={`${value} ${label}`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      <span className="uppercase tracking-wide">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function DiaBadge({ evento, onClick }) {
  const status = deriveStatus(evento);
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.programado;
  const titulo = String(evento?.titulo || "Evento");

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.(evento);
    }
  };

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(evento);
      }}
      onKeyDown={handleKeyDown}
      className={`inline-flex items-center justify-center w-full px-2 py-1 rounded-md text-[10px] font-semibold ring-1 truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 ${config.chip}`}
      title={titulo}
      aria-label={titulo}
    >
      <span className="truncate">{titulo}</span>
    </button>
  );
}

function EventoDetalheModalLocal({ evento, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!evento) return null;

  const status = deriveStatus(evento);
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.programado;
  const organizadores = Array.isArray(evento?.organizadores)
    ? evento.organizadores
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-3 py-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agenda-admin-modal-titulo"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-zinc-700 px-5 py-4">
          <div className="min-w-0">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${config.chip}`}
            >
              <span className={`h-2 w-2 rounded-full ${config.dot}`} />
              {config.label}
            </span>

            <h2
              id="agenda-admin-modal-titulo"
              className="mt-3 text-lg sm:text-xl font-extrabold text-slate-950 dark:text-white break-words"
            >
              {evento.titulo || "Evento"}
            </h2>
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-zinc-300 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
            aria-label="Fechar detalhes do evento"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 dark:bg-zinc-800 p-3 ring-1 ring-slate-200 dark:ring-zinc-700">
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Data inicial
              </p>
              <p className="mt-1 text-sm font-bold text-slate-950 dark:text-white">
                {formatarDataBR(evento.data_inicio)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-zinc-800 p-3 ring-1 ring-slate-200 dark:ring-zinc-700">
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Data final
              </p>
              <p className="mt-1 text-sm font-bold text-slate-950 dark:text-white">
                {formatarDataBR(evento.data_fim)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-zinc-800 p-3 ring-1 ring-slate-200 dark:ring-zinc-700">
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Horário
              </p>
              <p className="mt-1 text-sm font-bold text-slate-950 dark:text-white">
                {hh(evento.horario_inicio, "00:00")} às{" "}
                {hh(evento.horario_fim, "23:59")}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-zinc-800 p-3 ring-1 ring-slate-200 dark:ring-zinc-700">
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Local
              </p>
              <p className="mt-1 text-sm font-bold text-slate-950 dark:text-white break-words">
                {evento.local || "Não informado"}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              organizadores vinculados
            </p>

            {organizadores.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {organizadores.map((organizador) => (
                  <li
                    key={organizador?.id || organizador?.nome}
                    className="rounded-full bg-indigo-50 text-indigo-900 ring-1 ring-indigo-100 px-3 py-1 text-xs font-semibold"
                  >
                    {organizador?.nome || "organizador"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                Nenhum organizador informado.
              </p>
            )}
          </div>

          {Array.isArray(evento.ocorrencias) && evento.ocorrencias.length ? (
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Datas de ocorrência
              </p>

              <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {evento.ocorrencias.map((ocorrencia) => (
                  <li
                    key={`${ocorrencia.data}-${ocorrencia.horario_inicio}`}
                    className="rounded-lg bg-slate-50 dark:bg-zinc-800 px-3 py-2 text-sm text-slate-800 dark:text-zinc-100 ring-1 ring-slate-200 dark:ring-zinc-700"
                  >
                    {formatarDataBR(ocorrencia.data)} •{" "}
                    {hh(ocorrencia.horario_inicio, evento.horario_inicio)} às{" "}
                    {hh(ocorrencia.horario_fim, evento.horario_fim)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-slate-200 dark:border-zinc-700 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * Página
 * ───────────────────────────────────────────── */

export default function AgendaAdministrador() {
  const reduceMotion = useReducedMotion();
  const liveRef = useRef(null);
  const erroRef = useRef(null);
  const mountedRef = useRef(true);

  const [nome] = useState(() => obterNomeUsuarioLocal());
  const [eventos, setEventos] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [viewDate, setViewDate] = useState(() => {
    const saved = localStorage.getItem(STORAGE_VIEW_DATE_KEY);
    const parsed = saved ? toLocalDate(saved) : null;
    return parsed || new Date();
  });

  const [busca, setBusca] = useState(
    () => localStorage.getItem(STORAGE_BUSCA_KEY) || ""
  );

  const [buscaDebounced, setBuscaDebounced] = useState(busca.trim().toLowerCase());

  const [filtroStatus, setFiltroStatus] = useState(
    () => localStorage.getItem(STORAGE_STATUS_KEY) || STATUS_AGENDA.TODOS
  );

  const setLive = useCallback((message) => {
    if (liveRef.current) {
      liveRef.current.textContent = message;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_VIEW_DATE_KEY, viewDate.toISOString());
  }, [viewDate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_STATUS_KEY, filtroStatus);
  }, [filtroStatus]);

  useEffect(() => {
    localStorage.setItem(STORAGE_BUSCA_KEY, busca);

    const timer = setTimeout(() => {
      setBuscaDebounced(busca.trim().toLowerCase());
    }, 250);

    return () => clearTimeout(timer);
  }, [busca]);

  const carregarAgenda = useCallback(async () => {
    setCarregando(true);
    setErro("");
    setLive("Carregando agenda geral de eventos.");

    try {
      if (typeof api?.agenda?.listar !== "function") {
        throw new Error(
          "Facade api.agenda.listar não encontrada em frontend/src/services/api.js."
        );
      }

      const response = await api.agenda.listar();
      const agendaNormalizada = normalizarAgendaResponse(response);

      if (!mountedRef.current) return;

      setEventos(agendaNormalizada);

      setLive(
        agendaNormalizada.length
          ? `Agenda carregada com ${agendaNormalizada.length} evento(s).`
          : "Nenhum evento encontrado na agenda geral."
      );
    } catch (error) {
      console.error("[AgendaAdministrador] erro ao carregar agenda:", error);

      if (!mountedRef.current) return;

      setEventos([]);
      setErro("Não foi possível carregar a agenda geral de eventos.");

      notifyError(
        "Não foi possível carregar a agenda. Tente novamente ou acione o suporte se o problema continuar."
      );

      setLive("Falha ao carregar agenda geral de eventos.");

      setTimeout(() => erroRef.current?.focus(), 0);
    } finally {
      if (mountedRef.current) {
        setCarregando(false);
      }
    }
  }, [setLive]);

  useEffect(() => {
    carregarAgenda();
  }, [carregarAgenda]);

  const eventosBasePorData = useMemo(() => {
    const map = {};

    for (const evento of eventos) {
      const dias = obterDiasDoEvento(evento);

      for (const dia of dias) {
        if (!map[dia]) map[dia] = [];
        map[dia].push(evento);
      }
    }

    for (const dia of Object.keys(map)) {
      map[dia].sort((a, b) => {
        const aStart = toLocalDate(
          `${ymd(a.data_inicio || dia)}T${hh(a.horario_inicio, "00:00")}`
        );
        const bStart = toLocalDate(
          `${ymd(b.data_inicio || dia)}T${hh(b.horario_inicio, "00:00")}`
        );

        if (!aStart || !bStart) return 0;

        return compareAsc(aStart, bStart);
      });
    }

    return map;
  }, [eventos]);

  const eventosPorData = useMemo(() => {
    const filtra = (evento) => {
      const titulo = String(evento?.titulo || "").toLowerCase();

      if (buscaDebounced && !titulo.includes(buscaDebounced)) {
        return false;
      }

      if (
        filtroStatus !== STATUS_AGENDA.TODOS &&
        deriveStatus(evento) !== filtroStatus
      ) {
        return false;
      }

      return true;
    };

    const out = {};

    for (const [dia, lista] of Object.entries(eventosBasePorData)) {
      const filtrados = lista.filter(filtra);

      if (filtrados.length) {
        out[dia] = filtrados;
      }
    }

    return out;
  }, [eventosBasePorData, buscaDebounced, filtroStatus]);

  const totaisMes = useMemo(() => {
    const inicio = startOfMonth(viewDate);
    const fim = endOfMonth(viewDate);

    const totais = {
      total: 0,
      programado: 0,
      andamento: 0,
      encerrado: 0,
    };

    for (const [dia, lista] of Object.entries(eventosPorData)) {
      const dataDia = toLocalDate(`${dia}T12:00:00`);

      if (!dataDia || dataDia < inicio || dataDia > fim) continue;

      for (const evento of lista) {
        const status = deriveStatus(evento);

        totais.total += 1;

        if (status === STATUS_AGENDA.PROGRAMADO) totais.programado += 1;
        else if (status === STATUS_AGENDA.ANDAMENTO) totais.andamento += 1;
        else totais.encerrado += 1;
      }
    }

    return totais;
  }, [eventosPorData, viewDate]);

  const diaSelecionadoYMD = useMemo(() => {
    return ymd(viewDate) || ymd(new Date());
  }, [viewDate]);

  const eventosDoDia = eventosPorData[diaSelecionadoYMD] || [];

  const irParaHoje = useCallback(() => {
    setViewDate(new Date());
  }, []);

  const limparFiltros = useCallback(() => {
    setBusca("");
    setFiltroStatus(STATUS_AGENDA.TODOS);
  }, []);

  const renderTileContent = useCallback(
    ({ date }) => {
      const key = ymd(date);
      const diaEventos = eventosPorData[key] || [];

      if (!diaEventos.length) return null;

      const max = 3;
      const visiveis = diaEventos.slice(0, max);
      const extras = Math.max(0, diaEventos.length - max);

      return (
        <div className="mt-1 w-full px-1 space-y-1 min-w-0">
          {visiveis.map((evento, index) => (
            <DiaBadge
              key={`${String(evento.id || evento.titulo)}-${key}-${index}`}
              evento={evento}
              onClick={setSelecionado}
            />
          ))}

          {extras > 0 ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setSelecionado(diaEventos[0]);
              }}
              className="w-full text-[11px] text-indigo-900 bg-indigo-50 ring-1 ring-indigo-200 rounded-md px-2 py-0.5 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 text-center"
              title={`Mais ${extras} evento(s)`}
              aria-label={`Mais ${extras} evento(s) neste dia`}
            >
              +{extras} evento(s)
            </button>
          ) : null}
        </div>
      );
    },
    [eventosPorData]
  );

  const exportarMesCSV = useCallback(() => {
    const inicio = startOfMonth(viewDate);
    const fim = endOfMonth(viewDate);
    const separator = ";";
    const bom = "\uFEFF";
    const safe = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

    const header = [
      "Evento ID",
      "Título",
      "Status",
      "Data início",
      "Hora início",
      "Data fim",
      "Hora fim",
      "Local",
    ].join(separator);

    const rows = [];

    for (const [dia, lista] of Object.entries(eventosPorData)) {
      const dataDia = toLocalDate(`${dia}T12:00:00`);

      if (!dataDia || dataDia < inicio || dataDia > fim) continue;

      for (const evento of lista) {
        const status = deriveStatus(evento);
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.programado;

        rows.push(
          [
            safe(evento.id || ""),
            safe(evento.titulo || ""),
            safe(config.label),
            safe(formatarDataBR(evento.data_inicio)),
            safe(hh(evento.horario_inicio, "00:00")),
            safe(formatarDataBR(evento.data_fim)),
            safe(hh(evento.horario_fim, "23:59")),
            safe(evento.local || ""),
          ].join(separator)
        );
      }
    }

    if (!rows.length) {
      notifyInfo("Não há eventos no mês visível para exportar.");
      return;
    }

    const csv = [header, ...rows].join("\n");
    const blob = new Blob([bom + csv], {
      type: "text/csv;charset=utf-8",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `agenda_${format(viewDate, "yyyy-MM")}.csv`;
    link.click();

    setTimeout(() => URL.revokeObjectURL(link.href), 1200);
  }, [eventosPorData, viewDate]);

  const possuiFiltros = Boolean(busca || filtroStatus !== STATUS_AGENDA.TODOS);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-950 dark:text-white overflow-x-hidden">
      <HeaderHero
        nome={nome}
        carregando={carregando}
        onRefresh={carregarAgenda}
        onHoje={irParaHoje}
      />

      {carregando ? (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-indigo-100 z-40"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando agenda"
        >
          <div
            className={`h-full bg-indigo-700 w-1/3 ${
              reduceMotion ? "" : "animate-pulse"
            }`}
          />
        </div>
      ) : null}

      <main
        id="conteudo"
        className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-4 py-5 sm:py-6 min-w-0"
      >
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-3 sm:p-5 shadow-sm ring-1 ring-slate-200 dark:ring-zinc-700">
          {erro ? (
            <div
              ref={erroRef}
              tabIndex={-1}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              role="alert"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p>{erro}</p>

                <button
                  type="button"
                  onClick={carregarAgenda}
                  className="px-3 py-2 rounded-lg text-sm font-semibold bg-rose-100 hover:bg-rose-200 text-rose-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 mb-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1 min-w-0">
                    <label htmlFor="busca-evento" className="sr-only">
                      Buscar evento pelo título
                    </label>

                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                      aria-hidden="true"
                    />

                    <input
                      id="busca-evento"
                      type="search"
                      inputMode="search"
                      placeholder="Buscar evento pelo título..."
                      value={busca}
                      onChange={(event) => setBusca(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-indigo-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                      aria-describedby="dica-busca"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:w-auto">
                    <div>
                      <label
                        htmlFor="filtro-status"
                        className="sr-only"
                      >
                        Filtrar por status
                      </label>

                      <select
                        id="filtro-status"
                        value={filtroStatus}
                        onChange={(event) =>
                          setFiltroStatus(event.target.value)
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-indigo-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                      >
                        <option value="todos">Todos os status</option>
                        <option value="programado">Programados</option>
                        <option value="andamento">Em andamento</option>
                        <option value="encerrado">Encerrados</option>
                      </select>
                    </div>

                    {possuiFiltros ? (
                      <button
                        type="button"
                        onClick={limparFiltros}
                        className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
                      >
                        Limpar filtros
                      </button>
                    ) : null}
                  </div>
                </div>

                <p
                  id="dica-busca"
                  className="text-xs text-slate-600 dark:text-zinc-300"
                >
                  Use a busca e o filtro de status para localizar rapidamente
                  eventos no calendário.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div className="text-sm text-slate-700 dark:text-zinc-300">
                  Mês visível:{" "}
                  <strong className="text-slate-950 dark:text-white">
                    {formatarMesAno(viewDate)}
                  </strong>{" "}
                  •{" "}
                  <span aria-live="polite">
                    {totaisMes.total} evento(s)
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <TotalBadge
                    label="Programados"
                    value={totaisMes.programado}
                    status="programado"
                  />

                  <TotalBadge
                    label="Em andamento"
                    value={totaisMes.andamento}
                    status="andamento"
                  />

                  <TotalBadge
                    label="Encerrados"
                    value={totaisMes.encerrado}
                    status="encerrado"
                  />

                  <button
                    type="button"
                    onClick={exportarMesCSV}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
                    title="Exportar eventos do mês visível em CSV"
                  >
                    <Download className="w-4 h-4" aria-hidden="true" />
                    Exportar mês
                  </button>
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden ring-1 ring-indigo-100 dark:ring-zinc-700 bg-white dark:bg-zinc-900">
                {carregando ? (
                  <div className="p-4 space-y-3">
                    <CarregandoSkeleton height={28} />
                    <CarregandoSkeleton height={240} />
                  </div>
                ) : (
                  <Calendar
                    value={viewDate}
                    onActiveStartDateChange={({ activeStartDate }) => {
                      setViewDate(activeStartDate || new Date());
                    }}
                    onViewChange={({ activeStartDate }) => {
                      setViewDate(activeStartDate || new Date());
                    }}
                    onClickMonth={(date) => setViewDate(date)}
                    onClickDay={(date) => setViewDate(date)}
                    locale="pt-BR"
                    className="react-calendar react-calendar-custom !bg-transparent"
                    prevLabel="‹"
                    nextLabel="›"
                    aria-label="Calendário geral de eventos"
                    tileClassName="!rounded-lg hover:!bg-slate-100 dark:hover:!bg-zinc-800 focus:!ring-2 focus:!ring-indigo-700"
                    navigationLabel={({ date }) => formatarMesAno(date)}
                    tileContent={renderTileContent}
                  />
                )}
              </div>

              <section className="mt-5" aria-labelledby="eventos-dia-titulo">
                <h2
                  id="eventos-dia-titulo"
                  className="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-2"
                >
                  Eventos em {formatarDataBR(diaSelecionadoYMD)}
                </h2>

                {!eventosDoDia.length ? (
                  <div className="rounded-xl bg-slate-50 dark:bg-zinc-800 p-4 text-sm text-slate-600 dark:text-zinc-300 ring-1 ring-slate-200 dark:ring-zinc-700">
                    Nenhum evento neste dia.
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {eventosDoDia.map((evento) => {
                      const status = deriveStatus(evento);
                      const config =
                        STATUS_CONFIG[status] || STATUS_CONFIG.programado;

                      return (
                        <li
                          key={
                            evento.id ||
                            `${evento.titulo}-${evento.data_inicio}-${evento.horario_inicio}`
                          }
                          className={`rounded-2xl ring-1 p-4 ${config.card}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-extrabold break-words">
                                {evento.titulo || "Evento"}
                              </p>

                              <div className="mt-2">
                                <StatusChip status={status} />
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 text-sm flex flex-col gap-2">
                            <div className="inline-flex items-center gap-2">
                              <Clock className="w-4 h-4" aria-hidden="true" />
                              <span>
                                {formatarDataBR(evento.data_inicio)} •{" "}
                                {hh(evento.horario_inicio, "00:00")}
                                {evento.data_fim &&
                                evento.data_fim !== evento.data_inicio
                                  ? ` — ${formatarDataBR(evento.data_fim)} • ${hh(
                                      evento.horario_fim,
                                      "23:59"
                                    )}`
                                  : ` às ${hh(evento.horario_fim, "23:59")}`}
                              </span>
                            </div>

                            {evento.local ? (
                              <div className="inline-flex items-center gap-2">
                                <MapPin
                                  className="w-4 h-4"
                                  aria-hidden="true"
                                />
                                <span className="break-words">
                                  {evento.local}
                                </span>
                              </div>
                            ) : null}
                          </div>

                          <div className="mt-4 flex justify-end">
                            <button
                              type="button"
                              onClick={() => setSelecionado(evento)}
                              className="px-3 py-2 rounded-lg bg-slate-950 text-white text-xs font-semibold hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
                              aria-label={`Ver detalhes do evento ${
                                evento.titulo || ""
                              }`}
                            >
                              Ver detalhes
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </section>

        <div className="mt-6 flex justify-center">
          <LegendaEventos />
        </div>

        {selecionado ? (
          <EventoDetalheModalLocal
            evento={selecionado}
            onClose={() => setSelecionado(null)}
          />
        ) : null}
      </main>

      <Footer />
    </div>
  );
}