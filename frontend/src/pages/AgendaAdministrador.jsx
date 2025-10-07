// ✅ src/pages/AgendaAdministrador.jsx (atualizado c/ badges de totais)
import { useEffect, useMemo, useRef, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { format, isAfter, isBefore, isWithinInterval, compareAsc, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "react-toastify";

import Footer from "../components/Footer";
import EventoDetalheModal from "../components/EventoDetalheModal";
import LegendaEventos from "../components/LegendaEventos";
import { apiGet } from "../services/api";

/* ========= HeaderHero (igual) ========= */
function HeaderHero({ nome, carregando, onRefresh, onHoje }) {
  return (
    <header className="bg-gradient-to-br from-sky-900 via-cyan-700 to-teal-600 text-white" role="banner">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center flex flex-col items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
          Agenda Geral de Eventos
        </h1>
        <p className="text-sm text-white/90">
          {nome ? `Bem-vindo(a), ${nome}.` : "Bem-vindo(a)."} Visualize e consulte os eventos por dia.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onHoje}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition bg-white/15 hover:bg-white/25 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Ir para a data de hoje no calendário"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={carregando}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70
              ${carregando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"} text-white`}
            aria-label="Atualizar agenda"
          >
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>
    </header>
  );
}

/* =========================================================================
   Helpers de data (mantidos)
   ========================================================================= */
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
  const end   = df ? toLocalDate(`${ymd(df)}T${hf}`) : null;
  const agora = new Date();
  if (start && end) {
    if (isBefore(agora, start)) return "programado";
    if (isWithinInterval(agora, { start, end })) return "andamento";
    if (isAfter(agora, end)) return "encerrado";
  }
  return ev.status || "programado";
}

/* ========= Cores (status + tipo) ========= */
const colorByStatus = {
  programado: { bg: "bg-emerald-100", text: "text-emerald-800", ring: "ring-emerald-300" },
  andamento:  { bg: "bg-amber-100",   text: "text-amber-800",   ring: "ring-amber-300" },
  encerrado:  { bg: "bg-rose-100",    text: "text-rose-800",    ring: "ring-rose-300" },
};
// sobrescreve por tipo se existir (opcional)
const colorByTipo = {
  curso:      { bg: "bg-sky-100",     text: "text-sky-800",     ring: "ring-sky-300" },
  oficina:    { bg: "bg-fuchsia-100", text: "text-fuchsia-800", ring: "ring-fuchsia-300" },
  congresso:  { bg: "bg-indigo-100",  text: "text-indigo-800",  ring: "ring-indigo-300" },
  webinar:    { bg: "bg-cyan-100",    text: "text-cyan-800",    ring: "ring-cyan-300" },
};
function getBadgeColors(ev) {
  const tipo = String(ev?.tipo || "").toLowerCase();
  if (tipo && colorByTipo[tipo]) return colorByTipo[tipo];
  const st = deriveStatus(ev);
  return colorByStatus[st] || colorByStatus.programado;
}

/* ========= Badge de evento no dia ========= */
function DiaBadge({ ev, dateKey, onClick }) {
  const hi = (ev.horario_inicio ?? ev.horarioInicio ?? "").slice(0, 5);
  const hf = (ev.horario_fim ?? ev.horarioFim ?? "").slice(0, 5);
  const hora = hi && hf ? `${hi}–${hf}` : hi || hf || "";
  const cores = getBadgeColors(ev);

  return (
    <button
      type="button"
      onClick={() => onClick?.(ev)}
      title={`${ev.titulo}${hora ? ` • ${hora}` : ""}`}
      className={`group w-full text-left ${cores.bg} ${cores.text} ring-1 ${cores.ring} 
                  rounded-md px-2 py-1 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-1`}
      aria-label={`Evento: ${ev.titulo}${hora ? `, ${hora}` : ""}`}
    >
      <div className="flex items-center gap-2">
        {hora && <span className="text-[10px] font-semibold tabular-nums shrink-0">{hora}</span>}
        <span className="text-[11px] font-medium truncate">{ev.titulo}</span>
      </div>
    </button>
  );
}

/* ========= Badge de TOTAL (ministats compactos) ========= */
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

/* ========================================================================= */

export default function AgendaAdministrador() {
  const nome = localStorage.getItem("nome") || "";
  const [events, setEvents] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [viewDate, setViewDate] = useState(new Date());

  const liveRef = useRef(null);
  const setLive = (msg) => { if (liveRef.current) liveRef.current.textContent = msg; };

  async function carregar() {
    setCarregando(true);
    setErro("");
    setLive("Carregando agenda…");
    try {
      const data = await apiGet("/api/agenda");
      setEvents(Array.isArray(data) ? data : []);
      setLive(Array.isArray(data) && data.length ? `Agenda carregada: ${data.length} evento(s).` : "Nenhum evento encontrado para o período.");
    } catch (err) {
      console.error(err);
      setErro("Não foi possível carregar a agenda.");
      toast.error("❌ Não foi possível carregar a agenda.");
      setLive("Falha ao carregar a agenda.");
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => { carregar(); }, []);

  // 1) usa ocorrencias; 2) senão, datas das turmas; 3) fallback de intervalo
  const eventosPorData = useMemo(() => {
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
      for (const dia of ocorrencias) {
        (map[dia] ||= []).push(evento);
      }
    }
    // ordena por início dentro do dia
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => {
        const aStart = toLocalDate(`${ymd(a.data_inicio ?? a.dataInicio ?? a.data)}T${(a.horario_inicio ?? "00:00").slice(0, 5)}`);
        const bStart = toLocalDate(`${ymd(b.data_inicio ?? b.dataInicio ?? b.data)}T${(b.horario_inicio ?? "00:00").slice(0, 5)}`);
        if (!aStart || !bStart) return 0;
        return compareAsc(aStart, bStart);
      });
    }
    return map;
  }, [events]);

  // Contagem de eventos no mês visível (apenas para feedback do calendário)
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

  // 👉 Totais por status (para os BADGES de resumo)
  const totais = useMemo(() => {
    let programado = 0, andamento = 0, encerrado = 0;
    for (const ev of events) {
      const st = deriveStatus(ev);
      if (st === "programado") programado++;
      else if (st === "andamento") andamento++;
      else encerrado++;
    }
    return { programado, andamento, encerrado };
  }, [events]);

  const irParaHoje = () => setViewDate(new Date());

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-gray-900 text-black dark:text-white">
      <HeaderHero nome={nome} carregando={carregando} onRefresh={carregar} onHoje={irParaHoje} />

      {carregando && (
        <div className="sticky top-0 left-0 w-full h-1 bg-cyan-100 z-40" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-label="Carregando agenda">
          <div className="h-full bg-cyan-600 animate-pulse w-1/3" />
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-4 py-6">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        <section className="bg-white dark:bg-zinc-800 rounded-xl p-3 sm:p-5 shadow-md">
          {erro ? (
            <p className="text-red-600 dark:text-red-400 text-center">{erro}</p>
          ) : (
            <>
              {/* Linha de mês + contagem + BADGES de totais */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Mês visível:{" "}
                  <strong className="text-gray-900 dark:text-white">
                    {format(viewDate, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())}
                  </strong>{" "}
                  • <span aria-live="polite">{contagemMes} evento(s)</span>
                </div>

                {/* Badges de resumo (totais por status) */}
                <div className="flex flex-wrap gap-2">
                  <TotalBadge label="Programados" value={totais.programado} variant="programado" />
                  <TotalBadge label="Em andamento" value={totais.andamento} variant="andamento" />
                  <TotalBadge label="Encerrados" value={totais.encerrado} variant="encerrado" />
                </div>
              </div>

              <Calendar
                value={viewDate}
                onActiveStartDateChange={({ activeStartDate }) => setViewDate(activeStartDate || new Date())}
                onViewChange={({ activeStartDate }) => setViewDate(activeStartDate || new Date())}
                onClickMonth={(dt) => setViewDate(dt)}
                onClickDay={(dt) => setViewDate(dt)}
                locale="pt-BR"
                className="react-calendar react-calendar-custom !bg-transparent"
                prevLabel="‹"
                nextLabel="›"
                aria-label="Calendário de eventos"
                tileClassName="!rounded-lg hover:!bg-gray-200 dark:hover:!bg-zinc-700 focus:!ring-2 focus:!ring-cyan-500"
                navigationLabel={({ date }) =>
                  format(date, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())
                }

                /* ===== BADGES por dia ===== */
                tileContent={({ date }) => {
                  const key = format(date, "yyyy-MM-dd");
                  const diaEventos = eventosPorData[key] || [];

                  if (!diaEventos.length) return null;

                  // limite para não “estourar” a célula. Mostra +N se passar.
                  const MAX = 3;
                  const extras = Math.max(0, diaEventos.length - MAX);
                  const visiveis = diaEventos.slice(0, MAX);

                  return (
                    <div className="mt-1 w-full px-1 space-y-1">
                      {visiveis.map((ev) => (
                        <DiaBadge
                          key={`${ev.id ?? ev.titulo}-${key}`}
                          ev={ev}
                          dateKey={key}
                          onClick={(e) => setSelecionado(e)}
                        />
                      ))}
                      {extras > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelecionado(diaEventos[0])}
                          className="w-full text-[11px] text-cyan-800 bg-cyan-100 ring-1 ring-cyan-300 rounded-md px-2 py-0.5 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-1"
                          title={`Mais ${extras} evento(s)`}
                        >
                          +{extras} evento(s)
                        </button>
                      )}
                    </div>
                  );
                }}
              />
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
