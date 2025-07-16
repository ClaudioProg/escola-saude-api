import PropTypes from "prop-types";
import { FileText, RotateCw } from "lucide-react";

export default function TabelaCertificados({ dados, onRevalidar, onDownload }) {
  if (!dados.length) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-300 py-4">
        📭 Nenhum certificado emitido encontrado.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md shadow border border-gray-200 dark:border-gray-700 mt-4">
      <table className="min-w-full text-sm text-left border-collapse">
        <thead className="bg-lousa text-white">
          <tr>
            <th className="px-4 py-2">Nome</th>
            <th className="px-4 py-2">CPF</th>
            <th className="px-4 py-2">Evento</th>
            <th className="px-4 py-2">Emissão</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Ações</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-100">
          {dados.map((c) => (
            <tr key={c.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-zinc-700 transition">
              <td className="px-4 py-2">{c.nome}</td>
              <td className="px-4 py-2">{formatCpf(c.cpf)}</td>
              <td className="px-4 py-2">{c.evento}</td>
              <td className="px-4 py-2">{formatarData(c.emitido_em)}</td>
              <td className="px-4 py-2">{c.status}</td>
              <td className="px-4 py-2">
                <div className="flex gap-3 items-center">
                  <button
                    onClick={() => onDownload(c.id)}
                    className="text-lousa hover:text-lime-600"
                    aria-label={`Baixar certificado de ${c.nome}`}
                    title="Baixar PDF"
                  >
                    <FileText size={18} />
                  </button>
                  <button
                    onClick={() => onRevalidar(c.id)}
                    className="text-lousa hover:text-yellow-600"
                    aria-label={`Revalidar certificado de ${c.nome}`}
                    title="Revalidar"
                  >
                    <RotateCw size={18} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 📌 Utilitários
function formatCpf(cpf) {
  if (!cpf) return "-";
  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

function formatarData(dataISO) {
  const [ano, mes, dia] = dataISO.split("T")[0].split("-");
  return `${dia}/${mes}/${ano}`;
}

TabelaCertificados.propTypes = {
  dados: PropTypes.array.isRequired,
  onRevalidar: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
};
