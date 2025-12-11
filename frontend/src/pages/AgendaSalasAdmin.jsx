// ✅ src/pages/AgendaSalasAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Users,
  ShieldCheck,
  Info,
  FileText,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Footer from "../components/Footer";
import ModalReservaAdmin from "../components/ModalReservaAdmin";

/* ───────────────────────── Constantes ───────────────────────── */
const NOMES_MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

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

/* ─────────────────── Normalização de reservas ─────────────────── */
function normalizeReserva(r) {
  const dataISO = (r.data || r.dataISO || r.dia || "").slice(0, 10);
  return {
    id: r.id ?? r.reserva_id ?? r.uuid ?? null,
    sala: r.sala || r.room || null,
    data: dataISO,
    dataISO,
    periodo: r.periodo || r.turno || r.slot || "manha",
    status: r.status || "pendente",
    qtd_pessoas:  r.qtd_pessoas ?? r.qtdPessoas ?? r.qtd ?? r.capacidade ?? null,
    coffee_break: r.coffee_break ?? r.coffeeBreak ?? r.coffee ?? false,
    observacao:   r.observacao ?? r.obs ?? r.observacoes ?? r.observacao_admin ?? "",
    finalidade:   r.finalidade ?? r.descricao ?? r.titulo ?? r.assunto ?? "",
    solicitante_id: r.solicitante_id ?? r.usuario_id ?? r.user_id ?? null,
    solicitante_nome: r.solicitante_nome ?? r.usuario_nome ?? r.nome_solicitante ?? r.nome ?? null,
    solicitante_unidade: r.solicitante_unidade ?? r.unidade ?? r.unidade_nome ?? r.setor ?? null,
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
  const [reservasMap, setReservasMap] = useState({ auditorio: {}, sala_reuniao: {} });
  const [feriadosMap, setFeriadosMap] = useState({});
  const [datasBloqueadasMap, setDatasBloqueadasMap] = useState({});

  const [modalAberto, setModalAberto] = useState(false);
  const [slotSelecionado, setSlotSelecionado] = useState(null); // { dataISO, periodo, sala }
  const [reservaSelecionada, setReservaSelecionada] = useState(null);

  const semanas = useMemo(() => criarMatrixMes(ano, mesIndex), [ano, mesIndex]);

  useEffect(() => {
    carregarAgenda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mesIndex]);

  async function carregarAgenda() {
    try {
      setLoading(true);

      const anoParam = ano;
      const mesParam = mesIndex + 1;

      console.log("[AgendaSalasAdmin] carregando agenda:", {
        ano: anoParam,
        mes: mesParam,
      });

      // Monta a querystring manualmente para evitar qualquer problema com axios/params
      const qsAuditorio = new URLSearchParams({
        ano: String(anoParam),
        mes: String(mesParam),
        sala: "auditorio",
      }).toString();

      const qsSalaReuniao = new URLSearchParams({
        ano: String(anoParam),
        mes: String(mesParam),
        sala: "sala_reuniao",
      }).toString();

      const [respA, respS] = await Promise.all([
        api.get(`/salas/agenda-admin?${qsAuditorio}`),
        api.get(`/salas/agenda-admin?${qsSalaReuniao}`),
      ]);

      const dataAuditorio   = respA?.data ?? respA ?? {};
      const dataSalaReuniao = respS?.data ?? respS ?? {};

      // ----- mapa auditório -----
      const mapAuditorio = {};
      for (const r of (dataAuditorio.reservas || [])) {
        const nr = normalizeReserva(r);
        if (!nr.dataISO) continue;
        if (nr.sala && nr.sala !== "auditorio") continue;
        mapAuditorio[keySlot(nr.dataISO, nr.periodo)] = nr;
      }

      // ----- mapa sala de reunião -----
      const mapSalaReuniao = {};
      for (const r of (dataSalaReuniao.reservas || [])) {
        const nr = normalizeReserva(r);
        if (!nr.dataISO) continue;
        if (nr.sala && nr.sala !== "sala_reuniao") continue;
        mapSalaReuniao[keySlot(nr.dataISO, nr.periodo)] = nr;
      }

      // ----- feriados -----
      const ferMap = {};
      const feriadosBase = dataAuditorio.feriados?.length
        ? dataAuditorio.feriados
        : (dataSalaReuniao.feriados || []);
      for (const f of feriadosBase || []) {
        const dataISO = (f.data || "").slice(0, 10);
        if (dataISO) ferMap[dataISO] = f;
      }

      // ----- datas bloqueadas -----
      const bloqueiosMap = {};
      const bloqueiosBase = dataAuditorio.datas_bloqueadas?.length
        ? dataAuditorio.datas_bloqueadas
        : (dataSalaReuniao.datas_bloqueadas || []);
      for (const b of bloqueiosBase || []) {
        const dataISO = (b.data || "").slice(0, 10);
        if (dataISO) bloqueiosMap[dataISO] = b;
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

                      <div className="flex flex-col gap-1.5 mt-auto">
                        {["sala_reuniao","auditorio"].map((salaKey) => {
                          const cap = CAPACIDADES_SALA[salaKey];

                          return (
                            <div key={salaKey} className="rounded-lg border border-slate-100 bg-slate-50/70">
                              {/* Título da sala centralizado */}
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

                                  const textoDireita =
                                    status === "aprovado" && res?.finalidade
                                      ? res.finalidade
                                      : (status === "pendente" && res?.finalidade
                                          ? `Pendente — ${res.finalidade}`
                                          : labelStatus(status));

                                  return (
                                    <button
                                      key={p.value}
                                      type="button"
                                      onClick={() => !disabled && abrirModalSlot(dia, p.value, salaKey)}
                                      className={`w-full text-left text-[11px] sm:text-xs px-2 py-1.5 rounded-xl flex items-start justify-between gap-2 transition ${classesStatus(status)} ${disabled ? "cursor-not-allowed" : ""}`}
                                    >
                                      <span className="font-medium shrink-0">{p.label}</span>
                                      <span
                                        className="text-[10px] leading-snug break-words whitespace-normal text-right flex-1"
                                        title={textoDireita}
                                      >
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

      {/* Modal externo */}
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
