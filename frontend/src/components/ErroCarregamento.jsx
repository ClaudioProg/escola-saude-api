// 📁 src/components/ErroCarregamento.jsx
import { AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

export default function ErroCarregamento({
  mensagem = "Erro ao carregar os dados.",
  sugestao = "Tente novamente mais tarde ou atualize a página.",
}) {
  return (
    <motion.div
      className="text-center py-10 px-4 text-red-600 dark:text-red-400"
      role="alert"
      aria-live="assertive"
      tabIndex={0}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="inline-flex items-center justify-center w-20 h-20 mb-4 rounded-full bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 shadow">
        <AlertTriangle className="w-10 h-10" aria-hidden="true" />
      </div>
      <p className="text-lg md:text-xl font-semibold">{mensagem}</p>
      {sugestao && (
        <p className="text-sm md:text-base mt-1">
          {sugestao}
        </p>
      )}
    </motion.div>
  );
}
