// 📁 src/components/TurmaItem.jsx
import PropTypes from "prop-types";
import { CalendarDays, Clock } from "lucide-react";
import { formatarDataBrasileira } from "../utils/data"; // use sempre seu utilitário

// Compara strings "YYYY-MM-DD HH:MM" de forma lexicográfica.
function agoraYMDHM() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function compStatus({ data_inicio, data_fim, horario_inicio, horario_fim }) {
  const start = `${data_inicio ?? ""} ${(horario_inicio ?? "00:00").slice(0, 5)}`;
  const end   = `${data_fim ?? ""} ${(horario_fim ?? "23:59").slice(0, 5)}`;
  const now   = agoraYMDHM();

  if (!data_inicio || !data_fim) return { texto: "—", cls: "bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-gray-200" };

  if (now < start) {
    // Programado → VERDE (preferência do Cláudio)
    return { texto: "Programado", cls: "bg-green-100 text-green-800 dark:bg-green-600/30 dark:text-green-300" };
  }
  if (now > end) {
    // Encerrado → VERMELHO
    return { texto: "Encerrado", cls: "bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300" };
  }
  // Em andamento → AMARELO
  return { texto: "Em andamento", cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-600/30 dark:text-yellow-200" };
}

export default function TurmaItem({ turma, onClick, className = "" }) {
  const { texto: statusTxt, cls: statusCls } = compStatus(turma);

  const ini = (turma.horario_inicio ?? "").slice(0, 5);
  const fim = (turma.horario_fim ?? "").slice(0, 5);

  return (
    <div
      className={`flex items-center justify-between bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-3 mb-2 shadow-sm hover:shadow transition ${className}`}
      aria-label={`Turma ${turma.nome || turma.id}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-lousa dark:text-white truncate">
            {turma.nome || `Turma ${turma.id}`}
          </h4>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${statusCls}`}>
            {statusTxt}
          </span>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 mt-1">
          <CalendarDays size={16} aria-hidden="true" />
          <span className="truncate">
            {formatarDataBrasileira(turma.data_inicio)} – {formatarDataBrasileira(turma.data_fim)}
          </span>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
          <Clock size={16} aria-hidden="true" />
          <span className="truncate">
            {ini} às {fim}
          </span>
        </div>
      </div>

      {onClick && (
        <button
          onClick={() => onClick(turma)}
          className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition focus:outline-none focus:ring-2 focus:ring-green-700/40 ml-3 shrink-0"
          aria-label={`Selecionar ${turma.nome || `Turma ${turma.id}`}`}
          title="Selecionar"
        >
          Selecionar
        </button>
      )}
    </div>
  );
}

TurmaItem.propTypes = {
  turma: PropTypes.shape({
    id: PropTypes.number.isRequired,
    nome: PropTypes.string,
    data_inicio: PropTypes.string,   // "YYYY-MM-DD"
    data_fim: PropTypes.string,      // "YYYY-MM-DD"
    horario_inicio: PropTypes.string, // "HH:MM"
    horario_fim: PropTypes.string,    // "HH:MM"
  }).isRequired,
  onClick: PropTypes.func, // recebe a turma
  className: PropTypes.string,
};
