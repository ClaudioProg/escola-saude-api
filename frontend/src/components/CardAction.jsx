// ✅ src/components/CardAction.jsx
import { forwardRef, useMemo } from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

/**
 * Card de ação compacto.
 * - Mantém compatibilidade com: { icon, title, description, to, onClick, isDark, accent }
 * - Novos: disabled, loading, size, rightSection, badge, ariaLabel, target, rel, as, href
 * - A11y: aria-busy/disabled, foco visível por accent, role coerente
 * - UX: hover/tap sutil, seta animada, cursor bloqueado se disabled/loading
 */
const ACCENTS = {
  emerald: {
    ring: "focus:ring-emerald-500/70",
    hoverBorder: "hover:border-emerald-500",
    hoverText: "group-hover:text-emerald-700 dark:group-hover:text-emerald-300",
  },
  violet: {
    ring: "focus:ring-violet-500/70",
    hoverBorder: "hover:border-violet-500",
    hoverText: "group-hover:text-violet-600 dark:group-hover:text-violet-300",
  },
  sky: {
    ring: "focus:ring-sky-500/70",
    hoverBorder: "hover:border-sky-500",
    hoverText: "group-hover:text-sky-700 dark:group-hover:text-sky-300",
  },
  amber: {
    ring: "focus:ring-amber-500/70",
    hoverBorder: "hover:border-amber-500",
    hoverText: "group-hover:text-amber-700 dark:group-hover:text-amber-300",
  },
  rose: {
    ring: "focus:ring-rose-500/70",
    hoverBorder: "hover:border-rose-500",
    hoverText: "group-hover:text-rose-700 dark:group-hover:text-rose-300",
  },
  indigo: {
    ring: "focus:ring-indigo-500/70",
    hoverBorder: "hover:border-indigo-500",
    hoverText: "group-hover:text-indigo-700 dark:group-hover:text-indigo-300",
  },
  petroleo: {
    ring: "focus:ring-cyan-600/70",
    hoverBorder: "hover:border-cyan-600",
    hoverText: "group-hover:text-cyan-700 dark:group-hover:text-cyan-300",
  },
};

const SIZES = {
  sm: {
    paddings: "p-4",
    title: "text-sm",
    desc: "text-[12px]",
    arrow: "h-4 w-4",
    iconWrap: "p-2",
    iconSize: "h-5 w-5",
  },
  md: {
    paddings: "p-5",
    title: "text-sm",
    desc: "text-xs",
    arrow: "h-4 w-4",
    iconWrap: "p-3",
    iconSize: "h-6 w-6",
  },
  lg: {
    paddings: "p-6",
    title: "text-base",
    desc: "text-sm",
    arrow: "h-5 w-5",
    iconWrap: "p-3.5",
    iconSize: "h-7 w-7",
  },
};

