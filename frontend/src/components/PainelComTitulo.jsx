// 📁 src/components/PainelComTitulo.jsx
import PropTypes from "prop-types";
import { motion, useReducedMotion } from "framer-motion";
import { useId, useMemo } from "react";

/**
 * PainelComTitulo (Premium)
 * - Header hero opcional (degradê 3 cores + overlays premium)
 * - Slots de ações (desktop/mobile) e "ministats" abaixo do header
 * - Card opcional para o corpo (padded) + rodapé opcional
 * - A11y: aria-labelledby/aria-describedby + aria-busy
 *
 * Backwards compatible:
 * - Mantém todos os props existentes e comportamento esperado
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
  variant = "default", // borda do cabeçalho quando não for hero
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
  const reactHeadingId = useId();
  const reactDescId = useId();

  const headingId = `pct_${reactHeadingId}`;
  const descId = `pct_${reactDescId}`;

  const HeadingTag = ["h1", "h2", "h3"].includes(as) ? as : "h1";
  const isCenter = align === "center";

  // Bordas do header quando NÃO estamos em modo hero
  const borderByVariant = {
    default: "border-zinc-200/80 dark:border-zinc-700/70",
    teal: "border-teal-700/60 dark:border-teal-400/40",
    violet: "border-violet-700/60 dark:border-violet-400/40",
    amber: "border-amber-700/60 dark:border-amber-400/40",
    orange: "border-orange-600/60 dark:border-orange-400/40",
    none: "border-transparent",
  };
  const headerBorder = borderByVariant[variant] || borderByVariant.default;

  // Gradientes 3 cores para o HeaderHero
  const heroGradients = {
    emerald: "from-emerald-950 via-teal-900 to-lime-800",
    indigo: "from-indigo-950 via-violet-900 to-fuchsia-800",
    cyan: "from-cyan-950 via-sky-900 to-blue-900",
    rose: "from-rose-950 via-red-900 to-orange-900",
    slate: "from-slate-950 via-zinc-900 to-stone-900",
    violet: "from-violet-950 via-fuchsia-900 to-pink-900",
    amber: "from-amber-950 via-orange-900 to-yellow-900",
    orange: "from-orange-950 via-amber-900 to-rose-900",
  };

  // Alturas e tamanhos padronizados
  const heroSizes = {
    sm: { padY: "py-4", title: "text-xl sm:text-2xl", sub: "text-xs sm:text-sm", icon: "w-6 h-6" },
    md: { padY: "py-6", title: "text-2xl sm:text-3xl", sub: "text-sm sm:text-base", icon: "w-7 h-7" },
    lg: { padY: "py-7", title: "text-3xl sm:text-4xl", sub: "text-base", icon: "w-8 h-8" },
  };
  const hs = heroSizes[heroSize] || heroSizes.md;

  const Section = animated ? motion.section : "section";
  const sectionAnimProps = animated
    ? {
        initial: { opacity: 0, y: reduceMotion ? 0 : 14 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: reduceMotion ? 0 : 0.35, ease: "easeOut" },
      }
    : {};

  const stickyClasses = useMemo(() => {
    if (!stickyHeader) return "";
    // sticky “premium”: blur + borda suave + sombra leve ao colar
    return "sticky top-0 z-20 supports-[backdrop-filter]:backdrop-blur bg-white/60 dark:bg-zinc-950/45 border-b border-white/20 dark:border-white/10";
  }, [stickyHeader]);

  const headerWrapperClasses = useMemo(() => {
    if (headerHero) {
      return [
        stickyClasses,
        "rounded-3xl overflow-hidden mb-5",
        "ring-1 ring-black/5 dark:ring-white/10",
        "shadow-[0_18px_50px_-30px_rgba(0,0,0,0.45)]",
      ]
        .filter(Boolean)
        .join(" ");
    }
    return [
      stickyClasses,
      "mb-6 border-b pb-3",
      headerBorder,
      isCenter ? "text-center" : "",
      headerClassName,
    ]
      .filter(Boolean)
      .join(" ");
  }, [headerHero, stickyClasses, headerBorder, isCenter, headerClassName]);

  const headerInnerClasses = useMemo(() => {
    if (!headerHero) return "";
    const grad = heroGradients[heroVariant] || heroGradients.indigo;
    return [
      "relative",
      "px-4 sm:px-6",
      hs.padY,
      "text-white bg-gradient-to-br",
      grad,
    ].join(" ");
  }, [headerHero, heroVariant, hs.padY]);

  const bodyCardClasses = useMemo(() => {
    const base =
      "rounded-2xl bg-white/90 dark:bg-zinc-900/70 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_14px_40px_-28px_rgba(0,0,0,0.55)]";
    const pad = padded ? "p-5 sm:p-6" : "p-0";
    return [base, pad, bodyClassName].filter(Boolean).join(" ");
  }, [padded, bodyClassName]);

  const actionWrapClasses = useMemo(() => {
    return bleedActions
      ? "flex items-center gap-2"
      : "flex items-center gap-2 rounded-2xl bg-white/10 ring-1 ring-white/15 px-2 py-1";
  }, [bleedActions]);

  return (
    <Section
      {...sectionAnimProps}
      id={id}
      aria-labelledby={headingId}
      aria-describedby={subtitulo ? descId : undefined}
      aria-busy={loading ? "true" : "false"}
      role="region"
      className={[
        "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Header */}
      <div className={headerWrapperClasses}>
        {headerHero ? (
          <>
            <div className={headerInnerClasses}>
              {/* overlays premium (não pesam e ficam lindos) */}
              <div aria-hidden="true" className="absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_20%,rgba(255,255,255,0.16),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_80%_15%,rgba(255,255,255,0.10),transparent_55%)]" />
                <div className="absolute inset-0 opacity-[0.14] bg-[linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:24px_24px]" />
              </div>

              <div
                className={[
                  "relative flex gap-3",
                  isCenter ? "items-center justify-center" : "items-start justify-between",
                ].join(" ")}
              >
                <div className={`flex items-start ${isCenter ? "justify-center" : ""} gap-3 min-w-0`}>
                  {Icon && !loading && (
                    <div className="shrink-0 mt-0.5">
                      <div className="rounded-2xl bg-white/10 ring-1 ring-white/15 p-2 shadow-sm">
                        <Icon
                          aria-hidden="true"
                          className={[
                            hs.icon,
                            "text-white",
                            iconClassName,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        />
                      </div>
                    </div>
                  )}

                  <div className={isCenter ? "text-center" : "text-left min-w-0"}>
                    {loading ? (
                      <>
                        <div className="h-8 w-56 bg-white/20 rounded-xl animate-pulse" />
                        {subtitulo && (
                          <div className="mt-2 h-4 w-72 bg-white/15 rounded-lg animate-pulse mx-auto md:mx-0" />
                        )}
                      </>
                    ) : (
                      <>
                        <HeadingTag
                          id={headingId}
                          className={[
                            hs.title,
                            "font-extrabold tracking-tight",
                            "drop-shadow-[0_10px_28px_rgba(0,0,0,0.35)]",
                            "truncate",
                          ].join(" ")}
                        >
                          {titulo}
                        </HeadingTag>

                        {subtitulo && (
                          <p
                            id={descId}
                            className={[
                              hs.sub,
                              "text-white/90 mt-1 leading-relaxed",
                              isCenter ? "mx-auto" : "",
                            ].join(" ")}
                          >
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
                      <div className="h-10 w-28 bg-white/20 rounded-xl animate-pulse" />
                      <div className="h-10 w-24 bg-white/20 rounded-xl animate-pulse" />
                    </>
                  ) : (
                    actions && <div className={actionWrapClasses}>{actions}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Minis (stats/atalhos) logo abaixo do hero */}
            {minis && (
              <div
                className={[
                  "px-4 sm:px-6 py-3",
                  "bg-white/70 dark:bg-zinc-950/35",
                  "backdrop-blur supports-[backdrop-filter]:backdrop-blur",
                  "border-t border-white/20 dark:border-white/10",
                ].join(" ")}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                  {minis}
                </div>
              </div>
            )}

            {/* Ações mobile */}
            {!loading && actions && (
              <div
                className={[
                  "px-4 sm:px-6 pb-3 md:hidden",
                  minis ? "pt-0" : "pt-3",
                  isCenter ? "flex justify-center" : "",
                ].join(" ")}
              >
                <div className={actionWrapClasses}>{actions}</div>
              </div>
            )}
          </>
        ) : (
          // Header simples (sem hero)
          <div
            className={[
              "flex gap-3",
              isCenter ? "items-center justify-center" : "items-start justify-between",
              headerClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className={`flex items-start ${isCenter ? "justify-center" : ""} gap-2 min-w-0`}>
              {Icon && !loading && (
                <div className="shrink-0 mt-0.5">
                  <div className="rounded-xl bg-zinc-900/5 dark:bg-white/10 ring-1 ring-black/5 dark:ring-white/10 p-2">
                    <Icon
                      aria-hidden="true"
                      className={["w-5 h-5 text-zinc-900 dark:text-white", iconClassName].filter(Boolean).join(" ")}
                    />
                  </div>
                </div>
              )}

              <div className={isCenter ? "text-center" : "text-left min-w-0"}>
                {loading ? (
                  <>
                    <div className="h-7 w-52 bg-zinc-200/70 dark:bg-zinc-800/70 rounded-xl animate-pulse" />
                    {subtitulo && (
                      <div className="mt-2 h-4 w-72 bg-zinc-100/70 dark:bg-zinc-900/60 rounded-lg animate-pulse mx-auto md:mx-0" />
                    )}
                  </>
                ) : (
                  <>
                    <HeadingTag
                      id={headingId}
                      className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white truncate"
                      title={typeof titulo === "string" ? titulo : undefined}
                    >
                      {titulo}
                    </HeadingTag>
                    {subtitulo && (
                      <p id={descId} className="text-sm text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
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
                  <div className="h-9 w-24 bg-zinc-200/70 dark:bg-zinc-800/70 rounded-xl animate-pulse" />
                  <div className="h-9 w-20 bg-zinc-200/70 dark:bg-zinc-800/70 rounded-xl animate-pulse" />
                </>
              ) : (
                actions && <div className="flex items-center gap-2">{actions}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Corpo */}
      {card ? (
        <div className={bodyCardClasses}>
          {loading ? (
            <div className="space-y-3">
              <div className="h-5 w-2/3 bg-zinc-200/70 dark:bg-zinc-800/70 rounded-lg animate-pulse" />
              <div className="h-5 w-1/2 bg-zinc-200/70 dark:bg-zinc-800/70 rounded-lg animate-pulse" />
              <div className="h-5 w-5/6 bg-zinc-200/70 dark:bg-zinc-800/70 rounded-lg animate-pulse" />
            </div>
          ) : (
            children
          )}
        </div>
      ) : (
        <div className={bodyClassName}>
          {loading ? (
            <div className="space-y-3">
              <div className="h-5 w-2/3 bg-zinc-200/70 dark:bg-zinc-800/70 rounded-lg animate-pulse" />
              <div className="h-5 w-1/2 bg-zinc-200/70 dark:bg-zinc-800/70 rounded-lg animate-pulse" />
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
