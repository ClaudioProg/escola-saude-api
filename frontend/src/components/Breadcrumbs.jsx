// 📁 src/components/Breadcrumbs.jsx
import PropTypes from "prop-types";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Componente de Breadcrumbs com suporte à navegação por URL ou trilha manual.
 *
 * Props:
 * - trilha?: Array<{ label: string, href?: string }>
 * - homeLabel?: string        (padrão: "Início")
 * - homeHref?: string         (padrão: "/dashboard")
 * - ocultar?: string[]        (segmentos da URL a ignorar; padrão ["turmas"])
 * - separator?: string | JSX  (padrão: "/")
 * - collapseAfter?: number    (colapsa a trilha quando passar desse tamanho; padrão 4)
 */
export default function Breadcrumbs({
  trilha = null,
  homeLabel = "Início",
  homeHref = "/dashboard",
  ocultar = ["turmas"],
  separator = "/",
  collapseAfter = 4,
  className = "",
}) {
  const location = useLocation();
  const navigate = useNavigate();

  // Fallback: extrai caminho da URL atual
  const caminhos = location.pathname
    .split("/")
    .filter(Boolean)
    .filter((seg) => !ocultar.includes(String(seg).toLowerCase()));

  const formatar = (texto) =>
    String(texto)
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

  // Decide a fonte: trilha manual ou caminho da URL
  const lista = trilha
    ? trilha
    : caminhos.map((segmento, index) => ({
        label: formatar(segmento),
        href: "/" + caminhos.slice(0, index + 1).join("/"),
      }));

  // Colapso opcional para trilhas enormes
  const precisaColapsar = collapseAfter && lista.length > collapseAfter;
  const compacta = precisaColapsar
    ? [lista[0], { label: "…", href: null }, ...lista.slice(- (collapseAfter - 1))]
    : lista;

  const go = (href) => {
    if (!href) return;
    navigate(href);
  };

  return (
    <nav
      aria-label="Trilha de navegação"
      className={[
        "text-sm text-gray-600 dark:text-gray-300 mb-4",
        "overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700",
        className,
      ].join(" ")}
    >
      <ol className="flex items-center gap-2 min-w-min">
        {/* Início */}
        <li>
          <button
            type="button"
            onClick={() => go(homeHref)}
            className="cursor-pointer hover:underline text-green-900 dark:text-green-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-900/60 rounded-md px-1"
            aria-label={`Ir para ${homeLabel}`}
          >
            {homeLabel}
          </button>
        </li>

        {/* Itens da trilha */}
        {compacta.map((item, index) => {
          const isLast = index === compacta.length - 1 || !item?.href;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2 shrink-0">
              <span className="text-gray-400 select-none">{separator}</span>
              {isLast ? (
                <span
                  className="text-gray-800 dark:text-gray-100 font-semibold truncate max-w-[40ch]"
                  aria-current="page"
                  title={item.label}
                >
                  {item.label}
                </span>
              ) : item.label === "…" ? (
                <span className="px-1 text-gray-500 dark:text-gray-400" aria-hidden="true">…</span>
              ) : (
                <button
                  type="button"
                  onClick={() => go(item.href)}
                  className="cursor-pointer hover:underline text-green-900 dark:text-green-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-900/60 rounded-md px-1 truncate max-w-[28ch]"
                  aria-label={`Ir para ${item.label}`}
                  title={item.label}
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

Breadcrumbs.propTypes = {
  trilha: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      href: PropTypes.string,
    })
  ),
  homeLabel: PropTypes.string,
  homeHref: PropTypes.string,
  ocultar: PropTypes.arrayOf(PropTypes.string),
  separator: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  collapseAfter: PropTypes.number,
  className: PropTypes.string,
};
