import PropTypes from "prop-types";
import { CalendarDays, Clock } from "lucide-react";
import { formatarDataBrasileira } from "../utils/data"; // use sempre seu utilitário

export default function TurmaItem({ turma, onClick }) {
  return (
    <div
      className="flex items-center justify-between bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-3 mb-2 shadow-sm hover:shadow transition"
    >
      <div>
        <h4 className="font-semibold text-lousa dark:text-white">
          {turma.nome || `Turma ${turma.id}`}
        </h4>
        <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 mt-1">
          <CalendarDays size={16} />
          {formatarDataBrasileira(turma.data_inicio)} - {formatarDataBrasileira(turma.data_fim)}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
          <Clock size={16} />
          {(turma.horario_inicio ?? "").slice(0, 5)} às {(turma.horario_fim ?? "").slice(0, 5)}
        </div>
      </div>

      {onClick && (
        <button
          onClick={onClick}
          className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition"
        >
          Selecionar
        </button>
      )}
    </div>
  );
}

TurmaItem.propTypes = {
  turma: PropTypes.shape({
    id: PropTypes.number.isRequired,
    nome: PropTypes.string,
    data_inicio: PropTypes.string,
    data_fim: PropTypes.string,
    horario_inicio: PropTypes.string, // padronizado para "horario_inicio"
    horario_fim: PropTypes.string,    // padronizado para "horario_fim"
  }).isRequired,
  onClick: PropTypes.func, // opcional
};
