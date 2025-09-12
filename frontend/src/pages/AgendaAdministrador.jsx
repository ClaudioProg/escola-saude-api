// ✅ src/pages/AgendaAdministrador.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { format, isAfter, isBefore, isWithinInterval, compareAsc } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "react-toastify";

import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import EventoDetalheModal from "../components/EventoDetalheModal";
import LegendaEventos from "../components/LegendaEventos";
import { apiGet } from "../services/api";

/* =========================================================================
   Helpers de data — tolerantes a strings com timezone (Z, +hh:mm)
   Trabalham sempre em "hora local" para não deslocar dias.
   ========================================================================= */
const stripTZ = (s) =>
  String(s)
    .trim()
    .replace(/\.\d{3,}\s*Z?$/i, "")        // remove .000Z
    .replace(/([+-]\d{2}:\d{2}|Z)$/i, ""); // remove +03:00 / -03:00 / Z

function toLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;

  const s = stripTZ(input);
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!m) return null;

  const [, y, mo, d, hh = "00", mm = "00", ss = "00"] = m;
  return new Date(+y, +mo - 1, +d, +hh, +mm, +ss);
}

function ymd(val) {
  if (!val) return null;

  // string: pegue só a cabeça YYYY-MM-DD (antes de T/offset)
  if (typeof val === "string") {
    const head = stripTZ(val).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
  }

  // Date ou outros casos: formata manualmente
  const d = toLocalDate(val);
  if (!d || Number.isNaN(+d)) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Gera todos os dias (YYYY-MM-DD) entre início e fim (inclusivo)
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

// Cores das bolinhas
const colorByStatus = {
  programado: "#22c55e",
  andamento:  "#eab308",
  encerrado:  "#ef4444",
};
/* ========================================================================= */

export default function AgendaAdministrador() {
  const nome = localStorage.getItem("nome") || "";
  const [events, setEvents] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const liveRef = useRef(null);

  async function carregar() {
    setCarregando(true);
    setErro("");
    if (liveRef.current) liveRef.current.textContent = "Carregando agenda…";

    try {
      const data = await apiGet("/api/agenda");
      setEvents(Array.isArray(data) ? data : []);
      if (liveRef.current) {
        liveRef.current.textContent = Array.isArray(data) && data.length
          ? `Agenda carregada: ${data.length} evento(s).`
          : "Nenhum evento encontrado para o período.";
      }
    } catch (err) {
      console.error(err);
      setErro("Não foi possível carregar a agenda.");
      toast.error("❌ Não foi possível carregar a agenda.");
      if (liveRef.current) liveRef.current.textContent = "Falha ao carregar a agenda.";
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  // 1) usa evento.ocorrencias (se vier)
  // 2) senão, tenta coletar datas a partir de evento.turmas[].datas[].data
  // 3) senão, fallback para o intervalo (legado)
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

  return (
    <>
      <PageHeader
        title="📅 Agenda Geral de Eventos"
        subtitle="Painel do administrador"
        leftPill={`Seja bem-vindo(a), ${nome || "administrador(a)"}`}
        actions={
          <button
            type="button"
            onClick={carregar}
            disabled={carregando}
            className={`px-3 py-1.5 text-sm rounded-md border transition
              ${carregando
                ? "opacity-60 cursor-not-allowed bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                : "bg-lousa text-white hover:bg-green-800"}`}
            aria-label="Atualizar agenda"
          >
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        }
      />

      <main className="min-h-screen bg-gelo dark:bg-gray-900 px-3 sm:px-4 py-6 text-gray-900 dark:text-white">
        {/* Live region acessível */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        <div className="mx-auto w-full max-w-7xl">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-3 sm:p-5 shadow-md">
            {erro ? (
              <p className="text-red-600 dark:text-red-400 text-center">{erro}</p>
            ) : (
              <Calendar
                locale="pt-BR"
                className="react-calendar react-calendar-custom !bg-transparent"
                prevLabel="‹"
                nextLabel="›"
                // acessibilidade básica do calendário
                aria-label="Calendário de eventos"
                // estilização nos tiles
                tileClassName="!rounded-lg hover:!bg-gray-200 dark:hover:!bg-zinc-700 focus:!ring-2 focus:!ring-lousa"
                navigationLabel={({ date }) =>
                  format(date, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())
                }
                // bolinhas por dia
                tileContent={({ date }) => {
                  const key = format(date, "yyyy-MM-dd");
                  const diaEventos = eventosPorData[key] || [];

                  return (
                    <div className="rc-day-dots mt-1 flex gap-1 justify-center flex-wrap">
                      {diaEventos.map((ev) => {
                        const st = deriveStatus(ev);
                        return (
                          <span
                            key={`${ev.id ?? ev.titulo}-${key}`}
                            className="agenda-dot cursor-pointer focus:outline-none focus:ring-2 focus:ring-lousa"
                            style={{
                              backgroundColor: colorByStatus[st] || colorByStatus.programado,
                              width: 10,
                              height: 10,
                              borderRadius: 9999,
                              display: "inline-block",
                            }}
                            title={ev.titulo}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelecionado(ev)}
                            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelecionado(ev)}
                            aria-label={`Evento: ${ev.titulo}`}
                          />
                        );
                      })}
                    </div>
                  );
                }}
              />
            )}
          </div>
        </div>

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
    </>
  );
}
