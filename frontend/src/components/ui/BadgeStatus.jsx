// ✅ frontend/src/components/ui/BadgeStatus.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Badge genérico oficial de status.
//
// Revisão premium:
// - componente realmente genérico de UI;
// - contrato limpo com chaves oficiais;
// - sem aliases estrangeiros/legados;
// - sem status "todos" como valor funcional;
// - sem status "desconhecido" como contrato aceito;
// - fallback interno apenas para diagnóstico visual de valor inválido;
// - visual premium consistente;
// - dark mode;
// - reduced motion;
// - acessibilidade;
// - suporte a variantes, tamanhos, ícones, pulso controlado e aria-live;
// - pronto para uso em eventos, presenças, certificados, usuários, inscrições e reservas.
//
// Status oficiais de eventos/turmas:
// - programado
// - andamento
// - encerrado
// - sem_datas

import PropTypes from "prop-types";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock,
  PauseCircle,
  XCircle,
} from "lucide-react";

const STATUS_INVALIDO = Object.freeze({
  key: "status_invalido",
  label: "Status inválido",
  color: "slate",
  icon: AlertCircle,
});

const STATUS_CONFIG = Object.freeze({
  programado: {
    label: "Programado",
    color: "emerald",
    icon: CalendarClock,
  },

  andamento: {
    label: "Em andamento",
    color: "amber",
    icon: Clock,
    live: true,
  },

  encerrado: {
    label: "Encerrado",
    color: "rose",
    icon: CheckCircle2,
  },

  sem_datas: {
    label: "Sem datas",
    color: "slate",
    icon: CircleDashed,
  },

  aguardando: {
    label: "Aguardando",
    color: "amber",
    icon: AlertCircle,
  },

  pendente: {
    label: "Pendente",
    color: "amber",
    icon: AlertCircle,
  },

  aprovado: {
    label: "Aprovado",
    color: "emerald",
    icon: CheckCircle2,
  },

  confirmado: {
    label: "Confirmado",
    color: "emerald",
    icon: CheckCircle2,
  },

  presente: {
    label: "Presente",
    color: "emerald",
    icon: CheckCircle2,
  },

  ativo: {
    label: "Ativo",
    color: "emerald",
    icon: CheckCircle2,
  },

  rejeitado: {
    label: "Rejeitado",
    color: "rose",
    icon: XCircle,
  },

  cancelado: {
    label: "Cancelado",
    color: "rose",
    icon: XCircle,
  },

  faltou: {
    label: "Faltou",
    color: "rose",
    icon: XCircle,
  },

  expirado: {
    label: "Expirado",
    color: "rose",
    icon: XCircle,
  },

  inativo: {
    label: "Inativo",
    color: "zinc",
    icon: CircleDashed,
  },

  rascunho: {
    label: "Rascunho",
    color: "zinc",
    icon: CircleDashed,
  },

  suspenso: {
    label: "Suspenso",
    color: "orange",
    icon: PauseCircle,
  },

  bloqueado: {
    label: "Bloqueado",
    color: "orange",
    icon: PauseCircle,
  },
});

const STATUS_OFICIAIS = Object.freeze(Object.keys(STATUS_CONFIG));

const COLOR_CLASSES = Object.freeze({
  emerald: {
    soft:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200",
    solid:
      "border-emerald-800/50 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white",
    outline:
      "border-emerald-400 bg-transparent text-emerald-700 dark:border-emerald-700 dark:text-emerald-200",
    focus: "focus-visible:ring-emerald-500",
  },

  amber: {
    soft:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200",
    solid:
      "border-amber-800/50 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950",
    outline:
      "border-amber-400 bg-transparent text-amber-800 dark:border-amber-700 dark:text-amber-200",
    focus: "focus-visible:ring-amber-500",
  },

  rose: {
    soft:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200",
    solid:
      "border-rose-900/50 bg-gradient-to-br from-rose-600 via-rose-700 to-rose-800 text-white",
    outline:
      "border-rose-400 bg-transparent text-rose-700 dark:border-rose-700 dark:text-rose-200",
    focus: "focus-visible:ring-rose-500",
  },

  orange: {
    soft:
      "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800/60 dark:bg-orange-950/40 dark:text-orange-200",
    solid:
      "border-orange-900/50 bg-gradient-to-br from-orange-600 via-orange-700 to-orange-800 text-white",
    outline:
      "border-orange-400 bg-transparent text-orange-700 dark:border-orange-700 dark:text-orange-200",
    focus: "focus-visible:ring-orange-500",
  },

  zinc: {
    soft:
      "border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-700/70 dark:bg-zinc-900/60 dark:text-zinc-200",
    solid:
      "border-zinc-900/50 bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-800 text-white",
    outline:
      "border-zinc-400 bg-transparent text-zinc-700 dark:border-zinc-700 dark:text-zinc-200",
    focus: "focus-visible:ring-zinc-500",
  },

  slate: {
    soft:
      "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200",
    solid:
      "border-slate-900/50 bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 text-white",
    outline:
      "border-slate-400 bg-transparent text-slate-700 dark:border-slate-700 dark:text-slate-200",
    focus: "focus-visible:ring-slate-500",
  },
});

