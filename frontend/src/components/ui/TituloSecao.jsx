// 📁 src/components/ui/TituloSecao.jsx
import PropTypes from "prop-types";
import { useEffect, useState } from "react";

/**
 * Título de seção semântico, responsivo e moderno.
 * - Gradiente 3-cores (accent configurável).
 * - Ícone, subtítulo, kicker (eyebrow), ações e contador opcionais.
 * - Acessível (heading real + aria-level quando aplicável).
 * - Tamanhos sm/md/lg/xl; alinhamento flexível; linha decorativa customizável.
 * - Suporte a anchor-link (#id), sticky, animação respeitando prefers-reduced-motion.
 */
export default function TituloSecao({
  children,
  subtitle,
  icon = null,
  size = "md",
  align = "left",
  accent = "lousa", // emerald|violet|amber|rose|teal|indigo|petroleo|orange|sky|lousa
  id,
  className = "",
  noBorder = false,

  // 🔥 Novos opcionais (backward-compatible)
  level = 2,              // 1..6 (define semântica do heading)
  as,                     // força a tag (ex.: "h2", "div")
  kicker,                 // eyebrow pequeno acima do título
  actions,                // nó à direita (botões, filtros, etc.)
  count,                  // número/badge ao lado do título
  anchor = false,         // mostra ícone de link que ancora em `id`
  sticky = false,         // torna o header "grudado" no topo da seção
  animate = true,         // entrada suave (respeita reduced-motion)
  borderWidth = "3px",    // espessura da linha decorativa
  borderWidthSm = "3px",  // espessura em telas maiores
  borderLength = "4rem",  // largura da linha (mobile)
  borderLengthSm = "6rem" // largura da linha (sm+)
}) {
  // motion respeitando preferências do usuário
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const handler = () => setReducedMotion(Boolean(mq?.matches));
    handler();
    mq?.addEventListener?.("change", handler);
    return () => mq?.removeEventListener?.("change", handler);
  }, []);

  const sizes = {
    sm: "text-lg sm:text-xl",
    md: "text-xl sm:text-2xl",
    lg: "text-2xl sm:text-3xl",
    xl: "text-3xl sm:text-4xl",
  };

  const alignments = {
    left: "text-left items-start",
    center: "text-center items-center",
    right: "text-right items-end",
  };

  const accents = {
    emerald: "from-emerald-900 via-emerald-700 to-emerald-500",
    violet: "from-violet-900 via-violet-700 to-violet-500",
    amber: "from-amber-900 via-amber-700 to-amber-500",
    rose: "from-rose-900 via-rose-700 to-rose-500",
    teal: "from-teal-900 via-teal-700 to-teal-500",
    indigo: "from-indigo-900 via-indigo-700 to-indigo-500",
    petroleo: "from-slate-900 via-teal-900 to-slate-700",
    orange: "from-orange-900 via-orange-700 to-orange-500",
    sky: "from-sky-900 via-sky-700 to-sky-500",
    lousa: "from-[#0f2c1f] via-[#114b2d] to-[#166534]",
  };

  const grad = accents[accent] ?? accents.lousa;

  // heading tag semântica automática, a menos que `as` seja fornecido
  const safeLevel = Math.min(6, Math.max(1, Number(level) || 2));
  const AutoTag = as || (`h${safeLevel}`);

  // borda decorativa custom sem util arbitrária (usa style inline)
  const BorderLine = !noBorder ? (
    <div
      aria-hidden
      className="relative mt-1"
      style={{
        height: 0,
      }}
    >
      <div
        className="rounded-full bg-gradient-to-r"
        style={{
          backgroundImage: `linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to))`,
        }}
      />
      <style>{`
        /* aplica gradiente com classes existentes */
      `}</style>
      <div
        className={`after:content-[''] after:block after:rounded-full after:bg-gradient-to-r after:${grad}`}
        style={{
          height: borderWidth,
          width: borderLength,
        }}
      />
      <div
        className={`hidden sm:block after:content-[''] after:rounded-full after:bg-gradient-to-r after:${grad}`}
        style={{
          height: borderWidthSm,
          width: borderLengthSm,
        }}
      />
    </div>
  ) : null;

  // container sticky opcional
  const stickyCls = sticky ? "sticky top-0 z-10 bg-white/70 dark:bg-gray-900/70 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md py-2" : "";

  // animação sutil
  const animCls = animate && !reducedMotion ? "motion-safe:animate-[fadeInUp_.5s_ease-out]" : "";
  const animKeyframes = `
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;

  return (
    <div
      id={id}
      className={[
        "flex flex-col w-full mb-6",
        alignments[align],
        stickyCls,
        animCls,
        className,
      ].filter(Boolean).join(" ")}
    >
      {animate && !reducedMotion && <style>{animKeyframes}</style>}

      {/* Kicker + ações */}
      {(kicker || actions) && (
        <div className={[
          "flex w-full gap-3 mb-1",
          align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-between",
        ].join(" ")}>
          {kicker && (
            <div className="text-[11px] sm:text-xs font-semibold tracking-wide uppercase text-gray-600 dark:text-gray-300">
              {kicker}
            </div>
          )}
          {actions && (
            <div className={align === "left" ? "ml-auto" : ""}>
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Linha principal: ícone + título + count + anchor */}
      <div className="flex items-center gap-2">
        {icon && (
          <span className="text-verde-900 dark:text-verde-800 shrink-0" aria-hidden>
            {icon}
          </span>
        )}

        <AutoTag
          role={/h[1-6]/i.test(String(AutoTag)) ? undefined : "heading"}
          aria-level={/h[1-6]/i.test(String(AutoTag)) ? undefined : safeLevel}
          className={[
            "font-bold tracking-tight leading-snug text-transparent bg-clip-text bg-gradient-to-br",
            grad,
            sizes[size],
            "dark:brightness-110",
          ].join(" ")}
        >
          {children}
        </AutoTag>

        {typeof count !== "undefined" && count !== null && (
          <span
            className="ml-1 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-black/10 dark:bg-white/10 text-gray-800 dark:text-gray-100"
            aria-label={`Quantidade: ${count}`}
          >
            {count}
          </span>
        )}

        {anchor && id && (
          <a
            href={`#${id}`}
            className="ml-1 opacity-70 hover:opacity-100 transition text-gray-700 dark:text-gray-200"
            aria-label="Copiar link da seção"
            title="Copiar link da seção"
          >
            #
          </a>
        )}
      </div>

      {subtitle && (
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1 max-w-prose">
          {subtitle}
        </p>
      )}

      {BorderLine}
    </div>
  );
}

