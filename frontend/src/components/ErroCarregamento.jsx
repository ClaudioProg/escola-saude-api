// 📁 src/components/ErroCarregamento.jsx
import { AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

export default function ErroCarregamento({
  mensagem = "Erro ao carregar os dados.",
  sugestao = "Tente novamente mais tarde ou atualize a página.",
}) {
  return (
    <motion.div
      role="alert"
      aria-live="assertive"
      tabIndex={0}
      className="flex flex-col items-center justify-center text-center py-10 px-4 text-red-700 dark:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div
        className="
          inline-flex items-center justify-center w-20 h-20 mb-5
          rounded-full bg-red-100 dark:bg-red-900/40
          border border-red-300 dark:border-red-700 shadow-sm
        "
        aria-hidden="true"
      >
        <AlertTriangle className="w-10 h-10" />
      </div>

      <p className="text-lg md:text-xl font-semibold text-red-800 dark:text-red-300">
        {mensagem}
      </p>

      {sugestao && (
        <p className="mt-2 text-sm md:text-base text-gray-600 dark:text-gray-300 max-w-md">
          {sugestao}
        </p>
      )}
    </motion.div>
  );
}
