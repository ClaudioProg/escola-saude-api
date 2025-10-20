// 📁 src/pages/AgendamentoSala.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import Footer from "../components/Footer";
import {
  CalendarDays, Plus, X, Loader2, CheckCircle2, Clock3, Building2, Users,
  Info, CalendarCheck2, AlertCircle, Search, Filter, ChevronDown, ChevronUp,
} from "lucide-react";
import { apiGet, apiPost } from "../services/api";

/* =========================================================================
   HeaderHero padronizado (altura/tipografia iguais nas páginas)
   - Paleta exclusiva (3 cores) desta página: marrom/âmbar (stone + amber)
   ========================================================================= */
function HeaderHero() {
  const gradient = "from-stone-900 via-stone-800 to-amber-900";
  return (
    <header className={`bg-gradient-to-br ${gradient} text-white`} role="banner">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 min-h-[136px] flex items-center justify-center">
        <div className="w-full text-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <CalendarDays className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight text-balance break-words">
              Agendamento de Sala
            </h1>
          </div>
          <p className="mt-2 text-sm sm:text-base text-white/90 max-w-3xl mx-auto text-balance">
            Visualize datas disponíveis e solicite o uso das salas (sujeito à aprovação).
          </p>
        </div>
      </div>
    </header>
  );
}

/* =========================================================================
   Primitivos de UI
   ========================================================================= */
function Card({ children, className = "", ...rest }) {
  return (
    <div
      className={
        "rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur border border-black/5 dark:border-white/10 shadow-sm " +
        className
      }
      {...rest}
    >
      {children}
    </div>
  );
}

