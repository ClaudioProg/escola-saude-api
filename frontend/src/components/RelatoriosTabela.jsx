import NenhumDado from "./NenhumDado";

export default function RelatoriosTabela({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <NenhumDado
        mensagem="📭 Nenhum dado encontrado para os filtros aplicados."
        sugestao="Tente ajustar os filtros ou consultar outro período."
      />
    );
  }

  const colunas = Object.keys(data[0]);

  return (
    <div className="overflow-auto mt-6 rounded-xl shadow border border-gray-200 dark:border-zinc-700">
      <table className="min-w-full text-sm text-left border-collapse">
        <thead className="bg-lousa text-white">
          <tr>
            {colunas.map((col) => (
              <th
                key={col}
                className="px-4 py-3 font-semibold whitespace-nowrap border-b border-white/20"
                scope="col"
              >
                {formatarCabecalho(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-100">
          {data.map((linha, i) => (
            <tr
              key={i}
              className="border-t border-gray-100 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 transition"
            >
              {colunas.map((col) => (
                <td
                  key={col}
                  className="px-4 py-2 whitespace-nowrap border-b border-gray-100 dark:border-zinc-700"
                >
                  {formatarCelula(linha[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 🔧 Utilitários

function formatarCabecalho(texto) {
  return texto
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase → camel Case
    .replace(/_/g, " ") // snake_case → snake case
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
    .replace(/\binstrutor\b/i, "instrutor")
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
    .replace(/\bdata_inicio\b/i, "Início")
    .replace(/\bdata_fim\b/i, "Fim");
}

function formatarCelula(valor) {
  if (valor === null || valor === undefined) return "-";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";

  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
    const [ano, mes, dia] = valor.split("T")[0].split("-");
    return `${dia}/${mes}/${ano}`;
  }

  return valor;
}
