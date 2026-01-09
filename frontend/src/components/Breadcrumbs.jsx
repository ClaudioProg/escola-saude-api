// 📁 src/components/Breadcrumbs.jsx
import PropTypes from "prop-types";
import { useLocation, useNavigate } from "react-router-dom";
import { useMemo } from "react";

/**
 * Breadcrumbs acessível com fallback pelo path atual ou trilha manual.
 *
 * Extras:
 * - basePath: remove prefixo do pathname (ex.: "/app")
 * - maxLabelChars: truncamento elegante com tooltip
 * - sticky: fixa no topo com backdrop blur
 * - itemSeparator: custom separator (string/JSX)
 * - onNavigate: callback ao navegar por item
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
  itemSeparator, // PRIORIDADE sobre "separator"
  collapseAfter = 4,
  decodeURI = true,
  preserveSearch = false,
  preserveHash = false,
  basePath = "",          // ← NOVO
  maxLabelChars = 40,     // ← NOVO
  sticky = false,         // ← NOVO
  onNavigate,             // ← NOVO
  className = "",
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const searchToKeep = preserveSearch ? location.search : "";
  const hashToKeep = preserveHash ? location.hash : "";

  const isUUID = (seg) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(seg);

  const isNumericOnly = (seg) => /^\d+$/.test(seg);

  const safeDecode = (s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  };

  const normalizarRotulo = (texto) => {
    const base = String(texto ?? "").replace(/-/g, " ");
    const dec = decodeURI ? safeDecode(base) : base;
    return dec.replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const truncate = (s, max = 40) => {
    const t = String(s ?? "");
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
  };

  const rawSegments = useMemo(() => {
    const path = basePath && location.pathname.startsWith(basePath)
      ? location.pathname.slice(basePath.length) || "/"
      : location.pathname;

    return path.split("/").filter(Boolean);
  }, [location.pathname, basePath]);

  const caminhos = useMemo(() => {
    return rawSegments
      .filter((seg) => !ocultar.includes(String(seg).toLowerCase()))
      .filter((seg) => (ocultarNumericos ? !isNumericOnly(seg) : true))
      .filter((seg) => (ocultarUUIDs ? !isUUID(seg) : true));
  }, [rawSegments, ocultar, ocultarNumericos, ocultarUUIDs]);

  const auto = useMemo(() => {
    return caminhos
      .map((segmento, index) => {
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
      })
      .filter(Boolean);
  }, [caminhos, mapaLabels, resolver, searchToKeep, hashToKeep]);

  const lista = useMemo(() => {
    const base = Array.isArray(trilha) && trilha.length ? trilha : auto;
    if (!collapseAfter || base.length <= collapseAfter) return base;

    // mantém primeiro + últimos (collapseAfter - 1)
    return [base[0], { label: "…", href: null }, ...base.slice(-(collapseAfter - 1))];
  }, [trilha, auto, collapseAfter]);

  const go = (href, item) => {
    if (!href) return;
    onNavigate?.(href, item);
    navigate(href);
  };

  const sepNode = itemSeparator ?? (
    <span className="text-gray-400 select-none" aria-hidden="true">/</span>
  );

  return (
    <nav
      aria-label="Trilha de navegação"
      className={[
        "text-sm text-gray-600 dark:text-gray-300 mb-4",
        "overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700",
        sticky ? "sticky top-0 z-20 bg-white/70 dark:bg-zinc-900/70 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md py-2" : "",
        className,
      ].join(" ")}
    >
      <ol
        className="flex items-center gap-2 min-w-min"
        itemScope
        itemType="https://schema.org/BreadcrumbList"
      >
        {/* Início */}
        <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
          <button
            type="button"
            onClick={() => go(homeHref, { label: homeLabel, href: homeHref })}
            className="cursor-pointer hover:underline text-green-900 dark:text-green-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-900/60 rounded-md px-1"
            aria-label={`Ir para ${homeLabel}`}
            itemProp="item"
          >
            <span itemProp="name">{truncate(homeLabel, maxLabelChars)}</span>
          </button>
          <meta itemProp="position" content="1" />
        </li>

        {/* Itens */}
        {lista.map((item, index) => {
          const isLast = index === lista.length - 1 || !item?.href;
          const pos = index + 2; // considerando "Início" como 1
          const label = truncate(item.label, maxLabelChars);

          return (
            <li
              key={`${item.label}-${index}`}
              className="flex items-center gap-2 shrink-0"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              {/* Separador com a11y */}
              <span role="presentation" aria-hidden="true">
                {sepNode}
              </span>

              {isLast ? (
                <span
                  className="text-gray-800 dark:text-gray-100 font-semibold truncate max-w-[40ch]"
                  aria-current="page"
                  title={item.label}
                >
                  <span itemProp="name">{label}</span>
                </span>
              ) : item.label === "…" ? (
                <span className="px-1 text-gray-500 dark:text-gray-400" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => go(item.href, item)}
                  className="cursor-pointer hover:underline text-green-900 dark:text-green-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-900/60 rounded-md px-1 truncate max-w-[28ch]"
                  aria-label={`Ir para ${item.label}`}
                  title={item.label}
                  itemProp="item"
                >
                  <span itemProp="name">{label}</span>
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
  itemSeparator: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  collapseAfter: PropTypes.number,
  decodeURI: PropTypes.bool,
  preserveSearch: PropTypes.bool,
  preserveHash: PropTypes.bool,
  basePath: PropTypes.string,
  maxLabelChars: PropTypes.number,
  sticky: PropTypes.bool,
  onNavigate: PropTypes.func,
  className: PropTypes.string,
};
