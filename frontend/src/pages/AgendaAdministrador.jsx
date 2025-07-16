import { useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "react-toastify";

import Breadcrumbs from "../components/Breadcrumbs";
import EventoDetalheModal from "../components/EventoDetalheModal";
import LegendaEventos from "../components/LegendaEventos";
// ✅ Importe o utilitário para padronizar datas em detalhes
import { formatarDataBrasileira } from "../utils/data";

export default function AgendaEventos() {
  const token = localStorage.getItem("token");
  const nome = localStorage.getItem("nome") || "";
  const [events, setEvents] = useState([]);
  const [selecionado, setSelecionado] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/eventos/agenda", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Erro ao buscar agenda");
        const data = await res.json();
        setEvents(data);
      } catch (e) {
        toast.error("❌ " + e.message);
      }
    }
    load();
  }, [token]); // inclua token como dependência para garantir atualização

  const eventosPorData = events.reduce((map, evento) => {
    // Normaliza para garantir padronização UTC (sem fuso)
    const dia = format(new Date(evento.data_inicio), "yyyy-MM-dd");
    if (!map[dia]) map[dia] = [];
    map[dia].push(evento);
    return map;
  }, {});

  return (
    <main className="min-h-screen bg-gelo dark:bg-gray-900 px-4 py-6 text-gray-800 dark:text-white">
      <Breadcrumbs trilha={[{ label: "Início" }, { label: "Agenda Geral de Eventos" }]} />

      <div className="flex justify-between items-center bg-lousa text-white px-4 py-2 rounded-xl shadow mb-6">
        <span>Seja bem-vindo(a), <strong>{nome}</strong></span>
        <span className="font-semibold">Painel do administradoristrador</span>
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
              format(date, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())
            }
            tileContent={({ date }) => {
              const key = format(date, "yyyy-MM-dd");
              const diaEventos = eventosPorData[key];
              if (!diaEventos) return null;
              return (
                <div className="mt-1 flex gap-1 justify-center flex-wrap">
                  {diaEventos.map(ev => (
                    <span
                      key={ev.id}
                      title={
                        ev.titulo +
                        (ev.data_inicio
                          ? ` (${formatarDataBrasileira(ev.data_inicio)})`
                          : "")
                      }
                      onClick={() => setSelecionado(ev)}
                      className={`w-2 h-2 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-lousa`}
                      aria-label={`Evento: ${ev.titulo}`}
                      style={{
                        backgroundColor:
                          ev.status === "programado"
                            ? "#22c55e"
                            : ev.status === "andamento"
                            ? "#eab308"
                            : "#ef4444",
                      }}
                    />
                  ))}
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
