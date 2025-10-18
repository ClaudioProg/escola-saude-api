// 📁 src/components/ui/Card.jsx
import PropTypes from "prop-types";
import { forwardRef, useMemo } from "react";

/**
 * Card genérico e moderno.
 * - Responsivo e acessível (role="article" + focus dentro/fora).
 * - Variantes: default | outlined | muted | success | accent (gradiente 3 cores).
 * - Accent personalizável: emerald | violet | amber | rose | teal | indigo | petroleo | orange | sky | lousa.
 * - Header/Footer slots OU título/subtítulo/ícone embutidos.
 * - Clicável (href/onClick) com foco visível; shape (rounded/pill/square); elevação e hover.
 * - Loading skeleton opcional (mantém layout).
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

    // Header embutido (opcional)
    title,
    subtitle,
    icon = null,
    header,                    // ReactNode: se passado, substitui title/subtitle/icon

    // Footer embutido (opcional)
    footer,                    // ReactNode com ações/botões/links

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
  const isInteractive = Boolean(href || onClick);
  const Tag =
    as ||
    (href ? "a" : onClick ? "button" : "div");

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

  // Variantes base
  const variants = {
    default: "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
    outlined:
      "bg-transparent border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100",
    muted:
      "bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-100",
    success:
      "bg-verde-900 text-white dark:bg-verde-900/90",
    // Accent usa gradiente 3 cores + texto claro
    accent: "text-white bg-gradient-to-br",
  };

  // Gradientes 3 cores por acento
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

  const interactivity =
    isInteractive
      ? "cursor-pointer active:scale-[0.995] transition"
      : "transition";

  const hoverCls =
    hoverable
      ? isInteractive
        ? "hover:translate-y-[1px]"
        : "hover:shadow-lg"
      : "";

  const clickableProps = href
    ? {
        href,
        target,
        rel: rel ?? (target === "_blank" ? "noopener noreferrer" : undefined),
        role: "article",
        "aria-label": ariaLabel,
      }
    : onClick
    ? {
        type: "button",
        onClick,
        role: "article",
        "aria-label": ariaLabel,
      }
    : {
        role: "article",
        "aria-label": ariaLabel,
      };

  return (
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
        "w-full",
        padding,
        className,
      ].join(" ")}
      {...clickableProps}
      {...rest}
    >
      {/* Header */}
      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-2/5 bg-white/30 dark:bg-white/10 rounded" />
          <div className="h-4 w-3/5 bg-white/25 dark:bg-white/10 rounded" />
          <div className="h-32 w-full bg-black/5 dark:bg-white/5 rounded-lg" />
        </div>
      ) : (
        <>
          {(header || title || subtitle || icon) && (
            <div className="flex items-start gap-3 mb-3">
              {icon && (
                <span
                  aria-hidden
                  className={
                    variant === "accent"
                      ? "text-white/95"
                      : "text-gray-700 dark:text-gray-200"
                  }
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
          )}

          {/* Conteúdo */}
          <div className="contents">{children}</div>

          {/* Footer */}
          {footer && (
            <div
              className={
                variant === "accent"
                  ? "mt-4 pt-3 border-t border-white/20"
                  : "mt-4 pt-3 border-t border-gray-200 dark:border-gray-700"
              }
            >
              {footer}
            </div>
          )}
        </>
      )}
    </Tag>
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
  /** Built-in header fields (ignored if header is provided) */
  title: PropTypes.string,
  subtitle: PropTypes.string,
  icon: PropTypes.node,
  header: PropTypes.node,
  /** Footer slot */
  footer: PropTypes.node,
  /** Make whole card interactive */
  href: PropTypes.string,
  target: PropTypes.string,
  rel: PropTypes.string,
  onClick: PropTypes.func,
  ariaLabel: PropTypes.string,
  /** Custom tag (e.g. "section") */
  as: PropTypes.string,
};

export default Card;
