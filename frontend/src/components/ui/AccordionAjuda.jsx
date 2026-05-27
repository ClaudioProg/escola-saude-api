// ✅ src/components/ui/AccordionAjuda.jsx — v2.0
// Plataforma Escola da Saúde
//
// Accordion genérico de ajuda/FAQ.
//
// Revisão premium:
// - componente realmente genérico de UI;
// - sem conteúdo institucional fixo dentro de ui;
// - busca acessível;
// - expandir/recolher tudo;
// - deep link por hash;
// - copiar link da pergunta;
// - sem dependência de @headlessui/react;
// - mobile-first;
// - dark mode;
// - reduced motion friendly;
// - IDs estáveis;
// - diagnóstico silencioso sem console solto;
// - preparado para reutilização em qualquer domínio.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Check,
  ChevronDown,
  Link as LinkIcon,
  Minus,
  Plus,
  Search,
} from "lucide-react";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizarTexto(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function gerarId(texto, fallback) {
  const base = normalizarTexto(texto)
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);

  return base || fallback;
}

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function highlight(texto, query) {
  const value = String(texto || "");

  if (!query) {
    return value;
  }

  const normalizedQuery = normalizarTexto(query);
  const safeQuery = escapeRegExp(query);

  if (!safeQuery) {
    return value;
  }

  const parts = value.split(new RegExp(`(${safeQuery})`, "gi"));

  return parts.map((part, index) =>
    normalizarTexto(part) === normalizedQuery ? (
      <mark
        key={`${part}-${index}`}
        className="rounded bg-amber-200 px-0.5 text-inherit dark:bg-amber-500/40"
      >
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

const ACCENTS = {
  emerald: {
    primary:
      "bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:ring-emerald-500",
    outline:
      "border-emerald-700 text-emerald-800 hover:bg-emerald-50 focus-visible:ring-emerald-500 dark:border-emerald-600 dark:text-emerald-200 dark:hover:bg-emerald-950/40",
    focus: "focus-visible:ring-emerald-500",
    activeBorder: "border-emerald-300 dark:border-emerald-800",
  },
  violet: {
    primary:
      "bg-violet-700 text-white hover:bg-violet-800 focus-visible:ring-violet-500",
    outline:
      "border-violet-700 text-violet-800 hover:bg-violet-50 focus-visible:ring-violet-500 dark:border-violet-600 dark:text-violet-200 dark:hover:bg-violet-950/40",
    focus: "focus-visible:ring-violet-500",
    activeBorder: "border-violet-300 dark:border-violet-800",
  },
  amber: {
    primary:
      "bg-amber-600 text-slate-950 hover:bg-amber-700 focus-visible:ring-amber-500",
    outline:
      "border-amber-600 text-amber-800 hover:bg-amber-50 focus-visible:ring-amber-500 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-950/40",
    focus: "focus-visible:ring-amber-500",
    activeBorder: "border-amber-300 dark:border-amber-800",
  },
  sky: {
    primary:
      "bg-sky-700 text-white hover:bg-sky-800 focus-visible:ring-sky-500",
    outline:
      "border-sky-700 text-sky-800 hover:bg-sky-50 focus-visible:ring-sky-500 dark:border-sky-600 dark:text-sky-200 dark:hover:bg-sky-950/40",
    focus: "focus-visible:ring-sky-500",
    activeBorder: "border-sky-300 dark:border-sky-800",
  },
  slate: {
    primary:
      "bg-slate-800 text-white hover:bg-slate-900 focus-visible:ring-slate-500 dark:bg-slate-200 dark:text-slate-950 dark:hover:bg-white",
    outline:
      "border-slate-300 text-slate-800 hover:bg-slate-50 focus-visible:ring-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900",
    focus: "focus-visible:ring-slate-500",
    activeBorder: "border-slate-300 dark:border-slate-700",
  },
};

function normalizarItens(items, fallbackPrefix) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const pergunta = String(item?.pergunta || item?.titulo || "").trim();
      const resposta = item?.resposta ?? item?.conteudo ?? "";

      if (!pergunta || resposta === null || resposta === undefined) {
        return null;
      }

      return {
        id: item?.id || gerarId(pergunta, `${fallbackPrefix}-${index + 1}`),
        pergunta,
        resposta: String(resposta),
      };
    })
    .filter(Boolean);
}

