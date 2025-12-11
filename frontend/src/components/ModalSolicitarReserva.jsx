// ✅ src/components/ModalSolicitarReserva.jsx
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Coffee,
  FileText,
  X as CloseIcon,
  Info,
  CalendarDays,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../services/api";

// Pequeno helper local p/ capacidade por sala (mantém em sincronia com o backend)
function capacidadePorSala(sala) {
  return sala === "auditorio" ? { conforto: 50, max: 60 } : { conforto: 25, max: 30 };
}

const PERIODOS = [
  { value: "manha", label: "Período da manhã" },
  { value: "tarde", label: "Período da tarde" },
];

function ModalSolicitarReserva({
  onClose,
  slot,                 // { dataISO, periodo, sala } (apenas modo criar)
  sala,                  // sala inicial (create/edit)
  capacidadeSala,        // { conforto, max } para sala inicial
  recarregar,
  modo = "criar",        // 'criar' | 'editar'
  reservaAtual = null,   // objeto da reserva (apenas modo editar)
}) {
  // ------------------------ Estados baseados no modo ------------------------
  const salaInicial =
    (modo === "editar" ? reservaAtual?.sala : sala) || "sala_reuniao";
  const dataInicial =
    (modo === "editar" ? (reservaAtual?.data || "").slice(0, 10) : slot?.dataISO) ||
    "";
  const periodoInicial =
    (modo === "editar" ? reservaAtual?.periodo : slot?.periodo) || "manha";

  const [salaSelecionada, setSalaSelecionada] = useState(salaInicial);
  const [dataISO, setDataISO] = useState(dataInicial);
  const [periodo, setPeriodo] = useState(periodoInicial);

  const [qtdPessoas, setQtdPessoas] = useState(
    modo === "editar" ? String(reservaAtual?.qtd_pessoas ?? "") : ""
  );
  const [coffeeBreak, setCoffeeBreak] = useState(
    modo === "editar" ? !!reservaAtual?.coffee_break : false
  );
  const [finalidade, setFinalidade] = useState(
    modo === "editar" ? String(reservaAtual?.finalidade ?? "") : ""
  );
  const [observacao, setObservacao] = useState(""); // só usada na criação (backend ignora no momento)
  const [loading, setLoading] = useState(false);

  // Capacidade em função da sala escolhida
  const cap = useMemo(() => {
    // prioridade para prop passada (modo criar no primeiro render),
    // mas ao trocar a sala, recalcula localmente
    if (salaSelecionada === sala) return capacidadeSala || capacidadePorSala(salaSelecionada);
    return capacidadePorSala(salaSelecionada);
  }, [salaSelecionada, sala, capacidadeSala]);

  // Garantir que no primeiro render de edição os campos venham prontos
  useEffect(() => {
    if (modo === "editar" && reservaAtual) {
      setSalaSelecionada(reservaAtual.sala);
      setDataISO((reservaAtual.data || "").slice(0, 10));
      setPeriodo(reservaAtual.periodo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, reservaAtual?.id]);

  // ------------------------ Helpers ------------------------
  function salaLabel(value) {
    return value === "auditorio" ? "Auditório" : "Sala de Reunião";
  }

  const titulo =
    modo === "editar" ? "Editar solicitação" : "Solicitar reserva";

  const subtitulo =
    modo === "editar"
      ? `${dataISO || "—"} • ${
          PERIODOS.find((p) => p.value === periodo)?.label || "—"
        } • ${salaLabel(salaSelecionada)}`
      : `${slot?.dataISO} • ${
          slot?.periodo === "manha" ? "Período da manhã" : "Período da tarde"
        } • ${salaLabel(salaSelecionada)}`;

  // ------------------------ Submit (criar/editar) ------------------------
  async function enviar() {
    try {
      setLoading(true);

      // validações comuns
      const qtd = Number(qtdPessoas);
      if (!qtd || qtd <= 0) {
        toast.warn("Informe a quantidade de pessoas.");
        return;
      }
      if (qtd > cap.max) {
        toast.warn(`A capacidade máxima desta sala é de ${cap.max} pessoas.`);
        return;
      }
      if (!dataISO) {
        toast.warn("Informe a data.");
        return;
      }
      if (!finalidade?.trim()) {
        toast.warn("Informe a finalidade do uso da sala.");
        return;
      }

      if (modo === "criar") {
        const payload = {
          sala: salaSelecionada,
          data: slot.dataISO, // data vem do slot (criação é fixada ao clique)
          periodo: slot.periodo,
          qtd_pessoas: qtd,
          coffee_break: coffeeBreak,
          finalidade: finalidade.trim(),
          // observacao é opcional e hoje não é tratada pelo backend do usuário
          // mantendo no payload só para compatibilidade futura
          observacao: observacao?.trim() || null,
        };

        await api.post("/salas/solicitar", payload);
        toast.success("Solicitação enviada com sucesso!");
      } else {
        // editar
        const payload = {
          sala: salaSelecionada,
          data: dataISO,
          periodo,
          qtd_pessoas: qtd,
          coffee_break: coffeeBreak,
          finalidade: finalidade.trim(),
        };

        await api.put(`/salas/minhas/${reservaAtual.id}`, payload);
        toast.success("Solicitação atualizada com sucesso!");
      }

      await recarregar();
      onClose();
    } catch (err) {
      console.error("[ModalSolicitarReserva] Erro:", err);
      const msg =
        err?.response?.data?.erro ||
        (modo === "criar"
          ? "Erro ao enviar solicitação."
          : "Erro ao atualizar solicitação.");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        className="bg-white rounded-2xl shadow-xl max-w-xl w-full mx-4 max-h-[90vh] overflow-auto"
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-800">
              {titulo}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {subtitulo}
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

        {/* Conteúdo */}
        <div className="px-4 pb-4 pt-3 space-y-4">
          {/* Sala (somente edição pode trocar; em criação, permitir trocar também se desejar) */}
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-slate-500 mt-1" />
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600">
                Sala
              </label>
              <select
                value={salaSelecionada}
                onChange={(e) => setSalaSelecionada(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="sala_reuniao">Sala de Reunião</option>
                <option value="auditorio">Auditório</option>
              </select>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Capacidade: {cap.conforto} conforto / {cap.max} máx.
              </p>
            </div>
          </div>

          {/* Data (em criação mostramos para referência; em edição o usuário pode trocar) */}
          <div className="flex items-start gap-2">
            <CalendarDays className="w-4 h-4 text-slate-500 mt-1" />
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600">
                Data
              </label>
              <input
                type="date"
                value={dataISO}
                onChange={(e) => setDataISO(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                // min opcional; backend também valida
              />
            </div>
          </div>

          {/* Período */}
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-slate-500 mt-1" />
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600">
                Período
              </label>
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {PERIODOS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantidade de pessoas */}
          <div className="flex items-start gap-2">
            <Users className="w-4 h-4 text-slate-500 mt-1" />
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600">
                Quantidade de pessoas
              </label>
              <input
                type="number"
                min={1}
                max={cap.max}
                value={qtdPessoas}
                onChange={(e) => setQtdPessoas(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder={`Até ${cap.max} pessoas`}
              />
              <p className="mt-0.5 text-[11px] text-slate-500">
                Capacidade máxima desta sala: {cap.max} pessoas.
              </p>
            </div>
          </div>

          {/* Coffee break */}
          <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700">
            <Coffee className="w-4 h-4 text-slate-500" />
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={coffeeBreak}
              onChange={(e) => setCoffeeBreak(e.target.checked)}
            />
            Haverá coffee break?
          </label>

          {/* Finalidade */}
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
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Descreva brevemente a atividade"
              />
            </div>
          </div>

          {/* Observações (somente criação; backend do usuário ainda ignora) */}
          {modo === "criar" && (
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Observações adicionais (opcional)
              </label>
              <textarea
                rows={2}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Informações úteis para a equipe"
              />
            </div>
          )}

          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-[11px] sm:text-xs text-slate-600 flex gap-2">
            <Info className="w-4 h-4 mt-0.5 text-sky-500" />
            <p>
              {modo === "criar"
                ? "Sua solicitação será analisada pela equipe da Escola da Saúde. Você receberá retorno após a avaliação."
                : "Alterações só são permitidas enquanto a solicitação estiver pendente. Mudanças de data/sala/período passam pela mesma validação (sem finais de semana/feriados e sem conflitos)."}
            </p>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
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
            onClick={enviar}
            disabled={loading}
            className="px-4 py-1.5 text-xs sm:text-sm rounded-xl bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {loading
              ? modo === "criar"
                ? "Enviando..."
                : "Salvando..."
              : modo === "criar"
              ? "Enviar solicitação"
              : "Salvar alterações"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default ModalSolicitarReserva;
