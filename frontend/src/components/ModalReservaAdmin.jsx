// ✅ src/components/ModalReservaAdmin.jsx
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Coffee,
  ShieldCheck,
  Info,
  Repeat,
  FileText,
  Trash2,
  X as CloseIcon,
  CalendarDays,
  Clock,
  Building2,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../services/api";
import Modal from "./Modal";

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

const PERIODOS = {
  manha: "Período da manhã",
  tarde: "Período da tarde",
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toBrDateFromISO(dateISO) {
  // date-only safe (evita shift) — interpreta como local usando T12:00
  if (!dateISO) return "—";
  const d = new Date(`${String(dateISO).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(+d)) return String(dateISO);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function cls(...p) {
  return p.filter(Boolean).join(" ");
}

function trimmedOrNull(v) {
  const t = String(v ?? "").trim();
  return t.length ? t : null;
}

export default function ModalReservaAdmin({
  isOpen = true,
  onClose,
  slot, // { dataISO, periodo, sala }
  reserva, // reserva existente ou null
  sala, // 'auditorio' | 'sala_reuniao'
  capacidadeSala, // { conforto, max }
  recarregar,
}) {
  const uid = useId();
  const titleId = `modal-reserva-admin-title-${uid}`;
  const descId = `modal-reserva-admin-desc-${uid}`;
  const firstFocusRef = useRef(null);

  const isEdicao = !!reserva;
  const baseURL = (api.defaults?.baseURL || "").replace(/\/+$/, "");

  // Guards
  const dataISO = slot?.dataISO?.slice?.(0, 10) || "";
  const periodo = slot?.periodo || "manha";
  const salaKey = sala || slot?.sala || "sala_reuniao";

  const salaLabel = salaKey === "auditorio" ? "Auditório" : "Sala de Reunião";
  const periodoLabel = PERIODOS[periodo] || "Período";

  // Base da data do slot (date-only safe, evita pulo por TZ)
  const dataBase = useMemo(() => {
    if (!dataISO) return null;
    const d = new Date(`${dataISO}T12:00:00`);
    return Number.isNaN(+d) ? null : d;
  }, [dataISO]);

  const diaMesBase = dataBase?.getDate?.() ?? null;
  const mesBaseIndex = dataBase?.getMonth?.() ?? 0;
  const diaSemanaBaseIndex = dataBase?.getDay?.() ?? 0;
  const diaSemanaBaseLabel = DIAS_SEMANA_LABEL_COMPLETO[diaSemanaBaseIndex] || "";

  // ordem (1ª..última) do dia da semana no mês
  const { ordemSemanaBase, ehUltimaSemana } = useMemo(() => {
    if (!dataBase) return { ordemSemanaBase: 1, ehUltimaSemana: false };
    const dia = dataBase.getDate();
    const ordem = Math.floor((dia - 1) / 7) + 1; // 1-5
    const maisSete = new Date(dataBase);
    maisSete.setDate(dia + 7);
    const ehUltima = maisSete.getMonth() !== dataBase.getMonth();
    return { ordemSemanaBase: ordem, ehUltimaSemana: ehUltima };
  }, [dataBase]);

  const safeCap = capacidadeSala || { conforto: 0, max: 999 };
  const max = Number(safeCap.max ?? 999);

  // Normalizações de reserva
  const reservaQtd = reserva?.qtd_pessoas ?? reserva?.qtdPessoas ?? reserva?.qtd ?? "";
  const reservaCoffee = reserva?.coffee_break ?? reserva?.coffeeBreak ?? false;
  const reservaObs = reserva?.observacao ?? reserva?.obs ?? "";
  const reservaFinal = reserva?.finalidade ?? reserva?.descricao ?? reserva?.titulo ?? "";
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
  const [coffeeBreak, setCoffeeBreak] = useState(!!reservaCoffee);
  const [status, setStatus] = useState(reserva?.status || "aprovado");
  const [observacao, setObservacao] = useState(reservaObs);
  const [finalidade, setFinalidade] = useState(reservaFinal);
  const [loading, setLoading] = useState(false);
  const [msgA11y, setMsgA11y] = useState("");

  // Recorrência (apenas criação)
  const [usarRecorrencia, setUsarRecorrencia] = useState(false);
  const [tipoRecorrencia, setTipoRecorrencia] = useState("semanal"); // semanal | mensal | anual | sempre
  const [qtdRepeticoes, setQtdRepeticoes] = useState(4);
  const [limiteMesesSempre, setLimiteMesesSempre] = useState(24);

  // semanal
  const [intervaloSemanas, setIntervaloSemanas] = useState(1);
  const [diasSemanaRecorrencia, setDiasSemanaRecorrencia] = useState(() => [diaSemanaBaseIndex]);

  // mensal
  const [mensalModo, setMensalModo] = useState("dia_mes"); // dia_mes | ordem_semana

  // anual
  const [anualModo, setAnualModo] = useState("dia_mes"); // dia_mes | ordem_semana
  const [mesesAnual, setMesesAnual] = useState([mesBaseIndex]);

  // Sync ao abrir/trocar reserva/slot
  useEffect(() => {
    if (!isOpen) return;

    setQtdPessoas(reservaQtd);
    setCoffeeBreak(!!reservaCoffee);
    setStatus(reserva?.status || "aprovado");
    setObservacao(reservaObs);
    setFinalidade(reservaFinal);
    setLoading(false);
    setMsgA11y("");

    // recorrência reset (sempre cria do zero)
    setUsarRecorrencia(false);
    setTipoRecorrencia("semanal");
    setQtdRepeticoes(4);
    setLimiteMesesSempre(24);

    setIntervaloSemanas(1);
    setDiasSemanaRecorrencia([diaSemanaBaseIndex]);

    setMensalModo("dia_mes");
    setAnualModo("dia_mes");
    setMesesAnual([mesBaseIndex]);

    const t = setTimeout(() => firstFocusRef.current?.focus?.(), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reserva?.id, dataISO, periodo, salaKey]);

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
      const limite = Math.max(1, Math.min(120, Number(limiteMesesSempre) || 24));
      return { tipo: "sempre", limiteMeses: limite };
    }

    const repeticoes = Number(qtdRepeticoes) || 0;
    if (repeticoes <= 0) {
      toast.warn("Informe a quantidade de repetições.");
      return null;
    }

    const base = { tipo: tipoRecorrencia, repeticoes };

    if (tipoRecorrencia === "semanal") {
      const intervalo = Math.max(1, Math.min(52, Number(intervaloSemanas) || 1));
      if (!diasSemanaRecorrencia.length) {
        toast.warn("Selecione ao menos um dia da semana.");
        return null;
      }
      return {
        ...base,
        semanal: {
          intervaloSemanas: intervalo,
          diasSemana: diasSemanaRecorrencia,
        },
      };
    }

    if (tipoRecorrencia === "mensal") {
      if (!diaMesBase) {
        toast.warn("Data base inválida para recorrência mensal.");
        return null;
      }
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
      if (!diaMesBase) {
        toast.warn("Data base inválida para recorrência anual.");
        return null;
      }
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

  async function salvar() {
    try {
      setLoading(true);
      setMsgA11y(isEdicao ? "Salvando alterações..." : "Criando reserva...");

      const qtd = Number(qtdPessoas);

      if (!qtd || qtd <= 0) {
        toast.warn("Informe a quantidade de pessoas.");
        setMsgA11y("Informe a quantidade de pessoas.");
        return;
      }
      if (qtd > max) {
        toast.warn(`A capacidade máxima desta sala é de ${max} pessoas.`);
        setMsgA11y(`Capacidade máxima: ${max} pessoas.`);
        return;
      }

      // Regra premium: se for "bloqueado", exige uma finalidade (evita bloqueio sem motivo)
      if (String(status) === "bloqueado" && !String(finalidade || "").trim()) {
        toast.warn("Para “Bloqueado”, informe a finalidade/motivo.");
        setMsgA11y("Para “Bloqueado”, informe a finalidade/motivo.");
        return;
      }

      const payloadBase = {
        sala: salaKey,
        data: dataISO,
        periodo,
        qtd_pessoas: qtd,
        coffee_break: !!coffeeBreak,
        status,
        observacao: trimmedOrNull(observacao),
        finalidade: trimmedOrNull(finalidade),
      };

      if (isEdicao) {
        await api.put(`/salas/admin/reservas/${reserva.id}`, payloadBase);
        toast.success("Reserva atualizada com sucesso.");
      } else {
        const recorrencia = construirRecorrenciaPayload();
        if (usarRecorrencia && !recorrencia) return;

        const resp = await api.post("/salas/admin/reservas", {
          ...payloadBase,
          recorrencia: recorrencia || null,
        });

        const data = resp?.data ?? resp ?? {};
        const inseridas = Array.isArray(data.inseridas) ? data.inseridas : [];
        const conflitos = Array.isArray(data.conflitos) ? data.conflitos : [];

        const qtdCriadas = inseridas.length;
        const qtdConflitos = conflitos.length;

        if (qtdCriadas > 0) {
          const msgBase = qtdCriadas === 1 ? "Reserva criada com sucesso." : `${qtdCriadas} reservas criadas com sucesso.`;
          if (qtdConflitos > 0) {
            toast.warn(`${msgBase} Algumas datas já estavam reservadas e foram ignoradas (${qtdConflitos}).`);
          } else {
            toast.success(msgBase);
          }
        } else if (qtdConflitos > 0) {
          toast.warn("Nenhuma reserva criada: todas as datas já estavam ocupadas.");
        } else {
          toast.warn("Nenhuma reserva criada.");
        }
      }

      await recarregar?.();
      onClose?.();
    } catch (err) {
      console.error("[ModalReservaAdmin] Erro ao salvar:", err);
      const msg = err?.response?.data?.erro || err?.data?.erro || "Erro ao salvar a reserva da sala.";
      toast.error(msg);
      setMsgA11y(msg);
    } finally {
      setLoading(false);
    }
  }

  async function excluirReserva() {
    if (!isEdicao) return;
    if (!window.confirm("Tem certeza que deseja excluir esta reserva?")) return;

    try {
      setLoading(true);
      setMsgA11y("Excluindo reserva...");
      await api.delete(`/salas/admin/reservas/${reserva.id}`);
      toast.success("Reserva excluída.");
      await recarregar?.();
      onClose?.();
    } catch (err) {
      console.error("[ModalReservaAdmin] Erro ao excluir:", err);
      const msg = err?.response?.data?.erro || err?.data?.erro || "Erro ao excluir a reserva da sala.";
      toast.error(msg);
      setMsgA11y(msg);
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

  const minis = useMemo(() => {
    const qtd = Number(qtdPessoas) || 0;
    return {
      data: toBrDateFromISO(dataISO),
      sala: salaLabel,
      periodo: periodoLabel,
      pessoas: qtd > 0 ? qtd : "—",
      cap: max,
    };
  }, [dataISO, periodoLabel, salaLabel, qtdPessoas, max]);

  const solicitanteBox = (solicitanteNome || solicitanteUnidade || reservaFinal) && (
    <div className="rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 p-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
            <Users className="w-4 h-4 text-slate-500" />
            <span className="truncate">
              <span className="font-semibold">Solicitante:</span>{" "}
              {solicitanteNome || "—"}
              {solicitanteUnidade ? (
                <span className="text-slate-500 dark:text-slate-400"> • {solicitanteUnidade}</span>
              ) : null}
            </span>
          </div>

          {reservaFinal ? (
            <div className="mt-1 flex items-start gap-2 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300">
              <FileText className="w-3.5 h-3.5 mt-0.5 text-slate-500" />
              <p className="break-words">
                <span className="font-semibold">Finalidade:</span> {reservaFinal}
              </p>
            </div>
          ) : null}
        </div>

        {reserva?.status ? (
          <span className="shrink-0 inline-flex items-center text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Status atual: {reserva.status}
          </span>
        ) : null}
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={loading ? undefined : onClose}
      labelledBy={titleId}
      describedBy={descId}
      className="w-[96%] max-w-3xl p-0 overflow-hidden"
    >
      {/* Header Hero (tema exclusivo) */}
      <header className="px-4 sm:px-6 py-4 text-white bg-gradient-to-br from-slate-900 via-emerald-900 to-teal-700">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
              {tituloModal}
            </h2>
            <p id={descId} className="text-white/85 text-sm mt-1">
              {minis.data} • {minis.periodo} • {minis.sala}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-xl hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-60"
            aria-label="Fechar"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Live region */}
      <div aria-live="polite" className="sr-only">
        {msgA11y}
      </div>

      {/* Ministats */}
      <section className="px-4 sm:px-6 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Building2 className="w-5 h-5" />, label: "Sala", value: minis.sala },
          { icon: <Clock className="w-5 h-5" />, label: "Período", value: slot?.periodo === "manha" ? "Manhã" : "Tarde" },
          { icon: <Users className="w-5 h-5" />, label: "Pessoas", value: minis.pessoas },
          { icon: <CalendarDays className="w-5 h-5" />, label: "Capacidade", value: minis.cap },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm"
          >
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              {m.icon}
              <span className="text-sm font-semibold">{m.label}</span>
            </div>
            <div className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white break-words">
              {m.value}
            </div>
          </div>
        ))}
      </section>

      {/* Body */}
      <div className="px-4 sm:px-6 pb-4 pt-4 space-y-4">
        {solicitanteBox}

        {/* Quantidade / Coffee / Status */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Quantidade de pessoas
            </label>
            <input
              ref={firstFocusRef}
              type="number"
              min={1}
              max={max}
              value={qtdPessoas}
              onChange={(e) => setQtdPessoas(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder={`Até ${max} pessoas`}
              disabled={loading}
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Capacidade máxima: <strong>{max}</strong> pessoas.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <Coffee className="w-4 h-4 text-slate-500" />
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={coffeeBreak}
                  onChange={(e) => setCoffeeBreak(e.target.checked)}
                  disabled={loading}
                />
                Haverá coffee break?
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={loading}
              >
                <option value="pendente">Pendente</option>
                <option value="aprovado">Aprovado</option>
                <option value="rejeitado">Rejeitado</option>
                <option value="cancelado">Cancelado</option>
                <option value="bloqueado">Bloqueado (uso interno / evento fixo)</option>
              </select>

              {String(status) === "bloqueado" && (
                <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                  Para “Bloqueado”, recomendamos informar a finalidade/motivo.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Finalidade */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Finalidade / evento {String(status) === "bloqueado" ? <span className="text-rose-600">*</span> : null}
          </label>
          <textarea
            rows={2}
            value={finalidade}
            onChange={(e) => setFinalidade(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Ex.: Reunião da equipe, Aula do Curso X, Oficina Y..."
            disabled={loading}
          />
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Descreva brevemente para qual atividade a sala será utilizada.
          </p>
        </div>

        {/* Observação */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Observações internas (opcional)
          </label>
          <textarea
            rows={2}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Ex.: reserva interna, observações para a equipe, etc."
            disabled={loading}
          />
        </div>

        {/* Recorrência (somente criação) */}
        {!isEdicao && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-900/15 dark:border-emerald-900 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <Repeat className="w-4 h-4 text-emerald-700 dark:text-emerald-300 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-extrabold text-emerald-900 dark:text-emerald-100">
                    Recorrência (opcional)
                  </p>
                  <label className="inline-flex items-center gap-2 text-sm text-emerald-900 dark:text-emerald-100">
                    <input
                      type="checkbox"
                      className="rounded border-emerald-400"
                      checked={usarRecorrencia}
                      onChange={(e) => setUsarRecorrencia(e.target.checked)}
                      disabled={loading}
                    />
                    Aplicar
                  </label>
                </div>
                <p className="text-[11px] text-emerald-900/80 dark:text-emerald-100/80 mt-1">
                  Repita este horário como semanal, mensal, anual ou “sempre” (mensal contínuo).
                </p>
              </div>
            </div>

            {usarRecorrencia && (
              <div className="space-y-3">
                {/* Tipo + quantidade/limite */}
                <div className="grid sm:grid-cols-[1.3fr,0.7fr] gap-3">
                  <div>
                    <label className="block text-xs font-medium text-emerald-900 dark:text-emerald-100">
                      Tipo de recorrência
                    </label>
                    <select
                      value={tipoRecorrencia}
                      onChange={(e) => setTipoRecorrencia(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-emerald-200 bg-white dark:bg-slate-950 dark:border-emerald-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      disabled={loading}
                    >
                      <option value="semanal">Semanal</option>
                      <option value="mensal">Mensal</option>
                      <option value="anual">Anual</option>
                      <option value="sempre">Sempre (mensal contínuo)</option>
                    </select>
                  </div>

                  {tipoRecorrencia === "sempre" ? (
                    <div>
                      <label className="block text-xs font-medium text-emerald-900 dark:text-emerald-100">
                        Limite (meses)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={limiteMesesSempre}
                        onChange={(e) => setLimiteMesesSempre(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-emerald-200 bg-white dark:bg-slate-950 dark:border-emerald-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        disabled={loading}
                      />
                      <p className="text-[10px] text-emerald-900/80 dark:text-emerald-100/80 mt-1">
                        Repete mensalmente na mesma data por até {String(limiteMesesSempre)} mês(es).
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-emerald-900 dark:text-emerald-100">
                        Repetições
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={qtdRepeticoes}
                        onChange={(e) => setQtdRepeticoes(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-emerald-200 bg-white dark:bg-slate-950 dark:border-emerald-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        disabled={loading}
                      />
                      <p className="text-[10px] text-emerald-900/80 dark:text-emerald-100/80 mt-1">
                        Apenas ocorrências futuras a partir da data selecionada.
                      </p>
                    </div>
                  )}
                </div>

                {/* Semanal */}
                {tipoRecorrencia === "semanal" && (
                  <div className="rounded-xl bg-white dark:bg-slate-950 border border-emerald-100 dark:border-emerald-900 p-3 space-y-2">
                    <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-100">
                      Semanal
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-emerald-900 dark:text-emerald-100">A cada</span>
                      <input
                        type="number"
                        min={1}
                        max={52}
                        value={intervaloSemanas}
                        onChange={(e) => setIntervaloSemanas(e.target.value)}
                        className="w-20 rounded-lg border border-emerald-200 dark:border-emerald-900 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        disabled={loading}
                      />
                      <span className="text-[11px] text-emerald-900 dark:text-emerald-100">semana(s)</span>
                    </div>

                    <p className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-100">Dias:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {DIAS_SEMANA.map((label, idx) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggleDiaSemanaRecorrencia(idx)}
                          disabled={loading}
                          className={cls(
                            "px-2 py-1 text-[11px] rounded-full border transition",
                            diasSemanaRecorrencia.includes(idx)
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white dark:bg-slate-950 text-emerald-900 dark:text-emerald-100 border-emerald-200 dark:border-emerald-900"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mensal */}
                {tipoRecorrencia === "mensal" && (
                  <div className="rounded-xl bg-white dark:bg-slate-950 border border-emerald-100 dark:border-emerald-900 p-3 space-y-2">
                    <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-100">Mensal</p>

                    <label className="flex items-center gap-2 text-[11px] text-emerald-900 dark:text-emerald-100">
                      <input
                        type="radio"
                        className="text-emerald-600"
                        checked={mensalModo === "dia_mes"}
                        onChange={() => setMensalModo("dia_mes")}
                        disabled={loading}
                      />
                      Todo dia <strong>{diaMesBase}</strong> de cada mês.
                    </label>

                    <label className="flex items-center gap-2 text-[11px] text-emerald-900 dark:text-emerald-100">
                      <input
                        type="radio"
                        className="text-emerald-600"
                        checked={mensalModo === "ordem_semana"}
                        onChange={() => setMensalModo("ordem_semana")}
                        disabled={loading}
                      />
                      Toda <strong>{ehUltimaSemana ? "última" : `${ordemSemanaBase}ª`}</strong>{" "}
                      <strong>{diaSemanaBaseLabel}</strong> do mês.
                    </label>
                  </div>
                )}

                {/* Anual */}
                {tipoRecorrencia === "anual" && (
                  <div className="rounded-xl bg-white dark:bg-slate-950 border border-emerald-100 dark:border-emerald-900 p-3 space-y-2">
                    <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-100">Anual</p>

                    <label className="flex items-center gap-2 text-[11px] text-emerald-900 dark:text-emerald-100">
                      <input
                        type="radio"
                        className="text-emerald-600"
                        checked={anualModo === "dia_mes"}
                        onChange={() => setAnualModo("dia_mes")}
                        disabled={loading}
                      />
                      Em <strong>{diaMesBase}/{String(mesBaseIndex + 1).padStart(2, "0")}</strong> nos meses selecionados.
                    </label>

                    <label className="flex items-center gap-2 text-[11px] text-emerald-900 dark:text-emerald-100">
                      <input
                        type="radio"
                        className="text-emerald-600"
                        checked={anualModo === "ordem_semana"}
                        onChange={() => setAnualModo("ordem_semana")}
                        disabled={loading}
                      />
                      Na <strong>{ehUltimaSemana ? "última" : `${ordemSemanaBase}ª`}</strong>{" "}
                      <strong>{diaSemanaBaseLabel}</strong> dos meses selecionados.
                    </label>

                    <p className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-100">Meses:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {NOMES_MESES.map((nome, idx) => (
                        <button
                          key={nome}
                          type="button"
                          onClick={() => toggleMesAnual(idx)}
                          disabled={loading}
                          className={cls(
                            "px-2 py-1 text-[11px] rounded-full border transition",
                            mesesAnual.includes(idx)
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white dark:bg-slate-950 text-emerald-900 dark:text-emerald-100 border-emerald-200 dark:border-emerald-900"
                          )}
                        >
                          {nome.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Aviso */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 dark:bg-slate-900 dark:border-slate-700 p-3 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 flex gap-2">
          <Info className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-300" />
          <p className="leading-relaxed">
            Use esta tela para aprovar/negar solicitações ou criar <strong>bloqueios internos</strong>. A recorrência é aplicada somente na criação.
            Datas em finais de semana/feriados/pontos facultativos podem ser ignoradas automaticamente pelo backend.
          </p>
        </div>
      </div>

      {/* Footer sticky */}
      <div className="sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isEdicao && (
            <>
              <button
                type="button"
                onClick={excluirReserva}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-900/20 disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </button>

              <button
                type="button"
                onClick={abrirCartazPDF}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-200 dark:hover:bg-emerald-900/20 disabled:opacity-60"
                title="Gerar cartaz em PDF para a porta da sala"
              >
                <FileText className="w-4 h-4" />
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
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition disabled:opacity-60"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={salvar}
            disabled={loading}
            className={cls(
              "px-4 py-2 rounded-xl text-white font-semibold transition disabled:opacity-60",
              "bg-emerald-600 hover:bg-emerald-700"
            )}
            aria-busy={loading ? "true" : "false"}
          >
            {loading ? (isEdicao ? "Salvando..." : "Criando...") : isEdicao ? "Salvar alterações" : "Criar reserva"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
