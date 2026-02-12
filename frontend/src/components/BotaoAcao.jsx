import PropTypes from "prop-types";

/**
 * Botão de ação compacto (chip) — PREMIUM++++ (tech glass, não chapado)
 * - Retrocompatível (label, icon, onClick, cor, disabled, loading, className).
 * - Visual: glass + borda translúcida + sheen discreto + micro-sombra
 * - Tones: solid (grad 3 cores), outline (glass + borda colorida), ghost (minimal)
 * - A11y: focus ring por cor, aria-busy e aria-disabled
 * - Link via href/target/rel/download
 */
export default function BotaoAcao({
  label,
  icon,
  onClick,
  cor = "azulPetroleo",
  disabled = false,
  loading = false,
  className = "",

  tone = "outline", // ✅ default melhor p/ chip: outline (menos chamativo)
  size = "md", // xs | sm | md
  shape = "full", // full | lg | md
  ariaLabel,
  title,
  href,
  target,
  rel,
  as,
  leftIcon,
  rightIcon,
  fullWidth = false,
  download,
}) {
  /* ====== Size / radius ====== */
  const sizeMap = {
    xs: "text-[11px] px-2 py-1 gap-1 min-h-[30px]",
    sm: "text-[12px] px-2.5 py-1.5 gap-1.5 min-h-[34px]",
    md: "text-[12px] px-3 py-2 gap-1.5 min-h-[38px]",
  };

  const roundMap = {
    full: "rounded-full",
    lg: "rounded-2xl",
    md: "rounded-xl",
  };

  /* ====== Paletas (controladas, premium) ====== */
  const palette = {
    blue: {
      ring: "focus-visible:ring-blue-400/60",
      solid: "from-blue-600 via-blue-700 to-blue-800 text-white border-blue-900/40",
      outlineText: "text-blue-800 dark:text-blue-200",
      outlineBorder: "border-blue-300/80 dark:border-blue-800/60",
      ghostText: "text-blue-800 dark:text-blue-200",
      glow: "after:shadow-[0_0_0_1px_rgba(59,130,246,0.18)]",
      tint: "bg-blue-50/60 dark:bg-blue-950/18",
    },
    purple: {
      ring: "focus-visible:ring-purple-400/60",
      solid: "from-purple-700 via-purple-800 to-purple-900 text-white border-purple-950/40",
      outlineText: "text-purple-800 dark:text-purple-200",
      outlineBorder: "border-purple-300/80 dark:border-purple-800/60",
      ghostText: "text-purple-800 dark:text-purple-200",
      glow: "after:shadow-[0_0_0_1px_rgba(168,85,247,0.16)]",
      tint: "bg-purple-50/60 dark:bg-purple-950/16",
    },
    green: {
      ring: "focus-visible:ring-emerald-500/55",
      solid: "from-emerald-600 via-emerald-700 to-emerald-800 text-white border-emerald-950/40",
      outlineText: "text-emerald-900 dark:text-emerald-200",
      outlineBorder: "border-emerald-300/80 dark:border-emerald-800/60",
      ghostText: "text-emerald-900 dark:text-emerald-200",
      glow: "after:shadow-[0_0_0_1px_rgba(16,185,129,0.16)]",
      tint: "bg-emerald-50/60 dark:bg-emerald-950/18",
    },
    gray: {
      ring: "focus-visible:ring-slate-400/60",
      solid: "from-slate-700 via-slate-800 to-slate-900 text-white border-slate-950/40",
      outlineText: "text-slate-800 dark:text-zinc-200",
      outlineBorder: "border-slate-300/80 dark:border-zinc-700/70",
      ghostText: "text-slate-800 dark:text-zinc-200",
      glow: "after:shadow-[0_0_0_1px_rgba(100,116,139,0.18)]",
      tint: "bg-slate-50/60 dark:bg-zinc-900/22",
    },
    red: {
      ring: "focus-visible:ring-rose-400/60",
      solid: "from-rose-600 via-rose-700 to-rose-800 text-white border-rose-950/40",
      outlineText: "text-rose-800 dark:text-rose-200",
      outlineBorder: "border-rose-300/80 dark:border-rose-800/60",
      ghostText: "text-rose-800 dark:text-rose-200",
      glow: "after:shadow-[0_0_0_1px_rgba(244,63,94,0.16)]",
      tint: "bg-rose-50/60 dark:bg-rose-950/18",
    },
    orange: {
      ring: "focus-visible:ring-orange-400/60",
      solid: "from-orange-600 via-orange-700 to-orange-800 text-white border-orange-950/40",
      outlineText: "text-orange-900 dark:text-orange-200",
      outlineBorder: "border-orange-300/80 dark:border-orange-800/60",
      ghostText: "text-orange-900 dark:text-orange-200",
      glow: "after:shadow-[0_0_0_1px_rgba(249,115,22,0.16)]",
      tint: "bg-orange-50/60 dark:bg-orange-950/16",
    },

    // ✅ suas cores “oficiais”
    verde: {
      ring: "focus-visible:ring-emerald-500/55",
      solid: "from-[#0f2c1f] via-[#114b2d] to-[#166534] text-white border-emerald-950/40",
      outlineText: "text-emerald-900 dark:text-emerald-200",
      outlineBorder: "border-emerald-300/80 dark:border-emerald-800/60",
      ghostText: "text-emerald-900 dark:text-emerald-200",
      glow: "after:shadow-[0_0_0_1px_rgba(16,185,129,0.18)]",
      tint: "bg-emerald-50/60 dark:bg-emerald-950/18",
    },
    amareloOuro: {
      ring: "focus-visible:ring-amber-400/60",
      solid: "from-amber-500 via-amber-600 to-amber-700 text-black border-amber-900/35",
      outlineText: "text-amber-900 dark:text-amber-200",
      outlineBorder: "border-amber-300/80 dark:border-amber-800/60",
      ghostText: "text-amber-900 dark:text-amber-200",
      glow: "after:shadow-[0_0_0_1px_rgba(245,158,11,0.16)]",
      tint: "bg-amber-50/60 dark:bg-amber-950/14",
    },
    laranjaQueimado: {
      ring: "focus-visible:ring-orange-400/60",
      solid: "from-orange-600 via-orange-700 to-orange-800 text-white border-orange-950/40",
      outlineText: "text-orange-900 dark:text-orange-200",
      outlineBorder: "border-orange-300/80 dark:border-orange-800/60",
      ghostText: "text-orange-900 dark:text-orange-200",
      glow: "after:shadow-[0_0_0_1px_rgba(249,115,22,0.16)]",
      tint: "bg-orange-50/60 dark:bg-orange-950/16",
    },
    vermelhoCoral: {
      ring: "focus-visible:ring-rose-400/60",
      solid: "from-rose-500 via-rose-600 to-rose-700 text-white border-rose-950/40",
      outlineText: "text-rose-800 dark:text-rose-200",
      outlineBorder: "border-rose-300/80 dark:border-rose-800/60",
      ghostText: "text-rose-800 dark:text-rose-200",
      glow: "after:shadow-[0_0_0_1px_rgba(244,63,94,0.16)]",
      tint: "bg-rose-50/60 dark:bg-rose-950/18",
    },
    azulPetroleo: {
      ring: "focus-visible:ring-cyan-500/55",
      solid: "from-cyan-800 via-cyan-900 to-slate-900 text-white border-cyan-950/50",
      outlineText: "text-cyan-900 dark:text-cyan-200",
      outlineBorder: "border-cyan-300/80 dark:border-cyan-800/60",
      ghostText: "text-cyan-900 dark:text-cyan-200",
      glow: "after:shadow-[0_0_0_1px_rgba(6,182,212,0.14)]",
      tint: "bg-cyan-50/55 dark:bg-slate-950/25",
    },
  };

  const pal = palette[cor] || palette.azulPetroleo;

  /* ====== tone classes (glass/outline/ghost) ====== */
  const toneClasses =
    tone === "ghost"
      ? [
          "bg-transparent border border-transparent",
          pal.ghostText,
          "hover:bg-black/5 dark:hover:bg-white/10",
          "hover:shadow-[0_10px_18px_-16px_rgba(0,0,0,0.25)]",
        ].join(" ")
      : tone === "solid"
      ? [
          "bg-gradient-to-br",
          pal.solid,
          "border",
          "hover:brightness-[1.06]",
          "hover:shadow-[0_14px_26px_-20px_rgba(0,0,0,0.35)]",
        ].join(" ")
      : [
          // ✅ OUTLINE (default): tech glass com borda colorida
          "bg-white/50 dark:bg-zinc-900/20 backdrop-blur",
          "border",
          pal.outlineBorder,
          pal.outlineText,
          "hover:bg-white/70 dark:hover:bg-zinc-800/25",
          "hover:shadow-[0_14px_26px_-20px_rgba(0,0,0,0.35)]",
          pal.glow,
        ].join(" ");

  /* ====== Tag + props ====== */
  const Tag = as || (href ? "a" : "button");

  const isDisabled = disabled || loading;

  const commonProps = href
    ? {
        href: isDisabled ? undefined : href,
        target,
        rel: rel ?? (target === "_blank" ? "noopener noreferrer" : undefined),
        role: "button",
        tabIndex: isDisabled ? -1 : 0,
        "aria-disabled": isDisabled || undefined,
        download,
        onClick: isDisabled
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
            }
          : onClick,
      }
    : {
        type: "button",
        onClick: isDisabled ? undefined : onClick,
        disabled: isDisabled,
      };

  /* ====== base classes (tech chip) ====== */
  const base = [
    "relative isolate",
    "inline-flex items-center justify-center select-none",
    "font-extrabold tracking-tight",
    "transition-all duration-200",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900",
    pal.ring,
    "shadow-[0_10px_22px_-18px_rgba(0,0,0,0.30)]",
    "active:translate-y-[1px]",
    "disabled:opacity-60 disabled:cursor-not-allowed",
    "whitespace-nowrap",
    // sheen sutil (não exagerado)
    "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none",
    "before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-200",
    "before:bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_55%)]",
    // after: contorno sutil (glow já vem em pal.glow quando outline)
    "after:content-[''] after:absolute after:inset-0 after:rounded-[inherit] after:pointer-events-none",
  ].join(" ");

  const widthCls = fullWidth ? "w-full" : "w-auto";

  /* ====== ícones (retrocompat) ====== */
  const left = leftIcon ?? icon ?? null;

  return (
    <Tag
      {...commonProps}
      title={title}
      aria-label={ariaLabel || label}
      aria-busy={loading || undefined}
      className={[
        base,
        sizeMap[size] || sizeMap.md,
        roundMap[shape] || roundMap.full,
        toneClasses,
        widthCls,
        className,
      ].join(" ")}
      data-variant="BotaoAcao"
      data-tone={tone}
      data-color={cor}
      data-size={size}
    >
      {loading ? (
        <span
          className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full motion-safe:animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <>
          {left && (
            <span className="shrink-0 opacity-95" aria-hidden="true">
              {left}
            </span>
          )}

          <span className="min-w-0 truncate">{label}</span>

          {rightIcon && (
            <span className="shrink-0 opacity-95" aria-hidden="true">
              {rightIcon}
            </span>
          )}
        </>
      )}
    </Tag>
  );
}

BotaoAcao.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.node,
  onClick: PropTypes.func,
  cor: PropTypes.oneOf([
    "blue",
    "purple",
    "green",
    "gray",
    "red",
    "orange",
    "verde",
    "amareloOuro",
    "laranjaQueimado",
    "vermelhoCoral",
    "azulPetroleo",
  ]),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  className: PropTypes.string,

  tone: PropTypes.oneOf(["solid", "outline", "ghost"]),
  size: PropTypes.oneOf(["xs", "sm", "md"]),
  shape: PropTypes.oneOf(["full", "lg", "md"]),
  ariaLabel: PropTypes.string,
  title: PropTypes.string,
  href: PropTypes.string,
  target: PropTypes.string,
  rel: PropTypes.string,
  as: PropTypes.string,
  leftIcon: PropTypes.node,
  rightIcon: PropTypes.node,
  fullWidth: PropTypes.bool,
  download: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
};
