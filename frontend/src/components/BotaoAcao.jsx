// 📁 src/components/BotaoAcao.jsx
import PropTypes from "prop-types";

/**
 * Botão de ação compacto (chip).
 * - Retrocompatível com a API antiga (label, icon, onClick, cor, disabled, loading, className).
 * - Gradiente 3 cores (solid), outline e ghost.
 * - Tamanhos xs/sm/md, shapes, foco visível, a11y e link via href/target.
 */
export default function BotaoAcao({
  label,
  icon,                 // compat: vira leftIcon se leftIcon não vier
  onClick,
  cor = "blue",
  disabled = false,
  loading = false,
  className = "",

  /* novos (retrocompat) */
  tone = "solid",        // "solid" | "outline" | "ghost"
  size = "md",           // "xs" | "sm" | "md"
  shape = "full",        // "full" | "lg" | "md"
  ariaLabel,             // default = label
  title,                 // tooltip
  href,                  // vira <a>
  target,
  rel,
  as,                    // força tag raiz

  /* opcionais extras */
  leftIcon,             // preferível ao 'icon'
  rightIcon,
  fullWidth = false,
}) {
  /* ====== Tabelas de estilo ====== */
  const sizeMap = {
    xs: "text-[11px] px-2 py-0.5 gap-1 min-h-[28px]",
    sm: "text-xs px-2.5 py-1 gap-1.5 min-h-[32px]",
    md: "text-xs px-3 py-1 gap-1.5 min-h-[36px]",
  };

  const roundMap = {
    full: "rounded-full",
    lg: "rounded-xl",
    md: "rounded-lg",
  };

  // Paleta institucional (cores + ring)
  const palette = {
    blue:      { ring: "ring-blue-400",      solid: "from-blue-600 via-blue-700 to-blue-800 text-white border-blue-900/40",       outline: "text-blue-700 border-blue-400 dark:text-blue-300 dark:border-blue-600",       ghost: "text-blue-700 dark:text-blue-300" },
    purple:    { ring: "ring-purple-400",    solid: "from-purple-700 via-purple-800 to-purple-900 text-white border-purple-950/40", outline: "text-purple-700 border-purple-400 dark:text-purple-300 dark:border-purple-600", ghost: "text-purple-700 dark:text-purple-300" },
    green:     { ring: "ring-green-500",     solid: "from-green-700 via-green-800 to-green-900 text-white border-green-950/40",    outline: "text-green-700 border-green-400 dark:text-green-300 dark:border-green-600",    ghost: "text-green-700 dark:text-green-300" },
    gray:      { ring: "ring-gray-400",      solid: "from-gray-700 via-gray-800 to-gray-900 text-white border-gray-950/40",        outline: "text-gray-700 border-gray-400 dark:text-gray-300 dark:border-gray-600",       ghost: "text-gray-700 dark:text-gray-300" },
    red:       { ring: "ring-red-500",       solid: "from-red-600 via-red-700 to-red-800 text-white border-red-900/40",            outline: "text-red-700 border-red-400 dark:text-red-300 dark:border-red-600",           ghost: "text-red-700 dark:text-red-300" },
    orange:    { ring: "ring-orange-400",    solid: "from-orange-600 via-orange-700 to-orange-800 text-white border-orange-900/40", outline: "text-orange-700 border-orange-400 dark:text-orange-300 dark:border-orange-600", ghost: "text-orange-700 dark:text-orange-300" },
    verde:     { ring: "ring-emerald-600",   solid: "from-[#0f2c1f] via-[#114b2d] to-[#166534] text-white border-emerald-900/40",  outline: "text-emerald-800 border-emerald-400 dark:text-emerald-200 dark:border-emerald-700", ghost: "text-emerald-800 dark:text-emerald-200" },
    amareloOuro:     { ring: "ring-amber-300",   solid: "from-amber-500 via-amber-600 to-amber-700 text-black border-amber-800/40",    outline: "text-amber-800 border-amber-400 dark:text-amber-200 dark:border-amber-700",    ghost: "text-amber-800 dark:text-amber-200" },
    laranjaQueimado: { ring: "ring-orange-400",  solid: "from-orange-600 via-orange-700 to-orange-800 text-white border-orange-900/40", outline: "text-orange-700 border-orange-400 dark:text-orange-300 dark:border-orange-600", ghost: "text-orange-700 dark:text-orange-300" },
    vermelhoCoral:   { ring: "ring-red-400",     solid: "from-red-500 via-red-600 to-red-700 text-white border-red-900/40",            outline: "text-red-600 border-red-400 dark:text-red-300 dark:border-red-600",            ghost: "text-red-600 dark:text-red-300" },
    azulPetroleo:    { ring: "ring-cyan-600",    solid: "from-cyan-800 via-cyan-900 to-slate-900 text-white border-cyan-950/50",       outline: "text-cyan-800 border-cyan-500 dark:text-cyan-200 dark:border-cyan-700",        ghost: "text-cyan-800 dark:text-cyan-200" },
  };

  const pal = palette[cor] || palette.blue;

  const toneClasses =
    tone === "outline"
      ? `bg-transparent border ${pal.outline} hover:bg-black/5 dark:hover:bg-white/10`
      : tone === "ghost"
      ? `bg-transparent ${pal.ghost} hover:bg-black/5 dark:hover:bg-white/10 border border-transparent`
      : `bg-gradient-to-br ${pal.solid} border hover:brightness-110`;

  /* ====== Semântica/Tag ====== */
  const Tag = as || (href ? "a" : "button");

  const commonProps = href
    ? {
        href,
        target,
        rel: rel ?? (target === "_blank" ? "noopener noreferrer" : undefined),
        role: "button",
        "aria-disabled": disabled || loading || undefined,
        onClick: disabled || loading ? (e) => e.preventDefault() : onClick,
      }
    : {
        type: "button",
        onClick: !disabled && !loading ? onClick : undefined,
        disabled: disabled || loading,
      };

  /* ====== Classes base ====== */
  const base =
    "inline-flex items-center justify-center select-none " +
    "transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
    "disabled:opacity-60 disabled:cursor-not-allowed";

  const widthCls = fullWidth ? "w-full" : "w-auto";

  /* ====== Ícones (retrocompat) ====== */
  const left = leftIcon ?? icon ?? null;

  return (
    <Tag
      {...commonProps}
      title={title}
      aria-label={ariaLabel || label}
      aria-busy={loading || undefined}
      className={[
        base,
        sizeMap[size],
        roundMap[shape],
        toneClasses,
        widthCls,
        className,
        pal.ring, // cor do foco
      ].join(" ")}
      data-variant="BotaoAcao"
      data-tone={tone}
      data-color={cor}
      data-size={size}
    >
      {loading ? (
        <span
          className="h-3 w-3 border-2 border-current border-t-transparent rounded-full motion-safe:animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <>
          {left && <span className="shrink-0" aria-hidden="true">{left}</span>}
          <span className="whitespace-nowrap">{label}</span>
          {rightIcon && <span className="shrink-0" aria-hidden="true">{rightIcon}</span>}
        </>
      )}
    </Tag>
  );
}

BotaoAcao.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.node,
  onClick: PropTypes.func,
  cor: PropTypes.oneOf([
    "blue","purple","green","gray","red","orange","verde",
    "amareloOuro","laranjaQueimado","vermelhoCoral","azulPetroleo",
  ]),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  className: PropTypes.string,

  /* novos */
  tone: PropTypes.oneOf(["solid", "outline", "ghost"]),
  size: PropTypes.oneOf(["xs", "sm", "md"]),
  shape: PropTypes.oneOf(["full", "lg", "md"]),
  ariaLabel: PropTypes.string,
  title: PropTypes.string,
  href: PropTypes.string,
  target: PropTypes.string,
  rel: PropTypes.string,
  as: PropTypes.string,
  leftIcon: PropTypes.node,
  rightIcon: PropTypes.node,
  fullWidth: PropTypes.bool,
};
