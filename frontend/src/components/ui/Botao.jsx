// ✅ src/components/ui/Botao.jsx — v2.1
// Atualizado em: 21/05/2026
// Plataforma Escola da Saúde

import PropTypes from "prop-types";
import { forwardRef, useCallback } from "react";

import { getCampanhaSaudeVisual } from "../../utils/campanhaSaudeVisual";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

const VARIANTES_FIXAS = {
  perigo:
    "border-transparent bg-gradient-to-br from-rose-600 via-rose-700 to-red-800 text-white hover:brightness-110 focus-visible:ring-rose-500",
  sucesso:
    "border-transparent bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white hover:brightness-110 focus-visible:ring-emerald-500",
  neutro:
    "border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-800 hover:brightness-95 focus-visible:ring-slate-400 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 dark:text-slate-100 dark:hover:brightness-110",
  contorno:
    "border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900",
  fantasma:
    "border-transparent bg-transparent text-slate-800 shadow-none hover:bg-slate-100 focus-visible:ring-slate-400 dark:text-slate-100 dark:hover:bg-white/10",
  link:
    "border-transparent bg-transparent px-0 text-slate-800 underline underline-offset-4 shadow-none hover:opacity-80 focus-visible:ring-slate-400 dark:text-white",
};

const SIZE_CLASSES = {
  xs: "min-h-[34px] px-2.5 py-1.5 text-xs",
  sm: "min-h-[40px] px-3 py-2 text-sm",
  md: "min-h-[44px] px-4 py-2.5 text-sm sm:text-base",
  lg: "min-h-[48px] px-5 py-3 text-base sm:text-lg",
  xl: "min-h-[52px] px-6 py-3.5 text-lg",
  xxl: "min-h-[56px] px-7 py-4 text-xl",
};

const ICON_SIZE_CLASSES = {
  xs: "min-h-[34px] min-w-[34px] p-2",
  sm: "min-h-[40px] min-w-[40px] p-2.5",
  md: "min-h-[44px] min-w-[44px] p-3",
  lg: "min-h-[48px] min-w-[48px] p-3.5",
  xl: "min-h-[52px] min-w-[52px] p-4",
  xxl: "min-h-[56px] min-w-[56px] p-4",
};

const SHAPE_CLASSES = {
  rounded: "rounded-2xl",
  pill: "rounded-full",
  square: "rounded-xl",
  icon: "rounded-full",
};

const ELEVATION_CLASSES = {
  none: "shadow-none",
  md: "shadow-md hover:shadow-lg",
  lg: "shadow-lg hover:shadow-xl",
};

function getRel({ rel, target }) {
  if (rel) return rel;
  return target === "_blank" ? "noopener noreferrer" : undefined;
}

function getVariantClass({ variant, campanha }) {
  if (variant === "mensal") return campanha.botao;
  if (variant === "contraste") return campanha.botaoContraste;

  return VARIANTES_FIXAS[variant] || campanha.botao;
}

const Botao = forwardRef(function Botao(
  {
    children,
    onClick,
    type = "button",
    variant = "mensal",
    campanhaMes,
    size = "md",
    shape = "rounded",
    elevation = "md",
    disabled = false,
    loading = false,
    loadingText = "Processando...",
    progressBar = false,
    fullWidth = false,
    leftIcon = null,
    rightIcon = null,
    ariaLabel,
    className = "",
    title,
    href,
    target,
    rel,
    destructive = false,
    preventWhileLoading = true,
    ...props
  },
  ref
) {
  const campanha = getCampanhaSaudeVisual(campanhaMes);

  const isLink = typeof href === "string" && href.trim().length > 0;
  const isIconOnly = shape === "icon";
  const isDisabled = Boolean(disabled || loading);

  const accessibleLabel =
    ariaLabel ||
    title ||
    (typeof children === "string" ? children : undefined) ||
    (isIconOnly ? "Botão" : undefined);

  const handleClick = useCallback(
    (event) => {
      if (isDisabled || (preventWhileLoading && loading)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      onClick?.(event);
    },
    [isDisabled, loading, onClick, preventWhileLoading]
  );

  const commonClassName = classNames(
    "relative inline-flex items-center justify-center gap-2 overflow-hidden border font-black transition",
    "select-none whitespace-nowrap",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
    "disabled:cursor-not-allowed disabled:opacity-60",
    isDisabled && "cursor-not-allowed opacity-60",
    fullWidth ? "w-full" : "w-auto",
    isIconOnly
      ? ICON_SIZE_CLASSES[size] || ICON_SIZE_CLASSES.md
      : SIZE_CLASSES[size] || SIZE_CLASSES.md,
    SHAPE_CLASSES[shape] || SHAPE_CLASSES.rounded,
    ELEVATION_CLASSES[elevation] || ELEVATION_CLASSES.md,
    getVariantClass({ variant, campanha }),
    destructive && "ring-1 ring-rose-300/60 dark:ring-rose-900/60",
    className
  );

  const content = (
    <>
      {progressBar && loading && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-[inherit] bg-white/20"
        >
          <span className="absolute inset-y-0 left-0 w-1/3 animate-pulse bg-white/80" />
        </span>
      )}

      {loading && (
        <span
          className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}

      {!isIconOnly && leftIcon && !loading && (
        <span className="inline-flex shrink-0" aria-hidden="true">
          {leftIcon}
        </span>
      )}

      {isIconOnly ? (
        <span className="sr-only">{accessibleLabel}</span>
      ) : (
        <span
          className={classNames(
            "inline-flex min-w-0 items-center",
            loading && "opacity-95"
          )}
        >
          {loading ? loadingText : children}
        </span>
      )}

      {!isIconOnly && rightIcon && (
        <span className="inline-flex shrink-0" aria-hidden="true">
          {rightIcon}
        </span>
      )}
    </>
  );

  if (isLink) {
    return (
      <a
        ref={ref}
        href={isDisabled ? undefined : href}
        target={target}
        rel={getRel({ rel, target })}
        role="button"
        aria-disabled={isDisabled || undefined}
        aria-busy={loading || undefined}
        aria-label={accessibleLabel}
        title={title}
        tabIndex={isDisabled ? -1 : props.tabIndex}
        className={commonClassName}
        onClick={handleClick}
        {...props}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-label={accessibleLabel}
      title={title}
      className={commonClassName}
      onClick={handleClick}
      {...props}
    >
      {content}
    </button>
  );
});

Botao.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(["button", "submit", "reset"]),
  variant: PropTypes.oneOf([
    "mensal",
    "contraste",
    "perigo",
    "sucesso",
    "neutro",
    "contorno",
    "fantasma",
    "link",
  ]),
  campanhaMes: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  size: PropTypes.oneOf(["xs", "sm", "md", "lg", "xl", "xxl"]),
  shape: PropTypes.oneOf(["rounded", "pill", "square", "icon"]),
  elevation: PropTypes.oneOf(["none", "md", "lg"]),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  loadingText: PropTypes.string,
  progressBar: PropTypes.bool,
  fullWidth: PropTypes.bool,
  leftIcon: PropTypes.node,
  rightIcon: PropTypes.node,
  ariaLabel: PropTypes.string,
  className: PropTypes.string,
  title: PropTypes.string,
  href: PropTypes.string,
  target: PropTypes.string,
  rel: PropTypes.string,
  destructive: PropTypes.bool,
  preventWhileLoading: PropTypes.bool,
};

export default Botao;