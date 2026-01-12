// 📁 src/components/Spinner.jsx
import PropTypes from "prop-types";

/**
 * Spinner — indicador de carregamento premium e acessível.
 *
 * Compatível com props antigas:
 * - size, colorClass, className, srText, showLabel
 *
 * Extras:
 * - inline?: boolean (não força minHeight)
 * - tone?: "emerald"|"indigo"|"amber"|"rose"|"slate" (atalho de cor)
 * - thickness?: number (px) opcional
 */
export default function Spinner({
  size = 40,
  colorClass = "", // compat: se vier, aplica no "arc"
  className = "",
  srText = "Carregando...",
  showLabel = false,

  // extras premium
  inline = false,
  tone = "slate",
  thickness,
}) {
  const px =
    typeof size === "number"
      ? { w: size, h: size }
      : { w: size, h: size };

  const t =
    typeof thickness === "number"
      ? Math.max(2, Math.round(thickness))
      : Math.max(3, Math.round((typeof size === "number" ? size : parseInt(size, 10) || 40) / 10));

  const toneMap = {
    emerald: {
      arc: "text-emerald-700 dark:text-emerald-300",
      halo: "border-emerald-200/70 dark:border-emerald-400/20",
      glow: "shadow-[0_18px_55px_-40px_rgba(16,185,129,0.65)]",
    },
    indigo: {
      arc: "text-indigo-700 dark:text-indigo-300",
      halo: "border-indigo-200/70 dark:border-indigo-400/20",
      glow: "shadow-[0_18px_55px_-40px_rgba(99,102,241,0.65)]",
    },
    amber: {
      arc: "text-amber-700 dark:text-amber-300",
      halo: "border-amber-200/70 dark:border-amber-400/20",
      glow: "shadow-[0_18px_55px_-40px_rgba(245,158,11,0.60)]",
    },
    rose: {
      arc: "text-rose-700 dark:text-rose-300",
      halo: "border-rose-200/70 dark:border-rose-400/20",
      glow: "shadow-[0_18px_55px_-40px_rgba(244,63,94,0.60)]",
    },
    slate: {
      arc: "text-slate-800 dark:text-white",
      halo: "border-slate-200/80 dark:border-white/15",
      glow: "shadow-[0_18px_55px_-40px_rgba(2,6,23,0.55)]",
    },
  };

  const theme = toneMap[tone] || toneMap.slate;

  return (
    <div
      className={[
        "flex flex-col items-center justify-center gap-2",
        inline ? "" : "min-h-[100px]",
        className,
      ].join(" ")}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={srText}
    >
      <div
        aria-hidden="true"
        className={["relative", theme.glow].join(" ")}
        style={{
          width: typeof px.w === "number" ? `${px.w}px` : px.w,
          height: typeof px.h === "number" ? `${px.h}px` : px.h,
        }}
      >
        {/* Halo (anel base) */}
        <div
          className={[
            "absolute inset-0 rounded-full border",
            theme.halo,
          ].join(" ")}
          style={{ borderWidth: `${t}px` }}
        />

        {/* Arc (parte giratória) */}
        <div
          className={[
            "absolute inset-0 rounded-full",
            "border-transparent",
            "motion-safe:animate-spin",
            "motion-reduce:animate-none",
            theme.arc,
            colorClass || "",
          ].join(" ")}
          style={{
            borderWidth: `${t}px`,
            borderStyle: "solid",
            borderTopColor: "currentColor",
            borderRightColor: "transparent",
            borderBottomColor: "transparent",
            borderLeftColor: "transparent",
          }}
        />

        {/* Highlight (brilho sutil) */}
        <div
          className="pointer-events-none absolute -inset-2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.45),transparent)] dark:bg-[radial-gradient(closest-side,rgba(255,255,255,0.10),transparent)]"
        />
      </div>

      {showLabel && (
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          {srText}
        </span>
      )}

      <span className="sr-only">{srText}</span>
    </div>
  );
}

Spinner.propTypes = {
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  colorClass: PropTypes.string,
  className: PropTypes.string,
  srText: PropTypes.string,
  showLabel: PropTypes.bool,

  inline: PropTypes.bool,
  tone: PropTypes.oneOf(["emerald", "indigo", "amber", "rose", "slate"]),
  thickness: PropTypes.number,
};