TituloSecao.propTypes = {
  /** Conteúdo do título */
  children: PropTypes.node.isRequired,
  /** Subtítulo opcional */
  subtitle: PropTypes.node,
  /** Ícone opcional */
  icon: PropTypes.node,
  /** Tamanho do texto */
  size: PropTypes.oneOf(["sm", "md", "lg", "xl"]),
  /** Alinhamento do título */
  align: PropTypes.oneOf(["left", "center", "right"]),
  /** Tema de cor (gradiente) */
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
  /** id opcional para ancoragem/acessibilidade */
  id: PropTypes.string,
  /** Classes adicionais */
  className: PropTypes.string,
  /** Remove linha decorativa */
  noBorder: PropTypes.bool,
  /** Nível semântico do heading (1..6) */
  level: PropTypes.oneOf([1, 2, 3, 4, 5, 6]),
  /** Força a tag (ex.: "h2", "div") */
  as: PropTypes.oneOfType([PropTypes.string, PropTypes.elementType]),
  /** Eyebrow acima do título */
  kicker: PropTypes.node,
  /** Slot de ações à direita (botões, filtros) */
  actions: PropTypes.node,
  /** Badge/contador ao lado do título */
  count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  /** Mostrar link âncora (usa `id`) */
  anchor: PropTypes.bool,
  /** Header sticky */
  sticky: PropTypes.bool,
  /** Animação de entrada */
  animate: PropTypes.bool,
  /** Personalização da linha decorativa */
  borderWidth: PropTypes.string,
  borderWidthSm: PropTypes.string,
  borderLength: PropTypes.string,
  borderLengthSm: PropTypes.string,
};
