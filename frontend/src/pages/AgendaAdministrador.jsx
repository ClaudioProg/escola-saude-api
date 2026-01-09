// ✅ src/pages/AgendaAdministrador.jsx — mobile-first, cores novas, a11y e perf
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import {
  format,
  isAfter,
  isBefore,
  isWithinInterval,
  compareAsc,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { CalendarDays, Download, MapPin, Clock } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import { useReducedMotion } from "framer-motion";

import Footer from "../components/Footer";
import EventoDetalheModal from "../components/EventoDetalheModal";
import LegendaEventos from "../components/LegendaEventos";
import { apiGet } from "../services/api";

/* ========= HeaderHero ========= */
function HeaderHero({ nome, carregando, onRefresh, onHoje }) {
  return (
    <header
      className="bg-gradient-to-br from-violet-950 via-purple-800 to-indigo-700 text-white"
      role="banner"
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 text-center flex flex-col items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
          <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight">
            Agenda Geral de Eventos
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-white/90 px-2">
          {nome ? `Bem-vindo(a), ${nome}.` : "Bem-vindo(a)."} Visualize e consulte os eventos por dia.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onHoje}
            className="inline-flex justify-center items-center gap-2 px-4 py-2 text-sm rounded-md transition bg-white/15 hover:bg-white/25 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 w-full sm:w-auto"
            aria-label="Ir para a data de hoje no calendário"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={carregando}
            className={`inline-flex justify-center items-center gap-2 px-4 py-2 text-sm rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 w-full sm:w-auto ${
              carregando ? "opacity-60 cursor-not-allowed bg-white/15" : "bg-white/15 hover:bg-white/25"
            } text-white`}
            aria-label="Atualizar agenda"
          >
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ========= Helpers de data ========= */
const stripTZ = (s) =>
  String(s).trim().replace(/\.\d{3,}\s*Z?$/i, "").replace(/([+-]\d{2}:\d{2}|Z)$/i, "");

function toLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  const s = stripTZ(input);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const [, y, mo, d, hh = "00", mm = "00", ss = "00"] = m;
  return new Date(+y, +mo - 1, +d, +hh, +mm, +ss);
}
function ymd(val) {
  if (!val) return null;
  if (typeof val === "string") {
    const head = stripTZ(val).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
  }
  const d = toLocalDate(val);
  if (!d || Number.isNaN(+d)) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function rangeDiasYMD(iniYMD, fimYMD) {
  const out = [];
  if (!iniYMD) return out;
  const d0 = new Date(`${iniYMD}T12:00:00`);
  const d1 = new Date(`${(fimYMD || iniYMD)}T12:00:00`);
  for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
    out.push(ymd(d));
  }
  return out;
}
function deriveStatus(ev) {
  const di = ev.data_inicio ?? ev.dataInicio ?? ev.data;
  const df = ev.data_fim ?? ev.data_termino ?? ev.dataTermino ?? ev.data;
  const hi = (ev.horario_inicio ?? "00:00").slice(0, 5);
  const hf = (ev.horario_fim ?? "23:59").slice(0, 5);
  const start = di ? toLocalDate(`${ymd(di)}T${hi}`) : null;
  const end = df ? toLocalDate(`${ymd(df)}T${hf}`) : null;
  const agora = new Date();
  if (start && end) {
    if (isBefore(agora, start)) return "programado";
    if (isWithinInterval(agora, { start, end })) return "andamento";
    if (isAfter(agora, end)) return "encerrado";
  }
  return ev.status || "programado";
}

/* ========= Cores (preferências do Cláudio) ========= */
const colorByStatus = {
  programado: { bg: "bg-emerald-100", text: "text-emerald-900", ring: "ring-emerald-300" }, // ✅ verde
  andamento:  { bg: "bg-amber-100",   text: "text-amber-900",   ring: "ring-amber-300" },   // ✅ amarelo
  encerrado:  { bg: "bg-rose-100",    text: "text-rose-900",    ring: "ring-rose-300" },    // ✅ vermelho
};
const colorByTipo = {
  curso:     { bg: "bg-violet-100", text: "text-violet-900", ring: "ring-violet-300" },
  oficina:   { bg: "bg-teal-100",   text: "text-teal-900",   ring: "ring-teal-300" },
  congresso: { bg: "bg-indigo-100", text: "text-indigo-900", ring: "ring-indigo-300" },
  webinar:   { bg: "bg-cyan-100",   text: "text-cyan-900",   ring: "ring-cyan-300" },
};
function getBadgeColors(ev) {
  const tipo = String(ev?.tipo || "").toLowerCase();
  if (tipo && colorByTipo[tipo]) return colorByTipo[tipo];
  const st = deriveStatus(ev);
  return colorByStatus[st] || colorByStatus.programado;
}

/* ========= Badge do dia (CLICA E ABRE MODAL) ========= */
function DiaBadge({ evento, onClick }) {
  const c = getBadgeColors(evento);
  const titulo = String(evento?.titulo ?? evento?.nome ?? "Evento");
  const di = ymd(evento?.data_inicio ?? evento?.dataInicio ?? evento?.data);
  const df = ymd(evento?.data_fim ?? evento?.data_termino ?? evento?.dataTermino ?? evento?.data);
  const label = di && df && di !== df
    ? `${format(new Date(di), "dd/MM")} – ${format(new Date(df), "dd/MM")}`
    : (di ? format(new Date(di), "dd/MM") : "");

  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.(evento);
    }
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); onClick?.(evento); }}
      onKeyDown={handleKey}
      className={`inline-flex items-center justify-center w-full px-2 py-1 rounded-md text-[10px] font-semibold ring-1 ${c.ring} ${c.bg} ${c.text} truncate cursor-pointer`}
      title={`${titulo}${label ? ` — ${label}` : ""}`}
      aria-label={`${titulo}${label ? ` — ${label}` : ""}`}
    >
      •
    </span>
  );
}

