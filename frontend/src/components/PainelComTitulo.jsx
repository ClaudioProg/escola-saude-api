import PropTypes from "prop-types";
import { motion } from "framer-motion";

export default function PainelComTitulo({ titulo, subtitulo, children }) {
  return (
    <motion.section
      className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6 border-b border-gray-300 dark:border-zinc-600 pb-2">
        <h1 className="text-2xl font-bold text-lousa dark:text-white">{titulo}</h1>
        {subtitulo && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{subtitulo}</p>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-6">
        {children}
      </div>
    </motion.section>
  );
}

PainelComTitulo.propTypes = {
  titulo: PropTypes.string.isRequired,
  subtitulo: PropTypes.string,
  children: PropTypes.node.isRequired,
};
