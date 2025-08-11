import StatusPresencaBadge from "./StatusPresencaBadge";
import { toast } from "react-toastify";
import { formatarDataBrasileira } from "../utils/data";
import { apiPost } from "../services/api"; // ✅ serviço centralizado

export default function PresencasTurmaExpandida({
  turma,
  datasTurma,
  inscritos = [],
  presencas = [],
  carregarPresencas,
}) {

  async function confirmarPresenca(dataSelecionada, turmaId, usuarioId, nome) {
    const confirmado = window.confirm(
      `Confirmar presença de ${nome} em ${formatarDataBrasileira(dataSelecionada)}?`
    );
    if (!confirmado) return;

    try {
      // ⚠️ Se o backend espera "data" (e não "data_presenca"), troque a chave abaixo
      await apiPost("/api/presencas/confirmar-simples", {
        turma_id: turmaId,
        usuario_id: usuarioId,
        data: dataSelecionada, // <- troque para "data_presenca" se seu backend exigir assim
      });

      toast.success(
        `✅ Presença confirmada para ${nome} em ${formatarDataBrasileira(dataSelecionada)}.`
      );
      await carregarPresencas(turmaId);
    } catch {
      toast.error("❌ Erro ao confirmar presença.");
    }
  }

  return (
    <div className="mt-4 space-y-6">
      {inscritos.map((inscrito) => {
        const usuarioId = inscrito.usuario_id ?? inscrito.id;

        return (
          <div
            key={usuarioId}
            className="border rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm"
            aria-label={`Dados do inscrito ${inscrito.nome}`}
            tabIndex={0}
          >
            <div className="font-semibold text-sm text-lousa dark:text-white mb-1">
              {inscrito.nome}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
              CPF: {inscrito.cpf ?? "Não informado"}
            </div>

            <table className="w-full text-xs border-collapse" aria-label="Tabela de presença por data">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                  <th className="py-2 text-left px-2">📅 Data</th>
                  <th className="py-2 text-left px-2">🟡 Situação</th>
                  <th className="py-2 text-left px-2">✔️ Ações</th>
                </tr>
              </thead>
              <tbody>
                {datasTurma.map((dataObj) => {
                  const dataISO =
                    dataObj instanceof Date
                      ? dataObj.toISOString().split("T")[0]
                      : String(dataObj).split("T")[0];

                  const presenca = presencas.find(
                    (p) =>
                      String(p.usuario_id) === String(usuarioId) &&
                      new Date(p.data_presenca).toISOString().split("T")[0] === dataISO
                  );
                  const estaPresente = presenca?.presente ?? false;

                  return (
                    <tr key={dataISO} className="border-t border-gray-200 dark:border-gray-600">
                      <td className="py-1 px-2">{formatarDataBrasileira(dataISO)}</td>
                      <td className="py-1 px-2">
                        <StatusPresencaBadge status={estaPresente ? "presente" : "faltou"} />
                      </td>
                      <td className="py-1 px-2">
                        {!estaPresente && (
                          <button
                            onClick={() =>
                              confirmarPresenca(dataISO, turma.id, usuarioId, inscrito.nome)
                            }
                            className="text-white bg-teal-700 hover:bg-teal-800 text-xs py-1 px-3 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                          >
                            Confirmar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