/* ========= Badge de total ========= */
function TotalBadge({ label, value, variant = "programado" }) {
  const c = colorByStatus[variant] || colorByStatus.programado;
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ring-1 ${c.ring} ${c.bg} ${c.text} text-xs font-semibold`}
      title={`${value} ${label}`}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "currentColor" }} />
      <span className="uppercase tracking-wide">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/* ========= Chip de tipo ========= */
function TipoChip({ tipo }) {
  const t = String(tipo || "").toLowerCase();
  const c = colorByTipo[t] || { bg: "bg-slate-100", text: "text-slate-900", ring: "ring-slate-300" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${c.ring} ${c.bg} ${c.text}`}>
      {t ? t.charAt(0).toUpperCase() + t.slice(1) : "Evento"}
    </span>
  );
}

/* ========================================================================= */

export default function AgendaAdministrador() {
  const nome = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("usuario") || "{}");
      return u?.nome || "";
    } catch {
      return localStorage.getItem("nome") || "";
    }
  })();

  const reduceMotion = useReducedMotion();

  const [events, setEvents] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [viewDate, setViewDate] = useState(() => {
    const saved = localStorage.getItem("agenda:viewDate");
    return saved ? new Date(saved) : new Date();
  });

  // filtros
  const [busca, setBusca] = useState(() => localStorage.getItem("agenda:busca") || "");
  const [buscaDebounced, setBuscaDebounced] = useState(busca);
  const [filtroStatus, setFiltroStatus] = useState(
    () => localStorage.getItem("agenda:status") || "todos"
  );
  const [filtroTipo, setFiltroTipo] = useState(
    () => localStorage.getItem("agenda:tipo") || "todos"
  );

  const liveRef = useRef(null);
  const erroRef = useRef(null);
  const mounted = useRef(true);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function carregar() {
    setCarregando(true);
    setErro("");
    setLive("Carregando agenda…");
    try {
      const data = await apiGet("/api/agenda", { on403: "silent" });
      if (!mounted.current) return;
      setEvents(Array.isArray(data) ? data : []);
      setLive(
        Array.isArray(data) && data.length
          ? `Agenda carregada: ${data.length} evento(s).`
          : "Nenhum evento encontrado para o período."
      );
    } catch (err) {
      console.error(err);
      setErro("Não foi possível carregar a agenda.");
      toast.error("❌ Não foi possível carregar a agenda.");
      setLive("Falha ao carregar a agenda.");
      setTimeout(() => erroRef.current?.focus(), 0);
    } finally {
      if (mounted.current) setCarregando(false);
    }
  }
  useEffect(() => { carregar(); }, []);

  // persistência
  useEffect(() => { localStorage.setItem("agenda:viewDate", viewDate.toISOString()); }, [viewDate]);
  useEffect(() => { localStorage.setItem("agenda:status", filtroStatus); }, [filtroStatus]);
  useEffect(() => { localStorage.setItem("agenda:tipo", filtroTipo); }, [filtroTipo]);
  useEffect(() => {
    localStorage.setItem("agenda:busca", busca);
    const t = setTimeout(() => setBuscaDebounced(busca.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [busca]);

  // map dia -> eventos
  const eventosBasePorData = useMemo(() => {
    const map = {};
    for (const evento of events) {
      let ocorrencias = [];

      if (Array.isArray(evento.ocorrencias) && evento.ocorrencias.length) {
        ocorrencias = evento.ocorrencias;
      } else if (Array.isArray(evento.turmas) && evento.turmas.length) {
        const bag = new Set();
        for (const t of evento.turmas) {
          if (Array.isArray(t.datas) && t.datas.length) {
            for (const d of t.datas) {
              const y = ymd(d?.data);
              if (y) bag.add(y);
            }
          }
        }
        ocorrencias = Array.from(bag).sort();
      }
      if (!ocorrencias.length) {
        ocorrencias = rangeDiasYMD(
          ymd(evento.data_inicio ?? evento.dataInicio ?? evento.data),
          ymd(evento.data_fim ?? evento.data_termino ?? evento.dataTermino ?? evento.data)
        );
      }
      for (const dia of ocorrencias) (map[dia] ||= []).push(evento);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => {
        const aStart = toLocalDate(
          `${ymd(a.data_inicio ?? a.dataInicio ?? a.data)}T${(a.horario_inicio ?? "00:00").slice(0, 5)}`
        );
        const bStart = toLocalDate(
          `${ymd(b.data_inicio ?? b.dataInicio ?? b.data)}T${(b.horario_inicio ?? "00:00").slice(0, 5)}`
        );
        if (!aStart || !bStart) return 0;
        return compareAsc(aStart, bStart);
      });
    }
    return map;
  }, [events]);

  // filtros
  const eventosPorData = useMemo(() => {
    if (filtroStatus === "todos" && filtroTipo === "todos" && !buscaDebounced) {
      return eventosBasePorData;
    }
    const filtra = (ev) => {
      const titulo = String(ev?.titulo ?? ev?.nome ?? "").toLowerCase();
      if (buscaDebounced && !titulo.includes(buscaDebounced)) return false;
      if (filtroStatus !== "todos" && deriveStatus(ev) !== filtroStatus) return false;
      if (filtroTipo !== "todos") {
        const tipo = String(ev?.tipo || "").toLowerCase();
        if (tipo !== filtroTipo) return false;
      }
      return true;
    };
    const out = {};
    for (const [dia, lista] of Object.entries(eventosBasePorData)) {
      const f = lista.filter(filtra);
      if (f.length) out[dia] = f;
    }
    return out;
  }, [eventosBasePorData, filtroStatus, filtroTipo, buscaDebounced]);

  // contagens
  const contagemMes = useMemo(() => {
    const ini = startOfMonth(viewDate);
    const fim = endOfMonth(viewDate);
    let total = 0;
    for (const [dia, lista] of Object.entries(eventosPorData)) {
      const d = toLocalDate(`${dia}T12:00:00`);
      if (d && d >= ini && d <= fim) total += Array.isArray(lista) ? lista.length : 0;
    }
    return total;
  }, [eventosPorData, viewDate]);

  const totais = useMemo(() => {
    const ini = startOfMonth(viewDate);
    const fim = endOfMonth(viewDate);
    let programado = 0, andamento = 0, encerrado = 0;
    for (const [dia, lista] of Object.entries(eventosPorData)) {
      const d = toLocalDate(`${dia}T12:00:00`);
      if (!d || d < ini || d > fim) continue;
      for (const ev of lista) {
        const st = deriveStatus(ev);
        if (st === "programado") programado++;
        else if (st === "andamento") andamento++;
        else encerrado++;
      }
    }
    return { programado, andamento, encerrado };
  }, [eventosPorData, viewDate]);

  const irParaHoje = () => setViewDate(new Date());

  // conteúdo do tile (com clique funcional)
  const renderTileContent = useCallback(
    ({ date }) => {
      const key = format(date, "yyyy-MM-dd");
      const diaEventos = eventosPorData[key] || [];
      if (!diaEventos.length) return null;

      const MAX = 3;
      const extras = Math.max(0, diaEventos.length - MAX);
      const visiveis = diaEventos.slice(0, MAX);

      return (
        <div className="mt-1 w-full px-1 space-y-1 min-w-0">
          {visiveis.map((ev, idx) => (
            <DiaBadge
              key={`${String(ev.id ?? ev.titulo ?? "")}-${key}-${idx}`}
              evento={ev}
              onClick={setSelecionado}
            />
          ))}

          {extras > 0 && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelecionado(diaEventos[0])}
              onKeyDown={(e) => e.key === "Enter" && setSelecionado(diaEventos[0])}
              className="w-full text-[11px] text-indigo-900 bg-indigo-100 ring-1 ring-indigo-300 rounded-md px-2 py-0.5 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer text-center"
              title={`Mais ${extras} evento(s)`}
              aria-label={`Mais ${extras} evento(s) neste dia`}
            >
              +{extras} evento(s)
            </div>
          )}
        </div>
      );
    },
    [eventosPorData]
  );

  // ====== Exportação do mês visível (CSV) ======
  function exportarMesCSV() {
    const ini = startOfMonth(viewDate);
    const fim = endOfMonth(viewDate);
    const SEP = ";";
    const BOM = "\uFEFF";
    const safe = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const header = [
      "Evento ID",
      "Título",
      "Tipo",
      "Status (derivado)",
      "Data Início",
      "Hora Início",
      "Data Fim",
      "Hora Fim",
      "Local",
    ].join(SEP);

    const rows = [];
    for (const [dia, lista] of Object.entries(eventosPorData)) {
      const d = toLocalDate(`${dia}T12:00:00`);
      if (!d || d < ini || d > fim) continue;

      for (const ev of lista) {
        const st = deriveStatus(ev);
        const di = ymd(ev.data_inicio ?? ev.dataInicio ?? ev.data);
        const df = ymd(ev.data_fim ?? ev.data_termino ?? ev.dataTermino ?? ev.data);
        const hi = (ev.horario_inicio ?? "00:00").slice(0, 5);
        const hf = (ev.horario_fim ?? "00:00").slice(0, 5);
        const local = ev.local ?? ev.endereco ?? ev.unidade ?? "";

        rows.push([
          safe(ev.id ?? ""),
          safe(ev.titulo ?? ev.nome ?? ""),
          safe(ev.tipo ?? ""),
          safe(st),
          safe(di ? format(new Date(di), "dd/MM/yyyy") : ""),
          safe(hi),
          safe(df ? format(new Date(df), "dd/MM/yyyy") : ""),
          safe(hf),
          safe(local),
        ].join(SEP));
      }
    }

    if (!rows.length) {
      toast.info("Não há eventos no mês visível para exportar.");
      return;
    }

    const csv = [header, ...rows].join("\n");
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const nomeMes = format(viewDate, "yyyy-MM");
    a.download = `agenda_${nomeMes}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1200);
  }

  // ====== Lista do dia selecionado ======
  const diaSelecionadoYMD = useMemo(() => format(viewDate, "yyyy-MM-dd"), [viewDate]);
  const eventosDoDia = eventosPorData[diaSelecionadoYMD] || [];

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-gray-900 text-black dark:text-white overflow-x-hidden">
      <HeaderHero nome={nome} carregando={carregando} onRefresh={carregar} onHoje={irParaHoje} />

      {carregando && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-indigo-100 z-40"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando agenda"
        >
          <div className={`h-full bg-indigo-600 ${reduceMotion ? "" : "animate-pulse"} w-1/3`} />
        </div>
      )}

      <main id="conteudo" className="flex-1 max-w-7xl mx-auto px-3 sm:px-4 py-5 sm:py-6 min-w-0">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        <section className="bg-white dark:bg-zinc-800 rounded-xl p-3 sm:p-5 shadow-md">
          {erro ? (
            <div
              ref={erroRef}
              tabIndex={-1}
              className="text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 rounded-lg p-3 sm:p-4"
              role="alert"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm">{erro}</p>
                <button
                  type="button"
                  onClick={carregar}
                  className="px-3 py-1.5 rounded-md text-sm bg-red-100 dark:bg-red-800/40"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Filtros */}
              <div className="flex flex-col gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <label htmlFor="busca-evento" className="sr-only">
                    Buscar evento pelo nome
                  </label>
                  <input
                    id="busca-evento"
                    type="search"
                    inputMode="search"
                    placeholder="Buscar evento pelo nome…"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 dark:bg-zinc-900 dark:text-white text-sm min-w-0"
                    aria-describedby="dica-busca"
                  />
                  {busca && (
                    <button
                      type="button"
                      onClick={() => setBusca("")}
                      className="px-3 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-sm shrink-0"
                      aria-label="Limpar busca"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex flex-col">
                    <label htmlFor="filtro-status" className="text-xs mb-1 text-slate-700 dark:text-slate-200">
                      Status
                    </label>
                    <select
                      id="filtro-status"
                      value={filtroStatus}
                      onChange={(e) => setFiltroStatus(e.target.value)}
                      className="p-2 rounded-md border dark:border-gray-700 dark:bg-zinc-900 dark:text-white text-sm"
                    >
                      <option value="todos">Todos</option>
                      <option value="programado">Programados</option>
                      <option value="andamento">Em andamento</option>
                      <option value="encerrado">Encerrados</option>
                    </select>
                  </div>

                  <div className="flex flex-col">
                    <label htmlFor="filtro-tipo" className="text-xs mb-1 text-slate-700 dark:text-slate-200">
                      Tipo
                    </label>
                    <select
                      id="filtro-tipo"
                      value={filtroTipo}
                      onChange={(e) => setFiltroTipo(e.target.value)}
                      className="p-2 rounded-md border dark:border-gray-700 dark:bg-zinc-900 dark:text-white text-sm"
                    >
                      <option value="todos">Todos</option>
                      <option value="curso">Curso</option>
                      <option value="oficina">Oficina</option>
                      <option value="congresso">Congresso</option>
                      <option value="webinar">Webinar</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    {(filtroStatus !== "todos" || filtroTipo !== "todos" || busca) && (
                      <button
                        type="button"
                        onClick={() => { setFiltroStatus("todos"); setFiltroTipo("todos"); setBusca(""); }}
                        className="w-full px-3 py-2 text-sm rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"
                        aria-label="Limpar filtros da agenda"
                      >
                        Limpar filtros
                      </button>
                    )}
                  </div>
                </div>

                <p id="dica-busca" className="text-xs text-gray-600 dark:text-gray-300">
                  Dica: use busca + filtros para encontrar rapidamente um evento.
                </p>
              </div>

              {/* Mês + contagem + badges + export */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Mês visível:{" "}
                  <strong className="text-gray-900 dark:text-white">
                    {format(viewDate, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())}
                  </strong>{" "}
                  • <span aria-live="polite">{contagemMes} evento(s)</span>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <TotalBadge label="Programados" value={totais.programado} variant="programado" />
                  <TotalBadge label="Em andamento" value={totais.andamento} variant="andamento" />
                  <TotalBadge label="Encerrados" value={totais.encerrado} variant="encerrado" />
                  <button
                    type="button"
                    onClick={exportarMesCSV}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800 text-white text-xs hover:bg-slate-900"
                    title="Exportar os eventos do mês visível em CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exportar mês (CSV)
                  </button>
                </div>
              </div>

              {/* Calendário */}
              <div className="rounded-xl overflow-hidden ring-1 ring-indigo-200 dark:ring-indigo-900">
                {carregando ? (
                  <div className="p-4 space-y-3">
                    <Skeleton height={28} />
                    <Skeleton height={240} />
                  </div>
                ) : (
                  <Calendar
                    value={viewDate}
                    onActiveStartDateChange={({ activeStartDate }) =>
                      setViewDate(activeStartDate || new Date())
                    }
                    onViewChange={({ activeStartDate }) =>
                      setViewDate(activeStartDate || new Date())
                    }
                    onClickMonth={(dt) => setViewDate(dt)}
                    onClickDay={(dt) => setViewDate(dt)}
                    locale="pt-BR"
                    className="react-calendar react-calendar-custom !bg-transparent"
                    prevLabel="‹"
                    nextLabel="›"
                    aria-label="Calendário de eventos"
                    tileClassName="!rounded-lg hover:!bg-gray-200 dark:hover:!bg-zinc-700 focus:!ring-2 focus:!ring-indigo-500"
                    navigationLabel={({ date }) =>
                      format(date, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())
                    }
                    tileContent={renderTileContent}
                  />
                )}
              </div>

              {/* Lista do dia selecionado */}
              <div className="mt-5">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
                  {`Eventos em ${format(viewDate, "dd/MM/yyyy")}`}
                </h2>

                {!eventosDoDia.length ? (
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    Nenhum evento neste dia.
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {eventosDoDia.map((ev) => {
                      const st = deriveStatus(ev);
                      const c = colorByStatus[st] || colorByStatus.programado;
                      const di = ymd(ev.data_inicio ?? ev.dataInicio ?? ev.data);
                      const df = ymd(ev.data_fim ?? ev.data_termino ?? ev.dataTermino ?? ev.data);
                      const hi = (ev.horario_inicio ?? "00:00").slice(0, 5);
                      const hf = (ev.horario_fim ?? "00:00").slice(0, 5);

                      return (
                        <li
                          key={ev.id ?? `${ev.titulo}-${di}-${hi}`}
                          className={`rounded-xl ring-1 ${c.ring} ${c.bg} ${c.text} p-3`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold break-words">{ev.titulo ?? ev.nome ?? "Evento"}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                <TipoChip tipo={ev.tipo} />
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-black/10 bg-white/60 text-black">
                                  {st.charAt(0).toUpperCase() + st.slice(1)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 text-sm flex flex-col gap-1">
                            <div className="inline-flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              <span>
                                {di ? format(new Date(di), "dd/MM/yyyy") : "—"} {hi && `• ${hi}`}
                                {(df && df !== di) && ` — ${format(new Date(df), "dd/MM/yyyy")}${hf ? ` • ${hf}` : ""}`}
                              </span>
                            </div>
                            {(ev.local || ev.endereco || ev.unidade) && (
                              <div className="inline-flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                <span className="break-words">
                                  {ev.local || ev.endereco || ev.unidade}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() => setSelecionado(ev)}
                              className="px-3 py-1.5 rounded-md bg-black/80 text-white text-xs hover:bg-black"
                              aria-label={`Ver detalhes do evento ${ev.titulo ?? ev.nome ?? ""}`}
                            >
                              Ver detalhes
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>

        <div className="mt-6 flex justify-center">
          <LegendaEventos />
        </div>

        {selecionado && (
          <EventoDetalheModal
            evento={selecionado}
            aoFechar={() => setSelecionado(null)}
            visivel
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
