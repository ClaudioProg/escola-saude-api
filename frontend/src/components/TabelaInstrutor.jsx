import PropTypes from "prop-types";
import { Eye } from "lucide-react";

export default function TabelaInstrutor({ instrutor, onVisualizar }) {
  if (!instrutor.length) {
    return <p className="text-center text-gray-600 dark:text-gray-300">Nenhum instrutor encontrado.</p>;
  }

  return (
    <ul className="space-y-4 max-w-4xl mx-auto">
      {instrutor.map((instrutor) => (
        <li
          key={instrutor.id}
          className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow flex flex-col sm:flex-row justify-between items-start sm:items-center transition hover:shadow-md"
        >
          <div className="mb-2 sm:mb-0">
            <p className="font-semibold text-gray-900 dark:text-white text-lg">{instrutor.nome}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">{instrutor.email}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
  Eventos ministrados: <strong>{Number(instrutor.eventosMinistrados) || 0}</strong>
</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
  Média de avaliação:{" "}
  <strong className="text-blue-700 dark:text-blue-300">
    {instrutor.media_avaliacao ? Number(instrutor.media_avaliacao).toFixed(1) : "N/A"}
  </strong>
</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Possui assinatura:{" "}
              <strong className={instrutor.possuiAssinatura ? "text-green-600" : "text-red-600"}>
                {instrutor.possuiAssinatura ? "Sim" : "Não"}
              </strong>
            </p>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onVisualizar(instrutor)}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow"
              aria-label={`Ver histórico de ${instrutor.nome}`}
            >
              <Eye size={16} /> Histórico
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

TabelaInstrutor.propTypes = {
  instrutor: PropTypes.array.isRequired,
  onVisualizar: PropTypes.func,
};
