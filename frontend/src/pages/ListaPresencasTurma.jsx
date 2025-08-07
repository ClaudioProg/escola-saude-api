import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import CabecalhoPainel from "../components/CabecalhoPainel";
import NadaEncontrado from "../components/NadaEncontrado";
import { formatarDataBrasileira } from "../utils/data";

export default function ListaPresencasTurma({
  turmas = [],
  hoje = new Date(),
  inscritosPorTurma = {},
  carregarInscritos,
  modoadministradorPresencas = false,
}) {
  const [turmaExpandidaId, setTurmaExpandidaId] = useState(null);
  const [inscritosState, setInscritosState] = useState(inscritosPorTurma);
  const [loadingId, setLoadingId] = useState(null);

  // 🔍 Log inicial
  console.log("📌 ListaPresencasTurma montada");
  console.log("📚 Turmas recebidas:", turmas);
  console.log("👥 Inscritos por turma (prop):", inscritosPorTurma);

  useEffect(() => {
    const atual = JSON.stringify(inscritosState);
    const novo = JSON.stringify(inscritosPorTurma);
    if (atual !== novo) {
      console.log("🔄 Atualizando inscritosState com novos dados");
      setInscritosState(inscritosPorTurma);
    } else {
      console.log("✅ Nenhuma alteração nos inscritosState detectada");
    }
  }, [inscritosPorTurma]);

  const confirmarPresenca = async (turmaId, usuarioId, data) => {
    const confirmar = confirm("Deseja realmente confirmar presença deste usuário?");
    if (!confirmar) return;

    console.log(`📤 Confirmando presença de usuarioId=${usuarioId}, turmaId=${turmaId}, data=${data}`);
    setLoadingId(usuarioId);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/presencas/confirmar-instrutor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ turma_id: turmaId, usuario_id: usuarioId, data_presenca: data }),
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Erro ao confirmar presença");
      }

      toast.success("✅ Presença confirmada com sucesso.");

      setInscritosState((prev) => {
        const atualizados = { ...prev };
        const lista = atualizados[turmaId] || [];

        atualizados[turmaId] = lista.map((p) =>
          p.id === usuarioId
            ? {
                ...p,
                presencas: {
                  ...p.presencas,
                  [data]: true,
                },
              }
            : p
        );

        return atualizados;
      });

      if (carregarInscritos) {
        console.log("🔁 Recarregando inscritos...");
        await carregarInscritos(turmaId);
      }
    } catch (err) {
      console.error("❌ Erro ao confirmar presença:", err);
      toast.error("❌ " + err.message);
    } finally {
      setLoadingId(null);
    }
  };

  if (!Array.isArray(turmas) || turmas.length === 0) {
    console.warn("⚠️ Nenhuma turma disponível!");
    return (
      <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-2 sm:px-4 py-6">
        <Breadcrumbs />
        <CabecalhoPainel titulo="📋 Presenças por Turma" />
        <NadaEncontrado mensagem="Nenhuma turma encontrada." sugestao="Verifique os filtros ou cadastre uma nova turma." />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-2 sm:px-4 py-6">
      <Breadcrumbs />
      <CabecalhoPainel titulo="📋 Presenças por Turma" />

      <div className="space-y-6">
        {turmas.map((turma) => (
          <div key={turma.id} className="border rounded-xl bg-white dark:bg-gray-800 shadow p-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-bold text-lg text-lousa dark:text-green-200">{turma.nome}</h2>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  {formatarDataBrasileira(turma.data_inicio)} até{" "}
                  {formatarDataBrasileira(turma.data_fim)}
                </p>
              </div>
              <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 dark:text-white rounded-full">
                {turma.status || "Agendada"}
              </span>
            </div>

            <div className="mt-4">
              <button
                className="bg-lousa text-white px-4 py-2 rounded hover:bg-green-900 transition"
                onClick={() => {
                  console.log("🟢 Toggle detalhes da turma:", turma.id);
                  setTurmaExpandidaId(turmaExpandidaId === turma.id ? null : turma.id);
                }}
              >
                {turmaExpandidaId === turma.id ? "Recolher Detalhes" : "Ver Detalhes"}
              </button>
            </div>

            <AnimatePresence>
              {turmaExpandidaId === turma.id && (
                <motion.div
                  className="mt-6 space-y-4"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div>
                    <h3 className="font-semibold text-gray-700 dark:text-white mb-2">Inscritos:</h3>
                    {(inscritosState?.[turma.id] || []).map((pessoa) => {
                      console.log(`👤 Inscrito renderizado: ${pessoa.nome}`);
                      return (
                        <div key={pessoa.id} className="flex flex-wrap justify-between items-center p-2 border rounded bg-gray-50 dark:bg-gray-900">
                          <div className="text-sm text-gray-800 dark:text-gray-200">
                            <strong>{pessoa.nome}</strong> – {pessoa.email}
                            <br />
                            CPF: {pessoa.cpf || "Não informado"}
                          </div>

                          <div className="w-full mt-3">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-gray-600 dark:text-gray-300">
                                  <th className="text-left">📅 Data</th>
                                  <th className="text-left">📌 Situação</th>
                                  <th className="text-left">✔️ Ações</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pessoa.datas?.map((data) => {
                                  const formatarIso = (d) => new Date(d).toISOString().split("T")[0];
                                  let presente = false;

                                  if (Array.isArray(pessoa.presencas)) {
                                    presente = pessoa.presencas.some((p) => formatarIso(p.data_presenca) === data && p.presente === true);
                                  } else if (typeof pessoa.presencas === "object" && pessoa.presencas !== null) {
                                    presente = pessoa.presencas[data] === true;
                                  }

                                  return (
                                    <tr key={data}>
                                      <td className="py-1">{formatarDataBrasileira(data)}</td>
                                      <td>
                                        {(() => {
                                          const dataHoraInicio = new Date(`${data}T${turma.horario_inicio || "08:00"}`);
                                          const agora = new Date();
                                          const jaComecou = agora >= dataHoraInicio;
                                          const passou60min = agora >= new Date(dataHoraInicio.getTime() + 60 * 60 * 1000);

                                          let status = "Aguardando confirmação";
                                          let style = "bg-gray-200 text-gray-800";
                                          let icon = null;

                                          if (presente) {
                                            status = "Presente";
                                            style = "bg-yellow-300 text-yellow-900";
                                            icon = <CheckCircle size={14} />;
                                          } else if (passou60min) {
                                            status = "Faltou";
                                            style = "bg-red-300 text-red-900";
                                            icon = <XCircle size={14} />;
                                          }

                                          return (
                                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${style}`}>
                                              {icon}
                                              {status}
                                            </span>
                                          );
                                        })()}
                                      </td>
                                      <td>
                                        {!presente && (() => {
                                          const dataHoraFim = new Date(`${data}T${turma.horario_fim || "17:00"}`);
                                          const agora = new Date();
                                          const dentroDoPrazo = agora <= new Date(dataHoraFim.getTime() + 48 * 60 * 60 * 1000);

                                          if (dentroDoPrazo) {
                                            return (
                                              <button
                                                disabled={loadingId === pessoa.id}
                                                onClick={() => confirmarPresenca(turma.id, pessoa.id, data)}
                                                className={`bg-blue-700 text-white text-xs px-3 py-1 rounded ${loadingId === pessoa.id ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-800"}`}
                                              >
                                                {loadingId === pessoa.id ? "Confirmando..." : "Confirmar"}
                                              </button>
                                            );
                                          }

                                          return null;
                                        })()}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </main>
  );
}
