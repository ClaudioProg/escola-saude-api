// ✅ src/components/MiniStat.jsx
import { motion } from "framer-motion";
import PropTypes from "prop-types";
import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function renderIcon(node, className) {
  if (!node) return null;
  if (React.isValidElement(node)) {
    return React.cloneElement(node, {
      className: node.props?.className || className,
      "aria-hidden": true,
    });
  }
  if (typeof node === "function") {
    return React.createElement(node, { className, "aria-hidden": true });
  }
  return null;
}

/**
 * MiniStat (premium)
 * - Dark mode automático (dark:)
 * - Opcional: icon, badge, trend (up/down/flat), loading (skeleton)
 * - Compat: aceita isDark (mas não precisa mais)
 */
export default function MiniStat({
  title,
  value,
  hint,
  isDark = false, // compat
  icon,
  badge,
  trend, // "up" | "down" | "flat"
  loading = false,
  className = "",
  "aria-label": ariaLabel,
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={cls(
        "group rounded-3xl border px-4 py-3 transition-all",
        "bg-white/80 border-slate-200 shadow-sm",
        "hover:shadow-md hover:-translate-y-[1px]",
        "dark:bg-zinc-950/35 dark:border-white/10 dark:shadow-none",
        "backdrop-blur",
        isDark && "border-white/10 bg-zinc-950/35", // compat legado
        className
      )}
      role="group"
      aria-label={ariaLabel || (typeof title === "string" ? title : undefined)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cls("text-[11px] font-extrabold tracking-wide uppercase",
            isDark ? "text-zinc-300" : "text-slate-500",
            "dark:text-zinc-300"
          )}>
            {title}
          </div>

          <div className="mt-1 flex items-center gap-2">
            {loading ? (
              <div className="h-5 w-28 rounded-lg bg-slate-200 animate-pulse dark:bg-zinc-800" />
            ) : (
              <div
                className={cls(
                  "text-sm font-extrabold leading-tight",
                  "text-slate-900 dark:text-zinc-100",
                  isDark && "text-zinc-100"
                )}
              >
                {value}
              </div>
            )}

            {badge ? (
              <span
                className={cls(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                  "bg-slate-100 text-slate-700 border border-slate-200",
                  "dark:bg-zinc-900/40 dark:text-zinc-200 dark:border-zinc-800"
                )}
              >
                {badge}
              </span>
            ) : null}
          </div>

          {hint ? (
            <div
              className={cls(
                "mt-1 text-[11px]",
                "text-slate-500 dark:text-zinc-400",
                isDark && "text-zinc-400"
              )}
            >
              {hint}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {trend ? (
            <span
              className={cls(
                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-extrabold",
                "border border-slate-200 bg-white",
                "dark:bg-zinc-950/20 dark:border-zinc-800",
                trend === "up" && "text-emerald-700 dark:text-emerald-300",
                trend === "down" && "text-rose-700 dark:text-rose-300",
                trend === "flat" && "text-slate-600 dark:text-zinc-300"
              )}
              aria-label={`Tendência: ${trend}`}
              title={`Tendência: ${trend}`}
            >
              <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {trend === "up" ? "Alta" : trend === "down" ? "Queda" : "Estável"}
            </span>
          ) : null}

          {icon ? (
            <span
              className={cls(
                "grid place-items-center h-10 w-10 rounded-2xl border",
                "bg-slate-50 border-slate-200 text-slate-700",
                "dark:bg-zinc-900/40 dark:border-zinc-800 dark:text-zinc-200",
                "group-hover:scale-[1.02] transition-transform"
              )}
              aria-hidden="true"
            >
              {renderIcon(icon, "h-5 w-5")}
            </span>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

MiniStat.propTypes = {
  title: PropTypes.node,
  value: PropTypes.node,
  hint: PropTypes.node,

  // compat (não necessário; dark mode via CSS)
  isDark: PropTypes.bool,

  // premium extras
  icon: PropTypes.oneOfType([PropTypes.elementType, PropTypes.element]),
  badge: PropTypes.node,
  trend: PropTypes.oneOf(["up", "down", "flat"]),
  loading: PropTypes.bool,
  className: PropTypes.string,
  "aria-label": PropTypes.string,
};
