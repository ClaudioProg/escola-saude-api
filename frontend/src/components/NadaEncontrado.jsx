// 📁 src/components/NadaEncontrado.jsx
import PropTypes from "prop-types";
import { SearchX } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const SIZE_MAP = {
  sm: { wrap: "w-14 h-14", icon: "w-8 h-8", title: "text-base", hint: "text-xs" },
  md: { wrap: "w-20 h-20", icon: "w-10 h-10", title: "text-lg md:text-xl", hint: "text-sm md:text-base" },
  lg: { wrap: "w-24 h-24", icon: "w-12 h-12", title: "text-xl md:text-2xl", hint: "text-base md:text-lg" },
};

export default function NadaEncontrado({
  mensagem = "Nenhum dado encontrado.",
  sugestao,
  Icone = SearchX,          // permite customizar o ícone
  acao,                      // { label: string, onClick: func }
  size = "md",               // 'sm' | 'md' | 'lg'
  className = "",
  iconClassName = "",
  testId = "nada-encontrado"
}) {
  const reduceMotion = useReducedMotion();
  const sz = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <motion.div
      className={`text-center py-10 px-4 text-gray-600 dark:text-gray-300 ${className}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid={testId}
      initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.4 }}
    >
      <div
        className={`inline-flex items-center justify-center ${sz.wrap} mb-4 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow`}
      >
        <Icone
          className={`${sz.icon} text-lousa dark:text-white ${iconClassName}`}
          aria-hidden="true"
        />
        <span className="sr-only">Ícone de nada encontrado</span>
      </div>

      <p className={`${sz.title} font-semibold`}>{mensagem}</p>

      {sugestao && (
        <p className={`${sz.hint} text-gray-500 dark:text-gray-400 mt-1`}>
          {sugestao}
        </p>
      )}

      {acao?.label && typeof acao.onClick === "function" && (
        <div className="mt-4">
          <button
            type="button"
            onClick={acao.onClick}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-lousa text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-lousa"
          >
            {acao.label}
          </button>
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
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  className: PropTypes.string,
  iconClassName: PropTypes.string,
  testId: PropTypes.string,
};
