// 📁 src/components/ui/Botao.jsx
import PropTypes from "prop-types";
import { forwardRef, useCallback, useMemo } from "react";

/**
 * Botão acessível e responsivo.
 * - Variantes alinhadas à paleta (lousa, azul petróleo, dourado, violeta, laranja, vermelho).
 * - Estados: loading/disabled com aria-busy + spinner semântico.
 * - Previne duplo clique enquanto loading.
 * - Suporte a ícones (leftIcon/rightIcon) e larguras/sizes.
 * - Foco visível consistente (usa tokens/cores do projeto).
 */
const Botao = forwardRef(function Botao(
  {
    children,
    onClick,
    type = "button",
    variant = "primary",
    size = "md",
    disabled = false,
    loading = false,
    fullWidth = false,
    leftIcon = null,
    rightIcon = null,
    ariaLabel,
    className = "",
  },
  ref
) {
  const isDisabled = disabled || loading;

  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl font-medium " +
    "transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
    "ring-offset-background disabled:cursor-not-allowed select-none";

  const sizes = useMemo(
    () => ({
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-base",
      lg: "px-5 py-3 text-base md:text-lg",
    }),
    []
  );

  // Paleta: lousa (primário), azul-petróleo (secondary), dourado (warning),
  // violeta (info), laranja (accent), vermelho (danger), neutro (ghost/outline).
  const variants = useMemo(
    () => ({
      primary:
        // verde lousa
        "bg-lousa text-textoLousa hover:bg-lousa/90 " +
        "disabled:bg-lousa/50 dark:hover:bg-lousa/80",
      secondary:
        // azul petróleo
        "bg-azulPetroleo text-white hover:bg-azulPetroleo/90 " +
        "disabled:opacity-60",
      warning:
        // dourado
        "bg-dourado text-black hover:bg-dourado/90 disabled:opacity-60",
      info:
        // violeta
        "bg-violeta text-white hover:bg-violeta/90 disabled:opacity-60",
      accent:
        // laranja
        "bg-laranja text-black hover:bg-laranja/90 disabled:opacity-60",
      danger:
        // vermelho p/ ações destrutivas
        "bg-red-600 text-white hover:bg-red-700 disabled:opacity-60",
      outline:
        // contorno neutro (bom p/ secundário em superfícies claras/escuras)
        "bg-transparent text-foreground border border-gray-300 " +
        "hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700",
      ghost:
        "bg-transparent text-foreground hover:bg-black/5 dark:hover:bg-white/10",
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

  return (
    <button
      ref={ref}
      type={type}
      onClick={handleClick}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      className={[
        base,
        sizes[size],
        variants[variant] ?? variants.primary,
        width,
        className,
      ].join(" ")}
    >
      {/* Spinner acessível quando loading */}
      {loading && (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}

      {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}

      {/* Texto do botão: mantém espaçamento quando o spinner aparece */}
      <span className={loading ? "opacity-90" : ""}>{children}</span>

      {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
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
  ]),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  fullWidth: PropTypes.bool,
  leftIcon: PropTypes.node,
  rightIcon: PropTypes.node,
  ariaLabel: PropTypes.string,
  className: PropTypes.string,
};

export default Botao;
