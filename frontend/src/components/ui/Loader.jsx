// 📁 src/components/ui/Loader.jsx
import PropTypes from "prop-types";

/**
 * Loader (spinner) moderno e acessível.
 * - Gradiente animado (3 cores) com acento configurável.
 * - Suporte a dark mode, tamanhos, inline/centralizado, e skeleton.
 * - Acessível (role="status" + aria-live) e responsivo.
 */
export default function Loader({
  size = "md",
  accent = "emerald",    // emerald | violet | amber | rose | teal | indigo | petroleo | orange | sky | lousa
  inline = false,         // se true, sem centralização (para dentro de botões/cards)
  minimal = false,        // se true, remove anel duplo e usa círculo simples
  skeleton = false,       // modo pulsante em vez de girar
  className = "",
  ariaLabel = "Carregando…",
}) {
  const sizes = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-4",
    lg: "h-12 w-12 border-4",
    xl: "h-16 w-16 border-[5px]",
  };

  const accents = {
    emerald: "from-emerald-700 via-emerald-500 to-emerald-300",
    violet: "from-violet-700 via-violet-500 to-violet-300",
    amber: "from-amber-700 via-amber-500 to-amber-300",
    rose: "from-rose-700 via-rose-500 to-rose-300",
    teal: "from-teal-700 via-teal-500 to-teal-300",
    indigo: "from-indigo-700 via-indigo-500 to-indigo-300",
    petroleo: "from-slate-900 via-teal-800 to-slate-700",
    orange: "from-orange-700 via-orange-500 to-orange-300",
    sky: "from-sky-700 via-sky-500 to-sky-300",
    lousa: "from-[#0f2c1f] via-[#114b2d] to-[#166534]",
  };
  const grad = accents[accent] ?? accents.emerald;

  const sizeCls = sizes[size] ?? sizes.md;
  const layoutCls = inline ? "inline-flex items-center" : "flex justify-center items-center py-4";

  if (skeleton) {
    return (
      <div
        role="status"
        aria-label={ariaLabel}
        aria-live="polite"
        className={`${layoutCls} ${className}`}
      >
        <div
          className={`rounded-full bg-gradient-to-r ${grad} animate-pulse ${sizeCls}`}
        />
        <span className="sr-only">{ariaLabel}</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
      className={`${layoutCls} ${className}`}
    >
      <div
        className={`relative ${sizeCls} rounded-full ${
          minimal
            ? `animate-spin bg-gradient-to-tr ${grad}`
            : `animate-spin border-t-transparent border-4 border-solid bg-gradient-to-tr ${grad}`
        }`}
        style={{
          backgroundClip: minimal ? "padding-box" : undefined,
        }}
      />
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
}

Loader.propTypes = {
  size: PropTypes.oneOf(["sm", "md", "lg", "xl"]),
  accent: PropTypes.oneOf([
    "emerald",
    "violet",
    "amber",
    "rose",
    "teal",
    "indigo",
    "petroleo",
    "orange",
    "sky",
    "lousa",
  ]),
  inline: PropTypes.bool,
  minimal: PropTypes.bool,
  skeleton: PropTypes.bool,
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
};
