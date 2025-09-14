// 📁 src/components/RelatoriosTabela.jsx
import PropTypes from "prop-types";
import NenhumDado from "./NenhumDado";

/**
 * RelatoriosTabela
 * Props:
 * - data: Array<object> (obrigatório)
 * - columns?: string[] (ordem/subset de colunas)
 * - caption?: string (legenda acessível da tabela)
 * - loading?: boolean (mostra estado de carregamento leve)
 * - striped?: boolean (zebra rows)
 * - dense?: boolean (linhas mais compactas)
 * - onRowClick?: (row) => void
 */
export default function RelatoriosTabela({
  data = [],
  columns,
  caption = "Tabela de resultados do relatório",
  loading = false,
  striped = true,
  dense = false,
  onRowClick,
}) {
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

  // Se não vier 'columns', usa a união de chaves (ordem das chaves da 1ª linha):
  const autoCols = Object.keys(data[0] || {});
  const colunas = Array.isArray(columns) && columns.length ? columns : autoCols;

  return (
    <div className="overflow-auto mt-6 rounded-xl shadow border border-gray-200 dark:border-zinc-700">
      <table className="min-w-full text-sm text-left border-collapse" role="table" aria-label={caption}>
        <caption className="sr-only">{caption}</caption>

        <thead className="bg-lousa text-white sticky top-0 z-10">
          <tr>
            {colunas.map((col) => {
              const isNumeric = colunaEhNumerica(data, col);
              return (
                <th
                  key={col}
                  className={[
                    "px-4",
                    dense ? "py-2" : "py-3",
                    "font-semibold whitespace-nowrap border-b border-white/20",
                    isNumeric ? "text-right" : "text-left",
                  ].join(" ")}
                  scope="col"
                >
                  {formatarCabecalho(col)}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody className="bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-100">
          {data.map((linha, i) => {
            const zebra =
              striped && i % 2 === 1
                ? "bg-gray-50 dark:bg-zinc-700/40"
                : "";

            const clickable = typeof onRowClick === "function";

            return (
              <tr
                key={i}
                className={[
                  "border-t border-gray-100 dark:border-zinc-700",
                  zebra,
                  clickable ? "cursor-pointer hover:bg-gray-100/70 dark:hover:bg-zinc-700" : "hover:bg-gray-50 dark:hover:bg-zinc-700",
                  "transition-colors",
                ].join(" ")}
                onClick={clickable ? () => onRowClick(linha) : undefined}
                tabIndex={clickable ? 0 : -1}
              >
                {colunas.map((col) => {
                  const valor = linha?.[col];
                  const isNumeric = colunaEhNumericaValor(valor);
                  return (
                    <td
                      key={col}
                      className={[
                        "px-4",
                        dense ? "py-1.5" : "py-2",
                        "border-b border-gray-100 dark:border-zinc-700 align-top",
                        isNumeric ? "text-right" : "text-left",
                      ].join(" ")}
                      title={tooltipTexto(valor)}
                    >
                      <span className="break-words">
                        {formatarCelula(valor)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
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
};

/* ───────────────────────────────────────────── */
/* Utilitários                                   */
/* ───────────────────────────────────────────── */

function formatarCabecalho(texto) {
  return String(texto || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase → camel Case
    .replace(/_/g, " ")                  // snake_case → snake case
    .trim()
    // normalizações comuns
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
    // Capitaliza palavras (mantém siglas)
    .replace(/\b([a-zà-ú])/g, (m) => m.toUpperCase());
}

function formatarCelula(valor) {
  if (valor === null || valor === undefined) return "–";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";

  // Date string ISO → DD/MM/AAAA (aceita "YYYY-MM-DD" e "YYYY-MM-DDTHH:mm:ss")
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
    const [ano, mes, dia] = valor.split("T")[0].split("-");
    return `${dia}/${mes}/${ano}`;
  }

  // Números (inclui numéricos em string)
  if (colunaEhNumericaValor(valor)) {
    const num = Number(valor);
    if (!Number.isNaN(num)) {
      // Use pt-BR; ajuste se preferir outra locale
      return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(num);
    }
  }

  // Arrays → join
  if (Array.isArray(valor)) return valor.map(formatarCelula).join(", ");

  // Objetos → JSON curto
  if (typeof valor === "object") {
    try {
      return JSON.stringify(valor);
    } catch {
      return String(valor);
    }
  }

  return String(valor);
}

function colunaEhNumerica(data, col) {
  // considera numéricos se pelo menos metade dos valores forem números válidos
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
    // rejeita strings de data
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return false;
    const n = Number(v.replace?.(",", ".") ?? v);
    return !Number.isNaN(n) && Number.isFinite(n);
  }
  return false;
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
