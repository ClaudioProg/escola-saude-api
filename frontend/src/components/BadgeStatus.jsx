// src/components/BadgeStatus.jsx
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
  if (["andamento", "em andamento", "ao vivo", "rolando", "in progress"].includes(s)) return "andamento";

  // programado
  if (["programado", "agendado", "previsto", "scheduled"].includes(s)) return "programado";

  // encerrado
  if (["encerrado", "finalizado", "concluido", "concluído", "done", "finalizado com sucesso"].includes(s)) return "encerrado";

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
   Paleta: verde lousa (andamento/ativo), roxo (programado),
           cinza (encerrado), rosa/vermelho (cancelado),
           âmbar (aguardando), laranja (suspenso), zinco (rascunho)
   ========================================================= */
const STATUS_CONFIG = {
  andamento:  { label: "Em andamento",  color: "teal" },
  programado: { label: "Programado",     color: "purple" },
  encerrado:  { label: "Encerrado",      color: "slate" },
  aguardando: { label: "Aguardando",     color: "amber" },
  cancelado:  { label: "Cancelado",      color: "rose" },
  suspenso:   { label: "Suspenso",       color: "orange" },
  rascunho:   { label: "Rascunho",       color: "zinc" },
  ativo:      { label: "Ativo",          color: "emerald" },
  inativo:    { label: "Inativo",        color: "zinc" },
  desconhecido: { label: "Desconhecido", color: "gray" },
};

/* =========================================================
   Classes por variante
   ========================================================= */
function variantClasses(color, variant) {
  // cores Tailwind mapeadas
  const map = {
    teal:     { solid: "bg-teal-600 text-white border-teal-700",
                soft:  "bg-teal-100 text-teal-700 border-teal-200",
                outline:"text-teal-700 border-teal-400" },
    emerald:  { solid: "bg-emerald-600 text-white border-emerald-700",
                soft:  "bg-emerald-100 text-emerald-700 border-emerald-200",
                outline:"text-emerald-700 border-emerald-400" },
    purple:   { solid: "bg-purple-600 text-white border-purple-700",
                soft:  "bg-purple-100 text-purple-700 border-purple-200",
                outline:"text-purple-700 border-purple-400" },
    slate:    { solid: "bg-slate-600 text-white border-slate-700",
                soft:  "bg-slate-100 text-slate-700 border-slate-200",
                outline:"text-slate-700 border-slate-400" },
    rose:     { solid: "bg-rose-600 text-white border-rose-700",
                soft:  "bg-rose-100 text-rose-700 border-rose-200",
                outline:"text-rose-700 border-rose-400" },
    amber:    { solid: "bg-amber-500 text-black border-amber-600",
                soft:  "bg-amber-100 text-amber-800 border-amber-200",
                outline:"text-amber-700 border-amber-400" },
    orange:   { solid: "bg-orange-600 text-white border-orange-700",
                soft:  "bg-orange-100 text-orange-700 border-orange-200",
                outline:"text-orange-700 border-orange-400" },
    zinc:     { solid: "bg-zinc-600 text-white border-zinc-700",
                soft:  "bg-zinc-100 text-zinc-700 border-zinc-200",
                outline:"text-zinc-700 border-zinc-400" },
    gray:     { solid: "bg-gray-500 text-white border-gray-600",
                soft:  "bg-gray-100 text-gray-700 border-gray-200",
                outline:"text-gray-700 border-gray-400" },
  };

  const c = map[color] || map.gray;
  return c[variant] || c.soft;
}

/* =========================================================
   Tamanho
   ========================================================= */
function sizeClasses(size) {
  switch (size) {
    case "sm": return "text-xs px-2 py-0.5 gap-1";
    case "lg": return "text-sm px-3.5 py-1.5 gap-2";
    default:   return "text-xs px-3 py-1 gap-1.5"; // md
  }
}

/* =========================================================
   Ícones por status
   ========================================================= */
function StatusIcon({ k }) {
  switch (k) {
    case "andamento":  return <Clock size={14} />;
    case "programado": return <CalendarClock size={14} />;
    case "encerrado":  return <CheckCircle2 size={14} />;
    case "cancelado":  return <XCircle size={14} />;
    case "suspenso":   return <PauseCircle size={14} />;
    case "aguardando": return <CircleAlert size={14} />;
    case "ativo":      return <CheckCircle2 size={14} />;
    case "inativo":    return <Circle size={14} />;
    case "rascunho":   return <Circle size={14} />;
    default:           return <CircleAlert size={14} />;
  }
}

/* =========================================================
   Componente
   ========================================================= */
export default function BadgeStatus({
  status,
  variant = "soft",      // 'soft' | 'solid' | 'outline'
  size = "md",           // 'sm' | 'md' | 'lg'
  showIcon = true,
  rounded = "full",      // 'full' | 'md' | 'lg'
  className = "",
  title,                 // tooltip opcional
}) {
  const key = toKey(status);
  const { label, color } = STATUS_CONFIG[key] || STATUS_CONFIG.desconhecido;
  const base =
    "inline-flex items-center font-semibold border shadow-sm select-none";
  const radius = rounded === "full" ? "rounded-full" : rounded === "lg" ? "rounded-lg" : "rounded-md";
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
