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

  // helpers anti-fuso/normalização
  const ensureYMD = (d) => (typeof d === "string" ? d.slice(0, 10) : "");
  const toLocalNoon = (ymd) => (ymd ? new Date(`${ymd}T12:00:00`) : null);
  const rangeDiasYMD = (iniYMD, fimYMD) => {
    const out = [];
    const d0 = toLocalNoon(iniYMD);
    const d1 = toLocalNoon(fimYMD || iniYMD);
    if (!d0 || !d1) return out;
    for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      out.push(`${y}-${m}-${day}`);
    }
    return out;
  };
  const fmtHora = (s) => (typeof s === "string" ? s.slice(0, 5) : "");
  const brData = (ymd) => {
    const [y, m, d] = (ymd || "").split("-");
    if (!y || !m || !d) return ymd || "";
    return `${d}/${m}/${y}`;
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

  // 🔎 Obtém DATAS REAIS da turma (ordem crescente)
  function getDatasReais(turma) {
    const id = Number(turma?.id);
    if (!id) return [];

    // 1) Preferir datas carregadas junto com presenças (já têm horários por dia, quando houver)
    const detalhado = presencasPorTurma?.[id]?.detalhado;
    const datasFromPres = Array.isArray(detalhado?.datas) ? detalhado.datas : null;
    if (datasFromPres && datasFromPres.length) {
      return datasFromPres
        .map((d) => ({
          data: ensureYMD(d?.data ?? d),
          horario_inicio: fmtHora(d?.horario_inicio ?? turma?.horario_inicio),
          horario_fim: fmtHora(d?.horario_fim ?? turma?.horario_fim),
        }))
        .filter((x) => x.data)
        .sort((a, b) => a.data.localeCompare(b.data));
    }

    // 2) Depois, usar o que já vem da API do backend (listarEventosDoinstrutor inclui turma.datas)
    const datasFromTurma = Array.isArray(turma?.datas) ? turma.datas : null;
    if (datasFromTurma && datasFromTurma.length) {
      return datasFromTurma
        .map((d) => ({
          data: ensureYMD(d?.data ?? d),
          horario_inicio: fmtHora(d?.horario_inicio ?? turma?.horario_inicio),
          horario_fim: fmtHora(d?.horario_fim ?? turma?.horario_fim),
        }))
        .filter((x) => x.data)
        .sort((a, b) => a.data.localeCompare(b.data));
    }

    // 3) Último recurso: intervalo sequencial (evita “vazio” na UI)
    const di = ensureYMD(turma?.data_inicio);
    const df = ensureYMD(turma?.data_fim);
    const seq = rangeDiasYMD(di, df);
    return seq.map((d) => ({
      data: d,
      horario_inicio: fmtHora(turma?.horario_inicio),
      horario_fim: fmtHora(turma?.horario_fim),
    }));
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
      eventosAgrupados[eventoId] = { nome: turma.evento.nome || turma.evento.titulo || "Evento", turmas: [] };
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

                // Datas reais desta turma
                const datasReais = getDatasReais(turma);

                return (
                  <div key={idSeguro} className="border-t pt-4">
                    <p className="text-sm font-medium text-lousa dark:text-white text-left">
                      Turma: {turma.nome || `Turma ${turma.id}`}
                    </p>

                    {/* 📅 Chips com DATAS REAIS (nada de intervalo sequencial “cheio”) */}
                    {datasReais.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {datasReais.map((d, idx) => (
                          <span
                            key={`${d.data}-${idx}`}
                            className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-zinc-700 dark:text-white border"
                            title={`${d.data} ${d.horario_inicio || ""}${d.horario_inicio || d.horario_fim ? " - " : ""}${d.horario_fim || ""}`}
                          >
                            📅 {brData(d.data)}
                            {d.horario_inicio || d.horario_fim ? (
                              <> · {d.horario_inicio || ""}{d.horario_inicio && d.horario_fim ? "–" : ""}{d.horario_fim || ""}</>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mt-3">
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
                            const listaPresencas = Array.isArray(presencasPorTurma[idSeguro])
                              ? presencasPorTurma[idSeguro]
                              : presencasPorTurma[idSeguro]?.lista ?? [];

                            return (
                              <ListaInscritos
                                inscritos={inscritosPorTurma[idSeguro] || []}
                                turma={turma}
                                presencas={listaPresencas}
                                datas={datasReais} {/* ⬅️ datas reais para o componente filho */}
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
                            const raw = avaliacoesPorTurma[idSeguro];

                            // 🔧 normaliza para um único array de comentários
                            const comentarios =
                              Array.isArray(raw) ? raw :
                              Array.isArray(raw?.comentarios) ? raw.comentarios :
                              Array.isArray(raw?.itens) ? raw.itens :
                              Array.isArray(raw?.avaliacoes) ? raw.avaliacoes :
                              [];

                            return comentarios.length > 0 ? (
                              <AvaliacoesEvento avaliacoes={comentarios} />
                            ) : (
                              <p className="text-sm text-gray-600 italic dark:text-gray-300">
                                Nenhuma avaliação registrada para esta turma.
                              </p>
                            );
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
