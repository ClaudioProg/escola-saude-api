// ✅ src/pages/AgendaInstrutor.jsx
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

/* ───────── Header (cor própria desta página) ───────── */
function HeaderHero({ onRefresh, carregando = false, nome = "" }) {
  return (
    <header className="bg-gradient-to-br from-cyan-900 via-cyan-800 to-cyan-700 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <CalendarDays className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Agenda do Instrutor</h1>
        </div>
        <p className="text-sm text-white/90">Seus encontros, aulas e eventos onde você é o instrutor.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="px-3 py-1 rounded-full text-xs bg-white/10 backdrop-blur">
            Bem-vindo(a), {nome || "instrutor(a)"}
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

/* ───────── helpers de data (tolerantes) ───────── */
const stripTZ = (s) => String(s).trim().replace(/\.\d{3,}\s*Z?$/i, "").replace(/([+-]\d{2}:\d{2}|Z)$/i, "");
const hh = (s, fb = "00:00") => (typeof s === "string" && /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : fb);

function toLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  const s = stripTZ(input);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const [, y, mo, d, H = "00", M = "00", S = "00"] = m;
  return new Date(+y, +mo - 1, +d, +H, +M, +S);
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
  for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) out.push(ymd(d));
  return out;
}
function deriveStatus(ev) {
  const di = ev.data_inicio ?? ev.dataInicio ?? ev.data;
  const df = ev.data_fim ?? ev.data_termino ?? ev.dataTermino ?? ev.data;
  const hi = hh(ev.horario_inicio, "00:00");
  const hf = hh(ev.horario_fim, "23:59");
  const start = di ? toLocalDate(`${ymd(di)}T${hi}`) : null;
  const end = df ? toLocalDate(`${ymd(df)}T${hf}`) : null;
  const now = new Date();
  if (start && end) {
    if (isBefore(now, start)) return "programado";
    if (isWithinInterval(now, { start, end })) return "andamento";
    if (isAfter(now, end)) return "encerrado";
  }
  return ev.status || "programado";
}
const colorByStatus = { programado: "#22c55e", andamento: "#eab308", encerrado: "#ef4444" };

/* ───────── mini stat ───────── */
function MiniStat({ value, label, color, bordered = true }) {
  return (
    <div className={`flex-1 min-w-[170px] ${bordered ? "border rounded-2xl" : ""} p-4 text-center`} style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <div className="text-3xl font-extrabold" style={{ color }}>{value}</div>
      <div className="text-[11px] tracking-wide uppercase text-gray-500">{label}</div>
    </div>
  );
}

