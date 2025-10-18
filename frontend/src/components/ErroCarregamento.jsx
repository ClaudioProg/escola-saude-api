// 📁 src/components/ErroCarregamento.jsx
import PropTypes from "prop-types";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Exibe mensagem de erro com ícone e texto acessível.
 * - Usa cores padronizadas (vermelho institucional).
 * - Animação suave e foco visível.
 * - Opcionalmente exibe botão de recarregar/ação.
 */
export default function ErroCarregamento({
  mensagem = "Erro ao carregar os dados.",
  sugestao = "Tente novamente mais tarde ou atualize a página.",
  onRetry = null,
  retryLabel = "Tentar novamente",
}) {
  return (
    <motion.div
      role="alert"
      aria-live="assertive"
      tabIndex={0}
      className="flex flex-col items-center justify-center text-center py-10 px-4
                 text-red-800 dark:text-red-300 focus:outline-none
                 focus-visible:ring-2 focus-visible:ring-red-500 rounded-xl
                 max-w-lg mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div
        className="inline-flex items-center justify-center w-20 h-20 mb-5
                   rounded-full bg-red-100 dark:bg-red-900/40
                   border border-red-300 dark:border-red-700 shadow-sm"
        aria-hidden="true"
      >
        <AlertTriangle className="w-10 h-10" />
      </div>

      <p className="text-lg md:text-xl font-semibold mb-1">{mensagem}</p>

      {sugestao && (
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 max-w-md">
          {sugestao}
        </p>
      )}

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full
                     bg-red-700 hover:bg-red-800 text-white font-medium
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-600
                     transition"
        >
          <RefreshCcw size={16} />
          {retryLabel}
        </button>
      )}
    </motion.div>
  );
}

ErroCarregamento.propTypes = {
  mensagem: PropTypes.string,
  sugestao: PropTypes.string,
  onRetry: PropTypes.func,
  retryLabel: PropTypes.string,
};
