// 📁 src/components/LinhaInscrito.jsx
import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";
import BotaoSecundario from "./BotaoSecundario";
import { formatarCPF as formatarCPFUtils } from "../utils/data";
import { apiPost } from "../services/api"; // ✅ cliente central

/* ======================= Helpers de data (fuso local) ======================= */

const MS = {
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
};

function isDateOnly(str) {
  return typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str);
}
function toLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === "string") {
    if (isDateOnly(input)) {
      const [y, m, d] = input.split("-").map(Number);
      return new Date(y, m - 1, d); // 00:00 local
    }
    return new Date(input); // deixa o JS interpretar strings com hora/timezone
  }
  return new Date(input);
}
function ymdLocalString(d) {
  const dt = toLocalDate(d);
  if (!dt || Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function startOfDayLocal(d) {
  const dt = toLocalDate(d);
  if (!dt) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
function combineDateAndTimeLocal(dateOnly, timeHHmm) {
  // junta "YYYY-MM-DD" + "HH:MM" em Date local (termino real do curso)
  if (!dateOnly) return null;
  const base = startOfDayLocal(dateOnly);
  if (!base) return null;
  const hhmm = typeof timeHHmm === "string" ? timeHHmm.slice(0, 5) : "";
  const [h, m] = hhmm.split(":").map(Number);
  base.setHours(Number.isFinite(h) ? h : 23, Number.isFinite(m) ? m : 59, 59, 999);
  return base;
}

/* =============================== Componente =============================== */

export default function LinhaInscrito({ inscrito, turma }) {
  // hoje como string local (YYYY-MM-DD) — evita UTC shift
  const hojeStr = useMemo(() => ymdLocalString(new Date()), []);
  const agora = useMemo(() => new Date(), []);

  // datas da turma
  const dataInicioStr = ymdLocalString(turma?.data_inicio);
  const fimDate = useMemo(
    () => combineDateAndTimeLocal(turma?.data_fim, turma?.horario_fim),
    [turma?.data_fim, turma?.horario_fim]
  );

  // janelas de status
  const eventoAindaNaoComecou = useMemo(() => {
    return dataInicioStr && hojeStr ? hojeStr < dataInicioStr : false;
  }, [dataInicioStr, hojeStr]);

  const eventoEncerrado = useMemo(() => {
    return fimDate ? agora > fimDate : false;
  }, [fimDate, agora]);

  // prazo de confirmação: até 48h após o fim
  const limiteConfirmacao = useMemo(() => {
    return fimDate ? new Date(fimDate.getTime() + 48 * MS.HOUR) : null;
  }, [fimDate]);

  const dentroPrazoConfirmacao = useMemo(() => {
    return limiteConfirmacao ? agora <= limiteConfirmacao : false;
  }, [limiteConfirmacao, agora]);

  // status inicial pela presença existente
  const temPresenca = inscrito?.data_presenca != null;
  const [status, setStatus] = useState(temPresenca ? "presente" : null);
  const [loading, setLoading] = useState(false);

  // sincroniza status caso a lista seja recarregada e a presença chegue depois
  useEffect(() => {
    setStatus(inscrito?.data_presenca != null ? "presente" : null);
  }, [inscrito?.data_presenca]);

  async function confirmarPresenca() {
    // regras: não confirmar antes de começar; só após encerrar e até 48h; não repetir
    if (status || eventoAindaNaoComecou || !eventoEncerrado || !dentroPrazoConfirmacao || loading) {
      return;
    }

    setLoading(true);
    try {
      await apiPost("/api/presencas/registrar", {
        usuario_id: inscrito.usuario_id,
        turma_id: turma.id,
        data: hojeStr, // data local (YYYY-MM-DD)
      });
      setStatus("presente");
      toast.success("✅ Presença confirmada!");
    } catch (err) {
      // idempotência amigável
      if (err?.status === 409) {
        setStatus("presente");
        toast.success("✅ Presença já estava confirmada.");
      } else {
        setStatus((s) => s || "faltou"); // só marca faltou se não houver status
        const msg =
          err?.data?.erro ||
          err?.data?.message ||
          err?.message ||
          "Erro ao confirmar presença.";
        toast.error(`❌ ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }

  function StatusBadge() {
    if (status === "presente") {
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-700 dark:text-white px-2 py-1 rounded text-xs font-semibold">
          <CheckCircle size={14} aria-hidden="true" /> Presente
        </span>
      );
    }
    if (status === "faltou" || (eventoEncerrado && !dentroPrazoConfirmacao)) {
      return (
        <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 dark:bg-rose-700 dark:text-white px-2 py-1 rounded text-xs font-semibold">
          <XCircle size={14} aria-hidden="true" /> Faltou
        </span>
      );
    }
    return (
      <span className="text-gray-600 dark:text-gray-300 text-sm italic">
        Aguardando
      </span>
    );
  }

  const podeConfirmar =
    !status && eventoEncerrado && dentroPrazoConfirmacao && !eventoAindaNaoComecou;

  const tituloBotao = !eventoEncerrado
    ? "A confirmação libera após o término da turma."
    : !dentroPrazoConfirmacao
    ? "Fora do prazo de 48h para confirmação."
    : "Confirmar presença";

  return (
    <motion.li
      className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center py-2 px-2 border-b dark:border-gray-600"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      role="row"
      aria-label={`Inscrito ${inscrito?.nome || ""}`}
    >
      {/* Nome */}
      <div className="font-medium text-emerald-900 dark:text-white break-words" role="cell">
        {inscrito?.nome || "—"}
      </div>

      {/* CPF */}
      <div className="text-sm text-gray-700 dark:text-gray-300" role="cell">
        {formatarCPFUtils(inscrito?.cpf)}
      </div>

      {/* Data da Presença */}
      <div className="text-sm text-gray-700 dark:text-gray-300" role="cell">
        {inscrito?.data_presenca
          ? new Date(inscrito.data_presenca).toLocaleDateString("pt-BR")
          : "—"}
      </div>

      {/* Status */}
      <div role="cell">
        <StatusBadge />
      </div>

      {/* Ação */}
      <div className="flex justify-end md:justify-start" role="cell">
        <BotaoSecundario
          onClick={confirmarPresenca}
          disabled={!podeConfirmar || loading}
          aria-label={`Confirmar presença de ${inscrito?.nome || "participante"}`}
          title={tituloBotao}
        >
          {loading ? "Confirmando..." : "Confirmar presença"}
        </BotaoSecundario>
      </div>
    </motion.li>
  );
}

LinhaInscrito.propTypes = {
  inscrito: PropTypes.shape({
    usuario_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    nome: PropTypes.string,
    cpf: PropTypes.string,
    email: PropTypes.string,
    data_presenca: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  }).isRequired,
  turma: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    data_inicio: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    data_fim: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    horario_fim: PropTypes.string, // "HH:MM" (aceita "HH:MM:SS" — será truncado)
  }).isRequired,
};
