import StatusPresencaBadge from "./StatusPresencaBadge";
import { toast } from "react-toastify";
import { formatarDataBrasileira, formatarParaISO } from "../utils/data";
import { apiPost } from "../services/api"; // ✅ serviço centralizado

export default function PresencasTurmaExpandida({
  turma,
  datasTurma,
  inscritos = [],
  presencas = [],
  carregarPresencas,
}) {
  const horarioInicio = turma?.horario_inicio || "08:00";
  const horarioFim = turma?.horario_fim || "17:00";

  // limite global: até 15 dias após término (data_fim + horario_fim)
  const fimTurmaDT = new Date(`${turma?.data_fim ?? formatarParaISO(new Date())}T${horarioFim}`);
  const limiteGlobal = new Date(fimTurmaDT.getTime() + 15 * 24 * 60 * 60 * 1000);

  async function confirmarPresenca(dataSelecionada, turmaId, usuarioId, nome) {
    const confirmado = window.confirm(
      `Confirmar presença de ${nome} em ${formatarDataBrasileira(dataSelecionada)}?`
    );
    if (!confirmado) return;

    try {
      await apiPost("/api/presencas/confirmar-simples", {
        turma_id: turmaId,
        usuario_id: usuarioId,
        data: dataSelecionada, // ajuste para "data_presenca" se o backend exigir
      });

      toast.success(
        `✅ Presença confirmada para ${nome} em ${formatarDataBrasileira(dataSelecionada)}.`
      );
      await carregarPresencas(turmaId);
    } catch (err) {
      console.error("Erro ao confirmar presença:", err);
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
                  // ✅ extrai yyyy-mm-dd sem UTC (se for Date, fixa T12:00)
                  const dataISO =
                    dataObj instanceof Date
                      ? formatarParaISO(new Date(`${formatarParaISO(dataObj)}T12:00:00`))
                      : String(dataObj).slice(0, 10);

                  // normaliza p.data_presenca -> 'yyyy-mm-dd' sem UTC
                  const presenca = presencas.find((p) => {
                    const temData = p?.data_presenca;
                    const dataNorm =
                      typeof temData === "string" && temData.length === 10
                        ? temData
                        : temData
                        ? formatarParaISO(new Date(`${temData}T12:00:00`))
                        : null;

                    return (
                      String(p.usuario_id) === String(usuarioId) &&
                      dataNorm === dataISO
                    );
                  });

                  const estaPresente = presenca?.presente === true;

                  // janela admin por dia: abre 60 min após início do dia; fecha no limiteGlobal
                  const inicioAulaDT = new Date(`${dataISO}T${horarioInicio}`);
                  const abreJanela = new Date(inicioAulaDT.getTime() + 60 * 60 * 1000);
                  const agora = new Date();
                  const antesDaJanela = agora < abreJanela;
                  const dentroDaJanela = agora >= abreJanela && agora <= limiteGlobal;

                  // status visual
                  const status =
                    estaPresente ? "presente" : antesDaJanela ? "aguardando" : "faltou";

                  return (
                    <tr key={`${usuarioId}-${dataISO}`} className="border-t border-gray-200 dark:border-gray-600">
                      <td className="py-1 px-2">{formatarDataBrasileira(dataISO)}</td>
                      <td className="py-1 px-2">
                        <StatusPresencaBadge status={status} />
                      </td>
                      <td className="py-1 px-2">
                        {!estaPresente && dentroDaJanela && !antesDaJanela && (
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
