import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AvaliacoesEvento from "./AvaliacoesEvento";
import BotaoPrimario from "./BotaoPrimario";
import BotaoSecundario from "./BotaoSecundario";
import { toast } from "react-toastify";
import {
  formatarDataBrasileira,
  gerarIntervaloDeDatas,
  formatarCPF,
} from "../utils/data";

export default function ListaTurmasAdministrador({
  turmas,
  hoje,
  carregarInscritos,
  carregarAvaliacoes,
  gerarRelatorioPDF,
  inscritosPorTurma,
  avaliacoesPorTurma,
  navigate,
  modoadministradorPresencas = false,
}) {
  const [turmaExpandidaId, setTurmaExpandidaId] = useState(null);
  const [presencasPorTurma, setPresencasPorTurma] = useState({});

  async function carregarPresencas(turmaId) {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/relatorio-presencas/turma/${turmaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: data }));
    } catch (err) {
      console.error("Erro ao carregar presenças:", err);
    }
  }

  async function confirmarPresenca(dataSelecionada, turmaId, usuarioId, nome) {
    const confirmado = window.confirm(
      `Confirmar presença de ${nome} em ${formatarDataBrasileira(dataSelecionada)}?`
    );
    if (!confirmado) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/presencas/confirmar-simples`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          turma_id: turmaId,
          usuario_id: usuarioId,
          data_presenca: dataSelecionada,
        }),
      });

      if (!res.ok) throw new Error("Erro ao confirmar presença");
      toast.success("✅ Presença confirmada com sucesso.");
      await carregarPresencas(turmaId);
    } catch (err) {
      let erroMsg = "Erro ao confirmar presença.";
      if (err && err.response) {
        erroMsg = await err.response.text();
      } else if (err && err.message) {
        erroMsg = err.message;
      }
      toast.error(`❌ ${erroMsg}`);
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <AnimatePresence>
        {turmas.filter(t => !!t.id).map((turma) => {
          const inicio = new Date(turma.data_inicio);
          const fim = new Date(turma.data_fim);
          const hojeISO = hoje.toISOString().split("T")[0];
          const dentroDoPeriodo = hojeISO >= turma.data_inicio && hojeISO <= turma.data_fim;
          const eventoJaIniciado = hojeISO >= turma.data_inicio;
          const estaExpandida = turmaExpandidaId === turma.id;
          const datasTurma = gerarIntervaloDeDatas(inicio, fim);

          return (
            <motion.div
              key={turma.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border p-4 rounded-2xl bg-white dark:bg-gray-900 shadow-sm flex flex-col"
            >
              <div className="flex justify-between items-center mb-1">
                <h4 className="text-md font-semibold text-[#1b4332] dark:text-green-200">
                  {turma.nome}
                </h4>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  dentroDoPeriodo
                    ? "bg-green-100 text-green-700 dark:bg-green-700 dark:text-white"
                    : eventoJaIniciado
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-700 dark:text-white"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                }`}>
                  {dentroDoPeriodo ? "Em andamento" : eventoJaIniciado ? "Realizada" : "Agendada"}
                </span>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-300">
                {formatarDataBrasileira(turma.data_inicio)} a {formatarDataBrasileira(turma.data_fim)}
              </p>

              {!modoadministradorPresencas ? (
                <div className="flex flex-wrap gap-2 mt-2 mb-3">
                  <BotaoSecundario onClick={() => carregarInscritos(turma.id)}>👥 Inscritos</BotaoSecundario>
                  <BotaoSecundario onClick={() => carregarAvaliacoes(turma.id)}>⭐ Avaliações</BotaoSecundario>
                  {dentroDoPeriodo && <BotaoPrimario onClick={() => navigate("/scanner")}>📷 QR Code</BotaoPrimario>}
                  {eventoJaIniciado && <BotaoSecundario onClick={() => gerarRelatorioPDF(turma.id)}>📄 PDF</BotaoSecundario>}
                  <BotaoSecundario onClick={() => navigate(`/turmas/editar/${turma.id}`)}>✏️ Editar</BotaoSecundario>
                  <BotaoSecundario onClick={() => navigate(`/turmas/presencas/${turma.id}`)}>📋 Ver Presenças</BotaoSecundario>
                </div>
              ) : (
                <div className="flex justify-end">
                  <BotaoPrimario
                    onClick={() => {
                      if (!turma?.id) return toast.error("Turma inválida.");
                      const novaTurma = estaExpandida ? null : turma.id;
                      if (!estaExpandida) {
                        carregarInscritos(turma.id);
                        carregarAvaliacoes(turma.id);
                        carregarPresencas(turma.id);
                      }
                      setTurmaExpandidaId(novaTurma);
                    }}
                  >
                    {estaExpandida ? "Recolher Detalhes" : "Ver Detalhes"}
                  </BotaoPrimario>
                </div>
              )}

              {modoadministradorPresencas && estaExpandida && (
                <div className="mt-4">
                  <div className="font-semibold text-sm text-lousa dark:text-white mb-2">Avaliações:</div>
                  <AvaliacoesEvento avaliacao={avaliacoesPorTurma[turma.id]} />

                  <div className="font-semibold text-sm mt-4 text-lousa dark:text-white mb-2">Inscritos:</div>
                  {(inscritosPorTurma[turma.id] || []).map((i) => {
                    const usuarioId = i.usuario_id ?? i.id;
                    return (
                      <div key={usuarioId} className="border rounded-lg p-3 mb-4 bg-white dark:bg-gray-800">
                        <div className="font-medium text-sm mb-1">{i.nome}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
  CPF: {formatarCPF(i.cpf) || "Não informado"}
</div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left">
                              <th className="py-1">📅 Data</th>
                              <th className="py-1">🟡 Situação</th>
                              <th className="py-1">✔️ Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {datasTurma.map((dataObj) => {
                              const dataISO = dataObj.toISOString().split("T")[0];
                              const presenca = (presencasPorTurma[turma.id] || []).find(
                                (p) => String(p.usuario_id) === String(usuarioId) && p.data_presenca === dataISO
                              );
                              const estaPresente = presenca?.presente ?? false;
                              return (
                                <tr key={dataISO} className="border-t">
                                  <td className="py-1">{formatarDataBrasileira(dataISO)}</td>
                                  <td className="py-1">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full
  ${estaPresente
    ? "bg-yellow-400 text-black"
    : "bg-red-400 text-white"}`}>
  {estaPresente ? "Presente" : "Faltou"}
</span>
                                  </td>
                                  <td className="py-1">
                                    {!estaPresente && (
                                      <button
                                      onClick={() => confirmarPresenca(dataISO, turma.id, usuarioId, i.nome)}
                                      className="text-white bg-teal-700 hover:bg-teal-800 text-xs py-1 px-2 rounded"
                                      aria-label={`Confirmar presença de ${i.nome} em ${formatarDataBrasileira(dataISO)}`}
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
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
