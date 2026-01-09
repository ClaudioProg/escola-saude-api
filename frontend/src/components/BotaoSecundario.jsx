// 📁 src/components/BotaoSecundario.jsx
import PropTypes from "prop-types";
import { forwardRef } from "react";

/**
 * Botão secundário (neutral/outline/ghost) — premium + a11y.
 * - Focus ring acompanha a cor.
 * - Suporta <button> (padrão) ou <a>.
 * - A11y: aria-busy (loading), aria-disabled (links) e aria-live.
 * - UX: evita clique enquanto loading/disabled; spinner respeita prefers-reduced-motion.
 * - Cores: verde (padrão), amareloOuro, laranjaQueimado, vermelhoCoral, azulPetroleo.
 */
const BotaoSecundario = forwardRef(function BotaoSecundario(
  {
    children,
    onClick,
    type = "button",
    as = "button", // 'button' | 'a'
    href,
    target,
    rel,
    download, // opcional quando as='a'
    className = "",
    disabled = false,
    loading = false,
    leftIcon = null,
    rightIcon = null,
    size = "md", // sm | md | lg
    fullWidth = false,
    variant = "neutral", // neutral | outline | ghost
    cor = "verde", // verde | amareloOuro | laranjaQueimado | vermelhoCoral | azulPetroleo
    "aria-label": ariaLabel,
    tabIndex = 0,
    style = {},
    title,
    ...props
  },
  ref
) {
  const isBtn = as !== "a";
  const isDisabled = disabled || loading;

  const sizeClasses =
    size === "sm"
      ? "px-3 py-1.5 text-sm min-h-[36px]"
      : size === "lg"
      ? "px-5 py-3 text-base min-h-[46px]"
      : "px-4 py-2 text-base min-h-[40px]";

  // Paletas por cor para outline/ghost/neutral
  const tones = {
    verde: {
      text: "text-emerald-800 dark:text-emerald-200",
      border: "border-emerald-300 dark:border-emerald-700",
      hoverBg: "hover:bg-emerald-50 dark:hover:bg-emerald-900/20",
      neutralBg: "bg-emerald-100 dark:bg-emerald-900/25",
      neutralHover: "hover:bg-emerald-200 dark:hover:bg-emerald-900/35",
      ring: "focus-visible:ring-emerald-500/60",
    },
    amareloOuro: {
      text: "text-amber-800 dark:text-amber-200",
      border: "border-amber-300 dark:border-amber-700",
      hoverBg: "hover:bg-amber-50 dark:hover:bg-amber-900/20",
      neutralBg: "bg-amber-100 dark:bg-amber-900/25",
      neutralHover: "hover:bg-amber-200 dark:hover:bg-amber-900/35",
      ring: "focus-visible:ring-amber-400/60",
    },
    laranjaQueimado: {
      text: "text-orange-700 dark:text-orange-300",
      border: "border-orange-300 dark:border-orange-700",
      hoverBg: "hover:bg-orange-50 dark:hover:bg-orange-900/20",
      neutralBg: "bg-orange-100 dark:bg-orange-900/25",
      neutralHover: "hover:bg-orange-200 dark:hover:bg-orange-900/35",
      ring: "focus-visible:ring-orange-400/60",
    },
    vermelhoCoral: {
      text: "text-red-700 dark:text-red-300",
      border: "border-red-300 dark:border-red-700",
      hoverBg: "hover:bg-red-50 dark:hover:bg-red-900/20",
      neutralBg: "bg-red-100 dark:bg-red-900/25",
      neutralHover: "hover:bg-red-200 dark:hover:bg-red-900/35",
      ring: "focus-visible:ring-red-400/60",
    },
    azulPetroleo: {
      text: "text-cyan-800 dark:text-cyan-200",
      border: "border-cyan-300 dark:border-cyan-700",
      hoverBg: "hover:bg-cyan-50 dark:hover:bg-cyan-900/20",
      neutralBg: "bg-cyan-100 dark:bg-cyan-900/25",
      neutralHover: "hover:bg-cyan-200 dark:hover:bg-cyan-900/35",
      ring: "focus-visible:ring-cyan-500/60",
    },
  };
  const tone = tones[cor] || tones.verde;

  const variants = {
    neutral: [
      tone.neutralBg,
      tone.text,
      "border border-transparent",
      tone.neutralHover,
    ].join(" "),
    outline: ["bg-transparent border", tone.border, tone.text, tone.hoverBg].join(" "),
    ghost: ["bg-transparent", tone.text, tone.hoverBg, "border border-transparent"].join(" "),
  };

  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl font-medium shadow-sm " +
    "transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
    `${tone.ring} focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-800 ` +
    "disabled:opacity-60 disabled:cursor-not-allowed select-none";

  const classes = [
    base,
    variants[variant] ?? variants.neutral,
    sizeClasses,
    fullWidth ? "w-full" : "w-auto",
    isDisabled ? "pointer-events-none" : "",
    className,
  ].join(" ");

  const spinner = (
    <span
      className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full motion-safe:animate-spin motion-reduce:animate-none"
      aria-hidden="true"
    />
  );

  if (!isBtn) {
    // Renderiza como <a>
    return (
      <a
        ref={ref}
        href={isDisabled ? undefined : href}
        target={target}
        rel={rel ?? (target === "_blank" ? "noopener noreferrer" : undefined)}
        download={download}
        aria-label={ariaLabel}
        aria-disabled={isDisabled || undefined}
        aria-busy={loading || undefined}
        aria-live={loading ? "polite" : undefined}
        tabIndex={tabIndex}
        style={style}
        className={classes}
        role="button"
        title={title}
        data-variant="BotaoSecundario"
        data-color={cor}
        data-tone={variant}
        onClick={(e) => {
          if (isDisabled) e.preventDefault();
          else onClick?.(e);
        }}
        {...props}
      >
        {loading ? spinner : leftIcon ? <span className="shrink-0" aria-hidden="true">{leftIcon}</span> : null}
        <span className={loading ? "opacity-90" : ""}>{children}</span>
        {rightIcon ? <span className="shrink-0" aria-hidden="true">{rightIcon}</span> : null}
      </a>
    );
  }

  // Renderiza como <button>
  return (
    <button
      ref={ref}
      type={type}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-live={loading ? "polite" : undefined}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      style={style}
      className={classes}
      title={title}
      data-variant="BotaoSecundario"
      data-color={cor}
      data-tone={variant}
      {...props}
    >
      {loading ? spinner : leftIcon ? <span className="shrink-0" aria-hidden="true">{leftIcon}</span> : null}
      <span className={loading ? "opacity-90" : ""}>{children}</span>
      {rightIcon ? <span className="shrink-0" aria-hidden="true">{rightIcon}</span> : null}
    </button>
  );
});

BotaoSecundario.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(["button", "submit", "reset"]),
  as: PropTypes.oneOf(["button", "a"]),
  href: PropTypes.string,
  target: PropTypes.string,
  rel: PropTypes.string,
  download: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  className: PropTypes.string,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  leftIcon: PropTypes.node,
  rightIcon: PropTypes.node,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  fullWidth: PropTypes.bool,
  variant: PropTypes.oneOf(["neutral", "outline", "ghost"]),
  cor: PropTypes.oneOf(["verde", "amareloOuro", "laranjaQueimado", "vermelhoCoral", "azulPetroleo"]),
  "aria-label": PropTypes.string,
  tabIndex: PropTypes.number,
  style: PropTypes.object,
  title: PropTypes.string,
};

export default BotaoSecundario;
