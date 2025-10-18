// 📁 src/components/RelatoriosTabela.jsx
import PropTypes from "prop-types";
import NenhumDado from "./NenhumDado";
import { useMemo, useState, useId, useCallback } from "react";

/**
 * RelatoriosTabela (pro)
 * Props novas (todas opcionais e com default seguro):
 * - sortable?: boolean (true) – habilita ordenação client-side
 * - defaultSort?: { key: string, dir: 'asc'|'desc' }
 * - exportable?: boolean (true) – mostra botão CSV no header
 * - csvFileName?: string ('relatorio')
 * - pinnedLeft?: string[] – colunas fixas à esquerda (ex.: ['ID','Nome'] ou pelas chaves)
 * - maxHeight?: number | string – altura máx. do corpo (ex.: 520 ou '60vh')
 * - totals?: boolean (false) – soma colunas numéricas no <tfoot>
 * - cellClassName?: (valor, col, row) => string – classe extra por célula
 * - formatters?: Record<col, fn(valor, row) => ReactNode> – formatação custom por coluna
 */
export default function RelatoriosTabela({
  data = [],
  columns,
  caption = "Tabela de resultados do relatório",
  loading = false,
  striped = true,
  dense = false,
  onRowClick,

  // novos
  sortable = true,
  defaultSort = null,
  exportable = true,
  csvFileName = "relatorio",
  pinnedLeft = [],
  maxHeight = 520,
  totals = false,
  cellClassName,
  formatters = {},
}) {
  const tableId = useId();

  if (loading) {
    return (
      <div className="mt-6 rounded-xl shadow border border-gray-200 dark:border-zinc-700 p-6 text-sm text-gray-600 dark:text-gray-300">
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

  // Se não vier 'columns', usa as chaves da primeira linha
  const autoCols = Object.keys(data[0] || {});
  const colunas = Array.isArray(columns) && columns.length ? columns : autoCols;

  // Mapeia colunas exibidas -> rótulos amigáveis
  const labels = useMemo(() => {
    const m = {};
    for (const c of colunas) m[c] = formatarCabecalho(c);
    return m;
  }, [colunas]);

  // Ordenação
  const [sort, setSort] = useState(
    defaultSort && defaultSort.key ? defaultSort : { key: null, dir: "asc" }
  );

  const sortedData = useMemo(() => {
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

  // Export CSV (respeita colunas visíveis e formatação básica de células)
  const exportCSV = useCallback(() => {
    const rows = [colunas.map((c) => labels[c])].concat(
      sortedData.map((row) => colunas.map((c) => plainCell(formatters[c]?.(row[c], row) ?? formatarCelula(row[c]))))
    );
    const csv = rows.map((r) => r.map(csvEscape).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(csvFileName || "relatorio").replace(/[^\w.-]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedData, colunas, labels, csvFileName, formatters]);

  // Totais no rodapé
  const totais = useMemo(() => {
    if (!totals) return null;
    const out = {};
    for (const c of colunas) {
      let soma = 0;
      let cont = 0;
      for (const r of sortedData) {
        const v = r?.[c];
        if (colunaEhNumericaValor(v)) {
          soma += Number(String(v).replace(",", "."));
          cont++;
        }
      }
      out[c] = cont ? soma : null;
    }
    return out;
  }, [totals, colunas, sortedData]);

  // sticky calc para pinnedLeft
  const pinnedSet = useMemo(() => new Set(pinnedLeft.map(String)), [pinnedLeft]);
  const leftOffsets = useMemo(() => {
    // calcula deslocamentos cumulativos para cada col fixa
    const offsets = {};
    let acc = 0;
    for (const c of colunas) {
      if (pinnedSet.has(c)) {
        offsets[c] = acc;
        // largura base estimada; como é tabela fluída, usamos um valor razoável
        // + padding; pode ser refinado com medição, mas funciona bem.
        acc += 200;
      }
    }
    return offsets;
  }, [colunas, pinnedSet]);

  return (
    <div className="mt-6 rounded-xl shadow border border-gray-200 dark:border-zinc-700">
      {/* Header utilitário */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-zinc-700 bg-gray-50/60 dark:bg-zinc-800/60">
        <div className="text-sm text-gray-600 dark:text-gray-300">{caption}</div>
        {exportable && (
          <button
            onClick={exportCSV}
            className="text-xs px-3 py-1.5 rounded bg-lousa text-white hover:bg-green-800"
          >
            Exportar CSV
          </button>
        )}
      </div>

      <div className="overflow-auto" style={{ maxHeight }}>
        <table
          id={tableId}
          className="min-w-full text-sm text-left border-collapse"
          role="table"
          aria-label={caption}
        >
          <caption className="sr-only">{caption}</caption>

          <thead className="bg-lousa text-white sticky top-0 z-10">
            <tr>
              {colunas.map((col) => {
                const isNumeric = colunaEhNumerica(data, col);
                const isPinned = pinnedSet.has(col);
                const left = leftOffsets[col] ?? 0;
                return (
                  <th
                    key={col}
                    className={[
                      "px-4",
                      dense ? "py-2" : "py-3",
                      "font-semibold whitespace-nowrap border-b border-white/20 select-none",
                      isNumeric ? "text-right" : "text-left",
                      isPinned ? "sticky bg-lousa" : "",
                    ].join(" ")}
                    style={isPinned ? { left } : undefined}
                    scope="col"
                    aria-sort={ariaSort(col)}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col)}
                      className={[
                        "inline-flex items-center gap-1",
                        sortable ? "hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/50 rounded" : "",
                      ].join(" ")}
                      title={sortable ? "Ordenar" : undefined}
                    >
                      {labels[col]}
                      {sortable && (
                        <span className="inline-block text-[10px] align-middle opacity-90">
                          {sort.key === col ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-100">
            {sortedData.map((linha, i) => {
              const zebra =
                striped && i % 2 === 1 ? "bg-gray-50 dark:bg-zinc-700/40" : "";

              const clickable = typeof onRowClick === "function";

              return (
                <tr
                  key={i}
                  className={[
                    "border-t border-gray-100 dark:border-zinc-700",
                    zebra,
                    clickable
                      ? "cursor-pointer hover:bg-gray-100/70 dark:hover:bg-zinc-700"
                      : "hover:bg-gray-50 dark:hover:bg-zinc-700",
                    "transition-colors",
                  ].join(" ")}
                  onClick={clickable ? () => onRowClick(linha) : undefined}
                  tabIndex={clickable ? 0 : -1}
                >
                  {colunas.map((col) => {
                    const valor = linha?.[col];
                    const isNumeric = colunaEhNumericaValor(valor);
                    const isPinned = pinnedSet.has(col);
                    const left = leftOffsets[col] ?? 0;
                    const content = formatters[col]
                      ? formatters[col](valor, linha)
                      : formatarCelula(valor);

                    return (
                      <td
                        key={col}
                        className={[
                          "px-4",
                          dense ? "py-1.5" : "py-2",
                          "border-b border-gray-100 dark:border-zinc-700 align-top",
                          isNumeric ? "text-right" : "text-left",
                          isPinned ? "sticky bg-white dark:bg-zinc-800" : "",
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
            <tfoot className="bg-gray-50 dark:bg-zinc-800 sticky bottom-0">
              <tr>
                {colunas.map((c) => {
                  const v = totais[c];
                  const isNum = v !== null && v !== undefined;
                  return (
                    <td
                      key={c}
                      className={[
                        "px-4",
                        dense ? "py-1.5" : "py-2",
                        "border-t border-gray-200 dark:border-zinc-700 font-semibold",
                        isNum ? "text-right" : "text-left text-gray-500",
                      ].join(" ")}
                    >
                      {isNum ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(v) : "—"}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
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
  // novos
  sortable: PropTypes.bool,
  defaultSort: PropTypes.shape({ key: PropTypes.string, dir: PropTypes.oneOf(["asc", "desc"]) }),
  exportable: PropTypes.bool,
  csvFileName: PropTypes.string,
  pinnedLeft: PropTypes.arrayOf(PropTypes.string),
  maxHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  totals: PropTypes.bool,
  cellClassName: PropTypes.func,
  formatters: PropTypes.object,
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

  if (colunaEhNumericaValor(valor)) {
    const num = Number(String(valor).replace(",", "."));
    if (!Number.isNaN(num)) {
      return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(num);
    }
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

function colunaEhNumerica(data, col) {
  let total = 0;
  let nums = 0;
  for (const row of data) {
    if (!(col in row)) continue;
    const v = row[col];
    if (v === null || v === undefined || v === "") continue;
    total++;
    if (colunaEhNumericaValor(v)) nums++;
  }
  return total > 0 && nums / total >= 0.5;
}

function colunaEhNumericaValor(v) {
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return false;
    const n = Number(v.replace?.(",", ".") ?? v);
    return !Number.isNaN(n) && Number.isFinite(n);
  }
  return false;
}

function compararValores(a, b) {
  // datas ISO primeiro
  const isIso = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s);
  if (isIso(a) && isIso(b)) return (a > b) - (a < b);

  // numéricos
  const an = colunaEhNumericaValor(a) ? Number(String(a).replace(",", ".")) : NaN;
  const bn = colunaEhNumericaValor(b) ? Number(String(b).replace(",", ".")) : NaN;
  const aNum = !Number.isNaN(an);
  const bNum = !Number.isNaN(bn);
  if (aNum && bNum) return an - bn;

  // strings
  const as = a == null ? "" : String(a);
  const bs = b == null ? "" : String(b);
  return as.localeCompare(bs, "pt-BR", { sensitivity: "base", numeric: true });
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// obtém string plana da célula (sem JSX) para CSV
function plainCell(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  // se veio JSX/ReactNode do formatter, tenta serializar
  try {
    if (typeof v === "object") return JSON.stringify(v);
  } catch {}
  return String(v);
}
