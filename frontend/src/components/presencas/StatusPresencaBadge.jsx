// ✅ src/components/presencas/StatusPresencaBadge.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Badge visual de status de presença.
//
// Contratos aplicados:
// - Componente específico do domínio presenças;
// - Sem API;
// - Sem toast;
// - Sem alias legado;
// - Estados visuais oficiais do componente:
//   presente | faltou | aguardando | em_aberto | bloqueado | justificado | indefinido
// - Acessível com aria-label, title e suporte opcional a role="status";
// - Tamanhos controlados: sm | md | lg;
// - Suporte opcional a ponto visual;
// - Mobile-first, dark mode e visual v2.0.

import PropTypes from "prop-types";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  HelpCircle,
  Unlock,
  XCircle,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
 * Constantes
 * ───────────────────────────────────────────────────────────── */

const STATUS_VISUAL = Object.freeze({
  PRESENTE: "presente",
  FALTOU: "faltou",
  AGUARDANDO: "aguardando",
  EM_ABERTO: "em_aberto",
  BLOQUEADO: "bloqueado",
  JUSTIFICADO: "justificado",
  INDEFINIDO: "indefinido",
});

const SIZE_MAP = Object.freeze({
  sm: {
    wrap: "px-2 py-0.5 text-[11px] rounded-full",
    icon: 12,
    gap: "gap-1",
    dot: "h-1.5 w-1.5",
  },
  md: {
    wrap: "px-2.5 py-1 text-xs rounded-full",
    icon: 14,
    gap: "gap-1.5",
    dot: "h-1.5 w-1.5",
  },
  lg: {
    wrap: "px-3 py-1.5 text-sm rounded-full",
    icon: 16,
    gap: "gap-2",
    dot: "h-2 w-2",
  },
});

const STATUS_MAP = Object.freeze({
  [STATUS_VISUAL.PRESENTE]: {
    Icon: CheckCircle2,
    defaultText: "Presente",
    className:
      "bg-emerald-500/12 text-emerald-900 ring-1 ring-emerald-700/20 dark:bg-emerald-400/10 dark:text-emerald-100 dark:ring-emerald-300/20",
    iconClassName: "text-emerald-700 dark:text-emerald-300",
    dotClassName: "bg-emerald-500",
  },

  [STATUS_VISUAL.FALTOU]: {
    Icon: XCircle,
    defaultText: "Faltou",
    className:
      "bg-rose-500/12 text-rose-900 ring-1 ring-rose-700/20 dark:bg-rose-400/10 dark:text-rose-100 dark:ring-rose-300/20",
    iconClassName: "text-rose-700 dark:text-rose-300",
    dotClassName: "bg-rose-500",
  },

  [STATUS_VISUAL.AGUARDANDO]: {
    Icon: Clock,
    defaultText: "Aguardando",
    className:
      "bg-amber-500/14 text-amber-950 ring-1 ring-amber-700/20 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-300/20",
    iconClassName: "text-amber-700 dark:text-amber-300",
    dotClassName: "bg-amber-500",
  },

  [STATUS_VISUAL.EM_ABERTO]: {
    Icon: Unlock,
    defaultText: "Em aberto",
    className:
      "bg-sky-500/12 text-sky-950 ring-1 ring-sky-700/20 dark:bg-sky-400/10 dark:text-sky-100 dark:ring-sky-300/20",
    iconClassName: "text-sky-700 dark:text-sky-300",
    dotClassName: "bg-sky-500",
  },

  [STATUS_VISUAL.BLOQUEADO]: {
    Icon: Ban,
    defaultText: "Fora da janela",
    className:
      "bg-slate-500/12 text-slate-900 ring-1 ring-slate-700/20 dark:bg-white/10 dark:text-slate-100 dark:ring-white/15",
    iconClassName: "text-slate-700 dark:text-slate-200",
    dotClassName: "bg-slate-500",
  },

  [STATUS_VISUAL.JUSTIFICADO]: {
    Icon: AlertTriangle,
    defaultText: "Justificado",
    className:
      "bg-violet-500/12 text-violet-950 ring-1 ring-violet-700/20 dark:bg-violet-400/10 dark:text-violet-100 dark:ring-violet-300/20",
    iconClassName: "text-violet-700 dark:text-violet-300",
    dotClassName: "bg-violet-500",
  },

  [STATUS_VISUAL.INDEFINIDO]: {
    Icon: HelpCircle,
    defaultText: "Indefinido",
    className:
      "bg-slate-200/70 text-slate-900 ring-1 ring-black/10 dark:bg-white/10 dark:text-slate-100 dark:ring-white/15",
    iconClassName: "text-slate-700 dark:text-slate-200",
    dotClassName: "bg-slate-500",
  },
});

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizarStatus(status) {
  const value = String(status || "").trim().toLowerCase();

  return Object.values(STATUS_VISUAL).includes(value)
    ? value
    : STATUS_VISUAL.INDEFINIDO;
}

function getSize(size) {
  return SIZE_MAP[size] || SIZE_MAP.md;
}

/* ─────────────────────────────────────────────────────────────
 * Componente
 * ───────────────────────────────────────────────────────────── */

export default function StatusPresencaBadge({
  status,
  label,
  className = "",
  size = "md",
  ariaLive = "polite",
  announce = false,
  showDot = false,
}) {
  const statusSeguro = normalizarStatus(status);
  const sizeConfig = getSize(size);
  const config = STATUS_MAP[statusSeguro] || STATUS_MAP.indefinido;

  const Icon = config.Icon;
  const text = label || config.defaultText;

  return (
    <span
      className={classNames(
        "inline-flex items-center whitespace-nowrap font-black",
        "shadow-[0_10px_35px_-32px_rgba(2,6,23,0.35)]",
        sizeConfig.gap,
        sizeConfig.wrap,
        config.className,
        className
      )}
      role={announce ? "status" : undefined}
      aria-live={announce ? ariaLive : undefined}
      aria-label={text}
      title={text}
    >
      {showDot && (
        <span
          className={classNames(
            "shrink-0 rounded-full",
            sizeConfig.dot,
            config.dotClassName
          )}
          aria-hidden="true"
        />
      )}

      <Icon
        size={sizeConfig.icon}
        className={classNames("shrink-0", config.iconClassName)}
        aria-hidden="true"
      />

      <span className="leading-none">{text}</span>
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * PropTypes
 * ───────────────────────────────────────────────────────────── */

StatusPresencaBadge.propTypes = {
  status: PropTypes.oneOf([
    "presente",
    "faltou",
    "aguardando",
    "em_aberto",
    "bloqueado",
    "justificado",
    "indefinido",
  ]),
  label: PropTypes.string,
  className: PropTypes.string,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  ariaLive: PropTypes.oneOf(["off", "polite", "assertive"]),
  announce: PropTypes.bool,
  showDot: PropTypes.bool,
};