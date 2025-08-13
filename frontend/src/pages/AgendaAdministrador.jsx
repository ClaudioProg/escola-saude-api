// src/pages/AgendaEventos.jsx
import { useEffect, useMemo, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { format, isAfter, isBefore, isWithinInterval, compareAsc } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "react-toastify";

import Breadcrumbs from "../components/Breadcrumbs";
import EventoDetalheModal from "../components/EventoDetalheModal";
import LegendaEventos from "../components/LegendaEventos";
import { apiGet } from "../services/api";

// ---- helpers de data (tratam string ISO como "local", sem UTC) ----------------
function toLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  const s = String(input);

  // Aceita "YYYY-MM-DD" e "YYYY-MM-DDTHH:mm[:ss]" (T ou espaço)
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!m) return null; // ❗ evita parse nativo que pode usar UTC

  const [, y, mo, d, hh = "00", mm = "00", ss = "00"] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss));
}

function ymd(dateLike) {
  const d = toLocalDate(dateLike);
  if (!d || Number.isNaN(+d)) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function deriveStatus(ev) {
  const di = ev.data_inicio ?? ev.dataInicio ?? ev.data;
  const df = ev.data_fim ?? ev.data_termino ?? ev.dataTermino ?? ev.data;

  // usa horários se existirem; senão, 00:00 e 23:59
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
// -----------------------------------------------------------------------------


export default function AgendaEventos() {
  const nome = localStorage.getItem("nome") || "";
  const [events, setEvents] = useState([]);
  const [selecionado, setSelecionado] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet("/api/agenda");
        setEvents(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        toast.error("❌ Não foi possível carregar a agenda.");
      }
    })();
  }, []);

  // Agrupa por dia (YYYY-MM-DD) usando datas "locais" e ordena por horário
  const eventosPorData = useMemo(() => {
    const map = {};
    for (const evento of events) {
      const chave = ymd(evento.data_inicio ?? evento.dataInicio ?? evento.data);
      if (!chave) continue;
      (map[chave] ||= []).push(evento);
    }

    // ordena por início (data/hora)
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
    <main className="min-h-screen bg-gelo dark:bg-gray-900 px-4 py-6 text-gray-800 dark:text-white">
      <Breadcrumbs trilha={[{ label: "Início" }, { label: "Agenda Geral de Eventos" }]} />

      <div className="flex justify-between items-center bg-lousa text-white px-4 py-2 rounded-xl shadow mb-6">
        <span>
          Seja bem-vindo(a), <strong>{nome}</strong>
        </span>
        <span className="font-semibold">Painel do administrador</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6 text-[#1b4332] dark:text-white">
        📅 Agenda Geral de Eventos
      </h1>

      <div className="flex justify-center">
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow-md">
          <Calendar
            locale="pt-BR"
            className="react-calendar !bg-transparent !text-sm"
            prevLabel="‹"
            nextLabel="›"
            tileClassName="!rounded-lg !p-2 hover:!bg-gray-200 dark:hover:!bg-zinc-700"
            navigationLabel={({ date }) =>
              format(date, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())
            }
            tileContent={({ date }) => {
              const key = format(date, "yyyy-MM-dd");
              const diaEventos = eventosPorData[key];
              if (!diaEventos) return null;

              return (
                <div className="mt-1 flex gap-1 justify-center flex-wrap">
                  {diaEventos.map((ev) => {
                    const st = deriveStatus(ev);
                    const inicioStr = ymd(ev.data_inicio ?? ev.dataInicio ?? ev.data);
                    const fimStr = ymd(ev.data_fim ?? ev.data_termino ?? ev.dataTermino ?? ev.data);
                    const hi = (ev.horario_inicio ?? "00:00").slice(0,5);
                    const hf = (ev.horario_fim ?? "23:59").slice(0,5);

                    const inicio = inicioStr ? toLocalDate(`${inicioStr}T${hi}`) : null;
                    const fim = fimStr ? toLocalDate(`${fimStr}T${hf}`) : null;

                    const tooltip =
                      ev.titulo +
                      (inicio
                        ? ` (${format(inicio, "dd/MM/yyyy HH:mm", { locale: ptBR })}${
                            fim ? ` – ${format(fim, "dd/MM/yyyy HH:mm", { locale: ptBR })}` : ""
                          })`
                        : "");

                    const color =
                      st === "programado" ? "#22c55e" : st === "andamento" ? "#eab308" : "#ef4444";

                    return (
                      <span
                        key={String(ev.id ?? `${ev.titulo}-${inicioStr}`)}
                        title={tooltip}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelecionado(ev)}
                        onClick={() => setSelecionado(ev)}
                        className="w-2 h-2 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-lousa"
                        aria-label={`Evento: ${ev.titulo}`}
                        style={{ backgroundColor: color }}
                      />
                    );
                  })}
                </div>
              );
            }}
          />
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
  );
}
