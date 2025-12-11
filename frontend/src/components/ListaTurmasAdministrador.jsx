// 📁 src/components/ListaTurmasAdministrador.jsx
/* eslint-disable no-console */
import PropTypes from "prop-types";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";
import { toast } from "react-toastify";

import BotaoPrimario from "./BotaoPrimario";
import {
  formatarDataBrasileira,
  gerarIntervaloDeDatas,
  formatarCPF,
  formatarParaISO,
} from "../utils/data";
import { apiGet, apiPost, apiDelete } from "../services/api";

/* ============================== Helpers ============================== */

const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const hhmm = (s, fb = "00:00") =>
  typeof s === "string" && /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : fb;

const toLocalDateFromYMDTime = (dateOnly, timeHHmm = "12:00") =>
  dateOnly ? new Date(`${dateOnly}T${hhmm(timeHHmm)}:00`) : null;

const isSameYMD = (a, b) => ymd(a) === ymd(b);

function statusPorJanela({ di, df, hi, hf, agora = new Date() }) {
  const inicio = di ? toLocalDateFromYMDTime(di, hi || "00:00") : null;
  const fim = df ? toLocalDateFromYMDTime(df, hf || "23:59") : null;
  if (!inicio || !fim || Number.isNaN(inicio) || Number.isNaN(fim)) return "Desconhecido";
  if (agora < inicio) return "Programado";
  if (agora > fim) return "Encerrado";
  return "Em andamento";
}

function clsStatusBadge(status) {
  switch (status) {
    case "Em andamento":
      return "bg-green-100 text-green-700 dark:bg-green-700 dark:text-white";
    case "Encerrado":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-700 dark:text-white";
    case "Programado":
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
  }
}

/** Prioriza: turma.datas -> turma.encontros -> bloco.datas -> fallback por intervalo */
function montarDatasGrade(turma, bloco, datasFallback) {
  const baseHi = hhmm(turma?.horario_inicio, "08:00");
  const baseHf = hhmm(turma?.horario_fim, "17:00");

  // 1) datas_turma [{data, horario_inicio, horario_fim}]
  if (Array.isArray(turma?.datas) && turma.datas.length) {
    return turma.datas
      .map((d) => ({
        dataISO: ymd(d?.data || d),
        hi: hhmm(d?.horario_inicio, baseHi),
        hf: hhmm(d?.horario_fim, baseHf),
      }))
      .filter((x) => x.dataISO);
  }

  // 2) encontros [{data, inicio/fim}] ou ["YYYY-MM-DD", ...]
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

  // 3) bloco rico
  if (Array.isArray(bloco?.datas) && bloco.datas.length) {
    return bloco.datas
      .map((d) => ({ dataISO: ymd(d), hi: baseHi, hf: baseHf }))
      .filter((x) => x.dataISO);
  }

  // 4) fallback por intervalo [data_inicio..data_fim]
  return (datasFallback || []).map((d) => ({
    dataISO: formatarParaISO(d),
    hi: baseHi,
    hf: baseHf,
  }));
}

/* ============================= Componente ============================= */

