// ✅ src/components/institucional/SeloInstitucional.jsx — v2.0
// Plataforma Escola da Saúde
//
// Selo visual institucional.
//
// Revisão premium:
// - componente institucional, não genérico de UI;
// - usado como assinatura visual discreta da plataforma;
// - não substitui HeaderHero;
// - contrato visual controlado;
// - sem aliases;
// - sem compatibilidade legada;
// - mobile-first;
// - dark mode;
// - acessibilidade com aria-label;
// - visual premium com faixa, glow, microidentidade e badge;
// - pronto para páginas institucionais, topo discreto, rodapés e áreas públicas.

import { memo } from "react";
import PropTypes from "prop-types";

const VARIANT_CLASSES = {
  saude: {
    bar: "from-emerald-600 via-emerald-500 to-sky-500",
    glow: "from-emerald-500/40 via-sky-500/25 to-transparent",
    dot: "bg-emerald-500",
    ring: "ring-emerald-200/70 dark:ring-emerald-400/25",
    badge:
      "border-emerald-200/70 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-100",
    title: "text-slate-900 dark:text-slate-100",
    subtitle: "text-slate-600 dark:text-slate-300",
  },
  residencia: {
    bar: "from-teal-600 via-sky-500 to-violet-500",
    glow: "from-teal-500/35 via-violet-500/25 to-transparent",
    dot: "bg-teal-500",
    ring: "ring-teal-200/70 dark:ring-teal-400/25",
    badge:
      "border-teal-200/70 bg-teal-50 text-teal-800 dark:border-teal-800/40 dark:bg-teal-950/40 dark:text-teal-100",
    title: "text-slate-900 dark:text-slate-100",
    subtitle: "text-slate-600 dark:text-slate-300",
  },
  petroleo: {
    bar: "from-slate-800 via-sky-700 to-emerald-600",
    glow: "from-sky-500/25 via-emerald-500/20 to-transparent",
    dot: "bg-sky-500",
    ring: "ring-sky-200/70 dark:ring-sky-400/25",
    badge:
      "border-sky-200/70 bg-sky-50 text-sky-900 dark:border-sky-800/40 dark:bg-sky-950/40 dark:text-sky-100",
    title: "text-slate-900 dark:text-slate-100",
    subtitle: "text-slate-600 dark:text-slate-300",
  },
  violeta: {
    bar: "from-violet-700 via-fuchsia-600 to-sky-500",
    glow: "from-violet-500/35 via-sky-500/20 to-transparent",
    dot: "bg-violet-500",
    ring: "ring-violet-200/70 dark:ring-violet-400/25",
    badge:
      "border-violet-200/70 bg-violet-50 text-violet-900 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-100",
    title: "text-slate-900 dark:text-slate-100",
    subtitle: "text-slate-600 dark:text-slate-300",
  },
  amarelo: {
    bar: "from-amber-600 via-orange-500 to-rose-500",
    glow: "from-amber-500/35 via-rose-500/20 to-transparent",
    dot: "bg-amber-500",
    ring: "ring-amber-200/70 dark:ring-amber-400/25",
    badge:
      "border-amber-200/70 bg-amber-50 text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-100",
    title: "text-slate-900 dark:text-slate-100",
    subtitle: "text-slate-600 dark:text-slate-300",
  },
  rosa: {
    bar: "from-rose-600 via-fuchsia-600 to-indigo-500",
    glow: "from-rose-500/35 via-indigo-500/20 to-transparent",
    dot: "bg-rose-500",
    ring: "ring-rose-200/70 dark:ring-rose-400/25",
    badge:
      "border-rose-200/70 bg-rose-50 text-rose-900 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-100",
    title: "text-slate-900 dark:text-slate-100",
    subtitle: "text-slate-600 dark:text-slate-300",
  },
};

const GLOW_CLASSES = {
  sm: "h-6 -top-1.5 blur-lg",
  md: "h-8 -top-2 blur-xl",
  lg: "h-10 -top-3 blur-2xl",
};

const TAGS_PERMITIDAS = {
  section: "section",
  header: "header",
  div: "div",
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function getVariantClasses(variant) {
  return VARIANT_CLASSES[variant] || VARIANT_CLASSES.saude;
}

function getTag(as) {
  return TAGS_PERMITIDAS[as] || "section";
}

function SeloInstitucional({
  appName = "Escola da Saúde",
  variant = "saude",
  badgeText = "Plataforma Oficial",
  showBadge = true,
  showSubtitle = true,
  subtitle = "Secretaria Municipal de Saúde — Santos",
  className = "",
  as = "section",
  align = "between",
  compact = false,
  glowStrength = "md",
  ariaLabel = "Identidade institucional da plataforma",
}) {
  const theme = getVariantClasses(variant);
  const Tag = getTag(as);

  const glowClass = GLOW_CLASSES[glowStrength] || GLOW_CLASSES.md;
  const paddingY = compact ? "py-2" : "py-3";

  const layoutClass =
    align === "start"
      ? "justify-start"
      : "justify-between";

  return (
    <Tag
      className={classNames("w-full", className)}
      aria-label={ariaLabel}
    >
      <div className="relative" aria-hidden="true">
        <div className={classNames("h-[3px] w-full bg-gradient-to-r", theme.bar)} />

        <div
          className={classNames(
            "pointer-events-none absolute inset-x-0 bg-gradient-to-r",
            glowClass,
            theme.glow
          )}
        />

        <div className="h-px w-full bg-black/5 dark:bg-white/10" />
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div
          className={classNames(
            "flex flex-wrap items-center gap-3",
            layoutClass,
            paddingY
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={classNames(
                "h-2.5 w-2.5 shrink-0 rounded-full ring-4",
                theme.dot,
                theme.ring
              )}
              aria-hidden="true"
            />

            <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
              <span
                className={classNames(
                  "truncate text-sm font-black tracking-tight",
                  theme.title
                )}
              >
                {appName}
              </span>

              {showSubtitle && (
                <span
                  className={classNames(
                    "hidden truncate text-xs font-medium sm:inline",
                    theme.subtitle
                  )}
                >
                  {subtitle}
                </span>
              )}
            </div>
          </div>

          {showBadge && (
            <div
              className={classNames(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs font-black shadow-sm backdrop-blur",
                theme.badge
              )}
              aria-label={badgeText}
              title={badgeText}
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-current opacity-70"
                aria-hidden="true"
              />

              <span className="whitespace-nowrap">{badgeText}</span>
            </div>
          )}
        </div>
      </div>
    </Tag>
  );
}

SeloInstitucional.propTypes = {
  appName: PropTypes.string,
  variant: PropTypes.oneOf([
    "saude",
    "residencia",
    "petroleo",
    "violeta",
    "amarelo",
    "rosa",
  ]),
  badgeText: PropTypes.string,
  showBadge: PropTypes.bool,
  showSubtitle: PropTypes.bool,
  subtitle: PropTypes.string,
  className: PropTypes.string,
  as: PropTypes.oneOf(["section", "header", "div"]),
  align: PropTypes.oneOf(["between", "start"]),
  compact: PropTypes.bool,
  glowStrength: PropTypes.oneOf(["sm", "md", "lg"]),
  ariaLabel: PropTypes.string,
};

export default memo(SeloInstitucional);