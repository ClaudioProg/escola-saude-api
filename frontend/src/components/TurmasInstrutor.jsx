// 📁 src/components/TurmasInstrutor.jsx
import { motion, AnimatePresence } from "framer-motion";
import ListaInscritos from "./ListaInscritos";
import AvaliacoesEvento from "./AvaliacoesEvento";
import { toast } from "react-toastify";
import { apiPatch } from "../services/api"; // ✅ cliente central

export default function TurmasInstrutor({
  turmas,
  inscritosPorTurma,
  avaliacoesPorTurma,
  presencasPorTurma,
  onVerInscritos,
  onVerAvaliacoes,
  onExportarListaAssinaturaPDF,
  onExportarQrCodePDF,
  token, // ainda repassado ao ListaInscritos
  carregarPresencas,
  carregando = false,
  turmaExpandidaInscritos,
  setTurmaExpandidaInscritos,
  turmaExpandidaAvaliacoes,
  setTurmaExpandidaAvaliacoes,
}) {
  // parse seguro do usuário
  let usuario = {};
  try {
    usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  } catch {
    usuario = {};
  }

  // helpers anti-fuso
  const toLocalNoon = (ymd) => new Date(`${ymd}T12:00:00`);
  const ensureYMD = (d) => {
    if (!d) return "";
    if (d instanceof Date) {
      // formata para yyyy-mm-dd sem UTC
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    // se vier "2025-08-13T00:00:00Z" ou "2025-08-13", pega os 10 primeiros
    return String(d).slice(0, 10);
  };

  // ✅ Confirmação manual via API central (sem URL hardcoded)
  async function confirmarPresencaManual(usuarioId, turmaId, dataReferencia) {
    try {
      const dataYMD = ensureYMD(dataReferencia);
      await apiPatch("/api/presencas/confirmar", {
        usuario_id: Number(usuarioId),
        turma_id: Number(turmaId),
        data: dataYMD,
      });
      toast.success("✅ Presença confirmada!");
      carregarPresencas(turmaId);
    } catch (err) {
      const msg =
        err?.data?.erro || err?.data?.message || err?.message || "Erro ao confirmar presença.";
      toast.error(`❌ ${msg}`);
    }
  }

  if (carregando) {
    return (
      <ul className="space-y-6">
        {[...Array(2)].map((_, i) => (
          <li key={i} className="p-8 bg-gray-100 dark:bg-zinc-700 animate-pulse rounded-xl" />
        ))}
      </ul>
    );
  }

  // Agrupa turmas por evento
  const eventosAgrupados = {};
  for (const turma of turmas || []) {
    if (!turma || !turma.id || !turma.evento?.id) continue;
    const eventoId = String(turma.evento.id);
    if (!eventosAgrupados[eventoId]) {
      eventosAgrupados[eventoId] = { nome: turma.evento.nome, turmas: [] };
    }
    eventosAgrupados[eventoId].turmas.push(turma);
  }

  return (
    <ul className="space-y-6">
      <AnimatePresence>
        {Object.entries(eventosAgrupados).map(([eventoId, evento]) => (
          <motion.li
            key={eventoId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border p-4 rounded-xl bg-white dark:bg-zinc-800 shadow"
          >
            <h3 className="text-lg font-semibold text-lousa dark:text-white">{evento.nome}</h3>

            <div className="space-y-4 mt-2">
              {evento.turmas.map((turma) => {
                const idSeguro = Number(turma.id);
                if (Number.isNaN(idSeguro)) return null;

                const expandindoInscritos = turmaExpandidaInscritos === idSeguro;
                const expandindoAvaliacoes = turmaExpandidaAvaliacoes === idSeguro;

                // 🔒 anti-fuso para cálculo de dias
                const dataInicioDT = toLocalNoon(ensureYMD(turma.data_inicio));
                const dataFimDT = toLocalNoon(ensureYMD(turma.data_fim));

                // total de dias (inclusivo)
                const MS_DIA = 24 * 60 * 60 * 1000;
                const totalDiasTurma = Math.max(1, Math.round((dataFimDT - dataInicioDT) / MS_DIA) + 1);

                // presença do instrutor
                const turmaPresencas = presencasPorTurma[idSeguro];
                let statusBadge = null;

                if (Array.isArray(turmaPresencas)) {
                  const uid = Number(usuario?.id);
                  const instrutorPresencas = turmaPresencas.find(
                    (p) => Number(p.usuario_id) === uid
                  );
                  const presencasInstrutor = Array.isArray(instrutorPresencas?.presencas)
                    ? instrutorPresencas.presencas
                    : [];

                  const diasConfirmados = presencasInstrutor.filter((p) => p?.presente === true).length;

                  // evento encerrado: data_fim + horario_fim < agora
                  const horarioFim = turma?.horario_fim || "17:00";
                  const agora = new Date();
                  const fimComHora = new Date(`${ensureYMD(turma.data_fim)}T${horarioFim}`);
                  const eventoEncerrado = fimComHora < agora;

                  if (diasConfirmados === totalDiasTurma && totalDiasTurma > 0) {
                    statusBadge = (
                      <span className="inline-block bg-green-100 text-green-700 px-3 py-1 mt-2 rounded-full text-xs font-bold">
                        ✅ Presente
                      </span>
                    );
                  } else if (!eventoEncerrado) {
                    statusBadge = (
                      <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 mt-2 rounded-full text-xs font-bold">
                        ⏳ Aguardando confirmação
                      </span>
                    );
                  } else {
                    statusBadge = (
                      <span className="inline-block bg-red-100 text-red-700 px-3 py-1 mt-2 rounded-full text-xs font-bold">
                        ❌ Faltou
                      </span>
                    );
                  }
                }

                return (
                  <div key={idSeguro} className="border-t pt-4">
                    <p className="text-sm font-medium text-lousa dark:text-white text-left">
                      Turma: {turma.nome || `Turma ${turma.id}`}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        onClick={() => {
                          onVerInscritos(idSeguro);
                          carregarPresencas(idSeguro);
                          setTurmaExpandidaInscritos(expandindoInscritos ? null : idSeguro);
                          setTurmaExpandidaAvaliacoes(null);
                        }}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        👥 Ver inscritos
                      </button>

                      <button
                        onClick={() => {
                          onVerAvaliacoes(idSeguro);
                          setTurmaExpandidaAvaliacoes(expandindoAvaliacoes ? null : idSeguro);
                          setTurmaExpandidaInscritos(null);
                        }}
                        className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                      >
                        ⭐ Avaliações
                      </button>

                      <button
                        onClick={() => onExportarListaAssinaturaPDF(idSeguro)}
                        className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 text-sm"
                      >
                        📄 Lista de Presença
                      </button>

                      <button
                        onClick={() => onExportarQrCodePDF(idSeguro, evento.nome)}
                        className="px-3 py-1 bg-green-700 text-white rounded hover:bg-green-800 text-sm"
                      >
                        🔳 QR Code de Presença
                      </button>

                      {statusBadge}
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
                          {(() => {
                            // suporta estrutura [ ... ] ou { lista: [...] }
                            const listaPresencas = Array.isArray(presencasPorTurma[idSeguro])
                              ? presencasPorTurma[idSeguro]
                              : presencasPorTurma[idSeguro]?.lista ?? [];

                            return (
                              <ListaInscritos
                                inscritos={inscritosPorTurma[idSeguro] || []}
                                turma={turma}
                                presencas={listaPresencas}
                                token={token}
                                carregarPresencas={() => carregarPresencas(idSeguro)}
                                confirmarPresencaManual={confirmarPresencaManual}
                              />
                            );
                          })()}
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
                          {(() => {
                            const avaliacoesTurma = avaliacoesPorTurma[idSeguro];
                            if (avaliacoesTurma && Array.isArray(avaliacoesTurma.comentarios)) {
                              return <AvaliacoesEvento avaliacoes={avaliacoesTurma.comentarios} />;
                            } else if (avaliacoesTurma === undefined) {
                              return (
                                <p className="text-sm text-gray-600 italic dark:text-gray-300">
                                  Nenhuma avaliação registrada para esta turma.
                                </p>
                              );
                            } else {
                              return (
                                <p className="text-red-500">
                                  Erro: avaliações não carregadas corretamente.
                                </p>
                              );
                            }
                          })()}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
