// 📁 src/components/RelatoriosTabela.jsx
import PropTypes from "prop-types";
import NenhumDado from "./NenhumDado";
import { useEffect, useMemo, useRef, useState, useId, useCallback } from "react";
import { Download, ArrowUpDown, ArrowUp, ArrowDown, Table2, LayoutGrid } from "lucide-react";

/**
 * RelatoriosTabela (Premium Pro)
 * - Tabela responsiva com fallback para "cards" no mobile
 * - Ordenação client-side opcional
 * - Export CSV premium
 * - Colunas fixas (sticky) reais via medição (ResizeObserver)
 * - Totais opcionais em <tfoot>
 *
 * Props:
 * data, columns, caption, loading, striped, dense, onRowClick
 * sortable, defaultSort, exportable, csvFileName
 * pinnedLeft, maxHeight, totals, cellClassName, formatters
 *
 * Extra premium (não quebra nada):
 * - mobileAsCards?: boolean (default: true) – em telas pequenas, renderiza cards
 * - cardTitleKey?: string – coluna usada como "título" do card (fallback: 1ª coluna)
 * - formatterText?: Record<col, fn(valor, row) => string> – texto para export CSV quando formatter retorna JSX
 */
export default function RelatoriosTabela({
  data = [],
  columns,
  caption = "Tabela de resultados do relatório",
  loading = false,
  striped = true,
  dense = false,
  onRowClick,

  // novos (já existentes no seu)
  sortable = true,
  defaultSort = null,
  exportable = true,
  csvFileName = "relatorio",
  pinnedLeft = [],
  maxHeight = 520,
  totals = false,
  cellClassName,
  formatters = {},

  // extras premium
  mobileAsCards = true,
  cardTitleKey,
  formatterText = {},
}) {
  const tableId = useId();
  const headerId = useId();

  const wrapRef = useRef(null);
  const headRef = useRef(null);

  const [sort, setSort] = useState(
    defaultSort && defaultSort.key ? defaultSort : { key: null, dir: "asc" }
  );

  // modo visual (tabela vs cards) — auto em mobile
  const [view, setView] = useState("auto"); // "auto" | "table" | "cards"
  const [isMobile, setIsMobile] = useState(false);

  // offsets reais das colunas pinned
  const [leftOffsets, setLeftOffsets] = useState({});

  // Se não vier 'columns', usa as chaves da primeira linha
  const autoCols = Object.keys(data?.[0] || {});
  const colunas = Array.isArray(columns) && columns.length ? columns : autoCols;

  // pinned set (por chave ou label)
  const pinnedSet = useMemo(() => new Set((pinnedLeft || []).map(String)), [pinnedLeft]);

  // rótulos amigáveis
  const labels = useMemo(() => {
    const m = {};
    for (const c of colunas) m[c] = formatarCabecalho(c);
    return m;
  }, [colunas]);

  // responsividade (sem libs)
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth || 1024;
      setIsMobile(w < 640); // tailwind sm
    };
    onResize();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const effectiveView = useMemo(() => {
    if (view === "table") return "table";
    if (view === "cards") return "cards";
    // auto:
    return mobileAsCards && isMobile ? "cards" : "table";
  }, [view, mobileAsCards, isMobile]);

  // Ordenação
  const sortedData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    if (!sortable || !sort?.key) return data;

    const { key, dir } = sort;
    const mult = dir === "desc" ? -1 : 1;

    const clone = [...data];
    clone.sort((a, b) => mult * compararValores(a?.[key], b?.[key]));
    return clone;
  }, [data, sortable, sort]);

  const handleSort = (key) => {
    if (!sortable) return;
    setSort((prev) => {
      if (prev.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { key, dir: "asc" };
    });
  };

  const ariaSort = (key) => {
    if (!sortable || sort.key !== key) return "none";
    return sort.dir === "asc" ? "ascending" : "descending";
  };

  const SortIcon = ({ active, dir }) => {
    if (!sortable) return null;
    if (!active) return <ArrowUpDown className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />;
    if (dir === "asc") return <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />;
    return <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />;
  };

  // Totais
  const totais = useMemo(() => {
    if (!totals) return null;
    const out = {};
    for (const c of colunas) {
      let soma = 0;
      let cont = 0;
      for (const r of sortedData) {
        const v = r?.[c];
        const num = parseNumero(v);
        if (num !== null) {
          soma += num;
          cont++;
        }
      }
      out[c] = cont ? soma : null;
    }
    return out;
  }, [totals, colunas, sortedData]);

  // CSV export (respeita ordenação + colunas visíveis)
  const exportCSV = useCallback(() => {
    const header = colunas.map((c) => labels[c]);

    const rows = sortedData.map((row) =>
      colunas.map((c) => {
        const raw = row?.[c];
        // se houver formatterText, ele ganha pro CSV (evita ReactNode)
        if (typeof formatterText?.[c] === "function") {
          return formatterText[c](raw, row);
        }
        // se houver formatter visual, tenta converter em texto “seguro”
        if (typeof formatters?.[c] === "function") {
          const rendered = formatters[c](raw, row);
          return plainText(rendered, raw);
        }
        return formatarCelulaTexto(raw);
      })
    );

    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${(csvFileName || "relatorio").replace(/[^\w.-]+/g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [sortedData, colunas, labels, csvFileName, formatters, formatterText]);

  // pinned offsets reais (mede <th> quando houver)
  useEffect(() => {
    if (!headRef.current) return;
    if (!pinnedSet.size) {
      setLeftOffsets({});
      return;
    }

    const compute = () => {
      const ths = Array.from(headRef.current.querySelectorAll("th[data-colkey]"));
      const widths = {};
      for (const th of ths) {
        const k = th.getAttribute("data-colkey");
        if (!k) continue;
        widths[k] = th.getBoundingClientRect().width || 0;
      }

      const offsets = {};
      let acc = 0;
      for (const c of colunas) {
        if (pinnedSet.has(String(c))) {
          offsets[c] = acc;
          acc += widths[c] || 0;
        }
      }
      setLeftOffsets(offsets);
    };

    compute();

    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => compute());
      ro.observe(headRef.current);
      // também observa o wrapper (mudança de largura total)
      if (wrapRef.current) ro.observe(wrapRef.current);
    } else {
      const onWin = () => compute();
      window.addEventListener("resize", onWin);
      return () => window.removeEventListener("resize", onWin);
    }

    return () => ro?.disconnect?.();
  }, [colunas, pinnedSet]);

  // helpers de interação (row click)
  const clickable = typeof onRowClick === "function";

  const onRowKeyDown = (e, row) => {
    if (!clickable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onRowClick(row);
    }
  };

  /* ───────────────── Render states ───────────────── */
  if (loading) {
    return (
      <div className="mt-6 rounded-2xl shadow-[0_18px_55px_-40px_rgba(0,0,0,0.55)] border border-zinc-200/70 dark:border-white/10 bg-white/90 dark:bg-zinc-900/70 p-6 text-sm text-zinc-600 dark:text-zinc-300">
        Carregando dados…
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <NenhumDado
        mensagem="📭 Nenhum dado encontrado para os filtros aplicados."
        sugestao="Tente ajustar os filtros ou consultar outro período."
      />
    );
  }

  const titleKey = cardTitleKey || colunas[0];

  return (
    <div
      ref={wrapRef}
      className="mt-6 rounded-2xl overflow-hidden shadow-[0_18px_55px_-40px_rgba(0,0,0,0.55)] border border-zinc-200/70 dark:border-white/10 bg-white/90 dark:bg-zinc-900/70"
      aria-labelledby={headerId}
    >
      {/* Header utilitário premium */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-zinc-200/70 dark:border-white/10 bg-zinc-50/70 dark:bg-white/5">
        <div className="min-w-0">
          <div id={headerId} className="text-sm font-extrabold tracking-tight text-zinc-900 dark:text-white truncate">
            {caption}
          </div>
          <div className="text-[11px] text-zinc-600 dark:text-zinc-300">
            {sortedData.length} linha(s) • {colunas.length} coluna(s)
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">
          {/* toggle view (auto/table/cards) */}
          {mobileAsCards && (
            <div className="inline-flex rounded-2xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
              <button
                type="button"
                onClick={() => setView("auto")}
                className={`px-3 py-2 text-xs font-extrabold ${
                  view === "auto"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "bg-white/70 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900/40 dark:text-zinc-200 dark:hover:bg-white/10"
                }`}
                title="Automático"
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => setView("table")}
                className={`px-3 py-2 text-xs font-extrabold inline-flex items-center gap-1 ${
                  view === "table"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "bg-white/70 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900/40 dark:text-zinc-200 dark:hover:bg-white/10"
                }`}
                title="Tabela"
              >
                <Table2 className="w-4 h-4" aria-hidden="true" />
                Tabela
              </button>
              <button
                type="button"
                onClick={() => setView("cards")}
                className={`px-3 py-2 text-xs font-extrabold inline-flex items-center gap-1 ${
                  view === "cards"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "bg-white/70 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900/40 dark:text-zinc-200 dark:hover:bg-white/10"
                }`}
                title="Cards"
              >
                <LayoutGrid className="w-4 h-4" aria-hidden="true" />
                Cards
              </button>
            </div>
          )}

          {exportable && (
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-2xl font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 ring-1 ring-emerald-800/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
              title="Exportar CSV"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* Corpo */}
      {effectiveView === "cards" ? (
        <div className="p-4">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={caption}>
            {sortedData.map((row, idx) => {
              const title = formatters?.[titleKey]
                ? formatters[titleKey](row?.[titleKey], row)
                : formatarCelula(row?.[titleKey]);

              return (
                <li
                  key={idx}
                  className={[
                    "rounded-2xl border border-zinc-200/70 dark:border-white/10",
                    "bg-white/80 dark:bg-zinc-950/25",
                    "shadow-sm",
                    clickable ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/5" : "",
                    "p-4",
                  ].join(" ")}
                  onClick={clickable ? () => onRowClick(row) : undefined}
                  onKeyDown={(e) => onRowKeyDown(e, row)}
                  tabIndex={clickable ? 0 : -1}
                  role={clickable ? "button" : "article"}
                >
                  <div className="text-sm font-extrabold tracking-tight text-zinc-900 dark:text-white break-words">
                    {title}
                  </div>

                  <dl className="mt-3 space-y-2">
                    {colunas
                      .filter((c) => c !== titleKey)
                      .slice(0, 8) // limite visual bom pro card
                      .map((col) => {
                        const v = row?.[col];
                        const content = formatters?.[col] ? formatters[col](v, row) : formatarCelula(v);
                        return (
                          <div key={col} className="flex gap-2">
                            <dt className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 w-28 shrink-0">
                              {labels[col]}
                            </dt>
                            <dd className="text-[12px] text-zinc-800 dark:text-zinc-200 break-words">
                              {content}
                            </dd>
                          </div>
                        );
                      })}
                  </dl>

                  {colunas.length > 9 && (
                    <div className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                      + {colunas.length - 9} campo(s)
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="overflow-auto" style={{ maxHeight }}>
          <table
            id={tableId}
            className="min-w-full text-sm text-left border-collapse"
            role="table"
            aria-label={caption}
          >
            <caption className="sr-only">{caption}</caption>

            <thead
              ref={headRef}
              className="bg-zinc-900 text-white sticky top-0 z-10"
            >
              <tr>
                {colunas.map((col) => {
                  const isNumeric = colunaEhNumerica(sortedData, col);
                  const isPinned = pinnedSet.has(String(col));
                  const left = leftOffsets[col] ?? 0;

                  return (
                    <th
                      key={col}
                      data-colkey={col}
                      className={[
                        "px-4",
                        dense ? "py-2" : "py-3",
                        "font-extrabold whitespace-nowrap border-b border-white/15 select-none",
                        isNumeric ? "text-right" : "text-left",
                        isPinned ? "sticky bg-zinc-900" : "",
                      ].join(" ")}
                      style={isPinned ? { left } : undefined}
                      scope="col"
                      aria-sort={ariaSort(col)}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(col)}
                        className={[
                          "inline-flex items-center gap-1.5",
                          sortable ? "hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-white/50 rounded" : "",
                        ].join(" ")}
                        title={sortable ? "Ordenar" : undefined}
                      >
                        {labels[col]}
                        <SortIcon active={sort.key === col} dir={sort.dir} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="bg-white/80 dark:bg-zinc-900/40 text-zinc-800 dark:text-zinc-100">
              {sortedData.map((linha, i) => {
                const zebra = striped && i % 2 === 1 ? "bg-zinc-50/70 dark:bg-white/5" : "";

                return (
                  <tr
                    key={i}
                    className={[
                      "border-t border-zinc-200/50 dark:border-white/10",
                      zebra,
                      clickable
                        ? "cursor-pointer hover:bg-zinc-100/70 dark:hover:bg-white/10"
                        : "hover:bg-zinc-50 dark:hover:bg-white/5",
                      "transition-colors",
                    ].join(" ")}
                    onClick={clickable ? () => onRowClick(linha) : undefined}
                    onKeyDown={(e) => onRowKeyDown(e, linha)}
                    tabIndex={clickable ? 0 : -1}
                    role={clickable ? "button" : "row"}
                  >
                    {colunas.map((col) => {
                      const valor = linha?.[col];
                      const isNumeric = parseNumero(valor) !== null;
                      const isPinned = pinnedSet.has(String(col));
                      const left = leftOffsets[col] ?? 0;

                      const content = typeof formatters?.[col] === "function"
                        ? formatters[col](valor, linha)
                        : formatarCelula(valor);

                      return (
                        <td
                          key={col}
                          className={[
                            "px-4",
                            dense ? "py-1.5" : "py-2",
                            "border-b border-zinc-200/50 dark:border-white/10 align-top",
                            isNumeric ? "text-right" : "text-left",
                            isPinned ? "sticky bg-white/95 dark:bg-zinc-950/70" : "",
                            typeof cellClassName === "function" ? cellClassName(valor, col, linha) : "",
                          ].join(" ")}
                          style={isPinned ? { left } : undefined}
                          title={tooltipTexto(valor)}
                        >
                          <span className="break-words inline-block max-w-[42ch] md:max-w-none truncate md:whitespace-normal">
                            {content}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            {totais && (
              <tfoot className="bg-zinc-50 dark:bg-white/5 sticky bottom-0">
                <tr>
                  {colunas.map((c) => {
                    const v = totais?.[c];
                    const isNum = v !== null && v !== undefined;
                    return (
                      <td
                        key={c}
                        className={[
                          "px-4",
                          dense ? "py-1.5" : "py-2",
                          "border-t border-zinc-200/70 dark:border-white/10 font-extrabold",
                          isNum ? "text-right text-zinc-900 dark:text-white" : "text-left text-zinc-500 dark:text-zinc-400",
                        ].join(" ")}
                      >
                        {isNum
                          ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(v)
                          : "—"}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

RelatoriosTabela.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  columns: PropTypes.arrayOf(PropTypes.string),
  caption: PropTypes.string,
  loading: PropTypes.bool,
  striped: PropTypes.bool,
  dense: PropTypes.bool,
  onRowClick: PropTypes.func,

  sortable: PropTypes.bool,
  defaultSort: PropTypes.shape({ key: PropTypes.string, dir: PropTypes.oneOf(["asc", "desc"]) }),
  exportable: PropTypes.bool,
  csvFileName: PropTypes.string,
  pinnedLeft: PropTypes.arrayOf(PropTypes.string),
  maxHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  totals: PropTypes.bool,
  cellClassName: PropTypes.func,
  formatters: PropTypes.object,

  mobileAsCards: PropTypes.bool,
  cardTitleKey: PropTypes.string,
  formatterText: PropTypes.object,
};

/* ───────────────────────────────────────────── */
/* Utilitários                                   */
/* ───────────────────────────────────────────── */

function formatarCabecalho(texto) {
  return String(texto || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim()
    .replace(/\bid\b/i, "ID")
    .replace(/\bcpf\b/i, "CPF")
    .replace(/\bdata\b/i, "Data")
    .replace(/\bemail\b/i, "E-mail")
    .replace(/\bnome\b/i, "Nome")
    .replace(/\btitulo\b/i, "Título")
    .replace(/\bpresenca\b/i, "Presença")
    .replace(/\bavaliacao\b/i, "Avaliação")
    .replace(/\bnota\b/i, "Nota")
    .replace(/\bcurso\b/i, "Curso")
    .replace(/\bevento\b/i, "Evento")
    .replace(/\binstrutor\b/i, "Instrutor")
    .replace(/\bunidade\b/i, "Unidade")
    .replace(/\bturma\b/i, "Turma")
    .replace(/\bperfil\b/i, "Perfil")
    .replace(/\bstatus\b/i, "Status")
    .replace(/\bcomentario\b/i, "Comentário")
    .replace(/\bdescricao\b/i, "Descrição")
    .replace(/\bsituacao\b/i, "Situação")
    .replace(/\btempo\b/i, "Tempo")
    .replace(/\btotal\b/i, "Total")
    .replace(/\bpontuacao\b/i, "Pontuação")
    .replace(/\bquantidade\b/i, "Quantidade")
    .replace(/\bdata inicio\b/i, "Início")
    .replace(/\bdata fim\b/i, "Fim")
    .replace(/\b([a-zà-ú])/g, (m) => m.toUpperCase());
}

function formatarCelula(valor) {
  if (valor === null || valor === undefined) return "–";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";

  // Date string ISO → DD/MM/AAAA
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
    const [ano, mes, dia] = valor.split("T")[0].split("-");
    return `${dia}/${mes}/${ano}`;
  }

  const num = parseNumero(valor);
  if (num !== null) {
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(num);
  }

  if (Array.isArray(valor)) return valor.map(formatarCelula).join(", ");
  if (typeof valor === "object") {
    try {
      return JSON.stringify(valor);
    } catch {
      return String(valor);
    }
  }
  return String(valor);
}

// versão de texto para CSV
function formatarCelulaTexto(valor) {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
    const [ano, mes, dia] = valor.split("T")[0].split("-");
    return `${dia}/${mes}/${ano}`;
  }
  if (Array.isArray(valor)) return valor.map(formatarCelulaTexto).join(", ");
  if (typeof valor === "object") {
    try {
      return JSON.stringify(valor);
    } catch {
      return String(valor);
    }
  }
  return String(valor);
}

function tooltipTexto(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function parseNumero(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;

  // não tratar ISO date como número
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return null;

  const s = v.trim();
  if (!s) return null;

  // pt-BR comum: "1.234,56"
  const normalized =
    s.includes(",") && s.includes(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.includes(",")
      ? s.replace(",", ".")
      : s;

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function colunaEhNumerica(data, col) {
  let total = 0;
  let nums = 0;
  for (const row of data || []) {
    if (!row || !(col in row)) continue;
    const v = row[col];
    if (v === null || v === undefined || v === "") continue;
    total++;
    if (parseNumero(v) !== null) nums++;
  }
  return total > 0 && nums / total >= 0.5;
}

function compararValores(a, b) {
  const isIso = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s);
  if (isIso(a) && isIso(b)) return (a > b) - (a < b);

  const an = parseNumero(a);
  const bn = parseNumero(b);
  if (an !== null && bn !== null) return an - bn;

  const as = a == null ? "" : String(a);
  const bs = b == null ? "" : String(b);
  return as.localeCompare(bs, "pt-BR", { sensitivity: "base", numeric: true });
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// tenta converter formatter (ReactNode) em texto “seguro”
function plainText(rendered, fallbackRaw) {
  if (rendered == null) return "";
  if (typeof rendered === "string" || typeof rendered === "number" || typeof rendered === "boolean") {
    return String(rendered);
  }
  // arrays de strings/números
  if (Array.isArray(rendered)) {
    return rendered.map((x) => plainText(x, "")).join(" ");
  }
  // JSX/objeto -> cai pro valor bruto formatado
  return formatarCelulaTexto(fallbackRaw);
}
