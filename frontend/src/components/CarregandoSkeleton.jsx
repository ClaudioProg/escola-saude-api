// 📁 src/components/CarregandoSkeleton.jsx
import { motion } from "framer-motion";

export default function CarregandoSkeleton({ linhas = 3 }) {
  return (
    <motion.div
      className="space-y-4 py-6 px-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
      tabIndex={0}
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, repeat: Infinity, repeatType: "mirror" }}
    >
      {[...Array(linhas)].map((_, i) => (
        <div
          key={i}
          className="w-full h-5 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse"
        />
      ))}
    </motion.div>
  );
}
