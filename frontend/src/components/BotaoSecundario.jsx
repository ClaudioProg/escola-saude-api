// 📁 src/components/BotaoSecundario.jsx
import PropTypes from "prop-types";
import { forwardRef } from "react";

/**
 * Botão secundário (neutro/outline/ghost).
 * - Focus ring institucional (green-900).
 * - Suporta <button> (padrão) ou <a>.
 * - A11y: aria-busy no loading, aria-disabled para <a>.
 * - UX: evita clique enquanto loading/disabled.
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
    ...props
  },
  ref
) {
  const isBtn = as !== "a";
  const isDisabled = disabled || loading;

  const sizeClasses =
    size === "sm"
      ? "px-3 py-1.5 text-sm"
      : size === "lg"
      ? "px-5 py-3 text-base"
      : "px-4 py-2 text-base";

  // Paletas para outline/ghost (neutral usa cinza)
  const tones = {
    verde: {
      text: "text-green-800 dark:text-green-300",
      border: "border-green-300 dark:border-green-700",
      hoverBg: "hover:bg-green-50 dark:hover:bg-green-900/20",
    },
    amareloOuro: {
      text: "text-amber-800 dark:text-amber-200",
      border: "border-amber-300 dark:border-amber-600",
      hoverBg: "hover:bg-amber-50 dark:hover:bg-amber-900/20",
    },
    laranjaQueimado: {
      text: "text-orange-700 dark:text-orange-300",
      border: "border-orange-300 dark:border-orange-700",
      hoverBg: "hover:bg-orange-50 dark:hover:bg-orange-900/20",
    },
    vermelhoCoral: {
      text: "text-red-700 dark:text-red-300",
      border: "border-red-300 dark:border-red-700",
      hoverBg: "hover:bg-red-50 dark:hover:bg-red-900/20",
    },
    azulPetroleo: {
      text: "text-cyan-800 dark:text-cyan-200",
      border: "border-cyan-300 dark:border-cyan-700",
      hoverBg: "hover:bg-cyan-50 dark:hover:bg-cyan-900/20",
    },
  };
  const tone = tones[cor] || tones.verde;

  const variants = {
    neutral:
      "bg-gray-200 text-green-900 hover:bg-gray-300 " +
      "dark:bg-zinc-800 dark:text-gray-100 dark:hover:bg-zinc-700",
    outline:
      [
        "bg-transparent border",
        tone.border,
        tone.text,
        tone.hoverBg,
      ].join(" "),
    ghost:
      [
        "bg-transparent",
        tone.text,
        tone.hoverBg,
      ].join(" "),
  };

  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl font-medium shadow " +
    "transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
    "focus-visible:ring-green-900/60 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-800 " +
    "disabled:opacity-60 disabled:cursor-not-allowed";

  const classes = [
    base,
    variants[variant] ?? variants.neutral,
    sizeClasses,
    fullWidth ? "w-full" : "w-auto",
    className,
  ].join(" ");

  const spinner = (
    <span
      className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"
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
        rel={rel}
        aria-label={ariaLabel}
        aria-disabled={isDisabled || undefined}
        aria-busy={loading || undefined}
        tabIndex={tabIndex}
        style={style}
        className={classes}
        role="button"
        onClick={(e) => {
          if (isDisabled) e.preventDefault();
          else onClick?.(e);
        }}
        {...props}
      >
        {loading ? spinner : leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
        <span className={loading ? "opacity-90" : ""}>{children}</span>
        {rightIcon ? <span className="shrink-0">{rightIcon}</span> : null}
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
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      style={style}
      className={classes}
      {...props}
    >
      {loading ? spinner : leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
      <span className={loading ? "opacity-90" : ""}>{children}</span>
      {rightIcon ? <span className="shrink-0">{rightIcon}</span> : null}
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
};

export default BotaoSecundario;
