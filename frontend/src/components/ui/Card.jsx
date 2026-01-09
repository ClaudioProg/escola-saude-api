// 📁 src/components/ui/Card.jsx
import PropTypes from "prop-types";
import { forwardRef, useMemo } from "react";

/**
 * Card genérico, moderno e acessível.
 * - Variantes: default | outlined | muted | success | accent (gradiente 3 cores).
 * - Accent: emerald | violet | amber | rose | teal | indigo | petroleo | orange | sky | lousa.
 * - Header/Footer slots OU título/subtítulo/ícone embutidos (+ headerActions).
 * - Status/badge/stripe opcionais; mídia de cabeçalho (headerMedia).
 * - Interativo (href/onClick/as), com foco visível, disabled e hover.
 * - compact, highlight (borda gradiente), divider opcional e loading skeleton inteligente.
 */

const Card = forwardRef(function Card(
  {
    children,
    className = "",
    variant = "default",
    accent = "emerald",
    padding = "p-4",
    elevation = "md",          // none | sm | md | lg
    shape = "rounded",         // rounded | pill | square
    hoverable = true,
    loading = false,
    compact = false,           // reduz paddings/typography
    highlight = false,         // borda gradiente externa
    divider = true,            // mostra divisor do footer
    disabled = false,          // para <a>/<button> interativo

    // Header embutido (opcional)
    title,
    subtitle,
    icon = null,
    header,                    // ReactNode (substitui title/subtitle/icon)
    headerActions,             // Ações no canto direito do header
    headerMedia,               // ReactNode (imagem/cover/banner) acima do header

    // Badge/Status (opcionais)
    badge,                     // string|node (canto superior esquerdo)
    status,                    // "success" | "warning" | "danger" | "info" | string (gera stripe)
    statusPosition = "top",    // "top" | "left"

    // Footer embutido (opcional)
    footer,

    // Tornar o card interativo
    href,
    target,
    rel,
    onClick,
    ariaLabel,

    as,                        // força a tag (ex.: "section")
    ...rest
  },
  ref
) {
  const isInteractive = !!(href || onClick);
  const Tag = as || (href ? "a" : onClick ? "button" : "div");

  const shapes = {
    rounded: "rounded-2xl",
    pill: "rounded-[2rem]",
    square: "rounded-lg",
  };

  const elevations = {
    none: "",
    sm: "shadow-sm",
    md: "shadow-md",
    lg: "shadow-lg",
  };

  const variants = {
    default: "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
    outlined: "bg-transparent border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100",
    muted: "bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-100",
    success: "bg-emerald-900 text-white dark:bg-emerald-900/90",
    accent: "text-white bg-gradient-to-br",
  };

  const accents = useMemo(
    () => ({
      emerald: "from-emerald-900 via-emerald-700 to-emerald-600",
      violet: "from-violet-900 via-violet-700 to-violet-600",
      amber: "from-amber-900 via-amber-700 to-amber-600",
      rose: "from-rose-900 via-rose-700 to-rose-600",
      teal: "from-teal-900 via-teal-700 to-teal-600",
      indigo: "from-indigo-900 via-indigo-800 to-indigo-700",
      petroleo: "from-slate-900 via-teal-900 to-slate-800",
      orange: "from-orange-900 via-orange-800 to-orange-700",
      sky: "from-sky-900 via-sky-700 to-sky-600",
      lousa: "from-[#0f2c1f] via-[#114b2d] to-[#166534]", // verde lousa
    }),
    []
  );

  const accentGrad = accents[accent] ?? accents.emerald;

  const focusRing =
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-300/80 dark:focus-visible:ring-emerald-200/60";

  const interactivity = hoverable ? (isInteractive ? "cursor-pointer active:scale-[0.995] transition" : "transition") : "transition";
  const hoverCls = hoverable ? (isInteractive ? "hover:translate-y-[1px]" : "hover:shadow-lg") : "";

  const disabledInteractivity = disabled ? "opacity-60 pointer-events-none" : "";
  const compactPad = compact ? (padding === "p-4" ? "p-3 sm:p-4" : padding) : padding;

  // Borda gradiente externa
  const highlightWrap = highlight ? "p-[1px] bg-gradient-to-br from-amber-400 via-rose-500 to-indigo-500 rounded-[inherit]" : "";

  // Props de acessibilidade/semântica
  const clickableProps = href
    ? {
        href,
        target,
        rel: rel ?? (target === "_blank" ? "noopener noreferrer" : undefined),
        role: "article",
        "aria-label": ariaLabel,
        "aria-disabled": disabled || undefined,
        tabIndex: disabled ? -1 : undefined,
      }
    : onClick
    ? {
        type: "button",
        onClick,
        role: "article",
        "aria-label": ariaLabel,
        "aria-disabled": disabled,
        disabled,
      }
    : {
        role: "article",
        "aria-label": ariaLabel,
      };

  // Stripe/status (top/left)
  const statusColor =
    status === "success"
      ? "bg-emerald-500"
      : status === "warning"
      ? "bg-amber-500"
      : status === "danger"
      ? "bg-rose-500"
      : status === "info"
      ? "bg-sky-500"
      : typeof status === "string"
      ? "bg-gray-400"
      : null;

  return (
    <div className={[shapes[shape], highlightWrap].filter(Boolean).join(" ")}>
      <Tag
        ref={ref}
        className={[
          shapes[shape],
          variants[variant] ?? variants.default,
          variant === "accent" ? accentGrad : "",
          elevations[elevation],
          interactivity,
          focusRing,
          hoverCls,
          disabledInteractivity,
          "w-full relative overflow-hidden",
          compactPad,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...clickableProps}
        {...rest}
      >
        {/* Stripe/status */}
        {statusColor && statusPosition === "top" && (
          <span
            aria-hidden="true"
            className={`absolute top-0 left-0 right-0 h-1 ${statusColor}`}
          />
        )}
        {statusColor && statusPosition === "left" && (
          <span
            aria-hidden="true"
            className={`absolute top-0 bottom-0 left-0 w-1 ${statusColor}`}
          />
        )}

        {/* Badge */}
        {badge && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-black/10 dark:bg-white/10 backdrop-blur text-white">
              {badge}
            </span>
          </div>
        )}

        {/* Mídia do cabeçalho (cover/banner) */}
        {headerMedia && (
          <div className={`-mx-4 mb-3 ${compact ? "sm:-mx-4" : ""}`}>
            <div className="overflow-hidden rounded-t-[inherit]">
              {headerMedia}
            </div>
          </div>
        )}

        {/* Conteúdo principal */}
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-2/5 bg-black/10 dark:bg-white/10 rounded" />
            <div className="h-4 w-3/5 bg-black/10 dark:bg-white/10 rounded" />
            <div className="h-32 w-full bg-black/5 dark:bg-white/5 rounded-lg" />
          </div>
        ) : (
          <>
            {(header || title || subtitle || icon || headerActions) && (
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3 min-w-0">
                  {icon && (
                    <span
                      aria-hidden
                      className={variant === "accent" ? "text-white/95" : "text-gray-700 dark:text-gray-200"}
                    >
                      {icon}
                    </span>
                  )}

                  {header ? (
                    header
                  ) : (
                    <div className="min-w-0">
                      {title && (
                        <h3
                          className={
                            variant === "accent"
                              ? "text-base sm:text-lg font-semibold text-white"
                              : "text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100"
                          }
                        >
                          {title}
                        </h3>
                      )}
                      {subtitle && (
                        <p
                          className={
                            variant === "accent"
                              ? "text-sm text-white/90"
                              : "text-sm text-gray-600 dark:text-gray-300"
                          }
                        >
                          {subtitle}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {headerActions && (
                  <div className="shrink-0">{headerActions}</div>
                )}
              </div>
            )}

            {/* Body */}
            <div className="contents">{children}</div>

            {/* Footer */}
            {footer && (
              <div
                className={[
                  "mt-4 pt-3",
                  divider
                    ? variant === "accent"
                      ? "border-t border-white/20"
                      : "border-t border-gray-200 dark:border-gray-700"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {footer}
              </div>
            )}
          </>
        )}
      </Tag>
    </div>
  );
});

Card.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  /** Visual style of the card */
  variant: PropTypes.oneOf(["default", "outlined", "muted", "success", "accent"]),
  /** Accent gradient when variant==="accent" */
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
  /** Tailwind padding classes (e.g. p-4, p-6) */
  padding: PropTypes.string,
  /** Elevation (shadow) */
  elevation: PropTypes.oneOf(["none", "sm", "md", "lg"]),
  /** Border radius style */
  shape: PropTypes.oneOf(["rounded", "pill", "square"]),
  /** Apply subtle hover effect */
  hoverable: PropTypes.bool,
  /** Skeleton loading state */
  loading: PropTypes.bool,
  /** Dense layout */
  compact: PropTypes.bool,
  /** Outer gradient border */
  highlight: PropTypes.bool,
  /** Show footer divider */
  divider: PropTypes.bool,
  /** Built-in header fields (ignored if header is provided) */
  title: PropTypes.string,
  subtitle: PropTypes.string,
  icon: PropTypes.node,
  header: PropTypes.node,
  headerActions: PropTypes.node,
  headerMedia: PropTypes.node,
  /** Badge/Status */
  badge: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  status: PropTypes.oneOfType([
    PropTypes.oneOf(["success", "warning", "danger", "info"]),
    PropTypes.string,
  ]),
  statusPosition: PropTypes.oneOf(["top", "left"]),
  /** Footer slot */
  footer: PropTypes.node,
  /** Make whole card interactive */
  href: PropTypes.string,
  target: PropTypes.string,
  rel: PropTypes.string,
  onClick: PropTypes.func,
  ariaLabel: PropTypes.string,
  /** Disabled for interactive cards */
  disabled: PropTypes.bool,
  /** Custom tag (e.g. "section") */
  as: PropTypes.string,
};

export default Card;
