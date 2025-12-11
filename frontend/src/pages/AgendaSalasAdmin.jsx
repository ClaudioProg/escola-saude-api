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
const DIAS_SEMANA_LABEL_COMPLETO = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const SALAS = [
  { value: "auditorio", label: "Auditório" },
  { value: "sala_reuniao", label: "Sala de Reunião" },
];

const CAPACIDADES_SALA = {
  auditorio: { conforto: 50, max: 60, labelCurta: "Auditório" },
  sala_reuniao: { conforto: 25, max: 30, labelCurta: "Sala de Reunião" },
};

const PERIODOS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
];

function criarMatrixMes(ano, mesIndex) {
  const primeiroDia = new Date(ano, mesIndex, 1);
  const ultimoDia = new Date(ano, mesIndex + 1, 0);
  const primeiroDiaSemana = primeiroDia.getDay(); // 0 domingo

  const diasNoMes = ultimoDia.getDate();
  const semanas = [];
  let semanaAtual = new Array(7).fill(null);
  let dia = 1;

  // Preenche dias em branco antes do 1º
  for (let i = 0; i < primeiroDiaSemana; i++) {
    semanaAtual[i] = null;
  }

  for (let i = primeiroDiaSemana; i < 7; i++) {
    semanaAtual[i] = dia++;
  }
  semanas.push(semanaAtual);

  while (dia <= diasNoMes) {
    const novaSemana = new Array(7).fill(null);
    for (let i = 0; i < 7 && dia <= diasNoMes; i++) {
      novaSemana[i] = dia++;
    }
    semanas.push(novaSemana);
  }

  return semanas;
}

function keySlot(dataISO, periodo) {
  return `${dataISO}|${periodo}`;
}

function formatISO(ano, mesIndex, dia) {
  const m = String(mesIndex + 1).padStart(2, "0");
  const d = String(dia).padStart(2, "0");
  return `${ano}-${m}-${d}`;
}