export default function AccordionAjuda({
  perguntas = [],
  accent = "emerald",
  compact = false,
  emptyMessage = "Nenhuma pergunta encontrada.",
  searchPlaceholder = "Buscar no FAQ...",
  ariaLabel = "Perguntas frequentes",
  className = "",
  initialOpenIds = [],
  enableSearch = true,
  enableExpandControls = true,
  enableCopyLink = true,
  enableDeepLink = true,
  onToggle,
  onCopyLink,
}) {
  const reactId = useId();
  const searchId = `${reactId}-search`;
  const countId = `${reactId}-count`;

  const theme = ACCENTS[accent] || ACCENTS.emerald;

  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState(() => new Set(initialOpenIds));
  const [copiedId, setCopiedId] = useState(null);

  const openedHashOnceRef = useRef(false);
  const itemRefs = useRef(new Map());

  const itens = useMemo(
    () => normalizarItens(perguntas, reactId),
    [perguntas, reactId]
  );

  const filtradas = useMemo(() => {
    const q = normalizarTexto(query).trim();

    if (!q) {
      return itens;
    }

    return itens.filter(
      (item) =>
        normalizarTexto(item.pergunta).includes(q) ||
        normalizarTexto(item.resposta).includes(q)
    );
  }, [itens, query]);

  const hasItems = itens.length > 0;
  const hasResults = filtradas.length > 0;

  const announceResults = hasResults
    ? `${filtradas.length} resultado${filtradas.length === 1 ? "" : "s"}`
    : "Nenhum resultado";

  const setItemRef = useCallback((id, node) => {
    if (!id) return;

    if (node) {
      itemRefs.current.set(id, node);
    } else {
      itemRefs.current.delete(id);
    }
  }, []);

  const toggleItem = useCallback(
    (id) => {
      setOpenIds((prev) => {
        const next = new Set(prev);
        const willOpen = !next.has(id);

        if (willOpen) {
          next.add(id);
        } else {
          next.delete(id);
        }

        onToggle?.(id, willOpen);

        return next;
      });
    },
    [onToggle]
  );

  const expandAll = useCallback(() => {
    setOpenIds(new Set(filtradas.map((item) => item.id)));
  }, [filtradas]);

  const collapseAll = useCallback(() => {
    setOpenIds(new Set());
  }, []);

  const copyLink = useCallback(
    async (id) => {
      if (!enableCopyLink || !isBrowser()) {
        return;
      }

      const url = `${window.location.origin}${window.location.pathname}#${id}`;

      try {
        await navigator.clipboard.writeText(url);
        setCopiedId(id);
        onCopyLink?.(id);
      } catch {
        setCopiedId(null);
      }
    },
    [enableCopyLink, onCopyLink]
  );

  useEffect(() => {
    if (!copiedId) return undefined;

    const timeoutId = window.setTimeout(() => setCopiedId(null), 1500);

    return () => window.clearTimeout(timeoutId);
  }, [copiedId]);

  useEffect(() => {
    if (!enableDeepLink || !isBrowser()) {
      return undefined;
    }

    const openHash = () => {
      const idFromHash = window.location.hash.replace("#", "");

      if (!idFromHash) {
        return;
      }

      const exists = itens.some((item) => item.id === idFromHash);

      if (!exists) {
        return;
      }

      setOpenIds((prev) => new Set(prev).add(idFromHash));

      window.setTimeout(() => {
        const node = itemRefs.current.get(idFromHash) || document.getElementById(idFromHash);
        node?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    };

    if (!openedHashOnceRef.current) {
      openedHashOnceRef.current = true;
      openHash();
    }

    window.addEventListener("hashchange", openHash);

    return () => window.removeEventListener("hashchange", openHash);
  }, [enableDeepLink, itens]);

  const containerPadding = compact ? "px-3 py-4" : "px-4 py-5";
  const buttonPadding = compact ? "px-3 py-3" : "px-4 py-4";
  const panelPadding = compact ? "px-3 pb-3" : "px-4 pb-4";

  return (
    <section
      className={classNames("mx-auto w-full max-w-4xl", className)}
      aria-label={ariaLabel}
    >
      {enableSearch && (
        <div className="mb-4">
          <label htmlFor={searchId} className="sr-only">
            Buscar perguntas
          </label>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />

            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className={classNames(
                "w-full rounded-2xl border border-slate-300 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400",
                "focus-visible:ring-2",
                theme.focus,
                "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              )}
              aria-describedby={countId}
            />
          </div>

          <p
            id={countId}
            className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400"
            aria-live="polite"
          >
            {announceResults}
          </p>
        </div>
      )}

      {enableExpandControls && hasItems && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={expandAll}
            className={classNames(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2",
              theme.primary
            )}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Expandir tudo
          </button>

          <button
            type="button"
            onClick={collapseAll}
            className={classNames(
              "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2",
              theme.outline
            )}
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
            Recolher tudo
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {filtradas.map((item) => {
          const isOpen = openIds.has(item.id);
          const panelId = `${item.id}-panel`;
          const buttonId = `${item.id}-button`;

          return (
            <li
              key={item.id}
              id={item.id}
              ref={(node) => setItemRef(item.id, node)}
              className={classNames(
                "scroll-mt-24 overflow-hidden rounded-2xl border bg-white shadow-sm transition dark:bg-slate-900",
                isOpen
                  ? theme.activeBorder
                  : "border-slate-200 dark:border-slate-800"
              )}
            >
              <div className={classNames("flex items-stretch", containerPadding)}>
                <button
                  id={buttonId}
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className={classNames(
                    "flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl text-left transition focus-visible:outline-none focus-visible:ring-2",
                    buttonPadding,
                    theme.focus
                  )}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                >
                  <span className="min-w-0 text-sm font-black text-slate-900 dark:text-white sm:text-base">
                    {highlight(item.pergunta, query)}
                  </span>

                  <ChevronDown
                    className={classNames(
                      "h-5 w-5 shrink-0 text-slate-500 transition-transform dark:text-slate-300",
                      isOpen && "rotate-180"
                    )}
                    aria-hidden="true"
                  />
                </button>

                {enableCopyLink && (
                  <button
                    type="button"
                    onClick={() => copyLink(item.id)}
                    className={classNames(
                      "ml-2 mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 dark:text-slate-300 dark:hover:bg-slate-800",
                      theme.focus
                    )}
                    aria-label={`Copiar link da pergunta: ${item.pergunta}`}
                    title="Copiar link da pergunta"
                  >
                    {copiedId === item.id ? (
                      <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <LinkIcon className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                )}
              </div>

              {isOpen && (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className={classNames(
                    panelPadding,
                    "text-sm leading-relaxed text-slate-700 dark:text-slate-300"
                  )}
                >
                  {highlight(item.resposta, query)}
                </div>
              )}
            </li>
          );
        })}

        {!hasResults && (
          <li className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
            {emptyMessage}
            {query && (
              <>
                {" "}
                para <strong>“{query}”</strong>.
              </>
            )}
          </li>
        )}

        {!hasItems && (
          <li className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
            Nenhuma pergunta foi configurada.
          </li>
        )}
      </ul>
    </section>
  );
}

AccordionAjuda.propTypes = {
  perguntas: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      pergunta: PropTypes.string,
      titulo: PropTypes.string,
      resposta: PropTypes.string,
      conteudo: PropTypes.string,
    })
  ),
  accent: PropTypes.oneOf(["emerald", "violet", "amber", "sky", "slate"]),
  compact: PropTypes.bool,
  emptyMessage: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  ariaLabel: PropTypes.string,
  className: PropTypes.string,
  initialOpenIds: PropTypes.arrayOf(PropTypes.string),
  enableSearch: PropTypes.bool,
  enableExpandControls: PropTypes.bool,
  enableCopyLink: PropTypes.bool,
  enableDeepLink: PropTypes.bool,
  onToggle: PropTypes.func,
  onCopyLink: PropTypes.func,
};