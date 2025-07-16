import { motion, AnimatePresence } from "framer-motion";
import ListaInscritos from "./ListaInscritos";
import AvaliacoesEvento from "./AvaliacoesEvento";
import { formatarDataBrasileira } from "../utils/data"; // ✅ use sempre seu utilitário

export default function TurmasInstrutor({
  turmas,
  inscritosPorTurma,
  avaliacoesPorTurma,
  onVerInscritos,
  onVerAvaliacoes,
  onExportarListaAssinaturaPDF,
  onExportarQrCodePDF,
  token,
  carregando = false,
  turmaExpandidaInscritos,
  setTurmaExpandidaInscritos,
  turmaExpandidaAvaliacoes,
  setTurmaExpandidaAvaliacoes,
}) {
  if (carregando) {
    return (
      <ul className="space-y-6">
        {[...Array(2)].map((_, i) => (
          <li key={i} className="p-8 bg-gray-100 animate-pulse rounded-xl" />
        ))}
      </ul>
    );
  }

  return (
    <ul className="space-y-6">
      <AnimatePresence>
        {Array.isArray(turmas) &&
          turmas
            .filter((t) => t && t.id)
            .map((turma) => {
              const idSeguro = parseInt(turma.id);
              const expandindoInscritos = turmaExpandidaInscritos === idSeguro;
              const expandindoAvaliacoes = turmaExpandidaAvaliacoes === idSeguro;

              return (
                <motion.li
                  key={idSeguro}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="border p-4 rounded-xl bg-white dark:bg-zinc-800 shadow"
                  tabIndex={0}
                  aria-label={`Turma ${turma.nome}`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div>
                      <h3 className="text-lg font-semibold text-lousa dark:text-white">{turma.nome}</h3>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Evento: <strong>{turma.evento}</strong>
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatarDataBrasileira(turma.data_inicio)} a{" "}
                        {formatarDataBrasileira(turma.data_fim)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3 sm:mt-0">
                      <button
                        onClick={() => {
                          onVerInscritos(idSeguro);
                          setTurmaExpandidaInscritos(expandindoInscritos ? null : idSeguro);
                          setTurmaExpandidaAvaliacoes(null);
                        }}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        aria-expanded={expandindoInscritos}
                        aria-controls={`painel-inscritos-${idSeguro}`}
                      >
                        👥 Ver inscritos
                      </button>

                      <button
                        onClick={() => {
                          onVerAvaliacoes(idSeguro);
                          setTurmaExpandidaAvaliacoes(expandindoAvaliacoes ? null : idSeguro);
                          setTurmaExpandidaInscritos(null);
                        }}
                        className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                        aria-expanded={expandindoAvaliacoes}
                        aria-controls={`painel-avaliacoes-${idSeguro}`}
                      >
                        ⭐ Avaliações
                      </button>

                      <button
                        onClick={() => onExportarListaAssinaturaPDF(idSeguro)}
                        className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
                      >
                        📄 Lista de Presença
                      </button>

                      <button
                        onClick={() => onExportarQrCodePDF(idSeguro)}
                        className="px-3 py-1 bg-green-700 text-white rounded hover:bg-green-800 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                      >
                        🔳 QR Code de Presença
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandindoInscritos && (
                      <motion.div
                        id={`painel-inscritos-${idSeguro}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-4"
                      >
                        <ListaInscritos
                          inscritos={inscritosPorTurma[idSeguro] || []}
                          turma={turma}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {expandindoAvaliacoes && (
                      <motion.div
                        id={`painel-avaliacoes-${idSeguro}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-4"
                      >
                        {avaliacoesPorTurma[idSeguro] ? (
                          <AvaliacoesEvento avaliacao={avaliacoesPorTurma[idSeguro]} />
                        ) : (
                          <p className="text-sm text-gray-600 italic dark:text-gray-300">
                            Nenhuma avaliação registrada para esta turma.
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
      </AnimatePresence>
    </ul>
  );
}
