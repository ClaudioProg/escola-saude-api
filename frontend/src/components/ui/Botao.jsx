// 📁 src/components/ui/Botao.jsx
import PropTypes from "prop-types";
import { forwardRef, useCallback, useMemo } from "react";

/**
 * Botão acessível e responsivo, mobile-first.
 * - Gradientes 3 cores nas variantes principais (mantém tua paleta).
 * - Estados: loading/disabled com aria-busy + spinner semântico (+ loadingText).
 * - Previne duplo clique em submit enquanto loading.
 * - Ícones (leftIcon/rightIcon), tamanhos, forma (rounded|pill|square|iconOnly), elevação.
 * - <a role="button"> com foco/disable corretos; ou use `as` para custom tag.
 * - Progress bar fino opcional no topo quando loading (progressBar=true).
 */

const Botao = forwardRef(function Botao(
  {
    children,
    onClick,
    type = "button",
    variant = "primary",
    size = "md",
    shape = "rounded",        // "rounded" | "pill" | "square" | "icon"
    elevation = "md",         // "none" | "md" | "lg"
    disabled = false,
    loading = false,
    loadingText = "Carregando…",
    progressBar = false,      // barra sutil de progresso no topo quando loading
    fullWidth = false,
    leftIcon = null,
    rightIcon = null,
    ariaLabel,
    className = "",
    title,
    href,                     // se definido, renderiza <a role="button">
    target,
    rel,
    as: As,                   // renderiza como componente/tag custom
    destructive = false,      // apenas estilização (realça "perigoso")
    // …rest (data-attrs etc.)
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;
  const isLink = typeof href === "string" && href.length > 0;
  const isIconOnly = shape === "icon";

  /* Base util */
  const base =
    "relative inline-flex items-center justify-center gap-2 font-medium " +
    "transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
    "ring-offset-background disabled:cursor-not-allowed select-none " +
    "whitespace-nowrap";

  const sizes = useMemo(
    () => ({
      xs: "px-2.5 py-1.5 text-xs min-h-[34px]",
      sm: "px-3 py-2 text-sm min-h-[40px]",
      md: "px-4 py-2.5 text-base min-h-[44px]",
      lg: "px-5 py-3 text-base md:text-lg min-h-[48px]",
      xl: "px-6 py-3.5 text-lg min-h-[52px]",
      xxl: "px-7 py-4 text-xl min-h-[56px]",
      icon_xs: "p-2 min-w-[34px] min-h-[34px]",
      icon_sm: "p-2.5 min-w-[40px] min-h-[40px]",
      icon_md: "p-3 min-w-[44px] min-h-[44px]",
      icon_lg: "p-3.5 min-w-[48px] min-h-[48px]",
      icon_xl: "p-4 min-w-[52px] min-h-[52px]",
    }),
    []
  );

  const shapes = useMemo(
    () => ({
      rounded: "rounded-2xl",
      pill: "rounded-full",
      square: "rounded-lg",
      icon: "rounded-full",
    }),
    []
  );

  const elevations = useMemo(
    () => ({
      none: "",
      md: "shadow-md hover:shadow-lg",
      lg: "shadow-lg hover:shadow-xl",
    }),
    []
  );

  // Paleta com gradiente 3-cores nas principais (mantém tuas tokens utilitárias)
  const variants = useMemo(
    () => ({
      primary:
        "text-textoLousa bg-gradient-to-br from-lousa via-lousa/90 to-lousa/80 hover:brightness-110 disabled:opacity-60",
      secondary:
        "text-white bg-gradient-to-br from-azulPetroleo via-azulPetroleo/90 to-azulPetroleo/80 hover:brightness-110 disabled:opacity-60",
      warning:
        "text-black bg-gradient-to-br from-dourado via-dourado/90 to-dourado/80 hover:brightness-110 disabled:opacity-60",
      info:
        "text-white bg-gradient-to-br from-violeta via-violeta/90 to-violeta/80 hover:brightness-110 disabled:opacity-60",
      accent:
        "text-black bg-gradient-to-br from-laranja via-laranja/90 to-laranja/80 hover:brightness-110 disabled:opacity-60",
      danger:
        "text-white bg-gradient-to-br from-red-600 via-red-600/90 to-red-700 hover:brightness-110 disabled:opacity-60",
      success:
        "text-white bg-gradient-to-br from-emerald-600 via-emerald-600/90 to-emerald-700 hover:brightness-110 disabled:opacity-60",
      neutral:
        "text-foreground bg-gradient-to-br from-slate-200 via-slate-200/90 to-slate-300 hover:brightness-110 disabled:opacity-60 dark:from-slate-700 dark:via-slate-700/90 dark:to-slate-800",
      outline:
        "bg-transparent text-foreground border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700",
      ghost:
        "bg-transparent text-foreground hover:bg-black/5 dark:hover:bg-white/10",
      link:
        "bg-transparent underline underline-offset-4 text-azulPetroleo hover:opacity-80 dark:text-dourado",
    }),
    []
  );

  const width = fullWidth ? "w-full" : "w-auto";

  /* Clique seguro: bloqueia submit duplo enquanto loading */
  const handleClick = useCallback(
    (e) => {
      if (isDisabled) {
        e.preventDefault();
        return;
      }
      // Se for submit, evita envios repetidos em formulários
      if (type === "submit" && loading) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    },
    [isDisabled, onClick, type, loading]
  );

  /* Render tag: a | button | custom via `as` */
  const Tag = As ? As : isLink ? "a" : "button";

  const commonInteractiveProps = isLink
    ? {
        href,
        target,
        rel: rel ?? (target === "_blank" ? "noopener noreferrer" : undefined),
        role: "button",
        "aria-disabled": isDisabled || undefined,
        tabIndex: isDisabled ? -1 : undefined,
        onClick: isDisabled ? (e) => e.preventDefault() : undefined,
      }
    : {
        type,
        disabled: isDisabled,
        onClick: handleClick,
        "aria-disabled": isDisabled,
      };

  /* Tamanho final considerando iconOnly */
  const sizeClass = isIconOnly
    ? ({
        xs: sizes.icon_xs,
        sm: sizes.icon_sm,
        md: sizes.icon_md,
        lg: sizes.icon_lg,
        xl: sizes.icon_xl,
        xxl: sizes.icon_xl,
      }[size] ?? sizes.icon_md)
    : (sizes[size] ?? sizes.md);

  return (
    <Tag
      ref={ref}
      title={title}
      aria-busy={loading || undefined}
      aria-live={loading ? "polite" : undefined}
      aria-label={ariaLabel}
      className={[
        base,
        shapes[shape],
        sizeClass,
        elevations[elevation],
        variants[variant] ?? variants.primary,
        "focus-visible:ring-white/80 dark:focus-visible:ring-white/70",
        width,
        isLink && isDisabled ? "opacity-60 pointer-events-none" : "",
        destructive ? "ring-1 ring-red-300/50 dark:ring-red-900/40" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...commonInteractiveProps}
      {...rest}
    >
      {/* Progress bar fino no topo */}
      {progressBar && loading && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 h-0.5 w-full overflow-hidden rounded-t-[inherit]"
        >
          <span className="absolute inset-y-0 left-0 w-1/3 animate-[progress_1.2s_ease-in-out_infinite] bg-white/70" />
          <style>{`
            @keyframes progress {
              0% { transform: translateX(-100%); }
              50% { transform: translateX(50%); }
              100% { transform: translateX(300%); }
            }
          `}</style>
        </span>
      )}

      {/* Spinner acessível quando loading */}
      {loading && (
        <>
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
          <span className="sr-only">{loadingText}</span>
        </>
      )}

      {/* Ícone esquerdo (oculto de SR) */}
      {!isIconOnly && leftIcon && (
        <span className="inline-flex shrink-0" aria-hidden="true">
          {leftIcon}
        </span>
      )}

      {/* Conteúdo / manter espaçamento com spinner */}
      {isIconOnly ? (
        <span className="sr-only">{typeof children === "string" ? children : ariaLabel || "Botão"}</span>
      ) : (
        <span className={loading ? "opacity-90" : ""}>{children}</span>
      )}

      {/* Ícone direito (oculto de SR) */}
      {!isIconOnly && rightIcon && (
        <span className="inline-flex shrink-0" aria-hidden="true">
          {rightIcon}
        </span>
      )}
    </Tag>
  );
});

Botao.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(["button", "submit", "reset"]),
  variant: PropTypes.oneOf([
    "primary",
    "secondary",
    "warning",
    "info",
    "accent",
    "danger",
    "success",
    "neutral",
    "outline",
    "ghost",
    "link",
  ]),
  size: PropTypes.oneOf(["xs", "sm", "md", "lg", "xl", "xxl"]),
  shape: PropTypes.oneOf(["rounded", "pill", "square", "icon"]),
  elevation: PropTypes.oneOf(["none", "md", "lg"]),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  progressBar: PropTypes.bool,
  loadingText: PropTypes.string,
  fullWidth: PropTypes.bool,
  leftIcon: PropTypes.node,
  rightIcon: PropTypes.node,
  ariaLabel: PropTypes.string,
  className: PropTypes.string,
  title: PropTypes.string,
  href: PropTypes.string,
  target: PropTypes.string,
  rel: PropTypes.string,
  as: PropTypes.elementType,
  destructive: PropTypes.bool,
};

export default Botao;
