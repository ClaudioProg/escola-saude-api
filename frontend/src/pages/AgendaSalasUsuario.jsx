/* eslint-disable no-console */
// ✅ src/pages/AgendaSalasUsuario.jsx — PREMIUM CALENDÁRIO MENSAL USUÁRIO
// - Calendário mensal orientado ao DIA
// - Limite de navegação anual progressivo para o usuário:
//   • ano atual inteiro liberado
//   • em novembro, libera janeiro do próximo ano
//   • em dezembro, libera janeiro e fevereiro do próximo ano
//   • ao virar o ano, o novo ano inteiro passa a ficar liberado
// - Dias bloqueados em cinza
// - Dias sem horário disponível em lilás suave
// - Dias com disponibilidade em branco
// - Clique no dia abre modal:
//   • bloqueado
//   • sem horário disponível
//   • locais/turnos disponíveis para solicitar
//   • minhas solicitações/reservas do dia
// - Mantém ModalSolicitarReserva para criar/editar
// - Anti-fuso: sem new Date("YYYY-MM-DD")

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Users,
  Info,
  Sparkles,
  Lock,
  CheckCircle2,
  CalendarRange,
  X,
  ArrowRight,
  Pencil,
  Trash2,
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
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_SEMANA_LONGOS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const SALAS = [
  { value: "sala_reuniao", label: "Sala de Reunião", conforto: 25, max: 30 },
  { value: "auditorio", label: "Auditório", conforto: 50, max: 60 },
];

const PERIODOS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
];

/* ───────── Helpers date-only safe ───────── */
function pad2(n) {
  return String(n).padStart(2, "0");
}

function getHojeParts() {
  const now = new Date();
  return {
    ano: now.getFullYear(),
    mesIndex: now.getMonth(),
    dia: now.getDate(),
  };
}

function getHojeISO() {
  const { ano, mesIndex, dia } = getHojeParts();
  return `${ano}-${pad2(mesIndex + 1)}-${pad2(dia)}`;
}

function formatISO(ano, mesIndex, dia) {
  return `${ano}-${pad2(mesIndex + 1)}-${pad2(dia)}`;
}

function splitISO(dateISO) {
  const [y, m, d] = String(dateISO || "").split("-").map(Number);
  return {
    year: Number.isFinite(y) ? y : 0,
    month: Number.isFinite(m) ? m : 0,
    day: Number.isFinite(d) ? d : 0,
  };
}

function formatDataBR(dateISO) {
  const { year, month, day } = splitISO(dateISO);
  if (!year || !month || !day) return "—";
  return `${pad2(day)}/${pad2(month)}/${year}`;
}

