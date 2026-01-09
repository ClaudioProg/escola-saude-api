// ✅ src/components/ModalSolicitarReserva.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import {
  Users,
  Coffee,
  FileText,
  Info,
  CalendarDays,
  Clock3,
  Building2,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../services/api";
import Modal from "./Modal";

/* Helper local p/ capacidade por sala (mantém em sincronia com o backend) */
function capacidadePorSala(sala) {
  return sala === "auditorio"
    ? { conforto: 50, max: 60 }
    : { conforto: 25, max: 30 };
}

const PERIODOS = [
  { value: "manha", label: "Período da manhã" },
  { value: "tarde", label: "Período da tarde" },
];

/* Date-only safe: "YYYY-MM-DD" -> "DD/MM/YYYY" sem shift */
const pad2 = (n) => String(n).padStart(2, "0");
function brDate(iso) {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(+d)) return s;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function salaLabel(value) {
  return value === "auditorio" ? "Auditório" : "Sala de Reunião";
}

function trimmedOrNull(v) {
  const t = String(v ?? "").trim();
  return t.length ? t : null;
}

export default function ModalSolicitarReserva({
  onClose,
  slot, // { dataISO, periodo, sala } (apenas modo criar)
  sala, // sala inicial (create/edit)
  capacidadeSala, // { conforto, max } para sala inicial
  recarregar,
  modo = "criar", // 'criar' | 'editar'
  reservaAtual = null, // objeto da reserva (apenas modo editar)
}) {
  const isEdicao = modo === "editar";

  /* ------------------------ valores iniciais ------------------------ */
  const salaInicial = (isEdicao ? reservaAtual?.sala : sala) || slot?.sala || "sala_reuniao";
  const dataInicial = (isEdicao ? (reservaAtual?.data || "").slice(0, 10) : slot?.dataISO) || "";
  const periodoInicial = (isEdicao ? reservaAtual?.periodo : slot?.periodo) || "manha";

  /* ------------------------ estados ------------------------ */
  const [salaSelecionada, setSalaSelecionada] = useState(salaInicial);
  const [dataISO, setDataISO] = useState(dataInicial);
  const [periodo, setPeriodo] = useState(periodoInicial);

  const [qtdPessoas, setQtdPessoas] = useState(
    isEdicao ? String(reservaAtual?.qtd_pessoas ?? "") : ""
  );
  const [coffeeBreak, setCoffeeBreak] = useState(
    isEdicao ? !!reservaAtual?.coffee_break : false
  );
  const [finalidade, setFinalidade] = useState(
    isEdicao ? String(reservaAtual?.finalidade ?? "") : ""
  );
  const [observacao, setObservacao] = useState(""); // criação (backend pode ignorar hoje)
  const [loading, setLoading] = useState(false);
  const [msgA11y, setMsgA11y] = useState("");

  const firstFocusRef = useRef(null);

  /* Capacidade em função da sala escolhida */
  const cap = useMemo(() => {
    // prioriza prop passada só se bater exatamente com sala inicial
    if (salaSelecionada === sala && capacidadeSala) return capacidadeSala;
    return capacidadePorSala(salaSelecionada);
  }, [salaSelecionada, sala, capacidadeSala]);

  /* Rehidrata quando abre (edição / troca de reserva) */
  useEffect(() => {
    if (isEdicao && reservaAtual) {
      setSalaSelecionada(reservaAtual.sala || "sala_reuniao");
      setDataISO((reservaAtual.data || "").slice(0, 10));
      setPeriodo(reservaAtual.periodo || "manha");
      setQtdPessoas(String(reservaAtual.qtd_pessoas ?? ""));
      setCoffeeBreak(!!reservaAtual.coffee_break);
      setFinalidade(String(reservaAtual.finalidade ?? ""));
      setObservacao("");
    } else {
      // criar
      setSalaSelecionada(salaInicial);
      setDataISO(dataInicial);
      setPeriodo(periodoInicial);
      setQtdPessoas("");
      setCoffeeBreak(false);
      setFinalidade("");
      setObservacao("");
    }
    setMsgA11y("");
    setLoading(false);

    const t = setTimeout(() => firstFocusRef.current?.focus?.(), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, reservaAtual?.id]);

  /* Header infos */
  const titulo = isEdicao ? "Editar solicitação" : "Solicitar reserva";

  const subtitulo = useMemo(() => {
    const pLabel = PERIODOS.find((p) => p.value === periodo)?.label || "—";
    const sLabel = salaLabel(salaSelecionada);
    const d = dataISO || slot?.dataISO || "—";
    return `${d} • ${pLabel} • ${sLabel}`;
  }, [periodo, salaSelecionada, dataISO, slot?.dataISO]);

  /* Ministats */
  const minis = useMemo(() => {
    const pLabel = PERIODOS.find((p) => p.value === periodo)?.label || "—";
    const d = brDate(dataISO || slot?.dataISO);
    return {
      sala: salaLabel(salaSelecionada),
      data: d,
      periodo: pLabel,
      cap: `${cap.conforto} conf. / ${cap.max} máx.`,
    };
  }, [salaSelecionada, dataISO, periodo, cap.conforto, cap.max, slot?.dataISO]);

  function podeFechar() {
    return !loading;
  }

  async function enviar() {
    try {
      setLoading(true);
      setMsgA11y(isEdicao ? "Salvando alterações..." : "Enviando solicitação...");

      // validações
      const qtd = Number(qtdPessoas);

      if (!qtd || qtd <= 0) {
        toast.warn("Informe a quantidade de pessoas.");
        setMsgA11y("Informe a quantidade de pessoas.");
        return;
      }
      if (qtd > cap.max) {
        toast.warn(`A capacidade máxima desta sala é de ${cap.max} pessoas.`);
        setMsgA11y(`A capacidade máxima desta sala é de ${cap.max} pessoas.`);
        return;
      }
      if (!dataISO) {
        toast.warn("Informe a data.");
        setMsgA11y("Informe a data.");
        return;
      }
      if (!finalidade?.trim()) {
        toast.warn("Informe a finalidade do uso da sala.");
        setMsgA11y("Informe a finalidade do uso da sala.");
        return;
      }

      if (!["manha", "tarde"].includes(periodo)) {
        toast.warn("Selecione um período válido.");
        setMsgA11y("Selecione um período válido.");
        return;
      }

      // ✅ importante: criar usa dataISO/periodo (não slot fixo), já que a UI permite editar
      if (!isEdicao) {
        const payload = {
          sala: salaSelecionada,
          data: dataISO, // ✅ agora respeita o que o usuário escolheu
          periodo,       // ✅ idem
          qtd_pessoas: qtd,
          coffee_break: coffeeBreak,
          finalidade: finalidade.trim(),
          observacao: trimmedOrNull(observacao),
        };

        await api.post("/salas/solicitar", payload);
        toast.success("Solicitação enviada com sucesso!");
        setMsgA11y("Solicitação enviada com sucesso!");
      } else {
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
        setMsgA11y("Solicitação atualizada com sucesso!");
      }

      await recarregar?.();
      onClose?.();
    } catch (err) {
      console.error("[ModalSolicitarReserva] Erro:", err);
      const msg =
        err?.response?.data?.erro ||
        err?.response?.data?.mensagem ||
        (isEdicao ? "Erro ao atualizar solicitação." : "Erro ao enviar solicitação.");
      toast.error(msg);
      setMsgA11y(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={true}
      onClose={podeFechar() ? onClose : undefined}
      labelledBy="titulo-solicitar-reserva"
      describedBy="descricao-solicitar-reserva"
      className="w-[96%] max-w-xl p-0 overflow-hidden"
    >
      {/* Header hero (tema exclusivo) */}
      <header className="px-4 sm:px-6 py-4 text-white bg-gradient-to-br from-sky-900 via-sky-700 to-cyan-600">
        <h2
          id="titulo-solicitar-reserva"
          className="text-xl sm:text-2xl font-extrabold tracking-tight"
        >
          {titulo}
        </h2>
        <p id="descricao-solicitar-reserva" className="text-white/90 text-sm mt-1">
          {subtitulo}
        </p>
      </header>

      {/* Live region a11y */}
      <div aria-live="polite" className="sr-only">
        {msgA11y}
      </div>

      {/* Ministats */}
      <section className="px-4 sm:px-6 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Building2 className="w-5 h-5" />, label: "Sala", value: minis.sala },
          { icon: <CalendarDays className="w-5 h-5" />, label: "Data", value: minis.data },
          { icon: <Clock3 className="w-5 h-5" />, label: "Período", value: minis.periodo },
          { icon: <Users className="w-5 h-5" />, label: "Capacidade", value: minis.cap },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm"
          >
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              {m.icon}
              <span className="text-sm font-semibold">{m.label}</span>
            </div>
            <div className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white break-words">
              {m.value}
            </div>
          </div>
        ))}
      </section>

      {/* Corpo */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 sm:px-6 pt-4 pb-24 space-y-4 max-h-[70vh] overflow-y-auto"
      >
        {/* Sala */}
        <div className="flex items-start gap-2">
          <FileText className="w-4 h-4 text-slate-500 mt-1" />
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Sala
            </label>
            <select
              ref={firstFocusRef}
              value={salaSelecionada}
              onChange={(e) => setSalaSelecionada(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
            >
              <option value="sala_reuniao">Sala de Reunião</option>
              <option value="auditorio">Auditório</option>
            </select>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Capacidade: {cap.conforto} conforto / {cap.max} máx.
            </p>
          </div>
        </div>

        {/* Data */}
        <div className="flex items-start gap-2">
          <CalendarDays className="w-4 h-4 text-slate-500 mt-1" />
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Data
            </label>
            <input
              type="date"
              value={dataISO}
              onChange={(e) => setDataISO(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
            />
          </div>
        </div>

        {/* Período */}
        <div className="flex items-start gap-2">
          <Clock3 className="w-4 h-4 text-slate-500 mt-1" />
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Período
            </label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
            >
              {PERIODOS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quantidade */}
        <div className="flex items-start gap-2">
          <Users className="w-4 h-4 text-slate-500 mt-1" />
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Quantidade de pessoas
            </label>
            <input
              type="number"
              min={1}
              max={cap.max}
              value={qtdPessoas}
              onChange={(e) => setQtdPessoas(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
              placeholder={`Até ${cap.max} pessoas`}
              inputMode="numeric"
            />
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Capacidade máxima desta sala: {cap.max} pessoas.
            </p>
          </div>
        </div>

        {/* Coffee */}
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <Coffee className="w-4 h-4 text-slate-500" />
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={coffeeBreak}
            onChange={(e) => setCoffeeBreak(e.target.checked)}
            disabled={loading}
          />
          Haverá coffee break?
        </label>

        {/* Finalidade */}
        <div className="flex items-start gap-2">
          <FileText className="w-4 h-4 text-slate-500 mt-1" />
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Finalidade / evento <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={finalidade}
              onChange={(e) => setFinalidade(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
              placeholder="Descreva brevemente a atividade"
            />
          </div>
        </div>

        {/* Observações (somente criar) */}
        {!isEdicao && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Observações adicionais (opcional)
            </label>
            <textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
              placeholder="Informações úteis para a equipe"
            />
          </div>
        )}

        {/* Ajuda */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 px-3 py-2 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 flex gap-2">
          <Info className="w-4 h-4 mt-0.5 text-sky-500" />
          <p>
            {!isEdicao
              ? "Sua solicitação será analisada pela equipe da Escola da Saúde. Você receberá retorno após a avaliação."
              : "Alterações só são permitidas enquanto a solicitação estiver pendente. Mudanças passam pela mesma validação (sem finais de semana/feriados e sem conflitos)."}
          </p>
        </div>
      </motion.div>

      {/* Rodapé sticky (mobile-first) */}
      <div className="sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-end gap-2">
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
          onClick={enviar}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-sky-600 text-white font-extrabold hover:bg-sky-700 transition disabled:opacity-60"
          aria-busy={loading ? "true" : "false"}
        >
          {loading ? (isEdicao ? "Salvando..." : "Enviando...") : isEdicao ? "Salvar alterações" : "Enviar solicitação"}
        </button>
      </div>
    </Modal>
  );
}

ModalSolicitarReserva.propTypes = {
  onClose: PropTypes.func,
  slot: PropTypes.shape({
    dataISO: PropTypes.string,
    periodo: PropTypes.string,
    sala: PropTypes.string,
  }),
  sala: PropTypes.string,
  capacidadeSala: PropTypes.shape({
    conforto: PropTypes.number,
    max: PropTypes.number,
  }),
  recarregar: PropTypes.func,
  modo: PropTypes.oneOf(["criar", "editar"]),
  reservaAtual: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    sala: PropTypes.string,
    data: PropTypes.string,
    periodo: PropTypes.string,
    qtd_pessoas: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    coffee_break: PropTypes.bool,
    finalidade: PropTypes.string,
  }),
};