const CardAction = forwardRef(function CardAction(
  {
    icon: Icon,
    title,
    description,
    to,            // mantém compatibilidade: se presente vira <a>
    onClick,
    isDark,
    accent = "emerald",
    disabled = false,
    loading = false,
    size = "md",   // sm | md | lg
    rightSection = null,
    badge = null,  // string | ReactNode (ex.: "Novo")
    ariaLabel,
    className = "",
    as,            // 'button' | 'a' (opcional — se não passar, decide por to/href)
    href,          // alternativa a 'to'
    target,
    rel,
    titleAttr,     // tooltip (evita conflito com prop 'title' de texto)
    ...rest
  },
  ref
) {
  const accentCfg = ACCENTS[accent] || ACCENTS.emerald;
  const sizeCfg = SIZES[size] || SIZES.md;

  const Comp = useMemo(() => {
    if (as) return as;
    if (to || href) return "a";
    return "button";
  }, [as, to, href]);

  const linkProps = (to || href)
    ? {
        href: to || href,
        target,
        rel: rel ?? (target === "_blank" ? "noopener noreferrer" : undefined),
        role: "link",
        "aria-disabled": disabled || loading || undefined,
        onClick: (e) => {
          if (disabled || loading) e.preventDefault();
          else onClick?.(e);
        },
      }
    : {
        type: "button",
        onClick: disabled || loading ? undefined : onClick,
        disabled: disabled || loading,
        role: "button",
      };

  const baseContainer =
    "group w-full text-left rounded-3xl border transition-all outline-none " +
    "focus:outline-none focus:ring-2 " + accentCfg.ring +
    (disabled || loading ? " opacity-60 cursor-not-allowed" : " cursor-pointer");

  const bg = isDark
    ? "bg-zinc-900/60 border-white/10 hover:bg-white/5"
    : "bg-white border-slate-200 hover:bg-slate-50";
  const hoverBorder = accentCfg.hoverBorder;

  const iconWrap =
    isDark ? "border-white/10 bg-zinc-950/30" : "border-slate-200 bg-slate-50";
  const titleColor = isDark ? "text-zinc-100" : "text-slate-900";
  const descColor = isDark ? "text-zinc-400" : "text-slate-600";
  const arrowColor = isDark ? "text-zinc-300" : "text-slate-700";
  const hoverText = accentCfg.hoverText;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={!disabled && !loading ? { scale: 1.015 } : undefined}
      whileTap={!disabled && !loading ? { scale: 0.99 } : undefined}
      transition={{ duration: 0.18 }}
    >
      <Comp
        ref={ref}
        {...linkProps}
        aria-busy={loading || undefined}
        aria-label={ariaLabel || (typeof title === "string" ? title : undefined)}
        title={titleAttr}
        className={[
          baseContainer,
          bg,
          hoverBorder,
          sizeCfg.paddings,
          "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900",
          className,
        ].join(" ")}
        {...rest}
      >
        <div className="flex items-start gap-4">
          {Icon ? (
            <div className={["rounded-2xl border", iconWrap, sizeCfg.iconWrap].join(" ")}>
              <Icon className={[sizeCfg.iconSize, "transition", isDark ? "text-zinc-200" : "text-slate-700", hoverText].join(" ")} />
            </div>
          ) : (
            <div className={["rounded-2xl border", iconWrap, sizeCfg.iconWrap, "opacity-60"].join(" ")} />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className={[sizeCfg.title, "font-extrabold truncate", titleColor].join(" ")}>
                {title}
              </div>
              {badge ? (
                <span className="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold bg-black/5 dark:bg-white/10 text-black/70 dark:text-white/80">
                  {badge}
                </span>
              ) : null}
            </div>

            {description ? (
              <div className={["mt-1 leading-relaxed break-words", sizeCfg.desc, descColor].join(" ")}>
                {description}
              </div>
            ) : null}

            <div className="mt-3 flex items-center justify-between">
              <div className={["inline-flex items-center gap-2 font-extrabold transition", sizeCfg.desc, arrowColor, hoverText].join(" ")}>
                {loading ? (
                  <span className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                ) : (
                  <>
                    <span>Acessar</span>
                    <ArrowRight className={[sizeCfg.arrow, "transition-transform group-hover:translate-x-0.5"].join(" ")} />
                  </>
                )}
              </div>

              {rightSection ? (
                <div className="ml-3 shrink-0">
                  {rightSection}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Comp>
    </motion.div>
  );
});

export default CardAction;

CardAction.propTypes = {
  icon: PropTypes.elementType,
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
  to: PropTypes.string,
  onClick: PropTypes.func,
  isDark: PropTypes.bool,
  accent: PropTypes.oneOf([
    "emerald", "violet", "sky", "amber", "rose", "indigo", "petroleo"
  ]),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  rightSection: PropTypes.node,
  badge: PropTypes.node,
  ariaLabel: PropTypes.string,
  className: PropTypes.string,
  as: PropTypes.oneOfType([PropTypes.string, PropTypes.elementType]),
  href: PropTypes.string,
  target: PropTypes.string,
  rel: PropTypes.string,
  titleAttr: PropTypes.string,
};
