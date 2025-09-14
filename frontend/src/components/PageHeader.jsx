// 📁 src/components/PageHeader.jsx
import { motion } from "framer-motion";
import PropTypes from "prop-types";
import { useId } from "react";

/**
 * PageHeader
 * Props:
 * - title: string (obrigatório)
 * - icon: React component (ex.: BookOpen, CalendarDays, etc.)
 * - subtitle: string | ReactNode (opcional)
 * - actions: ReactNode (opcional) — botões/links à direita
 * - align: "center" | "left" (default: "center")
 * - as: "h1" | "h2" | "h3" (default: "h1")
 * - variant: "petroleo" | "violeta" | "dourado" | "laranja"
 * - loading: boolean (mostrar skeleton)
 * - className: string extra (opcional)
 * - iconClassName: string extra para o ícone (opcional)
 */
export default function PageHeader({
  title,
  icon: Icon,
  subtitle,
  actions,
  align = "center",
  as = "h1",
  variant = "petroleo",
  loading = false,
  className = "",
  iconClassName = "",
}) {
  const variants = {
    petroleo: "bg-teal-800",
    violeta: "bg-violet-700",
    dourado: "bg-amber-700",
    laranja: "bg-orange-700",
  };

  const bg = variants[variant] || variants.petroleo;
  const headingId = useId();

  const HeadingTag = ["h1", "h2", "h3"].includes(as) ? as : "h1";
  const isCenter = align === "center";

  const wrapperClasses = [
    "w-full mx-auto",
    "text-white rounded-xl shadow-sm",
    "px-4 py-3 md:px-6 md:py-4",
    isCenter
      ? "flex items-center justify-center gap-3 text-center"
      : "flex items-center justify-between gap-3 text-left",
    bg,
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
        <div className="flex flex-col items-start gap-1 w-[14rem]">
          <div className="h-5 w-2/3 bg-white/40 rounded animate-pulse" />
          {subtitle && <div className="h-3 w-1/2 bg-white/30 rounded animate-pulse" />}
        </div>
      ) : (
        <div className={isCenter ? "text-center" : "text-left"}>
          <HeadingTag id={headingId} className="text-lg md:text-xl font-semibold leading-none">
            {title}
          </HeadingTag>
          {subtitle ? (
            <p className="mt-1 text-xs md:text-sm text-white/90">{subtitle}</p>
          ) : null}
        </div>
      )}
    </div>
  );

  const rightBlock = loading ? (
    <div className="hidden md:flex items-center gap-2">
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
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="print:hidden"
    >
      <div className="max-w-6xl mx-auto px-4 mt-4">
        <div className={wrapperClasses}>
          {isCenter ? (
            // Centro: empilha actions embaixo no mobile
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
  align: PropTypes.oneOf(["center", "left"]),
  as: PropTypes.oneOf(["h1", "h2", "h3"]),
  variant: PropTypes.oneOf(["petroleo", "violeta", "dourado", "laranja"]),
  loading: PropTypes.bool,
  className: PropTypes.string,
  iconClassName: PropTypes.string,
};
