// 📁 src/components/Breadcrumbs.jsx
import PropTypes from "prop-types";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Breadcrumbs com fallback pelo path atual ou trilha manual.
 *
 * Props:
 * - trilha?: Array<{ label: string, href?: string }>
 * - homeLabel?: string               (default: "Início")
 * - homeHref?: string                (default: "/dashboard")
 * - ocultar?: string[]               (segmentos a ignorar, default ["turmas"])
 * - ocultarNumericos?: boolean       (ignora segmentos só com números, default: false)
 * - ocultarUUIDs?: boolean           (ignora segmentos uuid v4-like, default: false)
 * - mapaLabels?: Record<string,string> (substitui rótulos por chave do segmento)
 * - resolver?: (segmento, idx, segmentos) => { label?: string, href?: string, omit?: boolean }
 * - separator?: string | JSX         (default: "/")
 * - collapseAfter?: number           (colapsa quando exceder, default: 4)
 * - decodeURI?: boolean              (aplica decodeURIComponent, default: true)
 * - preserveSearch?: boolean         (mantém querystring nos hrefs gerados, default: false)
 * - preserveHash?: boolean           (mantém hash nos hrefs gerados, default: false)
 */
export default function Breadcrumbs({
  trilha = null,
  homeLabel = "Início",
  homeHref = "/dashboard",
  ocultar = ["turmas"],
  ocultarNumericos = false,
  ocultarUUIDs = false,
  mapaLabels = {},
  resolver,
  separator = "/",
  collapseAfter = 4,
  decodeURI = true,
  preserveSearch = false,
  preserveHash = false,
  className = "",
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const searchToKeep = preserveSearch ? location.search : "";
  const hashToKeep = preserveHash ? location.hash : "";

  const isUUID =
    (seg) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(seg);

  const isNumericOnly = (seg) => /^\d+$/.test(seg);

  const normalizarRotulo = (texto) => {
    const base = String(texto ?? "").replace(/-/g, " ");
    const dec = decodeURI ? safeDecode(base) : base;
    return dec.replace(/\b\w/g, (l) => l.toUpperCase());
  };

  function safeDecode(s) {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  }

  // Segmentar caminho atual
  const brutos = location.pathname.split("/").filter(Boolean);

  const caminhos = brutos
    .filter((seg) => !ocultar.includes(String(seg).toLowerCase()))
    .filter((seg) => (ocultarNumericos ? !isNumericOnly(seg) : true))
    .filter((seg) => (ocultarUUIDs ? !isUUID(seg) : true));

  // Fallback: construir itens a partir da URL (respeitando mapaLabels e resolver)
  const auto = caminhos.map((segmento, index) => {
    const hrefBase = "/" + caminhos.slice(0, index + 1).join("/");
    let label = mapaLabels[segmento] ?? normalizarRotulo(segmento);
    let href = hrefBase + (searchToKeep || "") + (hashToKeep || "");
    let omit = false;

    if (typeof resolver === "function") {
      const out = resolver(segmento, index, caminhos) || {};
      if (out.omit) omit = true;
      if (typeof out.label === "string") label = out.label;
      if (typeof out.href === "string") href = out.href;
    }

    return omit ? null : { label, href };
  }).filter(Boolean);

  // Decide a fonte
  const lista = Array.isArray(trilha) && trilha.length ? trilha : auto;

  // Colapso opcional (preserva primeiro + últimos N-1)
  const precisaColapsar = collapseAfter && lista.length > collapseAfter;
  const compacta = precisaColapsar
    ? [lista[0], { label: "…", href: null }, ...lista.slice(-(collapseAfter - 1))]
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
      <ol className="flex items-center gap-2 min-w-min" itemScope itemType="https://schema.org/BreadcrumbList">
        {/* Início */}
        <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
          <button
            type="button"
            onClick={() => go(homeHref)}
            className="cursor-pointer hover:underline text-green-900 dark:text-green-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-900/60 rounded-md px-1"
            aria-label={`Ir para ${homeLabel}`}
            itemProp="item"
          >
            <span itemProp="name">{homeLabel}</span>
          </button>
          <meta itemProp="position" content="1" />
        </li>

        {/* Itens da trilha */}
        {compacta.map((item, index) => {
          const isLast = index === compacta.length - 1 || !item?.href;
          // posição no schema considera o "Início" como 1
          const pos = index + 2;

          return (
            <li
              key={`${item.label}-${index}`}
              className="flex items-center gap-2 shrink-0"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              <span className="text-gray-400 select-none" aria-hidden="true">
                {separator}
              </span>

              {isLast ? (
                <span
                  className="text-gray-800 dark:text-gray-100 font-semibold truncate max-w-[40ch]"
                  aria-current="page"
                  title={item.label}
                >
                  <span itemProp="name">{item.label}</span>
                </span>
              ) : item.label === "…" ? (
                <span className="px-1 text-gray-500 dark:text-gray-400" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => go(item.href)}
                  className="cursor-pointer hover:underline text-green-900 dark:text-green-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-900/60 rounded-md px-1 truncate max-w-[28ch]"
                  aria-label={`Ir para ${item.label}`}
                  title={item.label}
                  itemProp="item"
                >
                  <span itemProp="name">{item.label}</span>
                </button>
              )}

              <meta itemProp="position" content={String(pos)} />
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
  ocultarNumericos: PropTypes.bool,
  ocultarUUIDs: PropTypes.bool,
  mapaLabels: PropTypes.object,
  resolver: PropTypes.func,
  separator: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  collapseAfter: PropTypes.number,
  decodeURI: PropTypes.bool,
  preserveSearch: PropTypes.bool,
  preserveHash: PropTypes.bool,
  className: PropTypes.string,
};
