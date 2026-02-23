// ✅ src/pages/AgendaSalasUsuario.jsx — versão premium (mobile-first, a11y, dark-mode)
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Users,
  Info,
  Pencil,
  Trash2,
  Sparkles,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "react-toastify";
import api from "../services/api";
import Footer from "../components/Footer";
import ModalSolicitarReserva from "../components/ModalSolicitarReserva";
import ModalConfirmacao from "../components/ModalConfirmacao";

/* ───────── Constantes ───────── */
const NOMES_MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const SALAS = [
  { value: "sala_reuniao", label: "Sala de Reunião", conforto: 25, max: 30 },
  { value: "auditorio",    label: "Auditório",       conforto: 50, max: 60 },
];

const PERIODOS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
];

/* ───────── Helpers de datas ───────── */
function criarMatrixMes(ano, mesIndex) {
  const primeiroDia = new Date(ano, mesIndex, 1);
  const ultimoDia   = new Date(ano, mesIndex + 1, 0);
  const primeiroDiaSemana = primeiroDia.getDay(); // 0 = dom
  const diasNoMes = ultimoDia.getDate();
  const semanas = [];
  let semanaAtual = new Array(7).fill(null);
  let dia = 1;

  for (let i = 0; i < primeiroDiaSemana; i++) semanaAtual[i] = null;
  for (let i = primeiroDiaSemana; i < 7; i++) semanaAtual[i] = dia++;
  semanas.push(semanaAtual);

  while (dia <= diasNoMes) {
    const novaSemana = new Array(7).fill(null);
    for (let i = 0; i < 7 && dia <= diasNoMes; i++) novaSemana[i] = dia++;
    semanas.push(novaSemana);
  }
  return semanas;
}
function formatISO(ano, mesIndex, dia) {
  const m = String(mesIndex + 1).padStart(2, "0");
  const d = String(dia).padStart(2, "0");
  return `${ano}-${m}-${d}`;
}
function getHojeISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* ───────── Página ───────── */
function AgendaSalasUsuario() {
  const hojeDate = new Date();
  const [ano, setAno] = useState(hojeDate.getFullYear());
  const [mesIndex, setMesIndex] = useState(hojeDate.getMonth());
  const [hojeISO] = useState(() => getHojeISO());

  const [loading, setLoading] = useState(false);
  /**
   * reservasMap:
   * {
   *   "2025-12-17": {
   *      auditorio: { manha: reserva, tarde: reserva },
   *      sala_reuniao: { manha: reserva, tarde: reserva }
   *   },
   *   ...
   * Obs: rota /salas/agenda-usuario → somente reservas do usuário logado.
   */
  const [reservasMap, setReservasMap] = useState({});
  const [feriadosMap, setFeriadosMap] = useState({});
  const [datasBloqueadasMap, setDatasBloqueadasMap] = useState({});
  const [modalAberto, setModalAberto] = useState(false);
  const [slotSelecionado, setSlotSelecionado] = useState(null); // { dataISO, periodo, sala }
  const [modalModo, setModalModo] = useState("criar"); // 'criar' | 'editar'
  const [reservaEmEdicao, setReservaEmEdicao] = useState(null);

  // ✅ confirmação premium  + loading de exclusão
  const [confirmDelete, setConfirmDelete] = useState({ open: false, reserva: null });
  const [deletingId, setDeletingId] = useState(null);

  const semanas = useMemo(() => criarMatrixMes(ano, mesIndex), [ano, mesIndex]);
  const liveRef = useRef(null);

  // atalhos ← →
  const handleKeyNav = useCallback((e) => {
    if (e.key === "ArrowLeft") mudarMes(-1);
    if (e.key === "ArrowRight") mudarMes(1);
  }, [mesIndex, ano]);
  useEffect(() => {
    window.addEventListener("keydown", handleKeyNav);
    return () => window.removeEventListener("keydown", handleKeyNav);
  }, [handleKeyNav]);

  useEffect(() => {
    carregarAgenda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mesIndex]);

  async function carregarAgenda() {
    try {
      setLoading(true);
      if (liveRef.current) liveRef.current.textContent = "Carregando sua agenda…";

      const resp = await api.get("/salas/agenda-usuario", {
        params: { ano, mes: mesIndex + 1 },
      });
      const data = resp?.data ?? resp ?? {};

      const map = {};
      for (const r of data.reservas || []) {
        const dataISO = (r.data || "").slice(0, 10);
        const salaKey = r.sala;
        const periodoKey = r.periodo;
        if (!dataISO || !salaKey || !periodoKey) continue;
        (map[dataISO] ??= {});
        (map[dataISO][salaKey] ??= {});
        map[dataISO][salaKey][periodoKey] = r;
      }

      const ferMap = {};
      for (const f of data.feriados || []) {
        const y = (f.data || "").slice(0, 10);
        if (y) ferMap[y] = f;
      }
      const blkMap = {};
      for (const b of data.datas_bloqueadas || []) {
        const y = (b.data || "").slice(0, 10);
        if (y) blkMap[y] = b;
      }

      setReservasMap(map);
      setFeriadosMap(ferMap);
      setDatasBloqueadasMap(blkMap);

      if (liveRef.current) {
        const qtd = Object.values(map).reduce((acc, salas) => {
          for (const s of Object.values(salas)) for (const r of Object.values(s)) acc += r ? 1 : 0;
          return acc;
        }, 0);
        liveRef.current.textContent = `Agenda carregada: ${qtd} item(ns).`;
      }
    } catch (err) {
      console.error("[AgendaSalasUsuario] Erro ao carregar agenda:", err);
      toast.error("Erro ao carregar disponibilidade das salas.");
      if (liveRef.current) liveRef.current.textContent = "Falha ao carregar sua agenda.";
    } finally {
      setLoading(false);
    }
  }

  function mudarMes(delta) {
    let novoMes = mesIndex + delta;
    let novoAno = ano;
    if (novoMes < 0) { novoMes = 11; novoAno--; }
    else if (novoMes > 11) { novoMes = 0; novoAno++; }
    setMesIndex(novoMes);
    setAno(novoAno);
  }
  function hojeClick() {
    const d = new Date();
    setAno(d.getFullYear());
    setMesIndex(d.getMonth());
  }

  function abrirModalSlot(dia, salaValue, periodo) {
    if (!dia) return;
    const dataISO = formatISO(ano, mesIndex, dia);
    const status = getStatusSlot(salaValue, dataISO, periodo);
    if (status !== "livre") {
      toast.info("Este horário não está disponível para agendamento.");
      return;
    }
    setSlotSelecionado({ dataISO, periodo, sala: salaValue });
    setReservaEmEdicao(null);
    setModalModo("criar");
    setModalAberto(true);
  }
  function fecharModal() {
    setModalAberto(false);
    setSlotSelecionado(null);
    setReservaEmEdicao(null);
  }

  /**
   * getStatusSlot
   * - "oculto": não aparece (fds, feriado, bloqueada, uso interno)
   * - "livre": disponível para solicitar
   * - "minha_solicitacao_pendente": solicitação do usuário em análise
   * - "minha_reserva_aprovada": reserva do usuário aprovada/confirmada
   */
  function getStatusSlot(salaValue, dataISO, periodo) {
    const d = new Date(dataISO + "T12:00:00");
    const diaSemana = d.getDay(); // 0 dom, 6 sáb
    const ehFeriado   = !!feriadosMap[dataISO];
    const ehBloqueada = !!datasBloqueadasMap[dataISO];
    if (diaSemana === 0 || diaSemana === 6 || ehFeriado || ehBloqueada) return "oculto";

    const reserva = reservasMap[dataISO]?.[salaValue]?.[periodo] || null;
if (!reserva) return "livre";

// ✅ se existe reserva e NÃO é minha, o usuário deve ver como BLOQUEADO
if (reserva && reserva.minha === false) return "bloqueado_por_outro";

if (reserva.status === "bloqueado") return "oculto";
if (reserva.status === "cancelado" || reserva.status === "rejeitado") return "livre";

if (["pendente","em_analise","solicitado"].includes(reserva.status)) return "minha_solicitacao_pendente";
if (["aprovado","confirmado"].includes(reserva.status)) return "minha_reserva_aprovada";
return "minha_solicitacao_pendente";
  }
  function getReservaDoSlot(salaValue, dataISO, periodo) {
    return reservasMap[dataISO]?.[salaValue]?.[periodo] || null;
  }

  function classesStatus(status) {
    switch (status) {
      case "minha_solicitacao_pendente":
        return "bg-amber-50 text-amber-700 border border-amber-200 cursor-default";
      case "minha_reserva_aprovada":
        return "bg-sky-50 text-sky-700 border border-sky-200 cursor-default";
      case "bloqueado_por_outro":
        return "bg-zinc-50 text-zinc-600 border border-zinc-200 cursor-not-allowed dark:bg-zinc-800/70 dark:text-zinc-200 dark:border-zinc-700";
      case "livre":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100";
      case "oculto":
      default:
        return "";
    }
  }

  // ações em pendentes
  function iniciarEdicao(reserva) {
    setModalModo("editar");
    setReservaEmEdicao(reserva);
    setSlotSelecionado({
      dataISO: (reserva.data || "").slice(0, 10),
      periodo: reserva.periodo,
      sala: reserva.sala,
    });
    setModalAberto(true);
  }

  // ✅ abrir confirmação
  function solicitarExcluirReserva(reserva) {
    if (!reserva?.id) return;
    if (deletingId) return;
    setConfirmDelete({ open: true, reserva });
  }

  // ✅ executar exclusão (chamado pelo ModalConfirmacao)
  async function executarExcluirReserva() {
    const reserva = confirmDelete?.reserva;
    if (!reserva?.id) {
      setConfirmDelete({ open: false, reserva: null });
      return;
    }

    try {
      setDeletingId(reserva.id);
      await api.delete(`/salas/minhas/${reserva.id}`);
      toast.success("Solicitação excluída com sucesso.");
      await carregarAgenda();
    } catch (err) {
      console.error("[excluirReserva] erro:", err);
      const msg = err?.response?.data?.erro || "Não foi possível excluir a solicitação.";
      toast.error(msg);
    } finally {
      setDeletingId(null);
      setConfirmDelete({ open: false, reserva: null });
    }
  }

  /* ───────── Ministats (minhas métricas do mês) ───────── */
  const minhasPendentes = useMemo(() => {
    let n = 0;
    for (const salas of Object.values(reservasMap)) {
      for (const s of Object.values(salas))
        for (const r of Object.values(s))
          if (r && ["pendente","em_analise","solicitado"].includes(r.status)) n++;
    }
    return n;
  }, [reservasMap]);

  const minhasAprovadas = useMemo(() => {
    let n = 0;
    for (const salas of Object.values(reservasMap)) {
      for (const s of Object.values(salas))
        for (const r of Object.values(s))
          if (r && ["aprovado","confirmado"].includes(r.status)) n++;
    }
    return n;
  }, [reservasMap]);

  /* ───────── Render ───────── */
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950 text-gray-900 dark:text-gray-100">
      {/* HeaderHero */}
      <header className="bg-gradient-to-br from-sky-700 via-indigo-600 to-blue-700 text-white shadow-lg" role="banner">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2">
          Ir para o conteúdo
        </a>

        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-3 bg-white/10 rounded-2xl">
                <CalendarDays className="w-7 h-7 sm:w-8 sm:h-8" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Agendamento de Salas</h1>
                <p className="text-sm sm:text-base text-sky-50/90">
                  Você visualiza **apenas** horários livres e **suas** solicitações (manhã e tarde) no Auditório e na Sala de Reunião.
                </p>
              </div>
            </div>

            {/* Ministats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SALAS.slice(0,2).map((s) => (
                <div key={s.value} className="bg-white/10 rounded-2xl px-3 py-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{s.label}</span>
                  </div>
                  <p className="mt-1 font-semibold">{s.conforto} / {s.max} máx.</p>
                </div>
              ))}
              <div className="bg-white/10 rounded-2xl px-3 py-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Minhas</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug">
                  <strong>Pendentes:</strong> {loading ? "—" : minhasPendentes}<br />
                  <strong>Aprovadas:</strong> {loading ? "—" : minhasAprovadas}
                </p>
              </div>
            </div>
          </div>

          {/* Regras resumidas */}
          <div className="mt-4 rounded-2xl bg-white/10 px-3 py-2 text-xs sm:text-sm max-w-3xl">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              <span>Regras</span>
            </div>
            <p className="mt-1 text-[11px] sm:text-xs leading-snug text-sky-50/90">
              Finais de semana, feriados, datas bloqueadas e reservas internas **não aparecem**.
              Você pode criar solicitação apenas nos slots **livres**.
            </p>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main id="conteudo" className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 sm:py-8">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {/* Barra de controles (sticky) */}
        <div className="sticky top-0 z-10 -mx-4 px-4 py-3 mb-4 bg-gradient-to-b from-white/85 to-white/60 dark:from-gray-950/80 dark:to-gray-950/40 backdrop-blur border-b border-white/50 dark:border-gray-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button
                className="p-2 rounded-full bg-white shadow hover:bg-slate-50 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                onClick={() => mudarMes(-1)}
                aria-label="Mês anterior"
                title="Mês anterior (atalho ←)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-center">
                <p className="text-xs text-slate-500 dark:text-slate-300">Mês</p>
                <p className="text-base sm:text-lg font-semibold text-slate-800 dark:text-white">
                  {NOMES_MESES[mesIndex]} {ano}
                </p>
              </div>
              <button
                className="p-2 rounded-full bg-white shadow hover:bg-slate-50 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                onClick={() => mudarMes(1)}
                aria-label="Próximo mês"
                title="Próximo mês (atalho →)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                className="ml-2 px-3 py-1.5 rounded-xl text-xs bg-sky-600 hover:bg-sky-700 text-white"
                onClick={hojeClick}
                aria-label="Ir para o mês atual"
              >
                Hoje
              </button>
            </div>

            {loading && (
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <Skeleton width={80} height={20} />
              </div>
            )}
          </div>
        </div>

        {/* Legenda */}
        <div className="mb-4 flex flex-wrap gap-2 text-xs sm:text-sm">
  <span className="inline-flex items-center gap-1">
    <span className="w-3 h-3 rounded-full bg-emerald-50 border border-emerald-200" /> Disponível para solicitar
  </span>
  <span className="inline-flex items-center gap-1">
    <span className="w-3 h-3 rounded-full bg-amber-50 border border-amber-200" /> Minha solicitação (em análise)
  </span>
  <span className="inline-flex items-center gap-1">
    <span className="w-3 h-3 rounded-full bg-sky-50 border border-sky-200" /> Minha reserva aprovada
  </span>

  {/* ✅ novo */}
  <span className="inline-flex items-center gap-1">
    <span className="w-3 h-3 rounded-full bg-zinc-50 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700" />
    Ocupado/Bloqueado
  </span>
</div>

        {/* Calendário */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-50 dark:bg-zinc-800 border-b border-slate-100 dark:border-zinc-800 text-xs sm:text-sm">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="py-2 text-center font-medium text-slate-600 dark:text-slate-200 uppercase">{d}</div>
            ))}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
            {semanas.map((semana, idxSemana) => (
              <div key={idxSemana} className="grid grid-cols-7">
                {semana.map((dia, idxDia) => {
                  if (!dia) {
                    return (
                      <div key={idxDia} className="min-h-[120px] sm:min-h-[140px] border-r border-slate-100 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/40" />
                    );
                  }

                  const dataISO = formatISO(ano, mesIndex, dia);
                  const eHoje = dataISO === hojeISO;

                  const d = new Date(dataISO + "T12:00:00");
                  const diaSemana = d.getDay(); // 0 dom, 6 sáb
                  const ehFeriado   = !!feriadosMap[dataISO];
                  const ehBloqueada = !!datasBloqueadasMap[dataISO];
                  const ehFimDeSemana = diaSemana === 0 || diaSemana === 6;
                  const diaIndisponivelGeral = ehFimDeSemana || ehFeriado || ehBloqueada;

                  if (diaIndisponivelGeral) {
                    return (
                      <div
                        key={idxDia}
                        className="min-h-[120px] sm:min-h-[140px] border-r border-slate-100 dark:border-zinc-800 p-1.5 sm:p-2 flex flex-col bg-slate-50/40 dark:bg-zinc-900/30"
                        title="Dia indisponível"
                        aria-label="Dia indisponível para agendamento"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs sm:text-sm font-semibold ${eHoje ? "text-sky-600 dark:text-sky-400" : "text-slate-500 dark:text-slate-400"}`}>
                            {dia}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idxDia}
                      className="min-h-[130px] sm:min-h-[160px] border-r border-slate-100 dark:border-zinc-800 p-1.5 sm:p-2 flex flex-col"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs sm:text-sm font-semibold ${eHoje ? "text-sky-600 dark:text-sky-400" : "text-slate-700 dark:text-slate-200"}`}>
                          {dia}
                        </span>
                      </div>

                      {/* Salas → caixinhas separadas p/ Manhã e Tarde */}
                      <div className="flex flex-col gap-2 mt-auto">
                        {SALAS.map((salaItem) => (
                          <div
                            key={salaItem.value}
                            className="rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/60 shadow-sm px-1.5 py-1"
                          >
                            <p className="text-[11px] font-bold tracking-wide text-slate-700 dark:text-zinc-200 text-center mb-1">
                              {salaItem.label}
                            </p>

                            <div className="grid grid-cols-1 gap-1.5">
                              {PERIODOS.map((p) => {
                                const status = getStatusSlot(salaItem.value, dataISO, p.value);
                                if (status === "oculto") {
                                  return (
                                    <div key={p.value} className="w-full px-2 py-2 rounded-xl opacity-0 pointer-events-none">
                                      placeholder
                                    </div>
                                  );
                                }

                                const reserva = getReservaDoSlot(salaItem.value, dataISO, p.value);

                                if (status === "minha_solicitacao_pendente" && reserva) {
                                  const disabledDelete = deletingId === reserva.id;

                                  return (
                                    <div
                                      key={p.value}
                                      className="w-full px-2 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-[11px] sm:text-xs"
                                      aria-label={`${salaItem.label}, ${p.label}, minha solicitação em análise`}
                                      title="Minha solicitação (em análise)"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="font-semibold shrink-0 px-1.5 py-0.5 rounded-md bg-white/60 text-slate-800 border border-white/70">
                                          {p.label}
                                        </span>
                                        <span className="text-[10px] leading-snug break-words whitespace-normal flex-1 text-right">
                                          {String(reserva.finalidade || "—").trim()}
                                        </span>
                                      </div>
                                      <div className="mt-1 flex items-center justify-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => iniciarEdicao(reserva)}
                                          className="inline-flex items-center justify-center p-1.5 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300"
                                          title="Editar solicitação"
                                          aria-label="Editar solicitação"
                                        >
                                          <Pencil className="w-4 h-4" />
                                          <span className="sr-only">Editar</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => solicitarExcluirReserva(reserva)}
                                          disabled={disabledDelete}
                                          className="inline-flex items-center justify-center p-1.5 rounded-md border border-red-300 text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-60 disabled:cursor-not-allowed"
                                          title="Excluir solicitação"
                                          aria-label="Excluir solicitação"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                          <span className="sr-only">Excluir</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                }

                                if (status === "minha_reserva_aprovada" && reserva) {
                                  return (
                                    <div
                                      key={p.value}
                                      className="w-full px-2 py-2 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 text-[11px] sm:text-xs"
                                      aria-label={`${salaItem.label}, ${p.label}, minha reserva aprovada`}
                                      title="Minha reserva aprovada"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="font-semibold shrink-0 px-1.5 py-0.5 rounded-md bg-white/60 text-slate-800 border border-white/70">
                                          {p.label}
                                        </span>
                                        <span className="text-[10px] leading-snug break-words whitespace-normal flex-1 text-right">
                                          {String(reserva.finalidade || "—").trim()}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }

                                // ✅ NOVO: reserva de outro usuário → mostrar como bloqueado (sem clique)
if (status === "bloqueado_por_outro") {
  return (
    <div
      key={p.value}
      className={`w-full text-left text-[11px] sm:text-xs px-2 py-2 rounded-xl flex items-center justify-between gap-2 ${classesStatus(status)}`}
      aria-label={`${salaItem.label}, ${p.label}, horário indisponível`}
      title={`${salaItem.label} • ${p.label} • Indisponível`}
    >
      <span className="font-semibold shrink-0 px-1.5 py-0.5 rounded-md bg-white/60 text-slate-800 border border-white/70 dark:bg-zinc-900/50 dark:text-zinc-100 dark:border-zinc-700">
        {p.label}
      </span>
      <span className="text-[10px] truncate">Indisponível</span>
    </div>
  );
}

return (
  <button
    key={p.value}
    type="button"
    onClick={() => abrirModalSlot(dia, salaItem.value, p.value)}
    className={`w-full text-left text-[11px] sm:text-xs px-2 py-2 rounded-xl flex items-center justify-between gap-2 transition ${classesStatus(status)} focus:outline-none focus:ring-2 focus:ring-sky-500/60`}
    aria-label={`${salaItem.label}, ${p.label}, disponível para solicitar`}
    title={`${salaItem.label} • ${p.label} • Disponível`}
  >
    <span className="font-semibold shrink-0 px-1.5 py-0.5 rounded-md bg-white/60 text-slate-800 border border-white/70">
      {p.label}
    </span>
    <span className="text-[10px] truncate">Disponível</span>
  </button>
);
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />

      {modalAberto && (
        <ModalSolicitarReserva
          onClose={fecharModal}
          recarregar={carregarAgenda}
          // criação
          slot={modalModo === "criar" ? slotSelecionado : null}
          sala={(modalModo === "criar" && slotSelecionado?.sala) || (modalModo === "editar" && reservaEmEdicao?.sala) || null}
          capacidadeSala={
            SALAS.find(
              (s) => s.value === ((modalModo === "criar" ? slotSelecionado?.sala : reservaEmEdicao?.sala) || "")
            ) || { conforto: 0, max: 0 }
          }
          // edição
          modo={modalModo}               // 'criar' | 'editar'
          reservaAtual={reservaEmEdicao} // objeto da reserva ao editar
        />
      )}

      {/* ✅ ModalConfirmacao: excluir solicitação */}
      <ModalConfirmacao
        isOpen={!!confirmDelete.open}
        title="Excluir solicitação?"
        description={
          confirmDelete?.reserva
            ? `Confirmar exclusão da sua solicitação de reserva?\n\n${String(confirmDelete.reserva.finalidade || "Sem finalidade").trim()}`
            : "Confirmar exclusão desta solicitação?"
        }
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        danger
        loading={!!deletingId}
        onClose={() => {
          if (deletingId) return;
          setConfirmDelete({ open: false, reserva: null });
        }}
        onConfirm={executarExcluirReserva}
      />
    </div>
  );
}

export default AgendaSalasUsuario;
