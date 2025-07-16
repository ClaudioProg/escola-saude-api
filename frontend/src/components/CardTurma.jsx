import PropTypes from "prop-types";
import { useState } from "react";
import { motion } from "framer-motion";
import { Users, CalendarDays } from "lucide-react";
import { formatarDataBrasileira } from "../utils/data";

// Badge colorido com status (Programado, Em andamento, Encerrado)
function getStatusBadge(inicio, fim) {
  if (!inicio || !fim) return null;
  const hoje = new Date();
  const dataInicio = new Date(inicio);
  const dataFim = new Date(fim);

  if (hoje < dataInicio)
    return (
      <span className="ml-2 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-400">
        Programado
      </span>
    );
  if (hoje > dataFim)
    return (
      <span className="ml-2 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-400">
        Encerrado
      </span>
    );
  return (
    <span className="ml-2 px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-900 border border-yellow-400">
      Em andamento
    </span>
  );
}

export default function CardTurma({
  turma,
  hoje,
  carregarInscritos,
  carregarAvaliacoes,
  gerarRelatorioPDF,
  inscritos,
  avaliacoes,
}) {
  const [exibeInscritos, setExibeInscritos] = useState(false);
  const [exibeAvaliacoes, setExibeAvaliacoes] = useState(false);

  // Datas protegidas
  const dataHoje =
    hoje && typeof hoje.toISOString === "function"
      ? hoje.toISOString().split("T")[0]
      : "";
  const inicio = turma.data_inicio ? turma.data_inicio.split("T")[0] : null;
  const fim = turma.data_fim ? turma.data_fim.split("T")[0] : null;

  const total = turma.vagas_total || 0;
  const ocupadas = Array.isArray(turma.inscritos) ? turma.inscritos.length : 0;
  const percentual = total > 0 ? Math.round((ocupadas / total) * 100) : 0;

  // Calculo da carga horária/dia
  const inicioHora = new Date(`${turma.data_inicio}T${turma.horario_inicio}`);
  const fimHora = new Date(`${turma.data_inicio}T${turma.horario_fim}`);
  let cargaHoraria = (fimHora - inicioHora) / (1000 * 60 * 60);
  if (turma.horario_inicio === "08:00" && turma.horario_fim === "17:00") {
    cargaHoraria -= 1; // 1h de almoço
  }
  cargaHoraria = isNaN(cargaHoraria) ? 0 : cargaHoraria;

  const diasTurma = Math.max(
    1,
    (new Date(turma.data_fim) - new Date(turma.data_inicio)) /
      (1000 * 60 * 60 * 24) +
      1
  );
  const cargaTotal = cargaHoraria * diasTurma;

  const corBarra =
    percentual >= 100
      ? "bg-red-600"
      : percentual >= 75
      ? "bg-orange-400"
      : "bg-green-600";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      layout
      className="border p-6 mb-5 rounded-2xl bg-white dark:bg-gray-900 shadow transition-all"
      aria-label={`Cartão da turma ${turma.nome}`}
      tabIndex={0}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="w-full">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-base font-bold text-lousa dark:text-white">{turma.nome}</h4>
            {getStatusBadge(turma.data_inicio, turma.data_fim)}
          </div>

          {turma.evento_titulo && (
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              <CalendarDays size={14} className="inline mr-1" /> Evento: {turma.evento_titulo}
            </span>
          )}

          <span className="text-xs text-gray-600 dark:text-gray-300 block mb-1">
            <CalendarDays size={14} className="inline mr-1" />
            {turma.data_inicio && turma.data_fim
              ? `${formatarDataBrasileira(turma.data_inicio)} a ${formatarDataBrasileira(turma.data_fim)}`
              : "Datas a definir"}
          </span>

          <span className="text-xs text-gray-600 dark:text-gray-300 block mt-0.5">
            Carga horária: {cargaHoraria.toFixed(1)}h/dia • Total: {cargaTotal.toFixed(1)}h
          </span>

          {/* Barra de Progresso de Vagas */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
              <span>
                <Users size={14} className="inline mr-1" />
                {ocupadas} de {total} vagas preenchidas
              </span>
              <span className="ml-2 px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs">
                {percentual}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-300 rounded-full overflow-hidden">
              <div className={`h-full ${corBarra}`} style={{ width: `${percentual}%` }}></div>
            </div>
          </div>
        </div>
      </div>
      {/* Expansão para inscritos, avaliações, etc. */}
    </motion.div>
  );
}

CardTurma.propTypes = {
  turma: PropTypes.object.isRequired,
  hoje: PropTypes.instanceOf(Date).isRequired,
  carregarInscritos: PropTypes.func.isRequired,
  carregarAvaliacoes: PropTypes.func.isRequired,
  gerarRelatorioPDF: PropTypes.func.isRequired,
  inscritos: PropTypes.array,
  avaliacoes: PropTypes.array,
};

CardTurma.defaultProps = {
  inscritos: [],
  avaliacoes: [],
};
