// ✅ src/components/ui/CarregandoSkeleton.jsx — v2.0
// Plataforma Escola da Saúde
//
// Skeleton genérico oficial de carregamento.
//
// Revisão premium:
// - componente genérico real de UI;
// - leve e sem dependência de framer-motion;
// - acessível com role="status", aria-busy e texto sr-only;
// - respeita prefers-reduced-motion via Tailwind;
// - larguras determinísticas por seed;
// - visual consistente com cards, listas e blocos;
// - mobile-first;
// - dark mode;
// - sem keyframes locais ou CSS externo obrigatório.

import PropTypes from "prop-types";

const COLOR_CLASSES = {
  slate: "bg-slate-200/80 dark:bg-white/10",
  gray: "bg-gray-200 dark:bg-gray-700",
  verde: "bg-emerald-100 dark:bg-emerald-900/35",
  lousa: "bg-emerald-950/10 dark:bg-emerald-300/10",
  white: "bg-white/40 dark:bg-white/10",
};

const RADIUS_CLASSES = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
  full: "rounded-full",
};

const SPACING_CLASSES = {
  xs: "space-y-2",
  sm: "space-y-2.5",
  md: "space-y-3",
  lg: "space-y-4",
};

const PADDING_CLASSES = {
  none: "",
  sm: "px-3 py-3",
  md: "px-4 py-4",
  lg: "px-5 py-5",
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, number));
}

function widthForLine(index, seed, larguraVariada) {
  if (!larguraVariada) {
    return "100%";
  }

  const m = 233280;
  const a = 9301;
  const c = 49297;
  const normalizedSeed = Number.isFinite(Number(seed)) ? Number(seed) : 0;
  const s = (index + 1) * 97 + (normalizedSeed % 997);
  const r = ((a * s + c) % m) / m;

  const percent = Math.max(0.45, r) * 100;

  return `${percent.toFixed(0)}%`;
}

function resolveTag(as) {
  if (as === "section") return "section";
  if (as === "article") return "article";
  if (as === "ul") return "ul";
  if (as === "li") return "li";
  return "div";
}

export default function CarregandoSkeleton({
  linhas = 3,
  altura = 20,
  cor = "slate",
  larguraVariada = true,
  className = "",
  rounded = "md",
  ariaLabel = "Carregando conteúdo",
  srText = "Carregando...",
  as = "div",
  seed = 0,
  padding = "md",
  spacing = "md",
  animate = true,
}) {
  const Tag = resolveTag(as);

  const safeLines = clampNumber(linhas, 1, 20, 3);
  const safeHeight = clampNumber(altura, 4, 240, 20);

  const colorClass = COLOR_CLASSES[cor] || COLOR_CLASSES.slate;
  const radiusClass = RADIUS_CLASSES[rounded] || RADIUS_CLASSES.md;
  const paddingClass = PADDING_CLASSES[padding] || PADDING_CLASSES.md;
  const spacingClass = SPACING_CLASSES[spacing] || SPACING_CLASSES.md;

  return (
    <Tag
      className={classNames(paddingClass, spacingClass, className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      <span className="sr-only">{srText}</span>

      {Array.from({ length: safeLines }).map((_, index) => (
        <div
          key={`${seed}-${index}`}
          style={{
            width: widthForLine(index, seed, larguraVariada),
            height: safeHeight,
          }}
          className={classNames(
            "relative overflow-hidden",
            radiusClass,
            colorClass,
            animate && "motion-safe:animate-pulse motion-reduce:animate-none"
          )}
          aria-hidden="true"
        />
      ))}
    </Tag>
  );
}

CarregandoSkeleton.propTypes = {
  linhas: PropTypes.number,
  altura: PropTypes.number,
  cor: PropTypes.oneOf(["slate", "gray", "verde", "lousa", "white"]),
  larguraVariada: PropTypes.bool,
  className: PropTypes.string,
  rounded: PropTypes.oneOf(["none", "sm", "md", "lg", "xl", "2xl", "3xl", "full"]),
  ariaLabel: PropTypes.string,
  srText: PropTypes.string,
  as: PropTypes.oneOf(["div", "section", "article", "ul", "li"]),
  seed: PropTypes.number,
  padding: PropTypes.oneOf(["none", "sm", "md", "lg"]),
  spacing: PropTypes.oneOf(["xs", "sm", "md", "lg"]),
  animate: PropTypes.bool,
};