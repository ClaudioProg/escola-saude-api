// ✅ frontend/src/components/eventos/LegendaEventos.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Legenda visual de status de eventos.
//
// Contratos aplicados:
// - Pasta do domínio: src/components/eventos/
// - Status oficiais:
//   - programado
//   - andamento
//   - encerrado
//   - sem_datas
// - Sem status em_andamento.
// - Sem status desconhecido.
// - "items", "text" e "counts" mantidos conforme contrato atual do componente.
// - Pode ser estática ou interativa via onItemClick.
// - Acessível com list/listbox conforme modo de uso.

import PropTypes from "prop-types";

export const EVENTOS_LEGENDA_PADRAO = Object.freeze([
  { key: "programado", text: "Programado", color: "emerald" },
  { key: "andamento", text: "Em andamento", color: "amber" },
  { key: "encerrado", text: "Encerrado", color: "rose" },
  { key: "sem_datas", text: "Sem datas", color: "slate" },
]);

const CORES_PERMITIDAS = Object.freeze([
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
]);

export function colorClasses(color) {
  const map = {
    emerald: "bg-emerald-600 border-emerald-700 dark:border-emerald-500",
    amber: "bg-amber-500 border-amber-600 dark:border-amber-400",
    rose: "bg-rose-600 border-rose-700 dark:border-rose-500",
    slate: "bg-slate-500 border-slate-600 dark:border-slate-400",
    purple: "bg-purple-600 border-purple-700 dark:border-purple-500",
    blue: "bg-blue-600 border-blue-700 dark:border-blue-500",
    orange: "bg-orange-600 border-orange-700 dark:border-orange-500",
    teal: "bg-teal-600 border-teal-700 dark:border-teal-500",
    zinc: "bg-zinc-500 border-zinc-600 dark:border-zinc-400",
    gray: "bg-gray-500 border-gray-600 dark:border-gray-400",
  };

  return map[color] || map.gray;
}

function sizeClasses(size) {
  const sizes = {
    sm: {
      dot: "h-3 w-3",
      text: "text-xs",
      pill: "px-2 py-0.5 text-[11px]",
      badge: "px-1.5 text-[10px]",
    },
    md: {
      dot: "h-4 w-4",
      text: "text-sm",
      pill: "px-2.5 py-0.5 text-[13px]",
      badge: "px-1.5 text-[11px]",
    },
    lg: {
      dot: "h-5 w-5",
      text: "text-base",
      pill: "px-3 py-1 text-sm",
      badge: "px-2 text-xs",
    },
  };

  return sizes[size] || sizes.md;
}

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizarItems(items) {
  const lista = Array.isArray(items) && items.length ? items : EVENTOS_LEGENDA_PADRAO;

  return lista
    .map((item) => {
      const key = String(item?.key || item?.text || "").trim();
      const text = String(item?.text || "").trim();
      const color = CORES_PERMITIDAS.includes(item?.color) ? item.color : "gray";

      if (!key || !text) return null;

      return {
        key,
        text,
        color,
      };
    })
    .filter(Boolean);
}

function normalizarQuantidade(value) {
  const quantidade = Number(value);

  if (!Number.isFinite(quantidade) || quantidade < 0) {
    return null;
  }

  return Math.trunc(quantidade);
}

function normalizarOpacidade(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 0.55;

  return Math.max(0.2, Math.min(1, number));
}

export default function LegendaEventos({
  items = EVENTOS_LEGENDA_PADRAO,
  size = "md",
  variant = "dot",
  className = "",
  ariaLabel = "Legenda dos eventos",
  ariaLabelledBy,
  counts = null,
  activeKeys = null,
  inactiveOpacity = 0.55,
  onItemClick,
}) {
  const itensNormalizados = normalizarItems(items);
  const tamanho = sizeClasses(size);
  const interativo = typeof onItemClick === "function";
  const opacidadeInativa = normalizarOpacidade(inactiveOpacity);

  const activeSet = new Set(
    Array.isArray(activeKeys) && activeKeys.length
      ? activeKeys.map((key) => String(key).trim()).filter(Boolean)
      : itensNormalizados.map((item) => item.key)
  );

  return (
    <ul
      className={classNames(
        "mt-6 flex flex-wrap items-center gap-4",
        className
      )}
      role={interativo ? "listbox" : "list"}
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {itensNormalizados.map(({ key, text, color }) => {
        const ativo = activeSet.has(key);

        const quantidade =
          counts && typeof counts === "object"
            ? normalizarQuantidade(counts[key])
            : null;

        const itemStyle = ativo ? undefined : { opacity: opacidadeInativa };

        const dot = (
          <span
            className={classNames(
              "shrink-0 rounded-full border ring-1 ring-black/5 dark:ring-white/10",
              colorClasses(color),
              tamanho.dot
            )}
            aria-hidden="true"
          />
        );

        const label = (
          <span
            className={classNames(
              "leading-tight text-gray-700 dark:text-gray-300",
              tamanho.text
            )}
          >
            {text}
          </span>
        );

        const badge =
          quantidade !== null ? (
            <span
              className={classNames(
                "inline-flex items-center rounded-full border border-current/25 bg-black/5 py-0.5 leading-none text-gray-700 dark:bg-white/10 dark:text-gray-200",
                tamanho.badge
              )}
              aria-label={`${text}: ${quantidade}`}
            >
              {quantidade}
            </span>
          ) : null;

        const content =
          variant === "pill" ? (
            <span
              className={classNames(
                "inline-flex items-center rounded-full border font-semibold text-white shadow-sm",
                colorClasses(color),
                tamanho.pill
              )}
              title={text}
            >
              {text}
              {quantidade !== null && (
                <span className="ml-1.5 rounded-full bg-white/20 px-1">
                  {quantidade}
                </span>
              )}
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

        const commonClass = classNames(
          "flex items-center gap-2",
          interativo && "cursor-pointer select-none",
          !ativo && "transition-opacity"
        );

        if (!interativo) {
          return (
            <li
              key={key}
              className={commonClass}
              role="listitem"
              style={itemStyle}
            >
              {content}
            </li>
          );
        }

        return (
          <li key={key} role="none">
            <button
              type="button"
              className={classNames(
                commonClass,
                "rounded-full px-1.5 py-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              )}
              style={itemStyle}
              role="option"
              aria-selected={ativo}
              onClick={() => onItemClick(key)}
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
      color: PropTypes.oneOf(CORES_PERMITIDAS).isRequired,
    })
  ),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  variant: PropTypes.oneOf(["dot", "pill", "dot-badge"]),
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
  ariaLabelledBy: PropTypes.string,
  counts: PropTypes.object,
  activeKeys: PropTypes.arrayOf(PropTypes.string),
  inactiveOpacity: PropTypes.number,
  onItemClick: PropTypes.func,
};