// 📁 src/components/NenhumDado.jsx
import { AlertCircle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import PropTypes from "prop-types";
import { useId, useMemo } from "react";

const sizeMap = {
  sm: { wrap: "w-12 h-12", icon: "w-6 h-6", title: "text-base", hint: "text-xs" },
  md: { wrap: "w-16 h-16", icon: "w-8 h-8", title: "text-lg", hint: "text-sm" },
  lg: { wrap: "w-20 h-20", icon: "w-10 h-10", title: "text-xl", hint: "text-base" },
};

// degradê 3 cores (harmoniza com o restante do app)
const VARIANT_RING = {
  emerald: "from-emerald-500 via-teal-500 to-lime-500",
  indigo: "from-indigo-500 via-violet-500 to-fuchsia-500",
  cyan: "from-cyan-500 via-sky-500 to-blue-500",
  rose: "from-rose-500 via-red-500 to-orange-500",
  slate: "from-slate-500 via-zinc-500 to-stone-500",
};

export default function NenhumDado({
  mensagem = "Nenhum dado encontrado.",
  sugestao,
  Icone = AlertCircle,
  ctaLabel,
  onCta,
  actions, // [{label,onClick,icon?,variant?('primary'|'secondary')}]
  size = "md",
  bordered = false,
  iconBackground = true,
  variant = "indigo",
  ariaLive = "polite", // 'polite' | 'assertive' | null (desliga role/aria-live)
  className = "",
  "data-testid": testId = "nenhum-dado",
}) {
  const s = sizeMap[size] || sizeMap.md;
  const reduceMotion = useReducedMotion();
  const ring = VARIANT_RING[variant] || VARIANT_RING.indigo;

  const uid = useId();
  const descId = sugestao ? `${testId}-${uid}-desc` : undefined;

  // compat com props antigas (ctaLabel/onCta)
  const mergedActions = useMemo(() => {
    if (Array.isArray(actions) && actions.length) return actions;
    if (ctaLabel && typeof onCta === "function") return [{ label: ctaLabel, onClick: onCta, variant: "primary" }];
    return [];
  }, [actions, ctaLabel, onCta]);

  const hasLive = ariaLive === "polite" || ariaLive === "assertive";

  return (
    <motion.div
      className={[
        "flex flex-col items-center justify-center py-10 px-4 text-gray-600 dark:text-gray-300",
        bordered ? "rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" : "",
        className,
      ].join(" ")}
      role={hasLive ? "status" : undefined}
      aria-live={hasLive ? ariaLive : undefined}
      aria-atomic={hasLive ? "true" : undefined}
      aria-describedby={descId}
      initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      animate={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.35, ease: "easeOut" }}
      data-testid={testId}
    >
      <div
        className={[
          "inline-flex items-center justify-center mb-4 relative overflow-hidden",
          iconBackground
            ? "rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow"
            : "",
          s.wrap,
        ].join(" ")}
        aria-hidden="true"
      >
        {iconBackground && <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${ring}`} />}
        <Icone
          className={[
            s.icon,
            // mantém seu token com fallback elegante:
            "text-lousa dark:text-white text-slate-800 dark:text-white",
            "relative",
          ].join(" ")}
        />
      </div>

      <p className={`${s.title} font-semibold text-center text-slate-800 dark:text-slate-100`}>
        {mensagem}
      </p>

      {sugestao && (
        <p
          id={descId}
          className={`${s.hint} text-gray-500 dark:text-gray-400 mt-1 text-center`}
        >
          {sugestao}
        </p>
      )}

      {mergedActions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {mergedActions.map((a, i) => {
            const isPrimary = (a.variant || "primary") === "primary";
            return (
              <button
                key={`${a.label}-${i}`}
                type="button"
                onClick={a.onClick}
                className={[
                  "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition",
                  "focus-visible:ring-2 focus-visible:ring-offset-2",
                  "active:scale-[.99]",
                  isPrimary
                    ? "bg-lousa bg-slate-900 text-white hover:opacity-90 focus-visible:ring-lousa focus-visible:ring-slate-900"
                    : "bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 focus-visible:ring-gray-400",
                ].join(" ")}
              >
                {a.icon ? a.icon : null}
                {a.label}
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

NenhumDado.propTypes = {
  mensagem: PropTypes.string,
  sugestao: PropTypes.string,
  Icone: PropTypes.elementType,
  ctaLabel: PropTypes.string,
  onCta: PropTypes.func,
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
      icon: PropTypes.node,
      variant: PropTypes.oneOf(["primary", "secondary"]),
    })
  ),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  bordered: PropTypes.bool,
  iconBackground: PropTypes.bool,
  variant: PropTypes.oneOf(["emerald", "indigo", "cyan", "rose", "slate"]),
  ariaLive: PropTypes.oneOf(["polite", "assertive", null]),
  className: PropTypes.string,
  "data-testid": PropTypes.string,
};
