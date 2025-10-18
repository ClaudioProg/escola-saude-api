// 📁 src/components/ListaTurmasPresenca.jsx
/* eslint-disable no-console */
import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import BotaoPrimario from "./BotaoPrimario";
import { toast } from "react-toastify";
import {
  formatarDataBrasileira,
  gerarIntervaloDeDatas,
  formatarCPF,
  formatarParaISO,
} from "../utils/data";
import { apiGet, apiPost, apiDelete } from "../services/api";
import { Trash2 } from "lucide-react";

/* ────────────────────────────────────────────────────────────── */
/* Helpers locais                                                 */
/* ────────────────────────────────────────────────────────────── */
const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const hhmm = (s, fb = "00:00") =>
  typeof s === "string" && /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : fb;
const isSameYMD = (a, b) => ymd(a) === ymd(b);

/** ordena turmas por data_fim/hora_fim (desc) */
const keyFimTurma = (t) => {
  const df = ymd(t?.data_fim);
  const hf = hhmm(t?.horario_fim, "23:59");
  const di = ymd(t?.data_inicio);
  if (df) return new Date(`${df}T${hf}:00`).getTime();
  if (di) return new Date(`${di}T23:59:59`).getTime();
  return -Infinity;
};
const ordenarTurmasPorMaisNovo = (a, b) => keyFimTurma(b) - keyFimTurma(a);
const keyEventoMaisNovo = (ev) => Math.max(...(ev?.turmas || []).map(keyFimTurma), -Infinity);
const ordenarEventosPorMaisNovo = (a, b) => keyEventoMaisNovo(b) - keyEventoMaisNovo(a);

