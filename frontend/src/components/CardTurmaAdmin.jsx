// components/CardTurmaadministrador.jsx
import BotaoPrimario from "./BotaoPrimario";
import BotaoSecundario from "./BotaoSecundario";
import { motion } from "framer-motion";
import { formatarDataBrasileira } from "../utils/data"; // ✅ Use o utilitário de data!

export default function CardTurmaadministrador({
  turma,
  hojeISO,
  estaExpandida,
  modoadministradorPresencas,
  carregarInscritos,
  carregarAvaliacoes,
  carregarPresencas,
  gerarRelatorioPDF,
  navigate,
  onExpandirOuRecolher,
}) {
  // Todas as datas agora são strings ISO yyyy-mm-dd no backend!
  const inicioISO = turma.data_inicio?.split("T")[0];
  const fimISO = turma.data_fim?.split("T")[0];

  const dentroDoPeriodo = inicioISO && fimISO && hojeISO >= inicioISO && hojeISO <= fimISO;
  const eventoJaIniciado = inicioISO && hojeISO >= inicioISO;

  const statusTurma = dentroDoPeriodo
    ? "Em andamento"
    : eventoJaIniciado
    ? "Realizada"
    : "Agendada";

  const corStatus =
    statusTurma === "Em andamento"
      ? "bg-green-100 text-green-700 dark:bg-green-700 dark:text-white"
      : statusTurma === "Realizada"
      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-700 dark:text-white"
      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="border p-4 rounded-2xl bg-white dark:bg-gray-900 shadow-sm flex flex-col"
    >
      <div className="flex justify-between items-center mb-1">
        <h4 className="text-md font-semibold text-[#1b4332] dark:text-green-200">
          {turma.nome}
        </h4>
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${corStatus}`}>
          {statusTurma}
        </span>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-300">
        {inicioISO && fimISO
          ? `${formatarDataBrasileira(inicioISO)} a ${formatarDataBrasileira(fimISO)}`
          : "Datas a definir"}
      </p>

      {!modoadministradorPresencas ? (
        <div className="flex flex-wrap gap-2 mt-2 mb-3">
          <BotaoSecundario onClick={() => carregarInscritos(turma.id)}>👥 Inscritos</BotaoSecundario>
          <BotaoSecundario onClick={() => carregarAvaliacoes(turma.id)}>⭐ Avaliações</BotaoSecundario>
          {dentroDoPeriodo && <BotaoPrimario onClick={() => navigate("/scanner")}>📷 QR Code</BotaoPrimario>}
          {eventoJaIniciado && <BotaoSecundario onClick={() => gerarRelatorioPDF(turma.id)}>📄 PDF</BotaoSecundario>}
          <BotaoSecundario onClick={() => navigate(`/turmas/editar/${turma.id}`)}>✏️ Editar</BotaoSecundario>
          <BotaoSecundario onClick={() => navigate(`/turmas/presencas/${turma.id}`)}>📋 Ver Presenças</BotaoSecundario>
        </div>
      ) : (
        <div className="flex justify-end mt-2">
          <BotaoPrimario
            onClick={() => {
              if (!turma?.id) return;
              onExpandirOuRecolher(turma.id);
              if (!estaExpandida) {
                carregarInscritos(turma.id);
                carregarAvaliacoes(turma.id);
                carregarPresencas(turma.id);
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