function getDateFromISO(dateISO) {
  const { year, month, day } = splitISO(dateISO);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function getDayOfWeekFromISO(dateISO) {
  const d = getDateFromISO(dateISO);
  return d ? d.getDay() : 0;
}

function getDiaSemanaLongo(dateISO) {
  return DIAS_SEMANA_LONGOS[getDayOfWeekFromISO(dateISO)] || "";
}

function criarMatrixMes(ano, mesIndex) {
  const primeiroDia = new Date(ano, mesIndex, 1);
  const ultimoDia = new Date(ano, mesIndex + 1, 0);
  const primeiroDiaSemana = primeiroDia.getDay();
  const diasNoMes = ultimoDia.getDate();

  const semanas = [];
  let semanaAtual = new Array(7).fill(null);
  let dia = 1;

  for (let i = 0; i < primeiroDiaSemana; i += 1) semanaAtual[i] = null;
  for (let i = primeiroDiaSemana; i < 7; i += 1) semanaAtual[i] = dia++;
  semanas.push(semanaAtual);

  while (dia <= diasNoMes) {
    const novaSemana = new Array(7).fill(null);
    for (let i = 0; i < 7 && dia <= diasNoMes; i += 1) novaSemana[i] = dia++;
    semanas.push(novaSemana);
  }

  return semanas;
}

function getMonthKey(ano, mesIndex) {
  return `${ano}-${pad2(mesIndex + 1)}`;
}

function addMonths(ano, mesIndex, delta) {
  const d = new Date(ano, mesIndex + delta, 1);
  return { ano: d.getFullYear(), mesIndex: d.getMonth() };
}

function compareMonthKeys(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function limparPrefixosFeriado(txt) {
  const s = String(txt || "").trim();
  if (!s) return "";
  return s
    .replace(/^feriado\s*[-—:]\s*/i, "")
    .replace(/^ponto\s*facultativo\s*[-—:]\s*/i, "Ponto Facultativo — ")
    .trim();
}

function motivoBloqueio({ diaSemana, ehFeriado, feriadoObj, ehBloqueada, bloqueioObj }) {
  if (ehBloqueada) {
    const motivo = String(
      bloqueioObj?.motivo ||
        bloqueioObj?.descricao ||
        bloqueioObj?.titulo ||
        ""
    ).trim();

    return motivo ? `Bloqueado — ${motivo}` : "Bloqueado";
  }

  if (ehFeriado) {
    const nomeCru =
      feriadoObj?.nome ||
      feriadoObj?.titulo ||
      feriadoObj?.descricao ||
      feriadoObj?.motivo ||
      "";

    const nome = limparPrefixosFeriado(nomeCru);
    const tipo = String(feriadoObj?.tipo || "").trim().toLowerCase();

    if (nome) return nome;
    if (tipo === "ponto_facultativo") return "Ponto Facultativo";
    return "Feriado";
  }

  if (diaSemana === 6) return "Sábado";
  if (diaSemana === 0) return "Domingo";
  return "Indisponível";
}

function getMinhaCorStatus(status) {
  const s = String(status || "").toLowerCase();

  if (["pendente", "em_analise", "solicitado"].includes(s)) {
    return "pendente";
  }

  if (["aprovado", "confirmado"].includes(s)) {
    return "aprovado";
  }

  if (["rejeitado", "cancelado", "negado", "excluido", "excluído"].includes(s)) {
    return "negado";
  }

  return null;
}

/* ───────── Modal do dia ───────── */
function ModalDiaUsuario({
  open,
  detalheDia,
  onClose,
  onSolicitar,
  onEditarMinhaReserva,
  onExcluirMinhaReserva,
  deletingId,
}) {
  if (!open || !detalheDia) return null;

  const {
    dataISO,
    estado,
    motivo,
    disponibilidade,
    minhasReservas = [],
  } = detalheDia;

  const semHorario = estado === "lotado";
  const bloqueado = estado === "bloqueado";

  return (
    <div className="fixed inset-0 z-[90]">
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-0 p-3 sm:p-5 grid place-items-center">
        <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-[28px] bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wide">
                <CalendarRange className="w-4 h-4" />
                Disponibilidade do dia
              </div>
              <h3 className="mt-1 text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatDataBR(dataISO)} — {getDiaSemanaLongo(dataISO)}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto max-h-[calc(92vh-84px)] px-4 sm:px-6 py-5">
            {bloqueado ? (
              <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 p-6 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-200 dark:bg-zinc-800 grid place-items-center">
                  <Lock className="w-6 h-6 text-slate-700 dark:text-zinc-300" />
                </div>
                <h4 className="mt-4 text-xl font-extrabold text-slate-900 dark:text-white">
                  Dia bloqueado
                </h4>
                <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-zinc-300 max-w-2xl mx-auto">
                  {motivo || "Esta data não está disponível para solicitação."}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {minhasReservas.length > 0 && (
                  <section className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 px-4 py-3">
                      <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                        Minhas solicitações e reservas deste dia
                      </h4>
                      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                        Visualize, edite ou exclua suas solicitações pendentes.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {minhasReservas.map((reserva) => {
  const ehPendente = reserva.slotStatus === "minha_pendente";
const ehNegada = reserva.slotStatus === "minha_negada";
const disabledDelete = deletingId === reserva.id;

  return (
    <div
      key={reserva.id}
      className={cls(
        "rounded-2xl border p-4",
        ehPendente
          ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/15"
          : ehNegada
            ? "border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/15"
            : "border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/15"
      )}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-zinc-400 font-bold">
              {reserva.salaLabel} • {reserva.periodoLabel}
            </span>

            <span
              className={cls(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold",
                ehPendente
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : ehNegada
                    ? "bg-rose-100 text-rose-800 border-rose-200"
                    : "bg-sky-100 text-sky-800 border-sky-200"
              )}
            >
              {ehPendente ? "Em análise" : ehNegada ? "Negada / cancelada" : "Aprovada"}
            </span>
          </div>

                                <p className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white break-words">
                                  {String(reserva.finalidade || "Sem finalidade").trim()}
                                </p>

                                {reserva.qtd_pessoas ? (
                                  <p className="mt-2 text-xs text-slate-600 dark:text-zinc-300">
                                    <span className="font-semibold">Pessoas:</span> {reserva.qtd_pessoas}
                                  </p>
                                ) : null}

                                {reserva.coffee_break ? (
                                  <p className="mt-1 text-xs text-slate-600 dark:text-zinc-300">
                                    <span className="font-semibold">Coffee break:</span> Sim
                                  </p>
                                ) : null}
                              </div>

                              {ehPendente && (
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={() => onEditarMinhaReserva(reserva)}
      className="inline-flex items-center justify-center p-2 rounded-xl border border-amber-300 text-amber-700 hover:bg-amber-100"
      title="Editar solicitação"
    >
      <Pencil className="w-4 h-4" />
    </button>

    <button
      type="button"
      onClick={() => onExcluirMinhaReserva(reserva)}
      disabled={disabledDelete}
      className="inline-flex items-center justify-center p-2 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-60"
      title="Excluir solicitação"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {semHorario ? (
                  <div className="rounded-3xl border border-violet-200 dark:border-violet-900/50 bg-violet-50 dark:bg-violet-950/15 p-6 text-center">
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-900/30 grid place-items-center">
                      <Info className="w-6 h-6 text-violet-700 dark:text-violet-300" />
                    </div>
                    <h4 className="mt-4 text-xl font-extrabold text-slate-900 dark:text-white">
                      Sem horário disponível
                    </h4>
                    <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-zinc-300 max-w-2xl mx-auto">
                      Todos os horários disponíveis deste dia já estão ocupados.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 dark:bg-sky-950/15 dark:border-sky-900/40 px-4 py-3 text-sm text-sky-900 dark:text-sky-100">
                      Selecione um local e período disponível para solicitar o agendamento.
                    </div>

                    {disponibilidade.map((salaItem) => (
                      <section
                        key={salaItem.sala}
                        className="rounded-3xl border border-slate-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950"
                      >
                        <div className="px-4 sm:px-5 py-4 bg-slate-50 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <h4 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                              {salaItem.label}
                            </h4>
                            <p className="text-sm text-slate-500 dark:text-zinc-400">
                              Capacidade conforto: {salaItem.conforto} • Máximo: {salaItem.max}
                            </p>
                          </div>

                          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
                            {salaItem.slots.length} horário(s) disponível(is)
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 sm:p-5">
                          {salaItem.slots.map((slot) => (
                            <div
                              key={`${slot.sala}-${slot.periodo}`}
                              className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-zinc-400 font-bold">
                                    Período
                                  </p>
                                  <p className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">
                                    {slot.periodoLabel}
                                  </p>
                                </div>

                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Disponível
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => onSolicitar(slot)}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-sm font-extrabold transition"
                              >
                                Solicitar agendamento
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Página ───────── */
function AgendaSalasUsuario() {
  const hojeParts = getHojeParts();
  const [ano, setAno] = useState(hojeParts.ano);
  const [mesIndex, setMesIndex] = useState(hojeParts.mesIndex);
  const [hojeISO] = useState(() => getHojeISO());

  const minUserMonthKey = useMemo(
    () => getMonthKey(hojeParts.ano, 0),
    [hojeParts.ano]
  );

  const maxUserMonthKey = useMemo(() => {
    if (hojeParts.mesIndex === 10) {
      return getMonthKey(hojeParts.ano + 1, 0);
    }

    if (hojeParts.mesIndex === 11) {
      return getMonthKey(hojeParts.ano + 1, 1);
    }

    return getMonthKey(hojeParts.ano, 11);
  }, [hojeParts.ano, hojeParts.mesIndex]);

  const viewedMonthKey = useMemo(() => getMonthKey(ano, mesIndex), [ano, mesIndex]);
  const podeVoltar = compareMonthKeys(viewedMonthKey, minUserMonthKey) > 0;
  const podeAvancar = compareMonthKeys(viewedMonthKey, maxUserMonthKey) < 0;

  const [loading, setLoading] = useState(false);

  const [reservasMap, setReservasMap] = useState({});
  const [feriadosMap, setFeriadosMap] = useState({});
  const [datasBloqueadasMap, setDatasBloqueadasMap] = useState({});

  const [modalSolicitacaoAberto, setModalSolicitacaoAberto] = useState(false);
  const [slotSelecionado, setSlotSelecionado] = useState(null);

  const [modalDiaAberto, setModalDiaAberto] = useState(false);
  const [diaSelecionadoISO, setDiaSelecionadoISO] = useState(null);

  const [modalModo, setModalModo] = useState("criar");
  const [reservaEmEdicao, setReservaEmEdicao] = useState(null);

  const [confirmDelete, setConfirmDelete] = useState({ open: false, reserva: null });
  const [deletingId, setDeletingId] = useState(null);

  const semanas = useMemo(() => criarMatrixMes(ano, mesIndex), [ano, mesIndex]);
  const liveRef = useRef(null);

  const handleKeyNav = useCallback((e) => {
    const tag = (e?.target?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "select" || tag === "textarea") return;

    if (e.key === "ArrowLeft" && podeVoltar) mudarMes(-1);
    if (e.key === "ArrowRight" && podeAvancar) mudarMes(1);
  }, [podeVoltar, podeAvancar, ano, mesIndex]);

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
      if (liveRef.current) liveRef.current.textContent = "Carregando disponibilidade...";

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
        liveRef.current.textContent = "Disponibilidade carregada.";
      }
    } catch (err) {
      console.error("[AgendaSalasUsuario] Erro ao carregar agenda:", err);
      toast.error("Erro ao carregar disponibilidade das salas.");
      if (liveRef.current) liveRef.current.textContent = "Falha ao carregar disponibilidade.";
    } finally {
      setLoading(false);
    }
  }

  function mudarMes(delta) {
    const novo = addMonths(ano, mesIndex, delta);
    const novoKey = getMonthKey(novo.ano, novo.mesIndex);

    if (compareMonthKeys(novoKey, minUserMonthKey) < 0) return;
    if (compareMonthKeys(novoKey, maxUserMonthKey) > 0) return;

    setAno(novo.ano);
    setMesIndex(novo.mesIndex);
  }

  function hojeClick() {
    setAno(hojeParts.ano);
    setMesIndex(hojeParts.mesIndex);
  }

  function getReservaDoSlot(salaValue, dataISO, periodo) {
    return reservasMap[dataISO]?.[salaValue]?.[periodo] || null;
  }

 function getSlotStatus(reserva) {
  if (!reserva) return "livre";

  if (reserva?.minha === false) {
    if (["cancelado", "rejeitado", "negado", "excluido", "excluído"].includes(String(reserva?.status || "").toLowerCase())) {
      return "livre";
    }

    return "ocupado_por_outro";
  }

  if (reserva?.status === "bloqueado") return "ocupado_por_outro";

  const status = String(reserva?.status || "").toLowerCase();

  if (["pendente", "em_analise", "solicitado"].includes(status)) {
    return "minha_pendente";
  }

  if (["aprovado", "confirmado"].includes(status)) {
    return "minha_aprovada";
  }

  if (["rejeitado", "cancelado", "negado", "excluido", "excluído"].includes(status)) {
    return "minha_negada";
  }

  return "minha_pendente";
}

  function getMinhasReservasDoDia(dataISO) {
    const minhas = [];

    SALAS.forEach((salaItem) => {
      PERIODOS.forEach((periodo) => {
        const reserva = getReservaDoSlot(salaItem.value, dataISO, periodo.value);
        if (!reserva || reserva.minha !== true) return;

        const status = getSlotStatus(reserva);

        minhas.push({
          ...reserva,
          sala: salaItem.value,
          salaLabel: salaItem.label,
          periodo: periodo.value,
          periodoLabel: periodo.label,
          slotStatus: status,
        });
      });
    });

    return minhas;
  }

  function getDiaInfo(dataISO) {
    const diaSemana = getDayOfWeekFromISO(dataISO);
    const ehFeriado = !!feriadosMap[dataISO];
    const ehBloqueada = !!datasBloqueadasMap[dataISO];
    const ehFimDeSemana = diaSemana === 0 || diaSemana === 6;
    const bloqueado = ehFimDeSemana || ehFeriado || ehBloqueada;

    const motivo = bloqueado
      ? motivoBloqueio({
          diaSemana,
          ehFeriado,
          feriadoObj: feriadosMap[dataISO],
          ehBloqueada,
          bloqueioObj: datasBloqueadasMap[dataISO],
        })
      : null;

    const disponibilidade = [];
    const minhasReservas = getMinhasReservasDoDia(dataISO);

    let totalSlots = 0;
    let ocupados = 0;
    let minhasPendentes = 0;
    let minhasAprovadas = 0;

    SALAS.forEach((salaItem) => {
      const slotsDisponiveis = [];

      PERIODOS.forEach((periodo) => {
        totalSlots += 1;
        const reserva = getReservaDoSlot(salaItem.value, dataISO, periodo.value);
        const slotStatus = getSlotStatus(reserva);

        if (slotStatus !== "livre") ocupados += 1;
        if (slotStatus === "minha_pendente") minhasPendentes += 1;
        if (slotStatus === "minha_aprovada") minhasAprovadas += 1;

        if (slotStatus === "livre") {
          slotsDisponiveis.push({
            dataISO,
            sala: salaItem.value,
            salaLabel: salaItem.label,
            periodo: periodo.value,
            periodoLabel: periodo.label,
            capacidadeSala: salaItem,
          });
        }
      });

      if (slotsDisponiveis.length > 0) {
        disponibilidade.push({
          sala: salaItem.value,
          label: salaItem.label,
          conforto: salaItem.conforto,
          max: salaItem.max,
          slots: slotsDisponiveis,
        });
      }
    });

    let estado = "disponivel";
    if (bloqueado) estado = "bloqueado";
    else if (ocupados >= totalSlots) estado = "lotado";
    else estado = "disponivel";

    const indicadoresUsuario = {
      pendente: false,
      aprovado: false,
      negado: false,
    };

    minhasReservas.forEach((reserva) => {
      const cor = getMinhaCorStatus(reserva?.status);
      if (cor) indicadoresUsuario[cor] = true;
    });

    return {
      dataISO,
      estado,
      motivo,
      disponibilidade,
      minhasReservas,
      totalSlots,
      ocupados,
      minhasPendentes,
      minhasAprovadas,
      salasDisponiveis: disponibilidade.length,
      indicadoresUsuario,
    };
  }

  const diasDoMes = useMemo(() => {
    const last = new Date(ano, mesIndex + 1, 0).getDate();
    return Array.from({ length: last }, (_, i) => i + 1);
  }, [ano, mesIndex]);

  const diaInfosMap = useMemo(() => {
    const map = {};
    for (const dia of diasDoMes) {
      const dataISO = formatISO(ano, mesIndex, dia);
      map[dataISO] = getDiaInfo(dataISO);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mesIndex, diasDoMes, reservasMap, feriadosMap, datasBloqueadasMap]);

  const detalheDiaSelecionado = useMemo(() => {
    if (!diaSelecionadoISO) return null;
    return diaInfosMap[diaSelecionadoISO] || null;
  }, [diaSelecionadoISO, diaInfosMap]);

  const minhasPendentes = useMemo(() => {
    let n = 0;
    Object.values(diaInfosMap).forEach((d) => {
      n += d?.minhasPendentes || 0;
    });
    return n;
  }, [diaInfosMap]);

  const minhasAprovadas = useMemo(() => {
    let n = 0;
    Object.values(diaInfosMap).forEach((d) => {
      n += d?.minhasAprovadas || 0;
    });
    return n;
  }, [diaInfosMap]);

  const diasComDisponibilidade = useMemo(() => {
    return Object.values(diaInfosMap).filter((d) => d?.estado === "disponivel").length;
  }, [diaInfosMap]);

  const diasLotados = useMemo(() => {
    return Object.values(diaInfosMap).filter((d) => d?.estado === "lotado").length;
  }, [diaInfosMap]);

  function abrirDia(dataISO) {
    setDiaSelecionadoISO(dataISO);
    setModalDiaAberto(true);
  }

  function fecharModalDia() {
    setModalDiaAberto(false);
    setDiaSelecionadoISO(null);
  }

  function abrirSolicitacao(slot) {
    fecharModalDia();
    setSlotSelecionado({
      dataISO: slot.dataISO,
      periodo: slot.periodo,
      sala: slot.sala,
    });
    setReservaEmEdicao(null);
    setModalModo("criar");
    setModalSolicitacaoAberto(true);
  }

  function iniciarEdicao(reserva) {
    fecharModalDia();
    setSlotSelecionado({
      dataISO: (reserva.data || "").slice(0, 10),
      periodo: reserva.periodo,
      sala: reserva.sala,
    });
    setReservaEmEdicao(reserva);
    setModalModo("editar");
    setModalSolicitacaoAberto(true);
  }

  function fecharModalSolicitacao() {
    setModalSolicitacaoAberto(false);
    setSlotSelecionado(null);
    setReservaEmEdicao(null);
    setModalModo("criar");
  }

  function solicitarExcluirReserva(reserva) {
    if (!reserva?.id || deletingId) return;
    setConfirmDelete({ open: true, reserva });
  }

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
      fecharModalDia();
    } catch (err) {
      console.error("[AgendaSalasUsuario][DELETE] erro:", err);
      const msg = err?.response?.data?.erro || "Não foi possível excluir a solicitação.";
      toast.error(msg);
    } finally {
      setDeletingId(null);
      setConfirmDelete({ open: false, reserva: null });
    }
  }

  const HOJE_BG = "bg-sky-100/70 dark:bg-sky-950/25";
  const HOJE_RING = "ring-2 ring-sky-500/70 dark:ring-sky-700/60";
  const HOJE_BADGE =
    "bg-sky-200 text-sky-950 border border-sky-300 dark:bg-sky-900/40 dark:text-sky-100 dark:border-sky-800";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950 text-gray-900 dark:text-gray-100">
      <header
        className="bg-gradient-to-br from-sky-700 via-indigo-600 to-blue-700 text-white shadow-lg"
        role="banner"
      >
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
        >
          Ir para o conteúdo
        </a>

        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-3 bg-white/10 rounded-2xl">
                <CalendarDays className="w-7 h-7 sm:w-8 sm:h-8" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  Agendamento de Salas
                </h1>
                <p className="text-sm sm:text-base text-sky-50/90">
                  Solicite horários disponíveis para o Auditório e a Sala de Reunião.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SALAS.map((s) => (
                <div
                  key={s.value}
                  className="bg-white/10 rounded-2xl px-3 py-2 text-xs sm:text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{s.label}</span>
                  </div>
                  <p className="mt-1 font-semibold">
                    {s.conforto} / {s.max} máx.
                  </p>
                </div>
              ))}

              <div className="bg-white/10 rounded-2xl px-3 py-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Minhas</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug">
                  <strong>Pendentes:</strong> {loading ? "—" : minhasPendentes}
                  <br />
                  <strong>Aprovadas:</strong> {loading ? "—" : minhasAprovadas}
                </p>
              </div>

              <div className="bg-white/10 rounded-2xl px-3 py-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Dias úteis</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug">
                  <strong>Com vaga:</strong> {loading ? "—" : diasComDisponibilidade}
                  <br />
                  <strong>Lotados:</strong> {loading ? "—" : diasLotados}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-white/10 px-3 py-2 text-xs sm:text-sm max-w-4xl">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              <span>Regras</span>
            </div>
            <p className="mt-1 text-[11px] sm:text-xs leading-snug text-sky-50/90">
              Você pode solicitar agendamentos em <strong>todo o ano vigente</strong>. Dias bloqueados aparecem
              em cinza. Dias sem disponibilidade aparecem em lilás. Dias com horários livres aparecem em branco.
            </p>
          </div>
        </div>
      </header>

      <main id="conteudo" className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 sm:py-8">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        <div className="sticky top-0 z-10 -mx-4 px-4 py-3 mb-4 bg-gradient-to-b from-white/85 to-white/60 dark:from-gray-950/80 dark:to-gray-950/40 backdrop-blur border-b border-white/50 dark:border-gray-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button
                className={cls(
                  "p-2 rounded-full bg-white shadow dark:bg-zinc-800 transition",
                  podeVoltar
                    ? "hover:bg-slate-50 dark:hover:bg-zinc-700"
                    : "opacity-45 cursor-not-allowed"
                )}
                onClick={() => mudarMes(-1)}
                aria-label="Mês anterior"
                title="Mês anterior (atalho ←)"
                disabled={!podeVoltar}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-center min-w-[160px]">
                <p className="text-xs text-slate-500 dark:text-slate-300">Mês</p>
                <p className="text-base sm:text-lg font-semibold text-slate-800 dark:text-white">
                  {NOMES_MESES[mesIndex]} {ano}
                </p>
              </div>

              <button
                className={cls(
                  "p-2 rounded-full bg-white shadow dark:bg-zinc-800 transition",
                  podeAvancar
                    ? "hover:bg-slate-50 dark:hover:bg-zinc-700"
                    : "opacity-45 cursor-not-allowed"
                )}
                onClick={() => mudarMes(1)}
                aria-label="Próximo mês"
                title={
                  podeAvancar
                    ? "Próximo mês (atalho →)"
                    : "Limite de navegação atingido para a regra anual progressiva"
                }
                disabled={!podeAvancar}
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

            <div className="flex items-center gap-2">
              {!podeAvancar && (
                <span className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300">
                  Limite anual progressivo atingido
                </span>
              )}

              {loading && (
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <Skeleton width={110} height={20} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2 text-xs sm:text-sm">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-white border border-slate-200 dark:bg-zinc-900 dark:border-zinc-700" />
            Há horários disponíveis
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-violet-100 border border-violet-300" />
            Sem horário disponível
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-slate-200 border border-slate-300" />
            Bloqueado / fim de semana / feriado
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-400 border border-amber-500" />
            Minha solicitação pendente
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-600" />
            Minha solicitação aprovada
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-rose-500 border border-rose-600" />
            Minha solicitação negada/excluída
          </span>
        </div>

        <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-50 dark:bg-zinc-800 border-b border-slate-100 dark:border-zinc-800 text-xs sm:text-sm">
            {DIAS_SEMANA.map((d) => (
              <div
                key={d}
                className="py-2 text-center font-medium text-slate-600 dark:text-slate-200 uppercase"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
            {semanas.map((semana, idxSemana) => (
              <div key={idxSemana} className="grid grid-cols-7">
                {semana.map((dia, idxDia) => {
                  if (!dia) {
                    return (
                      <div
                        key={`${idxSemana}-${idxDia}`}
                        className="min-h-[110px] sm:min-h-[140px] border-r border-slate-100 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/40"
                      />
                    );
                  }

                  const dataISO = formatISO(ano, mesIndex, dia);
                  const eHoje = dataISO === hojeISO;
                  const diaInfo = diaInfosMap[dataISO];
                  const salasDisponiveis = diaInfo?.salasDisponiveis || 0;
                  const indicadores = diaInfo?.indicadoresUsuario || {};

                  const cellTone =
                    diaInfo?.estado === "bloqueado"
                      ? "bg-slate-100 dark:bg-zinc-900/70"
                      : diaInfo?.estado === "lotado"
                        ? "bg-violet-50 dark:bg-violet-950/15"
                        : "bg-white dark:bg-zinc-900";

                  const chipTone =
                    diaInfo?.estado === "bloqueado"
                      ? "bg-slate-200 text-slate-700 border-slate-300"
                      : diaInfo?.estado === "lotado"
                        ? "bg-violet-100 text-violet-800 border-violet-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200";

                  return (
                    <button
                      key={dataISO}
                      type="button"
                      onClick={() => abrirDia(dataISO)}
                      className={cls(
                        "min-h-[110px] sm:min-h-[140px] border-r border-slate-100 dark:border-zinc-800 p-2 text-left transition",
                        cellTone,
                        eHoje ? cls(HOJE_BG, HOJE_RING) : "",
                        "hover:brightness-[0.985] focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                      )}
                      aria-label={`Dia ${dia}`}
                      title={
                        diaInfo?.estado === "bloqueado"
                          ? diaInfo?.motivo || "Bloqueado"
                          : diaInfo?.estado === "lotado"
                            ? "Sem horário disponível"
                            : "Há horários disponíveis"
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div
                            className={cls(
                              "text-xs sm:text-sm font-extrabold",
                              eHoje
                                ? "text-sky-800 dark:text-sky-200"
                                : "text-slate-800 dark:text-white"
                            )}
                          >
                            {dia}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                            {DIAS_SEMANA[getDayOfWeekFromISO(dataISO)]}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          {eHoje && (
                            <span
                              className={cls(
                                "text-[10px] font-extrabold px-2 py-0.5 rounded-full",
                                HOJE_BADGE
                              )}
                            >
                              Hoje
                            </span>
                          )}

                          {(indicadores.pendente || indicadores.aprovado || indicadores.negado) && (
                            <div className="flex items-center gap-1.5">
                              {indicadores.pendente && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-500"
                                  title="Você possui solicitação pendente neste dia"
                                />
                              )}
                              {indicadores.aprovado && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-600"
                                  title="Você possui solicitação aprovada neste dia"
                                />
                              )}
                              {indicadores.negado && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-rose-600"
                                  title="Você possui solicitação negada/excluída neste dia"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-col gap-2">
                        {diaInfo?.estado === "disponivel" && (
                          <span className="inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] sm:text-[11px] font-extrabold bg-sky-50 text-sky-700 border-sky-200">
                            {salasDisponiveis} sala{salasDisponiveis === 1 ? "" : "s"}
                          </span>
                        )}

                        <span
                          className={cls(
                            "inline-flex w-fit items-center rounded-full border px-2 py-1 text-[10px] sm:text-[11px] font-extrabold",
                            chipTone
                          )}
                        >
                          {diaInfo?.estado === "bloqueado"
                            ? "Bloqueado"
                            : diaInfo?.estado === "lotado"
                              ? "Sem vaga"
                              : "Disponível"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />

      <ModalDiaUsuario
        open={modalDiaAberto}
        detalheDia={detalheDiaSelecionado}
        onClose={fecharModalDia}
        onSolicitar={abrirSolicitacao}
        onEditarMinhaReserva={(reserva) => {
          iniciarEdicao(reserva);
        }}
        onExcluirMinhaReserva={(reserva) => {
          solicitarExcluirReserva(reserva);
        }}
        deletingId={deletingId}
      />

      {modalSolicitacaoAberto && slotSelecionado && (
        <ModalSolicitarReserva
          onClose={fecharModalSolicitacao}
          recarregar={carregarAgenda}
          slot={modalModo === "criar" ? slotSelecionado : null}
          sala={slotSelecionado.sala}
          capacidadeSala={
            SALAS.find((s) => s.value === slotSelecionado.sala) || {
              conforto: 0,
              max: 0,
            }
          }
          modo={modalModo}
          reservaAtual={modalModo === "editar" ? reservaEmEdicao : null}
        />
      )}

      <ModalConfirmacao
        isOpen={!!confirmDelete.open}
        title="Excluir solicitação?"
        description={
          confirmDelete?.reserva
            ? `Confirmar exclusão da sua solicitação de reserva?\n\n${String(
                confirmDelete.reserva.finalidade || "Sem finalidade"
              ).trim()}`
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