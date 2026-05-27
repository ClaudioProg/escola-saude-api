// ✅ src/components/ui/MiniStat.jsx — v2.0
// Plataforma Escola da Saúde
//
// Mini card genérico oficial de métrica.
//
// Revisão premium:
// - componente genérico real de UI;
// - visual de alto nível para painéis e dashboards;
// - dark mode via classes, sem prop legada isDark;
// - suporte a ícone, badge, tendência, loading e ação;
// - acessibilidade com aria-label claro;
// - reduced motion;
// - mobile-first;
// - contrato limpo e previsível;
// - pronto para eventos, certificados, presenças, relatórios, reservas e usuários.

import { cloneElement, createElement, isValidElement } from "react";
import PropTypes from "prop-types";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Info,
} from "lucide-react";

const TONE_CLASSES = {
  default: {
    card:
      "border-slate-200 bg-white/85 text-slate-950 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100",
    icon:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200",
    badge:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200",
  },
  emerald: {
    card:
      "border-emerald-200 bg-emerald-50/80 text-emerald-950 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
    icon:
      "border-emerald-200 bg-white/75 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-200",
    badge:
      "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-200",
  },
  amber: {
    card:
      "border-amber-200 bg-amber-50/80 text-amber-950 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100",
    icon:
      "border-amber-200 bg-white/75 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950 dark:text-amber-200",
    badge:
      "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950 dark:text-amber-200",
  },
  rose: {
    card:
      "border-rose-200 bg-rose-50/80 text-rose-950 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100",
    icon:
      "border-rose-200 bg-white/75 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950 dark:text-rose-200",
    badge:
      "border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950 dark:text-rose-200",
  },
  sky: {
    card:
      "border-sky-200 bg-sky-50/80 text-sky-950 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100",
    icon:
      "border-sky-200 bg-white/75 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950 dark:text-sky-200",
    badge:
      "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950 dark:text-sky-200",
  },
  lousa: {
    card:
      "border-emerald-900/15 bg-gradient-to-br from-white via-emerald-50/80 to-emerald-100/70 text-emerald-950 shadow-sm dark:border-emerald-800/40 dark:from-slate-950 dark:via-emerald-950/35 dark:to-slate-900 dark:text-emerald-100",
    icon:
      "border-emerald-200 bg-white/80 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-200",
    badge:
      "border-emerald-200 bg-emerald-100 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-200",
  },
};

const TREND_CLASSES = {
  up: {
    label: "Alta",
    icon: ArrowUpRight,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
  },
  down: {
    label: "Queda",
    icon: ArrowDownRight,
    className:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200",
  },
  flat: {
    label: "Estável",
    icon: ArrowRight,
    className:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200",
  },
};

