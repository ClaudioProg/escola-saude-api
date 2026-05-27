// ✅ src/components/ui/Loader.jsx — v2.0
// Plataforma Escola da Saúde
//
// Loader genérico oficial da plataforma.
//
// Revisão premium:
// - componente genérico real de UI;
// - spinner acessível;
// - suporte a inline, centralizado, overlay, skeleton e progresso determinado;
// - reduced motion via Tailwind;
// - sem window.matchMedia/useEffect desnecessário;
// - sem id SVG duplicável;
// - visual premium consistente;
// - mobile-first;
// - dark mode;
// - contrato limpo e previsível.

import PropTypes from "prop-types";

const ACCENT_CLASSES = {
  emerald: "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300",
  violet: "border-violet-600 text-violet-700 dark:border-violet-400 dark:text-violet-300",
  amber: "border-amber-600 text-amber-700 dark:border-amber-400 dark:text-amber-300",
  rose: "border-rose-600 text-rose-700 dark:border-rose-400 dark:text-rose-300",
  teal: "border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300",
  indigo: "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300",
  petroleo: "border-cyan-800 text-cyan-900 dark:border-cyan-400 dark:text-cyan-200",
  orange: "border-orange-600 text-orange-700 dark:border-orange-400 dark:text-orange-300",
  sky: "border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-300",
  lousa: "border-emerald-900 text-emerald-950 dark:border-emerald-300 dark:text-emerald-200",
};

const SKELETON_ACCENT_CLASSES = {
  emerald: "bg-emerald-200 dark:bg-emerald-900/50",
  violet: "bg-violet-200 dark:bg-violet-900/50",
  amber: "bg-amber-200 dark:bg-amber-900/50",
  rose: "bg-rose-200 dark:bg-rose-900/50",
  teal: "bg-teal-200 dark:bg-teal-900/50",
  indigo: "bg-indigo-200 dark:bg-indigo-900/50",
  petroleo: "bg-cyan-200 dark:bg-cyan-950/60",
  orange: "bg-orange-200 dark:bg-orange-900/50",
  sky: "bg-sky-200 dark:bg-sky-900/50",
  lousa: "bg-emerald-950/15 dark:bg-emerald-300/15",
};

const SIZE_CLASSES = {
  sm: {
    spinner: "h-4 w-4",
    text: "text-xs",
    gap: "gap-2",
    stroke: "border-2",
    skeleton: "h-4 w-4",
  },
  md: {
    spinner: "h-8 w-8",
    text: "text-sm",
    gap: "gap-2.5",
    stroke: "border-4",
    skeleton: "h-8 w-8",
  },
  lg: {
    spinner: "h-12 w-12",
    text: "text-base",
    gap: "gap-3",
    stroke: "border-4",
    skeleton: "h-12 w-12",
  },
  xl: {
    spinner: "h-16 w-16",
    text: "text-base",
    gap: "gap-3",
    stroke: "border-[5px]",
    skeleton: "h-16 w-16",
  },
};

const THICKNESS_CLASSES = {
  auto: null,
  thin: "border-2",
  normal: "border-4",
  thick: "border-[6px]",
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function clampProgress(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.min(100, Math.max(0, number));
}

function ProgressRing({ progress, size, accent }) {
  const safeProgress = clampProgress(progress) ?? 0;
  const sizePx = {
    sm: 18,
    md: 34,
    lg: 50,
    xl: 66,
  }[size] || 34;

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeProgress / 100) * circumference;

  return (
    <svg
      width={sizePx}
      height={sizePx}
      viewBox="0 0 44 44"
      role="img"
      aria-label={`Progresso: ${safeProgress}%`}
      className={classNames(
        "shrink-0",
        ACCENT_CLASSES[accent] || ACCENT_CLASSES.emerald
      )}
    >
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        opacity="0.18"
      />
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 22 22)"
      />
    </svg>
  );
}

export default function Loader({
  size = "md",
  accent = "emerald",
  inline = false,
  minimal = false,
  skeleton = false,
  className = "",
  ariaLabel = "Carregando",
  label,
  progress,
  overlay = false,
  thickness = "auto",
  direction = "column",
}) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const accentClass = ACCENT_CLASSES[accent] || ACCENT_CLASSES.emerald;
  const skeletonAccent = SKELETON_ACCENT_CLASSES[accent] || SKELETON_ACCENT_CLASSES.emerald;

  const progressValue = clampProgress(progress);
  const isDeterminate = progressValue !== null;

  const strokeClass = THICKNESS_CLASSES[thickness] || sizeClass.stroke;

  const layoutClass = inline
    ? "inline-flex items-center"
    : "flex items-center justify-center py-4";

  const directionClass = direction === "row" ? "flex-row" : "flex-col";

  const text = isDeterminate && label ? `${label} ${progressValue}%` : label;

  const spinner = isDeterminate ? (
    <ProgressRing progress={progressValue} size={size} accent={accent} />
  ) : skeleton ? (
    <span
      className={classNames(
        "inline-block rounded-full motion-safe:animate-pulse motion-reduce:animate-none",
        sizeClass.skeleton,
        skeletonAccent
      )}
      aria-hidden="true"
    />
  ) : (
    <span
      className={classNames(
        "inline-block shrink-0 rounded-full border-current border-t-transparent motion-safe:animate-spin motion-reduce:animate-none",
        sizeClass.spinner,
        strokeClass,
        accentClass,
        minimal && "border-t-current opacity-80 motion-safe:animate-pulse"
      )}
      aria-hidden="true"
    />
  );

  const content = (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
      aria-busy="true"
      className={classNames(
        "flex items-center",
        directionClass,
        sizeClass.gap
      )}
    >
      {spinner}
      <span className="sr-only">{ariaLabel}</span>

      {text && (
        <span
          className={classNames(
            "font-semibold text-slate-700 dark:text-slate-200",
            sizeClass.text
          )}
        >
          {text}
        </span>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div className={classNames("absolute inset-0 z-50", className)}>
        <div className="flex h-full w-full items-center justify-center bg-white/70 backdrop-blur-[2px] dark:bg-slate-950/60">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className={classNames(layoutClass, className)}>
      {content}
    </div>
  );
}

ProgressRing.propTypes = {
  progress: PropTypes.number.isRequired,
  size: PropTypes.oneOf(["sm", "md", "lg", "xl"]).isRequired,
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
  ]).isRequired,
};

Loader.propTypes = {
  size: PropTypes.oneOf(["sm", "md", "lg", "xl"]),
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
  inline: PropTypes.bool,
  minimal: PropTypes.bool,
  skeleton: PropTypes.bool,
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
  label: PropTypes.string,
  progress: PropTypes.number,
  overlay: PropTypes.bool,
  thickness: PropTypes.oneOf(["auto", "thin", "normal", "thick"]),
  direction: PropTypes.oneOf(["row", "column"]),
};