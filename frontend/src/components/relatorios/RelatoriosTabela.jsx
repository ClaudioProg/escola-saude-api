// ✅ frontend/src/components/relatorios/RelatoriosTabela.jsx — v2.0
// Atualizado em: 15/05/2026
// Plataforma Escola da Saúde

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  LayoutGrid,
  Search,
  Table2,
} from "lucide-react";

import NadaEncontrado from "../ui/NadaEncontrado";

/**
 * RelatoriosTabela
 *
 * Função:
 * - Renderizar dados tabulares dos relatórios institucionais.
 * - Exibir tabela responsiva com opção de cards no mobile.
 * - Permitir ordenação client-side.
 * - Permitir colunas fixas à esquerda quando necessário.
 *
 * Diretrizes v2.0:
 * - Sem import legado de NenhumDado.
 * - Sem exportação CSV interna como fluxo institucional.
 * - Exportação oficial fica no backend: /api/relatorio/exportar/:tipo.xlsx.
 * - Sem dependência de endpoint.
 * - Sem toast.
 * - Sem alias de payload.
 */

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function isIsoDateLike(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value);
}

function formatarCabecalho(value) {
  const text = String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();

  if (!text) return "Campo";

  return text
    .replace(/\bid\b/gi, "ID")
    .replace(/\bcpf\b/gi, "CPF")
    .replace(/\bcnpj\b/gi, "CNPJ")
    .replace(/\bemail\b/gi, "E-mail")
    .replace(/\burl\b/gi, "URL")
    .replace(/\bpdf\b/gi, "PDF")
    .replace(/\bqr\b/gi, "QR")
    .replace(/\bjson\b/gi, "JSON")
    .replace(/\bdata inicio\b/gi, "Data início")
    .replace(/\bdata fim\b/gi, "Data fim")
    .replace(/\bnumero certificado\b/gi, "Número certificado")
    .replace(/\bcodigo validacao\b/gi, "Código validação")
    .replace(/\bhash pdf\b/gi, "Hash PDF")
    .replace(/\bhash dados\b/gi, "Hash dados")
    .replace(/\b([a-zà-ú])/g, (match) => match.toUpperCase());
}

function parseNumero(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") return null;
  if (isIsoDateLike(value)) return null;

  const text = value.trim();

  if (!text) return null;

  const normalized =
    text.includes(",") && text.includes(".")
      ? text.replace(/\./g, "").replace(",", ".")
      : text.includes(",")
        ? text.replace(",", ".")
        : text;

  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

function formatarData(value) {
  const text = String(value || "");
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);

  if (!match) return "";

  const date = `${match[3]}/${match[2]}/${match[1]}`;

  if (match[4] && match[5]) {
    return `${date} ${match[4]}:${match[5]}`;
  }

  return date;
}

