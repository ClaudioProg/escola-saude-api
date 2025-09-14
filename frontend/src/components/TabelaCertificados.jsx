// 📁 src/components/TabelaCertificados.jsx
import PropTypes from "prop-types";
import { FileText, RotateCw } from "lucide-react";

export default function TabelaCertificados({ dados = [], onRevalidar, onDownload, className = "" }) {
  if (!Array.isArray(dados) || dados.length === 0) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-300 py-4" aria-live="polite">
        📭 Nenhum certificado emitido encontrado.
      </p>
    );
  }

  return (
    <div className={`overflow-x-auto rounded-md shadow border border-gray-200 dark:border-gray-700 mt-4 ${className}`}>
      <table className="min-w-full text-sm text-left border-collapse">
        <caption className="sr-only">Lista de certificados emitidos</caption>
        <thead className="bg-lousa text-white">
          <tr>
            <Th>Nome</Th>
            <Th>CPF</Th>
            <Th>Evento</Th>
            <Th>Emissão</Th>
            <Th>Status</Th>
            <Th>Ações</Th>
          </tr>
        </thead>

        <tbody className="bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-100">
          {dados.map((c, idx) => {
            const key =
              c.id ??
              `${c.cpf ?? "sem-cpf"}-${c.turma_id ?? "sem-turma"}-${c.emitido_em ?? idx}`;

            return (
              <tr
                key={key}
                className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-zinc-700 transition"
              >
                <Td>{c.nome || "—"}</Td>
                <Td mono>{formatCpf(c.cpf)}</Td>
                <Td>{c.evento || "—"}</Td>
                <Td mono>{formatarData(c.emitido_em)}</Td>
                <Td>{statusBadge(c.status)}</Td>

                <Td>
                  <div className="flex gap-3 items-center">
                    <button
                      onClick={() => onDownload(c.id)}
                      className="text-lousa hover:text-lime-600 focus:outline-none focus:ring-2 focus:ring-green-700/40 rounded"
                      aria-label={`Baixar certificado de ${c.nome ?? "usuário"}`}
                      title="Baixar PDF"
                    >
                      <FileText size={18} />
                    </button>

                    <button
                      onClick={() => onRevalidar(c.id)}
                      className={`focus:outline-none focus:ring-2 focus:ring-yellow-600/40 rounded ${
                        c.canRevalidate === false
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-lousa hover:text-yellow-600"
                      }`}
                      aria-label={`Revalidar certificado de ${c.nome ?? "usuário"}`}
                      title={c.canRevalidate === false ? "Revalidação indisponível" : "Revalidar"}
                      disabled={c.canRevalidate === false}
                    >
                      <RotateCw size={18} />
                    </button>
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ===== Subcomponentes semânticos ===== */
function Th({ children }) {
  return <th className="px-4 py-2 font-semibold" scope="col">{children}</th>;
}
function Td({ children, mono = false }) {
  return (
    <td className={`px-4 py-2 align-middle ${mono ? "font-mono tabular-nums" : ""}`}>
      {children}
    </td>
  );
}

/* ===== Utilitários ===== */
function formatCpf(cpf) {
  if (!cpf) return "—";
  const onlyDigits = String(cpf).replace(/\D/g, "");
  if (onlyDigits.length !== 11) return cpf; // deixa como veio se não for 11 dígitos
  return onlyDigits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

/** Aceita:
 *  - "YYYY-MM-DDTHH:mm:ssZ" → usa a parte de data
 *  - "YYYY-MM-DD" → usa direto
 *  - falsy → "—"
 * Política do projeto: evitar new Date em datas-only.
 */
function formatarData(dataISO) {
  if (!dataISO || typeof dataISO !== "string") return "—";
  const soData = dataISO.includes("T") ? dataISO.split("T")[0] : dataISO;
  const m = soData.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dataISO;
  const [, ano, mes, dia] = m;
  return `${dia}/${mes}/${ano}`;
}

/* Badge de status seguindo o padrão de cores (verde/amarelo/vermelho) */
function statusBadge(statusRaw) {
  const s = (statusRaw || "").toString().toLowerCase();

  const map = {
    valido: {
      text: "Válido",
      cls: "bg-green-100 text-green-800 dark:bg-green-600/30 dark:text-green-300",
    },
    válido: {
      text: "Válido",
      cls: "bg-green-100 text-green-800 dark:bg-green-600/30 dark:text-green-300",
    },
    expirado: {
      text: "Expirado",
      cls: "bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300",
    },
    revogado: {
      text: "Revogado",
      cls: "bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300",
    },
    pendente: {
      text: "Pendente",
      cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-600/30 dark:text-yellow-200",
    },
  };

  const def = map[s] || {
    text: statusRaw || "—",
    cls: "bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-gray-300",
  };

  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${def.cls}`}>{def.text}</span>;
}

/* ===== PropTypes ===== */
TabelaCertificados.propTypes = {
  dados: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      nome: PropTypes.string,
      cpf: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      evento: PropTypes.string,
      emitido_em: PropTypes.string, // ISO ou "YYYY-MM-DD"
      status: PropTypes.string,     // "válido" | "expirado" | "pendente" | ...
      turma_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      canRevalidate: PropTypes.bool,
    })
  ).isRequired,
  onRevalidar: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  className: PropTypes.string,
};
