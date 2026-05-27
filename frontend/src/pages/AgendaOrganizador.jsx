// ✅ frontend/src/pages/Agendaorganizador.jsx — v2.0
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
  X,
} from "lucide-react";

import { motion, useReducedMotion } from "framer-motion";

import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";
import LegendaEventos from "../components/eventos/LegendaEventos";
import { notifyError, notifyInfo } from "../components/ui/AppToast";
import { api } from "../services/api";

/* ─────────────────────────────────────────────
 * Constantes
 * ───────────────────────────────────────────── */

const STORAGE_VIEW_DATE_KEY = "agendaorganizador:viewDate";

const STATUS_AGENDA = {
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

function obterNomeUsuarioLocal() {
  try {
    const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
    return usuario?.nome || "";
  } catch {
    return "";
  }
}

/* ─────────────────────────────────────────────
 * Componentes locais
 * ───────────────────────────────────────────── */

function MiniStat({ titulo, valor, descricao, status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.programado;

  return (
    <motion.div
      className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm ring-1 ring-slate-200 dark:ring-zinc-700 p-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      role="group"
      aria-label={`${titulo}: ${valor}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${config.chip}`}
        >
          <span className={`h-2 w-2 rounded-full ${config.dot}`} />
          {titulo}
        </span>

        <CalendarDays
          className="w-5 h-5 text-slate-500 dark:text-zinc-400"
          aria-hidden="true"
        />
      </div>

      <p className="mt-3 text-3xl font-extrabold text-slate-950 dark:text-white">
        {valor}
      </p>

      {descricao ? (
        <p className="mt-1 text-xs text-slate-600 dark:text-zinc-300">
          {descricao}
        </p>
      ) : null}
    </motion.div>
  );
}

function DiaBadge({ evento, onActivate }) {
  const status = deriveStatus(evento);
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.programado;
  const titulo = String(evento?.titulo || "Evento").slice(0, 30);
  const horarioInicio = hh(evento?.horario_inicio, "00:00");
  const horarioFim = hh(evento?.horario_fim, "23:59");
  const mostrarHorario = horarioInicio !== "00:00" || horarioFim !== "23:59";

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate?.();
    }
  };

  return (
    <button
      type="button"
      onClick={onActivate}
      onKeyDown={handleKeyDown}
      title={evento?.titulo}
      aria-label={`${titulo}${
        mostrarHorario ? `, ${horarioInicio} até ${horarioFim}` : ""
      }`}
      className={`max-w-full truncate inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 focus:outline-none focus:ring-2 focus:ring-cyan-700 ${config.chip}`}
    >
      <span className="truncate">{titulo}</span>
      {mostrarHorario ? (
        <span className="opacity-80">
          • {horarioInicio}–{horarioFim}
        </span>
      ) : null}
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
      aria-labelledby="agenda-organizador-modal-titulo"
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
              id="agenda-organizador-modal-titulo"
              className="mt-3 text-lg sm:text-xl font-extrabold text-slate-950 dark:text-white break-words"
            >
              {evento.titulo || "Evento"}
            </h2>
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-zinc-300 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700"
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
                    className="rounded-full bg-cyan-50 text-cyan-900 ring-1 ring-cyan-100 px-3 py-1 text-xs font-semibold"
                  >
                    {organizador?.nome || "organizador"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                Nenhum organizador adicional informado.
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
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

const calendarPremiumStyles = `
.agenda-calendar-premium .react-calendar {
  width: 100%;
  border: 0;
  background: transparent;
  font-family: inherit;
}

.agenda-calendar-premium .react-calendar__navigation {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.agenda-calendar-premium .react-calendar__navigation button {
  min-height: 52px;
  border-radius: 1rem;
  border: 0;
  font-weight: 800;
  background: #f8fafc;
  color: #0f172a;
  transition: all 0.2s ease;
}

.dark .agenda-calendar-premium .react-calendar__navigation button {
  background: #18181b;
  color: white;
}

.agenda-calendar-premium .react-calendar__navigation button:hover {
  transform: translateY(-1px);
}

.agenda-calendar-premium .react-calendar__month-view__weekdays {
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  font-size: 0.72rem;
  font-weight: 800;
  color: #64748b;
}

.agenda-calendar-premium .react-calendar__tile {
  position: relative;
  aspect-ratio: 1;
  border-radius: 1.25rem;
  border: 0;
  background: transparent;
  transition: all 0.2s ease;
  padding-top: 0.75rem;
}

.agenda-calendar-premium .react-calendar__tile:hover {
  background: #f1f5f9;
}

.dark .agenda-calendar-premium .react-calendar__tile:hover {
  background: #18181b;
}

.agenda-calendar-premium .react-calendar__tile--now {
  background: rgba(6,182,212,0.12) !important;
  color: #0891b2;
  font-weight: 900;
}

.agenda-calendar-premium .react-calendar__tile--active {
  background: linear-gradient(
    135deg,
    #0891b2,
    #06b6d4
  ) !important;

  color: white !important;
  font-weight: 900;
  box-shadow:
    0 12px 24px rgba(6,182,212,0.25);
}
`;

/* ─────────────────────────────────────────────
 * Página
 * ───────────────────────────────────────────── */

export default function Agendaorganizador() {
  const reduceMotion = useReducedMotion();
  const liveRef = useRef(null);

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

  useEffect(() => {
    localStorage.setItem(STORAGE_VIEW_DATE_KEY, viewDate.toISOString());
  }, [viewDate]);

  function setLive(message) {
    if (liveRef.current) {
      liveRef.current.textContent = message;
    }
  }

  const carregarAgenda = useCallback(async () => {
    setCarregando(true);
    setErro("");
    setLive("Carregando agenda do organizador.");

    try {
      if (typeof api?.organizador?.minhasTurmas !== "function") {
  throw new Error(
    "Facade api.organizador.minhasTurmas não encontrada em frontend/src/services/api.js."
  );
}

const response = await api.organizador.minhasTurmas();
      const agendaNormalizada = normalizarAgendaResponse(response);

      setEventos(agendaNormalizada);

      setLive(
        agendaNormalizada.length
          ? `Agenda carregada com ${agendaNormalizada.length} item(ns).`
          : "Nenhum evento localizado na agenda do organizador."
      );
    } catch (error) {
      console.error("[Agendaorganizador] erro ao carregar agenda:", error);

      setEventos([]);
      setErro("Não foi possível carregar sua agenda de organizador.");

      notifyError(
        "Não foi possível carregar sua agenda. Tente novamente ou acione o suporte se o problema continuar."
      );

      setLive("Falha ao carregar agenda do organizador.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarAgenda();
  }, [carregarAgenda]);

  const eventosPorData = useMemo(() => {
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

  const stats = useMemo(() => {
    return eventos.reduce(
      (acc, evento) => {
        const status = deriveStatus(evento);

        if (status === STATUS_AGENDA.PROGRAMADO) acc.programados += 1;
        else if (status === STATUS_AGENDA.ANDAMENTO) acc.andamento += 1;
        else acc.encerrados += 1;

        return acc;
      },
      {
        programados: 0,
        andamento: 0,
        encerrados: 0,
      }
    );
  }, [eventos]);

  const diaSelecionadoYMD = useMemo(() => {
    return ymd(viewDate) || ymd(new Date());
  }, [viewDate]);

  const eventosDoDia = eventosPorData[diaSelecionadoYMD] || [];

  const irParaHoje = useCallback(() => {
    setViewDate(new Date());
  }, []);

  const exportarMesCSV = useCallback(() => {
    const separator = ";";
    const bom = "\uFEFF";
    const inicio = startOfMonth(viewDate);
    const fim = endOfMonth(viewDate);

    const safe = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

    const header = [
      "ID",
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
    link.download = `agenda_organizador_${format(viewDate, "yyyy-MM")}.csv`;
    link.click();

    setTimeout(() => URL.revokeObjectURL(link.href), 1200);
  }, [eventosPorData, viewDate]);

  return (
    <>
      <HeaderHero
  titulo="Agenda do organizador"
  subtitulo="Consulte seus encontros, aulas e eventos vinculados ao seu perfil de organizador."
  icon={CalendarDays}
/>

      {carregando ? (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-cyan-100 z-40"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando agenda"
        >
          <div
            className={`h-full bg-cyan-700 w-1/3 ${
              reduceMotion ? "" : "animate-pulse"
            }`}
          />
        </div>
      ) : null}

      <main
        id="conteudo"
        className="min-h-screen bg-slate-50 dark:bg-zinc-950 px-3 sm:px-4 py-6 text-slate-950 dark:text-white"
      >
          <style>{calendarPremiumStyles}</style>
        <p ref={liveRef} className="sr-only" aria-live="polite" />
        <section className="max-w-6xl mx-auto mb-5">
  <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
    <button
      type="button"
      onClick={irParaHoje}
      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-slate-700 dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
    >
      Hoje
    </button>

    <button
      type="button"
      onClick={carregarAgenda}
      disabled={carregando}
      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
    >
      <RefreshCw
        className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`}
      />

      {carregando ? "Atualizando..." : "Atualizar agenda"}
    </button>
  </div>
</section>

        <section
          className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5"
          aria-label="Resumo da agenda do organizador"
        >
          <MiniStat
            titulo="Programados"
            valor={stats.programados}
            descricao="Eventos futuros"
            status="programado"
          />

          <MiniStat
            titulo="Em andamento"
            valor={stats.andamento}
            descricao="Eventos em execução"
            status="andamento"
          />

          <MiniStat
            titulo="Encerrados"
            valor={stats.encerrados}
            descricao="Eventos já finalizados"
            status="encerrado"
          />
        </section>

        <section className="mx-auto w-full max-w-7xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div className="text-sm text-slate-700 dark:text-zinc-300">
              Mês visível:{" "}
              <strong className="text-slate-950 dark:text-white">
                {formatarMesAno(viewDate)}
              </strong>
            </div>

            <button
              type="button"
              onClick={exportarMesCSV}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700"
              title="Exportar eventos do mês visível em CSV"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              Exportar mês
            </button>
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.85fr] gap-5">
  <div className="overflow-hidden rounded-[2rem] bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-slate-200 dark:ring-zinc-800">

    <div className="border-b border-slate-200 dark:border-zinc-800 px-5 sm:px-6 py-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
            Agenda mensal
          </p>

          <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
            {formatarMesAno(viewDate)}
          </h2>

          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Visualize encontros, aulas e atividades vinculadas ao seu perfil.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">

          <div className="min-w-[130px] rounded-2xl bg-slate-50 dark:bg-zinc-800 px-4 py-3 ring-1 ring-slate-200 dark:ring-zinc-700">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Eventos
            </p>

            <p className="mt-1 text-3xl font-black text-slate-950 dark:text-white">
              {eventos.length}
            </p>
          </div>

          <button
            type="button"
            onClick={exportarMesCSV}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 dark:bg-cyan-700 px-5 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>
    </div>

    <div className="agenda-calendar-premium p-4 sm:p-6">
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
        className="react-calendar !w-full !border-0 !bg-transparent"
        prevLabel="‹"
        nextLabel="›"
        prev2Label="«"
        next2Label="»"
        aria-label="Calendário da agenda do organizador"
        navigationLabel={({ date }) => formatarMesAno(date)}
        tileContent={({ date }) => {
          const key = ymd(date);
          const lista = eventosPorData[key] || [];

          if (!lista.length) return null;

          const visible = lista.slice(0, 3);

          return (
            <div className="mt-2 flex items-center justify-center gap-1">
              {visible.map((evento, index) => {
                const status = deriveStatus(evento);
                const config =
                  STATUS_CONFIG[status] || STATUS_CONFIG.programado;

                return (
                  <button
                    key={`${evento.id}-${index}`}
                    type="button"
                    onClick={() => setSelecionado(evento)}
                    className={`h-2.5 w-2.5 rounded-full ${config.dot} hover:scale-125 transition-transform`}
                    title={evento.titulo}
                  />
                );
              })}

              {lista.length > 3 ? (
                <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                  +{lista.length - 3}
                </span>
              ) : null}
            </div>
          );
        }}
      />
    </div>
  </div>

  <aside className="rounded-[2rem] bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-slate-200 dark:ring-zinc-800 overflow-hidden">

    <div className="border-b border-slate-200 dark:border-zinc-800 px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
        Agenda diária
      </p>

      <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
        {formatarDataBR(diaSelecionadoYMD)}
      </h3>
    </div>

    <div className="p-4 space-y-3 max-h-[760px] overflow-y-auto">
      {!eventosDoDia.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 p-6 text-center text-sm text-slate-500 dark:text-zinc-400">
          Nenhum evento neste dia.
        </div>
      ) : (
        eventosDoDia.map((evento) => {
          const status = deriveStatus(evento);
          const config =
            STATUS_CONFIG[status] || STATUS_CONFIG.programado;

          return (
            <button
              key={evento.id}
              type="button"
              onClick={() => setSelecionado(evento)}
              className={`w-full text-left rounded-2xl p-4 ring-1 transition-all hover:-translate-y-0.5 ${config.card}`}
            >
              <div className="flex items-start justify-between gap-3">

                <div>
                  <p className="font-black text-sm">
                    {evento.titulo}
                  </p>

                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    {hh(evento.horario_inicio)} às{" "}
                    {hh(evento.horario_fim)}
                  </div>

                  {evento.local ? (
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <MapPin className="w-3.5 h-3.5" />
                      {evento.local}
                    </div>
                  ) : null}
                </div>

                <span
                  className={`h-3 w-3 rounded-full ${config.dot}`}
                />
              </div>
            </button>
          );
        })
      )}
    </div>
  </aside>
</section>
          </section>

        <div className="mt-6 flex justify-center">
          <LegendaEventos />
        </div>
      </main>

      {selecionado ? (
        <EventoDetalheModalLocal
          evento={selecionado}
          onClose={() => setSelecionado(null)}
        />
      ) : null}

      <Footer />
    </>
  );
}