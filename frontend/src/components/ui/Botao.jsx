// 📁 src/components/ui/Botao.jsx
import PropTypes from "prop-types";
import { forwardRef, useCallback, useMemo } from "react";

/**
 * Botão acessível e responsivo.
 * - Variantes alinhadas à paleta (lousa, azul petróleo, dourado, violeta, laranja, vermelho).
 * - Gradientes 3 cores nas variantes principais.
 * - Estados: loading/disabled com aria-busy + spinner semântico (e loadingText).
 * - Previne duplo clique enquanto loading.
 * - Suporte a ícones (leftIcon/rightIcon), tamanhos, forma (rounded|pill|square) e elevação.
 * - Suporte a href/target (vira <a role="button">).
 * - Foco visível consistente.
 */
const Botao = forwardRef(function Botao(
  {
    children,
    onClick,
    type = "button",
    variant = "primary",
    size = "md",
    shape = "rounded",        // "rounded" | "pill" | "square"
    elevation = "md",         // "none" | "md" | "lg"
    disabled = false,
    loading = false,
    loadingText = "Carregando…",
    fullWidth = false,
    leftIcon = null,
    rightIcon = null,
    ariaLabel,
    className = "",
    title,
    href,                     // se definido, renderiza <a>
    target,
    rel,
  },
  ref
) {
  const isDisabled = disabled || loading;
  const isLink = typeof href === "string" && href.length > 0;

  const base =
    "inline-flex items-center justify-center gap-2 font-medium " +
    "transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
    "ring-offset-background disabled:cursor-not-allowed select-none " +
    "whitespace-nowrap";

  const sizes = useMemo(
    () => ({
      sm: "px-3 py-2 text-sm min-h-[40px]",
      md: "px-4 py-2.5 text-base min-h-[44px]",
      lg: "px-5 py-3 text-base md:text-lg min-h-[48px]",
      xl: "px-6 py-3.5 text-lg min-h-[52px]",
    }),
    []
  );

  const shapes = useMemo(
    () => ({
      rounded: "rounded-2xl",
      pill: "rounded-full",
      square: "rounded-lg",
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

  // Paleta com gradiente 3-cores nas principais
  const variants = useMemo(
    () => ({
      primary:
        "text-textoLousa bg-gradient-to-br from-lousa via-lousa/90 to-lousa/80 hover:brightness-110 " +
        "disabled:opacity-60",
      secondary:
        "text-white bg-gradient-to-br from-azulPetroleo via-azulPetroleo/90 to-azulPetroleo/80 hover:brightness-110 " +
        "disabled:opacity-60",
      warning:
        "text-black bg-gradient-to-br from-dourado via-dourado/90 to-dourado/80 hover:brightness-110 disabled:opacity-60",
      info:
        "text-white bg-gradient-to-br from-violeta via-violeta/90 to-violeta/80 hover:brightness-110 disabled:opacity-60",
      accent:
        "text-black bg-gradient-to-br from-laranja via-laranja/90 to-laranja/80 hover:brightness-110 disabled:opacity-60",
      danger:
        "text-white bg-red-600 hover:bg-red-700 disabled:opacity-60",
      outline:
        "bg-transparent text-foreground border border-gray-300 " +
        "hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700",
      ghost:
        "bg-transparent text-foreground hover:bg-black/5 dark:hover:bg-white/10",
      link:
        "bg-transparent underline underline-offset-4 text-azulPetroleo hover:opacity-80 dark:text-dourado",
    }),
    []
  );

  const width = fullWidth ? "w-full" : "w-auto";

  const handleClick = useCallback(
    (e) => {
      if (isDisabled) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    },
    [isDisabled, onClick]
  );

  const Tag = isLink ? "a" : "button";
  const commonProps = isLink
    ? {
        href,
        target,
        rel: rel ?? (target === "_blank" ? "noopener noreferrer" : undefined),
        role: "button",
        "aria-disabled": isDisabled || undefined,
        onClick: isDisabled ? (e) => e.preventDefault() : undefined,
      }
    : {
        type,
        disabled: isDisabled,
        onClick: handleClick,
        "aria-disabled": isDisabled,
      };

  return (
    <Tag
      ref={ref}
      title={title}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      className={[
        base,
        shapes[shape],
        sizes[size],
        elevations[elevation],
        variants[variant] ?? variants.primary,
        "focus-visible:ring-white/80 dark:focus-visible:ring-white/70",
        width,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...commonProps}
    >
      {/* Spinner acessível quando loading */}
      {loading && (
        <>
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
          {/* Texto escondido para leitores de tela */}
          <span className="sr-only">{loadingText}</span>
        </>
      )}

      {leftIcon && <span className="inline-flex shrink-0" aria-hidden="true">{leftIcon}</span>}

      {/* Texto do botão: mantém espaçamento quando o spinner aparece */}
      <span className={loading ? "opacity-90" : ""}>{children}</span>

      {rightIcon && <span className="inline-flex shrink-0" aria-hidden="true">{rightIcon}</span>}
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
    "outline",
    "ghost",
    "link",
  ]),
  size: PropTypes.oneOf(["sm", "md", "lg", "xl"]),
  shape: PropTypes.oneOf(["rounded", "pill", "square"]),
  elevation: PropTypes.oneOf(["none", "md", "lg"]),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
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
};

export default Botao;
