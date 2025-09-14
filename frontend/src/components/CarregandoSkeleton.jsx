// 📁 src/components/CarregandoSkeleton.jsx
import PropTypes from "prop-types";
import { motion } from "framer-motion";

/**
 * Skeleton de carregamento para listas/blocos de texto.
 * - Aceita número de linhas, altura e largura randômica opcional.
 * - Acessível (aria-busy / aria-live).
 */
export default function CarregandoSkeleton({
  linhas = 3,
  altura = 20,
  cor = "gray",       // 'gray' | 'verde'
  larguraVariada = true,
  className = "",
}) {
  const baseColor =
    cor === "verde"
      ? "bg-green-100 dark:bg-green-900/40"
      : "bg-gray-200 dark:bg-gray-700";

  return (
    <motion.div
      className={`space-y-3 py-4 px-4 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      tabIndex={0}
      initial={{ opacity: 0.45 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, repeat: Infinity, repeatType: "mirror" }}
    >
      {Array.from({ length: linhas }).map((_, i) => {
        const largura = larguraVariada
          ? `${Math.max(40, Math.random() * 100)}%`
          : "100%";
        return (
          <div
            key={i}
            style={{ width: largura, height: altura }}
            className={`rounded-md animate-pulse ${baseColor}`}
          />
        );
      })}
    </motion.div>
  );
}

CarregandoSkeleton.propTypes = {
  linhas: PropTypes.number,
  altura: PropTypes.number,
  cor: PropTypes.oneOf(["gray", "verde"]),
  larguraVariada: PropTypes.bool,
  className: PropTypes.string,
};
