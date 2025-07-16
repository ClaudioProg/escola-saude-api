// components/StatusPresencaBadge.jsx
import { CheckCircle, XCircle } from "lucide-react";

/**
 * Componente visual para exibir o status de presença.
 * Props:
 * - status: "presente" | "faltou"
 */
export default function StatusPresencaBadge({ status }) {
  if (status === "presente") {
    return (
      <span
        className="flex items-center gap-1 bg-yellow-200 text-yellow-900 dark:bg-yellow-400 dark:text-black px-2 py-1 rounded text-xs font-semibold"
        aria-label="Presente"
        aria-live="polite"
        role="status"
      >
        <CheckCircle size={14} className="text-yellow-800 dark:text-black" />
        Presente
      </span>
    );
  }

  if (status === "faltou") {
    return (
      <span
        className="flex items-center gap-1 bg-red-300 text-white dark:bg-red-600 dark:text-white px-2 py-1 rounded text-xs font-semibold"
        aria-label="Faltou"
        aria-live="polite"
        role="status"
      >
        <XCircle size={14} className="text-white" />
        Faltou
      </span>
    );
  }

  return null;
}
