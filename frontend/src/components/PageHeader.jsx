// 📁 src/components/PageHeader.jsx
import { motion } from "framer-motion";
import PropTypes from "prop-types";
import { useId, useMemo } from "react";

/**
 * PageHeader (premium)
 * - Mobile-first / PWA-friendly
 * - A11y: aria-labelledby/aria-describedby corretos, aria-live só quando necessário
 * - Sticky com glass effect real
 *
 * Props (compatíveis + extras):
 * - title: string (obrigatório)
 * - icon: React component (ex.: BookOpen, CalendarDays, etc.)
 * - subtitle: string | ReactNode (opcional)
 * - actions: ReactNode (opcional) — botões/links à direita
 * - breadcrumbs: ReactNode (opcional) — trilha acima do título
 * - align: "center" | "left" (default: "center")
 * - as: "h1" | "h2" | "h3" (default: "h1")
 * - variant: "petroleo" | "violeta" | "dourado" | "laranja" | "esmeralda" | "cinza"
 * - gradient: boolean (default: true)
 * - loading: boolean (mostrar skeleton)
 * - sticky: boolean (fixa no topo com blur)
 * - compact: boolean (reduz paddings)
 * - printHidden: boolean (esconde na impressão) — default: true
 * - className: string extra
 * - iconClassName: string extra para o ícone
 *
 * Extras (opcionais, não quebram compat):
 * - tone: "soft" | "solid" (default: "soft") — soft = gradiente, solid = cor chapada
 * - ring: boolean (default: true) — ring/borda sutil para “card premium”
 * - maxWidth: "max-w-6xl" | "max-w-7xl" | ... (default: max-w-6xl)
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

  // extras
  tone = "soft",
  ring = true,
  maxWidth = "max-w-6xl",
}) {
  const headingId = useId();
  const subtitleId = useId();

  const HeadingTag = ["h1", "h2", "h3"].includes(as) ? as : "h1";
  const isCenter = align === "center";

  const palettes = {
    petroleo: {
      grad: "from-teal-900 via-teal-800 to-cyan-700",
      solid: "bg-teal-800",
    },
    violeta: {
      grad: "from-violet-900 via-indigo-800 to-fuchsia-700",
      solid: "bg-violet-700",
    },
    dourado: {
      grad: "from-amber-900 via-orange-800 to-yellow-700",
      solid: "bg-amber-700",
    },
    laranja: {
      grad: "from-orange-900 via-orange-700 to-rose-600",
      solid: "bg-orange-700",
    },
    esmeralda: {
      grad: "from-emerald-900 via-emerald-700 to-teal-600",
      solid: "bg-emerald-700",
    },
    cinza: {
      grad: "from-zinc-900 via-slate-800 to-stone-700",
      solid: "bg-zinc-700",
    },
  };

  const palette = palettes[variant] || palettes.petroleo;

  const basePad = compact
    ? "px-3 py-2 md:px-4 md:py-3"
    : "px-4 py-3 md:px-6 md:py-4";

  // card look (premium)
  const ringCls = ring ? "ring-1 ring-black/5 dark:ring-white/10" : "";
  const surfaceCls =
    tone === "solid" || !gradient
      ? palette.solid
      : `bg-gradient-to-br ${palette.grad}`;

  // sticky “glass” real
  const stickyCls = sticky
    ? [
        "sticky top-0 z-30",
        "bg-white/70 dark:bg-zinc-950/60",
        "backdrop-blur supports-[backdrop-filter]:backdrop-blur",
        "border-b border-black/5 dark:border-white/10",
      ].join(" ")
    : "";

  const containerPrint = printHidden ? "print:hidden" : "";

  const wrapperClasses = useMemo(
    () =>
      [
        "w-full text-white rounded-2xl shadow-sm overflow-hidden",
        ringCls,
        surfaceCls,
        basePad,
        className,
      ].join(" "),
    [ringCls, surfaceCls, basePad, className]
  );

  // A11y: aria-live só quando está carregando (evita releitura constante)
  const ariaLive = loading ? "polite" : undefined;
  const ariaBusy = loading ? "true" : "false";

  // Skeletons
  const TitleSkeleton = (
    <div className="flex flex-col gap-1 w-[15rem]" aria-hidden="true">
      <div className="h-5 w-2/3 bg-white/35 rounded animate-pulse" />
      {subtitle ? <div className="h-3 w-1/2 bg-white/25 rounded animate-pulse" /> : null}
    </div>
  );

  const ActionsSkeleton = (
    <div className="flex items-center gap-2" aria-hidden="true">
      <div className="h-9 w-24 bg-white/25 rounded-xl animate-pulse" />
      <div className="h-9 w-20 bg-white/25 rounded-xl animate-pulse" />
    </div>
  );

  // Title block
  const titleBlock = (
    <div className={["flex items-center gap-3", isCenter ? "justify-center" : "justify-start"].join(" ")}>
      {Icon && !loading ? (
        <Icon
          size={22}
          aria-hidden="true"
          className={["shrink-0 opacity-95", iconClassName].join(" ").trim()}
        />
      ) : null}

      {loading ? (
        TitleSkeleton
      ) : (
        <div className={isCenter ? "text-center" : "text-left"}>
          <HeadingTag
            id={headingId}
            className="text-lg md:text-xl font-extrabold tracking-tight leading-tight"
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

  // Layout: center vs left
  // - center: actions aparecem abaixo no mobile e à direita no desktop (sem duplicar quando vazio)
  // - left: actions à direita no desktop e abaixo no mobile
  return (
    <motion.header
      aria-labelledby={headingId}
      role="region"
      aria-busy={ariaBusy}
      aria-live={ariaLive}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={[containerPrint, stickyCls].join(" ").trim()}
    >
      <div className={[maxWidth, "mx-auto px-4 mt-4"].join(" ")}>
        {/* Breadcrumbs (fora do cartão) */}
        {breadcrumbs ? (
          <nav
            aria-label="Breadcrumb"
            className="mb-2 text-slate-700 dark:text-slate-300"
          >
            {breadcrumbs}
          </nav>
        ) : null}

        <div className={wrapperClasses}>
          {isCenter ? (
            <div className="w-full">
              {/* Linha principal */}
              <div className="flex items-center justify-center gap-3">
                {titleBlock}
                {/* desktop actions */}
                <div className="hidden md:flex items-center gap-2">
                  {loading ? ActionsSkeleton : actions || null}
                </div>
              </div>

              {/* mobile actions */}
              {(loading || actions) ? (
                <div className="mt-3 flex items-center justify-center gap-2 md:hidden">
                  {loading ? ActionsSkeleton : actions}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="w-full">
              {/* Linha principal */}
              <div className="flex items-center justify-between gap-3">
                {titleBlock}
                <div className="hidden md:flex items-center gap-2">
                  {loading ? ActionsSkeleton : actions || null}
                </div>
              </div>

              {/* mobile actions */}
              {!loading && actions ? (
                <div className="mt-3 md:hidden w-full flex items-center justify-start gap-2">
                  {actions}
                </div>
              ) : loading ? (
                <div className="mt-3 md:hidden w-full flex items-center justify-start gap-2">
                  {ActionsSkeleton}
                </div>
              ) : null}
            </div>
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

  // extras
  tone: PropTypes.oneOf(["soft", "solid"]),
  ring: PropTypes.bool,
  maxWidth: PropTypes.string,
};
