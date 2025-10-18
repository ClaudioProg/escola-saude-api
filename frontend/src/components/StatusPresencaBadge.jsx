// 📁 src/components/StatusPresencaBadge.jsx
import PropTypes from "prop-types";
import { CheckCircle, XCircle, HelpCircle, Clock } from "lucide-react";

/**
 * Badge de status de presença.
 * - status aceitos: "presente" | "faltou" | "aguardando" | (outros → indefinido)
 * - label: sobrescreve o texto padrão
 * - size: "sm" | "md" | "lg"
 */
export default function StatusPresencaBadge({
  status,
  label,
  className = "",
  size = "md",
  ariaLive = "polite",
}) {
  const norm = String(status || "").toLowerCase().trim();

  const SIZE = {
    sm: { wrap: "px-1.5 py-0.5 text-[11px] rounded", icon: 12, gap: "gap-1" },
    md: { wrap: "px-2 py-1 text-xs rounded", icon: 14, gap: "gap-1.5" },
    lg: { wrap: "px-2.5 py-1.5 text-sm rounded-md", icon: 16, gap: "gap-2" },
  }[size] || { wrap: "px-2 py-1 text-xs rounded", icon: 14, gap: "gap-1.5" };

  const MAP = {
    presente: {
      Icon: CheckCircle,
      text: label || "Presente",
      cls: "bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-200 border border-green-200 dark:border-green-700/50",
      iconColor: "text-green-700 dark:text-green-300",
    },
    faltou: {
      Icon: XCircle,
      text: label || "Faltou",
      cls: "bg-red-100 text-red-800 dark:bg-red-800/30 dark:text-red-200 border border-red-200 dark:border-red-700/50",
      iconColor: "text-red-700 dark:text-red-300",
    },
    aguardando: {
      Icon: Clock,
      text: label || "Aguardando",
      cls: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 border border-amber-200 dark:border-amber-800/40",
      iconColor: "text-amber-700 dark:text-amber-300",
    },
    // fallback
    default: {
      Icon: HelpCircle,
      text: label || "Indefinido",
      cls: "bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-gray-200 border border-gray-300/60 dark:border-zinc-600",
      iconColor: "text-gray-600 dark:text-gray-300",
    },
  };

  const { Icon, text, cls, iconColor } = MAP[norm] || MAP.default;

  return (
    <span
      className={`inline-flex items-center ${SIZE.gap} font-semibold ${SIZE.wrap} ${cls} ${className}`}
      role="status"
      aria-live={ariaLive}
      aria-label={text}
    >
      <Icon size={SIZE.icon} className={iconColor} aria-hidden="true" />
      {text}
    </span>
  );
}

StatusPresencaBadge.propTypes = {
  status: PropTypes.string,
  label: PropTypes.string,
  className: PropTypes.string,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  /** Controle de anúncio em leitores de tela ("polite" por padrão) */
  ariaLive: PropTypes.oneOf(["off", "polite", "assertive"]),
};
