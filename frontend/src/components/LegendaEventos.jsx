// 📁 src/components/LegendaEventos.jsx
import PropTypes from "prop-types";

/** Itens padrão (alinhados com BadgeStatus: programado / andamento / encerrado) */
export const DEFAULT_EVENT_LEGEND = [
  { key: "programado", text: "Programado", color: "emerald" }, // verde
  { key: "andamento",  text: "Em andamento", color: "amber" }, // amarelo
  { key: "encerrado",  text: "Encerrado",   color: "rose" },   // vermelho/rose
];

/** Mapa de cores → classes (bg + border) com bom contraste em light/dark */
export function colorClasses(color) {
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
    case "sm":
      return {
        dot: "w-3 h-3",
        text: "text-xs",
        pill: "px-2 py-0.5 text-[11px]",
        badge: "text-[10px] px-1.5",
      };
    case "lg":
      return {
        dot: "w-5 h-5",
        text: "text-base",
        pill: "px-3 py-1 text-sm",
        badge: "text-xs px-2",
      };
    default: // md
      return {
        dot: "w-4 h-4",
        text: "text-sm",
        pill: "px-2.5 py-0.5 text-[13px]",
        badge: "text-[11px] px-1.5",
      };
  }
}

/**
 * Legenda de eventos
 * - items: [{ key, text, color }]
 * - size: 'sm' | 'md' | 'lg'
 * - variant: 'dot' | 'pill' | 'dot-badge'
 * - counts: { [key]: number } → badge com quantidade
 * - activeKeys: string[] → realça itens ativos (os demais sofrem opacidade)
 * - onItemClick: (key) => void → torna itens clicáveis/tecláveis
 * - ariaLabel / ariaLabelledBy
 */
export function LegendaEventos({
  items = DEFAULT_EVENT_LEGEND,
  size = "md",
  variant = "dot",
  className = "",
  ariaLabel = "Legenda dos eventos",
  ariaLabelledBy,
  counts,              // ex.: { programado: 12, andamento: 3, encerrado: 9 }
  activeKeys,          // ex.: ["programado","andamento"]
  inactiveOpacity = 0.55,
  onItemClick,         // torna os itens interativos
}) {
  const sz = sizeClasses(size);
  const isInteractive = typeof onItemClick === "function";
  const activeSet = new Set(Array.isArray(activeKeys) ? activeKeys : items.map(i => i.key));

  return (
    <ul
      className={`flex items-center gap-4 mt-6 flex-wrap ${className}`}
      role={isInteractive ? "listbox" : "list"}
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {items.map(({ key, text, color }) => {
        const k = key || text;
        const active = activeSet.has(k);
        const opacityCls = active ? "" : `opacity-[${inactiveOpacity}]`;
        const common = [
          "flex items-center gap-2",
          isInteractive ? "cursor-pointer select-none" : "",
          active ? "" : "transition-opacity",
          opacityCls,
        ].join(" ");

        const dot = (
          <span
            className={[
              "shrink-0 rounded-full border",
              colorClasses(color),
              sz.dot,
              "ring-1 ring-black/5 dark:ring-white/10",
            ].join(" ")}
            aria-hidden="true"
          />
        );

        const label = (
          <span className={`text-gray-700 dark:text-gray-300 leading-tight ${sz.text}`}>
            {text}
          </span>
        );

        const qty = counts && Number.isFinite(Number(counts[k])) ? Number(counts[k]) : null;
        const badge = qty != null ? (
          <span
            className={[
              "inline-flex items-center rounded-full border border-current/25",
              "bg-black/5 dark:bg-white/10 text-gray-700 dark:text-gray-200",
              "leading-none",
              sz.badge,
              "py-0.5",
            ].join(" ")}
            aria-label={`${text}: ${qty}`}
          >
            {qty}
          </span>
        ) : null;

        const content =
          variant === "pill" ? (
            <span
              className={[
                "inline-flex items-center rounded-full font-semibold text-white border shadow-sm",
                colorClasses(color),
                sz.pill,
              ].join(" ")}
              aria-hidden="true"
              title={text}
            >
              {text}
              {badge ? <span className="ml-1.5 bg-white/20 rounded-full px-1">{qty}</span> : null}
            </span>
          ) : variant === "dot-badge" ? (
            <>
              {dot}
              {label}
              {badge}
            </>
          ) : (
            <>
              {dot}
              {label}
            </>
          );

        if (!isInteractive) {
          return (
            <li key={k} className={common} role="listitem">
              {content}
            </li>
          );
        }

        // Interativo: vira "opção" clicável/teclável
        return (
          <li key={k} className="m-0 p-0" role="none">
            <button
              type="button"
              className={[
                common,
                "rounded-full px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              ].join(" ")}
              role="option"
              aria-selected={active}
              onClick={() => onItemClick(k)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onItemClick(k);
                }
              }}
              title={text}
            >
              {content}
            </button>
          </li>
        );
      })}
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
  variant: PropTypes.oneOf(["dot", "pill", "dot-badge"]),
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
  ariaLabelledBy: PropTypes.string,
  counts: PropTypes.object,          // { [key]: number }
  activeKeys: PropTypes.arrayOf(PropTypes.string),
  inactiveOpacity: PropTypes.number,
  onItemClick: PropTypes.func,
};

export default LegendaEventos;
