// 📁 src/components/TabelaInstrutor.jsx
import PropTypes from "prop-types";
import { Eye, CheckCircle2, XCircle } from "lucide-react";

export default function TabelaInstrutor({ instrutor = [], onVisualizar = () => {}, className = "" }) {
  if (!Array.isArray(instrutor) || instrutor.length === 0) {
    return (
      <p className="text-center text-gray-600 dark:text-gray-300 py-4" aria-live="polite">
        Nenhum instrutor encontrado.
      </p>
    );
  }

  return (
    <ul className={`space-y-4 max-w-4xl mx-auto ${className}`} role="list" aria-label="Lista de instrutores">
      {instrutor.map((item, idx) => (
        <li key={item.id ?? `${item.email ?? "sem-email"}-${idx}`}>
          <InstrutorCard data={item} onVisualizar={onVisualizar} />
        </li>
      ))}
    </ul>
  );
}

function InstrutorCard({ data, onVisualizar }) {
  const {
    id,
    nome = "—",
    email = "—",
    eventosMinistrados,
    media_avaliacao,
    possuiAssinatura,
  } = data || {};

  const eventosNum =
    typeof eventosMinistrados === "number"
      ? eventosMinistrados
      : Number.isFinite(Number(eventosMinistrados))
      ? Number(eventosMinistrados)
      : 0;

  const mediaFormatada =
    media_avaliacao == null || media_avaliacao === "" || Number.isNaN(Number(media_avaliacao))
      ? "— / 5"
      : `${Number(media_avaliacao).toFixed(1)} / 5`;

  return (
    <article
      className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow transition hover:shadow-md focus-within:shadow-md"
      aria-label={`Instrutor: ${nome}`}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <p className="font-semibold text-gray-900 dark:text-white text-lg">{nome}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300 break-all">{email}</p>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Eventos ministrados:{" "}
            <strong className="font-mono tabular-nums">{eventosNum}</strong>
          </p>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Média de avaliação:{" "}
            <strong className="text-blue-700 dark:text-blue-300">{mediaFormatada}</strong>
          </p>

          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
            {possuiAssinatura ? (
              <>
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400" />
                <span>
                  Possui assinatura: <strong className="text-green-600 dark:text-green-400">Sim</strong>
                </span>
              </>
            ) : (
              <>
                <XCircle size={16} className="text-red-600 dark:text-red-400" />
                <span>
                  Possui assinatura: <strong className="text-red-600 dark:text-red-400">Não</strong>
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex gap-2 mt-1 sm:mt-0">
          <button
            onClick={() => onVisualizar({ id, nome, email })}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-green-700/40"
            aria-label={`Ver histórico de ${nome}`}
            title="Ver histórico"
          >
            <Eye size={16} /> Histórico
          </button>
        </div>
      </div>
    </article>
  );
}

/* ===== PropTypes ===== */
TabelaInstrutor.propTypes = {
  instrutor: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      nome: PropTypes.string,
      email: PropTypes.string,
      eventosMinistrados: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      media_avaliacao: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      possuiAssinatura: PropTypes.bool,
    })
  ).isRequired,
  onVisualizar: PropTypes.func,
  className: PropTypes.string,
};

InstrutorCard.propTypes = {
  data: TabelaInstrutor.propTypes.instrutor.type, // reutiliza o shape
  onVisualizar: PropTypes.func.isRequired,
};
