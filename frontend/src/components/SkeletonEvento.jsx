// 📁 src/components/SkeletonEvento.jsx
import PropTypes from "prop-types";

/**
 * SkeletonEvento
 * Exibe placeholders animados simulando os detalhes de um evento
 * (título, descrição e área de ações) com acessibilidade e dark mode.
 */
export default function SkeletonEvento({ className = "" }) {
  return (
    <div
      className={`max-w-3xl mx-auto p-6 sm:p-8 mt-6 sm:mt-8 animate-pulse ${className}`}
      aria-label="Carregando detalhes do evento"
      aria-busy="true"
      aria-live="polite"
      role="status"
      tabIndex={0}
    >
      {/* Título principal */}
      <div className="h-8 w-2/3 mb-4 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-700" />

      {/* Linhas de descrição */}
      <div className="h-4 w-full mb-3 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-700" />
      <div className="h-4 w-5/6 mb-3 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-700" />
      <div className="h-4 w-3/4 mb-5 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-700" />

      {/* Bloco de ações (ex: botões) */}
      <div className="h-10 w-1/2 rounded-xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 dark:from-zinc-600 dark:via-zinc-500 dark:to-zinc-600" />
    </div>
  );
}

SkeletonEvento.propTypes = {
  /** Classe extra opcional para ajustes locais */
  className: PropTypes.string,
};