export default function ListaTurmasAdministrador({
  eventos = [],
  hoje, // compat
  carregarInscritos,
  carregarAvaliacoes,
  gerarRelatorioPDF, // compat
  inscritosPorTurma,
  avaliacoesPorTurma, // compat
  navigate, // compat
  modoadministradorPresencas = false,
  onTurmaRemovida,
  mostrarBotaoRemover = true, // ✅ novo: permite ocultar o botão "Remover"
}) {
  const [turmaExpandidaId, setTurmaExpandidaId] = useState(null);
  const [presencasPorTurma, setPresencasPorTurma] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);

  const [removendoId, setRemovendoId] = useState(null);
  const [idsRemovidos, setIdsRemovidos] = useState(() => new Set());

  // ----- Ordenadores (mais recente primeiro) -----
  const keyFimTurma = (t) => {
    const df = ymd(t?.data_fim);
    const hf = hhmm(t?.horario_fim, "23:59");
    const di = ymd(t?.data_inicio);

    if (df) return toLocalDateFromYMDTime(df, hf).getTime();
    if (di) return toLocalDateFromYMDTime(di, "23:59").getTime();
    return -Infinity;
  };
  const ordenarTurmasPorMaisNovo = (a, b) => keyFimTurma(b) - keyFimTurma(a);

  const keyEventoMaisNovo = (ev) => Math.max(...(ev?.turmas || []).map(keyFimTurma), -Infinity);
  const ordenarEventosPorMaisNovo = (a, b) => keyEventoMaisNovo(b) - keyEventoMaisNovo(a);

  const eventosOrdenados = useMemo(
    () => eventos.slice().sort(ordenarEventosPorMaisNovo),
    [eventos]
  );

  // ----- Carregar presenças (bloco rico + tentativa de datas_turma) -----
  async function carregarPresencas(turmaId) {
    try {
      // bloco detalhado
      const detalhes = await apiGet(`/api/presencas/turma/${turmaId}/detalhes`, { on403: "silent" });
      const usuarios = Array.isArray(detalhes?.usuarios) ? detalhes.usuarios : [];

      // tenta datas_turma
      let datas = [];
      try {
        const viaDatas = await apiGet(`/api/datas/turma/${turmaId}?via=datas`, { on403: "silent" });
        const arr = Array.isArray(viaDatas) ? viaDatas : [];
        datas = arr.map((x) => (typeof x === "string" ? x.slice(0, 10) : x?.data?.slice(0, 10))).filter(Boolean);
      } catch {}

      // fallback: datas distintas via presenças
      if (!datas.length) {
        try {
          const viaPres = await apiGet(`/api/datas/turma/${turmaId}?via=presencas`, { on403: "silent" });
          const arr2 = Array.isArray(viaPres) ? viaPres : [];
          datas = arr2.map((x) => (typeof x === "string" ? x.slice(0, 10) : x?.data?.slice(0, 10))).filter(Boolean);
        } catch {}
      }

      // último recurso: "datas" do próprio /detalhes
      if (!datas.length) {
        const arr3 = Array.isArray(detalhes?.datas) ? detalhes.datas : [];
        datas = arr3.map((d) => (typeof d === "string" ? d.slice(0, 10) : d?.data?.slice(0, 10))).filter(Boolean);
      }

      datas = Array.from(new Set(datas)).sort();
      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: { datas, usuarios } }));
    } catch (err) {
      console.error("❌ Erro ao carregar presenças:", err);
      toast.error("Erro ao carregar presenças.");
      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: { datas: [], usuarios: [] } }));
    }
  }

  // ----- Confirmar presença simples -----
  async function confirmarPresenca(dataSelecionada, turmaId, usuarioId, nome) {
    const ok = window.confirm(
      `Confirmar presença de ${nome} em ${formatarDataBrasileira(dataSelecionada)}?`
    );
    if (!ok) return;

    try {
      await apiPost(`/api/presencas/confirmar-simples`, {
        turma_id: turmaId,
        usuario_id: usuarioId,
        data: dataSelecionada, // "YYYY-MM-DD"
      });

      toast.success("✅ Presença confirmada com sucesso.");
      await carregarPresencas(turmaId);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      if (err?.status === 409) {
        // tolera idempotência (já confirmado)
        toast.success("✅ Presença já estava confirmada.");
        await carregarPresencas(turmaId);
        setRefreshKey((k) => k + 1);
      } else {
        const msg = err?.message || "Erro ao confirmar presença.";
        console.error("❌ Falha na confirmação de presença:", err);
        toast.error(`❌ ${msg}`);
      }
    }
  }

  // ----- Excluir turma -----
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
      onTurmaRemovida?.(turmaId);
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

  return (
    <div className="grid grid-cols-1 gap-8" role="region" aria-label="Lista de turmas dos eventos">
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
                const di = ymd(turma.data_inicio);
                const df = ymd(turma.data_fim);
                const hi = hhmm(turma.horario_inicio, "08:00");
                const hf = hhmm(turma.horario_fim, "17:00");

                const status = statusPorJanela({ di, df, hi, hf });
                const estaExpandida = turmaExpandidaId === turma.id;

                // fallback para a grade (se a API não mandar bloco/datas)
                const inicioNoon = di ? toLocalDateFromYMDTime(di, "12:00") : null;
                const fimNoon = df ? toLocalDateFromYMDTime(df, "12:00") : null;
                const datasFallback =
                  inicioNoon && fimNoon ? gerarIntervaloDeDatas(inicioNoon, fimNoon) : [];

                const bloco = presencasPorTurma[turma.id];
                const datasGrade = montarDatasGrade(turma, bloco, datasFallback);

                // janela admin: 60 min após início do dia até 60 dias após fim da turma
                const fimDT = df ? toLocalDateFromYMDTime(df, hf) : null;
                const fimValido = fimDT && !Number.isNaN(fimDT.getTime());
                const fimMais60 = fimValido ? new Date(fimDT.getTime() + 60 * 24 * 60 * 60 * 1000) : null;
                const agora = new Date();

                return (
                  <motion.div
                    key={turma.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border p-4 rounded-2xl bg-white dark:bg-gray-900 shadow-sm flex flex-col mb-6"
                    aria-label={`Turma ${turma.nome}`}
                  >
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <h4 className="text-md font-semibold text-[#1b4332] dark:text-green-200">
                        {turma.nome}
                      </h4>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold ${clsStatusBadge(status)}`}
                          aria-label={`Status: ${status}`}
                        >
                          {status}
                        </span>

                        {mostrarBotaoRemover && (
                          <button
                            type="button"
                            onClick={() => removerTurma(turma.id, turma.nome)}
                            disabled={removendoId === turma.id}
                            title="Remover turma"
                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs
                                       hover:bg-red-50 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                            aria-label={`Remover turma ${turma.nome}`}
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
                      <div className="flex justify-end">
                        <BotaoPrimario
                          onClick={() => {
                            const nova = estaExpandida ? null : turma.id;
                            if (!estaExpandida) {
                              carregarInscritos?.(turma.id);
                              carregarAvaliacoes?.(turma.id);
                              carregarPresencas(turma.id);
                            }
                            setTurmaExpandidaId(nova);
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
                        <div className="font-semibold text-sm mt-4 text-lousa dark:text-white mb-2">
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
                                aria-label={`Inscrito ${i.nome}`}
                              >
                                <div className="font-medium text-sm mb-1">{i.nome}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                                  CPF: {formatarCPF(i.cpf) || "Não informado"}
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full table-fixed text-xs">
                                    <thead>
                                      <tr className="text-left text-gray-600 dark:text-gray-300">
                                        <th className="py-2 px-2 w-1/3 font-medium whitespace-nowrap">📅 Data</th>
                                        <th className="py-2 px-2 w-1/3 font-medium whitespace-nowrap">🟡 Situação</th>
                                        <th className="py-2 px-2 w-1/3 font-medium whitespace-nowrap">✔️ Ações</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {datasGrade.map(({ dataISO, hi }) => {
                                        // presença no dia
                                        const presente = Array.isArray(usuarioBloco?.presencas)
                                          ? usuarioBloco.presencas.some(
                                              (p) =>
                                                String(p?.usuario_id ?? usuarioBloco.id) ===
                                                  String(usuarioId) &&
                                                p?.presente === true &&
                                                isSameYMD(p?.data, dataISO)
                                            )
                                          : false;

                                        // abre 60 min após o início do encontro
                                        const inicioDia = toLocalDateFromYMDTime(dataISO, hi);
                                        const abreJanela = inicioDia
                                          ? new Date(inicioDia.getTime() + 60 * 60 * 1000)
                                          : null;

                                        const now = new Date();
                                        const antesDaJanela = abreJanela ? now < abreJanela : true;
                                        const dentroDaJanela =
                                          !antesDaJanela && (fimMais60 ? now <= fimMais60 : false);

                                        const statusTexto = presente
                                          ? "Presente"
                                          : antesDaJanela
                                          ? "Aguardando"
                                          : "Faltou";

                                        const statusClasse = presente
                                          ? "bg-green-400 text-white"
                                          : antesDaJanela
                                          ? "bg-yellow-300 text-gray-800"
                                          : "bg-red-400 text-white";

                                        const podeConfirmar = !presente && dentroDaJanela;

                                        return (
                                          <tr key={`${usuarioId}-${dataISO}`} className="border-t">
                                            <td className="py-1 px-2 text-left">
                                              {formatarDataBrasileira(dataISO)}
                                            </td>
                                            <td className="py-1 px-2 text-left">
                                              <span
                                                className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusClasse}`}
                                                aria-label={`Status em ${formatarDataBrasileira(
                                                  dataISO
                                                )}: ${statusTexto}`}
                                              >
                                                {statusTexto}
                                              </span>
                                            </td>
                                            <td className="py-1 px-2 text-left">
                                              {podeConfirmar ? (
                                                <button
                                                  onClick={() =>
                                                    confirmarPresenca(dataISO, turma.id, usuarioId, i.nome)
                                                  }
                                                  className="text-white bg-teal-700 hover:bg-teal-800 text-xs py-1 px-2 rounded
                                                             focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none"
                                                  aria-label={`Confirmar presença de ${i.nome} em ${formatarDataBrasileira(
                                                    dataISO
                                                  )}`}
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
                              </div>
                            );
                          })
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

/* ============================== PropTypes ============================== */

ListaTurmasAdministrador.propTypes = {
  eventos: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      evento_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      titulo: PropTypes.string,
      turmas: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
          nome: PropTypes.string,
          data_inicio: PropTypes.string, // ISO date or "YYYY-MM-DD"
          data_fim: PropTypes.string,    // ISO date or "YYYY-MM-DD"
          horario_inicio: PropTypes.string, // "HH:MM"
          horario_fim: PropTypes.string,    // "HH:MM"
          datas: PropTypes.arrayOf(
            PropTypes.shape({
              data: PropTypes.string,
              horario_inicio: PropTypes.string,
              horario_fim: PropTypes.string,
            })
          ),
          encontros: PropTypes.array, // strings "YYYY-MM-DD" ou objetos {data,inicio,fim}
        })
      ),
    })
  ),
  hoje: PropTypes.any,
  carregarInscritos: PropTypes.func,
  carregarAvaliacoes: PropTypes.func,
  gerarRelatorioPDF: PropTypes.func,
  inscritosPorTurma: PropTypes.object.isRequired,
  avaliacoesPorTurma: PropTypes.object,
  navigate: PropTypes.func,
  modoadministradorPresencas: PropTypes.bool,
  onTurmaRemovida: PropTypes.func,
  mostrarBotaoRemover: PropTypes.bool,
};
