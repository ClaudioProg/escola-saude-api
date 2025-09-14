// 📁 src/components/BotaoPrimario.jsx
import PropTypes from "prop-types";
import { forwardRef, useMemo } from "react";

/**
 * Botão primário padrão da plataforma.
 * - Paleta: verde-900 (padrão) + amarelo-ouro, laranja-queimado, vermelho-coral, azul-petróleo.
 * - A11y: aria-busy, foco visível com ring e offset claro (light/dark).
 * - UX: estado loading bloqueia clique e mostra spinner.
 * - Opções: size, fullWidth, leftIcon/rightIcon, cor, minWidth.
 */
const BotaoPrimario = forwardRef(function BotaoPrimario(
  {
    children,
    onClick,
    type = "button",
    className = "",
    disabled = false,
    loading = false,
    leftIcon = null,
    rightIcon = null,
    size = "md",          // sm | md | lg
    fullWidth = false,
    minWidth = 120,
    cor = "verde",        // verde | amareloOuro | laranjaQueimado | vermelhoCoral | azulPetroleo | cinza
    "aria-label": ariaLabel,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  const sizes = {
    sm: "px-4 py-1.5 text-sm",
    md: "px-6 py-2 text-base",
    lg: "px-7 py-3 text-lg",
  };
  const sizeClasses = sizes[size] || sizes.md;

  // Mapeia cores (bg/hover, ring e cor do texto)
  const variants = {
    // padrão institucional
    verde:        { bg: "bg-green-900 hover:bg-green-800", ring: "focus-visible:ring-green-700", text: "text-white" },

    // solicitadas
    amareloOuro:  { bg: "bg-amber-500 hover:bg-amber-600", ring: "focus-visible:ring-amber-300", text: "text-black" },
    laranjaQueimado:{ bg: "bg-orange-600 hover:bg-orange-700", ring: "focus-visible:ring-orange-400", text: "text-white" },
    vermelhoCoral:{ bg: "bg-red-500 hover:bg-red-600",     ring: "focus-visible:ring-red-300",    text: "text-white" },
    azulPetroleo: { bg: "bg-cyan-800 hover:bg-cyan-900",   ring: "focus-visible:ring-cyan-600",   text: "text-white" },

    // neutro opcional
    cinza:        { bg: "bg-gray-700 hover:bg-gray-800",   ring: "focus-visible:ring-gray-400",   text: "text-white" },
  };

  const { bg, ring, text } = variants[cor] || variants.verde;

  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold shadow transition " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-800 " +
    "disabled:opacity-60 disabled:cursor-not-allowed select-none";

  return (
    <button
      ref={ref}
      type={type}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      style={{ minWidth }}
      className={[
        base,
        bg,
        ring,
        text,
        sizeClasses,
        fullWidth ? "w-full" : "w-auto",
        className,
      ].join(" ")}
      {...props}
    >
      {loading && (
        <span
          className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      )}

      {!loading && leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}

      <span className={loading ? "opacity-90" : ""}>{children}</span>

      {!loading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
});

BotaoPrimario.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(["button", "submit", "reset"]),
  className: PropTypes.string,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  leftIcon: PropTypes.node,
  rightIcon: PropTypes.node,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  fullWidth: PropTypes.bool,
  minWidth: PropTypes.number,
  cor: PropTypes.oneOf([
    "verde",
    "amareloOuro",
    "laranjaQueimado",
    "vermelhoCoral",
    "azulPetroleo",
    "cinza",
  ]),
  "aria-label": PropTypes.string,
};

export default BotaoPrimario;
