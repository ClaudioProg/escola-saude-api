// ✅ src/pages/AgendaSalasUsuario.jsx
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Users,
  Info,
  Pencil,
  Trash2,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import api from "../services/api";
import Footer from "../components/Footer";
import ModalSolicitarReserva from "../components/ModalSolicitarReserva";

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

const SALAS = [
  { value: "sala_reuniao", label: "Sala de Reunião", conforto: 25, max: 30 },
  { value: "auditorio", label: "Auditório", conforto: 50, max: 60 },
];

const PERIODOS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
];

/* Helpers de datas — matriz do mês + "hoje" sem fuso */
function criarMatrixMes(ano, mesIndex) {
  const primeiroDia = new Date(ano, mesIndex, 1);
  const ultimoDia = new Date(ano, mesIndex + 1, 0);
  const primeiroDiaSemana = primeiroDia.getDay(); // 0 domingo

  const diasNoMes = ultimoDia.getDate();
  const semanas = [];
  let semanaAtual = new Array(7).fill(null);
  let dia = 1;

  // Espaços em branco antes do dia 1
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
   * }
   *
   * Obs: esta rota é /salas/agenda-usuario, então vamos assumir que
   * TODAS as reservas retornadas são do usuário logado.
   */
  const [reservasMap, setReservasMap] = useState({});
  const [feriadosMap, setFeriadosMap] = useState({});
  const [datasBloqueadasMap, setDatasBloqueadasMap] = useState({});
  const [modalAberto, setModalAberto] = useState(false);
  const [slotSelecionado, setSlotSelecionado] = useState(null); // {dataISO, periodo, sala}
  const [modalModo, setModalModo] = useState("criar"); // 'criar' | 'editar'
  const [reservaEmEdicao, setReservaEmEdicao] = useState(null);

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

      const data = await api.get("/salas/agenda-usuario", {
        params: { ano, mes: mesIndex + 1 },
      });

      console.log("[AgendaSalasUsuario] payload recebido:", data);

      const map = {};
      for (const r of data.reservas || []) {
        const dataISO = (r.data || "").slice(0, 10);
        const salaKey = r.sala; // 'auditorio' | 'sala_reuniao'
        const periodoKey = r.periodo; // 'manha' | 'tarde'
        if (!dataISO || !salaKey || !periodoKey) continue;

        if (!map[dataISO]) map[dataISO] = {};
        if (!map[dataISO][salaKey]) map[dataISO][salaKey] = {};
        map[dataISO][salaKey][periodoKey] = r;
      }

      const ferMap = {};
      for (const f of data.feriados || []) {
        const dataISO = (f.data || "").slice(0, 10);
        if (!dataISO) continue;
        ferMap[dataISO] = f;
      }

      const bloqueadasMap = {};
      for (const b of data.datas_bloqueadas || []) {
        const dataISO = (b.data || "").slice(0, 10);
        if (!dataISO) continue;
        bloqueadasMap[dataISO] = b;
      }

      setReservasMap(map);
      setFeriadosMap(ferMap);
      setDatasBloqueadasMap(bloqueadasMap);
    } catch (err) {
      console.error("[AgendaSalasUsuario] Erro ao carregar agenda:", err);
      toast.error("Erro ao carregar disponibilidade das salas.");
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
   * - "oculto": não deve aparecer para o usuário (fim de semana, feriado,
   *             data bloqueada ou reserva bloqueada/uso interno)
   * - "livre": slot disponível para o usuário solicitar
   * - "minha_solicitacao_pendente": o usuário já solicitou, em análise
   * - "minha_reserva_aprovada": o usuário tem reserva aprovada/confirmada
   */
  function getStatusSlot(salaValue, dataISO, periodo) {
    const d = new Date(dataISO + "T12:00:00");
    const diaSemana = d.getDay(); // 0 domingo, 6 sábado

    const ehFeriado = !!feriadosMap[dataISO];
    const ehBloqueada = !!datasBloqueadasMap[dataISO];

    // Dia inteiro indisponível (não mostra nada dentro da célula)
    if (diaSemana === 0 || diaSemana === 6 || ehFeriado || ehBloqueada) {
      return "oculto";
    }

    const reserva = reservasMap[dataISO]?.[salaValue]?.[periodo] || null;
    if (!reserva) return "livre";

    // se está bloqueado para uso interno, some para o usuário
    if (reserva.status === "bloqueado") {
      return "oculto";
    }

    // cancelado/rejeitado -> volta a ser livre para o usuário
    if (reserva.status === "cancelado" || reserva.status === "rejeitado") {
      return "livre";
    }

    // esta rota é só do usuário, então qualquer reserva aqui é dele
    if (
      reserva.status === "pendente" ||
      reserva.status === "em_analise" ||
      reserva.status === "solicitado"
    ) {
      return "minha_solicitacao_pendente";
    }

    if (reserva.status === "aprovado" || reserva.status === "confirmado") {
      return "minha_reserva_aprovada";
    }

    // fallback
    return "minha_solicitacao_pendente";
  }

  function getReservaDoSlot(salaValue, dataISO, periodo) {
    return reservasMap[dataISO]?.[salaValue]?.[periodo] || null;
  }

  function labelStatus(status) {
    switch (status) {
      case "minha_solicitacao_pendente":
        return "Minha solicitação (em análise)";
      case "minha_reserva_aprovada":
        return "Minha reserva aprovada";
      case "livre":
        return "Disponível";
      case "oculto":
      default:
        return "";
    }
  }

  function classesStatus(status) {
    switch (status) {
      case "minha_solicitacao_pendente":
        return "bg-amber-50 text-amber-700 border border-amber-200 cursor-default";
      case "minha_reserva_aprovada":
        return "bg-sky-50 text-sky-700 border border-sky-200 cursor-default";
      case "livre":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100";
      case "oculto":
      default:
        return "";
    }
  }

  // === Ações de pendentes ===
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

  async function excluirReserva(reserva) {
    try {
      const ok = window.confirm("Confirmar exclusão desta solicitação?");
      if (!ok) return;
      await api.delete(`/salas/minhas/${reserva.id}`);
      toast.success("Solicitação excluída com sucesso.");
      await carregarAgenda();
    } catch (err) {
      console.error("[excluirReserva] erro:", err);
      const msg =
        err?.response?.data?.erro ||
        "Não foi possível excluir a solicitação.";
      toast.error(msg);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* HeaderHero com tema próprio desta página */}
      <header className="bg-gradient-to-r from-sky-600 via-indigo-500 to-blue-700 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-3 bg-white/10 rounded-2xl">
                <CalendarDays className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold">
                  Agendamento de Salas
                </h1>
                <p className="text-sm sm:text-base text-sky-50">
                  Visualize somente datas livres e suas solicitações de uso do
                  auditório e da sala de reunião (manhã e tarde).
                </p>
              </div>
            </div>

            {/* Ministats */}
            <div className="flex gap-3 flex-wrap">
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

              <div className="bg-white/10 rounded-2xl px-3 py-2 text-xs sm:text-sm max-w-[260px]">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  <span>Regras</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-sky-50/90">
                  Você verá apenas horários livres para solicitação e suas
                  próprias solicitações. Finais de semana, feriados, datas
                  bloqueadas e reservas internas não aparecem no calendário.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main
        id="conteudo"
        className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 sm:py-8"
      >
        {/* Barra de controles (mês/ano) */}
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

        {loading && (
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Skeleton width={80} height={20} />
          </div>
        )}
        </div>

        {/* Legenda */}
        <div className="mb-4 flex flex-wrap gap-2 text-xs sm:text-sm">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-50 border border-emerald-200" />{" "}
            Disponível para solicitar
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-50 border border-amber-200" />{" "}
            Minha solicitação (em análise)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-sky-50 border border-sky-200" />{" "}
            Minha reserva aprovada
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
                        className="min-h-[72px] sm:min-h-[96px] border-r border-slate-100 bg-slate-50/40"
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

                  if (diaIndisponivelGeral) {
                    return (
                      <div
                        key={idxDia}
                        className="min-h-[120px] sm:min-h-[130px] border-r border-slate-100 p-1.5 sm:p-2 flex flex-col bg-slate-50/40"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs sm:text-sm font-medium ${
                              eHoje ? "text-sky-600" : "text-slate-500"
                            }`}
                          >
                            {dia}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idxDia}
                      className="min-h-[132px] sm:min-h-[150px] border-r border-slate-100 p-1.5 sm:p-2 flex flex-col"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs sm:text-sm font-medium ${
                            eHoje ? "text-sky-600" : "text-slate-700"
                          }`}
                        >
                          {dia}
                        </span>
                      </div>

                      {/* Blocos de salas + períodos */}
                      <div className="flex flex-col gap-1 mt-auto">
                        {SALAS.map((salaItem) => (
                          <div
                            key={salaItem.value}
                            className="rounded-lg border border-slate-100 bg-slate-50/60 px-1.5 py-1 flex flex-col gap-0.5"
                          >
                            <p className="text-[11px] font-semibold text-slate-600 mb-0.5">
                              {salaItem.label}
                            </p>

                            {PERIODOS.map((p) => {
                              const status = getStatusSlot(
                                salaItem.value,
                                dataISO,
                                p.value
                              );

                              // placeholder invisível p/ manter altura quando oculto
                              if (status === "oculto") {
                                return (
                                  <div
                                    key={p.value}
                                    className="w-full text-[11px] sm:text-xs px-2 py-1 rounded-xl opacity-0 pointer-events-none"
                                  >
                                    placeholder
                                  </div>
                                );
                              }

                              const reserva = getReservaDoSlot(
                                salaItem.value,
                                dataISO,
                                p.value
                              );

                              if (status === "minha_solicitacao_pendente" && reserva) {
                                return (
                                  <div
                                    key={p.value}
                                    className="w-full px-2 py-1 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-[11px] sm:text-xs"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-medium">{p.label}</span>
                                      {/* finalidade no lugar do rótulo genérico */}
                                      <span className="text-[10px] leading-snug break-words whitespace-normal">
                                        {String(reserva.finalidade || "—").trim()}
                                      </span>
                                    </div>
                                    {/* botões centralizados; só ícone de lápis */}
                                    <div className="mt-1 flex items-center justify-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => iniciarEdicao(reserva)}
                                        className="inline-flex items-center justify-center p-1.5 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300"
                                        title="Editar solicitação"
                                      >
                                        <Pencil className="w-4 h-4" />
                                        <span className="sr-only">Editar</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => excluirReserva(reserva)}
                                        className="inline-flex items-center justify-center p-1.5 rounded-md border border-red-300 text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
                                        title="Excluir solicitação"
                                      >
                                       <Trash2 className="w-4 h-4" />
                                        <span className="sr-only">Excluir</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              // aprovado/confirmado: apenas indicativo
                              if (status === "minha_reserva_aprovada" && reserva) {
                                return (
                                  <div
                                    key={p.value}
                                    className="w-full px-2 py-1 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 text-[11px] sm:text-xs"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-medium">{p.label}</span>
                                      {/* finalidade no lugar do rótulo genérico */}
                                      <span className="text-[10px] leading-snug break-words whitespace-normal">
                                        {String(reserva.finalidade || "—").trim()}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }

                              // livre: botão para abrir modal de criação
                              return (
                                <button
                                  key={p.value}
                                  type="button"
                                  onClick={() =>
                                    abrirModalSlot(dia, salaItem.value, p.value)
                                  }
                                  className={`w-full text-left text-[11px] sm:text-xs px-2 py-1 rounded-xl flex items-center justify-between gap-1 transition ${classesStatus(
                                    status
                                  )}`}
                                >
                                  <span className="font-medium">
                                    {p.label}
                                  </span>
                                  <span className="text-[10px] truncate">
                                    Disponível
                                  </span>
                                </button>
                              );
                            })}
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
          sala={
            (modalModo === "criar" && slotSelecionado?.sala) ||
            (modalModo === "editar" && reservaEmEdicao?.sala) ||
            null
          }
          capacidadeSala={
            SALAS.find(
              (s) =>
                s.value ===
                ((modalModo === "criar"
                  ? slotSelecionado?.sala
                  : reservaEmEdicao?.sala) || "")
            ) || { conforto: 0, max: 0 }
          }
          // edição
          modo={modalModo}                 // 'criar' | 'editar'
          reservaAtual={reservaEmEdicao}   // objeto da reserva ao editar
        />
      )}
    </div>
  );
}

export default AgendaSalasUsuario;