function Chip({ children, tone = "default" }) {
  const tones = {
    default: "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200",
    verde: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",   // aprovado/programado
    amarelo: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",     // pendente
    vermelho: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",                // indeferido/indisponível
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${tones[tone] ?? tones.default}`}>
      {children}
    </span>
  );
}

function MiniStat({ icon: Icon, label, value, hint, loading = false }) {
  return (
    <div
      className="rounded-xl p-4 bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 shadow-sm flex items-start gap-3"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-lg p-2 bg-stone-100 dark:bg-zinc-800">
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        ) : (
          <Icon className="w-5 h-5" aria-hidden="true" />
        )}
      </div>
      <div className="flex-1">
        <div className="text-xs text-slate-600 dark:text-slate-300">{label}</div>
        <div className="text-xl font-semibold leading-tight">{loading ? "—" : value}</div>
        {hint && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}

/* =========================================================================
   Modal acessível (ESC/overlay fecham, foco no título)
   ========================================================================= */
function Modal({ open, title, onClose, children, labelledById = "modal-title" }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && dialogRef.current) {
      const h = dialogRef.current.querySelector("h2");
      if (h) h.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={labelledById}>
      <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-label="Fechar modal" onClick={onClose} />
      <div className="min-h-full flex items-end sm:items-center justify-center p-3 sm:p-6">
        <div ref={dialogRef} className="w-full sm:max-w-2xl outline-none">
          <Card className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 id={labelledById} tabIndex={-1} className="text-lg sm:text-xl font-bold tracking-tight">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10 transition"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4">{children}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Formulário Nova Reserva (mobile-first + a11y)
   ========================================================================= */
function FormNovaReserva({ salas, onSubmit, submitting }) {
  const [salaId, setSalaId] = useState(salas[0]?.id ?? "");
  const [data, setData] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [finalidade, setFinalidade] = useState("");
  const [participantes, setParticipantes] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.({
      sala_id: salaId,
      data,           // "YYYY-MM-DD"
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      finalidade,
      participantes,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <label htmlFor="sala" className="text-sm font-medium">Sala</label>
        <select
          id="sala"
          className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
          value={salaId}
          onChange={(e) => setSalaId(e.target.value)}
          required
        >
          {salas.map((s) => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </select>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="grid gap-2">
          <label htmlFor="data" className="text-sm font-medium">Data</label>
          <input
            id="data"
            type="date"
            className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="inicio" className="text-sm font-medium">Início</label>
          <input
            id="inicio"
            type="time"
            className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="fim" className="text-sm font-medium">Fim</label>
          <input
            id="fim"
            type="time"
            className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
            value={horaFim}
            onChange={(e) => setHoraFim(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor="finalidade" className="text-sm font-medium">Finalidade</label>
        <input
          id="finalidade"
          type="text"
          className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
          placeholder="Ex.: Reunião pedagógica / Aula / Simulação clínica"
          value={finalidade}
          onChange={(e) => setFinalidade(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="participantes" className="text-sm font-medium">Participantes (estimativa)</label>
        <input
          id="participantes"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
          placeholder="Ex.: 25"
          value={participantes}
          onChange={(e) => setParticipantes(e.target.value)}
          required
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-70"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Enviar solicitação
        </button>
      </div>
    </form>
  );
}

/* =========================================================================
   Legenda do calendário/estados
   ========================================================================= */
function CalendarioLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-slate-500 dark:text-slate-400">Legenda:</span>
      <Chip tone="verde">Disponível/Aprovada</Chip>
      <Chip tone="amarelo">Pendente</Chip>
      <Chip tone="vermelho">Indisponível/Indeferida</Chip>
    </div>
  );
}

/* =========================================================================
   Cards (mobile) + Tabela (desktop) das próximas reservas
   ========================================================================= */
function ListaReservas({ reservas }) {
  return (
    <>
      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {reservas.map((r) => (
          <div key={r.id} className="rounded-xl p-4 bg-white dark:bg-zinc-800 border border-black/5 dark:border-white/10">
            <div className="text-sm text-slate-600 dark:text-slate-300">{r.data} — {r.hora_inicio}–{r.hora_fim}</div>
            <div className="font-medium">{r.sala_nome}</div>
            <div className="text-sm break-words">{r.finalidade}</div>
            <div className="mt-2">
              {r.status === "aprovada" && <Chip tone="verde">Aprovada</Chip>}
              {r.status === "pendente" && <Chip tone="amarelo">Pendente</Chip>}
              {r.status === "indeferida" && <Chip tone="vermelho">Indeferida</Chip>}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Tabela */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left border-b border-black/10 dark:border-white/10">
              <th className="py-3 pr-3 font-semibold">Data</th>
              <th className="py-3 pr-3 font-semibold">Horário</th>
              <th className="py-3 pr-3 font-semibold">Sala</th>
              <th className="py-3 pr-3 font-semibold">Finalidade</th>
              <th className="py-3 pr-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {reservas.map((r) => (
              <tr key={r.id} className="border-b last:border-b-0 border-black/5 dark:border-white/5">
                <td className="py-3 pr-3 whitespace-nowrap">{r.data}</td>
                <td className="py-3 pr-3 whitespace-nowrap">{r.hora_inicio}–{r.hora_fim}</td>
                <td className="py-3 pr-3">{r.sala_nome}</td>
                <td className="py-3 pr-3 break-words">{r.finalidade}</td>
                <td className="py-3 pr-3">
                  {r.status === "aprovada" && <Chip tone="verde">Aprovada</Chip>}
                  {r.status === "pendente" && <Chip tone="amarelo">Pendente</Chip>}
                  {r.status === "indeferida" && <Chip tone="vermelho">Indeferida</Chip>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* =========================================================================
   Barra de filtros (busca, sala, data, status) — não remove info, só organiza
   ========================================================================= */
function FiltroReservas({ salas, filtros, onChange, onClear }) {
  const [aberta, setAberta] = useState(false);

  return (
    <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 p-3 sm:p-4">
      <button
        className="w-full sm:w-auto inline-flex items-center gap-2 text-sm font-medium rounded-lg px-3 py-2 bg-stone-100 dark:bg-zinc-800"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        aria-controls="filtros-conteudo"
      >
        <Filter className="w-4 h-4" /> Filtros
        {aberta ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      <div id="filtros-conteudo" className={`${aberta ? "mt-3 grid gap-3" : "hidden"}`}>
        <div className="grid md:grid-cols-4 gap-3">
          <div className="relative">
            <label htmlFor="busca" className="sr-only">Buscar</label>
            <input
              id="busca"
              type="text"
              value={filtros.busca}
              onChange={(e) => onChange({ ...filtros, busca: e.target.value })}
              placeholder="Buscar por finalidade ou sala"
              className="w-full rounded-xl border px-9 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
            />
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" aria-hidden="true" />
          </div>

          <div className="grid">
            <label htmlFor="sala" className="sr-only">Sala</label>
            <select
              id="sala"
              value={filtros.salaId}
              onChange={(e) => onChange({ ...filtros, salaId: e.target.value })}
              className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
            >
              <option value="">Todas as salas</option>
              {salas.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>

          <div className="grid">
            <label htmlFor="dataIni" className="sr-only">Data inicial</label>
            <input
              id="dataIni"
              type="date"
              value={filtros.dataIni}
              onChange={(e) => onChange({ ...filtros, dataIni: e.target.value })}
              className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
            />
          </div>

          <div className="grid">
            <label htmlFor="dataFim" className="sr-only">Data final</label>
            <input
              id="dataFim"
              type="date"
              value={filtros.dataFim}
              onChange={(e) => onChange({ ...filtros, dataFim: e.target.value })}
              className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-3 mt-3">
          <div className="grid">
            <label htmlFor="status" className="sr-only">Status</label>
            <select
              id="status"
              value={filtros.status}
              onChange={(e) => onChange({ ...filtros, status: e.target.value })}
              className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
            >
              <option value="">Todos os status</option>
              <option value="aprovada">Aprovada</option>
              <option value="pendente">Pendente</option>
              <option value="indeferida">Indeferida</option>
            </select>
          </div>

          <div className="md:col-span-3 flex items-center justify-end">
            <button
              onClick={onClear}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-stone-100 dark:bg-zinc-800 text-sm"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Página
   ========================================================================= */
export default function AgendamentoSala() {
  // ======= Ministats =======
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState({
    salasDisponiveisHoje: 0,
    reservasHoje: 0,
    pendentes: 0,
    taxaOcupacao: 0, // %
  });

  // ======= Listas =======
  const [salas, setSalas] = useState([]);
  const [reservas, setReservas] = useState([]);

  // ======= Filtros/Paginação =======
  const [filtros, setFiltros] = useState({ busca: "", salaId: "", dataIni: "", dataFim: "", status: "" });
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // ======= Modal =======
  const [openModal, setOpenModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ======= Carregar métricas e dados =======
  const fetchAll = useCallback(async () => {
    setLoadingStats(true);
    try {
      // const m = await apiGet("/api/salas/metricas");
      // const s = await apiGet("/api/salas");
      // const r = await apiGet("/api/salas/reservas?proximas=1&limit=100");

      // Demo mode:
      const m = { ok: true, data: { salasDisponiveisHoje: 5, reservasHoje: 7, pendentes: 2, taxaOcupacao: 68 } };
      const s = {
        ok: true,
        data: [
          { id: "1", nome: "Sala 101 (Auditório)" },
          { id: "2", nome: "Sala 202 (Multiuso)" },
          { id: "3", nome: "Lab Simulação" },
        ],
      };
      const r = {
        ok: true,
        data: [
          { id: "r1", data: "2025-10-18", hora_inicio: "09:00", hora_fim: "11:00", sala_id: "1", sala_nome: "Sala 101 (Auditório)", finalidade: "Aula de Acolhimento", status: "aprovada" },
          { id: "r2", data: "2025-10-18", hora_inicio: "14:00", hora_fim: "16:00", sala_id: "2", sala_nome: "Sala 202 (Multiuso)", finalidade: "Reunião Pedagógica", status: "pendente" },
          { id: "r3", data: "2025-10-19", hora_inicio: "08:00", hora_fim: "10:00", sala_id: "3", sala_nome: "Lab Simulação", finalidade: "OSCE – Estações clínicas", status: "indeferida" },
        ],
      };

      if (m?.ok && m?.data) setStats(m.data);
      else setStats({ salasDisponiveisHoje: 5, reservasHoje: 7, pendentes: 2, taxaOcupacao: 68 });

      if (s?.ok && s?.data?.length) setSalas(s.data);
      else setSalas([{ id: "1", nome: "Sala 101 (Auditório)" }]);

      if (r?.ok && r?.data) setReservas(r.data);
      else setReservas([]);
    } catch {
      setStats({ salasDisponiveisHoje: 5, reservasHoje: 7, pendentes: 2, taxaOcupacao: 68 });
      setSalas([{ id: "1", nome: "Sala 101 (Auditório)" }]);
      setReservas([]);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ======= Derivados: filtro + paginação =======
  const reservasFiltradas = useMemo(() => {
    let out = [...reservas];
    if (filtros.busca.trim()) {
      const q = filtros.busca.toLowerCase();
      out = out.filter(r =>
        r.finalidade?.toLowerCase().includes(q) ||
        r.sala_nome?.toLowerCase().includes(q)
      );
    }
    if (filtros.salaId) out = out.filter(r => r.sala_id === filtros.salaId);
    if (filtros.status) out = out.filter(r => r.status === filtros.status);
    if (filtros.dataIni) out = out.filter(r => r.data >= filtros.dataIni);
    if (filtros.dataFim) out = out.filter(r => r.data <= filtros.dataFim);
    return out;
  }, [reservas, filtros]);

  const totalPages = Math.max(1, Math.ceil(reservasFiltradas.length / pageSize));
  const paginaAtual = Math.min(page, totalPages);
  const reservasPagina = useMemo(() => {
    const start = (paginaAtual - 1) * pageSize;
    return reservasFiltradas.slice(start, start + pageSize);
  }, [reservasFiltradas, paginaAtual]);

  // ======= Submit: nova reserva =======
  const handleSubmitReserva = async (payload) => {
    setSubmitting(true);
    try {
      const resp = await apiPost?.("/api/salas/reservas", payload);
      if (resp?.ok) {
        toast.success("Solicitação enviada para análise! 🎉");
        setOpenModal(false);
        fetchAll();
      } else {
        toast.info("Ambiente de demonstração: reserva simulada.");
        setOpenModal(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível solicitar a reserva.");
    } finally {
      setSubmitting(false);
    }
  };

  const clearFiltros = () => {
    setFiltros({ busca: "", salaId: "", dataIni: "", dataFim: "", status: "" });
    setPage(1);
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-neutral-900 text-black dark:text-white">
      <HeaderHero />

      <main id="conteudo" role="main" className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {/* ===================== Ministats ===================== */}
          <section aria-labelledby="metricas" className="mb-6 sm:mb-8">
            <h2 id="metricas" className="sr-only">Métricas de ocupação das salas</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <MiniStat
                icon={Building2}
                label="Salas livres (hoje)"
                value={stats.salasDisponiveisHoje}
                loading={loadingStats}
                hint="Janelas de uso imediato"
              />
              <MiniStat
                icon={CalendarCheck2}
                label="Reservas (hoje)"
                value={stats.reservasHoje}
                loading={loadingStats}
                hint="Agendamentos do dia"
              />
              <MiniStat
                icon={Clock3}
                label="Pendentes"
                value={stats.pendentes}
                loading={loadingStats}
                hint="Aguardando aprovação"
              />
              <MiniStat
                icon={Users}
                label="Taxa de ocupação"
                value={`${stats.taxaOcupacao}%`}
                loading={loadingStats}
                hint="Capacidade vs. uso"
              />
            </div>
          </section>

          {/* ===================== Conteúdo principal ===================== */}
          <section className="grid gap-4 sm:gap-6 md:grid-cols-5">
            {/* Coluna Esquerda */}
            <Card className="md:col-span-3 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5" aria-hidden="true" />
                  <h3 className="text-base sm:text-lg font-bold">Próximas reservas</h3>
                </div>
                <button
                  onClick={() => setOpenModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Nova reserva
                </button>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                Consulte abaixo os agendamentos mais próximos. Status seguem o padrão de cores da plataforma.
              </p>

              <div className="mt-4"><CalendarioLegend /></div>

              {/* Filtros */}
              <div className="mt-4">
                <FiltroReservas salas={salas} filtros={filtros} onChange={setFiltros} onClear={clearFiltros} />
              </div>

              {/* Lista (paginada) */}
              <div className="mt-4">
                {reservasPagina.length ? (
                  <ListaReservas reservas={reservasPagina} />
                ) : (
                  <div className="rounded-xl p-4 bg-stone-50 dark:bg-zinc-800/60 border border-black/5 dark:border-white/10 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" aria-hidden="true" />
                    <span className="text-sm">Nenhuma reserva para exibir.</span>
                  </div>
                )}
              </div>

              {/* Paginação simples */}
              {reservasFiltradas.length > pageSize && (
                <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Paginação de reservas">
                  <span className="text-slate-600 dark:text-slate-300">
                    Página {paginaAtual} de {totalPages} — {reservasFiltradas.length} itens
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={paginaAtual <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg px-3 py-2 bg-stone-100 dark:bg-zinc-800 disabled:opacity-60"
                    >
                      Anterior
                    </button>
                    <button
                      disabled={paginaAtual >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="rounded-lg px-3 py-2 bg-stone-100 dark:bg-zinc-800 disabled:opacity-60"
                    >
                      Próxima
                    </button>
                  </div>
                </nav>
              )}
            </Card>

            {/* Coluna Direita — sticky para aproveitar altura */}
            <Card className="md:col-span-2 p-5 sm:p-6 md:sticky md:top-4 h-fit">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5" aria-hidden="true" />
                <h3 className="text-base sm:text-lg font-bold">Regras e orientações</h3>
              </div>
              <ul className="mt-3 space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-700 text-white text-xs">1</span>
                  <div>
                    <div className="font-medium">Antecedência</div>
                    <div className="text-slate-600 dark:text-slate-300">
                      Envie a solicitação com ao menos <strong>5 dias úteis</strong>.
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-700 text-white text-xs">2</span>
                  <div>
                    <div className="font-medium">Critérios</div>
                    <div className="text-slate-600 dark:text-slate-300">
                      Priorização por agenda institucional, capacidade da sala e finalidade.
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-700 text-white text-xs">3</span>
                  <div>
                    <div className="font-medium">Confirmação</div>
                    <div className="text-slate-600 dark:text-slate-300">
                      A reserva só é válida após <strong>aprovação</strong> pela Escola.
                    </div>
                  </div>
                </li>
              </ul>
            </Card>
          </section>
        </div>
      </main>

      <Footer />

      {/* ===================== Modal: Nova Reserva ===================== */}
      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="Solicitar reserva de sala"
        labelledById="modal-nova-reserva-title"
      >
        <FormNovaReserva
          salas={salas.length ? salas : [{ id: "1", nome: "Sala 101 (Auditório)" }]}
          onSubmit={handleSubmitReserva}
          submitting={submitting}
        />
      </Modal>
    </div>
  );
}
