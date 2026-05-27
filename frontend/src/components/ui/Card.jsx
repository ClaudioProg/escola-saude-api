// ✅ src/components/ui/Card.jsx — v2.0
// Plataforma Escola da Saúde
//
// Card genérico oficial da plataforma.
//
// Revisão premium:
// - componente genérico de UI;
// - visual de alto nível como padrão estrutural;
// - acessibilidade para cards informativos e interativos;
// - mobile-first;
// - dark mode;
// - loading state consistente;
// - header, body, footer, badge, status stripe e mídia;
// - suporte a link ou botão sem duplicar contrato;
// - sem flexibilidade excessiva que prejudique semântica;
// - pronto para uso em todos os domínios da plataforma.

import PropTypes from "prop-types";
import { forwardRef } from "react";

const ACCENT_CLASSES = {
  emerald: "from-emerald-950 via-emerald-800 to-emerald-600",
  violet: "from-violet-950 via-violet-800 to-violet-600",
  amber: "from-amber-800 via-amber-600 to-yellow-500",
  rose: "from-rose-950 via-rose-800 to-rose-600",
  teal: "from-teal-950 via-teal-800 to-teal-600",
  indigo: "from-indigo-950 via-indigo-800 to-indigo-600",
  petroleo: "from-slate-950 via-cyan-950 to-slate-800",
  orange: "from-orange-950 via-orange-800 to-orange-600",
  sky: "from-sky-950 via-sky-800 to-sky-600",
  lousa: "from-[#0f2c1f] via-[#114b2d] to-[#166534]",
};

const VARIANT_CLASSES = {
  default:
    "border-slate-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100",
  outlined:
    "border-slate-300 bg-white/70 text-slate-950 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100",
  muted:
    "border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-100",
  success:
    "border-emerald-800/40 bg-emerald-950 text-white dark:border-emerald-700/50",
  accent:
    "border-white/10 bg-gradient-to-br text-white",
};

const ELEVATION_CLASSES = {
  none: "shadow-none",
  sm: "shadow-sm",
  md: "shadow-md shadow-slate-950/5",
  lg: "shadow-xl shadow-slate-950/10",
};

const SHAPE_CLASSES = {
  rounded: "rounded-3xl",
  pill: "rounded-[2rem]",
  square: "rounded-2xl",
};

