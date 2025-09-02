// 📁 src/components/TurmasInstrutor.jsx
import { motion, AnimatePresence } from "framer-motion";
import AvaliacoesEvento from "./AvaliacoesEvento";
import { toast } from "react-toastify";
import { apiPatch, apiPost } from "../services/api";

/* ===== Helpers de data (date-only seguro) ===== */
const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const hhmm = (s) => (typeof s === "string" ? s.slice(0, 5) : "");

/** Janela de confirmação (instrutor):
 * abre 60 min após o início e fecha 48h após o término da data
 */
function dentroDaJanelaConfirmacao(dataYMD, hIni = "00:00", hFim = "23:59") {
  if (!dataYMD) return false;
  const [h1, m1] = (hhmm(hIni) || "00:00").split(":").map(Number);
  const [h2, m2] = (hhmm(hFim) || "23:59").split(":").map(Number);

  const start = new Date(
    Number(dataYMD.slice(0, 4)),
    Number(dataYMD.slice(5, 7)) - 1,
    Number(dataYMD.slice(8, 10)),
    h1,
    m1,
    0,
    0
  );
  const end = new Date(
    Number(dataYMD.slice(0, 4)),
    Number(dataYMD.slice(5, 7)) - 1,
    Number(dataYMD.slice(8, 10)),
    h2,
    m2,
    0,
    0
  );

  const abre = new Date(start.getTime() + 60 * 60 * 1000);   // +60min
  const fecha = new Date(end.getTime() + 48 * 60 * 60 * 1000); // +48h
  const now = new Date();
  return now >= abre && now <= fecha;
}

/* Badge simples */
const Badge = ({ children, kind = "waiting" }) => {
  const cls =
    kind === "ok"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-amber-100 text-amber-700";
  return (
    <span className={`px-3 py-[2px] text-xs font-semibold rounded-full ${cls}`}>
      {children}
    </span>
  );
};

