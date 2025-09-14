// 📁 src/components/CardTurmaadmin.jsx
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import BadgeStatus from "./BadgeStatus";
import BotaoPrimario from "./BotaoPrimario";
import BotaoSecundario from "./BotaoSecundario";
import { formatarDataBrasileira } from "../utils/data";

/** Converte datas ISO (YYYY-MM-DD) para chave de status do BadgeStatus */
function getStatusKey(inicioISO, fimISO, hojeISO) {
  if (!inicioISO || !fimISO || !hojeISO) return "desconhecido";
  if (hojeISO < inicioISO) return "programado";
  if (hojeISO > fimISO) return "encerrado";
  return "andamento";
}

export default function CardTurmaadministrador({
  turma,
  hojeISO,
  estaExpandida = false,
  modoadministradorPresencas = false,
  carregarInscritos,
  carregarAvaliacoes,
  carregarPresencas,
  gerarRelatorioPDF,
  navigate,
  onExpandirOuRecolher,
}) {
  // Backend envia ISO completo; usamos só YYYY-MM-DD
  const inicioISO = turma?.data_inicio?.split("T")[0] || turma?.data_inicio || null;
  const fimISO = turma?.data_fim?.split("T")[0] || turma?.data_fim || null;

  const dentroDoPeriodo = !!(inicioISO && fimISO && hojeISO >= inicioISO && hojeISO <= fimISO);
  const eventoJaIniciado = !!(inicioISO && hojeISO >= inicioISO);
  const statusKey = getStatusKey(inicioISO, fimISO, hojeISO);

  const handleIr = (path) => {
    if (!path || typeof navigate !== "function") return;
    navigate(path);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="border p-4 rounded-2xl bg-white dark:bg-gray-900 shadow-sm flex flex-col border-gray-200 dark:border-gray-700"
      aria-label={`Cartão da turma ${turma?.nome || ""}`}
    >
      <div className="flex justify-between items-start gap-3 mb-1">
        <h4 className="text-md font-semibold text-green-900 dark:text-green-200 truncate" title={turma?.nome}>
          {turma?.nome}
        </h4>
        <BadgeStatus status={statusKey} size="sm" variant="soft" />
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-300">
        {inicioISO && fimISO
          ? `${formatarDataBrasileira(inicioISO)} a ${formatarDataBrasileira(fimISO)}`
          : "Datas a definir"}
      </p>

      {!modoadministradorPresencas ? (
        <div className="flex flex-wrap gap-2 mt-2 mb-1">
          <BotaoSecundario onClick={() => carregarInscritos?.(turma.id)}>
            👥 Inscritos
          </BotaoSecundario>

          <BotaoSecundario onClick={() => carregarAvaliacoes?.(turma.id)}>
            ⭐ Avaliações
          </BotaoSecundario>

          {dentroDoPeriodo && (
            <BotaoPrimario onClick={() => handleIr("/scanner")}>
              📷 QR Code
            </BotaoPrimario>
          )}

          {eventoJaIniciado && (
            <BotaoSecundario onClick={() => gerarRelatorioPDF?.(turma.id)}>
              📄 PDF
            </BotaoSecundario>
          )}

          <BotaoSecundario onClick={() => handleIr(`/turmas/editar/${turma.id}`)}>
            ✏️ Editar
          </BotaoSecundario>

          <BotaoSecundario onClick={() => handleIr(`/turmas/presencas/${turma.id}`)}>
            📋 Ver Presenças
          </BotaoSecundario>
        </div>
      ) : (
        <div className="flex justify-end mt-2">
          <BotaoPrimario
            onClick={() => {
              if (!turma?.id) return;
              onExpandirOuRecolher?.(turma.id);
              if (!estaExpandida) {
                carregarInscritos?.(turma.id);
                carregarAvaliacoes?.(turma.id);
                carregarPresencas?.(turma.id);
              }
            }}
          >
            {estaExpandida ? "Recolher Detalhes" : "Ver Detalhes"}
          </BotaoPrimario>
        </div>
      )}
    </motion.div>
  );
}

CardTurmaadministrador.propTypes = {
  turma: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    nome: PropTypes.string,
    data_inicio: PropTypes.string, // ISO
    data_fim: PropTypes.string, // ISO
  }).isRequired,
  hojeISO: PropTypes.string.isRequired, // "YYYY-MM-DD"
  estaExpandida: PropTypes.bool,
  modoadministradorPresencas: PropTypes.bool,
  carregarInscritos: PropTypes.func,
  carregarAvaliacoes: PropTypes.func,
  carregarPresencas: PropTypes.func,
  gerarRelatorioPDF: PropTypes.func,
  navigate: PropTypes.func,
  onExpandirOuRecolher: PropTypes.func,
};
