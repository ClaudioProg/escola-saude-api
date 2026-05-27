// ✅ src/components/layout/Breadcrumbs.jsx — v2.0
// Plataforma Escola da Saúde
//
// Trilha oficial de navegação.
//
// Revisão premium:
// - componente estrutural de layout;
// - visual mais moderno, bonito e institucional;
// - mobile-first;
// - acessibilidade com aria-current, foco visível e schema BreadcrumbList;
// - contrato oficial em português;
// - sem aliases de props;
// - sem compatibilidade legada;
// - sem separator/itemSeparator duplicados;
// - permite trilha manual ou geração automática controlada;
// - rótulos automáticos dependem de mapaRotulos/resolverRotulo quando necessário;
// - pronto para páginas internas, dashboards e módulos administrativos.

import { useMemo } from "react";
import PropTypes from "prop-types";
import { ChevronRight, Home, MoreHorizontal } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function isUUID(segmento) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    segmento
  );
}

function isNumericOnly(segmento) {
  return /^\d+$/.test(segmento);
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function criarRotuloBasico(segmento) {
  const texto = safeDecode(String(segmento || "").replace(/-/g, " ")).trim();

  if (!texto) return "";

  return texto.replace(/\b\p{L}/gu, (letra) => letra.toUpperCase());
}

function truncarTexto(value, limite) {
  const texto = String(value ?? "");
  const max = Number(limite);

  if (!Number.isFinite(max) || max <= 0) return texto;

  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

function normalizarPrefixoRota(prefixoRota) {
  const texto = String(prefixoRota || "").trim();

  if (!texto || texto === "/") return "";

  return texto.startsWith("/") ? texto : `/${texto}`;
}

function removerPrefixoRota(pathname, prefixoRota) {
  const prefixo = normalizarPrefixoRota(prefixoRota);

  if (!prefixo) return pathname;

  if (!pathname.startsWith(prefixo)) return pathname;

  return pathname.slice(prefixo.length) || "/";
}

function normalizarSegmentos({
  pathname,
  prefixoRota,
  ocultarSegmentos,
  ocultarNumericos,
  ocultarUUID,
}) {
  const path = removerPrefixoRota(pathname, prefixoRota);
  const ocultos = new Set(
    (Array.isArray(ocultarSegmentos) ? ocultarSegmentos : []).map((item) =>
      String(item).toLowerCase()
    )
  );

  return path
    .split("/")
    .filter(Boolean)
    .filter((segmento) => !ocultos.has(String(segmento).toLowerCase()))
    .filter((segmento) => (ocultarNumericos ? !isNumericOnly(segmento) : true))
    .filter((segmento) => (ocultarUUID ? !isUUID(segmento) : true));
}

function montarTrilhaAutomatica({
  segmentos,
  mapaRotulos,
  resolverItem,
  manterBusca,
  manterHash,
  search,
  hash,
}) {
  const busca = manterBusca ? search : "";
  const ancora = manterHash ? hash : "";

  return segmentos
    .map((segmento, index) => {
      const rota = `/${segmentos.slice(0, index + 1).join("/")}`;
      const href = `${rota}${busca}${ancora}`;

      const itemResolvido =
        typeof resolverItem === "function"
          ? resolverItem({
              segmento,
              index,
              segmentos,
              href,
            })
          : null;

      if (itemResolvido?.ocultar) {
        return null;
      }

      const label =
        itemResolvido?.label ||
        mapaRotulos?.[segmento] ||
        criarRotuloBasico(segmento);

      const hrefFinal =
        typeof itemResolvido?.href === "string" ? itemResolvido.href : href;

      return {
        label,
        href: hrefFinal,
      };
    })
    .filter(Boolean);
}

function colapsarTrilha(lista, limite) {
  const max = Number(limite);

  if (!Number.isFinite(max) || max < 3 || lista.length <= max) {
    return lista;
  }

  return [
    lista[0],
    {
      label: "…",
      href: null,
      colapsado: true,
    },
    ...lista.slice(-(max - 2)),
  ];
}

export default function Breadcrumbs({
  trilha,
  inicioLabel = "Início",
  inicioHref = "/dashboard",
  ocultarSegmentos = ["turmas"],
  ocultarNumericos = false,
  ocultarUUID = false,
  mapaRotulos = {},
  resolverItem,
  limiteItens = 4,
  manterBusca = false,
  manterHash = false,
  prefixoRota = "",
  limiteCaracteres = 40,
  fixo = false,
  aoNavegar,
  className = "",
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const segmentos = useMemo(
    () =>
      normalizarSegmentos({
        pathname: location.pathname,
        prefixoRota,
        ocultarSegmentos,
        ocultarNumericos,
        ocultarUUID,
      }),
    [
      location.pathname,
      ocultarNumericos,
      ocultarSegmentos,
      ocultarUUID,
      prefixoRota,
    ]
  );

  const trilhaAutomatica = useMemo(
    () =>
      montarTrilhaAutomatica({
        segmentos,
        mapaRotulos,
        resolverItem,
        manterBusca,
        manterHash,
        search: location.search,
        hash: location.hash,
      }),
    [
      location.hash,
      location.search,
      manterBusca,
      manterHash,
      mapaRotulos,
      resolverItem,
      segmentos,
    ]
  );

  const itens = useMemo(() => {
    const base = Array.isArray(trilha) && trilha.length > 0 ? trilha : trilhaAutomatica;
    return colapsarTrilha(base, limiteItens);
  }, [limiteItens, trilha, trilhaAutomatica]);

  function navegar(href, item) {
    if (!href) return;

    aoNavegar?.(href, item);
    navigate(href);
  }

  return (
    <nav
      aria-label="Trilha de navegação"
      className={classNames(
        "mb-4 overflow-x-auto",
        "scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700",
        fixo &&
          "sticky top-0 z-20 rounded-b-3xl border-b border-slate-200/70 bg-white/80 py-2 shadow-sm backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80",
        className
      )}
    >
      <ol
        className="flex min-w-max items-center gap-1 rounded-2xl border border-slate-200 bg-white/80 px-2 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
        itemScope
        itemType="https://schema.org/BreadcrumbList"
      >
        <li
          itemProp="itemListElement"
          itemScope
          itemType="https://schema.org/ListItem"
          className="flex items-center"
        >
          <button
            type="button"
            onClick={() => navegar(inicioHref, { label: inicioLabel, href: inicioHref })}
            className={classNames(
              "inline-flex min-h-9 items-center gap-2 rounded-xl px-3 py-2 font-black text-emerald-900 transition",
              "hover:bg-emerald-50 hover:text-emerald-950",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
              "dark:text-emerald-200 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-100 dark:focus-visible:ring-offset-slate-950"
            )}
            aria-label={`Ir para ${inicioLabel}`}
            title={inicioLabel}
            itemProp="item"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            <span itemProp="name">{truncarTexto(inicioLabel, limiteCaracteres)}</span>
          </button>

          <meta itemProp="position" content="1" />
        </li>

        {itens.map((item, index) => {
          const isLast = index === itens.length - 1 || !item?.href;
          const position = index + 2;
          const label = truncarTexto(item?.label, limiteCaracteres);

          return (
            <li
              key={`${item?.label || "item"}-${index}`}
              className="flex shrink-0 items-center gap-1"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              <ChevronRight
                className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />

              {item?.colapsado ? (
                <span
                  className="inline-flex min-h-9 items-center rounded-xl px-2 text-slate-500 dark:text-slate-400"
                  aria-hidden="true"
                  title="Itens intermediários ocultos"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </span>
              ) : isLast ? (
                <span
                  className="inline-flex min-h-9 max-w-[34ch] items-center rounded-xl bg-slate-100 px-3 py-2 font-black text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                  aria-current="page"
                  title={item?.label}
                >
                  <span itemProp="name" className="truncate">
                    {label}
                  </span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => navegar(item.href, item)}
                  className={classNames(
                    "inline-flex min-h-9 max-w-[28ch] items-center rounded-xl px-3 py-2 font-bold text-slate-600 transition",
                    "hover:bg-slate-100 hover:text-slate-950",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                    "dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-offset-slate-950"
                  )}
                  aria-label={`Ir para ${item.label}`}
                  title={item.label}
                  itemProp="item"
                >
                  <span itemProp="name" className="truncate">
                    {label}
                  </span>
                </button>
              )}

              <meta itemProp="position" content={String(position)} />
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
  inicioLabel: PropTypes.string,
  inicioHref: PropTypes.string,
  ocultarSegmentos: PropTypes.arrayOf(PropTypes.string),
  ocultarNumericos: PropTypes.bool,
  ocultarUUID: PropTypes.bool,
  mapaRotulos: PropTypes.objectOf(PropTypes.string),
  resolverItem: PropTypes.func,
  limiteItens: PropTypes.number,
  manterBusca: PropTypes.bool,
  manterHash: PropTypes.bool,
  prefixoRota: PropTypes.string,
  limiteCaracteres: PropTypes.number,
  fixo: PropTypes.bool,
  aoNavegar: PropTypes.func,
  className: PropTypes.string,
};