function formatarCelula(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";

  if (isIsoDateLike(value)) {
    return formatarData(value) || String(value);
  }

  const number = parseNumero(value);

  if (number !== null) {
    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 2,
    }).format(number);
  }

  if (Array.isArray(value)) {
    return value.map(formatarCelula).join(", ");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function tooltipTexto(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function compararValores(a, b) {
  if (isIsoDateLike(a) && isIsoDateLike(b)) {
    return String(a).localeCompare(String(b));
  }

  const numA = parseNumero(a);
  const numB = parseNumero(b);

  if (numA !== null && numB !== null) {
    return numA - numB;
  }

  return String(a ?? "").localeCompare(String(b ?? ""), "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

function colunaEhNumerica(rows, col) {
  let total = 0;
  let numeric = 0;

  for (const row of rows) {
    if (!row || !(col in row)) continue;

    const value = row[col];

    if (value === null || value === undefined || value === "") continue;

    total += 1;

    if (parseNumero(value) !== null) numeric += 1;
  }

  return total > 0 && numeric / total >= 0.5;
}

function extrairColunas(data, columns) {
  if (Array.isArray(columns) && columns.length) {
    return columns.map(String);
  }

  const first = data?.[0];

  if (!first || typeof first !== "object" || Array.isArray(first)) {
    return [];
  }

  return Object.keys(first);
}

function getRowKey(row, index, keyField) {
  if (keyField && row?.[keyField] !== undefined && row?.[keyField] !== null) {
    return String(row[keyField]);
  }

  if (row?.id !== undefined && row?.id !== null) {
    return String(row.id);
  }

  if (row?.numero_certificado) {
    return String(row.numero_certificado);
  }

  if (row?.codigo_validacao) {
    return String(row.codigo_validacao);
  }

  return `row-${index}`;
}

function getCellClass(value, key, row, cellClassName) {
  if (typeof cellClassName === "function") {
    return cellClassName(value, key, row) || "";
  }

  return "";
}

function StatusPill({ value }) {
  const status = String(value || "").toLowerCase();

  const tones = {
    ok: "bg-emerald-50 text-emerald-800 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800/60",
    emitido:
      "bg-emerald-50 text-emerald-800 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800/60",
    enviado:
      "bg-cyan-50 text-cyan-800 ring-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-100 dark:ring-cyan-800/60",
    alerta:
      "bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/60",
    info: "bg-cyan-50 text-cyan-800 ring-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-100 dark:ring-cyan-800/60",
    critico:
      "bg-rose-50 text-rose-800 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-800/60",
    cancelado:
      "bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/60",
    anulado:
      "bg-rose-50 text-rose-800 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-800/60",
    substituido:
      "bg-violet-50 text-violet-800 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800/60",
    erro_emissao:
      "bg-rose-50 text-rose-800 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-800/60",
    programado:
      "bg-emerald-50 text-emerald-800 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800/60",
    andamento:
      "bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/60",
    encerrado:
      "bg-rose-50 text-rose-800 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-800/60",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ring-1",
        tones[status] ||
          "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700"
      )}
    >
      {safeText(value)}
    </span>
  );
}

function shouldRenderStatusPill(key, value) {
  const k = String(key || "").toLowerCase();

  if (k.includes("status") || k.includes("severidade") || k.includes("motivo")) {
    return typeof value === "string" && value.trim() !== "";
  }

  return false;
}

function SortIcon({ active, dir }) {
  if (!active) return <ArrowUpDown className="h-3.5 w-3.5 opacity-75" aria-hidden="true" />;
  if (dir === "asc") return <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />;
  return <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />;
}

/* ─────────────────────────────────────────────
 * Componente principal
 * ───────────────────────────────────────────── */

export default function RelatoriosTabela({
  data = [],
  columns,
  caption = "Tabela de resultados do relatório",
  loading = false,
  striped = true,
  dense = false,
  onRowClick,
  sortable = true,
  defaultSort = null,
  pinnedLeft = [],
  maxHeight = 560,
  totals = false,
  cellClassName,
  formatters = {},
  mobileAsCards = true,
  cardTitleKey,
  keyField = "",
  hiddenKeys = [],
  className = "",
}) {
  const headerId = useId();
  const wrapRef = useRef(null);
  const headRef = useRef(null);

  const rows = useMemo(() => safeArray(data), [data]);
  const hiddenSet = useMemo(
    () => new Set(safeArray(hiddenKeys).map(String)),
    [hiddenKeys]
  );

  const colunas = useMemo(() => {
    return extrairColunas(rows, columns).filter((key) => !hiddenSet.has(String(key)));
  }, [rows, columns, hiddenSet]);

  const labels = useMemo(() => {
    const out = {};

    for (const col of colunas) {
      out[col] = formatarCabecalho(col);
    }

    return out;
  }, [colunas]);

  const [sort, setSort] = useState(() => {
    if (defaultSort?.key) return defaultSort;
    return { key: null, dir: "asc" };
  });

  const [view, setView] = useState("auto");
  const [isMobile, setIsMobile] = useState(false);
  const [leftOffsets, setLeftOffsets] = useState({});

  const pinnedSet = useMemo(
    () => new Set(safeArray(pinnedLeft).map(String)),
    [pinnedLeft]
  );

  const clickable = typeof onRowClick === "function";
  const titleKey = cardTitleKey || colunas[0] || "";

  useEffect(() => {
    const onResize = () => {
      setIsMobile((window.innerWidth || 1024) < 640);
    };

    onResize();

    window.addEventListener("resize", onResize, { passive: true });

    return () => window.removeEventListener("resize", onResize);
  }, []);

  const effectiveView = useMemo(() => {
    if (view === "table") return "table";
    if (view === "cards") return "cards";

    return mobileAsCards && isMobile ? "cards" : "table";
  }, [view, mobileAsCards, isMobile]);

  const sortedData = useMemo(() => {
    if (!sortable || !sort?.key) return rows;

    const clone = rows.slice();
    const factor = sort.dir === "desc" ? -1 : 1;

    clone.sort((a, b) => factor * compararValores(a?.[sort.key], b?.[sort.key]));

    return clone;
  }, [rows, sortable, sort]);

  const totais = useMemo(() => {
    if (!totals) return null;

    const out = {};

    for (const col of colunas) {
      let sum = 0;
      let count = 0;

      for (const row of sortedData) {
        const number = parseNumero(row?.[col]);

        if (number !== null) {
          sum += number;
          count += 1;
        }
      }

      out[col] = count ? sum : null;
    }

    return out;
  }, [totals, colunas, sortedData]);

  useEffect(() => {
    if (!headRef.current || !pinnedSet.size) {
      setLeftOffsets({});
      return;
    }

    const compute = () => {
      const ths = Array.from(headRef.current.querySelectorAll("th[data-colkey]"));
      const widths = {};

      for (const th of ths) {
        const key = th.getAttribute("data-colkey");

        if (!key) continue;

        widths[key] = th.getBoundingClientRect().width || 0;
      }

      const offsets = {};
      let acc = 0;

      for (const col of colunas) {
        if (pinnedSet.has(String(col))) {
          offsets[col] = acc;
          acc += widths[col] || 0;
        }
      }

      setLeftOffsets(offsets);
    };

    compute();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", compute);
      return () => window.removeEventListener("resize", compute);
    }

    const observer = new ResizeObserver(compute);

    observer.observe(headRef.current);

    if (wrapRef.current) observer.observe(wrapRef.current);

    return () => observer.disconnect();
  }, [colunas, pinnedSet]);

  const handleSort = useCallback(
    (key) => {
      if (!sortable) return;

      setSort((prev) => {
        if (prev.key === key) {
          return {
            key,
            dir: prev.dir === "asc" ? "desc" : "asc",
          };
        }

        return {
          key,
          dir: "asc",
        };
      });
    },
    [sortable]
  );

  const ariaSort = useCallback(
    (key) => {
      if (!sortable || sort.key !== key) return "none";
      return sort.dir === "asc" ? "ascending" : "descending";
    },
    [sortable, sort]
  );

  const renderCell = useCallback(
    (key, value, row) => {
      if (typeof formatters?.[key] === "function") {
        return formatters[key](value, row);
      }

      if (shouldRenderStatusPill(key, value)) {
        return <StatusPill value={value} />;
      }

      return formatarCelula(value);
    },
    [formatters]
  );

  const onRowKeyDown = useCallback(
    (event, row) => {
      if (!clickable) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onRowClick(row);
      }
    },
    [clickable, onRowClick]
  );

  if (loading) {
    return (
      <section
        className={cx(
          "rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800",
          className
        )}
        aria-label={caption}
        aria-busy="true"
      >
        <div className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-zinc-300">
          <Search className="h-4 w-4 animate-pulse" aria-hidden="true" />
          Carregando dados...
        </div>

        <div className="mt-4 space-y-3">
          <div className="h-10 animate-pulse rounded-2xl bg-slate-100 dark:bg-zinc-800" />
          <div className="h-10 animate-pulse rounded-2xl bg-slate-100 dark:bg-zinc-800" />
          <div className="h-10 animate-pulse rounded-2xl bg-slate-100 dark:bg-zinc-800" />
        </div>
      </section>
    );
  }

  if (!rows.length || !colunas.length) {
    return (
      <NadaEncontrado
        titulo="Nenhum dado encontrado"
        descricao="Ajuste os filtros ou consulte outro relatório."
      />
    );
  }

  return (
    <section
      ref={wrapRef}
      className={cx(
        "overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800",
        className
      )}
      aria-labelledby={headerId}
    >
      <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3
            id={headerId}
            className="truncate text-sm font-black text-slate-950 dark:text-white"
          >
            {caption}
          </h3>

          <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-zinc-400">
            {sortedData.length} linha(s) • {colunas.length} coluna(s)
          </p>
        </div>

        {mobileAsCards ? (
          <div className="inline-flex w-full overflow-hidden rounded-2xl ring-1 ring-slate-200 dark:ring-zinc-700 sm:w-auto">
            <button
              type="button"
              onClick={() => setView("auto")}
              className={cx(
                "flex-1 px-3 py-2 text-xs font-black transition sm:flex-none",
                view === "auto"
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                  : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              )}
            >
              Auto
            </button>

            <button
              type="button"
              onClick={() => setView("table")}
              className={cx(
                "inline-flex flex-1 items-center justify-center gap-1 px-3 py-2 text-xs font-black transition sm:flex-none",
                view === "table"
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                  : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              )}
            >
              <Table2 className="h-4 w-4" aria-hidden="true" />
              Tabela
            </button>

            <button
              type="button"
              onClick={() => setView("cards")}
              className={cx(
                "inline-flex flex-1 items-center justify-center gap-1 px-3 py-2 text-xs font-black transition sm:flex-none",
                view === "cards"
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                  : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              )}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              Cards
            </button>
          </div>
        ) : null}
      </header>

      {effectiveView === "cards" ? (
        <div className="p-4">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sortedData.map((row, index) => {
              const key = getRowKey(row, index, keyField);
              const title = renderCell(titleKey, row?.[titleKey], row);

              return (
                <li
                  key={key}
                  className={cx(
                    "rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800",
                    clickable &&
                      "cursor-pointer transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:bg-zinc-800"
                  )}
                  role={clickable ? "button" : "listitem"}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => onRowClick(row) : undefined}
                  onKeyDown={(event) => onRowKeyDown(event, row)}
                >
                  <div className="break-words text-sm font-black text-slate-950 dark:text-white">
                    {title || "Registro"}
                  </div>

                  <dl className="mt-3 space-y-2">
                    {colunas
                      .filter((col) => col !== titleKey)
                      .slice(0, 9)
                      .map((col) => (
                        <div key={col} className="grid grid-cols-[110px_1fr] gap-2">
                          <dt className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                            {labels[col]}
                          </dt>
                          <dd className="min-w-0 break-words text-xs font-semibold text-slate-800 dark:text-zinc-200">
                            {renderCell(col, row?.[col], row)}
                          </dd>
                        </div>
                      ))}
                  </dl>

                  {colunas.length > 10 ? (
                    <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                      + {colunas.length - 10} campo(s)
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="overflow-auto" style={{ maxHeight }}>
          <table
            className="min-w-full border-collapse text-left text-sm"
            aria-label={caption}
          >
            <caption className="sr-only">{caption}</caption>

            <thead
              ref={headRef}
              className="sticky top-0 z-20 bg-slate-950 text-white"
            >
              <tr>
                {colunas.map((col) => {
                  const numeric = colunaEhNumerica(sortedData, col);
                  const pinned = pinnedSet.has(String(col));
                  const left = leftOffsets[col] ?? 0;

                  return (
                    <th
                      key={col}
                      data-colkey={col}
                      scope="col"
                      aria-sort={ariaSort(col)}
                      className={cx(
                        "border-b border-white/15 px-4 font-black whitespace-nowrap",
                        dense ? "py-2" : "py-3",
                        numeric ? "text-right" : "text-left",
                        pinned && "sticky z-30 bg-slate-950"
                      )}
                      style={pinned ? { left } : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(col)}
                        disabled={!sortable}
                        className={cx(
                          "inline-flex items-center gap-1.5 rounded text-inherit",
                          sortable &&
                            "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                        )}
                        title={sortable ? "Ordenar coluna" : undefined}
                      >
                        {labels[col]}
                        {sortable ? (
                          <SortIcon active={sort.key === col} dir={sort.dir} />
                        ) : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">
              {sortedData.map((row, rowIndex) => {
                const rowKey = getRowKey(row, rowIndex, keyField);
                const zebra =
                  striped && rowIndex % 2 === 1
                    ? "bg-slate-50/80 dark:bg-white/[0.03]"
                    : "";

                return (
                  <tr
                    key={rowKey}
                    className={cx(
                      "border-t border-slate-200 transition dark:border-zinc-800",
                      zebra,
                      clickable
                        ? "cursor-pointer hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:bg-violet-950/20"
                        : "hover:bg-slate-50 dark:hover:bg-zinc-800/60"
                    )}
                    role={clickable ? "button" : "row"}
                    tabIndex={clickable ? 0 : undefined}
                    onClick={clickable ? () => onRowClick(row) : undefined}
                    onKeyDown={(event) => onRowKeyDown(event, row)}
                  >
                    {colunas.map((col) => {
                      const value = row?.[col];
                      const numeric = parseNumero(value) !== null;
                      const pinned = pinnedSet.has(String(col));
                      const left = leftOffsets[col] ?? 0;

                      return (
                        <td
                          key={col}
                          className={cx(
                            "border-b border-slate-100 px-4 align-top dark:border-zinc-800",
                            dense ? "py-1.5" : "py-2.5",
                            numeric ? "text-right" : "text-left",
                            pinned &&
                              "sticky z-10 bg-white/95 dark:bg-zinc-950/95",
                            getCellClass(value, col, row, cellClassName)
                          )}
                          style={pinned ? { left } : undefined}
                          title={tooltipTexto(value)}
                        >
                          <span className="inline-block max-w-[42ch] break-words">
                            {renderCell(col, value, row)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            {totals && totais ? (
              <tfoot className="sticky bottom-0 z-10 bg-slate-50 dark:bg-zinc-950">
                <tr>
                  {colunas.map((col) => {
                    const value = totais[col];
                    const hasTotal = value !== null && value !== undefined;

                    return (
                      <td
                        key={col}
                        className={cx(
                          "border-t border-slate-200 px-4 font-black dark:border-zinc-800",
                          dense ? "py-1.5" : "py-2.5",
                          hasTotal
                            ? "text-right text-slate-950 dark:text-white"
                            : "text-left text-slate-500 dark:text-zinc-400"
                        )}
                      >
                        {hasTotal
                          ? new Intl.NumberFormat("pt-BR", {
                              maximumFractionDigits: 2,
                            }).format(value)
                          : "—"}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
    </section>
  );
}

RelatoriosTabela.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object),
  columns: PropTypes.arrayOf(PropTypes.string),
  caption: PropTypes.string,
  loading: PropTypes.bool,
  striped: PropTypes.bool,
  dense: PropTypes.bool,
  onRowClick: PropTypes.func,
  sortable: PropTypes.bool,
  defaultSort: PropTypes.shape({
    key: PropTypes.string,
    dir: PropTypes.oneOf(["asc", "desc"]),
  }),
  pinnedLeft: PropTypes.arrayOf(PropTypes.string),
  maxHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  totals: PropTypes.bool,
  cellClassName: PropTypes.func,
  formatters: PropTypes.object,
  mobileAsCards: PropTypes.bool,
  cardTitleKey: PropTypes.string,
  keyField: PropTypes.string,
  hiddenKeys: PropTypes.arrayOf(PropTypes.string),
  className: PropTypes.string,
};