export default function TurmasInstrutor({
  turmas,
  inscritosPorTurma,
  avaliacoesPorTurma,
  presencasPorTurma,
  onVerInscritos,
  onVerAvaliacoes,
  onExportarListaAssinaturaPDF,
  onExportarQrCodePDF,
  token, // (não usado aqui, mantido por compat)
  carregarPresencas,
  carregando = false,
  turmaExpandidaInscritos,
  setTurmaExpandidaInscritos,
  turmaExpandidaAvaliacoes,
  setTurmaExpandidaAvaliacoes,
  datasPorTurma = {},
  carregarDatasPorTurma,
}) {
  // ✅ confirmação manual via API central
  async function confirmarPresencaManual(usuarioId, turmaId, dataReferencia) {
    const dataYMD = String(dataReferencia).slice(0, 10);
  
    // payload compatível com backends que esperam "data" ou "data_presenca"
    const payload = {
      usuario_id: Number(usuarioId),
      turma_id: Number(turmaId),
      data: dataYMD,
      data_presenca: dataYMD,
    };
  
    // Tentativas em ordem (da mais provável no teu projeto para as genéricas)
    const tentativas = [
      { fn: apiPost, url: "/api/presencas/confirmarPresencaInstrutor" },
      { fn: apiPost, url: "/api/presencas/confirmar" },
      { fn: apiPatch, url: "/api/presencas/confirmar" },
      { fn: apiPost, url: "/api/presencas/confirmar-manual" },
      { fn: apiPost, url: "/api/presencas/confirmar_presenca" },
    ];
  
    let ultimoErro = null;
  
    for (const t of tentativas) {
      try {
        await t.fn(t.url, payload, { on403: "silent" });
        toast.success("✅ Presença confirmada!");
        await carregarPresencas?.(turmaId);
        return;
      } catch (err) {
        // Se for 404, segue tentando a próxima rota; outros erros param aqui
        const status = err?.status || err?.response?.status;
        if (status !== 404) {
          const msg = err?.data?.erro || err?.data?.message || err?.message || "Erro ao confirmar presença.";
          toast.error(`❌ ${msg}`);
          return;
        }
        ultimoErro = err;
        // continua para a próxima tentativa
      }
    }
  
    // Se chegou aqui, todas as rotas falharam
    console.error("Nenhuma rota de confirmação encontrada.", ultimoErro);
    toast.error("❌ Rota não encontrada para confirmar presença. Verifique o endpoint no backend.");
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

                // 🔎 datas reais: prioriza turma.datas; depois presenças.detalhado.datas; senão []
                const datasReais =
  (Array.isArray(datasPorTurma[idSeguro]) && datasPorTurma[idSeguro].length
    ? datasPorTurma[idSeguro]
    : null) ??
  (Array.isArray(turma?.datas) && turma.datas.length ? turma.datas : null) ??
  presencasPorTurma[idSeguro]?.detalhado?.datas ??
  [];

                return (
                  <div key={idSeguro} className="border-t pt-4">
                    <p className="text-sm font-medium text-lousa dark:text-white text-left">
                      Turma: {turma.nome || `Turma ${turma.id}`}
                    </p>

                    {/* Botões de ação */}
<div className="flex flex-wrap gap-2 mt-2">
  {/* 👥 Ver inscritos — carrega inscritos, presenças e as DATAS reais */}
  <button
    onClick={() => {
      onVerInscritos?.(idSeguro);
      carregarPresencas?.(idSeguro);
      carregarDatasPorTurma?.(idSeguro); // 👈 garante datas_turma
      setTurmaExpandidaInscritos(expandindoInscritos ? null : idSeguro);
      setTurmaExpandidaAvaliacoes(null);
    }}
    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
  >
    👥 Ver inscritos
  </button>

  {/* ⭐ Avaliações — apenas abre avaliações */}
  <button
    onClick={() => {
      onVerAvaliacoes?.(idSeguro);
      setTurmaExpandidaAvaliacoes(expandindoAvaliacoes ? null : idSeguro);
      setTurmaExpandidaInscritos(null);
    }}
    className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
  >
    ⭐ Avaliações
  </button>

  <button
    onClick={() => onExportarListaAssinaturaPDF?.(idSeguro)}
    className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 text-sm"
  >
    📄 Lista de Presença
  </button>

  <button
    onClick={() => onExportarQrCodePDF?.(idSeguro, evento.nome)}
    className="px-3 py-1 bg-green-700 text-white rounded hover:bg-green-800 text-sm"
  >
    🔳 QR Code de Presença
  </button>
</div>

                    {/* Painel: Inscritos (AGORA com a tabela por aluno — Anexo 2) */}
                    <AnimatePresence>
                      {expandindoInscritos && (
                        <motion.div
                          id={`painel-inscritos-${idSeguro}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mt-4 space-y-4"
                        >
                          {(inscritosPorTurma[idSeguro] || []).length === 0 ? (
                            <p className="text-sm text-gray-600 italic dark:text-gray-300">
                              Nenhum inscrito nesta turma.
                            </p>
                          ) : (
                            (inscritosPorTurma[idSeguro] || []).map((aluno) => {
                              const usuarioId = aluno?.usuario_id ?? aluno?.id;
                              const nome = aluno?.nome || "—";
                              const cpf = aluno?.cpf || "";

                              // monta mapa de presenças por data para ESTE aluno
                              const det = presencasPorTurma[idSeguro]?.detalhado || { datas: [], usuarios: [] };
                              const uDet = (det.usuarios || []).find(
                                (u) => u?.id === usuarioId || u?.usuario_id === usuarioId
                              );
                              const presMap = {};
                              if (Array.isArray(uDet?.presencas)) {
                                for (const p of uDet.presencas) {
                                  const d = ymd(p?.data_presenca || p?.data);
                                  if (d) presMap[d] = !!p?.presente;
                                }
                              }

                              return (
                                <details
                                  key={usuarioId ?? `${nome}-${cpf}`}
                                  className="rounded-xl bg-zinc-50 dark:bg-zinc-900/40 ring-1 ring-zinc-200 dark:ring-zinc-800"
                                >
                                  <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between">
                                    <div className="flex flex-col">
                                      <span className="font-medium text-zinc-900 dark:text-white">{nome}</span>
                                      <span className="text-xs text-zinc-500 dark:text-zinc-400">CPF: {cpf}</span>
                                    </div>
                                    <span className="text-zinc-400 text-sm">abrir</span>
                                  </summary>

                                  <div className="px-4 pb-4">
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full text-sm">
                                        <thead>
                                          <tr className="text-left text-zinc-600 dark:text-zinc-300">
                                            <th className="py-2 pr-4">📅 Data</th>
                                            <th className="py-2 pr-4">🕒 Situação</th>
                                            <th className="py-2 pr-4">✔️ Ações</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(datasReais || []).map((d, idx) => {
                                            const dataYMD = ymd(d?.data) || ymd(d);
                                            if (!dataYMD) return null;
                                            const hin = hhmm(d?.horario_inicio) || hhmm(turma?.horario_inicio);
                                            const hfi = hhmm(d?.horario_fim) || hhmm(turma?.horario_fim);

                                            const presente = !!presMap[dataYMD];
                                            const podeConfirmar = !presente && dentroDaJanelaConfirmacao(dataYMD, hin, hfi);

                                            return (
                                              <tr
                                                key={`${usuarioId}-${dataYMD}-${idx}`}
                                                className="border-t border-zinc-200 dark:border-zinc-800"
                                              >
                                                <td className="py-2 pr-4 whitespace-nowrap">
                                                  {dataYMD.split("-").reverse().join("/")}
                                                </td>
                                                <td className="py-2 pr-4">
                                                  {presente ? (
                                                    <Badge kind="ok">Presente</Badge>
                                                  ) : (
                                                    <Badge> Aguardando </Badge>
                                                  )}
                                                </td>
                                                <td className="py-2 pr-4">
                                                  {podeConfirmar ? (
                                                    <button
                                                      onClick={() =>
                                                        confirmarPresencaManual(usuarioId, idSeguro, dataYMD)
                                                      }
                                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
                                                    >
                                                      Confirmar
                                                    </button>
                                                  ) : (
                                                    <span className="text-xs text-zinc-400">—</span>
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </details>
                              );
                            })
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Painel: Avaliações (mantido) */}
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
