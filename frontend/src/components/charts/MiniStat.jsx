// 📁 src/components/charts/MiniStat.jsx
import React, { useMemo, forwardRef } from "react";
import PropTypes from "prop-types";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

/**
 * 💡 MiniStat — métrica compacta, acessível e responsiva.
 * Compatível com mobile, com gradientes modernos (3 cores), deltas e loading.
 *
 * Backward-compatible:
 *   props antigos: { label, value, accent = "emerald", icon = null }
 *
 * Novos opcionais:
 *   - delta (number|string): variação (ex.: +12, -3.4, "—")
 *   - unit (string): sufixo do valor ("h", "%", etc.)
 *   - formatValue (fn): (value) => string
 *   - loading (bool): esqueleto de carregamento
 *   - compact (bool): reduz paddings e fonte para grids densos
 *   - ariaDescription (string): texto descritivo para leitores de tela
 *   - tooltip (string): dica no title
 *   - href (string) / onClick (fn): torna clicável (link ou botão)
 *   - className (string): classes extras
 */
const ACCENTS = {
  emerald: {
    grad: "from-emerald-600 via-emerald-700 to-emerald-800",
    ring: "ring-emerald-200 dark:ring-emerald-900/40",
  },
  violet: {
    grad: "from-violet-600 via-violet-700 to-violet-800",
    ring: "ring-violet-200 dark:ring-violet-900/40",
  },
  amber: {
    grad: "from-amber-500 via-amber-600 to-amber-700",
    ring: "ring-amber-200 dark:ring-amber-900/40",
  },
  sky: {
    grad: "from-sky-500 via-sky-600 to-sky-700",
    ring: "ring-sky-200 dark:ring-sky-900/40",
  },
  rose: {
    grad: "from-rose-600 via-rose-700 to-rose-800",
    ring: "ring-rose-200 dark:ring-rose-900/40",
  },
  teal: {
    grad: "from-teal-600 via-teal-700 to-teal-800",
    ring: "ring-teal-200 dark:ring-teal-900/40",
  },
  blue: {
    grad: "from-blue-600 via-blue-700 to-blue-800",
    ring: "ring-blue-200 dark:ring-blue-900/40",
  },
  indigo: {
    grad: "from-indigo-600 via-indigo-700 to-indigo-800",
    ring: "ring-indigo-200 dark:ring-indigo-900/40",
  },
};

function DeltaBadge({ delta }) {
  // Aceita number ou string. Se string "—", mostra neutro.
  const num = typeof delta === "number" ? delta : Number(delta);
  const isNumber = Number.isFinite(num);
  const isUp = isNumber && num > 0;
  const isDown = isNumber && num < 0;
  const isNeutral = !isNumber || num === 0;

  const base =
    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold";
  const cls = isUp
    ? `${base} bg-emerald-900/30 text-emerald-100`
    : isDown
    ? `${base} bg-rose-900/30 text-rose-100`
    : `${base} bg-white/15 text-white`;

  return (
    <span className={cls} aria-label={`Variação: ${String(delta)}`}>
      {isUp && <ArrowUpRight className="w-3.5 h-3.5" aria-hidden />}
      {isDown && <ArrowDownRight className="w-3.5 h-3.5" aria-hidden />}
      {isNeutral && <Minus className="w-3.5 h-3.5" aria-hidden />}
      <span>{String(delta)}</span>
    </span>
  );
}

const MiniStat = forwardRef(function MiniStat(
  {
    label,
    value,
    accent = "emerald",
    icon = null,
    delta = null,
    unit = "",
    formatValue,
    loading = false,
    compact = false,
    ariaDescription,
    tooltip,
    href,
    onClick,
    className = "",
    ...rest
  },
  ref
) {
  const theme = ACCENTS[accent] ?? ACCENTS.emerald;

  const Tag = href ? "a" : onClick ? "button" : "div";
  const interactiveProps = href
    ? { href, rel: "noreferrer", target: "_self" }
    : onClick
    ? { type: "button", onClick }
    : {};

  const pad = compact ? "p-3 sm:p-3.5" : "p-4 sm:p-5";
  const labelCls = compact ? "text-[11px] sm:text-xs" : "text-xs sm:text-sm";
  const valueCls = compact
    ? "text-xl sm:text-2xl"
    : "text-2xl sm:text-3xl";

  const displayValue = useMemo(() => {
    if (loading) return "—";
    const raw = value ?? "—";
    const formatted = typeof formatValue === "function" ? formatValue(raw) : raw;
    return unit && formatted !== "—" ? `${formatted}${unit}` : formatted;
  }, [value, unit, loading, formatValue]);

  const regionLabel = `${label}: ${displayValue}`;

  return (
    <Tag
      ref={ref}
      title={tooltip}
      className={[
        "rounded-2xl text-white bg-gradient-to-br",
        theme.grad,
        "shadow-md hover:shadow-lg transition-all duration-300 ease-out",
        "ring-1", theme.ring,
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/70",
        "select-none",
        pad,
        className,
        (href || onClick) && "cursor-pointer active:scale-[0.99]",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={regionLabel}
      role="region"
      {...interactiveProps}
      {...rest}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className="text-white/95 shrink-0" aria-hidden>
              {icon}
            </span>
          )}
          <p className={`${labelCls} opacity-90 font-medium tracking-wide truncate`}>
            {label}
          </p>
        </div>

        {delta != null && <DeltaBadge delta={delta} />}
      </div>

      {/* Valor */}
      <p
        className={`${valueCls} font-extrabold leading-tight drop-shadow-sm mt-1`}
        aria-live="polite"
        aria-atomic="true"
      >
        {loading ? (
          <span className="inline-block align-middle w-20 h-[1.1em] bg-white/20 rounded animate-pulse" />
        ) : (
          displayValue
        )}
      </p>

      {/* Descrição para SR */}
      {ariaDescription && (
        <p className="sr-only">{ariaDescription}</p>
      )}
    </Tag>
  );
});

MiniStat.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  accent: PropTypes.oneOf(Object.keys(ACCENTS)),
  icon: PropTypes.node,
  delta: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  unit: PropTypes.string,
  formatValue: PropTypes.func,
  loading: PropTypes.bool,
  compact: PropTypes.bool,
  ariaDescription: PropTypes.string,
  tooltip: PropTypes.string,
  href: PropTypes.string,
  onClick: PropTypes.func,
  className: PropTypes.string,
};

export default MiniStat;
