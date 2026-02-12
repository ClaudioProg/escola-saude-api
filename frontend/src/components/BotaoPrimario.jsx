import PropTypes from "prop-types";
import { forwardRef, useMemo } from "react";

/**
 * Botão primário padrão da plataforma — PREMIUM++++ (tech, não chapado, a11y)
 * - Visual: gradiente com profundidade + highlight sutil + “glow” controlado + shadow premium
 * - Estados: hover/active/disabled/loading com microinterações discretas
 * - A11y: focus ring, aria-busy, aria-live, sem props vazando pro DOM
 * - Mantém compat: leftIcon/rightIcon + iconLeft/iconRight etc.
 */
const BotaoPrimario = forwardRef(function BotaoPrimario(
  {
    children,
    onClick,
    type = "button",
    className = "",
    disabled = false,
    loading = false,

    // ✅ padrão
    leftIcon = null,
    rightIcon = null,

    // ✅ aliases p/ compat
    iconLeft = null,
    iconRight = null,
    iconleft = null,
    iconright = null,

    size = "md", // sm | md | lg
    fullWidth = false,
    minWidth = 120,

    // ✅ cor e shape
    cor = "laranjaQueimado", // verde | amareloOuro | laranjaQueimado | vermelhoCoral | azulPetroleo | cinza
    shape = "rounded-2xl", // rounded-md | rounded-lg | rounded-2xl | rounded-full
    tone = "solid", // solid | outline | ghost

    href,
    target,
    rel,
    as,
    download,
    style,
    "aria-label": ariaLabel,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  // ✅ resolve aliases (prioridade: leftIcon/rightIcon)
  const _leftIcon = leftIcon ?? iconLeft ?? iconleft ?? null;
  const _rightIcon = rightIcon ?? iconRight ?? iconright ?? null;

  const Tag = as || (href ? "a" : "button");

  const sizes = useMemo(
    () => ({
      sm: "px-4 py-2 text-[13px] min-h-[38px]",
      md: "px-5 py-2.5 text-[14px] min-h-[42px]",
      lg: "px-6 py-3 text-[15px] min-h-[48px]",
    }),
    []
  );
  const sizeClasses = sizes[size] || sizes.md;

  /**
   * 🎨 Paleta premium (com camadas)
   * - solid: gradiente + overlay highlight + sombra + borda translúcida
   * - outline: vidro + borda colorida + texto forte (sem ficar “chapado”)
   * - ghost: vidro leve + hover “ink” sutil
   */
  const palette = {
    verde: {
      ring: "focus-visible:ring-emerald-500/50",
      solid: [
        // base (profundidade)
        "text-white",
        "bg-gradient-to-br from-[#0b2a1d] via-[#0f4a2c] to-[#1b7a46]",
        "border border-emerald-950/35",
        // shadow premium
        "shadow-[0_10px_24px_-12px_rgba(16,185,129,0.45)]",
      ].join(" "),
      outline: [
        "text-emerald-900 dark:text-emerald-200",
        "bg-white/70 dark:bg-zinc-900/25 backdrop-blur",
        "border border-emerald-300/70 dark:border-emerald-800/55",
        "shadow-[0_10px_24px_-14px_rgba(16,185,129,0.25)]",
        "hover:bg-emerald-50/70 dark:hover:bg-emerald-900/15",
      ].join(" "),
      ghost: [
        "text-emerald-900 dark:text-emerald-200",
        "bg-transparent border border-transparent",
        "hover:bg-emerald-50/60 dark:hover:bg-white/10",
      ].join(" "),
      glow: "after:shadow-[0_0_0_1px_rgba(16,185,129,0.25)]",
      sheen: "before:from-white/20 before:to-transparent",
    },

    amareloOuro: {
      ring: "focus-visible:ring-amber-400/55",
      solid: [
        "text-[#1a1400]",
        "bg-gradient-to-br from-[#f7d56a] via-[#f2b832] to-[#d68a0c]",
        "border border-amber-900/25",
        "shadow-[0_10px_24px_-12px_rgba(245,158,11,0.40)]",
      ].join(" "),
      outline: [
        "text-amber-900 dark:text-amber-200",
        "bg-white/70 dark:bg-zinc-900/25 backdrop-blur",
        "border border-amber-300/75 dark:border-amber-800/55",
        "shadow-[0_10px_24px_-14px_rgba(245,158,11,0.25)]",
        "hover:bg-amber-50/70 dark:hover:bg-amber-900/15",
      ].join(" "),
      ghost: [
        "text-amber-900 dark:text-amber-200",
        "bg-transparent border border-transparent",
        "hover:bg-amber-50/60 dark:hover:bg-white/10",
      ].join(" "),
      glow: "after:shadow-[0_0_0_1px_rgba(245,158,11,0.22)]",
      sheen: "before:from-white/22 before:to-transparent",
    },

    laranjaQueimado: {
      ring: "focus-visible:ring-orange-400/55",
      solid: [
        "text-white",
        "bg-gradient-to-br from-[#7a2f00] via-[#c24a06] to-[#ff8a1f]",
        "border border-orange-950/25",
        "shadow-[0_10px_24px_-12px_rgba(249,115,22,0.40)]",
      ].join(" "),
      outline: [
        "text-orange-800 dark:text-orange-200",
        "bg-white/70 dark:bg-zinc-900/25 backdrop-blur",
        "border border-orange-300/75 dark:border-orange-800/55",
        "shadow-[0_10px_24px_-14px_rgba(249,115,22,0.25)]",
        "hover:bg-orange-50/70 dark:hover:bg-orange-900/15",
      ].join(" "),
      ghost: [
        "text-orange-800 dark:text-orange-200",
        "bg-transparent border border-transparent",
        "hover:bg-orange-50/60 dark:hover:bg-white/10",
      ].join(" "),
      glow: "after:shadow-[0_0_0_1px_rgba(249,115,22,0.20)]",
      sheen: "before:from-white/20 before:to-transparent",
    },

    vermelhoCoral: {
      ring: "focus-visible:ring-rose-400/55",
      solid: [
        "text-white",
        "bg-gradient-to-br from-[#5b0a12] via-[#c81d35] to-[#ff5a7a]",
        "border border-rose-950/25",
        "shadow-[0_10px_24px_-12px_rgba(244,63,94,0.42)]",
      ].join(" "),
      outline: [
        "text-rose-700 dark:text-rose-200",
        "bg-white/70 dark:bg-zinc-900/25 backdrop-blur",
        "border border-rose-300/75 dark:border-rose-800/55",
        "shadow-[0_10px_24px_-14px_rgba(244,63,94,0.25)]",
        "hover:bg-rose-50/70 dark:hover:bg-rose-900/15",
      ].join(" "),
      ghost: [
        "text-rose-700 dark:text-rose-200",
        "bg-transparent border border-transparent",
        "hover:bg-rose-50/60 dark:hover:bg-white/10",
      ].join(" "),
      glow: "after:shadow-[0_0_0_1px_rgba(244,63,94,0.22)]",
      sheen: "before:from-white/18 before:to-transparent",
    },

    azulPetroleo: {
      ring: "focus-visible:ring-cyan-500/50",
      solid: [
        "text-white",
        "bg-gradient-to-br from-[#08323a] via-[#0b4b57] to-[#0f172a]",
        "border border-cyan-950/35",
        "shadow-[0_10px_24px_-12px_rgba(6,182,212,0.32)]",
      ].join(" "),
      outline: [
        "text-cyan-900 dark:text-cyan-200",
        "bg-white/70 dark:bg-zinc-900/25 backdrop-blur",
        "border border-cyan-300/75 dark:border-cyan-800/55",
        "shadow-[0_10px_24px_-14px_rgba(6,182,212,0.20)]",
        "hover:bg-cyan-50/70 dark:hover:bg-slate-800/30",
      ].join(" "),
      ghost: [
        "text-cyan-900 dark:text-cyan-200",
        "bg-transparent border border-transparent",
        "hover:bg-cyan-50/60 dark:hover:bg-white/10",
      ].join(" "),
      glow: "after:shadow-[0_0_0_1px_rgba(6,182,212,0.18)]",
      sheen: "before:from-white/16 before:to-transparent",
    },

    cinza: {
      ring: "focus-visible:ring-slate-400/55",
      solid: [
        "text-white",
        "bg-gradient-to-br from-[#111827] via-[#334155] to-[#0b1220]",
        "border border-slate-950/35",
        "shadow-[0_10px_24px_-12px_rgba(148,163,184,0.25)]",
      ].join(" "),
      outline: [
        "text-slate-900 dark:text-zinc-100",
        "bg-white/70 dark:bg-zinc-900/25 backdrop-blur",
        "border border-slate-300/75 dark:border-zinc-700/65",
        "shadow-[0_10px_24px_-14px_rgba(148,163,184,0.18)]",
        "hover:bg-slate-50/70 dark:hover:bg-zinc-800/35",
      ].join(" "),
      ghost: [
        "text-slate-900 dark:text-zinc-100",
        "bg-transparent border border-transparent",
        "hover:bg-black/5 dark:hover:bg-white/10",
      ].join(" "),
      glow: "after:shadow-[0_0_0_1px_rgba(148,163,184,0.18)]",
      sheen: "before:from-white/14 before:to-transparent",
    },
  };

  const theme = palette[cor] || palette.verde;

  const base = [
    "relative isolate",
    "inline-flex items-center justify-center gap-2",
    "font-extrabold tracking-tight",
    "select-none",
    "transition-all duration-200",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-800",
    "disabled:opacity-60 disabled:cursor-not-allowed",
    // micro motion
    "active:translate-y-[1px]",
  ].join(" ");

  // ✅ Camadas que dão “tech premium” sem exagero
  // - before: highlight sutil (sheen)
  // - after: borda/glow sutil
  const layers = [
    "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit]",
    "before:bg-gradient-to-br",
    "before:opacity-0 hover:before:opacity-100",
    "before:transition-opacity before:duration-200",
    "before:pointer-events-none",

    "after:content-[''] after:absolute after:inset-0 after:rounded-[inherit]",
    "after:pointer-events-none",
  ].join(" ");

  const toneClasses =
    tone === "outline"
      ? theme.outline
      : tone === "ghost"
      ? `${theme.ghost}`
      : `${theme.solid} hover:brightness-[1.03]`;

  const sheen =
    tone === "solid"
      ? [
          "before:mix-blend-soft-light",
          "before:opacity-0 hover:before:opacity-100",
          "before:bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.35),transparent_48%)]",
        ].join(" ")
      : theme.sheen;

  const glow =
    tone === "solid"
      ? [
          // borda/luz discretas
          "after:shadow-[0_0_0_1px_rgba(255,255,255,0.10)]",
          theme.glow,
          // sombra extra no hover (controlada)
          "hover:shadow-[0_16px_34px_-18px_rgba(0,0,0,0.35)]",
        ].join(" ")
      : theme.glow;

  // ✅ style: respeita style externo + minWidth controlado
  const computedStyle = {
    ...(style || {}),
    ...(fullWidth ? {} : { minWidth }),
  };

  // Props comuns por tag
  const commonProps = href
    ? {
        href,
        target,
        rel: rel ?? (target === "_blank" ? "noopener noreferrer" : undefined),
        role: "button",
        tabIndex: isDisabled ? -1 : 0,
        "aria-disabled": isDisabled || undefined,
        onClick: isDisabled
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
            }
          : onClick,
        download,
      }
    : {
        type,
        onClick: isDisabled ? undefined : onClick,
        disabled: isDisabled,
      };

  // ✅ NÃO deixar props custom vazar pro DOM
  // eslint-disable-next-line no-unused-vars
  const { iconRight: _a, iconLeft: _b, iconright: _c, iconleft: _d, ...safeProps } = props;

  return (
    <Tag
      ref={ref}
      {...commonProps}
      aria-busy={loading || undefined}
      aria-live={loading ? "polite" : undefined}
      aria-label={ariaLabel}
      style={computedStyle}
      className={[
        base,
        layers,
        theme.ring,
        toneClasses,
        sheen,
        glow,
        sizeClasses,
        shape,
        fullWidth ? "w-full" : "w-auto",
        // melhora clique em mobile
        "touch-manipulation",
        className,
      ].join(" ")}
      data-variant="BotaoPrimario"
      data-color={cor}
      data-tone={tone}
      {...safeProps}
    >
      {/* Spinner */}
      {loading && (
        <span
          className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full motion-safe:animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      )}

      {/* Left icon */}
      {!loading && _leftIcon && (
        <span className="inline-flex shrink-0 opacity-95" aria-hidden="true">
          {_leftIcon}
        </span>
      )}

      {/* Label */}
      <span className={loading ? "opacity-90" : ""}>{children}</span>

      {/* Right icon */}
      {!loading && _rightIcon && (
        <span className="inline-flex shrink-0 opacity-95" aria-hidden="true">
          {_rightIcon}
        </span>
      )}
    </Tag>
  );
});

BotaoPrimario.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(["button", "submit", "reset"]),
  className: PropTypes.string,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,

  leftIcon: PropTypes.node,
  rightIcon: PropTypes.node,

  iconLeft: PropTypes.node,
  iconRight: PropTypes.node,

  size: PropTypes.oneOf(["sm", "md", "lg"]),
  fullWidth: PropTypes.bool,
  minWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  cor: PropTypes.oneOf(["verde", "amareloOuro", "laranjaQueimado", "vermelhoCoral", "azulPetroleo", "cinza"]),
  shape: PropTypes.oneOf(["rounded-md", "rounded-lg", "rounded-2xl", "rounded-full"]),
  tone: PropTypes.oneOf(["solid", "outline", "ghost"]),
  href: PropTypes.string,
  target: PropTypes.string,
  rel: PropTypes.string,
  as: PropTypes.oneOfType([PropTypes.string, PropTypes.elementType]),
  download: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  style: PropTypes.object,
  "aria-label": PropTypes.string,
};

export default BotaoPrimario;