/* ────────────────────────────────────────────────────────────── */
/* Componente                                                     */
/* ────────────────────────────────────────────────────────────── */
export default function ListaTurmasPresenca({
  eventos = [],
  hoje,
  carregarInscritos,
  carregarAvaliacoes,
  gerarRelatorioPDF,
  inscritosPorTurma,
  avaliacoesPorTurma,
  navigate,
  modoadministradorPresencas = false,
  onTurmaRemovida,
  mostrarBotaoRemover = false,
}) {
  const [turmaExpandidaId, setTurmaExpandidaId] = useState(null);
  const [presencasPorTurma, setPresencasPorTurma] = useState({}); // { [id]: { datas:[], usuarios:[] } }
  const [carregandoTurmas, setCarregandoTurmas] = useState(() => new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  // Exclusão
  const [removendoId, setRemovendoId] = useState(null);
  const [idsRemovidos, setIdsRemovidos] = useState(() => new Set());

  const eventosOrdenados = useMemo(
    () => eventos.slice().sort(ordenarEventosPorMaisNovo),
    [eventos]
  );

  async function carregarPresencas(turmaId) {
    const markLoading = (on) =>
      setCarregandoTurmas((prev) => {
        const next = new Set(prev);
        if (on) next.add(String(turmaId));
        else next.delete(String(turmaId));
        return next;
      });

    try {
      markLoading(true);

      // Detalhes (usuarios, e eventualmente datas)
      const detalhes = await apiGet(`/api/presencas/turma/${turmaId}/detalhes`, { on403: "silent" });
      const usuarios = Array.isArray(detalhes?.usuarios) ? detalhes.usuarios : [];
      let datas = [];

      const pickDate = (x) => {
        if (!x) return null;
        if (x instanceof Date) {
          const y = x.getFullYear();
          const m = String(x.getMonth() + 1).padStart(2, "0");
          const d = String(x.getDate()).padStart(2, "0");
          return `${y}-${m}-${d}`;
        }
        if (typeof x?.data === "string") return x.data.slice(0, 10);
        if (x?.data instanceof Date) return pickDate(x.data);
        if (typeof x === "string") return x.slice(0, 10);
        return null;
      };

      // 1) datas reais (tabela datas_turma)
      try {
        const viaDatas = await apiGet(`/api/datas/turma/${turmaId}?via=datas`, { on403: "silent" });
        const arr = Array.isArray(viaDatas) ? viaDatas : [];
        datas = arr.map(pickDate).filter(Boolean);
      } catch { /* silencioso */ }

      // 2) datas distintas já lançadas em presenças
      if (!datas.length) {
        try {
          const viaPres = await apiGet(`/api/datas/turma/${turmaId}?via=presencas`, { on403: "silent" });
          const arr2 = Array.isArray(viaPres) ? viaPres : [];
          datas = arr2.map(pickDate).filter(Boolean);
        } catch { /* silencioso */ }
      }

      // 3) /detalhes (pode vir um intervalo)
      if (!datas.length) {
        const arr3 = Array.isArray(detalhes?.datas) ? detalhes.datas : [];
        datas = arr3.map((d) => (typeof d === "string" ? d.slice(0, 10) : null)).filter(Boolean);
      }

      // normaliza
      datas = Array.from(new Set(datas)).sort();

      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: { datas, usuarios } }));
    } catch (err) {
      console.error("❌ Erro ao carregar presenças:", err);
      toast.error("Erro ao carregar presenças.");
      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: { datas: [], usuarios: [] } }));
    } finally {
      markLoading(false);
    }
  }

  async function confirmarPresenca(dataSelecionada, turmaId, usuarioId, nome) {
    const confirmado = window.confirm(
      `Confirmar presença de ${nome} em ${formatarDataBrasileira(dataSelecionada)}?`
    );
    if (!confirmado) return;

    try {
      // rota simples; se quiser, dá pra adicionar fallbacks como no TurmasInstrutor
      await apiPost(`/api/presencas/confirmar-simples`, {
        turma_id: turmaId,
        usuario_id: usuarioId,
        data: dataSelecionada,
      });

      toast.success("✅ Presença confirmada com sucesso.");
      await carregarPresencas(turmaId);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      const erroMsg =
        err?.data?.erro || err?.response?.data?.mensagem || err?.message || "Erro ao confirmar presença.";
      console.error(`❌ Falha na confirmação de presença:`, err);
      toast.error(`❌ ${erroMsg}`);
    }
  }

  async function removerTurma(turmaId, turmaNome) {
    const ok = window.confirm(
      `Remover a turma "${turmaNome || turmaId}"?\n\n` +
        "Esta ação não pode ser desfeita.\n" +
        "Se houver presenças ou certificados, a exclusão será bloqueada."
    );
    if (!ok) return;

    try {
      setRemovendoId(turmaId);
      await apiDelete(`/api/turmas/${turmaId}`);
      setIdsRemovidos((prev) => {
        const novo = new Set(prev);
        novo.add(String(turmaId));
        return novo;
      });
      toast.success("Turma removida com sucesso.");
      if (typeof onTurmaRemovida === "function") {
        try { onTurmaRemovida(turmaId); } catch {}
      }
    } catch (err) {
      const code = err?.data?.erro;
      if (err?.status === 409 || code === "TURMA_COM_REGISTROS") {
        const c = err?.data?.contagens || {};
        toast.error(
          `Não é possível excluir: ${c.presencas || 0} presenças / ${c.certificados || 0} certificados.`
        );
      } else if (err?.status === 404) {
        toast.warn("Turma não encontrada. Atualize a página.");
      } else {
        toast.error("Erro ao remover turma.");
      }
      console.error("[removerTurma] erro:", err);
    } finally {
      setRemovendoId(null);
    }
  }

  /** monta as datas exibidas na grade; prioriza dados reais */
  function montarDatasGrade(turma, bloco, datasFallback) {
    const baseHi = hhmm(turma.horario_inicio, "08:00");
    const baseHf = hhmm(turma.horario_fim, "17:00");

    // 1) datas reais da tabela
    if (Array.isArray(bloco?.datas) && bloco.datas.length) {
      return bloco.datas
        .map((d) => ({ dataISO: ymd(d), hi: baseHi, hf: baseHf }))
        .filter((x) => x.dataISO);
    }

    // 2) encontros/datas no objeto "turma"
    if (Array.isArray(turma?.datas) && turma.datas.length) {
      return turma.datas
        .map((d) => ({
          dataISO: ymd(d?.data || d),
          hi: hhmm(d?.horario_inicio, baseHi),
          hf: hhmm(d?.horario_fim, baseHf),
        }))
        .filter((x) => x.dataISO);
    }

    if (Array.isArray(turma?.encontros) && turma.encontros.length) {
      return turma.encontros
        .map((e) => {
          if (typeof e === "string") {
            const dataISO = ymd(e);
            return dataISO ? { dataISO, hi: baseHi, hf: baseHf } : null;
          }
          const dataISO = ymd(e?.data);
          const hi = hhmm(e?.inicio || e?.horario_inicio, baseHi);
          const hf = hhmm(e?.fim || e?.horario_fim, baseHf);
          return dataISO ? { dataISO, hi, hf } : null;
        })
        .filter(Boolean);
    }

    // 3) fallback: intervalo contínuo
    return (datasFallback || []).map((d) => ({
      dataISO: formatarParaISO(d),
      hi: baseHi,
      hf: baseHf,
    }));
  }

  return (
    <div className="grid grid-cols-1 gap-8">
      <AnimatePresence>
        {eventosOrdenados.map((evento) => (
          <div key={evento.evento_id ?? evento.id}>
            <h2 className="text-xl font-bold text-lousa dark:text-white mb-4">
              📘 Evento: {evento.titulo}
            </h2>

            {(evento.turmas || [])
              .filter((t) => t && t.id && !idsRemovidos.has(String(t.id)))
              .sort(ordenarTurmasPorMaisNovo)
              .map((turma) => {
                // ---------- Datas/Horários no nível da turma (robustos) ----------
                const agora = new Date();

                const di = ymd(turma.data_inicio);
                const df = ymd(turma.data_fim);
                const hi = hhmm(turma.horario_inicio, "08:00");
                const hf = hhmm(turma.horario_fim, "17:00");

                const inicioDT = di ? new Date(`${di}T${hi}:00`) : null;
                const fimDT = df ? new Date(`${df}T${hf}:00`) : null;

                const inicioValido = inicioDT && !Number.isNaN(inicioDT.getTime());
                const fimValido = fimDT && !Number.isNaN(fimDT.getTime());

                // status
                let status = "Desconhecido";
                if (inicioValido && fimValido) {
                  status =
                    agora < inicioDT ? "Programado" : agora > fimDT ? "Encerrado" : "Em andamento";
                }

                const statusClasse =
                  status === "Em andamento"
                    ? "bg-green-100 text-green-700 dark:bg-green-700 dark:text-white"
                    : status === "Encerrado"
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-700 dark:text-white"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";

                const estaExpandida = turmaExpandidaId === turma.id;

                // fallback do intervalo (apenas se API não mandar as datas do bloco)
                const inicioNoon = di ? new Date(`${di}T12:00:00`) : null;
                const fimNoon = df ? new Date(`${df}T12:00:00`) : null;
                const datasFallback =
                  inicioNoon && fimNoon ? gerarIntervaloDeDatas(inicioNoon, fimNoon) : [];

                const bloco = presencasPorTurma[turma.id];
                const datasGrade = montarDatasGrade(turma, bloco, datasFallback);
                const isLoadingTurma = carregandoTurmas.has(String(turma.id));

                return (
                  <motion.div
                    key={turma.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border p-4 rounded-2xl bg-white dark:bg-gray-900 shadow-sm flex flex-col mb-6"
                    aria-labelledby={`turma-${turma.id}-titulo`}
                  >
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <h4
                        id={`turma-${turma.id}-titulo`}
                        className="text-md font-semibold text-[#1b4332] dark:text-green-200"
                      >
                        {turma.nome}
                      </h4>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold ${statusClasse}`}
                          aria-label={`Status da turma: ${status}`}
                        >
                          {status}
                        </span>

                        {/* 🔒 Remover turma — só se explicitamente habilitado */}
                        {mostrarBotaoRemover && (
                          <button
                            type="button"
                            onClick={() => removerTurma(turma.id, turma.nome)}
                            disabled={removendoId === turma.id}
                            title="Remover turma"
                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs
                                       hover:bg-red-50 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                            aria-disabled={removendoId === turma.id}
                            aria-label={
                              removendoId === turma.id
                                ? "Removendo turma…"
                                : `Remover turma ${turma.nome}`
                            }
                          >
                            <Trash2 size={14} />
                            {removendoId === turma.id ? "Removendo..." : "Remover"}
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-300">
                      {formatarDataBrasileira(di || turma.data_inicio)} a{" "}
                      {formatarDataBrasileira(df || turma.data_fim)}
                    </p>

                    {modoadministradorPresencas && (
                      <div className="flex items-center gap-3 justify-end mt-2">
                        {typeof gerarRelatorioPDF === "function" && (
                          <BotaoPrimario
                            onClick={() => gerarRelatorioPDF?.(turma.id)}
                            aria-label="Gerar relatório em PDF desta turma"
                            variant="secondary"
                          >
                            Exportar PDF
                          </BotaoPrimario>
                        )}

                        <BotaoPrimario
                          onClick={() => {
                            const novaTurma = estaExpandida ? null : turma.id;
                            if (!estaExpandida) {
                              carregarInscritos?.(turma.id);
                              carregarAvaliacoes?.(turma.id);
                              carregarPresencas(turma.id);
                            }
                            setTurmaExpandidaId(novaTurma);
                          }}
                          aria-expanded={estaExpandida}
                          aria-controls={`turma-${turma.id}-detalhes`}
                        >
                          {estaExpandida ? "Recolher Detalhes" : "Ver Detalhes"}
                        </BotaoPrimario>
                      </div>
                    )}

                    {modoadministradorPresencas && estaExpandida && (
                      <div id={`turma-${turma.id}-detalhes`} className="mt-4">
                        {/* Skeleton de carregamento da turma */}
                        {isLoadingTurma && (
                          <div
                            className="animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800 h-24 mb-4"
                            aria-live="polite"
                          />
                        )}

                        {!isLoadingTurma && (
                          <>
                            <div className="font-semibold text-sm mt-1 text-lousa dark:text-white mb-2">
                              Inscritos:
                            </div>

                            {(inscritosPorTurma[turma.id] || []).length === 0 ? (
                              <p className="text-sm text-gray-600 dark:text-gray-300">
                                Nenhum inscrito encontrado para esta turma.
                              </p>
                            ) : (
                              (inscritosPorTurma[turma.id] || []).map((i) => {
                                const usuarioId = i.usuario_id ?? i.id;
                                const usuarioBloco = bloco?.usuarios?.find(
                                  (u) => String(u.id) === String(usuarioId)
                                );

                                return (
                                  <div
                                    key={`${usuarioId}-${refreshKey}`}
                                    className="border rounded-lg p-3 mb-4 bg-white dark:bg-gray-800"
                                  >
                                    <div className="font-medium text-sm mb-1">{i.nome}</div>
                                    <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                                      CPF: {formatarCPF(i.cpf) || "Não informado"}
                                    </div>

                                    <table className="w-full table-fixed text-xs">
                                      <thead>
                                        <tr className="text-left text-gray-600 dark:text-gray-300">
                                          <th scope="col" className="py-2 px-2 w-1/3 font-medium whitespace-nowrap">
                                            📅 Data
                                          </th>
                                          <th scope="col" className="py-2 px-2 w-1/3 font-medium whitespace-nowrap">
                                            🟡 Situação
                                          </th>
                                          <th scope="col" className="py-2 px-2 w-1/3 font-medium whitespace-nowrap">
                                            ✔️ Ações
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {datasGrade.map((item) => {
                                          const dataISO = item.dataISO; // yyyy-mm-dd
                                          const hiDia = item.hi || hi;

                                          const estaPresente = Array.isArray(usuarioBloco?.presencas)
                                            ? usuarioBloco.presencas.some(
                                                (p) =>
                                                  String(p?.usuario_id ?? usuarioBloco.id) ===
                                                    String(usuarioId) &&
                                                  p?.presente === true &&
                                                  isSameYMD(p?.data, dataISO)
                                              )
                                            : false;

                                          // janela: abre +60min do início daquele encontro; fecha +15 dias após término do curso
                                          const inicioAulaDT = new Date(`${dataISO}T${hiDia}:00`);
                                          const abreJanela = new Date(inicioAulaDT.getTime() + 60 * 60 * 1000);
                                          const now = new Date();

                                          const hfSeguro = hhmm(turma.horario_fim, "23:59");
                                          const fimDTLocal = df ? new Date(`${df}T${hfSeguro}:00`) : null;
                                          const fimMais15 =
                                            fimDTLocal ? new Date(fimDTLocal.getTime() + 15 * 24 * 60 * 60 * 1000) : null;

                                          const antesDaJanela = now < abreJanela;
                                          const dentroDaJanela = fimMais15 ? now >= abreJanela && now <= fimMais15 : false;

                                          const statusTexto = estaPresente
                                            ? "Presente"
                                            : antesDaJanela
                                            ? "Aguardando"
                                            : "Faltou";

                                          const statusClasse = estaPresente
                                            ? "bg-green-400 text-white"
                                            : antesDaJanela
                                            ? "bg-yellow-300 text-gray-800"
                                            : "bg-red-400 text-white";

                                          const podeConfirmar = !estaPresente && dentroDaJanela;

                                          return (
                                            <tr key={`${usuarioId}-${dataISO}`} className="border-top border-gray-100">
                                              <td className="py-1 px-2 text-left">
                                                {formatarDataBrasileira(dataISO)}
                                              </td>
                                              <td className="py-1 px-2 text-left">
                                                <span
                                                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusClasse}`}
                                                  aria-label={`Status em ${formatarDataBrasileira(dataISO)}: ${statusTexto}`}
                                                >
                                                  {statusTexto}
                                                </span>
                                              </td>
                                              <td className="py-1 px-2 text-left">
                                                {podeConfirmar && !antesDaJanela ? (
                                                  <button
                                                    onClick={() =>
                                                      confirmarPresenca(
                                                        dataISO,
                                                        turma.id,
                                                        usuarioId,
                                                        i.nome
                                                      )
                                                    }
                                                    className="text-white bg-teal-700 hover:bg-teal-800 text-xs py-1 px-2 rounded"
                                                    aria-label={`Confirmar presença de ${i.nome} em ${formatarDataBrasileira(dataISO)}`}
                                                  >
                                                    Confirmar
                                                  </button>
                                                ) : (
                                                  <span className="text-gray-400 text-xs" aria-hidden="true">—</span>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                );
                              })
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

ListaTurmasPresenca.propTypes = {
  eventos: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      evento_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      titulo: PropTypes.string,
      turmas: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
          nome: PropTypes.string,
          data_inicio: PropTypes.string,
          data_fim: PropTypes.string,
          horario_inicio: PropTypes.string,
          horario_fim: PropTypes.string,
          encontros: PropTypes.array,
          datas: PropTypes.array,
        })
      ),
    })
  ),
  hoje: PropTypes.instanceOf(Date),
  carregarInscritos: PropTypes.func.isRequired,
  carregarAvaliacoes: PropTypes.func.isRequired,
  gerarRelatorioPDF: PropTypes.func,
  inscritosPorTurma: PropTypes.object.isRequired,
  avaliacoesPorTurma: PropTypes.object,
  navigate: PropTypes.func,
  modoadministradorPresencas: PropTypes.bool,
  onTurmaRemovida: PropTypes.func,
  mostrarBotaoRemover: PropTypes.bool,
};