/* ───────── Badge (chip) clicável no dia ───────── */
function DiaBadge({ evento, onClick }) {
  const titulo = String(evento?.titulo || evento?.nome || "Evento").slice(0, 28);
  const hi = hh(evento?.horario_inicio, "00:00");
  const hf = hh(evento?.horario_fim, "23:59");
  const showHora = hi !== "00:00" || hf !== "23:59";
  const horaStr = showHora ? `${hi}–${hf}` : null;

  const st = deriveStatus(evento);
  const bg = colorByStatus[st] || colorByStatus.programado;

  return (
    <button
      type="button"
      onClick={onClick}
      title={evento?.titulo}
      className="max-w-full truncate inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-600"
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

/* ───────── normalização robusta (preserva local/instrutores) ───────── */
function normalizeFromAPI(raw) {
  let arr = [];
  if (Array.isArray(raw)) arr = raw;
  else if (raw && typeof raw === "object") {
    for (const k of ["agenda", "eventos", "items", "dados", "results", "lista", "turmas", "data"]) {
      if (Array.isArray(raw[k])) { arr = raw[k]; break; }
    }
  }

  const out = [];

  const fromTurma = (t, parentEvt = null) => {
    const ocorrencias = [];
    const datas = Array.isArray(t?.datas) ? t.datas : [];
    const encontros = Array.isArray(t?.encontros) ? t.encontros : [];
    if (datas.length) {
      for (const d of datas) {
        const y = ymd(d?.data || d);
        if (!y) continue;
        ocorrencias.push({
          data: y,
          horario_inicio: hh(d?.horario_inicio, hh(t?.horario_inicio, "00:00")),
          horario_fim: hh(d?.horario_fim, hh(t?.horario_fim, "23:59")),
        });
      }
    } else if (encontros.length) {
      for (const e of encontros) {
        const y = ymd(typeof e === "string" ? e : e?.data);
        if (!y) continue;
        ocorrencias.push({
          data: y,
          horario_inicio: hh(e?.inicio || e?.horario_inicio, hh(t?.horario_inicio, "00:00")),
          horario_fim: hh(e?.fim || e?.horario_fim, hh(t?.horario_fim, "23:59")),
        });
      }
    }

    out.push({
      id: t?.id,
      titulo: t?.evento?.nome || t?.evento?.titulo || t?.nome || parentEvt?.titulo || "Turma",
      data_inicio: t?.data_inicio || parentEvt?.data_inicio,
      data_fim: t?.data_fim || parentEvt?.data_fim,
      horario_inicio: t?.horario_inicio || parentEvt?.horario_inicio,
      horario_fim: t?.horario_fim || parentEvt?.horario_fim,
      local: parentEvt?.local || t?.local || t?.evento?.local || null,
      instrutores: parentEvt?.instrutores || t?.instrutores || [],
      ocorrencias,
      _turma: t,
    });
  };

  for (const item of arr) {
    if (!item) continue;

    if (Array.isArray(item?.turmas) && item.turmas.length) {
      const parentEvt = {
        titulo: item?.titulo || item?.nome,
        local: item?.local || null,
        instrutores: Array.isArray(item?.instrutores) ? item.instrutores : [],
        data_inicio: item?.data_inicio,
        data_fim: item?.data_fim,
        horario_inicio: item?.horario_inicio,
        horario_fim: item?.horario_fim,
      };
      for (const t of item.turmas) fromTurma(t, parentEvt);
      continue;
    }

    if (item?.datas || item?.encontros || item?.evento) {
      fromTurma(item);
      continue;
    }

    const ocorrencias = [];
    const lista = Array.isArray(item?.ocorrencias) ? item.ocorrencias : Array.isArray(item?.datas) ? item.datas : [];
    for (const d of lista) {
      const y = ymd(d?.data || d);
      if (!y) continue;
      ocorrencias.push({
        data: y,
        horario_inicio: hh(d?.horario_inicio, hh(item?.horario_inicio, "00:00")),
        horario_fim: hh(d?.horario_fim, hh(item?.horario_fim, "23:59")),
      });
    }
    out.push({
      id: item?.id,
      titulo: item?.titulo || item?.nome || "Evento",
      data_inicio: item?.data_inicio,
      data_fim: item?.data_fim,
      horario_inicio: item?.horario_inicio,
      horario_fim: item?.horario_fim,
      local: item?.local || null,
      instrutores: Array.isArray(item?.instrutores) ? item.instrutores : [],
      ocorrencias,
      _raw: item,
    });
  }
  return out;
}

/* ───────── Página ───────── */
export default function AgendaInstrutor() {
  const usuario = (() => { try { return JSON.parse(localStorage.getItem("usuario") || "{}"); } catch { return {}; } })();
  const nome = usuario?.nome || "";

  const [events, setEvents] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const liveRef = useRef(null);

  async function carregar() {
    setCarregando(true);
    setErro("");
    if (liveRef.current) liveRef.current.textContent = "Carregando sua agenda…";

    const endpoints = [
      "/api/agenda/instrutor/agenda",
      "/api/agenda/instrutor",
      "/agenda/instrutor",
      "/api/agenda/minha-instrutor",
    ];

    try {
      let norm = [];
      for (const url of endpoints) {
        try {
          const data = await apiGet(url, { on401: "silent", on403: "silent" });
          const n = normalizeFromAPI(data);
          if (n.length) { norm = n; break; }
          if (Array.isArray(data) && data.length) { norm = normalizeFromAPI(data); break; }
        } catch { /* tenta o próximo */ }
      }

      setEvents(norm);
      if (liveRef.current) {
        liveRef.current.textContent = norm.length ? `Agenda carregada: ${norm.length} item(ns).` : "Nenhum evento/encontro localizado.";
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

  useEffect(() => { carregar(); }, []);

  const eventosPorData = useMemo(() => {
    const map = {};
    for (const ev of events) {
      const occ = Array.isArray(ev.ocorrencias) ? ev.ocorrencias : [];
      const dias = occ.length > 0 ? occ.map((o) => ymd(o?.data || o)).filter(Boolean)
                                  : rangeDiasYMD(ymd(ev.data_inicio), ymd(ev.data_fim));
      for (const dia of dias) (map[dia] ||= []).push(ev);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => {
        const aStart = toLocalDate(`${ymd(a.data_inicio || k)}T${hh(a.horario_inicio, "00:00")}`);
        const bStart = toLocalDate(`${ymd(b.data_inicio || k)}T${hh(b.horario_inicio, "00:00")}`);
        if (!aStart || !bStart) return 0;
        return compareAsc(aStart, bStart);
      });
    }
    return map;
  }, [events]);

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

  return (
    <>
      <HeaderHero onRefresh={carregar} carregando={carregando} nome={nome} />

      <main className="min-h-screen bg-gelo dark:bg-gray-900 px-3 sm:px-4 py-6 text-gray-900 dark:text-white">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <MiniStat value={stats.programados} label="Programados" color="#22c55e" />
          <MiniStat value={stats.andamento}   label="Em andamento" color="#eab308" />
          <MiniStat value={stats.realizados}  label="Realizados"  color="#ef4444" />
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
                tileClassName="!rounded-lg hover:!bg-gray-200 dark:hover:!bg-zinc-700 focus:!ring-2 focus:!ring-cyan-600"
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
                      {visiveis.map((ev, idx) => (
                        <DiaBadge
                          key={`${ev.id ?? ev.titulo}-${key}-${idx}`}
                          evento={ev}
                          onClick={() => setSelecionado(ev)}
                        />
                      ))}
                      {resto > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelecionado(lista[0])}
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-cyan-700 bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
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
      </main>

      {selecionado && (
        <EventoDetalheModal
          evento={selecionado}
          aoFechar={() => setSelecionado(null)}
          visivel
        />
      )}

      <Footer />
    </>
  );
}
