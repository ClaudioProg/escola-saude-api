// ✅ src/components/ui/TituloSecao.jsx — v2.0
// Plataforma Escola da Saúde
//
// Título genérico oficial de seção.
//
// Revisão premium:
// - componente genérico real de UI;
// - heading semântico controlado por level/as;
// - visual premium consistente;
// - sem classes Tailwind dinâmicas inseguras;
// - sem <style> interno;
// - reduced motion via framer-motion;
// - suporte a ícone, subtítulo, kicker, actions, count e anchor;
// - suporte a sticky;
// - mobile-first;
// - dark mode;
// - pronto para todos os domínios da plataforma.

import PropTypes from "prop-types";
import { motion, useReducedMotion } from "framer-motion";
import { Link as LinkIcon } from "lucide-react";

const SIZE_CLASSES = {
  sm: {
    title: "text-lg sm:text-xl",
    subtitle: "text-sm",
    kicker: "text-[10px] sm:text-[11px]",
    icon: "h-5 w-5",
  },
  md: {
    title: "text-xl sm:text-2xl",
    subtitle: "text-sm sm:text-base",
    kicker: "text-[11px] sm:text-xs",
    icon: "h-5 w-5",
  },
  lg: {
    title: "text-2xl sm:text-3xl",
    subtitle: "text-base",
    kicker: "text-xs",
    icon: "h-6 w-6",
  },
  xl: {
    title: "text-3xl sm:text-4xl",
    subtitle: "text-base sm:text-lg",
    kicker: "text-xs",
    icon: "h-7 w-7",
  },
};

const ALIGN_CLASSES = {
  left: {
    root: "items-start text-left",
    top: "justify-between",
    main: "justify-start",
    subtitle: "text-left",
    border: "mr-auto",
  },
  center: {
    root: "items-center text-center",
    top: "justify-center",
    main: "justify-center",
    subtitle: "text-center",
    border: "mx-auto",
  },
  right: {
    root: "items-end text-right",
    top: "justify-end",
    main: "justify-end",
    subtitle: "text-right",
    border: "ml-auto",
  },
};

const ACCENT_CLASSES = {
  emerald: {
    title: "from-emerald-950 via-emerald-700 to-emerald-500",
    icon: "text-emerald-800 dark:text-emerald-300",
    line: "from-emerald-700 via-emerald-500 to-lime-400",
    badge:
      "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/60",
  },
  violet: {
    title: "from-violet-950 via-violet-700 to-fuchsia-500",
    icon: "text-violet-800 dark:text-violet-300",
    line: "from-violet-700 via-fuchsia-500 to-purple-400",
    badge:
      "bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900/60",
  },
  amber: {
    title: "from-amber-900 via-amber-700 to-yellow-500",
    icon: "text-amber-800 dark:text-amber-300",
    line: "from-amber-700 via-yellow-500 to-orange-400",
    badge:
      "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60",
  },
  rose: {
    title: "from-rose-950 via-rose-700 to-orange-500",
    icon: "text-rose-800 dark:text-rose-300",
    line: "from-rose-700 via-red-500 to-orange-400",
    badge:
      "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900/60",
  },
  teal: {
    title: "from-teal-950 via-teal-700 to-cyan-500",
    icon: "text-teal-800 dark:text-teal-300",
    line: "from-teal-700 via-cyan-500 to-emerald-400",
    badge:
      "bg-teal-50 text-teal-800 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900/60",
  },
  indigo: {
    title: "from-indigo-950 via-indigo-700 to-blue-500",
    icon: "text-indigo-800 dark:text-indigo-300",
    line: "from-indigo-700 via-blue-500 to-violet-400",
    badge:
      "bg-indigo-50 text-indigo-800 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:ring-indigo-900/60",
  },
  petroleo: {
    title: "from-slate-950 via-cyan-950 to-teal-700",
    icon: "text-cyan-900 dark:text-cyan-300",
    line: "from-slate-900 via-cyan-700 to-teal-500",
    badge:
      "bg-cyan-50 text-cyan-900 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:ring-cyan-900/60",
  },
  orange: {
    title: "from-orange-950 via-orange-700 to-amber-500",
    icon: "text-orange-800 dark:text-orange-300",
    line: "from-orange-700 via-amber-500 to-yellow-400",
    badge:
      "bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900/60",
  },
  sky: {
    title: "from-sky-950 via-sky-700 to-cyan-500",
    icon: "text-sky-800 dark:text-sky-300",
    line: "from-sky-700 via-cyan-500 to-blue-400",
    badge:
      "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900/60",
  },
  lousa: {
    title: "from-[#0f2c1f] via-[#114b2d] to-[#166534]",
    icon: "text-emerald-950 dark:text-emerald-200",
    line: "from-[#0f2c1f] via-[#114b2d] to-[#166534]",
    badge:
      "bg-emerald-50 text-emerald-950 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/60",
  },
};

