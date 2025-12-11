// ✅ src/components/ModalReservaAdmin.jsx
import { useState } from "react";
import { motion } from "framer-motion";
import { X, Users, Coffee, CalendarDays, RefreshCw, FileText } from "lucide-react";
import { toast } from "react-toastify";
import api from "../services/api";

const STATUS_OPTIONS = [
  { value: "pendente",  label: "Pendente" },
  { value: "aprovado",  label: "Aprovado" },
  { value: "rejeitado", label: "Rejeitado" },
  { value: "cancelado", label: "Cancelado" },
  { value: "bloqueado", label: "Bloqueado (Administrativo)" },
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function ModalReservaAdmin({
  onClose,
  slot,            // { dataISO, periodo }
  reserva,         // reserva existente ou null
  sala,            // 'auditorio' | 'sala_reuniao'
  capacidadeSala,  // { conforto, max }
  recarregar,
}) {
  const ehNovo = !reserva;
  const baseURL = (api.defaults?.baseURL || "").replace(/\/+$/, "");

  // Dados base do slot
  const baseDate = new Date(`${slot.dataISO}T12:00:00`);
  const baseWeekday = baseDate.getDay();
  const baseDayOfMonth = baseDate.getDate();
  const baseMonthIndex = baseDate.getMonth();
  const baseYear = baseDate.getFullYear();
  const baseOrdemSemana = Math.floor((baseDayOfMonth - 1) / 7) + 1;
  const lastDayOfMonth = new Date(baseYear, baseMonthIndex + 1, 0).getDate();
  const defaultEhUltimaSemana = baseDayOfMonth + 7 > lastDayOfMonth;

  // Campos básicos
  const [qtdPessoas, setQtdPessoas]   = useState(reserva?.qtd_pessoas || "");
  const [coffeeBreak, setCoffeeBreak] = useState(reserva?.coffee_break || false);
  const [status, setStatus]           = useState(reserva?.status || "aprovado");
  const [observacao, setObservacao]   = useState(reserva?.observacao || "");
  const [finalidade, setFinalidade]   = useState(reserva?.finalidade || "");
  const [loading, setLoading]         = useState(false);

  // Recorrência (apenas para novas reservas)
  const [tipoRecorrencia, setTipoRecorrencia] = useState("nenhuma"); // 'nenhuma' | 'semanal' | 'mensal' | 'anual'
  const [repeticoes, setRepeticoes]           = useState("4");

  // semanal
  const [intervaloSemanas, setIntervaloSemanas] = useState("1");
  const [diasSemanaSelecionados, setDiasSemanaSelecionados] = useState([baseWeekday]);

  // mensal
  const [mensalModo, setMensalModo] = useState("dia_mes"); // 'dia_mes' | 'ordem_semana'
  const [diaMesBase, setDiaMesBase] = useState(String(baseDayOfMonth));
  const [ordemSemanaBase, setOrdemSemanaBase] = useState(String(baseOrdemSemana)); // '1'..'5'
  const [ehUltimaSemana, setEhUltimaSemana]   = useState(defaultEhUltimaSemana);

  // anual
  const [anualModo, setAnualModo] = useState("dia_mes"); // 'dia_mes' | 'ordem_semana'
  const [mesesSelecionados, setMesesSelecionados] = useState([baseMonthIndex]);

  const max = capacidadeSala.max;

  function toggleDiaSemana(diaIndex) {
    setDiasSemanaSelecionados(prev =>
      prev.includes(diaIndex) ? prev.filter(d => d !== diaIndex) : [...prev, diaIndex]
    );
  }
  function toggleMes(mIndex) {
    setMesesSelecionados(prev =>
      prev.includes(mIndex) ? prev.filter(m => m !== mIndex) : [...prev, mIndex]
    );
  }

  function buildRecorrenciaPayload() {
    if (!ehNovo || tipoRecorrencia === "nenhuma") return null;

    const rep = Number(repeticoes) || 0;
    if (rep <= 0) { toast.warn("Informe a quantidade de repetições da recorrência."); return null; }

    if (tipoRecorrencia === "semanal") {
      if (!diasSemanaSelecionados.length) {
        toast.warn("Selecione ao menos um dia da semana para a recorrência.");
        return null;
      }
      return {
        tipo: "semanal",
        repeticoes: rep,
        semanal: { intervaloSemanas: Number(intervaloSemanas) || 1, diasSemana: diasSemanaSelecionados },
      };
    }

    if (tipoRecorrencia === "mensal") {
      if (mensalModo === "dia_mes") {
        const dia = Number(diaMesBase) || baseDayOfMonth;
        return { tipo: "mensal", repeticoes: rep, mensal: { modo: "dia_mes", diaMesBase: dia } };
      }
      const ordem = ehUltimaSemana ? baseOrdemSemana : Number(ordemSemanaBase) || baseOrdemSemana;
      return {
        tipo: "mensal",
        repeticoes: rep,
        mensal: {
          modo: "ordem_semana",
          diaSemanaBaseIndex: baseWeekday,
          ordemSemanaBase: ordem,
          ehUltimaSemana,
        },
      };
    }

    if (tipoRecorrencia === "anual") {
      if (!mesesSelecionados.length) {
        toast.warn("Selecione ao menos um mês para a recorrência anual.");
        return null;
      }
      const dia = Number(diaMesBase) || baseDayOfMonth;
      if (anualModo === "dia_mes") {
        return {
          tipo: "anual",
          repeticoes: rep,
          anual: { modo: "dia_mes", diaMesBase: dia, mesBaseIndex: baseMonthIndex, meses: mesesSelecionados },
        };
      }
      const ordem = ehUltimaSemana ? baseOrdemSemana : Number(ordemSemanaBase) || baseOrdemSemana;
      return {
        tipo: "anual",
        repeticoes: rep,
        anual: {
          modo: "ordem_semana",
          diaMesBase: dia,
          mesBaseIndex: baseMonthIndex,
          diaSemanaBaseIndex: baseWeekday,
          ordemSemanaBase: ordem,
          ehUltimaSemana,
          meses: mesesSelecionados,
        },
      };
    }
    return null;
  }

  function trimmedOrNull(v) {
    const t = String(v ?? "").trim();
    return t.length ? t : null;
  }

  async function salvar() {
    try {
      setLoading(true);
      const qtd = Number(qtdPessoas);

      if (!qtd || qtd <= 0) { toast.warn("Informe a quantidade de pessoas."); return; }
      if (qtd > max)       { toast.warn(`A capacidade máxima desta sala é de ${max} pessoas.`); return; }

      if (ehNovo) {
        const recorrencia = buildRecorrenciaPayload();
        if (tipoRecorrencia !== "nenhuma" && !recorrencia) return;

        const payload = {
          sala,
          data: slot.dataISO,
          periodo: slot.periodo,
          qtd_pessoas: qtd,
          coffee_break: coffeeBreak,
          status,
          observacao: trimmedOrNull(observacao),
          finalidade: trimmedOrNull(finalidade),
          recorrencia: recorrencia || null,
        };

        const resp = await api.post("/salas/admin/reservas", payload);
        const inseridas = resp.data?.inseridas || [];
        const conflitos = resp.data?.conflitos || [];

        if (inseridas.length && conflitos.length) {
          toast.success(`Criadas ${inseridas.length} reservas. ${conflitos.length} datas já estavam ocupadas.`);
        } else if (inseridas.length) {
          toast.success(inseridas.length > 1 ? `${inseridas.length} reservas criadas com sucesso.` : "Reserva criada com sucesso.");
        } else {
          toast.warn(conflitos.length ? "Nenhuma reserva criada: todas as datas já estavam ocupadas." : "Nenhuma reserva criada.");
        }
      } else {
        await api.put(`/salas/admin/reservas/${reserva.id}`, {
          status,
          qtd_pessoas: qtd,
          coffee_break: coffeeBreak,
          observacao: trimmedOrNull(observacao),
          finalidade: trimmedOrNull(finalidade),
        });
        toast.success("Reserva atualizada.");
      }

      await recarregar();
      onClose();
    } catch (err) {
      console.error("[ModalReservaAdmin] Erro ao salvar:", err);
      const msg = err.response?.data?.erro || "Erro ao salvar reserva.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function excluir() {
    if (!reserva) return;
    const confirma = window.confirm("Tem certeza que deseja excluir esta reserva?");
    if (!confirma) return;
    try {
      setLoading(true);
      await api.delete(`/salas/admin/reservas/${reserva.id}`);
      toast.success("Reserva excluída.");
      await recarregar();
      onClose();
    } catch (err) {
      console.error("[ModalReservaAdmin] Erro ao excluir:", err);
      const msg = err.response?.data?.erro || "Erro ao excluir reserva.";
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 p-4 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-800">
              {ehNovo ? "Nova reserva" : "Detalhes da reserva"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              {slot.dataISO} • {slot.periodo === "manha" ? "Período da manhã" : "Período da tarde"} • {sala === "auditorio" ? "Auditório" : "Sala de Reunião"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {reserva && (
          <div className="mb-3 text-xs sm:text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2">
            <p>
              <span className="font-medium">Solicitante: </span>
              {reserva.solicitante_nome || reserva.nome_solicitante || `ID ${reserva.solicitante_id}`}
            </p>
            {reserva.solicitante_unidade && (
              <p><span className="font-medium">Unidade: </span>{reserva.solicitante_unidade}</p>
            )}
            {reserva.finalidade && (
              <p className="mt-1"><span className="font-medium">Finalidade: </span>{reserva.finalidade}</p>
            )}
          </div>
        )}

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Dados básicos */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600">Quantidade de pessoas</label>
                <input
                  type="number"
                  min={1}
                  max={max}
                  value={qtdPessoas}
                  onChange={(e) => setQtdPessoas(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="mt-0.5 text-[11px] text-slate-500">Capacidade máxima desta sala: {max} pessoas.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Coffee className="w-4 h-4 text-slate-500" />
              <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700">
                <input type="checkbox" className="rounded border-slate-300" checked={coffeeBreak} onChange={(e) => setCoffeeBreak(e.target.checked)} />
                Haverá coffee break?
              </label>
            </div>

            {/* Finalidade / Evento */}
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-slate-500 mt-1" />
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600">Finalidade / evento</label>
                <textarea
                  rows={2}
                  value={finalidade}
                  onChange={(e) => setFinalidade(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Ex.: Reunião da equipe da Atenção Básica, Aula do Curso X, Oficina Y..."
                />
                <p className="mt-0.5 text-[11px] text-slate-500">Descreva brevemente para qual atividade a sala será utilizada.</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Observação do administrador</label>
                <textarea
                  rows={3}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Ex.: reserva interna, ajustes de horário, observações gerais..."
                />
              </div>
            </div>
          </div>

          {/* Recorrência (apenas nova reserva) */}
          {ehNovo && (
            <div className="mt-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-3 py-3">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-semibold text-emerald-800 uppercase">Recorrência (opcional)</span>
              </div>

              <div className="grid sm:grid-cols-3 gap-3 mb-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Tipo</label>
                  <select
                    value={tipoRecorrencia}
                    onChange={(e) => setTipoRecorrencia(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="nenhuma">Nenhuma</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>

                {tipoRecorrencia !== "nenhuma" && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Nº de repetições</label>
                    <input
                      type="number" min={1} max={60}
                      value={repeticoes} onChange={(e) => setRepeticoes(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                {tipoRecorrencia === "semanal" && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Intervalo (semanas)</label>
                    <input
                      type="number" min={1} max={12}
                      value={intervaloSemanas} onChange={(e) => setIntervaloSemanas(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>

              {/* Config específica */}
              {tipoRecorrencia === "semanal" && (
                <div className="mt-2">
                  <p className="text-[11px] font-medium text-slate-600 mb-1">Dias da semana</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DIAS_SEMANA.map((label, idx) => {
                      const ativo = diasSemanaSelecionados.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleDiaSemana(idx)}
                          className={`px-2 py-1 rounded-full text-[11px] border ${
                            ativo ? "bg-emerald-600 text-white border-emerald-700"
                                  : "bg-white text-slate-700 border-slate-200"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {tipoRecorrencia === "mensal" && (
                <div className="mt-2 space-y-2 text-[11px] text-slate-600">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="font-medium">Repetir:</span>
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="radio" name="mensalModo" value="dia_mes"
                        checked={mensalModo === "dia_mes"} onChange={() => setMensalModo("dia_mes")}
                      />
                      todo dia
                      <input
                        type="number" min={1} max={31}
                        value={diaMesBase} onChange={(e) => setDiaMesBase(e.target.value)}
                        className="w-14 ml-1 rounded border border-slate-200 px-1 py-0.5 text-[11px]"
                      />
                      do mês
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center">
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="radio" name="mensalModo" value="ordem_semana"
                        checked={mensalModo === "ordem_semana"} onChange={() => setMensalModo("ordem_semana")}
                      />
                      na
                      <select
                        disabled={ehUltimaSemana} value={ordemSemanaBase}
                        onChange={(e) => setOrdemSemanaBase(e.target.value)}
                        className="mx-1 rounded border border-slate-200 px-1 py-0.5 text-[11px]"
                      >
                        <option value="1">1ª</option>
                        <option value="2">2ª</option>
                        <option value="3">3ª</option>
                        <option value="4">4ª</option>
                        <option value="5">5ª</option>
                      </select>
                      {DIAS_SEMANA[baseWeekday]} do mês
                    </label>

                    <label className="inline-flex items-center gap-1">
                      <input type="checkbox" checked={ehUltimaSemana} onChange={(e) => setEhUltimaSemana(e.target.checked)} />
                      Usar sempre a última {DIAS_SEMANA[baseWeekday]} do mês
                    </label>
                  </div>
                </div>
              )}

              {tipoRecorrencia === "anual" && (
                <div className="mt-2 space-y-2 text-[11px] text-slate-600">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="font-medium">Repetir:</span>
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="radio" name="anualModo" value="dia_mes"
                        checked={anualModo === "dia_mes"} onChange={() => setAnualModo("dia_mes")}
                      />
                      no dia
                      <input
                        type="number" min={1} max={31}
                        value={diaMesBase} onChange={(e) => setDiaMesBase(e.target.value)}
                        className="w-14 ml-1 rounded border border-slate-200 px-1 py-0.5 text-[11px]"
                      />
                      dos meses selecionados
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center">
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="radio" name="anualModo" value="ordem_semana"
                        checked={anualModo === "ordem_semana"} onChange={() => setAnualModo("ordem_semana")}
                      />
                      na
                      <select
                        disabled={ehUltimaSemana} value={ordemSemanaBase}
                        onChange={(e) => setOrdemSemanaBase(e.target.value)}
                        className="mx-1 rounded border border-slate-200 px-1 py-0.5 text-[11px]"
                      >
                        <option value="1">1ª</option>
                        <option value="2">2ª</option>
                        <option value="3">3ª</option>
                        <option value="4">4ª</option>
                        <option value="5">5ª</option>
                      </select>
                      {DIAS_SEMANA[baseWeekday]} dos meses selecionados
                    </label>

                    <label className="inline-flex items-center gap-1">
                      <input type="checkbox" checked={ehUltimaSemana} onChange={(e) => setEhUltimaSemana(e.target.checked)} />
                      Usar sempre a última {DIAS_SEMANA[baseWeekday]}
                    </label>
                  </div>

                  <div>
                    <p className="font-medium mb-1">Meses</p>
                    <div className="flex flex-wrap gap-1">
                      {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((label, idx) => {
                        const ativo = mesesSelecionados.includes(idx);
                        return (
                          <button
                            key={idx} type="button" onClick={() => toggleMes(idx)}
                            className={`px-2 py-1 rounded-full text-[11px] border ${
                              ativo ? "bg-emerald-600 text-white border-emerald-700"
                                    : "bg-white text-slate-700 border-slate-200"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {tipoRecorrencia !== "nenhuma" && (
                <div className="mt-2 flex items-start gap-2 text-[11px] text-emerald-800">
                  <RefreshCw className="w-3 h-3 mt-0.5" />
                  <p>
                    A data base é <strong>{slot.dataISO}</strong>. A recorrência será criada somente em dias úteis
                    (sem fins de semana, feriados ou pontos facultativos). Conflitos serão ignorados e informados após o salvamento.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          {reserva ? (
            <div className="flex items-center gap-2">
              <button
                type="button" onClick={excluir} disabled={loading}
                className="text-xs sm:text-sm text-red-600 hover:text-red-700 disabled:opacity-60"
              >
                Excluir reserva
              </button>

              {/* ✅ Cartaz do evento (PDF) */}
              <button
                type="button" onClick={abrirCartazPDF} disabled={!reserva?.id}
                className="text-xs sm:text-sm inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-300 text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
                title="Gerar cartaz em PDF (paisagem) para a porta da sala"
              >
                <FileText className="w-4 h-4" />
                Cartaz (PDF)
              </button>
            </div>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <button
              type="button" onClick={onClose}
              className="px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="button" onClick={salvar}
              disabled={loading || !qtdPessoas}
              className="px-4 py-1.5 text-xs sm:text-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Salvando..." : ehNovo ? "Criar reserva" : "Salvar"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default ModalReservaAdmin;
