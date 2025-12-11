// ✅ src/pages/AgendaSalasAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Users,
  Coffee,
  ShieldCheck,
  Info,
  Repeat,
  X as CloseIcon,
  FileText,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Footer from "../components/Footer";

/* ───────────────────────── Constantes ───────────────────────── */
const NOMES_MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DIAS_SEMANA_LABEL_COMPLETO = [
  "domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado",
];

const CAPACIDADES_SALA = {
  auditorio:     { conforto: 50, max: 60, labelCurta: "Auditório" },
  sala_reuniao:  { conforto: 25, max: 30, labelCurta: "Sala de Reunião" },
};
const PERIODOS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
];

/* ─────────────────────── Helpers de calendário ─────────────────────── */
function criarMatrixMes(ano, mesIndex) {
  const primeiroDia = new Date(ano, mesIndex, 1);
  const ultimoDia   = new Date(ano, mesIndex + 1, 0);
  const primeiroDiaSemana = primeiroDia.getDay(); // 0=dom
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
const keySlot = (dataISO, periodo) => `${dataISO}|${periodo}`;
function formatISO(ano, mesIndex, dia) {
  const m = String(mesIndex + 1).padStart(2, "0");
  const d = String(dia).padStart(2, "0");
  return `${ano}-${m}-${d}`;
}

/* ─────────────────── Normalização de reservas ───────────────────
   Unifica chaves vindas do backend (solicitações de usuário vs admin).
------------------------------------------------------------------- */
function normalizeReserva(r) {
  const dataISO = (r.data || r.dataISO || r.dia || "").slice(0, 10);
  return {
    id: r.id ?? r.reserva_id ?? r.uuid ?? null,
    sala: r.sala || r.room || null,
    data: dataISO,
    dataISO,
    periodo: r.periodo || r.turno || r.slot || "manha",
    status: r.status || "pendente",

    // editáveis
    qtd_pessoas:  r.qtd_pessoas ?? r.qtdPessoas ?? r.qtd ?? r.capacidade ?? null,
    coffee_break: r.coffee_break ?? r.coffeeBreak ?? r.coffee ?? false,
    observacao:   r.observacao ?? r.obs ?? r.observacoes ?? r.observacao_admin ?? "",
    finalidade:   r.finalidade ?? r.descricao ?? r.titulo ?? r.assunto ?? "",

    // solicitante
    solicitante_id:
      r.solicitante_id ?? r.usuario_id ?? r.user_id ?? null,
    solicitante_nome:
      r.solicitante_nome ?? r.usuario_nome ?? r.nome_solicitante ?? r.nome ?? null,
    solicitante_unidade:
      r.solicitante_unidade ?? r.unidade ?? r.unidade_nome ?? r.setor ?? null,
  };
}

/* ───────────────────────────── Página ───────────────────────────── */
function AgendaSalasAdmin() {
  const hoje = new Date();
  const hojeISO = hoje.toISOString().slice(0, 10);
  const navigate = useNavigate();
  const baseURL = (api.defaults?.baseURL || "").replace(/\/+$/, "");

  const [ano, setAno] = useState(hoje.getFullYear());
  const [mesIndex, setMesIndex] = useState(hoje.getMonth());

  const [loading, setLoading] = useState(false);
  // { auditorio: { 'YYYY-MM-DD|manha': reserva }, sala_reuniao: { ... } }
  const [reservasMap, setReservasMap] = useState({ auditorio: {}, sala_reuniao: {} });
  const [feriadosMap, setFeriadosMap] = useState({});
  const [datasBloqueadasMap, setDatasBloqueadasMap] = useState({});

  const [modalAberto, setModalAberto] = useState(false);
  const [slotSelecionado, setSlotSelecionado] = useState(null);     // { dataISO, periodo, sala }
  const [reservaSelecionada, setReservaSelecionada] = useState(null);

  const semanas = useMemo(() => criarMatrixMes(ano, mesIndex), [ano, mesIndex]);

  useEffect(() => { carregarAgenda(); /* eslint-disable-next-line */ }, [ano, mesIndex]);

  async function carregarAgenda() {
    try {
      setLoading(true);
      const [dataAuditorio, dataSalaReuniao] = await Promise.all([
        api.get("/salas/agenda-admin", { params: { ano, mes: mesIndex + 1, sala: "auditorio" } }),
        api.get("/salas/agenda-admin", { params: { ano, mes: mesIndex + 1, sala: "sala_reuniao" } }),
      ]);

      // Mapa auditório
      const mapAuditorio = {};
      for (const r of (dataAuditorio.reservas || [])) {
        const nr = normalizeReserva(r);
        if (!nr.dataISO) continue;
        if (nr.sala && nr.sala !== "auditorio") continue;
        mapAuditorio[keySlot(nr.dataISO, nr.periodo)] = nr;
      }
      // Mapa sala de reunião
      const mapSalaReuniao = {};
      for (const r of (dataSalaReuniao.reservas || [])) {
        const nr = normalizeReserva(r);
        if (!nr.dataISO) continue;
        if (nr.sala && nr.sala !== "sala_reuniao") continue;
        mapSalaReuniao[keySlot(nr.dataISO, nr.periodo)] = nr;
      }

      // Feriados
      const ferMap = {};
      const feriadosBase = dataAuditorio.feriados?.length
        ? dataAuditorio.feriados
        : (dataSalaReuniao.feriados || []);
      for (const f of feriadosBase) {
        const dataISO = (f.data || "").slice(0, 10);
        if (dataISO) ferMap[dataISO] = f;
      }

      // Datas bloqueadas
      const bloqueiosMap = {};
      const bloqueiosBase = dataAuditorio.datas_bloqueadas?.length
        ? dataAuditorio.datas_bloqueadas
        : (dataSalaReuniao.datas_bloqueadas || []);
      for (const b of bloqueiosBase) {
        const dataISO = (b.data || "").slice(0, 10);
        if (dataISO) bloqueiosMap[dataISO] = b;
      }

      setReservasMap({ auditorio: mapAuditorio, sala_reuniao: mapSalaReuniao });
      setFeriadosMap(ferMap);
      setDatasBloqueadasMap(bloqueiosMap);
    } catch (err) {
      console.error("[AgendaSalasAdmin] Erro ao carregar agenda:", err);
      toast.error("Erro ao carregar agenda de salas.");
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

  function abrirModalSlot(dia, periodo, salaKey) {
    if (!dia) return;
    const dataISO = formatISO(ano, mesIndex, dia);
    const k = keySlot(dataISO, periodo);
    const reserva = reservasMap[salaKey]?.[k] || null;
    setSlotSelecionado({ dataISO, periodo, sala: salaKey });
    setReservaSelecionada(reserva);
    setModalAberto(true);
  }
  function fecharModal() {
    setModalAberto(false);
    setSlotSelecionado(null);
    setReservaSelecionada(null);
  }

  function getStatusSlot(dataISO, periodo, salaKey) {
    const d = new Date(dataISO + "T12:00:00");
    const diaSemana = d.getDay(); // 0 dom, 6 sáb
    const ehFeriado   = !!feriadosMap[dataISO];
    const ehBloqueada = !!datasBloqueadasMap[dataISO];

    if (diaSemana === 0 || diaSemana === 6 || ehFeriado || ehBloqueada) return "bloqueado_dia";
    const r = reservasMap[salaKey]?.[keySlot(dataISO, periodo)];
    return r ? (r.status || "pendente") : "livre";
  }
  function labelStatus(status) {
    switch (status) {
      case "pendente":       return "Pendente";
      case "aprovado":       return "Aprovado";
      case "rejeitado":      return "Rejeitado";
      case "cancelado":      return "Cancelado";
      case "bloqueado":      return "Bloqueado (uso interno)";
      case "bloqueado_dia":  return "Indisponível";
      default:               return "Livre";
    }
  }
  function classesStatus(status) {
    switch (status) {
      case "pendente":      return "bg-amber-100 text-amber-800 border border-amber-300";
      case "aprovado":      return "bg-emerald-100 text-emerald-800 border border-emerald-300";
      case "rejeitado":
      case "cancelado":     return "bg-red-100 text-red-700 border border-red-300";
      case "bloqueado":     return "bg-sky-100 text-sky-800 border border-sky-300";
      case "bloqueado_dia": return "bg-slate-200 text-slate-600 border border-slate-300 cursor-not-allowed";
      default:              return "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100";
    }
  }

  function abrirRelatorioMensal() {
    const url = `${baseURL}/salas/admin/relatorio-mensal?ano=${ano}&mes=${mesIndex + 1}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* HeaderHero */}
      <header className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-3 bg-white/10 rounded-2xl">
                <CalendarDays className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold">
                  Agenda de Salas – Administração
                </h1>
                <p className="text-sm sm:text-base text-emerald-50">
                  Visualize simultaneamente o <strong>Auditório</strong> e a{" "}
                  <strong>Sala de Reunião</strong> (manhã/tarde), com bloqueio automático
                  de fins de semana, feriados e pontos facultativos.
                </p>
              </div>
            </div>

            {/* Ministats + PDF do mês */}
            <div className="flex gap-3 flex-wrap items-start">
              <div className="bg-white/10 rounded-2xl px-3 py-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Auditório</span>
                </div>
                <p className="mt-1 font-semibold">
                  {CAPACIDADES_SALA.auditorio.conforto} / {CAPACIDADES_SALA.auditorio.max} máx.
                </p>
              </div>
              <div className="bg-white/10 rounded-2xl px-3 py-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>Sala de Reunião</span>
                </div>
                <p className="mt-1 font-semibold">
                  {CAPACIDADES_SALA.sala_reuniao.conforto} / {CAPACIDADES_SALA.sala_reuniao.max} máx.
                </p>
              </div>

              <button
                type="button"
                onClick={abrirRelatorioMensal}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm"
                title="Gerar PDF do mês (todas as reservas das duas salas)"
              >
                <FileText className="w-4 h-4" />
                Relatório do mês (PDF)
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main id="conteudo" className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 sm:py-8">
        {/* Barra de controles */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-full bg-white shadow hover:bg-slate-50" onClick={() => mudarMes(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <p className="text-sm text-slate-500">Mês</p>
              <p className="text-base sm:text-lg font-semibold text-slate-800">
                {NOMES_MESES[mesIndex]} {ano}
              </p>
            </div>
            <button className="p-2 rounded-full bg-white shadow hover:bg-slate-50" onClick={() => mudarMes(1)}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center text-xs sm:text-sm text-slate-600">
            <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100">
              Visualizando: Auditório + Sala de Reunião
            </span>
            {loading && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Skeleton width={80} height={20} />
              </div>
            )}
          </div>
        </div>

        {/* Atalho feriados/bloqueios */}
        <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-[11px] sm:text-xs text-emerald-900 flex items-center justify-between gap-2">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 text-emerald-700" />
            <p>
              Os <strong>feriados</strong>, <strong>pontos facultativos</strong> e{" "}
              <strong>datas bloqueadas</strong> deixam o dia indisponível para agendamento.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/admin/calendario-bloqueios")}
            className="inline-flex px-3 py-1 rounded-full text-[11px] border border-emerald-300 text-emerald-800 hover:bg-emerald-100"
          >
            Gerenciar feriados
          </button>
        </div>

        {/* Legenda */}
        <div className="mb-4 flex flex-wrap gap-2 text-xs sm:text-sm">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-slate-50 border border-slate-200" /> Livre
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-100 border border-amber-300" /> Pendente
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-100 border border-emerald-300" /> Aprovado
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-100 border border-red-300" /> Cancelado/Rejeitado
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-sky-100 border border-sky-300" /> Bloqueado (uso interno)
          </span>
        </div>

        {/* Calendário */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100 text-xs sm:text-sm">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="py-2 text-center font-medium text-slate-600 uppercase">{d}</div>
            ))}
          </div>

          <div className="divide-y divide-slate-100">
            {semanas.map((semana, idxSemana) => (
              <div key={idxSemana} className="grid grid-cols-7">
                {semana.map((dia, idxDia) => {
                  if (!dia) {
                    return (
                      <div key={idxDia} className="min-h-[110px] sm:min-h-[140px] border-r border-slate-100 bg-slate-50/40" />
                    );
                  }

                  const dataISO = formatISO(ano, mesIndex, dia);
                  const eHoje = dataISO === hojeISO;

                  const d = new Date(dataISO + "T12:00:00");
                  const diaSemana = d.getDay();
                  const ehFeriado = !!feriadosMap[dataISO];
                  const ehBloqueada = !!datasBloqueadasMap[dataISO];
                  const ehFimDeSemana = diaSemana === 0 || diaSemana === 6;
                  const diaIndisponivelGeral = ehFimDeSemana || ehFeriado || ehBloqueada;

                  // Célula "em branco" quando indisponível
                  if (diaIndisponivelGeral) {
                    return (
                      <div key={idxDia} className="min-h-[130px] sm:min-h-[170px] border-r border-slate-100 p-1.5 sm:p-2 flex flex-col bg-slate-50/40">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs sm:text-sm font-medium ${eHoje ? "text-emerald-600" : "text-slate-500"}`}>{dia}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={idxDia} className="min-h-[130px] sm:min-h-[170px] border-r border-slate-100 p-1.5 sm:p-2 flex flex-col">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs sm:text-sm font-medium ${eHoje ? "text-emerald-600" : "text-slate-700"}`}>{dia}</span>
                      </div>

                      <div className="flex flex-col gap-1.5 mt-auto">
                        {["sala_reuniao","auditorio"].map((salaKey) => {
                          const cap = CAPACIDADES_SALA[salaKey];

                          return (
                            <div key={salaKey} className="rounded-lg border border-slate-100 bg-slate-50/70">
                              {/* Título da sala centralizado (sem capacidade) */}
                              <div className="flex items-center justify-center px-2 pt-1">
                                <span className="text-[11px] font-semibold text-slate-600">
                                  {cap.labelCurta}
                                </span>
                              </div>

                              <div className="px-1 pb-1 pt-1 flex flex-col gap-1">
                                {PERIODOS.map((p) => {
                                  const status = getStatusSlot(dataISO, p.value, salaKey);
                                  const disabled = status === "bloqueado_dia";
                                  const k = keySlot(dataISO, p.value);
                                  const res = reservasMap[salaKey]?.[k];

                                  // quando aprovado, mostra finalidade no botão
                                  const textoDireita =
                                    status === "aprovado" && res?.finalidade
                                      ? res.finalidade
                                      : (status === "pendente" && res?.finalidade ? `Pendente — ${res.finalidade}` : labelStatus(status));

                                  return (
                                    <button
                                      key={p.value}
                                      type="button"
                                      onClick={() => !disabled && abrirModalSlot(dia, p.value, salaKey)}
                                      className={`w-full text-left text-[11px] sm:text-xs px-2 py-1.5 rounded-xl flex items-start justify-between gap-2 transition ${classesStatus(status)} ${disabled ? "cursor-not-allowed" : ""}`}
                                    >
                                      <span className="font-medium shrink-0">{p.label}</span>
                                      <span className="text-[10px] leading-snug break-words whitespace-normal text-right flex-1" title={textoDireita}>
                                        {textoDireita}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
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

      {/* Modal */}
      {modalAberto && slotSelecionado && (
        <ModalReservaAdmin
          onClose={fecharModal}
          slot={slotSelecionado}
          reserva={reservaSelecionada}
          sala={slotSelecionado.sala}
          capacidadeSala={CAPACIDADES_SALA[slotSelecionado.sala]}
          recarregar={carregarAgenda}
          baseURL={baseURL}
        />
      )}
    </div>
  );
}

export default AgendaSalasAdmin;

/* ────────────────────────────────────────────────────────────── */
/* Modal de Reserva Admin — criação/edição/recorrência           */
/* ────────────────────────────────────────────────────────────── */
function ModalReservaAdmin({ onClose, slot, reserva, sala, capacidadeSala, recarregar, baseURL }) {
  const isEdicao = !!reserva;

  // Prefill robusto (fallbacks)
  const [qtdPessoas, setQtdPessoas] = useState(
    reserva?.qtd_pessoas ?? reserva?.qtdPessoas ?? reserva?.qtd ?? ""
  );
  const [coffeeBreak, setCoffeeBreak] = useState(
    reserva?.coffee_break ?? reserva?.coffeeBreak ?? false
  );
  const [status, setStatus] = useState(reserva?.status || "aprovado");
  const [observacao, setObservacao] = useState(
    reserva?.observacao ?? reserva?.obs ?? ""
  );
  const [finalidade, setFinalidade] = useState(
    reserva?.finalidade ?? reserva?.descricao ?? reserva?.titulo ?? ""
  );
  const [loading, setLoading] = useState(false);

  // Recorrência
  const [usarRecorrencia, setUsarRecorrencia] = useState(false);
  const [tipoRecorrencia, setTipoRecorrencia] = useState("semanal"); // semanal | mensal | anual
  const [qtdRepeticoes, setQtdRepeticoes] = useState(4);

  // semanal
  const [intervaloSemanas, setIntervaloSemanas] = useState(1);
  const [diasSemanaRecorrencia, setDiasSemanaRecorrencia] = useState(() => {
    const d = new Date(slot.dataISO + "T12:00:00");
    return [d.getDay()]; // preseleciona o dia do slot
  });

  // mensal
  const [mensalModo, setMensalModo] = useState("dia_mes"); // dia_mes | ordem_semana

  // anual
  const [anualModo, setAnualModo] = useState("dia_mes"); // dia_mes | ordem_semana
  const [mesesAnual, setMesesAnual] = useState(() => {
    const d = new Date(slot.dataISO + "T12:00:00");
    return [d.getMonth()];
  });

  // Infos do dia base
  const dataBase = new Date(slot.dataISO + "T12:00:00");
  const diaMesBase = dataBase.getDate();
  const mesBaseIndex = dataBase.getMonth();
  const diaSemanaBaseIndex = dataBase.getDay();
  const diaSemanaBaseLabel = DIAS_SEMANA_LABEL_COMPLETO[diaSemanaBaseIndex] || "";

  // ordem (1ª..última) do dia da semana no mês
  const { ordemSemanaBase, ehUltimaSemana } = useMemo(() => {
    const dia = dataBase.getDate();
    const ordem = Math.floor((dia - 1) / 7) + 1; // 1-5
    const maisSete = new Date(dataBase);
    maisSete.setDate(dia + 7);
    const ehUltima = maisSete.getMonth() !== dataBase.getMonth();
    return { ordemSemanaBase: ordem, ehUltimaSemana: ehUltima };
  }, [dataBase]);

  // Capacidade safe
  const safeCap = capacidadeSala || { conforto: 0, max: 999 };
  const max = safeCap.max;

  function toggleDiaSemanaRecorrencia(idx) {
    setDiasSemanaRecorrencia((prev) => {
      if (prev.includes(idx)) {
        const novo = prev.filter((d) => d !== idx);
        return novo.length === 0 ? [idx] : novo;
      }
      return [...prev, idx].sort();
    });
  }
  function toggleMesAnual(idxMes) {
    setMesesAnual((prev) => {
      if (prev.includes(idxMes)) {
        const novo = prev.filter((m) => m !== idxMes);
        return novo.length === 0 ? [idxMes] : novo;
      }
      return [...prev, idxMes].sort();
    });
  }

  function construirRecorrenciaPayload() {
    if (!usarRecorrencia) return null;
    const base = { tipo: tipoRecorrencia, repeticoes: Number(qtdRepeticoes) || 1 };

    if (tipoRecorrencia === "semanal") {
      return { ...base, semanal: { intervaloSemanas: Number(intervaloSemanas) || 1, diasSemana: diasSemanaRecorrencia } };
    }
    if (tipoRecorrencia === "mensal") {
      return { ...base, mensal: { modo: mensalModo, diaMesBase, diaSemanaBaseIndex, ordemSemanaBase, ehUltimaSemana } };
    }
    if (tipoRecorrencia === "anual") {
      return { ...base, anual: { modo: anualModo, diaMesBase, mesBaseIndex, diaSemanaBaseIndex, ordemSemanaBase, ehUltimaSemana, meses: mesesAnual } };
    }
    return base;
  }

  async function salvar() {
    try {
      setLoading(true);
      const qtd = Number(qtdPessoas);
      if (!qtd || qtd <= 0) { toast.warn("Informe a quantidade de pessoas."); return; }
      if (qtd > max) { toast.warn(`A capacidade máxima desta sala é de ${max} pessoas.`); return; }

      const payloadBase = {
        sala,
        data: slot.dataISO,
        periodo: slot.periodo,
        qtd_pessoas: qtd,
        coffee_break: coffeeBreak,
        status,
        observacao: observacao?.trim() || null,
        finalidade: finalidade?.trim() || null,
      };
      const recorrencia = construirRecorrenciaPayload();

      if (isEdicao) {
        await api.put(`/salas/admin/reservas/${reserva.id}`, { ...payloadBase, recorrencia: null });
        toast.success("Reserva atualizada com sucesso.");
      } else {
        await api.post("/salas/admin/reservas", { ...payloadBase, recorrencia });
        toast.success(recorrencia ? "Reserva criada com recorrência." : "Reserva criada com sucesso.");
      }

      await recarregar();
      onClose();
    } catch (err) {
      console.error("[ModalReservaAdmin] Erro ao salvar:", err);
      const msg = err.response?.data?.erro || "Erro ao salvar a reserva da sala.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function excluirReserva() {
    if (!isEdicao) return;
    if (!window.confirm("Tem certeza que deseja excluir esta reserva?")) return;

    try {
      setLoading(true);
      await api.delete(`/salas/admin/reservas/${reserva.id}`);
      toast.success("Reserva excluída.");
      await recarregar();
      onClose();
    } catch (err) {
      console.error("[ModalReservaAdmin] Erro ao excluir:", err);
      const msg = err.response?.data?.erro || "Erro ao excluir a reserva da sala.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function abrirCartazPDF() {
    if (!reserva?.id) return;
    const url = `${baseURL}/salas/admin/cartaz/${reserva.id}.pdf`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const tituloModal = isEdicao ? "Editar reserva / solicitação" : "Criar reserva / bloqueio";
  const salaLabel = sala === "auditorio" ? "Auditório" : "Sala de Reunião";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        className="bg-white rounded-2xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-auto"
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              {tituloModal}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {slot.dataISO} • {slot.periodo === "manha" ? "Período da manhã" : "Período da tarde"} • {salaLabel}
            </p>
          </div>

          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500">
            <CloseIcon className="w-4 h-4" />
            <span className="sr-only">Fechar</span>
          </button>
        </div>

        {/* Corpo */}
        <div className="px-4 pb-4 pt-2 space-y-4">
          {/* Solicitante (read-only) */}
          {(reserva?.solicitante_nome || reserva?.usuario_nome || reserva?.nome) && (
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs sm:text-sm text-slate-700 flex flex-col gap-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500" />
                  <span>
                    <span className="font-semibold">Solicitante: </span>
                    {reserva.solicitante_nome || reserva.usuario_nome || reserva.nome}
                    {(reserva.solicitante_unidade || reserva.unidade || reserva.unidade_nome) && (
                      <span className="text-slate-500"> • {reserva.solicitante_unidade || reserva.unidade || reserva.unidade_nome}</span>
                    )}
                  </span>
                </div>
                {reserva?.status && (
                  <span className="inline-flex items-center text-[11px] px-2 py-1 rounded-full bg-slate-200 text-slate-700">
                    Status atual: {reserva.status}
                  </span>
                )}
              </div>

              {(reserva.finalidade || reserva.descricao || reserva.titulo) && (
                <div className="flex items-start gap-2 mt-1">
                  <FileText className="w-3 h-3 text-slate-500 mt-0.5" />
                  <p className="text-[11px] sm:text-xs">
                    <span className="font-semibold">Finalidade: </span>
                    {reserva.finalidade ?? reserva.descricao ?? reserva.titulo}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Quantidade / Coffee / Status */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <Users className="w-4 h-4 text-slate-500 mt-1" />
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600">Quantidade de pessoas</label>
                <input
                  type="number"
                  min={1}
                  max={max}
                  value={qtdPessoas}
                  onChange={(e) => setQtdPessoas(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={`Até ${max} pessoas`}
                />
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Capacidade máxima desta sala: {max} pessoas.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-slate-500" />
                <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={coffeeBreak}
                    onChange={(e) => setCoffeeBreak(e.target.checked)}
                  />
                  Haverá coffee break?
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="pendente">Pendente</option>
                  <option value="aprovado">Aprovado</option>
                  <option value="rejeitado">Rejeitado</option>
                  <option value="cancelado">Cancelado</option>
                  <option value="bloqueado">Bloqueado (uso interno / evento fixo)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Finalidade / evento */}
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-slate-500 mt-1" />
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600">Finalidade / evento</label>
              <textarea
                rows={2}
                value={finalidade}
                onChange={(e) => setFinalidade(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ex.: Reunião da equipe, Aula do Curso X, Oficina Y..."
              />
              <p className="mt-0.5 text-[11px] text-slate-500">
                Descreva brevemente para qual atividade a sala será utilizada.
              </p>
            </div>
          </div>

          {/* Observação interna */}
          <div>
            <label className="block text-xs font-medium text-slate-600">Observações internas (opcional)</label>
            <textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ex.: reserva interna, observações para a equipe, etc."
            />
          </div>

          {/* Recorrência (apenas criação) */}
          {!isEdicao && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-3 py-3 space-y-3">
              <div className="flex items-start gap-2">
                <Repeat className="w-4 h-4 text-emerald-700 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs sm:text-sm font-semibold text-emerald-900">Recorrência (opcional)</p>
                    <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-emerald-900">
                      <input
                        type="checkbox"
                        className="rounded border-emerald-400"
                        checked={usarRecorrencia}
                        onChange={(e) => setUsarRecorrencia(e.target.checked)}
                      />
                      Aplicar recorrência
                    </label>
                  </div>
                  <p className="text-[11px] text-emerald-900/80 mt-1">
                    Use esta opção para repetir automaticamente este horário (semanal, mensal ou anual).
                  </p>
                </div>
              </div>

              {usarRecorrencia && (
                <div className="space-y-3">
                  {/* Tipo + quantidade */}
                  <div className="grid sm:grid-cols-[1.3fr,0.7fr] gap-3">
                    <div>
                      <label className="block text-xs font-medium text-emerald-900">Tipo de recorrência</label>
                      <select
                        value={tipoRecorrencia}
                        onChange={(e) => setTipoRecorrencia(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="semanal">Semanal</option>
                        <option value="mensal">Mensal</option>
                        <option value="anual">Anual</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-emerald-900">Quantidade de repetições</label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={qtdRepeticoes}
                        onChange={(e) => setQtdRepeticoes(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <p className="text-[10px] text-emerald-900/80 mt-0.5">
                        Considera apenas ocorrências futuras contando da data selecionada.
                      </p>
                    </div>
                  </div>

                  {/* Config específica */}
                  {tipoRecorrencia === "semanal" && (
                    <div className="space-y-2 rounded-xl bg-white border border-emerald-100 px-3 py-2">
                      <p className="text-xs font-medium text-emerald-900 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-[11px]">S</span>
                        Recorrência semanal
                      </p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-emerald-900">Repetir a cada</span>
                          <input
                            type="number"
                            min={1}
                            max={52}
                            value={intervaloSemanas}
                            onChange={(e) => setIntervaloSemanas(e.target.value)}
                            className="w-16 rounded-lg border border-emerald-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <span className="text-[11px] text-emerald-900">semana(s)</span>
                        </div>
                      </div>
                      <div className="mt-1">
                        <p className="text-[11px] font-medium text-emerald-900 mb-1">Dias da semana:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {DIAS_SEMANA.map((label, idx) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => toggleDiaSemanaRecorrencia(idx)}
                              className={`px-2 py-1 text-[11px] rounded-full border ${
                                diasSemanaRecorrencia.includes(idx)
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : "bg-white text-emerald-900 border-emerald-200"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-emerald-900/70 mt-1">
                          Por padrão, o dia original do agendamento já vem selecionado.
                        </p>
                      </div>
                    </div>
                  )}

                  {tipoRecorrencia === "mensal" && (
                    <div className="space-y-2 rounded-xl bg-white border border-emerald-100 px-3 py-2">
                      <p className="text-xs font-medium text-emerald-900 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-[11px]">M</span>
                        Recorrência mensal
                      </p>

                      <div className="space-y-1 text-[11px] text-emerald-900">
                        <label className="flex items-center gap-2">
                          <input type="radio" className="text-emerald-600" checked={mensalModo === "dia_mes"} onChange={() => setMensalModo("dia_mes")} />
                          Repetir todo dia <span className="font-semibold">{diaMesBase}</span> de cada mês.
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="radio" className="text-emerald-600" checked={mensalModo === "ordem_semana"} onChange={() => setMensalModo("ordem_semana")} />
                          Repetir toda{" "}
                          <span className="font-semibold">{ehUltimaSemana ? "última" : `${ordemSemanaBase}ª`}</span>{" "}
                          <span className="font-semibold">{diaSemanaBaseLabel}</span>{" "}
                          do mês.
                        </label>
                      </div>
                    </div>
                  )}

                  {tipoRecorrencia === "anual" && (
                    <div className="space-y-2 rounded-xl bg-white border border-emerald-100 px-3 py-2">
                      <p className="text-xs font-medium text-emerald-900 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-[11px]">A</span>
                        Recorrência anual
                      </p>

                      <div className="space-y-1 text-[11px] text-emerald-900">
                        <label className="flex items-center gap-2">
                          <input type="radio" className="text-emerald-600" checked={anualModo === "dia_mes"} onChange={() => setAnualModo("dia_mes")} />
                          Repetir em{" "}
                          <span className="font-semibold">
                            {diaMesBase}/{String(mesBaseIndex + 1).padStart(2, "0")}
                          </span>{" "}
                          nos meses selecionados.
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="radio" className="text-emerald-600" checked={anualModo === "ordem_semana"} onChange={() => setAnualModo("ordem_semana")} />
                          Repetir na{" "}
                          <span className="font-semibold">{ehUltimaSemana ? "última" : `${ordemSemanaBase}ª`}</span>{" "}
                          <span className="font-semibold">{diaSemanaBaseLabel}</span>{" "}
                          dos meses selecionados.
                        </label>
                      </div>

                      <div className="mt-2">
                        <p className="text-[11px] font-medium text-emerald-900 mb-1">Meses para repetir:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {NOMES_MESES.map((nome, idx) => (
                            <button
                              key={nome}
                              type="button"
                              onClick={() => toggleMesAnual(idx)}
                              className={`px-2 py-1 text-[11px] rounded-full border ${
                                mesesAnual.includes(idx)
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : "bg-white text-emerald-900 border-emerald-200"
                              }`}
                            >
                              {nome.slice(0, 3)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-[11px] sm:text-xs text-slate-600 flex gap-2">
            <Info className="w-4 h-4 mt-0.5 text-emerald-500" />
            <p>
              Use esta tela para aprovar/negar solicitações ou criar <strong>bloqueios internos</strong>.
              A recorrência é aplicada somente no momento da criação da reserva.
            </p>
          </div>
        </div>

        {/* Rodapé do modal */}
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isEdicao && (
              <>
                <button
                  type="button"
                  onClick={excluirReserva}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  Excluir reserva
                </button>

                {/* Cartaz PDF (paisagem) */}
                <button
                  type="button"
                  onClick={abrirCartazPDF}
                  className="px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                  title="Gerar cartaz em PDF para a porta da sala"
                >
                  <FileText className="inline w-4 h-4 mr-1" />
                  Cartaz (PDF)
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={loading}
              className="px-4 py-1.5 text-xs sm:text-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? (isEdicao ? "Salvando..." : "Criando...") : isEdicao ? "Salvar alterações" : "Criar reserva"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
