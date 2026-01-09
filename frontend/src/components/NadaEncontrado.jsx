// 📁 src/components/NadaEncontrado.jsx
import PropTypes from "prop-types";
import { SearchX } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useId, useMemo } from "react";

const SIZE_MAP = {
  sm: { wrap: "w-14 h-14", icon: "w-8 h-8", title: "text-base", hint: "text-xs" },
  md: { wrap: "w-20 h-20", icon: "w-10 h-10", title: "text-lg md:text-xl", hint: "text-sm md:text-base" },
  lg: { wrap: "w-24 h-24", icon: "w-12 h-12", title: "text-xl md:text-2xl", hint: "text-base md:text-lg" },
};

// Degradês de 3 cores para harmonizar com o restante do app
const VARIANT_RING = {
  emerald: "from-emerald-500 via-teal-500 to-lime-500",
  indigo:  "from-indigo-500 via-violet-500 to-fuchsia-500",
  cyan:    "from-cyan-500 via-sky-500 to-blue-500",
  rose:    "from-rose-500 via-red-500 to-orange-500",
  slate:   "from-slate-500 via-zinc-500 to-stone-500",
};

export default function NadaEncontrado({
  mensagem = "Nenhum dado encontrado.",
  sugestao,
  Icone = SearchX,          // permite customizar o ícone
  acao,                      // { label: string, onClick: func } (compat)
  actions,                   // [{ label, onClick, icon?:Node, variant?:'primary'|'secondary' }]
  size = "md",               // 'sm' | 'md' | 'lg'
  variant = "indigo",        // harmonia de cor/gradiente
  className = "",
  iconClassName = "",
  testId = "nada-encontrado",
}) {
  const reduceMotion = useReducedMotion();
  const uid = useId();

  const sz = SIZE_MAP[size] || SIZE_MAP.md;
  const ring = VARIANT_RING[variant] || VARIANT_RING.indigo;

  // Ações combinadas (mantém compat c/ prop antiga `acao`)
  const mergedActions = useMemo(() => {
    if (Array.isArray(actions) && actions.length) return actions;
    if (acao?.label && typeof acao.onClick === "function") return [{ ...acao, variant: "primary" }];
    return [];
  }, [actions, acao]);

  const descId = `${testId}-${uid}-desc`;

  return (
    <motion.div
      className={`text-center py-10 px-4 text-gray-600 dark:text-gray-300 ${className}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-describedby={sugestao ? descId : undefined}
      data-testid={testId}
      initial={
        reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }
      }
      animate={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.35, ease: "easeOut" }}
    >
      <div
        className={[
          "inline-flex items-center justify-center mb-4 rounded-full border shadow",
          "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800",
          "relative overflow-hidden",
          sz.wrap,
        ].join(" ")}
        aria-hidden="true"
      >
        {/* anel em degradê 3 cores (sutil) */}
        <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${ring}`} />
        <Icone
          className={[
            sz.icon,
            // mantém seu token (se existir), com fallback elegante:
            "text-lousa dark:text-white text-slate-800 dark:text-white",
            "relative",
            iconClassName,
          ].join(" ")}
        />
      </div>

      <p className={`${sz.title} font-semibold text-slate-800 dark:text-slate-100`}>
        {mensagem}
      </p>

      {sugestao && (
        <p
          id={descId}
          className={`${sz.hint} text-gray-500 dark:text-gray-400 mt-1`}
        >
          {sugestao}
        </p>
      )}

      {mergedActions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {mergedActions.map((a, idx) => {
            const primary = (a.variant || "primary") === "primary";
            return (
              <button
                key={`${a.label}-${idx}`}
                type="button"
                onClick={a.onClick}
                className={[
                  "inline-flex items-center gap-2 px-4 py-2 rounded-lg transition",
                  "focus-visible:ring-2 focus-visible:ring-offset-2",
                  "active:scale-[.99]",
                  primary
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

NadaEncontrado.propTypes = {
  mensagem: PropTypes.string,
  sugestao: PropTypes.string,
  Icone: PropTypes.elementType,
  acao: PropTypes.shape({
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
  }),
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
      icon: PropTypes.node,
      variant: PropTypes.oneOf(["primary", "secondary"]),
    })
  ),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  variant: PropTypes.oneOf(["emerald", "indigo", "cyan", "rose", "slate"]),
  className: PropTypes.string,
  iconClassName: PropTypes.string,
  testId: PropTypes.string,
};