function AgendaSalasAdmin() {
  const hoje = new Date();
  const hojeISO = hoje.toISOString().slice(0, 10);
  const navigate = useNavigate();

  const [ano, setAno] = useState(hoje.getFullYear());
  const [mesIndex, setMesIndex] = useState(hoje.getMonth());

  const [loading, setLoading] = useState(false);
  // reservas separadas por sala: { auditorio: {keySlot: reserva}, sala_reuniao: {...} }
  const [reservasMap, setReservasMap] = useState({
    auditorio: {},
    sala_reuniao: {},
  });
  const [feriadosMap, setFeriadosMap] = useState({});
  const [datasBloqueadasMap, setDatasBloqueadasMap] = useState({});
  const [modalAberto, setModalAberto] = useState(false);
  const [slotSelecionado, setSlotSelecionado] = useState(null); // {dataISO, periodo, sala}
  const [reservaSelecionada, setReservaSelecionada] = useState(null);

  const semanas = useMemo(
    () => criarMatrixMes(ano, mesIndex),
    [ano, mesIndex]
  );

  useEffect(() => {
    carregarAgenda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mesIndex]);

  async function carregarAgenda() {
    try {
      setLoading(true);

      // Carrega as duas salas em paralelo
      const [dataAuditorio, dataSalaReuniao] = await Promise.all([
        api.get("/salas/agenda-admin", {
          params: { ano, mes: mesIndex + 1, sala: "auditorio" },
        }),
        api.get("/salas/agenda-admin", {
          params: { ano, mes: mesIndex + 1, sala: "sala_reuniao" },
        }),
      ]);

      console.log("[AgendaSalasAdmin] payload auditório:", dataAuditorio);
      console.log(
        "[AgendaSalasAdmin] payload sala de reunião:",
        dataSalaReuniao
      );

      const mapAuditorio = {};
      for (const r of dataAuditorio.reservas || []) {
        const dataISO = (r.data || "").slice(0, 10);
        if (!dataISO) continue;
        // garante que só entre reserva do auditório
        if (r.sala && r.sala !== "auditorio") continue;
        const k = keySlot(dataISO, r.periodo);
        mapAuditorio[k] = r;
      }

      const mapSalaReuniao = {};
      for (const r of dataSalaReuniao.reservas || []) {
        const dataISO = (r.data || "").slice(0, 10);
        if (!dataISO) continue;
        // garante que só entre reserva da sala de reunião
        if (r.sala && r.sala !== "sala_reuniao") continue;
        const k = keySlot(dataISO, r.periodo);
        mapSalaReuniao[k] = r;
      }

      const ferMap = {};
      const feriadosBase = dataAuditorio.feriados?.length
        ? dataAuditorio.feriados
        : dataSalaReuniao.feriados || [];

      for (const f of feriadosBase) {
        const dataISO = (f.data || "").slice(0, 10);
        if (!dataISO) continue;
        ferMap[dataISO] = f;
      }

      const bloqueiosMap = {};
      const bloqueiosBase = dataAuditorio.datas_bloqueadas?.length
        ? dataAuditorio.datas_bloqueadas
        : dataSalaReuniao.datas_bloqueadas || [];

      for (const b of bloqueiosBase) {
        const dataISO = (b.data || "").slice(0, 10);
        if (!dataISO) continue;
        bloqueiosMap[dataISO] = b;
      }

      setReservasMap({
        auditorio: mapAuditorio,
        sala_reuniao: mapSalaReuniao,
      });
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
    if (novoMes < 0) {
      novoMes = 11;
      novoAno--;
    } else if (novoMes > 11) {
      novoMes = 0;
      novoAno++;
    }
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
    const diaSemana = d.getDay(); // 0 domingo, 6 sábado
    const ehFeriado = !!feriadosMap[dataISO];
    const ehBloqueada = !!datasBloqueadasMap[dataISO];

    if (diaSemana === 0 || diaSemana === 6 || ehFeriado || ehBloqueada) {
      return "bloqueado_dia";
    }

    const mapSala = reservasMap[salaKey] || {};
    const k = keySlot(dataISO, periodo);
    const r = mapSala[k];
    if (!r) return "livre";
    // 'pendente', 'aprovado', 'rejeitado', 'cancelado', 'bloqueado'
    return r.status || "pendente";
  }

  function labelStatus(status) {
    switch (status) {
      case "pendente":
        return "Pendente";
      case "aprovado":
        return "Aprovado";
      case "rejeitado":
        return "Rejeitado";
      case "cancelado":
        return "Cancelado";
      case "bloqueado":
        return "Bloqueado (uso interno)";
      case "bloqueado_dia":
        return "Indisponível";
      case "livre":
      default:
        return "Livre";
    }
  }

  function classesStatus(status) {
    switch (status) {
      case "pendente":
        return "bg-amber-100 text-amber-800 border border-amber-300";
      case "aprovado":
        return "bg-emerald-100 text-emerald-800 border border-emerald-300";
      case "rejeitado":
      case "cancelado":
        return "bg-red-100 text-red-700 border border-red-300";
      case "bloqueado":
        return "bg-sky-100 text-sky-800 border border-sky-300";
      case "bloqueado_dia":
        return "bg-slate-200 text-slate-600 border border-slate-300 cursor-not-allowed";
      case "livre":
      default:
        return "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100";
    }
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
                  Visualize simultaneamente o{" "}
                  <strong>Auditório</strong> e a{" "}
                  <strong>Sala de Reunião</strong> (manhã/tarde), com bloqueio
                  automático de fins de semana, feriados e pontos facultativos.
                </p>
              </div>
            </div>

            {/* Ministats das duas salas */}
            <div className="flex gap-3 flex-wrap">
              <div className="bg-white/10 rounded-2xl px-3 py-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Auditório</span>
                </div>
                <p className="mt-1 font-semibold">
                  {CAPACIDADES_SALA.auditorio.conforto} /{" "}
                  {CAPACIDADES_SALA.auditorio.max} máx.
                </p>
              </div>
              <div className="bg-white/10 rounded-2xl px-3 py-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>Sala de Reunião</span>
                </div>
                <p className="mt-1 font-semibold">
                  {CAPACIDADES_SALA.sala_reuniao.conforto} /{" "}
                  {CAPACIDADES_SALA.sala_reuniao.max} máx.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main
        id="conteudo"
        className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 sm:py-8"
      >
        {/* Barra de controles */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              className="p-2 rounded-full bg-white shadow hover:bg-slate-50"
              onClick={() => mudarMes(-1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <p className="text-sm text-slate-500">Mês</p>
              <p className="text-base sm:text-lg font-semibold text-slate-800">
                {NOMES_MESES[mesIndex]} {ano}
              </p>
            </div>
            <button
              className="p-2 rounded-full bg-white shadow hover:bg-slate-50"
              onClick={() => mudarMes(1)}
            >
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

        {/* Atalho para feriados/bloqueios gerais */}
        <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-[11px] sm:text-xs text-emerald-900 flex items-center justify-between gap-2">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 text-emerald-700" />
            <p>
              Os <strong>feriados</strong>,{" "}
              <strong>pontos facultativos</strong> e{" "}
              <strong>datas bloqueadas</strong> deixam o dia completamente
              indisponível para agendamento. Use a tela específica para
              cadastrar esses bloqueios.
            </p>
          </div>
          {/* Botão leva para CalendarioBloqueiosAdmin.jsx */}
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
            <span className="w-3 h-3 rounded-full bg-slate-50 border border-slate-200" />{" "}
            Livre
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-100 border border-amber-300" />{" "}
            Pendente
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-100 border border-emerald-300" />{" "}
            Aprovado
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-100 border border-red-300" />{" "}
            Cancelado/Rejeitado
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-sky-100 border border-sky-300" />{" "}
            Bloqueado (uso interno)
          </span>
        </div>

        {/* Calendário */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100 text-xs sm:text-sm">
            {DIAS_SEMANA.map((d) => (
              <div
                key={d}
                className="py-2 text-center font-medium text-slate-600 uppercase"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="divide-y divide-slate-100">
            {semanas.map((semana, idxSemana) => (
              <div key={idxSemana} className="grid grid-cols-7">
                {semana.map((dia, idxDia) => {
                  if (!dia) {
                    return (
                      <div
                        key={idxDia}
                        className="min-h-[110px] sm:min-h-[140px] border-r border-slate-100 bg-slate-50/40"
                      />
                    );
                  }

                  const dataISO = formatISO(ano, mesIndex, dia);
                  const eHoje = dataISO === hojeISO;

                  const d = new Date(dataISO + "T12:00:00");
                  const diaSemana = d.getDay(); // 0 dom, 6 sáb
                  const ehFeriado = !!feriadosMap[dataISO];
                  const ehBloqueada = !!datasBloqueadasMap[dataISO];
                  const ehFimDeSemana = diaSemana === 0 || diaSemana === 6;

                  const diaIndisponivelGeral =
                    ehFimDeSemana || ehFeriado || ehBloqueada;

                  // Fim de semana, feriado, ponto facultativo e datas bloqueadas:
                  // célula "em branco" (apenas o número do dia, sem slots).
                  if (diaIndisponivelGeral) {
                    return (
                      <div
                        key={idxDia}
                        className="min-h-[130px] sm:min-h-[170px] border-r border-slate-100 p-1.5 sm:p-2 flex flex-col bg-slate-50/40"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs sm:text-sm font-medium ${
                              eHoje ? "text-emerald-600" : "text-slate-500"
                            }`}
                          >
                            {dia}
                          </span>
                        </div>
                        {/* célula em branco, sem possibilidade de edição */}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idxDia}
                      className="min-h-[130px] sm:min-h-[170px] border-r border-slate-100 p-1.5 sm:p-2 flex flex-col"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs sm:text-sm font-medium ${
                            eHoje ? "text-emerald-600" : "text-slate-700"
                          }`}
                        >
                          {dia}
                        </span>
                      </div>

                      {/* Blocos por sala */}
                      <div className="flex flex-col gap-1.5 mt-auto">
                        {["sala_reuniao", "auditorio"].map((salaKey) => {
                          const cap = CAPACIDADES_SALA[salaKey];

                          return (
                            <div
                              key={salaKey}
                              className="rounded-lg border border-slate-100 bg-slate-50/70"
                            >
                              {/* título da sala centralizado, sem capacidade */}
                              <div className="flex items-center justify-center px-2 pt-1">
                                <span className="text-[11px] font-semibold text-slate-600">
                                  {cap.labelCurta}
                                </span>
                              </div>

                              <div className="px-1 pb-1 pt-1 flex flex-col gap-1">
                                {PERIODOS.map((p) => {
                                  const status = getStatusSlot(
                                    dataISO,
                                    p.value,
                                    salaKey
                                  );
                                  const label = labelStatus(status);
                                  const disabled = status === "bloqueado_dia";

                                  return (
                                    <button
                                      key={p.value}
                                      type="button"
                                      onClick={() =>
                                        !disabled &&
                                        abrirModalSlot(dia, p.value, salaKey)
                                      }
                                      className={`w-full text-left text-[11px] sm:text-xs px-2 py-1.5 rounded-xl flex items-center justify-between gap-1 transition ${classesStatus(
                                        status
                                      )} ${
                                        disabled ? "cursor-not-allowed" : ""
                                      }`}
                                    >
                                      <span className="font-medium">
                                        {p.label}
                                      </span>
                                      <span className="text-[10px] truncate">
                                        {label}
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

      {/* Modal de Detalhes/Criação de Reserva */}
      {modalAberto && slotSelecionado && (
        <ModalReservaAdmin
          onClose={fecharModal}
          slot={slotSelecionado}
          reserva={reservaSelecionada}
          sala={slotSelecionado.sala}
          capacidadeSala={CAPACIDADES_SALA[slotSelecionado.sala]}
          recarregar={carregarAgenda}
        />
      )}
    </div>
  );
}

export default AgendaSalasAdmin;

/* ────────────────────────────────────────────────────────────── */
/* Modal de Reserva Admin — criação, edição e recorrência        */
/* ────────────────────────────────────────────────────────────── */
function ModalReservaAdmin({
  onClose,
  slot,
  reserva,
  sala,
  capacidadeSala,
  recarregar,
}) {
  const isEdicao = !!reserva;

  const [qtdPessoas, setQtdPessoas] = useState(
    reserva?.qtd_pessoas ? String(reserva.qtd_pessoas) : ""
  );
  const [coffeeBreak, setCoffeeBreak] = useState(
    reserva?.coffee_break ?? false
  );
  const [status, setStatus] = useState(reserva?.status || "aprovado");
  const [observacao, setObservacao] = useState(reserva?.observacao || "");
  const [finalidade, setFinalidade] = useState(reserva?.finalidade || "");
  const [loading, setLoading] = useState(false);

  // 🔁 Recorrência
  const [usarRecorrencia, setUsarRecorrencia] = useState(false);
  const [tipoRecorrencia, setTipoRecorrencia] = useState("semanal"); // semanal | mensal | anual
  const [qtdRepeticoes, setQtdRepeticoes] = useState(4);

  // semanal
  const [intervaloSemanas, setIntervaloSemanas] = useState(1);
  const [diasSemanaRecorrencia, setDiasSemanaRecorrencia] = useState(() => {
    const d = new Date(slot.dataISO + "T12:00:00");
    const base = d.getDay(); // 0-6
    return [base]; // por padrão, só o dia do slot
  });

  // mensal
  const [mensalModo, setMensalModo] = useState("dia_mes"); // dia_mes | ordem_semana

  // anual
  const [anualModo, setAnualModo] = useState("dia_mes"); // dia_mes | ordem_semana
  const [mesesAnual, setMesesAnual] = useState(() => {
    const d = new Date(slot.dataISO + "T12:00:00");
    const mesBase = d.getMonth(); // 0-11
    return [mesBase];
  });

  const dataBase = new Date(slot.dataISO + "T12:00:00");
  const diaMesBase = dataBase.getDate();
  const mesBaseIndex = dataBase.getMonth();
  const diaSemanaBaseIndex = dataBase.getDay(); // 0-6
  const diaSemanaBaseLabel =
    DIAS_SEMANA_LABEL_COMPLETO[diaSemanaBaseIndex] || "";

  // ordem dentro do mês (1ª, 2ª, 3ª, 4ª, 5ª ou última)
  const { ordemSemanaBase, ehUltimaSemana } = useMemo(() => {
    const dia = dataBase.getDate();
    const ordem = Math.floor((dia - 1) / 7) + 1; // 1-5
    // checa se ao somar 7 dias ainda está no mesmo mês
    const maisSete = new Date(dataBase);
    maisSete.setDate(dia + 7);
    const ehUltima = maisSete.getMonth() !== dataBase.getMonth();
    return { ordemSemanaBase: ordem, ehUltimaSemana: ehUltima };
  }, [dataBase]);

  function toggleDiaSemanaRecorrencia(idx) {
    setDiasSemanaRecorrencia((prev) => {
      if (prev.includes(idx)) {
        // evita tirar TODOS para não ficar sem nenhuma seleção
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

  const max = capacidadeSala.max;

  function construirRecorrenciaPayload() {
    if (!usarRecorrencia) return null;

    const base = {
      tipo: tipoRecorrencia,
      repeticoes: Number(qtdRepeticoes) || 1,
    };

    if (tipoRecorrencia === "semanal") {
      return {
        ...base,
        semanal: {
          intervaloSemanas: Number(intervaloSemanas) || 1,
          diasSemana: diasSemanaRecorrencia, // 0–6
        },
      };
    }

    if (tipoRecorrencia === "mensal") {
      return {
        ...base,
        mensal: {
          modo: mensalModo, // "dia_mes" ou "ordem_semana"
          diaMesBase,
          diaSemanaBaseIndex,
          ordemSemanaBase,
          ehUltimaSemana,
        },
      };
    }

    if (tipoRecorrencia === "anual") {
      return {
        ...base,
        anual: {
          modo: anualModo,
          diaMesBase,
          mesBaseIndex,
          diaSemanaBaseIndex,
          ordemSemanaBase,
          ehUltimaSemana,
          meses: mesesAnual, // 0–11
        },
      };
    }

    return base;
  }

  async function salvar() {
    try {
      setLoading(true);
      const qtd = Number(qtdPessoas);

      if (!qtd || qtd <= 0) {
        toast.warn("Informe a quantidade de pessoas.");
        return;
      }
      if (qtd > max) {
        toast.warn(`A capacidade máxima desta sala é de ${max} pessoas.`);
        return;
      }

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
        await api.put(`/salas/admin/reservas/${reserva.id}`, {
          ...payloadBase,
          recorrencia: null, // edição atua só neste registro
        });
        toast.success("Reserva atualizada com sucesso.");
      } else {
        await api.post("/salas/admin/reservas", {
          ...payloadBase,
          recorrencia, // backend decide como replicar
        });
        toast.success(
          recorrencia
            ? "Reserva criada com recorrência."
            : "Reserva criada com sucesso."
        );
      }

      await recarregar();
      onClose();
    } catch (err) {
      console.error("[ModalReservaAdmin] Erro ao salvar:", err);
      const msg =
        err.response?.data?.erro || "Erro ao salvar a reserva da sala.";
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
      const msg =
        err.response?.data?.erro || "Erro ao excluir a reserva da sala.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const tituloModal = isEdicao
    ? "Editar reserva / solicitação"
    : "Criar reserva / bloqueio";

  const salaLabel =
    sala === "auditorio" ? "Auditório" : "Sala de Reunião";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        className="bg-white rounded-2xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-auto"
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              {tituloModal}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {slot.dataISO} •{" "}
              {slot.periodo === "manha"
                ? "Período da manhã"
                : "Período da tarde"}{" "}
              • {salaLabel}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
          >
            <CloseIcon className="w-4 h-4" />
            <span className="sr-only">Fechar</span>
          </button>
        </div>

        <div className="px-4 pb-4 pt-2 space-y-4">
          {/* Info do solicitante (apenas leitura, se vier do backend) */}
          {reserva?.solicitante_nome && (
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs sm:text-sm text-slate-700 flex flex-col gap-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500" />
                  <span>
                    <span className="font-semibold">Solicitante: </span>
                    {reserva.solicitante_nome}
                    {reserva.solicitante_unidade && (
                      <span className="text-slate-500">
                        {" "}
                        • {reserva.solicitante_unidade}
                      </span>
                    )}
                  </span>
                </div>
                {reserva.status && (
                  <span className="inline-flex items-center text-[11px] px-2 py-1 rounded-full bg-slate-200 text-slate-700">
                    Status atual: {labelStatus(reserva.status)}
                  </span>
                )}
              </div>

              {reserva.finalidade && (
                <div className="flex items-start gap-2 mt-1">
                  <FileText className="w-3 h-3 text-slate-500 mt-0.5" />
                  <p className="text-[11px] sm:text-xs">
                    <span className="font-semibold">Finalidade: </span>
                    {reserva.finalidade}
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
                <label className="block text-xs font-medium text-slate-600">
                  Quantidade de pessoas
                </label>
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
                <label className="block text-xs font-medium text-slate-600">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="pendente">Pendente</option>
                  <option value="aprovado">Aprovado</option>
                  <option value="rejeitado">Rejeitado</option>
                  <option value="cancelado">Cancelado</option>
                  <option value="bloqueado">
                    Bloqueado (uso interno / evento fixo)
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Finalidade / evento */}
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-slate-500 mt-1" />
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600">
                Finalidade / evento
              </label>
              <textarea
                rows={2}
                value={finalidade}
                onChange={(e) => setFinalidade(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ex.: Reunião da equipe da Atenção Básica, Aula do Curso X, Oficina Y..."
              />
              <p className="mt-0.5 text-[11px] text-slate-500">
                Descreva brevemente para qual atividade a sala será utilizada.
                Este texto pode ser exibido para a equipe da Escola.
              </p>
            </div>
          </div>

          {/* Observação interna */}
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Observações internas (opcional)
            </label>
            <textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ex.: reserva interna, observações para a equipe da Escola, etc."
            />
          </div>

          {/* Bloco de recorrência (apenas criação) */}
          {!isEdicao && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-3 py-3 space-y-3">
              <div className="flex items-start gap-2">
                <Repeat className="w-4 h-4 text-emerald-700 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs sm:text-sm font-semibold text-emerald-900">
                      Recorrência (opcional)
                    </p>
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
                    Use esta opção para repetir automaticamente este horário em
                    múltiplas datas (semanal, mensal ou anual). Os registros
                    serão gravados individualmente no banco.
                  </p>
                </div>
              </div>

              {usarRecorrencia && (
                <div className="space-y-3">
                  {/* Tipo + quantidade */}
                  <div className="grid sm:grid-cols-[1.3fr,0.7fr] gap-3">
                    <div>
                      <label className="block text-xs font-medium text-emerald-900">
                        Tipo de recorrência
                      </label>
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
                      <label className="block text-xs font-medium text-emerald-900">
                        Quantidade de repetições
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={qtdRepeticoes}
                        onChange={(e) => setQtdRepeticoes(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <p className="text-[10px] text-emerald-900/80 mt-0.5">
                        Inclui apenas ocorrências futuras contando a partir da
                        data selecionada.
                      </p>
                    </div>
                  </div>

                  {/* Config específica por tipo */}
                  {tipoRecorrencia === "semanal" && (
                    <div className="space-y-2 rounded-xl bg-white border border-emerald-100 px-3 py-2">
                      <p className="text-xs font-medium text-emerald-900 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-[11px]">
                          S
                        </span>
                        Recorrência semanal
                      </p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-emerald-900">
                            Repetir a cada
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={52}
                            value={intervaloSemanas}
                            onChange={(e) =>
                              setIntervaloSemanas(e.target.value)
                            }
                            className="w-16 rounded-lg border border-emerald-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <span className="text-[11px] text-emerald-900">
                            semana(s)
                          </span>
                        </div>
                      </div>
                      <div className="mt-1">
                        <p className="text-[11px] font-medium text-emerald-900 mb-1">
                          Dias da semana:
                        </p>
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
                          Por padrão, o dia original do agendamento já vem
                          selecionado.
                        </p>
                      </div>
                    </div>
                  )}

                  {tipoRecorrencia === "mensal" && (
                    <div className="space-y-2 rounded-xl bg-white border border-emerald-100 px-3 py-2">
                      <p className="text-xs font-medium text-emerald-900 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-[11px]">
                          M
                        </span>
                        Recorrência mensal
                      </p>

                      <div className="space-y-1 text-[11px] text-emerald-900">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            className="text-emerald-600"
                            checked={mensalModo === "dia_mes"}
                            onChange={() => setMensalModo("dia_mes")}
                          />
                          Repetir todo dia{" "}
                          <span className="font-semibold">{diaMesBase}</span> de
                          cada mês.
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            className="text-emerald-600"
                            checked={mensalModo === "ordem_semana"}
                            onChange={() => setMensalModo("ordem_semana")}
                          />
                          Repetir toda{" "}
                          <span className="font-semibold">
                            {ehUltimaSemana ? "última" : `${ordemSemanaBase}ª`}
                          </span>{" "}
                          <span className="font-semibold">
                            {diaSemanaBaseLabel}
                          </span>{" "}
                          do mês.
                        </label>
                      </div>
                    </div>
                  )}

                  {tipoRecorrencia === "anual" && (
                    <div className="space-y-2 rounded-xl bg-white border border-emerald-100 px-3 py-2">
                      <p className="text-xs font-medium text-emerald-900 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-[11px]">
                          A
                        </span>
                        Recorrência anual
                      </p>

                      <div className="space-y-1 text-[11px] text-emerald-900">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            className="text-emerald-600"
                            checked={anualModo === "dia_mes"}
                            onChange={() => setAnualModo("dia_mes")}
                          />
                          Repetir em{" "}
                          <span className="font-semibold">
                            {diaMesBase}/{String(mesBaseIndex + 1).padStart(
                              2,
                              "0"
                            )}
                          </span>{" "}
                          nos meses selecionados.
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            className="text-emerald-600"
                            checked={anualModo === "ordem_semana"}
                            onChange={() => setAnualModo("ordem_semana")}
                          />
                          Repetir na{" "}
                          <span className="font-semibold">
                            {ehUltimaSemana ? "última" : `${ordemSemanaBase}ª`}
                          </span>{" "}
                          <span className="font-semibold">
                            {diaSemanaBaseLabel}
                          </span>{" "}
                          dos meses selecionados.
                        </label>
                      </div>

                      <div className="mt-2">
                        <p className="text-[11px] font-medium text-emerald-900 mb-1">
                          Meses para repetir:
                        </p>
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
              O administrador pode usar esta tela tanto para aprovar/negar
              solicitações feitas pelos usuários quanto para criar{" "}
              <strong>bloqueios internos</strong> (eventos fixos da Escola da
              Saúde). A recorrência é aplicada somente no momento da criação da
              reserva.
            </p>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
          {isEdicao ? (
            <button
              type="button"
              onClick={excluirReserva}
              disabled={loading}
              className="px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Excluir reserva
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">
              Dica: use o status &quot;Bloqueado&quot; para reservar horário
              para eventos internos e impedir solicitações de usuários.
            </span>
          )}

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
              {loading
                ? isEdicao
                  ? "Salvando..."
                  : "Criando..."
                : isEdicao
                ? "Salvar alterações"
                : "Criar reserva"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
