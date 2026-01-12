// 📁 src/components/StatusPresencaBadge.jsx
import PropTypes from "prop-types";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  AlertTriangle,
  Unlock,
  Ban,
} from "lucide-react";

function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

/**
 * Badge de status de presença (premium)
 *
 * Status aceitos (case-insensitive):
 * - "presente"
 * - "faltou"
 * - "aguardando"
 * - "em_aberto"   (janela aberta p/ confirmar)
 * - "bloqueado"   (fora da janela)
 * - "justificado" (opcional)
 * - outros -> "indefinido"
 *
 * Props:
 * - label?: string (sobrescreve texto)
 * - size?: "sm" | "md" | "lg"
 * - ariaLive?: "off" | "polite" | "assertive"
 * - announce?: boolean (default false) -> quando true, usa role="status"
 * - showDot?: boolean (default false) -> mini bolinha de cor (fica lindo em tabela)
 */
export default function StatusPresencaBadge({
  status,
  label,
  className = "",
  size = "md",
  ariaLive = "polite",
  announce = false,
  showDot = false,
}) {
  const norm = String(status || "").toLowerCase().trim();

  const SIZE = {
    sm: { wrap: "px-2 py-0.5 text-[11px] rounded-full", icon: 12, gap: "gap-1", dot: "h-1.5 w-1.5" },
    md: { wrap: "px-2.5 py-1 text-xs rounded-full", icon: 14, gap: "gap-1.5", dot: "h-1.5 w-1.5" },
    lg: { wrap: "px-3 py-1.5 text-sm rounded-full", icon: 16, gap: "gap-2", dot: "h-2 w-2" },
  }[size] || { wrap: "px-2.5 py-1 text-xs rounded-full", icon: 14, gap: "gap-1.5", dot: "h-1.5 w-1.5" };

  const MAP = {
    presente: {
      Icon: CheckCircle2,
      text: label || "Presente",
      cls: "bg-emerald-500/12 text-emerald-900 ring-1 ring-emerald-700/20 dark:bg-emerald-400/10 dark:text-emerald-100 dark:ring-emerald-300/20",
      iconColor: "text-emerald-700 dark:text-emerald-300",
      dot: "bg-emerald-500",
    },
    faltou: {
      Icon: XCircle,
      text: label || "Faltou",
      cls: "bg-rose-500/12 text-rose-900 ring-1 ring-rose-700/20 dark:bg-rose-400/10 dark:text-rose-100 dark:ring-rose-300/20",
      iconColor: "text-rose-700 dark:text-rose-300",
      dot: "bg-rose-500",
    },
    aguardando: {
      Icon: Clock,
      text: label || "Aguardando",
      cls: "bg-amber-500/14 text-amber-950 ring-1 ring-amber-700/20 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-300/20",
      iconColor: "text-amber-700 dark:text-amber-300",
      dot: "bg-amber-500",
    },
    em_aberto: {
      Icon: Unlock,
      text: label || "Em aberto",
      cls: "bg-sky-500/12 text-sky-950 ring-1 ring-sky-700/20 dark:bg-sky-400/10 dark:text-sky-100 dark:ring-sky-300/20",
      iconColor: "text-sky-700 dark:text-sky-300",
      dot: "bg-sky-500",
    },
    bloqueado: {
      Icon: Ban,
      text: label || "Fora da janela",
      cls: "bg-zinc-500/12 text-zinc-900 ring-1 ring-zinc-700/20 dark:bg-white/10 dark:text-zinc-100 dark:ring-white/15",
      iconColor: "text-zinc-700 dark:text-zinc-200",
      dot: "bg-zinc-500",
    },
    justificado: {
      Icon: AlertTriangle,
      text: label || "Justificado",
      cls: "bg-violet-500/12 text-violet-950 ring-1 ring-violet-700/20 dark:bg-violet-400/10 dark:text-violet-100 dark:ring-violet-300/20",
      iconColor: "text-violet-700 dark:text-violet-300",
      dot: "bg-violet-500",
    },
    default: {
      Icon: HelpCircle,
      text: label || "Indefinido",
      cls: "bg-zinc-200/70 text-zinc-900 ring-1 ring-black/10 dark:bg-white/10 dark:text-zinc-100 dark:ring-white/15",
      iconColor: "text-zinc-700 dark:text-zinc-200",
      dot: "bg-zinc-500",
    },
  };

  const picked = MAP[norm] || MAP.default;
  const { Icon, text, cls, iconColor } = picked;

  return (
    <span
      className={cx(
        "inline-flex items-center font-extrabold whitespace-nowrap",
        SIZE.gap,
        SIZE.wrap,
        cls,
        "shadow-[0_10px_35px_-32px_rgba(2,6,23,0.35)]",
        className
      )}
      role={announce ? "status" : undefined}
      aria-live={announce ? ariaLive : undefined}
      aria-label={text}
      title={text}
    >
      {showDot && <span className={cx("rounded-full", SIZE.dot, picked.dot)} aria-hidden="true" />}
      <Icon size={SIZE.icon} className={iconColor} aria-hidden="true" />
      <span className="leading-none">{text}</span>
    </span>
  );
}

StatusPresencaBadge.propTypes = {
  status: PropTypes.string,
  label: PropTypes.string,
  className: PropTypes.string,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  ariaLive: PropTypes.oneOf(["off", "polite", "assertive"]),
  announce: PropTypes.bool,
  showDot: PropTypes.bool,
};
