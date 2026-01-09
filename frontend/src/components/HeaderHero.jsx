// ✅ src/components/HeaderHero.jsx
import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Sparkles } from "lucide-react";

/** Presets de gradiente (cada página pode escolher um tema distinto) */
const THEME_GRADIENTS = {
  emerald: "from-emerald-600 via-teal-600 to-sky-700",
  amber: "from-amber-600 via-orange-600 to-rose-600",
  rose: "from-rose-600 via-fuchsia-600 to-pink-700",
  indigo: "from-indigo-700 via-sky-700 to-cyan-700",
  cyan: "from-cyan-700 via-teal-700 to-emerald-700",
  violet: "from-violet-700 via-purple-700 to-fuchsia-700",
  slate: "from-slate-700 via-gray-700 to-zinc-800",
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(!!mq.matches);
    const onChange = (e) => setReduced(!!e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

export default function HeaderHero({
  title,
  subtitle,
  badge = "Plataforma oficial",
  icon: Icon = Sparkles,
  /** mantém compat c/ tua prop antiga; se `theme` vier, ele tem prioridade */
  gradient = "from-emerald-600 via-teal-600 to-sky-700",
  theme,                 // "emerald" | "amber" | "rose" | "indigo" | "cyan" | "violet" | "slate"
  isDark,                // compat: reforça overlay
  size = "md",           // "sm" | "md" | "lg"
  breadcrumbsSlot,       // conteúdo livre à esquerda (ex.: <Breadcrumbs/>)
  rightSlot,             // CTA / filtros / stats (já existia)
  children,              // linha extra sob título/subtítulo (tags, chips, etc.)
  showGrid = true,
  showDots = true,
  showBlobs = true,
  rounded = "rounded-3xl",
  shadow = true,
  className = "",
}) {
  const prefersReduced = usePrefersReducedMotion();
  const showBadge = badge !== false && String(badge || "").trim().length > 0;

  const gradientCls = theme ? (THEME_GRADIENTS[theme] || THEME_GRADIENTS.emerald) : gradient;

  const sizeCls = {
    sm: {
      pad: "py-5 md:py-7",
      title: "text-xl md:text-2xl",
      subtitle: "text-xs md:text-[13px]",
      iconPad: "p-3",
      iconSize: "w-6 h-6",
    },
    md: {
      pad: "py-7 md:py-10",
      title: "text-2xl md:text-3xl",
      subtitle: "text-sm md:text-[15px]",
      iconPad: "p-3.5",
      iconSize: "w-7 h-7",
    },
    lg: {
      pad: "py-10 md:py-14",
      title: "text-3xl md:text-4xl",
      subtitle: "text-base md:text-[17px]",
      iconPad: "p-4",
      iconSize: "w-8 h-8",
    },
  }[size] || sizeCls.md;

  return (
    <header
      className={[
        "relative overflow-hidden",
        rounded,
        "ring-1 ring-black/5 dark:ring-white/10",
        shadow
          ? "shadow-[0_18px_60px_rgba(2,6,23,.10)] dark:shadow-[0_22px_80px_rgba(0,0,0,.55)]"
          : "",
        className,
      ].join(" ")}
      role="banner"
    >
      {/* Base gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradientCls}`} />

      {/* Overlay inteligente */}
      <div className="absolute inset-0 bg-black/15 dark:bg-black/35" />
      {isDark ? <div className="absolute inset-0 bg-black/10" /> : null}

      {/* Selo superior */}
      <div className="absolute inset-x-0 top-0">
        <div className="h-[3px] w-full bg-gradient-to-r from-white/0 via-white/60 to-white/0" />
        <div
          className="pointer-events-none absolute inset-x-0 -top-2 h-10 bg-gradient-to-r from-white/0 via-white/28 to-white/0 blur-2xl"
          aria-hidden="true"
        />
      </div>

      {/* Texturas (grid + dots) */}
      {showGrid && (
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.18] dark:opacity-[0.22]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.10) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />
      )}
      {showDots && (
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.10] dark:opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,.35) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
      )}

      {/* Blobs controlados */}
      {showBlobs && (
        <>
          <div aria-hidden="true" className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/18 blur-3xl" />
          <div aria-hidden="true" className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/14 blur-3xl" />
          {!prefersReduced && (
            <div aria-hidden="true" className="absolute top-10 right-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          )}
        </>
      )}

      {/* Content */}
      <div className="relative">
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 ${sizeCls.pad}`}>
          {/* Top row: breadcrumbs (opcional) */}
          {breadcrumbsSlot ? (
            <div className="mb-3 sm:mb-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-white/90 text-[11px] font-semibold backdrop-blur-md">
                {breadcrumbsSlot}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4 min-w-0">
              {/* Icon tile premium */}
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-3xl bg-white/25 blur-xl" aria-hidden="true" />
                <div className={`rounded-3xl bg-white/16 backdrop-blur-md ${sizeCls.iconPad} ring-1 ring-white/25 shadow-[0_12px_34px_rgba(0,0,0,.18)]`}>
                  <Icon className={`${sizeCls.iconSize} text-white`} aria-hidden="true" />
                </div>
              </div>

              <div className="min-w-0">
                {/* Badge pill */}
                {showBadge ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-white/90 text-xs font-extrabold backdrop-blur-md">
                    <Sparkles className="h-4 w-4 opacity-90" aria-hidden="true" />
                    <span className="truncate">{badge}</span>
                  </div>
                ) : null}

                <h1 className={`mt-2 ${sizeCls.title} font-extrabold text-white tracking-tight leading-tight`}>
                  {title}
                </h1>

                {subtitle ? (
                  <p className={`mt-2 ${sizeCls.subtitle} text-white/90 max-w-2xl leading-relaxed`}>
                    {subtitle}
                  </p>
                ) : null}

                {/* Linha extra opcional abaixo do subtítulo */}
                {children ? (
                  <div className="mt-3">
                    {children}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Right slot */}
            {rightSlot ? (
              <div className="shrink-0 w-full sm:w-auto">
                <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md p-2 shadow-[0_12px_34px_rgba(0,0,0,.14)]">
                  {rightSlot}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

HeaderHero.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  badge: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  icon: PropTypes.elementType,
  gradient: PropTypes.string,
  theme: PropTypes.oneOf(["emerald", "amber", "rose", "indigo", "cyan", "violet", "slate"]),
  isDark: PropTypes.bool,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  breadcrumbsSlot: PropTypes.node,
  rightSlot: PropTypes.node,
  children: PropTypes.node,
  showGrid: PropTypes.bool,
  showDots: PropTypes.bool,
  showBlobs: PropTypes.bool,
  rounded: PropTypes.string,
  shadow: PropTypes.bool,
  className: PropTypes.string,
};
