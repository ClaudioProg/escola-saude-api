import { useState } from "react";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";
import BotaoSecundario from "./BotaoSecundario";
import { formatarCPF as formatarCPFUtils } from "../utils/data";

const hoje = new Date().toISOString().split("T")[0];

export default function LinhaInscrito({ inscrito, turma, token }) {
  const dataInicio = new Date(turma.data_inicio).toISOString().split("T")[0];
  const dataFim = new Date(`${turma.data_fim}T${turma.horario_fim}`);
  const agora = new Date();
  const limiteConfirmacao = new Date(dataFim.getTime() + 48 * 60 * 60 * 1000);

  const eventoAindaNaoComecou = hoje < dataInicio;
  const eventoEncerrado = agora > dataFim;
  const dentroPrazoConfirmacao = agora <= limiteConfirmacao;

  const temPresenca = inscrito.data_presenca !== null && inscrito.data_presenca !== undefined;
  const [status, setStatus] = useState(temPresenca ? "presente" : null);
  const [loading, setLoading] = useState(false);

  const confirmarPresenca = async () => {
    if (status || eventoAindaNaoComecou || !dentroPrazoConfirmacao || loading) return;

    setLoading(true);
    try {
      const res = await fetch("https://escola-saude-api.onrender.com/api/presencas/registrar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          usuario_id: inscrito.usuario_id,
          turma_id: turma.id,
          data: hoje,
        }),
      });

      const json = await res.json();
      if (res.status === 201 || res.status === 409) {
        setStatus("presente");
        toast.success("✅ Presença confirmada!");
      } else {
        setStatus("faltou");
        toast.error(`❌ ${json.erro || "Erro ao confirmar presença."}`);
      }
    } catch (e) {
      setStatus("faltou");
      toast.error("❌ Erro de rede.");
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
      <span className="text-gray-500 text-sm italic dark:text-gray-300">Aguardando</span>
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
