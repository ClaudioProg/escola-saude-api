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
  if (["andamento", "em andamento", "ao vivo", "rolando", "in progress"].includes(s))
    return "andamento";

  // programado
  if (["programado", "agendado", "previsto, previsto", "scheduled"].includes(s))
    return "programado";

  // encerrado
  if (
    ["encerrado", "finalizado", "concluido", "concluído", "done", "finalizado com sucesso"].includes(
      s
    )
  )
    return "encerrado";

  // aguardando / pendente
  if (["aguardando", "pendente", "waiting", "to do"].includes(s)) return "aguardando";

  // cancelado
  if (["cancelado", "cancelada", "canceled"].includes(s)) return "cancelado";

  // suspenso / pausado
  if (["suspenso", "pausado", "paused", "interrompido"].includes(s)) return "suspenso";

  // rascunho / draft
  if (["rascunho", "draft"].includes(s)) return "rascunho";

  // ativo / inativo (auxiliar p/ outros contextos)
  if (["ativo", "active"].includes(s)) return "ativo";
  if (["inativo", "inactive", "desativado"].includes(s)) return "inativo";

  return "desconhecido";
}

/* =========================================================
   Config por status (label + cor base)
   Padrão institucional (#54):
   - Programado → VERDE
   - Em andamento → AMARELO
   - Encerrado → VERMELHO
   ========================================================= */
const STATUS_CONFIG = {
  andamento: { label: "Em andamento", color: "amber" },   // 🟨
  programado: { label: "Programado", color: "green" },    // 🟩
  encerrado: { label: "Encerrado", color: "red" },        // 🟥

  aguardando: { label: "Aguardando", color: "amber" },
  cancelado: { label: "Cancelado", color: "rose" },
  suspenso: { label: "Suspenso", color: "orange" },
  rascunho: { label: "Rascunho", color: "zinc" },
  ativo: { label: "Ativo", color: "emerald" },
  inativo: { label: "Inativo", color: "zinc" },
  desconhecido: { label: "Desconhecido", color: "gray" },
};

/* =========================================================
   Classes por variante (com dark-mode)
   - green usa o nosso padrão (verde-900 em contorno/sombra),
     mantendo readable contrast no "soft".
   ========================================================= */
function variantClasses(color, variant) {
  const map = {
    green: {
      solid:
        "bg-green-600 text-white border-green-700 dark:bg-green-700 dark:border-green-800",
      soft:
        "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800/60",
      outline:
        "text-green-800 border-green-400 dark:text-green-200 dark:border-green-600",
    },
    amber: {
      solid:
        "bg-amber-500 text-black border-amber-600 dark:bg-amber-600 dark:text-black dark:border-amber-700",
      soft:
        "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800/60",
      outline:
        "text-amber-800 border-amber-400 dark:text-amber-200 dark:border-amber-600",
    },
    red: {
      solid:
        "bg-red-600 text-white border-red-700 dark:bg-red-700 dark:border-red-800",
      soft:
        "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800/60",
      outline:
        "text-red-700 border-red-400 dark:text-red-200 dark:border-red-600",
    },
    rose: {
      solid:
        "bg-rose-600 text-white border-rose-700 dark:bg-rose-700 dark:border-rose-800",
      soft:
        "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800/60",
      outline:
        "text-rose-700 border-rose-400 dark:text-rose-200 dark:border-rose-600",
    },
    orange: {
      solid:
        "bg-orange-600 text-white border-orange-700 dark:bg-orange-700 dark:border-orange-800",
      soft:
        "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-800/60",
      outline:
        "text-orange-700 border-orange-400 dark:text-orange-200 dark:border-orange-600",
    },
    emerald: {
      solid:
        "bg-emerald-600 text-white border-emerald-700 dark:bg-emerald-700 dark:border-emerald-800",
      soft:
        "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800/60",
      outline:
        "text-emerald-700 border-emerald-400 dark:text-emerald-200 dark:border-emerald-600",
    },
    zinc: {
      solid:
        "bg-zinc-600 text-white border-zinc-700 dark:bg-zinc-700 dark:border-zinc-800",
      soft:
        "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-900/30 dark:text-zinc-200 dark:border-zinc-700/60",
      outline:
        "text-zinc-700 border-zinc-400 dark:text-zinc-200 dark:border-zinc-600",
    },
    gray: {
      solid:
        "bg-gray-500 text-white border-gray-600 dark:bg-gray-600 dark:border-gray-700",
      soft:
        "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-200 dark:border-gray-700/60",
      outline:
        "text-gray-700 border-gray-400 dark:text-gray-200 dark:border-gray-600",
    },
  };

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
}) {
  const key = toKey(status);
  const { label, color } = STATUS_CONFIG[key] || STATUS_CONFIG.desconhecido;

  const base =
    "inline-flex items-center font-semibold border shadow-sm select-none " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
    "focus-visible:ring-green-900/50"; // foco consistente com verde-900

  const radius =
    rounded === "full" ? "rounded-full" : rounded === "lg" ? "rounded-lg" : "rounded-md";

  const classes = [
    base,
    sizeClasses(size),
    variantClasses(color, variant),
    radius,
    className,
  ].join(" ");

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
      {showIcon && <StatusIcon k={key} />}
      <span>{label}</span>
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
};
