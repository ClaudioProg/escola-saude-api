// 📁 src/components/ListaInscritos.jsx
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "react-toastify";
import { gerarIntervaloDeDatas, formatarParaISO } from "../utils/data";
import { apiPost } from "../services/api"; // ✅ usar serviço centralizado

export default function ListaInscritos({
  inscritos = [],
  turma,
  token,              // pode continuar recebendo, mas não vamos usar
  presencas = [],
  carregarPresencas,
}) {
  const [confirmando, setConfirmando] = useState(null);
  const agora = new Date();

  const formatarCPF = (cpf) =>
    cpf?.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") || "CPF inválido";

  const dentroDoPrazoDeConfirmacao = (dataRef) => {
    if (!turma?.horario_fim) return false;
    const fim = new Date(`${dataRef}T${turma.horario_fim}`);
    const limite = new Date(fim.getTime() + 48 * 60 * 60 * 1000);
    return agora < limite;
  };

  // ✅ agora usando /api/... via apiPost (sem CORS)
  const confirmarPresenca = async (usuario_id, data) => {
    try {
      setConfirmando(`${usuario_id}-${data}`);

      // manda a data em ISO no início do dia p/ evitar fuso
      const dataISO = formatarParaISO(`${data}T00:00:00`);

      await apiPost("/api/presencas/confirmar-instrutor", {
        usuario_id,
        turma_id: turma.id,
        data: dataISO,
      });

      toast.success("✅ Presença confirmada com sucesso!");
      await carregarPresencas();
    } catch (err) {
      console.error("Erro ao confirmar presença:", err);
      toast.error(err?.message || "❌ Erro ao confirmar presença.");
    } finally {
      setConfirmando(null);
    }
  };

  // logs...
  console.log("📋 Inscritos:", inscritos);
  console.log("📋 Presenças recebidas:", presencas);
  console.log("📆 Intervalo de datas da turma:", turma?.data_inicio, "→", turma?.data_fim);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden mt-4"
    >
      {inscritos.length === 0 ? (
        <div className="flex flex-col items-center py-8">
          <span className="text-4xl mb-2">🗒️</span>
          <p className="text-gray-500 dark:text-gray-300 font-semibold">
            Nenhum inscrito nesta turma.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {inscritos.map((inscrito) => {
            const presencasUsuario = presencas.filter((p) => p.usuario_id === inscrito.usuario_id);
            const datasTurma = gerarIntervaloDeDatas(
              new Date(turma.data_inicio),
              new Date(turma.data_fim)
            );

            return (
              <li key={inscrito.usuario_id} className="p-4 bg-white dark:bg-zinc-800 rounded-xl shadow">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-white">{inscrito.nome}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{inscrito.email}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 mt-2 sm:mt-0">
                    {formatarCPF(inscrito.cpf)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-center">
                    <thead>
                      <tr className="text-gray-500 dark:text-gray-300">
                        <th className="p-2">Data</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datasTurma.map((dataObj) => {
                        const dataRef = (() => {
                          try {
                            const d = typeof dataObj === "string" ? new Date(dataObj) : dataObj;
                            if (isNaN(new Date(d).getTime())) return null;
                            return new Date(d).toISOString().split("T")[0];
                          } catch {
                            return null;
                          }
                        })();

                        if (!dataRef) return null;

                        const dataFormatada = dataRef.split("-").reverse().join("/");
                        const p = presencasUsuario.find((p) => (p?.data || "").split("T")[0] === dataRef);
                        const isPresente = p?.presente === true;

                        const inicio = new Date(`${dataRef}T${turma.horario_inicio}`);
                        const passou60min = agora > new Date(inicio.getTime() + 60 * 60000);
                        const podeConfirmar = passou60min && dentroDoPrazoDeConfirmacao(dataRef);

                        let statusBadge = null;
                        if (isPresente) {
                          statusBadge = (
                            <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                              ✅ Presente
                            </span>
                          );
                        } else if (!passou60min) {
                          statusBadge = (
                            <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">
                              ⏳ Aguardando
                            </span>
                          );
                        } else {
                          statusBadge = (
                            <span className="inline-block bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">
                              ❌ Faltou
                            </span>
                          );
                        }

                        return (
                          <tr key={dataRef} className="border-t border-gray-200 dark:border-gray-700">
                            <td className="p-2">{dataFormatada}</td>
                            <td className="p-2">{statusBadge}</td>
                            <td className="p-2">
                              {!isPresente && podeConfirmar && (
                                <button
                                  disabled={confirmando === `${inscrito.usuario_id}-${dataRef}`}
                                  onClick={() => confirmarPresenca(inscrito.usuario_id, dataRef)}
                                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
                                >
                                  {confirmando === `${inscrito.usuario_id}-${dataRef}`
                                    ? "Confirmando..."
                                    : "✅ Confirmar presença"}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
}
