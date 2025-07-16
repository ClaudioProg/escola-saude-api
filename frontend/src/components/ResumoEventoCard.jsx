import PropTypes from "prop-types";
import { Users, CheckCircle, Star } from "lucide-react";

const icones = {
  inscritos: <Users size={28} className="text-blue-600" />,
  presencas: <CheckCircle size={28} className="text-green-600" />,
  avaliacoes: <Star size={28} className="text-yellow-500" />,
};

const cores = {
  inscritos: "bg-blue-50 text-blue-800",
  presencas: "bg-green-50 text-green-800",
  avaliacoes: "bg-yellow-50 text-yellow-800",
};

export default function ResumoEventoCard({ tipo = "inscritos", titulo, valor }) {
  const icone = icones[tipo] || <Users size={28} className="text-gray-500" />;
  const cor = cores[tipo] || "bg-gray-100 text-gray-800";

  return (
    <div
      className={`rounded-xl shadow-sm p-4 flex items-center gap-4 ${cor}`}
      aria-label={`Resumo de ${titulo}`}
    >
      <div className="bg-white/30 rounded-full p-2">{icone}</div>
      <div>
        <p className="text-sm font-medium">{titulo}</p>
        <p className="text-xl font-bold">{valor}</p>
      </div>
    </div>
  );
}

ResumoEventoCard.propTypes = {
  tipo: PropTypes.oneOf(["inscritos", "presencas", "avaliacoes"]),
  titulo: PropTypes.string.isRequired,
  valor: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};
