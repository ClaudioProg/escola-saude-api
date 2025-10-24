// 📁 src/components/BadgeStatus.jsx
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import {
  CalendarClock,
  Clock,
  CheckCircle2,
  XCircle,
  PauseCircle,
  CircleAlert,
  Circle,
} from "lucide-react";

/* =========================================================
   Helpers de normalização
   ========================================================= */
function normalize(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Mapeia aliases -> chave canonical */
function toKey(status) {
  const s = normalize(status);

  // em andamento
  if (
    [
      "andamento",
      "em andamento",
      "em_andamento",
      "ao vivo",
      "rolando",
      "in progress",
      "em-andamento",
    ].includes(s)
  )
    return "andamento";

  // programado
  if (["programado", "agendado", "previsto", "scheduled"].includes(s))
    return "programado";

  // encerrado
  if (
    [
      "encerrado",
      "finalizado",
      "concluido",
      "concluído",
      "done",
      "finalizado com sucesso",
      "encerrado_com_sucesso",
    ].includes(s)
  )
    return "encerrado";

  // aguardando / pendente
  if (["aguardando", "pendente", "waiting", "to do", "todo"].includes(s))
    return "aguardando";

  // cancelado
  if (["cancelado", "cancelada", "canceled", "cancelled"].includes(s))
    return "cancelado";

  // suspenso / pausado
  if (["suspenso", "pausado", "paused", "interrompido"].includes(s))
    return "suspenso";

  // rascunho / draft
  if (["rascunho", "draft"].includes(s)) return "rascunho";

  // ativo / inativo
  if (["ativo", "active"].includes(s)) return "ativo";
  if (["inativo", "inactive", "desativado", "desativada", "disabled"].includes(s))
    return "inativo";

  // todos (usado no dashboard pra estado "neutro")
  if (["todos", "all", "geral", "neutro"].includes(s)) return "todos";

  return "desconhecido";
}

/* =========================================================
   Config por status (label + cor base)
   ========================================================= */
const STATUS_CONFIG = {
  andamento: { label: "Em andamento", color: "amber" }, // 🟨
  programado: { label: "Programado", color: "green" }, // 🟩
  encerrado: { label: "Encerrado", color: "red" }, // 🟥

  aguardando: { label: "Aguardando", color: "amber" },
  cancelado: { label: "Cancelado", color: "rose" },
  suspenso: { label: "Suspenso", color: "orange" },
  rascunho: { label: "Rascunho", color: "zinc" },
  ativo: { label: "Ativo", color: "emerald" },
  inativo: { label: "Inativo", color: "zinc" },

  // estado neutro / genérico
  todos: { label: "—", color: "zinc" },

  desconhecido: { label: "Desconhecido", color: "gray" },
};

/* =========================================================
   Gradientes 3 cores para sólido
   ========================================================= */
const GRADS = {
  green:
    "bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white border-emerald-900/50",
  amber:
    "bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-black border-amber-900/50",
  red:
    "bg-gradient-to-br from-red-600 via-red-700 to-red-800 text-white border-red-900/50",
  rose:
    "bg-gradient-to-br from-rose-600 via-rose-700 to-rose-800 text-white border-rose-900/50",
  orange:
    "bg-gradient-to-br from-orange-600 via-orange-700 to-orange-800 text-white border-orange-900/50",
  emerald:
    "bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white border-emerald-900/50",
  zinc:
    "bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-800 text-white border-zinc-900/50",
  gray:
    "bg-gradient-to-br from-gray-600 via-gray-700 to-gray-800 text-white border-gray-900/50",
};

/* =========================================================
   Classes por variante (com dark-mode)
   ========================================================= */
function variantClasses(color, variant) {
  const map = {
    green: {
      soft:
        "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/25 dark:text-green-200 dark:border-green-800/50",
      outline:
        "text-green-800 border-green-400 dark:text-green-200 dark:border-green-600",
    },
    amber: {
      soft:
        "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/25 dark:text-amber-200 dark:border-amber-800/50",
      outline:
        "text-amber-800 border-amber-400 dark:text-amber-200 dark:border-amber-600",
    },
    red: {
      soft:
        "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/25 dark:text-red-200 dark:border-red-800/50",
      outline:
        "text-red-700 border-red-400 dark:text-red-200 dark:border-red-600",
    },
    rose: {
      soft:
        "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/25 dark:text-rose-200 dark:border-rose-800/50",
      outline:
        "text-rose-700 border-rose-400 dark:text-rose-200 dark:border-rose-600",
    },
    orange: {
      soft:
        "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/25 dark:text-orange-200 dark:border-orange-800/50",
      outline:
        "text-orange-700 border-orange-400 dark:text-orange-200 dark:border-orange-600",
    },
    emerald: {
      soft:
        "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-200 dark:border-emerald-800/50",
      outline:
        "text-emerald-700 border-emerald-400 dark:text-emerald-200 dark:border-emerald-600",
    },
    zinc: {
      soft:
        "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-900/25 dark:text-zinc-200 dark:border-zinc-700/50",
      outline:
        "text-zinc-700 border-zinc-400 dark:text-zinc-200 dark:border-zinc-600",
    },
    gray: {
      soft:
        "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/25 dark:text-gray-200 dark:border-gray-700/50",
      outline:
        "text-gray-700 border-gray-400 dark:text-gray-200 dark:border-gray-600",
    },
  };

  if (variant === "solid") {
    return GRADS[color] || GRADS.gray;
  }

  const c = map[color] || map.gray;
  return c[variant] || c.soft;
}

/* =========================================================
   Tamanho
   ========================================================= */
function sizeClasses(size) {
  switch (size) {
    case "sm":
      return "text-[11px] px-2 py-0.5 gap-1";
    case "lg":
      return "text-sm px-3.5 py-1.5 gap-2";
    default:
      return "text-xs px-3 py-1 gap-1.5"; // md
  }
}

/* =========================================================
   Ícones por status
   ========================================================= */
function StatusIcon({ k }) {
  switch (k) {
    case "andamento":
      return <Clock size={14} aria-hidden="true" />;
    case "programado":
      return <CalendarClock size={14} aria-hidden="true" />;
    case "encerrado":
      return <CheckCircle2 size={14} aria-hidden="true" />;
    case "cancelado":
      return <XCircle size={14} aria-hidden="true" />;
    case "suspenso":
      return <PauseCircle size={14} aria-hidden="true" />;
    case "aguardando":
      return <CircleAlert size={14} aria-hidden="true" />;
    case "ativo":
      return <CheckCircle2 size={14} aria-hidden="true" />;
    case "inativo":
    case "rascunho":
      return <Circle size={14} aria-hidden="true" />;
    case "todos":
      return <Circle size={14} aria-hidden="true" />;
    default:
      return <CircleAlert size={14} aria-hidden="true" />;
  }
}

/* =========================================================
   Componente
   ========================================================= */
export default function BadgeStatus({
  status,
  variant = "soft", // 'soft' | 'solid' | 'outline'
  size = "md", // 'sm' | 'md' | 'lg'
  showIcon = true,
  rounded = "full", // 'full' | 'md' | 'lg'
  className = "",
  title, // tooltip opcional

  // opcionais / retrocompatíveis
  pulseWhenLive = true, // animação sutil quando em andamento
  labels, // { key: "Novo rótulo" } para sobrescrever texto se quiser
}) {
  const key = toKey(status);
  const baseCfg = STATUS_CONFIG[key] || STATUS_CONFIG.desconhecido;
  const label = labels?.[key] || baseCfg.label;
  const color = baseCfg.color;

  const base =
    "inline-flex items-center font-semibold border select-none " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
    (color === "green"
      ? "focus-visible:ring-emerald-300/70 "
      : color === "amber"
      ? "focus-visible:ring-amber-400/70 "
      : color === "red"
      ? "focus-visible:ring-red-400/70 "
      : color === "rose"
      ? "focus-visible:ring-rose-400/70 "
      : color === "orange"
      ? "focus-visible:ring-orange-400/70 "
      : color === "emerald"
      ? "focus-visible:ring-emerald-300/70 "
      : color === "zinc"
      ? "focus-visible:ring-zinc-400/70 "
      : "focus-visible:ring-gray-400/70 ");

  const radius =
    rounded === "full"
      ? "rounded-full"
      : rounded === "lg"
      ? "rounded-lg"
      : "rounded-md";

  const classes = [
    base,
    sizeClasses(size),
    variantClasses(color, variant),
    "shadow-sm",
    radius,
    className,
  ].join(" ");

  // anima pulso leve quando está "Em andamento"
  const shouldPulse = pulseWhenLive && key === "andamento";

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18 }}
      className={classes}
      title={title || (typeof status === "string" ? status : label)}
      aria-label={label}
      role="status"
    >
      {showIcon && (
        <motion.span
          className="inline-flex"
          animate={shouldPulse ? { scale: [1, 1.06, 1] } : undefined}
          transition={
            shouldPulse
              ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
              : undefined
          }
        >
          <StatusIcon k={key} />
        </motion.span>
      )}
      <span className="ml-1">{label}</span>
    </motion.span>
  );
}

BadgeStatus.propTypes = {
  status: PropTypes.any.isRequired,
  variant: PropTypes.oneOf(["soft", "solid", "outline"]),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  showIcon: PropTypes.bool,
  rounded: PropTypes.oneOf(["full", "md", "lg"]),
  className: PropTypes.string,
  title: PropTypes.string,
  pulseWhenLive: PropTypes.bool,
  labels: PropTypes.object,
};
