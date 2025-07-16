import { AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function NenhumDado({ mensagem = "Nenhum dado encontrado.", sugestao }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-10 px-4 text-gray-600 dark:text-gray-300"
      role="status"
      aria-live="polite"
      tabIndex={0}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-gray-100 dark:bg-gray-800">
        <AlertCircle className="w-8 h-8 text-lousa dark:text-white" aria-hidden="true" />
      </div>
      <span className="text-lg font-semibold">{mensagem}</span>
      {sugestao && <span className="text-sm text-gray-500 mt-1">{sugestao}</span>}
    </motion.div>
  );
}
