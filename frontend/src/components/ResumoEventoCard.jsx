// 📁 src/components/ResumoEventoCard.jsx
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import { Users, CheckCircle, Star } from "lucide-react";

const ICONES = {
  inscritos: <Users size={26} className="text-sky-600 dark:text-sky-400" />,
  presencas: <CheckCircle size={26} className="text-emerald-600 dark:text-emerald-400" />,
  avaliacoes: <Star size={26} className="text-amber-500 dark:text-amber-400" />,
};

const CORES = {
  inscritos:
    "from-sky-50 via-sky-100 to-sky-200 text-sky-900 dark:from-sky-950 dark:to-sky-900/60 dark:text-sky-50",
  presencas:
    "from-emerald-50 via-emerald-100 to-emerald-200 text-emerald-900 dark:from-emerald-950 dark:to-emerald-900/60 dark:text-emerald-50",
  avaliacoes:
    "from-amber-50 via-amber-100 to-amber-200 text-amber-900 dark:from-amber-950 dark:to-amber-900/60 dark:text-amber-50",
};

export default function ResumoEventoCard({
  tipo = "inscritos",
  titulo,
  valor,
  compact = false,
}) {
  const icone = ICONES[tipo] || <Users size={26} className="text-gray-500" />;
  const grad = CORES[tipo] || "from-gray-50 to-gray-200 text-gray-800";

  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 220, damping: 14 }}
      className={`relative rounded-2xl shadow-sm p-4 flex items-center gap-4 bg-gradient-to-br ${grad}`}
      aria-label={`Resumo de ${titulo}`}
    >
      <div
        className={`flex items-center justify-center rounded-full p-3 bg-white/60 dark:bg-white/10 ${
          compact ? "p-2" : "p-3"
        }`}
      >
        {icone}
      </div>

      <div className="flex flex-col">
        <p className="text-sm font-medium opacity-80">{titulo}</p>
        <p
          className={`font-bold ${
            compact ? "text-lg" : "text-2xl"
          } leading-snug tracking-tight`}
        >
          {valor}
        </p>
      </div>
    </motion.div>
  );
}

ResumoEventoCard.propTypes = {
  tipo: PropTypes.oneOf(["inscritos", "presencas", "avaliacoes"]),
  titulo: PropTypes.string.isRequired,
  valor: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  compact: PropTypes.bool,
};
