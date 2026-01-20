// 📁 src/components/ResumoEventoCard.jsx
import PropTypes from "prop-types";
import { motion, useReducedMotion } from "framer-motion";
import {
  Users,
  CheckCircle,
  Star,
  TrendingUp,
  TrendingDown,
  Info,
} from "lucide-react";

/**
 * ResumoEventoCard (Premium / Ministat)
 * Compatível com props antigas:
 * - tipo, titulo, valor, compact
 *
 * Extras (opcionais):
 * - subtitulo?: string
 * - hint?: string (texto pequeno no rodapé)
 * - trend?: { dir: "up"|"down", value?: string }  // ex.: {dir:"up", value:"+12%"}
 * - loading?: boolean
 * - onClick?: () => void
 * - title?: string (tooltip)
 */
const ICONES = {
  inscritos: <Users className="h-6 w-6" aria-hidden="true" />,
  presencas: <CheckCircle className="h-6 w-6" aria-hidden="true" />,
  avaliacao: <Star className="h-6 w-6" aria-hidden="true" />,
};

const THEMES = {
  inscritos: {
    grad: "from-sky-50 via-sky-100 to-sky-200 dark:from-sky-950 dark:via-sky-900/60 dark:to-sky-900/30",
    text: "text-sky-950 dark:text-sky-50",
    iconBg: "bg-white/70 dark:bg-white/10",
    iconText: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-500/15 dark:ring-sky-300/10",
    glow: "shadow-[0_18px_55px_-40px_rgba(2,132,199,0.55)]",
  },
  presencas: {
    grad: "from-emerald-50 via-emerald-100 to-emerald-200 dark:from-emerald-950 dark:via-emerald-900/60 dark:to-emerald-900/30",
    text: "text-emerald-950 dark:text-emerald-50",
    iconBg: "bg-white/70 dark:bg-white/10",
    iconText: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-500/15 dark:ring-emerald-300/10",
    glow: "shadow-[0_18px_55px_-40px_rgba(16,185,129,0.55)]",
  },
  avaliacao: {
    grad: "from-amber-50 via-amber-100 to-amber-200 dark:from-amber-950 dark:via-amber-900/60 dark:to-amber-900/30",
    text: "text-amber-950 dark:text-amber-50",
    iconBg: "bg-white/70 dark:bg-white/10",
    iconText: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-500/15 dark:ring-amber-300/10",
    glow: "shadow-[0_18px_55px_-40px_rgba(245,158,11,0.55)]",
  },
  default: {
    grad: "from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900/60 dark:to-zinc-900/30",
    text: "text-zinc-950 dark:text-zinc-50",
    iconBg: "bg-white/70 dark:bg-white/10",
    iconText: "text-zinc-700 dark:text-zinc-300",
    ring: "ring-black/10 dark:ring-white/10",
    glow: "shadow-[0_18px_55px_-40px_rgba(0,0,0,0.45)]",
  },
};

export default function ResumoEventoCard({
  tipo = "inscritos",
  titulo,
  valor,
  compact = false,

  // extras premium
  subtitulo,
  hint,
  trend, // {dir:"up"|"down", value?:string}
  loading = false,
  onClick,
  title,
}) {
  const reduceMotion = useReducedMotion();

  const theme = THEMES[tipo] || THEMES.default;
  const Icon = ICONES[tipo] || ICONES.default || <Users className="h-6 w-6" aria-hidden="true" />;

  const clickable = typeof onClick === "function";

  const TrendIcon = trend?.dir === "down" ? TrendingDown : TrendingUp;
  const trendColor =
    trend?.dir === "down"
      ? "text-rose-700 dark:text-rose-300 bg-rose-500/10"
      : "text-emerald-800 dark:text-emerald-200 bg-emerald-500/10";

  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { scale: clickable ? 1.015 : 1.01, y: -2 }}
      whileTap={reduceMotion ? undefined : (clickable ? { scale: 0.99 } : undefined)}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      tabIndex={clickable ? 0 : -1}
      role={clickable ? "button" : "status"}
      aria-label={`${titulo}: ${loading ? "carregando" : String(valor)}`}
      title={title}
      className={[
        "relative overflow-hidden rounded-3xl",
        "p-4",
        "bg-gradient-to-br",
        theme.grad,
        theme.text,
        theme.glow,
        "ring-1",
        theme.ring,
        "select-none",
        clickable
          ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950"
          : "",
      ].join(" ")}
    >
      {/* highlight overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(255,255,255,0.55),transparent_40%)] dark:bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(255,255,255,0.10),transparent_45%)]" />

      <div className="relative flex items-center gap-4">
        {/* Icon bubble */}
        <div
          className={[
            "shrink-0 rounded-2xl ring-1 ring-black/5 dark:ring-white/10",
            theme.iconBg,
            compact ? "p-2" : "p-3",
          ].join(" ")}
        >
          <div className={theme.iconText}>{Icon}</div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-extrabold tracking-tight opacity-90 truncate">
                {titulo}
              </p>
              {subtitulo && (
                <p className="text-xs opacity-80 mt-0.5 truncate">{subtitulo}</p>
              )}
            </div>

            {trend?.dir && (
              <span
                className={[
                  "inline-flex items-center gap-1 rounded-full px-2 py-1",
                  "text-[11px] font-extrabold",
                  trendColor,
                  "ring-1 ring-black/5 dark:ring-white/10",
                ].join(" ")}
                aria-label={`Tendência ${trend.dir === "down" ? "queda" : "alta"} ${trend.value || ""}`}
              >
                <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {trend.value || (trend.dir === "down" ? "↓" : "↑")}
              </span>
            )}
          </div>

          {/* Value */}
          <div className="mt-2">
            {loading ? (
              <div className="space-y-2">
                <div className="h-7 w-28 rounded-xl bg-black/10 dark:bg-white/10 animate-pulse" />
                <div className="h-3 w-40 rounded-lg bg-black/5 dark:bg-white/5 animate-pulse" />
              </div>
            ) : (
              <>
                <div
                  className={[
                    "font-extrabold tracking-tight leading-none",
                    compact ? "text-xl" : "text-3xl",
                  ].join(" ")}
                >
                  {valor}
                </div>

                {hint && (
                  <div className="mt-2 inline-flex items-center gap-1 text-[11px] opacity-85">
                    <Info className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="truncate">{hint}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

ResumoEventoCard.propTypes = {
  tipo: PropTypes.oneOf(["inscritos", "presencas", "avaliacao"]),
  titulo: PropTypes.string.isRequired,
  valor: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  compact: PropTypes.bool,

  subtitulo: PropTypes.string,
  hint: PropTypes.string,
  trend: PropTypes.shape({
    dir: PropTypes.oneOf(["up", "down"]),
    value: PropTypes.string,
  }),
  loading: PropTypes.bool,
  onClick: PropTypes.func,
  title: PropTypes.string,
};