const PADDING_CLASSES = {
  none: "p-0",
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

const STATUS_CLASSES = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-sky-500",
  neutral: "bg-slate-400",
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function getRel({ rel, target }) {
  if (rel) return rel;
  return target === "_blank" ? "noopener noreferrer" : undefined;
}

function resolveTag({ as, href, onClick }) {
  if (href) return "a";
  if (onClick) return "button";
  return as || "article";
}

function SkeletonContent({ variant }) {
  const shimmer = variant === "accent" || variant === "success"
    ? "bg-white/15"
    : "bg-slate-200/80 dark:bg-white/10";

  return (
    <div className="space-y-4" aria-hidden="true">
      <div className={classNames("h-5 w-2/5 animate-pulse rounded-xl", shimmer)} />
      <div className={classNames("h-4 w-3/5 animate-pulse rounded-xl", shimmer)} />
      <div className={classNames("h-32 w-full animate-pulse rounded-2xl", shimmer)} />
    </div>
  );
}

const Card = forwardRef(function Card(
  {
    children,
    className = "",
    variant = "default",
    accent = "emerald",
    padding = "md",
    elevation = "md",
    shape = "rounded",
    hoverable = true,
    loading = false,
    compact = false,
    highlight = false,
    divider = true,
    disabled = false,

    title,
    subtitle,
    icon = null,
    header = null,
    headerActions = null,
    headerMedia = null,

    badge = null,
    status = null,
    statusPosition = "top",

    footer = null,

    href,
    target,
    rel,
    onClick,
    ariaLabel,
    as,
    ...props
  },
  ref
) {
  const interactive = Boolean(href || onClick);
  const Tag = resolveTag({ as, href, onClick });

  const accentClass = ACCENT_CLASSES[accent] || ACCENT_CLASSES.emerald;
  const variantClass = VARIANT_CLASSES[variant] || VARIANT_CLASSES.default;
  const shapeClass = SHAPE_CLASSES[shape] || SHAPE_CLASSES.rounded;
  const elevationClass = ELEVATION_CLASSES[elevation] || ELEVATION_CLASSES.md;
  const paddingClass =
    compact && padding === "md"
      ? PADDING_CLASSES.sm
      : PADDING_CLASSES[padding] || PADDING_CLASSES.md;

  const statusClass =
    STATUS_CLASSES[status] ||
    (typeof status === "string" && status ? STATUS_CLASSES.neutral : "");

  const focusClass =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950";

  const interactiveClass = interactive
    ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
    : hoverable
      ? "transition hover:shadow-lg"
      : "transition";

  const disabledClass = disabled
    ? "pointer-events-none cursor-not-allowed opacity-60"
    : "";

  const content = (
    <Tag
      ref={ref}
      className={classNames(
        "relative w-full overflow-hidden border",
        shapeClass,
        variantClass,
        variant === "accent" && accentClass,
        elevationClass,
        interactiveClass,
        interactive && focusClass,
        disabledClass,
        paddingClass,
        className
      )}
      {...(href
        ? {
            href: disabled ? undefined : href,
            target,
            rel: getRel({ rel, target }),
            "aria-disabled": disabled || undefined,
            "aria-label": ariaLabel,
            tabIndex: disabled ? -1 : props.tabIndex,
          }
        : onClick
          ? {
              type: "button",
              onClick: disabled ? undefined : onClick,
              disabled,
              "aria-label": ariaLabel,
            }
          : {
              "aria-label": ariaLabel,
            })}
      {...props}
    >
      {statusClass && statusPosition === "top" && (
        <span
          aria-hidden="true"
          className={classNames("absolute inset-x-0 top-0 h-1", statusClass)}
        />
      )}

      {statusClass && statusPosition === "left" && (
        <span
          aria-hidden="true"
          className={classNames("absolute inset-y-0 left-0 w-1", statusClass)}
        />
      )}

      {badge && (
        <div className="absolute left-3 top-3 z-10">
          <span
            className={classNames(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black shadow-sm backdrop-blur",
              variant === "accent" || variant === "success"
                ? "bg-white/15 text-white ring-1 ring-white/20"
                : "bg-slate-950/80 text-white ring-1 ring-black/10 dark:bg-white/15 dark:ring-white/10"
            )}
          >
            {badge}
          </span>
        </div>
      )}

      {headerMedia && (
        <div
          className={classNames(
            "overflow-hidden",
            padding !== "none" && "-mx-4 -mt-4 mb-4 sm:-mx-5 sm:-mt-5",
            padding === "lg" && "-mx-5 -mt-5 sm:-mx-6 sm:-mt-6",
            shapeClass
          )}
        >
          {headerMedia}
        </div>
      )}

      {loading ? (
        <SkeletonContent variant={variant} />
      ) : (
        <>
          {(header || title || subtitle || icon || headerActions) && (
            <header className="mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                {icon && (
                  <span
                    className={classNames(
                      "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl",
                      variant === "accent" || variant === "success"
                        ? "bg-white/15 text-white ring-1 ring-white/20"
                        : "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
                    )}
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                )}

                {header ? (
                  <div className="min-w-0">{header}</div>
                ) : (
                  <div className="min-w-0">
                    {title && (
                      <h3
                        className={classNames(
                          "text-base font-black tracking-tight sm:text-lg",
                          variant === "accent" || variant === "success"
                            ? "text-white"
                            : "text-slate-950 dark:text-white"
                        )}
                      >
                        {title}
                      </h3>
                    )}

                    {subtitle && (
                      <p
                        className={classNames(
                          "mt-1 text-sm leading-relaxed",
                          variant === "accent" || variant === "success"
                            ? "text-white/85"
                            : "text-slate-500 dark:text-slate-400"
                        )}
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
            </header>
          )}

          <div>{children}</div>

          {footer && (
            <footer
              className={classNames(
                "mt-4 pt-4",
                divider &&
                  (variant === "accent" || variant === "success"
                    ? "border-t border-white/20"
                    : "border-t border-slate-200 dark:border-slate-800")
              )}
            >
              {footer}
            </footer>
          )}
        </>
      )}
    </Tag>
  );

  if (!highlight) {
    return content;
  }

  return (
    <div
      className={classNames(
        "rounded-[calc(1.5rem+1px)] bg-gradient-to-br from-amber-400 via-rose-500 to-indigo-500 p-[1px]",
        shape === "pill" && "rounded-[calc(2rem+1px)]",
        shape === "square" && "rounded-[calc(1rem+1px)]"
      )}
    >
      {content}
    </div>
  );
});

Card.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  variant: PropTypes.oneOf(["default", "outlined", "muted", "success", "accent"]),
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
  padding: PropTypes.oneOf(["none", "sm", "md", "lg"]),
  elevation: PropTypes.oneOf(["none", "sm", "md", "lg"]),
  shape: PropTypes.oneOf(["rounded", "pill", "square"]),
  hoverable: PropTypes.bool,
  loading: PropTypes.bool,
  compact: PropTypes.bool,
  highlight: PropTypes.bool,
  divider: PropTypes.bool,
  disabled: PropTypes.bool,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  icon: PropTypes.node,
  header: PropTypes.node,
  headerActions: PropTypes.node,
  headerMedia: PropTypes.node,
  badge: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  status: PropTypes.oneOf(["success", "warning", "danger", "info", "neutral"]),
  statusPosition: PropTypes.oneOf(["top", "left"]),
  footer: PropTypes.node,
  href: PropTypes.string,
  target: PropTypes.string,
  rel: PropTypes.string,
  onClick: PropTypes.func,
  ariaLabel: PropTypes.string,
  as: PropTypes.oneOf(["article", "section", "div"]),
};

export default Card;