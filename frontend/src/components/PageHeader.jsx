// 📁 src/components/PageHeader.jsx
import { motion } from "framer-motion";
import PropTypes from "prop-types";
import { useId } from "react";

/**
 * PageHeader
 * Props (compatíveis + extras):
 * - title: string (obrigatório)
 * - icon: React component (ex.: BookOpen, CalendarDays, etc.)
 * - subtitle: string | ReactNode (opcional)
 * - actions: ReactNode (opcional) — botões/links à direita
 * - breadcrumbs: ReactNode (opcional) — trilha acima do título
 * - align: "center" | "left" (default: "center")
 * - as: "h1" | "h2" | "h3" (default: "h1")
 * - variant: "petroleo" | "violeta" | "dourado" | "laranja" | "esmeralda" | "cinza"
 * - gradient: boolean (default: true) — aplica gradiente fino
 * - loading: boolean (mostrar skeleton)
 * - sticky: boolean (fixa no topo com blur) — default: false
 * - compact: boolean (reduz paddings) — default: false
 * - printHidden: boolean (esconde na impressão) — default: true
 * - className: string extra (opcional)
 * - iconClassName: string extra para o ícone (opcional)
 */
export default function PageHeader({
  title,
  icon: Icon,
  subtitle,
  actions,
  breadcrumbs,
  align = "center",
  as = "h1",
  variant = "petroleo",
  gradient = true,
  loading = false,
  sticky = false,
  compact = false,
  printHidden = true,
  className = "",
  iconClassName = "",
}) {
  const variants = {
    petroleo: "from-teal-800 to-teal-700",
    violeta: "from-violet-700 to-violet-600",
    dourado: "from-amber-700 to-amber-600",
    laranja: "from-orange-700 to-orange-600",
    esmeralda: "from-emerald-700 to-emerald-600",
    cinza: "from-zinc-700 to-zinc-600",
  };

  const solid = {
    petroleo: "bg-teal-800",
    violeta: "bg-violet-700",
    dourado: "bg-amber-700",
    laranja: "bg-orange-700",
    esmeralda: "bg-emerald-700",
    cinza: "bg-zinc-700",
  };

  const palette = variants[variant] || variants.petroleo;
  const solidBg = solid[variant] || solid.petroleo;

  const headingId = useId();
  const subtitleId = useId();

  const HeadingTag = ["h1", "h2", "h3"].includes(as) ? as : "h1";
  const isCenter = align === "center";

  const basePad = compact ? "px-3 py-2 md:px-4 md:py-3" : "px-4 py-3 md:px-6 md:py-4";
  const layout =
    isCenter
      ? "flex items-center justify-center gap-3 text-center"
      : "flex items-center justify-between gap-3 text-left";

  const stickyCls = sticky
    ? "sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:backdrop-blur bg-white/0 dark:bg-black/0"
    : "";

  const containerPrint = printHidden ? "print:hidden" : "";

  const wrapperClasses = [
    "w-full mx-auto text-white rounded-xl shadow-sm",
    gradient ? `bg-gradient-to-r ${palette}` : solidBg,
    basePad,
    layout,
    className,
  ].join(" ");

  const titleBlock = (
    <div className={isCenter ? "flex items-center gap-3" : "flex items-center gap-3"}>
      {Icon && !loading && (
        <Icon
          size={22}
          aria-hidden="true"
          className={["shrink-0", iconClassName].join(" ").trim()}
        />
      )}

      {loading ? (
        <div className="flex flex-col items-start gap-1 w-[14rem]" aria-hidden="true">
          <div className="h-5 w-2/3 bg-white/40 rounded animate-pulse" />
          {subtitle && <div className="h-3 w-1/2 bg-white/30 rounded animate-pulse" />}
        </div>
      ) : (
        <div className={isCenter ? "text-center" : "text-left"}>
          <HeadingTag
            id={headingId}
            className="text-lg md:text-xl font-semibold leading-none"
            aria-describedby={subtitle ? subtitleId : undefined}
          >
            {title}
          </HeadingTag>
          {subtitle ? (
            <p id={subtitleId} className="mt-1 text-xs md:text-sm text-white/90">
              {subtitle}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );

  const rightBlock = loading ? (
    <div className="hidden md:flex items-center gap-2" aria-hidden="true">
      <div className="h-8 w-24 bg-white/30 rounded animate-pulse" />
      <div className="h-8 w-20 bg-white/30 rounded animate-pulse" />
    </div>
  ) : (
    actions && <div className="hidden md:flex items-center gap-2">{actions}</div>
  );

  return (
    <motion.header
      aria-labelledby={headingId}
      role="region"
      aria-busy={loading ? "true" : "false"}
      aria-live="polite"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={[containerPrint, stickyCls].join(" ").trim()}
    >
      <div className="max-w-6xl mx-auto px-4 mt-4">
        {/* Breadcrumbs opcionais (fora do cartão colorido) */}
        {breadcrumbs ? (
          <div className="mb-2 text-gray-700 dark:text-gray-300">{breadcrumbs}</div>
        ) : null}

        <div className={wrapperClasses}>
          {isCenter ? (
            // Centro: actions abaixo no mobile
            <div className="w-full">
              <div className="flex items-center justify-center gap-3">{titleBlock}</div>
              {(!loading && actions) || loading ? (
                <div className="mt-3 flex items-center justify-center gap-2 md:hidden">
                  {loading ? (
                    <>
                      <div className="h-8 w-24 bg-white/30 rounded animate-pulse" />
                      <div className="h-8 w-20 bg-white/30 rounded animate-pulse" />
                    </>
                  ) : (
                    actions
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            // Esquerda: actions à direita (desktop), embaixo no mobile
            <>
              {titleBlock}
              {rightBlock}
              {actions && (
                <div className="mt-3 md:hidden w-full flex items-center justify-start gap-2">
                  {actions}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}

PageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.elementType,
  subtitle: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  actions: PropTypes.node,
  breadcrumbs: PropTypes.node,
  align: PropTypes.oneOf(["center", "left"]),
  as: PropTypes.oneOf(["h1", "h2", "h3"]),
  variant: PropTypes.oneOf(["petroleo", "violeta", "dourado", "laranja", "esmeralda", "cinza"]),
  gradient: PropTypes.bool,
  loading: PropTypes.bool,
  sticky: PropTypes.bool,
  compact: PropTypes.bool,
  printHidden: PropTypes.bool,
  className: PropTypes.string,
  iconClassName: PropTypes.string,
};
