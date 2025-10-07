// 📁 src/pages/AgendaUsuario.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { format, isAfter, isBefore, isWithinInterval, compareAsc } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "react-toastify";
import { CalendarDays, RefreshCw } from "lucide-react";

import Footer from "../components/Footer";
import EventoDetalheModal from "../components/EventoDetalheModal";
import LegendaEventos from "../components/LegendaEventos";
import { apiGet } from "../services/api";

/* ───────────────── HeaderHero ───────────────── */
function HeaderHero({ onRefresh, carregando = false, variant = "emerald", nome = "" }) {
  const variants = {
    emerald: "from-emerald-900 via-emerald-800 to-emerald-700",
    cyan: "from-cyan-900 via-cyan-800 to-cyan-700",
    fuchsia: "from-fuchsia-900 via-fuchsia-800 to-fuchsia-700",
    orange: "from-orange-900 via-orange-800 to-orange-700",
    slate: "from-slate-900 via-slate-800 to-slate-700",
    amber: "from-amber-900 via-amber-800 to-amber-700",
  };
  const grad = variants[variant] ?? variants.emerald;

  return (
    <header className={`bg-gradient-to-br ${grad} text-white`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <CalendarDays className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Minha Agenda
          </h1>
        </div>

        <p className="text-sm text-white/90">Seus eventos e turmas inscritas.</p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="px-3 py-1 rounded-full text-xs bg-white/10 backdrop-blur">
            Bem-vindo(a), {nome || "usuário(a)"}
          </span>

          <button
            type="button"
            onClick={onRefresh}
            disabled={carregando}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition
              ${carregando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-green-600 hover:bg-green-700"} text-white`}
            aria-label="Atualizar agenda"
          >
            <RefreshCw className="w-4 h-4" />
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ───────────────── MiniStat ───────────────── */
function MiniStat({ value, label, color, bordered = true }) {
  return (
    <div
      className={`flex-1 min-w-[170px] ${bordered ? "border rounded-2xl" : ""} p-4 text-center`}
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div className="text-3xl font-extrabold" style={{ color }}>{value}</div>
      <div className="text-[11px] tracking-wide uppercase text-gray-500">{label}</div>
    </div>
  );
}

/* ───────────────── DiaBadge (chip clicável) ───────────────── */
const colorByStatus = {
  programado: "#22c55e", // green-500
  andamento:  "#eab308", // amber-500
  encerrado:  "#ef4444", // red-500
};

function DiaBadge({ evento, onClick }) {
  // título curto
  const titulo = String(evento?.titulo || evento?.nome || "Evento").slice(0, 28);

  // hora (se houver)
  const hi = (evento?.horario_inicio ?? "00:00").slice(0, 5);
  const hf = (evento?.horario_fim ?? "23:59").slice(0, 5);
  const showHora = hi !== "00:00" || hf !== "23:59";
  const horaStr = showHora ? `${hi}–${hf}` : null;

  // status → cores
  const st = deriveStatus(evento);
  const bg = colorByStatus[st] || colorByStatus.programado;

  return (
    <button
      type="button"
      onClick={onClick}
      title={evento?.titulo}
      className="max-w-full truncate inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
      style={{
        backgroundColor: `${bg}1A`, // ~10% alpha
        color: bg,
        border: `1px solid ${bg}55`, // ~33% alpha
      }}
    >
      <span className="truncate">{titulo}</span>
      {horaStr && <span className="opacity-80">• {horaStr}</span>}
    </button>
  );
}

/* =========================================================================
   Helpers de data
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
/* ========================================================================= */

export default function AgendaUsuario() {
  const nome = localStorage.getItem("nome") || "";
  const [events, setEvents] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const liveRef = useRef(null);

  async function carregar() {
    setCarregando(true);
    setErro("");
    if (liveRef.current) liveRef.current.textContent = "Carregando sua agenda…";

    try {
      // backend retorna somente eventos nos quais o usuário está inscrito
      const data = await apiGet("/api/agenda/minha", { on401: "silent", on403: "silent" });
      const arr = Array.isArray(data) ? data : [];
      setEvents(arr);
      if (liveRef.current) {
        liveRef.current.textContent = arr.length
          ? `Agenda carregada: ${arr.length} evento(s).`
          : "Você ainda não tem eventos na agenda.";
      }
    } catch (err) {
      console.error(err);
      setErro("Não foi possível carregar sua agenda.");
      toast.error("❌ Não foi possível carregar sua agenda.");
      if (liveRef.current) liveRef.current.textContent = "Falha ao carregar sua agenda.";
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  // 👉 ministats (conta por status)
  const stats = useMemo(() => {
    let p = 0, a = 0, r = 0;
    for (const ev of events) {
      const st = deriveStatus(ev);
      if (st === "programado") p++;
      else if (st === "andamento") a++;
      else r++;
    }
    return { programados: p, andamento: a, realizados: r };
  }, [events]);

  // mapa dia->eventos (datas reais preferencialmente)
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
      <HeaderHero onRefresh={carregar} carregando={carregando} variant="emerald" nome={nome} />

      <main className="min-h-screen bg-gelo dark:bg-gray-900 px-3 sm:px-4 py-6 text-gray-900 dark:text-white">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {/* Ministats com borda */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <MiniStat value={stats.programados} label="Programados"   color="#22c55e" />
          <MiniStat value={stats.andamento}   label="Em andamento"  color="#eab308" />
          <MiniStat value={stats.realizados}  label="Realizados"    color="#ef4444" />
        </div>

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
                aria-label="Calendário dos meus eventos"
                tileClassName="!rounded-lg hover:!bg-gray-200 dark:hover:!bg-zinc-700 focus:!ring-2 focus:!ring-emerald-600"
                navigationLabel={({ date }) =>
                  format(date, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())
                }
                tileContent={({ date }) => {
                  const key = format(date, "yyyy-MM-dd");
                  const lista = eventosPorData[key] || [];
                  if (!lista.length) return null;

                  // mostra até 3 chips + "+N"
                  const maxChips = 3;
                  const visiveis = lista.slice(0, maxChips);
                  const resto = Math.max(0, lista.length - visiveis.length);

                  return (
                    <div className="mt-1 px-1 flex gap-1 justify-center flex-wrap">
                      {visiveis.map((ev) => (
                        <DiaBadge
                          key={`${ev.id ?? ev.titulo}-${key}`}
                          evento={ev}
                          onClick={() => setSelecionado(ev)}
                        />
                      ))}
                      {resto > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelecionado(lista[0])}
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          title={`Mais ${resto} evento(s) neste dia`}
                        >
                          +{resto}
                        </button>
                      )}
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
