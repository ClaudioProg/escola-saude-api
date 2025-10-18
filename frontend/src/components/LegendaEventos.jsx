// 📁 src/components/LegendaEventos.jsx
import PropTypes from "prop-types";

/** Itens padrão (alinhados com BadgeStatus: programado / andamento / encerrado) */
export const DEFAULT_EVENT_LEGEND = [
  { key: "programado", text: "Programado", color: "emerald" }, // verde
  { key: "andamento",  text: "Em andamento", color: "amber" }, // amarelo
  { key: "encerrado",  text: "Encerrado",   color: "rose" },   // vermelho/rose
];

/** Mapa de cores → classes (bg + border) com bom contraste em light/dark */
function colorClasses(color) {
  // aliases para compatibilidade
  const c = color === "green" ? "emerald" : color === "red" ? "rose" : color;

  const map = {
    emerald: "bg-emerald-600 border-emerald-700 dark:border-emerald-500",
    amber:   "bg-amber-500 border-amber-600 dark:border-amber-400",
    rose:    "bg-rose-600 border-rose-700 dark:border-rose-500",
    slate:   "bg-slate-500 border-slate-600 dark:border-slate-400",
    purple:  "bg-purple-600 border-purple-700 dark:border-purple-500",
    blue:    "bg-blue-600 border-blue-700 dark:border-blue-500",
    orange:  "bg-orange-600 border-orange-700 dark:border-orange-500",
    teal:    "bg-teal-600 border-teal-700 dark:border-teal-500",
    zinc:    "bg-zinc-500 border-zinc-600 dark:border-zinc-400",
    gray:    "bg-gray-500 border-gray-600 dark:border-gray-400",
  };
  return map[c] || map.gray;
}

function sizeClasses(size) {
  switch (size) {
    case "sm": return { dot: "w-3 h-3", text: "text-xs" };
    case "lg": return { dot: "w-5 h-5", text: "text-base" };
    default:   return { dot: "w-4 h-4", text: "text-sm" }; // md
  }
}

/**
 * Legenda de eventos
 * - items: [{ key, text, color }]
 * - size: 'sm' | 'md' | 'lg'
 * - variant: 'dot' | 'pill'
 * - ariaLabel / ariaLabelledBy
 */
export function LegendaEventos({
  items = DEFAULT_EVENT_LEGEND,
  size = "md",
  variant = "dot",
  className = "",
  ariaLabel = "Legenda dos eventos",
  ariaLabelledBy,
}) {
  const sz = sizeClasses(size);

  return (
    <ul
      className={`flex items-center gap-4 mt-6 flex-wrap ${className}`}
      role="list"
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {items.map(({ key, text, color }) => (
        <li key={key || text} className="flex items-center gap-2" role="listitem">
          {variant === "pill" ? (
            <span
              className={[
                "inline-flex items-center rounded-full px-2 py-0.5 text-[0.75rem] font-semibold",
                "border shadow-sm text-white",
                colorClasses(color),
              ].join(" ")}
              aria-hidden="true"
            >
              {text}
            </span>
          ) : (
            <>
              <span
                className={[
                  "shrink-0 rounded-full border",
                  colorClasses(color),
                  sz.dot,
                  "ring-1 ring-black/5 dark:ring-white/10",
                ].join(" ")}
                aria-hidden="true"
              />
              <span className={`text-gray-700 dark:text-gray-300 leading-tight ${sz.text}`}>
                {text}
              </span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

LegendaEventos.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      text: PropTypes.string.isRequired,
      color: PropTypes.oneOf([
        "emerald",
        "amber",
        "rose",
        "slate",
        "purple",
        "blue",
        "orange",
        "teal",
        "zinc",
        "gray",
        // aliases aceitos
        "green",
        "red",
      ]),
    })
  ),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  variant: PropTypes.oneOf(["dot", "pill"]),
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
  ariaLabelledBy: PropTypes.string,
};

export default LegendaEventos;
