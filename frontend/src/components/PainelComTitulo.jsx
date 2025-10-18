// 📁 src/components/PainelComTitulo.jsx
import PropTypes from "prop-types";
import { motion, useReducedMotion } from "framer-motion";
import { useId, useMemo } from "react";

/**
 * PainelComTitulo
 * - Header hero opcional (degradê 3 cores e altura padronizada)
 * - Slots de ações (desktop/mobile) e "ministats" abaixo do header
 * - Card opcional para o corpo (padded) + rodapé opcional
 * - A11y: aria-labelledby/aria-describedby
 *
 * Novos props (backwards compatible):
 * - headerHero?: boolean (header em degradê 3 cores)
 * - heroVariant?: 'emerald'|'indigo'|'cyan'|'rose'|'slate'|'violet'|'amber'|'orange'
 * - heroSize?: 'sm'|'md'|'lg' (altura e escala do título)
 * - minis?: React.Node (renderiza "ministats" logo abaixo do header)
 * - bleedActions?: boolean (ações ficam “soltas” no header sem bordas extras)
 */
export default function PainelComTitulo({
  titulo,
  subtitulo,
  children,
  icon: Icon,
  actions,
  footer,
  minis,
  align = "left",
  as = "h1",
  variant = "default", // mantém como borda do cabeçalho quando não for hero
  card = true,
  padded = true,
  stickyHeader = false,
  loading = false,
  animated = true,
  headerHero = false,
  heroVariant = "indigo",
  heroSize = "md",
  bleedActions = true,
  id,
  className = "",
  headerClassName = "",
  bodyClassName = "",
  footerClassName = "",
  iconClassName = "",
}) {
  const reduceMotion = useReducedMotion();
  const headingId = useId();
  const descId = useId();
  const HeadingTag = ["h1", "h2", "h3"].includes(as) ? as : "h1";
  const isCenter = align === "center";

  // Bordas do header quando NÃO estamos em modo hero
  const borderByVariant = {
    default: "border-gray-300 dark:border-zinc-600",
    teal: "border-teal-700",
    violet: "border-violet-700",
    amber: "border-amber-700",
    orange: "border-orange-600",
    none: "border-transparent",
  };
  const headerBorder = borderByVariant[variant] || borderByVariant.default;

  // Gradientes 3 cores para o HeaderHero
  const heroGradients = {
    emerald: "from-emerald-900 via-teal-800 to-lime-700",
    indigo: "from-indigo-900 via-violet-800 to-fuchsia-700",
    cyan: "from-cyan-900 via-sky-800 to-blue-700",
    rose: "from-rose-900 via-red-800 to-orange-700",
    slate: "from-slate-900 via-zinc-800 to-stone-700",
    violet: "from-violet-900 via-fuchsia-800 to-pink-700",
    amber: "from-amber-900 via-orange-800 to-yellow-700",
    orange: "from-orange-900 via-amber-800 to-rose-700",
  };

  // Alturas e tamanhos padronizados para manter harmonia do sistema
  const heroSizes = {
    sm: { padY: "py-4", title: "text-xl sm:text-2xl", sub: "text-xs sm:text-sm" },
    md: { padY: "py-5", title: "text-2xl sm:text-3xl", sub: "text-sm" },
    lg: { padY: "py-6", title: "text-3xl sm:text-4xl", sub: "text-base" },
  };
  const hs = heroSizes[heroSize] || heroSizes.md;

  const Section = animated ? motion.section : "section";
  const sectionAnimProps = animated
    ? {
        initial: { opacity: 0, y: reduceMotion ? 0 : 18 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: reduceMotion ? 0 : 0.35 },
      }
    : {};

  const headerWrapperClasses = useMemo(() => {
    const sticky = stickyHeader
      ? "sticky top-0 z-10 supports-[backdrop-filter]:backdrop-blur"
      : "";
    if (headerHero) {
      return [
        sticky,
        "rounded-2xl overflow-hidden mb-4",
        // no hero, o fundo é o degradê; sem borda inferior
      ]
        .filter(Boolean)
        .join(" ");
    }
    // header padrão com borda inferior
    return [
      sticky,
      "mb-6 border-b pb-2",
      headerBorder,
      isCenter ? "text-center" : "",
      headerClassName,
    ]
      .filter(Boolean)
      .join(" ");
  }, [headerHero, stickyHeader, headerBorder, isCenter, headerClassName]);

  const headerInnerClasses = useMemo(() => {
    if (!headerHero) return "";
    const grad = heroGradients[heroVariant] || heroGradients.indigo;
    return `px-4 sm:px-6 ${hs.padY} text-white bg-gradient-to-br ${grad}`;
  }, [headerHero, heroVariant, hs.padY]);

  return (
    <Section
      {...sectionAnimProps}
      id={id}
      aria-labelledby={headingId}
      aria-describedby={subtitulo ? descId : undefined}
      role="region"
      className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 ${className}`}
    >
      {/* Header */}
      <div className={headerWrapperClasses}>
        {/* Quando hero: bloco com degradê e minis abaixo */}
        {headerHero ? (
          <>
            <div className={headerInnerClasses}>
              <div
                className={[
                  "flex gap-3",
                  isCenter ? "items-center justify-center" : "items-start justify-between",
                ].join(" ")}
              >
                <div className={`flex items-start ${isCenter ? "justify-center" : ""} gap-2 min-w-0`}>
                  {Icon && !loading && (
                    <Icon
                      aria-hidden="true"
                      className={["w-6 h-6 mt-0.5 shrink-0", bleedActions ? "" : "text-white/95", iconClassName].join(" ")}
                    />
                  )}
                  <div className={isCenter ? "text-center" : "text-left"}>
                    {loading ? (
                      <>
                        <div className="h-7 w-48 bg-white/20 rounded animate-pulse" />
                        {subtitulo && (
                          <div className="mt-2 h-4 w-64 bg-white/15 rounded animate-pulse mx-auto md:mx-0" />
                        )}
                      </>
                    ) : (
                      <>
                        <HeadingTag
                          id={headingId}
                          className={`${hs.title} font-extrabold tracking-tight`}
                        >
                          {titulo}
                        </HeadingTag>
                        {subtitulo && (
                          <p id={descId} className={`${hs.sub} text-white/90 mt-1`}>
                            {subtitulo}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Ações (desktop) */}
                <div className="hidden md:flex items-center gap-2">
                  {loading ? (
                    <>
                      <div className="h-10 w-28 bg-white/20 rounded animate-pulse" />
                      <div className="h-10 w-24 bg-white/20 rounded animate-pulse" />
                    </>
                  ) : (
                    actions && (
                      <div
                        className={
                          bleedActions
                            ? "flex items-center gap-2"
                            : "flex items-center gap-2 bg-white/10 rounded-xl p-1"
                        }
                      >
                        {actions}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Minis (stats/atalhos) logo abaixo do hero */}
            {minis && (
              <div className="px-4 sm:px-6 py-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {minis}
              </div>
            )}

            {/* Ações mobile */}
            {!loading && actions && (
              <div className={`px-4 sm:px-6 pb-3 md:hidden ${isCenter ? "flex justify-center" : ""}`}>
                {actions}
              </div>
            )}
          </>
        ) : (
          // Header "simples" (sem hero)
          <div
            className={[
              "flex gap-3",
              isCenter ? "items-center justify-center" : "items-start justify-between",
              headerClassName,
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
                    <HeadingTag id={headingId} className="text-2xl font-bold text-lousa dark:text-white">
                      {titulo}
                    </HeadingTag>
                    {subtitulo && (
                      <p id={descId} className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {subtitulo}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Ações (desktop) */}
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

            {/* Minis só fazem sentido visualmente no hero; no modo simples, prefira renderizar fora */}
          </div>
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
      {footer && <div className={`mt-4 ${footerClassName}`}>{footer}</div>}
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
  minis: PropTypes.node,
  align: PropTypes.oneOf(["left", "center"]),
  as: PropTypes.oneOf(["h1", "h2", "h3"]),
  variant: PropTypes.oneOf(["default", "teal", "violet", "amber", "orange", "none"]),
  card: PropTypes.bool,
  padded: PropTypes.bool,
  stickyHeader: PropTypes.bool,
  loading: PropTypes.bool,
  animated: PropTypes.bool,
  headerHero: PropTypes.bool,
  heroVariant: PropTypes.oneOf(["emerald", "indigo", "cyan", "rose", "slate", "violet", "amber", "orange"]),
  heroSize: PropTypes.oneOf(["sm", "md", "lg"]),
  bleedActions: PropTypes.bool,
  id: PropTypes.string,
  className: PropTypes.string,
  headerClassName: PropTypes.string,
  bodyClassName: PropTypes.string,
  footerClassName: PropTypes.string,
  iconClassName: PropTypes.string,
};
