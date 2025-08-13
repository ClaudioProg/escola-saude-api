// 📁 src/components/LinhaInscrito.jsx
import { useState } from "react";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";
import BotaoSecundario from "./BotaoSecundario";
import { formatarCPF as formatarCPFUtils } from "../utils/data";
import { apiPost } from "../services/api"; // ✅ usa cliente central

/* ===== Helpers de data no fuso local ===== */

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
    return new Date(input); // se vier com hora explícita, deixa o JS interpretar
  }
  return new Date(input);
}

function startOfDayLocal(d) {
  const dt = toLocalDate(d);
  if (!dt) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function endOfDayLocal(d) {
  const dt = toLocalDate(d);
  if (!dt) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23, 59, 59, 999);
}

function ymdLocalString(d) {
  // retorna "YYYY-MM-DD" em fuso local
  const dt = startOfDayLocal(d);
  if (!dt) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* Monta Date local combinando data_fim + horario_fim */
function combineDateAndTimeLocal(dateOnly, timeHHmm) {
  if (!dateOnly) return null;
  const base = startOfDayLocal(dateOnly);
  if (!base) return null;

  if (timeHHmm) {
    const [h, m] = timeHHmm.split(":").map(Number);
    base.setHours(Number.isFinite(h) ? h : 23, Number.isFinite(m) ? m : 59, 59, 999);
  } else {
    base.setHours(23, 59, 59, 999);
  }
  return base;
}

/* ===== Componente ===== */

export default function LinhaInscrito({ inscrito, turma /*, token*/ }) {
  // hoje como string local (não usar toISOString/UTC)
  const hojeStr = ymdLocalString(new Date());

  const dataInicioStr = ymdLocalString(turma.data_inicio);
  const dataFimDate = combineDateAndTimeLocal(turma.data_fim, turma.horario_fim);
  const agora = new Date();

  // +48h após o término (em horário local)
  const limiteConfirmacao = dataFimDate
    ? new Date(dataFimDate.getTime() + 48 * 60 * 60 * 1000)
    : null;

  // status do evento
  const eventoAindaNaoComecou =
    dataInicioStr && hojeStr ? hojeStr < dataInicioStr : false;

  const eventoEncerrado = dataFimDate ? agora > dataFimDate : false;

  const dentroPrazoConfirmacao =
    limiteConfirmacao ? agora <= limiteConfirmacao : false;

  const temPresenca =
    inscrito.data_presenca !== null && inscrito.data_presenca !== undefined;

  const [status, setStatus] = useState(temPresenca ? "presente" : null);
  const [loading, setLoading] = useState(false);

  const confirmarPresenca = async () => {
    if (status || eventoAindaNaoComecou || !dentroPrazoConfirmacao || loading) return;

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
      if (err?.status === 409) {
        setStatus("presente");
        toast.success("✅ Presença já estava confirmada.");
      } else {
        setStatus("faltou");
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
  };

  function StatusBadge() {
    if (status === "presente") {
      return (
        <span className="flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-700 dark:text-white px-2 py-1 rounded text-xs font-semibold">
          <CheckCircle size={14} /> Presente
        </span>
      );
    }

    if (status === "faltou" || eventoEncerrado) {
      return (
        <span className="flex items-center gap-1 bg-red-100 text-red-700 dark:bg-red-700 dark:text-white px-2 py-1 rounded text-xs font-semibold">
          <XCircle size={14} /> Faltou
        </span>
      );
    }

    return (
      <span className="text-gray-500 text-sm italic dark:text-gray-300">
        Aguardando
      </span>
    );
  }

  return (
    <motion.li
      className="grid grid-cols-5 gap-2 items-center py-2 px-2 border-b dark:border-gray-600"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      {/* Nome */}
      <div className="font-medium text-lousa dark:text-white">{inscrito.nome}</div>

      {/* CPF */}
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {formatarCPFUtils(inscrito.cpf)}
      </div>

      {/* Data da Presença */}
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {temPresenca
          ? new Date(inscrito.data_presenca).toLocaleDateString("pt-BR")
          : "-"}
      </div>

      {/* Status */}
      <div>
        <StatusBadge />
      </div>

      {/* Botão de Ação */}
      <div>
        {!status && eventoEncerrado && dentroPrazoConfirmacao && (
          <BotaoSecundario
            onClick={confirmarPresenca}
            disabled={loading}
            aria-label={`Confirmar presença de ${inscrito.nome}`}
          >
            {loading ? "Confirmando..." : "Confirmar presença"}
          </BotaoSecundario>
        )}
      </div>
    </motion.li>
  );
}
