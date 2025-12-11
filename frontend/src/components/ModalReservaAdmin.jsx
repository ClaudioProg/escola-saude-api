// ✅ src/components/ModalReservaAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  X as CloseIcon,
  Users,
  Coffee,
  ShieldCheck,
  Info,
  Repeat,
  FileText,
  RefreshCw,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../services/api";

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

function ModalReservaAdmin({
  onClose,
  slot, // { dataISO, periodo, sala }
  reserva, // reserva existente ou null
  sala, // 'auditorio' | 'sala_reuniao'
  capacidadeSala, // { conforto, max }
  recarregar,
}) {
  const isEdicao = !!reserva;

  const baseURL = (api.defaults?.baseURL || "").replace(/\/+$/, "");

  // Base da data do slot
  const dataBase = new Date(`${slot.dataISO}T12:00:00`);
  const diaMesBase = dataBase.getDate();
  const mesBaseIndex = dataBase.getMonth();
  const diaSemanaBaseIndex = dataBase.getDay();
  const diaSemanaBaseLabel =
    DIAS_SEMANA_LABEL_COMPLETO[diaSemanaBaseIndex] || "";

  // ordem (1ª..última) do dia da semana no mês
  const { ordemSemanaBase, ehUltimaSemana } = useMemo(() => {
    const dia = dataBase.getDate();
    const ordem = Math.floor((dia - 1) / 7) + 1; // 1-5
    const maisSete = new Date(dataBase);
    maisSete.setDate(dia + 7);
    const ehUltima = maisSete.getMonth() !== dataBase.getMonth();
    return { ordemSemanaBase: ordem, ehUltimaSemana: ehUltima };
  }, [dataBase]);

  const safeCap = capacidadeSala || { conforto: 0, max: 999 };
  const max = safeCap.max;

  // Normalizações de reserva
  const reservaQtd =
    reserva?.qtd_pessoas ?? reserva?.qtdPessoas ?? reserva?.qtd ?? "";
  const reservaCoffee =
    reserva?.coffee_break ?? reserva?.coffeeBreak ?? false;
  const reservaObs = reserva?.observacao ?? reserva?.obs ?? "";
  const reservaFinal =
    reserva?.finalidade ??
    reserva?.descricao ??
    reserva?.titulo ??
    "";
  const solicitanteNome =
    reserva?.solicitante_nome ||
    reserva?.usuario_nome ||
    reserva?.nome_solicitante ||
    reserva?.nome ||
    (reserva?.solicitante_id ? `ID ${reserva.solicitante_id}` : "");
  const solicitanteUnidade =
    reserva?.solicitante_unidade ||
    reserva?.unidade ||
    reserva?.unidade_nome ||
    reserva?.setor;

  // Campos básicos
  const [qtdPessoas, setQtdPessoas] = useState(reservaQtd);
  const [coffeeBreak, setCoffeeBreak] = useState(reservaCoffee);
  const [status, setStatus] = useState(reserva?.status || "aprovado");
  const [observacao, setObservacao] = useState(reservaObs);
  const [finalidade, setFinalidade] = useState(reservaFinal);
  const [loading, setLoading] = useState(false);

  // Recorrência (nova versão — igual a da AgendaSalasAdmin moderna)
  const [usarRecorrencia, setUsarRecorrencia] = useState(false);
  const [tipoRecorrencia, setTipoRecorrencia] = useState("semanal"); // semanal | mensal | anual | sempre
  const [qtdRepeticoes, setQtdRepeticoes] = useState(4);
  const [limiteMesesSempre, setLimiteMesesSempre] = useState(24);

  // semanal
  const [intervaloSemanas, setIntervaloSemanas] = useState(1);
  const [diasSemanaRecorrencia, setDiasSemanaRecorrencia] = useState(() => {
    return [diaSemanaBaseIndex];
  });

  // mensal
  const [mensalModo, setMensalModo] = useState("dia_mes"); // dia_mes | ordem_semana

  // anual
  const [anualModo, setAnualModo] = useState("dia_mes"); // dia_mes | ordem_semana
  const [mesesAnual, setMesesAnual] = useState([mesBaseIndex]);

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
    if (!usarRecorrencia || isEdicao) return null;

    if (tipoRecorrencia === "sempre") {
      const limite = Math.max(
        1,
        Math.min(120, Number(limiteMesesSempre) || 24)
      );
      return { tipo: "sempre", limiteMeses: limite };
    }

    const repeticoes = Number(qtdRepeticoes) || 0;
    if (repeticoes <= 0) {
      toast.warn("Informe a quantidade de repetições.");
      return null;
    }

    const base = { tipo: tipoRecorrencia, repeticoes };

    if (tipoRecorrencia === "semanal") {
      if (!diasSemanaRecorrencia.length) {
        toast.warn("Selecione ao menos um dia da semana.");
        return null;
      }
      return {
        ...base,
        semanal: {
          intervaloSemanas: Number(intervaloSemanas) || 1,
          diasSemana: diasSemanaRecorrencia,
        },
      };
    }

    if (tipoRecorrencia === "mensal") {
      if (mensalModo === "ordem_semana") {
        return {
          ...base,
          mensal: {
            modo: "ordem_semana",
            diaSemanaBaseIndex,
            ordemSemanaBase,
            ehUltimaSemana,
          },
        };
      }
      return {
        ...base,
        mensal: {
          modo: "dia_mes",
          diaMesBase,
          diaSemanaBaseIndex,
          ordemSemanaBase,
          ehUltimaSemana,
        },
      };
    }

    if (tipoRecorrencia === "anual") {
      if (!mesesAnual.length) {
        toast.warn("Selecione ao menos um mês para a recorrência anual.");
        return null;
      }
      return {
        ...base,
        anual: {
          modo: anualModo,
          diaMesBase,
          mesBaseIndex,
          diaSemanaBaseIndex,
          ordemSemanaBase,
          ehUltimaSemana,
          meses: mesesAnual,
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
        observacao: trimmedOrNull(observacao),
        finalidade: trimmedOrNull(finalidade),
      };
  
      if (isEdicao) {
        await api.put(`/salas/admin/reservas/${reserva.id}`, payloadBase);
        toast.success("Reserva atualizada com sucesso.");
      } else {
        const recorrencia = construirRecorrenciaPayload();
        if (usarRecorrencia && !recorrencia) {
          // já mostrou alerta dentro de construirRecorrenciaPayload
          return;
        }
  
        const resp = await api.post("/salas/admin/reservas", {
          ...payloadBase,
          recorrencia: recorrencia || null,
        });
  
        // 👇 Aqui está o ajuste importante
        const data = resp?.data ?? resp ?? {};
        const inseridas = data.inseridas || [];
        const conflitos = data.conflitos || [];
  
        const qtdCriadas = inseridas.length;
        const qtdConflitos = conflitos.length;
  
        if (qtdCriadas > 0) {
          const msgBase =
            qtdCriadas === 1
              ? "Reserva criada com sucesso."
              : `${qtdCriadas} reservas criadas com sucesso.`;
  
          if (qtdConflitos > 0) {
            toast.warn(
              `${msgBase} Algumas datas já estavam reservadas e foram ignoradas (${qtdConflitos}).`
            );
          } else {
            toast.success(msgBase);
          }
        } else if (qtdConflitos > 0) {
          toast.warn(
            "Nenhuma reserva criada: todas as datas já estavam ocupadas."
          );
        } else {
          toast.warn("Nenhuma reserva criada.");
        }
      }
  
      await recarregar();
      onClose();
    } catch (err) {
      console.error("[ModalReservaAdmin] Erro ao salvar:", err);
      const msg =
        err?.response?.data?.erro || "Erro ao salvar a reserva da sala.";
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
        err?.response?.data?.erro || "Erro ao excluir a reserva da sala.";
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

  const tituloModal = isEdicao
    ? "Editar reserva / solicitação"
    : "Criar reserva / bloqueio";
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

        {/* Corpo */}
        <div className="px-4 pb-4 pt-2 space-y-4">
          {/* Solicitante (read-only) */}
          {(solicitanteNome || solicitanteUnidade || reservaFinal) && (
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs sm:text-sm text-slate-700 flex flex-col gap-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500" />
                  <span>
                    <span className="font-semibold">Solicitante: </span>
                    {solicitanteNome}
                    {solicitanteUnidade && (
                      <span className="text-slate-500">
                        {" "}
                        • {solicitanteUnidade}
                      </span>
                    )}
                  </span>
                </div>
                {reserva?.status && (
                  <span className="inline-flex items-center text-[11px] px-2 py-1 rounded-full bg-slate-200 text-slate-700">
                    Status atual: {reserva.status}
                  </span>
                )}
              </div>

              {reservaFinal && (
                <div className="flex items-start gap-2 mt-1">
                  <FileText className="w-3 h-3 text-slate-500 mt-0.5" />
                  <p className="text-[11px] sm:text-xs">
                    <span className="font-semibold">Finalidade: </span>
                    {reservaFinal}
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
                placeholder="Ex.: Reunião da equipe, Aula do Curso X, Oficina Y..."
              />
              <p className="mt-0.5 text-[11px] text-slate-500">
                Descreva brevemente para qual atividade a sala será utilizada.
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
                    <p className="text-xs sm:text-sm font-semibold text-emerald-900">
                      Recorrência (opcional)
                    </p>
                    <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-emerald-900">
                      <input
                        type="checkbox"
                        className="rounded border-emerald-400"
                        checked={usarRecorrencia}
                        onChange={(e) =>
                          setUsarRecorrencia(e.target.checked)
                        }
                      />
                      Aplicar recorrência
                    </label>
                  </div>
                  <p className="text-[11px] text-emerald-900/80 mt-1">
                    Repita este horário como semanal, mensal, anual{" "}
                    <em>ou</em> “sempre” (mensal contínuo).
                  </p>
                </div>
              </div>

              {usarRecorrencia && (
                <div className="space-y-3">
                  {/* Tipo + quantidade/limite */}
                  <div className="grid sm:grid-cols-[1.3fr,0.7fr] gap-3">
                    <div>
                      <label className="block text-xs font-medium text-emerald-900">
                        Tipo de recorrência
                      </label>
                      <select
                        value={tipoRecorrencia}
                        onChange={(e) =>
                          setTipoRecorrencia(e.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="semanal">Semanal</option>
                        <option value="mensal">Mensal</option>
                        <option value="anual">Anual</option>
                        <option value="sempre">
                          Sempre (mensal contínuo)
                        </option>
                      </select>
                    </div>

                    {tipoRecorrencia === "sempre" ? (
                      <div>
                        <label className="block text-xs font-medium text-emerald-900">
                          Limite (meses)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={limiteMesesSempre}
                          onChange={(e) =>
                            setLimiteMesesSempre(e.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <p className="text-[10px] text-emerald-900/80 mt-0.5">
                          Repete mensalmente na mesma data, por até{" "}
                          {String(limiteMesesSempre)} mês(es).
                        </p>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-emerald-900">
                          Quantidade de repetições
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={qtdRepeticoes}
                          onChange={(e) =>
                            setQtdRepeticoes(e.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <p className="text-[10px] text-emerald-900/80 mt-0.5">
                          Considera apenas ocorrências futuras contando da
                          data selecionada.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Config específica */}
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
                              onClick={() =>
                                toggleDiaSemanaRecorrencia(idx)
                              }
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
                          <span className="font-semibold">
                            {diaMesBase}
                          </span>{" "}
                          de cada mês.
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            className="text-emerald-600"
                            checked={mensalModo === "ordem_semana"}
                            onChange={() =>
                              setMensalModo("ordem_semana")
                            }
                          />
                          Repetir toda{" "}
                          <span className="font-semibold">
                            {ehUltimaSemana
                              ? "última"
                              : `${ordemSemanaBase}ª`}
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
                            {diaMesBase}/
                            {String(mesBaseIndex + 1).padStart(2, "0")}
                          </span>{" "}
                          nos meses selecionados.
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            className="text-emerald-600"
                            checked={anualModo === "ordem_semana"}
                            onChange={() =>
                              setAnualModo("ordem_semana")
                            }
                          />
                          Repetir na{" "}
                          <span className="font-semibold">
                            {ehUltimaSemana
                              ? "última"
                              : `${ordemSemanaBase}ª`}
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
              Use esta tela para aprovar/negar solicitações ou criar{" "}
              <strong>bloqueios internos</strong>. A recorrência (incluindo
              “sempre”) é aplicada somente na criação. As datas que caírem em
              finais de semana, feriados ou pontos facultativos serão
              automaticamente ignoradas.
            </p>
          </div>
        </div>

        {/* Rodapé */}
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

                {/* Cartaz PDF */}
                <button
                  type="button"
                  onClick={abrirCartazPDF}
                  className="px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-emerald-300 text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
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

export default ModalReservaAdmin;
