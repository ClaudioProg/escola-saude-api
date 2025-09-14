// 📁 src/components/SkeletonEvento.jsx
import PropTypes from "prop-types";

/**
 * SkeletonEvento
 * Componente de carregamento para detalhes de evento.
 * Mostra blocos animados simulando título, descrição e área de ações.
 */
export default function SkeletonEvento({ className = "" }) {
  return (
    <div
      className={`max-w-3xl mx-auto p-6 mt-8 animate-pulse ${className}`}
      aria-label="Carregando detalhes do evento"
      aria-busy="true"
      aria-live="polite"
      role="status"
      tabIndex={0}
    >
      <div className="h-8 bg-gray-200 dark:bg-zinc-700 rounded-lg w-2/3 mb-4" />
      <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded-lg w-full mb-3" />
      <div className="h-4 bg-gray-100 dark:bg-zinc-600 rounded-lg w-1/2 mb-3" />
      <div className="h-10 bg-gray-100 dark:bg-zinc-600 rounded-lg w-full" />
    </div>
  );
}

SkeletonEvento.propTypes = {
  /** Classe extra opcional para ajustes locais */
  className: PropTypes.string,
};
