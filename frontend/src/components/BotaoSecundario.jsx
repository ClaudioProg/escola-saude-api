import PropTypes from "prop-types";
import { forwardRef, useMemo } from "react";

const cx = (...c) => c.filter(Boolean).join(" ");

/**
 * Botão secundário — PREMIUM++++ (tech glass + outline/ghost, não chapado, a11y)
 * - Visual: glass + borda translúcida + sheen sutil + shadow controlada
 * - Diferenciação real do Primário: por padrão NÃO é solid chamativo
 * - A11y: aria-busy, aria-disabled (links), aria-live, focus ring por cor
 * - UX: bloqueia clique em loading/disabled; spinner respeita reduced-motion
 */
const BotaoSecundario = forwardRef(function BotaoSecundario(
  {
    children,
    onClick,
    type = "button",
    as = "button", // 'button' | 'a'
    href,
    target,
    rel,
    download,
    className = "",
    disabled = false,
    loading = false,
    leftIcon = null,
    rightIcon = null,
    size = "md", // sm | md | lg
    fullWidth = false,

    // ✅ variantes
    // neutral: “glass” levemente preenchido (default)
    // outline: vidro transparente + borda colorida
    // ghost: sem borda, hover sutil
    variant = "neutral", // neutral | outline | ghost

    // ✅ cores (controladas)
    cor = "azulPetroleo", // verde | amareloOuro | laranjaQueimado | vermelhoCoral | azulPetroleo

    "aria-label": ariaLabel,
    tabIndex = 0,
    style = {},
    title,
    ...props
  },
  ref
) {
  const isBtn = as !== "a";
  const isDisabled = disabled || loading;

  const sizeClasses =
    size === "sm"
      ? "px-3.5 py-2 text-[13px] min-h-[38px]"
      : size === "lg"
      ? "px-5 py-3 text-[14px] min-h-[48px]"
      : "px-4.5 py-2.5 text-[14px] min-h-[42px]";

  /**
   * 🎨 Paletas premium por cor (controladas)
   * - text: cor do texto/ícone
   * - ring: focus ring
   * - border: borda do outline
   * - glow: glow discreto (after)
   * - tint: leve “tinta” do neutral (glass fill)
   */
  const tones = useMemo(
    () => ({
      verde: {
        text: "text-emerald-900 dark:text-emerald-200",
        ring: "focus-visible:ring-emerald-500/55",
        border: "border-emerald-300/75 dark:border-emerald-800/55",
        glow: "after:shadow-[0_0_0_1px_rgba(16,185,129,0.20)]",
        tint: "bg-emerald-50/70 dark:bg-emerald-950/25",
        hoverTint: "hover:bg-emerald-50/90 dark:hover:bg-emerald-900/15",
      },
      amareloOuro: {
        text: "text-amber-900 dark:text-amber-200",
        ring: "focus-visible:ring-amber-400/60",
        border: "border-amber-300/80 dark:border-amber-800/55",
        glow: "after:shadow-[0_0_0_1px_rgba(245,158,11,0.18)]",
        tint: "bg-amber-50/70 dark:bg-amber-950/20",
        hoverTint: "hover:bg-amber-50/95 dark:hover:bg-amber-900/14",
      },
      laranjaQueimado: {
        text: "text-orange-900 dark:text-orange-200",
        ring: "focus-visible:ring-orange-400/60",
        border: "border-orange-300/80 dark:border-orange-800/55",
        glow: "after:shadow-[0_0_0_1px_rgba(249,115,22,0.16)]",
        tint: "bg-orange-50/70 dark:bg-orange-950/18",
        hoverTint: "hover:bg-orange-50/95 dark:hover:bg-orange-900/14",
      },
      vermelhoCoral: {
        text: "text-rose-800 dark:text-rose-200",
        ring: "focus-visible:ring-rose-400/60",
        border: "border-rose-300/80 dark:border-rose-800/55",
        glow: "after:shadow-[0_0_0_1px_rgba(244,63,94,0.18)]",
        tint: "bg-rose-50/70 dark:bg-rose-950/20",
        hoverTint: "hover:bg-rose-50/95 dark:hover:bg-rose-900/14",
      },
      azulPetroleo: {
        text: "text-cyan-900 dark:text-cyan-200",
        ring: "focus-visible:ring-cyan-500/55",
        border: "border-cyan-300/80 dark:border-cyan-800/55",
        glow: "after:shadow-[0_0_0_1px_rgba(6,182,212,0.16)]",
        tint: "bg-cyan-50/65 dark:bg-slate-950/25",
        hoverTint: "hover:bg-cyan-50/90 dark:hover:bg-slate-800/30",
      },
    }),
    []
  );

  const tone = tones[cor] || tones.azulPetroleo;

  /**
   * ✅ Base premium “tech glass”
   * - before: sheen radial (highlight)
   * - after: borda/glow sutil
   * - shadow: discreta (não chapada)
   */
  const base = cx(
    "relative isolate",
    "inline-flex items-center justify-center gap-2",
    "rounded-2xl",
    "font-extrabold tracking-tight",
    "shadow-[0_10px_22px_-18px_rgba(0,0,0,0.30)]",
    "transition-all duration-200",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-800",
    tone.ring,
    "whitespace-nowrap flex-nowrap leading-none",
    "active:translate-y-[1px]",
    "disabled:opacity-60 disabled:cursor-not-allowed select-none",
    // camadas
    "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none",
    "before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-200",
    "before:bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.22),transparent_55%)]",
    "after:content-[''] after:absolute after:inset-0 after:rounded-[inherit] after:pointer-events-none"
  );

  /**
   * ✅ Variants: neutral | outline | ghost
   * - neutral: vidro levemente preenchido (ótimo pro “Google Agenda”)
   * - outline: vidro transparente + borda colorida
   * - ghost: minimalista com hover sutil
   */
  const variants = {
    neutral: cx(
      tone.tint,
      tone.text,
      "backdrop-blur",
      "border border-white/50 dark:border-white/10",
      "hover:shadow-[0_14px_28px_-20px_rgba(0,0,0,0.35)]",
      tone.hoverTint,
      tone.glow
    ),
    outline: cx(
      "bg-white/40 dark:bg-zinc-900/15 backdrop-blur",
      tone.text,
      "border",
      tone.border,
      "hover:bg-white/55 dark:hover:bg-zinc-800/20",
      "hover:shadow-[0_14px_28px_-20px_rgba(0,0,0,0.35)]",
      tone.glow
    ),
    ghost: cx(
      "bg-transparent",
      tone.text,
      "border border-transparent",
      "hover:bg-black/5 dark:hover:bg-white/10",
      "hover:shadow-[0_10px_22px_-18px_rgba(0,0,0,0.22)]"
    ),
  };

  const classes = cx(
    base,
    variants[variant] ?? variants.neutral,
    sizeClasses,
    fullWidth ? "w-full" : "w-auto",
    isDisabled ? "pointer-events-none" : "",
    "touch-manipulation",
    className
  );

  const spinner = (
    <span
      className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full motion-safe:animate-spin motion-reduce:animate-none"
      aria-hidden="true"
    />
  );

  const Content = (
    <>
      {loading ? (
        spinner
      ) : leftIcon ? (
        <span className="shrink-0 opacity-95" aria-hidden="true">
          {leftIcon}
        </span>
      ) : null}

      {/* ✅ conteúdo trava em 1 linha e não quebra */}
      <span className={cx("min-w-0 truncate", loading ? "opacity-90" : "")}>{children}</span>

      {rightIcon ? (
        <span className="shrink-0 opacity-95" aria-hidden="true">
          {rightIcon}
        </span>
      ) : null}
    </>
  );

  if (!isBtn) {
    return (
      <a
        ref={ref}
        href={isDisabled ? undefined : href}
        target={target}
        rel={rel ?? (target === "_blank" ? "noopener noreferrer" : undefined)}
        download={download}
        aria-label={ariaLabel}
        aria-disabled={isDisabled || undefined}
        aria-busy={loading || undefined}
        aria-live={loading ? "polite" : undefined}
        tabIndex={tabIndex}
        style={style}
        className={classes}
        role="button"
        title={title}
        data-variant="BotaoSecundario"
        data-color={cor}
        data-tone={variant}
        onClick={(e) => {
          if (isDisabled) e.preventDefault();
          else onClick?.(e);
        }}
        {...props}
      >
        {Content}
      </a>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-live={loading ? "polite" : undefined}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      style={style}
      className={classes}
      title={title}
      data-variant="BotaoSecundario"
      data-color={cor}
      data-tone={variant}
      {...props}
    >
      {Content}
    </button>
  );
});

BotaoSecundario.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(["button", "submit", "reset"]),
  as: PropTypes.oneOf(["button", "a"]),
  href: PropTypes.string,
  target: PropTypes.string,
  rel: PropTypes.string,
  download: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  className: PropTypes.string,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  leftIcon: PropTypes.node,
  rightIcon: PropTypes.node,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  fullWidth: PropTypes.bool,
  variant: PropTypes.oneOf(["neutral", "outline", "ghost"]),
  cor: PropTypes.oneOf(["verde", "amareloOuro", "laranjaQueimado", "vermelhoCoral", "azulPetroleo"]),
  "aria-label": PropTypes.string,
  tabIndex: PropTypes.number,
  style: PropTypes.object,
  title: PropTypes.string,
};

export default BotaoSecundario;