const SIZE_CLASSES = Object.freeze({
  sm: {
    root: "gap-1 px-2 py-0.5 text-[11px]",
    icon: "h-3.5 w-3.5",
  },

  md: {
    root: "gap-1.5 px-3 py-1 text-xs",
    icon: "h-4 w-4",
  },

  lg: {
    root: "gap-2 px-3.5 py-1.5 text-sm",
    icon: "h-[18px] w-[18px]",
  },
});

const RADIUS_CLASSES = Object.freeze({
  full: "rounded-full",
  lg: "rounded-xl",
  md: "rounded-lg",
});

const VARIANTES = Object.freeze(["soft", "solid", "outline"]);
const TAMANHOS = Object.freeze(["sm", "md", "lg"]);
const RAIOS = Object.freeze(["full", "md", "lg"]);
const TAGS = Object.freeze(["span", "div", "button"]);

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizarStatus(status) {
  return String(status || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function getConfigByStatus(status) {
  const key = normalizarStatus(status);

  if (!key || !STATUS_CONFIG[key]) {
    return {
      key: STATUS_INVALIDO.key,
      config: STATUS_INVALIDO,
      valido: false,
      raw: typeof status === "string" ? status : "",
    };
  }

  return {
    key,
    config: STATUS_CONFIG[key],
    valido: true,
    raw: typeof status === "string" ? status : "",
  };
}

export function getStatusKey(status) {
  const { key, valido } = getConfigByStatus(status);

  return valido ? key : null;
}

export function getStatusLabel(status) {
  const { config } = getConfigByStatus(status);

  return config.label;
}

function getMotionTag(as) {
  if (as === "button") return motion.button;
  if (as === "div") return motion.div;

  return motion.span;
}

function normalizarVariant(value) {
  return VARIANTES.includes(value) ? value : "soft";
}

function normalizarSize(value) {
  return TAMANHOS.includes(value) ? value : "md";
}

function normalizarRounded(value) {
  return RAIOS.includes(value) ? value : "full";
}

function normalizarAs(value) {
  return TAGS.includes(value) ? value : "span";
}

export default function BadgeStatus({
  status,
  variant = "soft",
  size = "md",
  showIcon = true,
  rounded = "full",
  className = "",
  title,
  pulseWhenLive = true,
  labels = null,
  announce = false,
  as = "span",
  type,
  ...props
}) {
  const prefersReducedMotion = useReducedMotion();

  const { key, config, valido, raw } = getConfigByStatus(status);

  const variantSeguro = normalizarVariant(variant);
  const sizeSeguro = normalizarSize(size);
  const roundedSeguro = normalizarRounded(rounded);
  const asSeguro = normalizarAs(as);

  const color = COLOR_CLASSES[config.color] || COLOR_CLASSES.slate;
  const sizeClass = SIZE_CLASSES[sizeSeguro] || SIZE_CLASSES.md;
  const radiusClass = RADIUS_CLASSES[roundedSeguro] || RADIUS_CLASSES.full;

  const labelCustomizado =
    labels && typeof labels === "object" && typeof labels[key] === "string"
      ? labels[key].trim()
      : "";

  const label = labelCustomizado || config.label;
  const Icon = config.icon || AlertCircle;

  const shouldPulse =
    pulseWhenLive &&
    config.live &&
    valido &&
    !prefersReducedMotion &&
    variantSeguro !== "outline";

  const MotionTag = getMotionTag(asSeguro);

  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, scale: 0.96 },
        animate: { opacity: 1, scale: 1 },
        transition: { duration: 0.16 },
      };

  return (
    <MotionTag
      {...motionProps}
      {...props}
      type={asSeguro === "button" ? type || "button" : undefined}
      className={classNames(
        "inline-flex items-center border font-black shadow-sm select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
        color.focus,
        color[variantSeguro] || color.soft,
        sizeClass.root,
        radiusClass,
        !valido && "border-dashed",
        className
      )}
      title={title || label}
      aria-label={label}
      role={announce ? "status" : props.role}
      aria-live={announce ? "polite" : props["aria-live"]}
      data-status-key={key}
      data-status-valid={valido ? "true" : "false"}
      data-status-raw={raw}
    >
      {showIcon && (
        <motion.span
          className="inline-flex shrink-0"
          animate={shouldPulse ? { scale: [1, 1.08, 1] } : undefined}
          transition={
            shouldPulse
              ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
              : undefined
          }
          aria-hidden="true"
        >
          <Icon className={sizeClass.icon} />
        </motion.span>
      )}

      <span>{label}</span>
    </MotionTag>
  );
}

BadgeStatus.propTypes = {
  status: PropTypes.oneOf(STATUS_OFICIAIS).isRequired,
  variant: PropTypes.oneOf(VARIANTES),
  size: PropTypes.oneOf(TAMANHOS),
  showIcon: PropTypes.bool,
  rounded: PropTypes.oneOf(RAIOS),
  className: PropTypes.string,
  title: PropTypes.string,
  pulseWhenLive: PropTypes.bool,
  labels: PropTypes.object,
  announce: PropTypes.bool,
  as: PropTypes.oneOf(TAGS),
  type: PropTypes.oneOf(["button", "submit", "reset"]),
};