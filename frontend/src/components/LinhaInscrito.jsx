import { useState } from "react";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import BotaoSecundario from "./BotaoSecundario";
import { CheckCircle, XCircle } from "lucide-react";
import { formatarCPF } from "../utils/data";

// 🔽 Cálculo de datas fora do componente, se possível, ou no topo
const hoje = new Date().toISOString().split("T")[0];

export default function LinhaInscrito({ inscrito, turma, token }) {
  const dataInicio = new Date(turma.data_inicio).toISOString().split("T")[0];
  const dataFim = new Date(turma.data_fim).toISOString().split("T")[0];

  const eventoAindaNaoComecou = hoje < dataInicio;
  const eventoEncerrado = hoje > dataFim;

  const [status, setStatus] = useState(inscrito.presente ? "presente" : null);
  const [loading, setLoading] = useState(false);

  const formatarCPF = (cpf) =>
    cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");

  const confirmarPresenca = async () => {
    if (status || eventoEncerrado || eventoAindaNaoComecou || loading) return;
  
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3000/api/presencas/registrar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          usuario_id: inscrito.usuario_id,
          turma_id: turma.id,
          data_presenca: hoje,
        }),
      });
  
      const json = await res.json();
  
      if (res.status === 201 || res.status === 409) {
        setStatus("presente");
        toast.success("✅ Presença confirmada!");
      } else {
        setStatus("faltou");
        toast.error(`❌ ${json.erro || "Não foi possível confirmar presença."}`);
      }
    } catch (e) {
      setStatus("faltou");
      toast.error("❌ Erro ao confirmar presença.");
    } finally {
      setLoading(false);
    }
  };

  // 🎯 Badge visual com ícones e acessibilidade
  function StatusBadge() {
    if (status === "presente") {
      return (
        <span
          className="flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-700 dark:text-white px-2 py-1 rounded text-xs font-semibold"
          aria-live="polite"
        >
          <CheckCircle size={14} className="text-green-500 dark:text-white" /> Presente
        </span>
      );
    }

    if (status === "faltou" || eventoEncerrado) {
      return (
        <span
          className="flex items-center gap-1 bg-red-100 text-red-700 dark:bg-red-700 dark:text-white px-2 py-1 rounded text-xs font-semibold"
          aria-live="polite"
        >
          <XCircle size={14} className="text-red-500 dark:text-white" /> Faltou
        </span>
      );
    }

    return null;
  }

  return (
    <motion.li
      className="flex items-center justify-between py-2 px-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
      tabIndex={0}
      role="listitem"
      aria-label={`Inscrito: ${inscrito.nome}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-x-3 gap-y-1 flex-1">
        <span className="font-medium text-lousa dark:text-white">
          {inscrito.nome}
        </span>
        <span className="text-gray-500 dark:text-gray-300 text-sm">
  CPF: {formatarCPF(inscrito.cpf)}
</span>
        <StatusBadge />
      </div>

      {!status && !eventoEncerrado && !eventoAindaNaoComecou && (
        <BotaoSecundario
          onClick={confirmarPresenca}
          disabled={loading}
          aria-busy={loading}
          aria-disabled={loading}
          aria-label={`Confirmar presença de ${inscrito.nome}`}
        >
          {loading ? "Confirmando..." : "Confirmar presença"}
        </BotaoSecundario>
      )}
    </motion.li>
  );
}
