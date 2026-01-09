// 📁 src/components/ui/Loader.jsx
import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";

/**
 * Loader (spinner) moderno e acessível.
 * - Gradiente animado (3 cores) com acento configurável.
 * - Dark mode, tamanhos, inline/centralizado, skeleton.
 * - A11y: role="status", aria-live, label visível opcional.
 * - Respeita prefers-reduced-motion.
 * - Extras: determinate (progress 0–100), overlay, thickness.
 */
export default function Loader({
  size = "md",
  accent = "emerald",    // emerald | violet | amber | rose | teal | indigo | petroleo | orange | sky | lousa
  inline = false,         // se true, sem centralização (para dentro de botões/cards)
  minimal = false,        // se true, círculo sólido (sem anel)
  skeleton = false,       // modo pulsante em vez de girar
  className = "",
  ariaLabel = "Carregando…",
  // Novos opcionais (backward-compatible):
  label,                  // texto visível abaixo/ao lado
  progress,               // 0..100 ativa modo determinate
  overlay = false,        // cobre o container pai
  thickness = "auto",     // "auto" | "thin" | "normal" | "thick"
  direction = "column",   // "row" (label ao lado) | "column" (abaixo)
}) {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(Boolean(mq?.matches));
    onChange();
    mq?.addEventListener?.("change", onChange);
    return () => mq?.removeEventListener?.("change", onChange);
  }, []);

  const sizes = {
    sm: { box: "h-4 w-4", ring: "border-2", font: "text-xs", gap: "gap-2", track: 16 },
    md: { box: "h-8 w-8", ring: "border-4", font: "text-sm", gap: "gap-2.5", track: 32 },
    lg: { box: "h-12 w-12", ring: "border-4", font: "text-base", gap: "gap-3", track: 48 },
    xl: { box: "h-16 w-16", ring: "border-[5px]", font: "text-base", gap: "gap-3", track: 64 },
  };
  const S = sizes[size] ?? sizes.md;

  const ringThickness =
    thickness === "thin" ? "border-2" :
    thickness === "normal" ? "border-4" :
    thickness === "thick" ? "border-[6px]" :
    S.ring;

  const accents = {
    emerald: "from-emerald-700 via-emerald-500 to-emerald-300",
    violet: "from-violet-700 via-violet-500 to-violet-300",
    amber: "from-amber-700 via-amber-500 to-amber-300",
    rose: "from-rose-700 via-rose-500 to-rose-300",
    teal: "from-teal-700 via-teal-500 to-teal-300",
    indigo: "from-indigo-700 via-indigo-500 to-indigo-300",
    petroleo: "from-slate-900 via-teal-800 to-slate-700",
    orange: "from-orange-700 via-orange-500 to-orange-300",
    sky: "from-sky-700 via-sky-500 to-sky-300",
    lousa: "from-[#0f2c1f] via-[#114b2d] to-[#166534]",
  };
  const grad = accents[accent] ?? accents.emerald;

  const layoutCls = inline
    ? "inline-flex items-center"
    : "flex justify-center items-center py-4";

  const dirCls = direction === "row" ? "flex-row" : "flex-col";
  const labelMargin = direction === "row" ? "ml-2" : "mt-2";

  const isDeterminate = Number.isFinite(Number(progress));
  const clamped = isDeterminate ? Math.max(0, Math.min(100, Number(progress))) : undefined;

  // Estilo do overlay
  const overlayWrap = overlay
    ? "relative"
    : "";
  const overlayLayer = overlay
    ? "absolute inset-0 z-50 flex items-center justify-center bg-black/5 dark:bg-white/5 backdrop-blur-[2px]"
    : "";

  if (skeleton) {
    return (
      <div className={[overlayWrap, className].join(" ")}>
        {overlay ? (
          <div className={overlayLayer}>
            <div
              role="status"
              aria-label={ariaLabel}
              aria-live="polite"
              className={`flex ${dirCls} ${S.gap} items-center`}
            >
              <div className={`rounded-full bg-gradient-to-r ${grad} animate-pulse ${S.box}`} />
              <span className="sr-only">{ariaLabel}</span>
              {label && <span className={`${S.font} text-gray-700 dark:text-gray-200`}>{label}</span>}
            </div>
          </div>
        ) : (
          <div
            role="status"
            aria-label={ariaLabel}
            aria-live="polite"
            className={`${layoutCls} ${className}`}
          >
            <div className={`flex ${dirCls} ${S.gap} items-center`}>
              <div className={`rounded-full bg-gradient-to-r ${grad} animate-pulse ${S.box}`} />
              <span className="sr-only">{ariaLabel}</span>
              {label && <span className={`${S.font} text-gray-700 dark:text-gray-200`}>{label}</span>}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Determinate usa anel com trilha (border) + segmento rotacionado por percent
  const spinner = isDeterminate ? (
    <div className="relative">
      {/* trilha */}
      <div
        className={[
          "rounded-full border-current/20",
          S.box,
          ringThickness,
          "text-gray-400 dark:text-gray-600",
        ].join(" ")}
        aria-hidden="true"
      />
      {/* segmento */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="loaderGrad" x1="0" y1="0" x2="1" y2="1">
            {/* fallback sólido para HC */}
            <stop offset="0%" stopColor="currentColor" />
            <stop offset="100%" stopColor="currentColor" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="url(#loaderGrad)"
          strokeWidth={ringThickness.includes("[") ? Number(ringThickness.match(/\[(\d+)px\]/)?.[1] ?? 4) : Number(ringThickness.replace("border-", "")) || 4}
          strokeLinecap="round"
          strokeDasharray={`${Math.round((clamped / 100) * 283)} 283`}
          transform="rotate(-90 50 50)"
          className="text-gray-800 dark:text-gray-100"
        />
      </svg>
    </div>
  ) : (
    <div
      className={[
        "relative rounded-full",
        S.box,
        minimal
          ? `animate-spin bg-gradient-to-tr ${grad}`
          : `animate-spin ${ringThickness} border-solid border-t-transparent bg-gradient-to-tr ${grad}`,
      ].join(" ")}
      style={{ backgroundClip: minimal ? "padding-box" : undefined }}
      aria-hidden="true"
    />
  );

  const content = (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
      className={`flex ${dirCls} ${S.gap} items-center`}
    >
      {/* reduz movimento se necessário */}
      <div className={reducedMotion && !isDeterminate ? "animate-none" : ""}>
        {spinner}
      </div>
      <span className="sr-only">{ariaLabel}</span>
      {label && (
        <span className={`${S.font} text-gray-700 dark:text-gray-200`}>
          {isDeterminate ? `${label} ${clamped}%` : label}
        </span>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div className={[overlayWrap, className].join(" ")}>
        <div className={overlayLayer}>{content}</div>
      </div>
    );
  }

  return (
    <div className={`${layoutCls} ${className}`}>
      {content}
    </div>
  );
}

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
  // novos:
  label: PropTypes.string,
  progress: PropTypes.number,
  overlay: PropTypes.bool,
  thickness: PropTypes.oneOf(["auto", "thin", "normal", "thick"]),
  direction: PropTypes.oneOf(["row", "column"]),
};