const SIZE_CLASSES = {
  sm: {
    card: "rounded-2xl px-3 py-3",
    title: "text-[10px]",
    value: "text-base",
    hint: "text-[11px]",
    iconBox: "h-9 w-9 rounded-xl",
    icon: "h-4 w-4",
  },
  md: {
    card: "rounded-3xl px-4 py-3.5",
    title: "text-[11px]",
    value: "text-xl",
    hint: "text-xs",
    iconBox: "h-10 w-10 rounded-2xl",
    icon: "h-5 w-5",
  },
  lg: {
    card: "rounded-3xl px-5 py-4",
    title: "text-xs",
    value: "text-2xl",
    hint: "text-sm",
    iconBox: "h-12 w-12 rounded-2xl",
    icon: "h-5 w-5",
  },
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function renderIcon(icon, className) {
  if (!icon) return null;

  if (isValidElement(icon)) {
    return cloneElement(icon, {
      className: classNames(className, icon.props?.className),
      "aria-hidden": icon.props?.["aria-hidden"] ?? true,
      focusable: icon.props?.focusable ?? "false",
    });
  }

  if (typeof icon === "function") {
    return createElement(icon, {
      className,
      "aria-hidden": true,
      focusable: "false",
    });
  }

  return null;
}

function formatAriaLabel({ title, value, hint }) {
  const parts = [title, value, hint]
    .filter((part) => typeof part === "string" || typeof part === "number")
    .map(String);

  return parts.length ? parts.join(": ") : undefined;
}

export default function MiniStat({
  title,
  value,
  hint,
  icon,
  badge,
  trend,
  trendLabel,
  loading = false,
  className = "",
  tone = "default",
  size = "md",
  onClick,
  titleAttr,
  "aria-label": ariaLabel,
}) {
  const reduceMotion = useReducedMotion();

  const theme = TONE_CLASSES[tone] || TONE_CLASSES.default;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  const clickable = typeof onClick === "function";
  const trendConfig = trend ? TREND_CLASSES[trend] : null;
  const TrendIcon = trendConfig?.icon || Info;

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.18, ease: "easeOut" },
        whileHover: clickable ? { y: -2 } : undefined,
        whileTap: clickable ? { scale: 0.99 } : undefined,
      };

  const Component = clickable ? motion.button : motion.article;

  return (
    <Component
      {...motionProps}
      type={clickable ? "button" : undefined}
      onClick={clickable ? onClick : undefined}
      title={titleAttr}
      className={classNames(
        "group relative overflow-hidden border text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
        clickable && "cursor-pointer hover:shadow-lg",
        !clickable && "hover:shadow-md",
        "supports-[backdrop-filter]:backdrop-blur",
        theme.card,
        sizeClass.card,
        className
      )}
      role={clickable ? undefined : "group"}
      aria-label={
        ariaLabel ||
        formatAriaLabel({
          title,
          value,
          hint,
        })
      }
      aria-busy={loading || undefined}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_circle_at_10%_0%,rgba(255,255,255,0.50),transparent_38%)] opacity-70 dark:bg-[radial-gradient(700px_circle_at_10%_0%,rgba(255,255,255,0.08),transparent_42%)]" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className={classNames(
              "font-black uppercase tracking-wide opacity-70",
              sizeClass.title
            )}
          >
            {title}
          </div>

          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
            {loading ? (
              <span
                className="h-6 w-28 animate-pulse rounded-xl bg-black/10 dark:bg-white/10"
                aria-hidden="true"
              />
            ) : (
              <div
                className={classNames(
                  "min-w-0 truncate font-black leading-tight tracking-tight",
                  sizeClass.value
                )}
              >
                {value}
              </div>
            )}

            {badge && !loading && (
              <span
                className={classNames(
                  "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-black",
                  theme.badge
                )}
              >
                {badge}
              </span>
            )}
          </div>

          {hint && !loading && (
            <div
              className={classNames(
                "mt-1 font-medium leading-snug opacity-75",
                sizeClass.hint
              )}
            >
              {hint}
            </div>
          )}
        </div>

        {(trendConfig || icon) && (
          <div className="flex shrink-0 items-center gap-2">
            {trendConfig && !loading && (
              <span
                className={classNames(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black",
                  trendConfig.className
                )}
                aria-label={`Tendência: ${trendLabel || trendConfig.label}`}
                title={`Tendência: ${trendLabel || trendConfig.label}`}
              >
                <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {trendLabel || trendConfig.label}
              </span>
            )}

            {icon && (
              <span
                className={classNames(
                  "grid shrink-0 place-items-center border transition-transform group-hover:scale-[1.03]",
                  theme.icon,
                  sizeClass.iconBox
                )}
                aria-hidden="true"
              >
                {renderIcon(icon, sizeClass.icon)}
              </span>
            )}
          </div>
        )}
      </div>
    </Component>
  );
}

MiniStat.propTypes = {
  title: PropTypes.node.isRequired,
  value: PropTypes.node,
  hint: PropTypes.node,
  icon: PropTypes.oneOfType([PropTypes.elementType, PropTypes.element]),
  badge: PropTypes.node,
  trend: PropTypes.oneOf(["up", "down", "flat"]),
  trendLabel: PropTypes.string,
  loading: PropTypes.bool,
  className: PropTypes.string,
  tone: PropTypes.oneOf(["default", "emerald", "amber", "rose", "sky", "lousa"]),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  onClick: PropTypes.func,
  titleAttr: PropTypes.string,
  "aria-label": PropTypes.string,
};