const LINE_SIZE_CLASSES = {
  sm: "h-0.5 w-14 sm:w-20",
  md: "h-1 w-16 sm:w-24",
  lg: "h-1 w-20 sm:w-28",
  xl: "h-1.5 w-24 sm:w-32",
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function getHeadingTag({ as, level }) {
  if (as) return as;

  const safeLevel = Math.min(6, Math.max(1, Number(level) || 2));

  return `h${safeLevel}`;
}

function isNativeHeading(tag) {
  return /^h[1-6]$/i.test(String(tag));
}

export default function TituloSecao({
  children,
  subtitle,
  icon = null,
  size = "md",
  align = "left",
  accent = "lousa",
  id,
  className = "",
  noBorder = false,
  level = 2,
  as,
  kicker,
  actions,
  count,
  anchor = false,
  sticky = false,
  animate = true,
  compact = false,
}) {
  const reduceMotion = useReducedMotion();

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const alignClass = ALIGN_CLASSES[align] || ALIGN_CLASSES.left;
  const accentClass = ACCENT_CLASSES[accent] || ACCENT_CLASSES.lousa;

  const HeadingTag = getHeadingTag({ as, level });
  const nativeHeading = isNativeHeading(HeadingTag);
  const safeLevel = Math.min(6, Math.max(1, Number(level) || 2));

  const motionProps =
    animate && !reduceMotion
      ? {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.24, ease: "easeOut" },
        }
      : {};

  return (
    <motion.section
      {...motionProps}
      id={id}
      className={classNames(
        "flex w-full flex-col",
        compact ? "mb-4" : "mb-6",
        alignClass.root,
        sticky &&
          "sticky top-0 z-10 rounded-3xl bg-white/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md dark:bg-slate-950/80",
        className
      )}
    >
      {(kicker || actions) && (
        <div
          className={classNames(
            "mb-2 flex w-full flex-col gap-2 sm:flex-row sm:items-center",
            align === "center"
              ? "sm:justify-center"
              : align === "right"
                ? "sm:justify-end"
                : "sm:justify-between"
          )}
        >
          {kicker && (
            <div
              className={classNames(
                "font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400",
                sizeClass.kicker
              )}
            >
              {kicker}
            </div>
          )}

          {actions && (
            <div
              className={classNames(
                "flex flex-wrap gap-2",
                align === "right"
                  ? "justify-end"
                  : align === "center"
                    ? "justify-center"
                    : "justify-start sm:justify-end"
              )}
            >
              {actions}
            </div>
          )}
        </div>
      )}

      <div
        className={classNames(
          "flex min-w-0 flex-wrap items-center gap-2",
          alignClass.main
        )}
      >
        {icon && (
          <span
            className={classNames(
              "grid shrink-0 place-items-center",
              accentClass.icon,
              sizeClass.icon
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}

        <HeadingTag
          role={nativeHeading ? undefined : "heading"}
          aria-level={nativeHeading ? undefined : safeLevel}
          className={classNames(
            "min-w-0 break-words bg-gradient-to-br bg-clip-text font-black leading-tight tracking-tight text-transparent",
            accentClass.title,
            sizeClass.title,
            "dark:brightness-110"
          )}
        >
          {children}
        </HeadingTag>

        {count !== undefined && count !== null && (
          <span
            className={classNames(
              "inline-flex shrink-0 items-center justify-center rounded-full px-2.5 py-1 text-xs font-black ring-1",
              accentClass.badge
            )}
            aria-label={`Quantidade: ${count}`}
          >
            {count}
          </span>
        )}

        {anchor && id && (
          <a
            href={`#${id}`}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Abrir link desta seção"
            title="Abrir link desta seção"
          >
            <LinkIcon className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>

      {subtitle && (
        <p
          className={classNames(
            "mt-2 max-w-prose font-medium leading-relaxed text-slate-500 dark:text-slate-400",
            sizeClass.subtitle,
            alignClass.subtitle
          )}
        >
          {subtitle}
        </p>
      )}

      {!noBorder && (
        <div
          aria-hidden="true"
          className={classNames(
            "mt-3 rounded-full bg-gradient-to-r",
            accentClass.line,
            LINE_SIZE_CLASSES[size] || LINE_SIZE_CLASSES.md,
            alignClass.border
          )}
        />
      )}
    </motion.section>
  );
}

TituloSecao.propTypes = {
  children: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  icon: PropTypes.node,
  size: PropTypes.oneOf(["sm", "md", "lg", "xl"]),
  align: PropTypes.oneOf(["left", "center", "right"]),
  accent: PropTypes.oneOf([
    "emerald",
    "violet",
    "amber",
    "rose",
    "teal",
    "indigo",
    "petroleo",
    "orange",
    "sky",
    "lousa",
  ]),
  id: PropTypes.string,
  className: PropTypes.string,
  noBorder: PropTypes.bool,
  level: PropTypes.oneOf([1, 2, 3, 4, 5, 6]),
  as: PropTypes.oneOfType([PropTypes.string, PropTypes.elementType]),
  kicker: PropTypes.node,
  actions: PropTypes.node,
  count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  anchor: PropTypes.bool,
  sticky: PropTypes.bool,
  animate: PropTypes.bool,
  compact: PropTypes.bool,
};