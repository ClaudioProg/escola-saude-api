import { SearchX } from "lucide-react";
import { motion } from "framer-motion";

export default function NadaEncontrado({
  mensagem = "Nenhum dado encontrado.",
  sugestao,
  Icone = SearchX, // Permite usar outro ícone se quiser
}) {
  return (
    <motion.div
      className="text-center py-10 px-4 text-gray-600 dark:text-gray-300"
      role="status"
      aria-live="polite"
      tabIndex={0}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="inline-flex items-center justify-center w-20 h-20 mb-4 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow">
        <Icone
          className="w-10 h-10 text-lousa dark:text-white"
          aria-hidden="true"
        />
        <span className="sr-only">Ícone de nada encontrado</span>
      </div>
      <p className="text-lg md:text-xl font-semibold">{mensagem}</p>
      {sugestao && (
        <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mt-1">
          {sugestao}
        </p>
      )}
    </motion.div>
  );
}
