// 📁 src/components/PainelComTitulo.jsx
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import { useId } from "react";

export default function PainelComTitulo({
  titulo,
  subtitulo,
  children,
  icon: Icon,
  actions,
  footer,
  align = "left",
  as = "h1",
  variant = "default", // "default" | "teal" | "violet" | "amber" | "orange" | "none"
  card = true,
  padded = true,
  stickyHeader = false,
  loading = false,
  animated = true,
  id,
  className = "",
  headerClassName = "",
  bodyClassName = "",
  footerClassName = "",
  iconClassName = "",
}) {
  const headingId = useId();
  const HeadingTag = ["h1", "h2", "h3"].includes(as) ? as : "h1";
  const isCenter = align === "center";

  const borderByVariant = {
    default: "border-gray-300 dark:border-zinc-600",
    teal: "border-teal-700",
    violet: "border-violet-700",
    amber: "border-amber-700",
    orange: "border-orange-600",
    none: "border-transparent",
  };
  const headerBorder = borderByVariant[variant] || borderByVariant.default;

  const Section = animated ? motion.section : "section";
  const sectionAnimProps = animated
    ? { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }
    : {};

  return (
    <Section
      {...sectionAnimProps}
      id={id}
      aria-labelledby={headingId}
      role="region"
      className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 ${className}`}
    >
      {/* Header */}
      <div
        className={[
          "mb-6 border-b pb-2",
          headerBorder,
          stickyHeader
            ? "sticky top-0 z-10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur supports-[backdrop-filter]:backdrop-blur"
            : "",
          isCenter ? "text-center" : "",
          headerClassName,
        ].join(" ")}
      >
        <div
          className={[
            "flex gap-3",
            isCenter ? "items-center justify-center" : "items-start justify-between",
          ].join(" ")}
        >
          <div className={`flex items-start ${isCenter ? "justify-center" : ""} gap-2`}>
            {Icon && !loading && (
              <Icon
                aria-hidden="true"
                className={["w-5 h-5 mt-0.5 shrink-0 text-lousa dark:text-white", iconClassName].join(" ")}
              />
            )}

            <div className={isCenter ? "text-center" : "text-left"}>
              {loading ? (
                <>
                  <div className="h-6 w-44 bg-gray-300/60 dark:bg-zinc-700/60 rounded animate-pulse" />
                  {subtitulo && (
                    <div className="mt-2 h-4 w-56 bg-gray-200/60 dark:bg-zinc-800/60 rounded animate-pulse mx-auto md:mx-0" />
                  )}
                </>
              ) : (
                <>
                  <HeadingTag
                    id={headingId}
                    className="text-2xl font-bold text-lousa dark:text-white"
                  >
                    {titulo}
                  </HeadingTag>
                  {subtitulo && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{subtitulo}</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Ações (lado direito no desktop; abaixo no mobile) */}
          <div className="hidden md:flex items-center gap-2">
            {loading ? (
              <>
                <div className="h-9 w-24 bg-gray-200/60 dark:bg-zinc-800/60 rounded animate-pulse" />
                <div className="h-9 w-20 bg-gray-200/60 dark:bg-zinc-800/60 rounded animate-pulse" />
              </>
            ) : (
              actions
            )}
          </div>
        </div>

        {/* Ações no mobile, abaixo do título */}
        {!loading && actions && (
          <div className={`mt-3 md:hidden ${isCenter ? "flex justify-center" : ""}`}>{actions}</div>
        )}
      </div>

      {/* Corpo */}
      {card ? (
        <div
          className={[
            "bg-white dark:bg-zinc-800 rounded-xl shadow",
            padded ? "p-6" : "p-0",
            bodyClassName,
          ].join(" ")}
        >
          {loading ? (
            <div className="space-y-3">
              <div className="h-5 w-2/3 bg-gray-200/70 dark:bg-zinc-700/70 rounded animate-pulse" />
              <div className="h-5 w-1/2 bg-gray-200/70 dark:bg-zinc-700/70 rounded animate-pulse" />
              <div className="h-5 w-5/6 bg-gray-200/70 dark:bg-zinc-700/70 rounded animate-pulse" />
            </div>
          ) : (
            children
          )}
        </div>
      ) : (
        <div className={bodyClassName}>
          {loading ? (
            <div className="space-y-3">
              <div className="h-5 w-2/3 bg-gray-200/70 dark:bg-zinc-700/70 rounded animate-pulse" />
              <div className="h-5 w-1/2 bg-gray-200/70 dark:bg-zinc-700/70 rounded animate-pulse" />
            </div>
          ) : (
            children
          )}
        </div>
      )}

      {/* Rodapé opcional */}
      {footer && (
        <div className={`mt-4 ${footerClassName}`}>
          {footer}
        </div>
      )}
    </Section>
  );
}

PainelComTitulo.propTypes = {
  titulo: PropTypes.string.isRequired,
  subtitulo: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  children: PropTypes.node.isRequired,
  icon: PropTypes.elementType,
  actions: PropTypes.node,
  footer: PropTypes.node,
  align: PropTypes.oneOf(["left", "center"]),
  as: PropTypes.oneOf(["h1", "h2", "h3"]),
  variant: PropTypes.oneOf(["default", "teal", "violet", "amber", "orange", "none"]),
  card: PropTypes.bool,
  padded: PropTypes.bool,
  stickyHeader: PropTypes.bool,
  loading: PropTypes.bool,
  animated: PropTypes.bool,
  id: PropTypes.string,
  className: PropTypes.string,
  headerClassName: PropTypes.string,
  bodyClassName: PropTypes.string,
  footerClassName: PropTypes.string,
  iconClassName: PropTypes.string,
};
