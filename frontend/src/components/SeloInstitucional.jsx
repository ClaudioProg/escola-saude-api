import { memo, useMemo } from "react";
import PropTypes from "prop-types";

/**
 * SeloInstitucional
 * Assinatura visual institucional (não é hero)
 *
 * - Faixa superior com degradê
 * - Glow sutil
 * - Micro-identidade (dot + nome)
 * - Badge institucional opcional
 *
 * Uso:
 * <SeloInstitucional appName="Escola da Saúde" variant="saude" />
 */
function SeloInstitucional({
  appName = "Escola da Saúde",
  variant = "saude", // saude | residencia | petroleo | violet | amber | rose
  badgeText = "Plataforma Oficial",
  showBadge = true,
  showSubtitle = true,
  subtitle = "Secretaria Municipal de Saúde — Santos",

  className = "",

  // extras premium (opcionais)
  as = "section", // section | header | div
  align = "between", // between | start
  compact = false,
  glowStrength = "md", // sm | md | lg
  role = "banner",
  ariaLabel = "Identidade institucional da plataforma",
}) {
  const theme = useMemo(() => {
    const variants = {
      saude: {
        bar: "from-emerald-600 via-emerald-500 to-sky-500",
        glow: "from-emerald-500/40 via-sky-500/25 to-transparent",
        dot: "bg-emerald-500",
        ring: "ring-emerald-200/70 dark:ring-emerald-400/25",
        badge:
          "bg-emerald-50 text-emerald-800 border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-100 dark:border-emerald-800/40",
        title: "text-slate-900 dark:text-slate-100",
        sub: "text-slate-600 dark:text-slate-300",
      },
      residencia: {
        bar: "from-teal-600 via-sky-500 to-violet-500",
        glow: "from-teal-500/35 via-violet-500/25 to-transparent",
        dot: "bg-teal-500",
        ring: "ring-teal-200/70 dark:ring-teal-400/25",
        badge:
          "bg-teal-50 text-teal-800 border-teal-200/70 dark:bg-teal-950/40 dark:text-teal-100 dark:border-teal-800/40",
        title: "text-slate-900 dark:text-slate-100",
        sub: "text-slate-600 dark:text-slate-300",
      },
      petroleo: {
        bar: "from-slate-800 via-sky-700 to-emerald-600",
        glow: "from-sky-500/25 via-emerald-500/20 to-transparent",
        dot: "bg-sky-500",
        ring: "ring-sky-200/70 dark:ring-sky-400/25",
        badge:
          "bg-sky-50 text-sky-900 border-sky-200/70 dark:bg-sky-950/40 dark:text-sky-100 dark:border-sky-800/40",
        title: "text-slate-900 dark:text-slate-100",
        sub: "text-slate-600 dark:text-slate-300",
      },
      violet: {
        bar: "from-violet-700 via-fuchsia-600 to-sky-500",
        glow: "from-violet-500/35 via-sky-500/20 to-transparent",
        dot: "bg-violet-500",
        ring: "ring-violet-200/70 dark:ring-violet-400/25",
        badge:
          "bg-violet-50 text-violet-900 border-violet-200/70 dark:bg-violet-950/40 dark:text-violet-100 dark:border-violet-800/40",
        title: "text-slate-900 dark:text-slate-100",
        sub: "text-slate-600 dark:text-slate-300",
      },
      amber: {
        bar: "from-amber-600 via-orange-500 to-rose-500",
        glow: "from-amber-500/35 via-rose-500/20 to-transparent",
        dot: "bg-amber-500",
        ring: "ring-amber-200/70 dark:ring-amber-400/25",
        badge:
          "bg-amber-50 text-amber-900 border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800/40",
        title: "text-slate-900 dark:text-slate-100",
        sub: "text-slate-600 dark:text-slate-300",
      },
      rose: {
        bar: "from-rose-600 via-fuchsia-600 to-indigo-500",
        glow: "from-rose-500/35 via-indigo-500/20 to-transparent",
        dot: "bg-rose-500",
        ring: "ring-rose-200/70 dark:ring-rose-400/25",
        badge:
          "bg-rose-50 text-rose-900 border-rose-200/70 dark:bg-rose-950/40 dark:text-rose-100 dark:border-rose-800/40",
        title: "text-slate-900 dark:text-slate-100",
        sub: "text-slate-600 dark:text-slate-300",
      },
    };

    return variants[variant] ?? variants.saude;
  }, [variant]);

  const Tag = ["section", "header", "div"].includes(as) ? as : "section";

  const glowSize =
    glowStrength === "lg"
      ? "h-10 -top-3 blur-2xl"
      : glowStrength === "sm"
      ? "h-6 -top-1.5 blur-lg"
      : "h-8 -top-2 blur-xl";

  const padY = compact ? "py-2" : "py-3";
  const layout =
    align === "start"
      ? "justify-start"
      : "justify-between";

  return (
    <Tag className={`w-full ${className}`} role={role} aria-label={ariaLabel}>
      {/* faixa superior */}
      <div className="relative">
        <div className={`h-[3px] w-full bg-gradient-to-r ${theme.bar}`} />
        <div
          className={`pointer-events-none absolute inset-x-0 ${glowSize} bg-gradient-to-r ${theme.glow}`}
          aria-hidden="true"
        />
        {/* hairline extra (premium) */}
        <div className="h-px w-full bg-black/5 dark:bg-white/10" aria-hidden="true" />
      </div>

      {/* micro-identidade */}
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className={`flex flex-wrap items-center ${layout} gap-3 ${padY}`}>
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`h-2.5 w-2.5 rounded-full ${theme.dot} ring-4 ${theme.ring}`}
              aria-hidden="true"
            />
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2 min-w-0">
              <span className={`text-sm font-semibold ${theme.title} truncate`}>
                {appName}
              </span>

              {showSubtitle && (
                <span className={`hidden sm:inline text-xs ${theme.sub}`}>
                  {subtitle}
                </span>
              )}
            </div>
          </div>

          {showBadge && (
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur ${theme.badge}`}
              aria-label={badgeText}
              title={badgeText}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
              <span className="whitespace-nowrap">{badgeText}</span>
            </div>
          )}
        </div>
      </div>
    </Tag>
  );
}

SeloInstitucional.propTypes = {
  appName: PropTypes.string,
  variant: PropTypes.oneOf(["saude", "residencia", "petroleo", "violet", "amber", "rose"]),
  badgeText: PropTypes.string,
  showBadge: PropTypes.bool,
  showSubtitle: PropTypes.bool,
  subtitle: PropTypes.string,
  className: PropTypes.string,

  as: PropTypes.oneOf(["section", "header", "div"]),
  align: PropTypes.oneOf(["between", "start"]),
  compact: PropTypes.bool,
  glowStrength: PropTypes.oneOf(["sm", "md", "lg"]),
  role: PropTypes.string,
  ariaLabel: PropTypes.string,
};

export default memo(SeloInstitucional);
