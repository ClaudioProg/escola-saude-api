// 📁 src/components/StatusPresencaBadge.jsx
import PropTypes from "prop-types";
import { CheckCircle, XCircle, HelpCircle } from "lucide-react";

/**
 * Badge que exibe o status de presença.
 *
 * @param {string} status - "presente" | "faltou" | outro
 * @param {string} label  - Texto opcional que substitui o padrão
 * @param {string} className - Classe extra para o <span>
 */
export default function StatusPresencaBadge({ status, label, className = "" }) {
  if (status === "presente") {
    return (
      <span
        className={`flex items-center gap-1 bg-green-100 text-green-800 dark:bg-green-600/30 dark:text-green-300 px-2 py-1 rounded text-xs font-semibold ${className}`}
        aria-label={label || "Presente"}
        aria-live="polite"
        role="status"
      >
        <CheckCircle size={14} className="text-green-700 dark:text-green-300" />
        {label || "Presente"}
      </span>
    );
  }

  if (status === "faltou") {
    return (
      <span
        className={`flex items-center gap-1 bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300 px-2 py-1 rounded text-xs font-semibold ${className}`}
        aria-label={label || "Faltou"}
        aria-live="polite"
        role="status"
      >
        <XCircle size={14} className="text-red-600 dark:text-red-300" />
        {label || "Faltou"}
      </span>
    );
  }

  // Estado neutro/desconhecido
  return (
    <span
      className={`flex items-center gap-1 bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-gray-300 px-2 py-1 rounded text-xs font-semibold ${className}`}
      aria-label={label || "Indefinido"}
      aria-live="polite"
      role="status"
    >
      <HelpCircle size={14} className="text-gray-600 dark:text-gray-300" />
      {label || "Indefinido"}
    </span>
  );
}

StatusPresencaBadge.propTypes = {
  status: PropTypes.string,
  label: PropTypes.string,
  className: PropTypes.string,
};
