// 📁 src/components/BotaoPrimario.jsx
import PropTypes from "prop-types";
import { forwardRef } from "react";

/**
 * Botão primário padrão da plataforma.
 * - Paleta: verde (padrão) + amarelo-ouro, laranja-queimado, vermelho-coral, azul-petróleo, cinza.
 * - Tones: solid (gradiente 3 cores), outline, ghost.
 * - A11y: aria-busy, foco visível com ring por cor (light/dark).
 * - UX: loading bloqueia clique e mostra spinner.
 * - Opções: size, fullWidth, leftIcon/rightIcon, cor, minWidth, shape, href/target.
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
    size = "md",             // sm | md | lg
    fullWidth = false,
    minWidth = 120,
    cor = "verde",           // verde | amareloOuro | laranjaQueimado | vermelhoCoral | azulPetroleo | cinza
    shape = "rounded-2xl",   // rounded-md | rounded-lg | rounded-2xl | rounded-full (padrão harmoniza com o DS)
    tone = "solid",          // solid | outline | ghost
    href,                    // se definido, age como link <a>
    target,
    rel,
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

  // Paleta por cor (ring + sólidos/outline)
  const palette = {
    verde: {
      ring: "focus-visible:ring-emerald-600/60",
      solid: "bg-gradient-to-br from-[#0f2c1f] via-[#114b2d] to-[#166534] text-white border-emerald-900/40",
      outline: "text-emerald-900 dark:text-emerald-200 border border-emerald-400 hover:bg-emerald-50 dark:border-emerald-700 dark:hover:bg-emerald-900/20",
      ghost: "text-emerald-900 dark:text-emerald-200 hover:bg-black/5 dark:hover:bg-white/10",
    },
    amareloOuro: {
      ring: "focus-visible:ring-amber-400/60",
      solid: "bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-black border-amber-800/40",
      outline: "text-amber-800 dark:text-amber-200 border border-amber-400 hover:bg-amber-50 dark:border-amber-700 dark:hover:bg-amber-900/20",
      ghost: "text-amber-800 dark:text-amber-200 hover:bg-black/5 dark:hover:bg-white/10",
    },
    laranjaQueimado: {
      ring: "focus-visible:ring-orange-400/60",
      solid: "bg-gradient-to-br from-orange-600 via-orange-700 to-orange-800 text-white border-orange-900/40",
      outline: "text-orange-700 dark:text-orange-300 border border-orange-400 hover:bg-orange-50 dark:border-orange-600 dark:hover:bg-orange-900/20",
      ghost: "text-orange-700 dark:text-orange-300 hover:bg-black/5 dark:hover:bg-white/10",
    },
    vermelhoCoral: {
      ring: "focus-visible:ring-red-400/60",
      solid: "bg-gradient-to-br from-red-500 via-red-600 to-red-700 text-white border-red-900/40",
      outline: "text-red-600 dark:text-red-300 border border-red-400 hover:bg-red-50 dark:border-red-600 dark:hover:bg-red-900/20",
      ghost: "text-red-600 dark:text-red-300 hover:bg-black/5 dark:hover:bg-white/10",
    },
    azulPetroleo: {
      ring: "focus-visible:ring-cyan-600/60",
      solid: "bg-gradient-to-br from-cyan-800 via-cyan-900 to-slate-900 text-white border-cyan-950/50",
      outline: "text-cyan-800 dark:text-cyan-200 border border-cyan-500 hover:bg-cyan-50 dark:border-cyan-700 dark:hover:bg-slate-800/40",
      ghost: "text-cyan-800 dark:text-cyan-200 hover:bg-black/5 dark:hover:bg-white/10",
    },
    cinza: {
      ring: "focus-visible:ring-gray-400/60",
      solid: "bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 text-white border-gray-950/40",
      outline: "text-gray-800 dark:text-gray-200 border border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800/40",
      ghost: "text-gray-800 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10",
    },
  };

  const theme = palette[cor] || palette.verde;

  const base =
    "inline-flex items-center justify-center gap-2 font-semibold shadow transition " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-800 " +
    "disabled:opacity-60 disabled:cursor-not-allowed select-none";

  const toneClasses =
    tone === "outline"
      ? theme.outline
      : tone === "ghost"
      ? theme.ghost + " border border-transparent"
      : theme.solid + " border hover:brightness-[1.05]";

  const Tag = href ? "a" : "button";
  const commonProps = href
    ? {
        href,
        target,
        rel: rel ?? (target === "_blank" ? "noopener noreferrer" : undefined),
        role: "button",
        "aria-disabled": isDisabled || undefined,
        onClick: isDisabled ? (e) => e.preventDefault() : onClick,
      }
    : {
        type,
        onClick: isDisabled ? undefined : onClick,
        disabled: isDisabled,
      };

  return (
    <Tag
      ref={ref}
      {...commonProps}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      style={{ minWidth }}
      className={[
        base,
        theme.ring,
        toneClasses,
        sizeClasses,
        shape,
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

      {!loading && leftIcon && (
        <span className="inline-flex shrink-0" aria-hidden="true">{leftIcon}</span>
      )}

      <span className={loading ? "opacity-90" : ""}>{children}</span>

      {!loading && rightIcon && (
        <span className="inline-flex shrink-0" aria-hidden="true">{rightIcon}</span>
      )}
    </Tag>
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
  shape: PropTypes.oneOf(["rounded-md", "rounded-lg", "rounded-2xl", "rounded-full"]),
  tone: PropTypes.oneOf(["solid", "outline", "ghost"]),
  href: PropTypes.string,
  target: PropTypes.string,
  rel: PropTypes.string,
  "aria-label": PropTypes.string,
};

export default BotaoPrimario;
