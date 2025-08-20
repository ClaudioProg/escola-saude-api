// 📁 src/components/ListaTurmasAdministrador.jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BotaoPrimario from "./BotaoPrimario";
import { toast } from "react-toastify";
import {
  formatarDataBrasileira,
  gerarIntervaloDeDatas,
  formatarCPF,
  formatarParaISO,
} from "../utils/data";
import { apiGet, apiPost } from "../services/api";

export default function ListaTurmasAdministrador({
  eventos = [],
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

  // Guarda bloco rico de presenças por turma { datas: string[], usuarios: [{ id, nome, cpf, presencas: [{data, presente}]}] }
  const [presencasPorTurma, setPresencasPorTurma] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);

  // helpers locais
  const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
  const hhmm = (s, fb = "00:00") =>
    typeof s === "string" && /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : fb;
  const isSameYMD = (a, b) => ymd(a) === ymd(b);

  async function carregarPresencas(turmaId) {
    try {
      console.log("🔄 Carregando presenças da turma", turmaId, "...");
      const data = await apiGet(`/api/presencas/turma/${turmaId}/detalhes`, { on403: "silent" });

      const datas = Array.isArray(data?.datas) ? data.datas : [];
      const usuarios = Array.isArray(data?.usuarios) ? data.usuarios : [];

      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: { datas, usuarios } }));
    } catch (err) {
      console.error("❌ Erro ao carregar presenças:", err);
      toast.error("Erro ao carregar presenças.");
      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: { datas: [], usuarios: [] } }));
    }
  }

  async function confirmarPresenca(dataSelecionada, turmaId, usuarioId, nome) {
    const confirmado = window.confirm(
      `Confirmar presença de ${nome} em ${formatarDataBrasileira(dataSelecionada)}?`
    );
    if (!confirmado) return;

    try {
      await apiPost(`/api/presencas/confirmar-simples`, {
        turma_id: turmaId,
        usuario_id: usuarioId,
        data: dataSelecionada,
      });

      toast.success("✅ Presença confirmada com sucesso.");
      await carregarPresencas(turmaId);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      const erroMsg = err?.message || "Erro ao confirmar presença.";
      console.error(`❌ Falha na confirmação de presença:`, err);
      toast.error(`❌ ${erroMsg}`);
    }
  }

  // --- helpers p/ ordenar por data_fim DESC (mais recente primeiro)
const keyFimTurma = (t) => {
  const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
  const hhmm = (s, fb = "23:59") =>
    typeof s === "string" && /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : fb;

  const df = ymd(t?.data_fim);
  const hf = hhmm(t?.horario_fim, "23:59");
  const di = ymd(t?.data_inicio);

  // Preferir data_fim+horario_fim; se não houver, usar data_inicio como fallback.
  if (df) return new Date(`${df}T${hf}:00`).getTime();
  if (di) return new Date(`${di}T23:59:59`).getTime();

  return -Infinity; // turmas sem datas vão pro fim
};

const ordenarTurmasPorMaisNovo = (a, b) => keyFimTurma(b) - keyFimTurma(a);

// Para ordenar os eventos pelo "mais novo" entre suas turmas
const keyEventoMaisNovo = (ev) => Math.max(...(ev?.turmas || []).map(keyFimTurma), -Infinity);
const ordenarEventosPorMaisNovo = (a, b) => keyEventoMaisNovo(b) - keyEventoMaisNovo(a);


  return (
    <div className="grid grid-cols-1 gap-8">
      <AnimatePresence>
  {eventos
    .slice() // não mutar a prop
    .sort(ordenarEventosPorMaisNovo) // ← eventos por turma mais recente
    .map((evento) => (
      <div key={evento.evento_id ?? evento.id}>
        <h2 className="text-xl font-bold text-lousa dark:text-white mb-4">
          📘 Evento: {evento.titulo}
        </h2>

            {(evento.turmas || [])
              .filter((t) => t && t.id)
              .map((turma) => {
                // ---------- Datas/Horários no nível da turma (robustos) ----------
                const hojeISO = formatarParaISO(hoje);
                const agora = new Date();

                const di = ymd(turma.data_inicio);
                const df = ymd(turma.data_fim);
                const hi = hhmm(turma.horario_inicio, "08:00");
                const hf = hhmm(turma.horario_fim, "17:00");

                const inicioDT = di ? new Date(`${di}T${hi}:00`) : null;
                const fimDT = df ? new Date(`${df}T${hf}:00`) : null;

                const inicioValido = inicioDT && !Number.isNaN(inicioDT.getTime());
                const fimValido = fimDT && !Number.isNaN(fimDT.getTime());

                let status = "Desconhecido";
                if (inicioValido && fimValido) {
                  status = agora < inicioDT ? "Agendada" : agora > fimDT ? "Realizada" : "Em andamento";
                }

                const statusClasse =
                  status === "Em andamento"
                    ? "bg-green-100 text-green-700 dark:bg-green-700 dark:text-white"
                    : status === "Realizada"
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-700 dark:text-white"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";

                const estaExpandida = turmaExpandidaId === turma.id;

                // intervalo “fallback” só se a API não mandar as datas do bloco
                const inicioNoon = di ? new Date(`${di}T12:00:00`) : null;
                const fimNoon = df ? new Date(`${df}T12:00:00`) : null;
                const datasFallback =
                  inicioNoon && fimNoon ? gerarIntervaloDeDatas(inicioNoon, fimNoon) : [];

                // limite global para confirmação admin: até 15 dias após o término (se válido)
                const fimMais15 =
                  fimValido ? new Date(fimDT.getTime() + 15 * 24 * 60 * 60 * 1000) : null;

                // bloco rico (se já carregado)
                const bloco = presencasPorTurma[turma.id];

                // datas a exibir na grade: preferir as vindas da API; senão, fallback
                const datasGrade =
                  Array.isArray(bloco?.datas) && bloco.datas.length
                    ? bloco.datas.map((d) => new Date(`${ymd(d)}T12:00:00`))
                    : datasFallback;

                return (
                  <motion.div
                    key={turma.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border p-4 rounded-2xl bg-white dark:bg-gray-900 shadow-sm flex flex-col mb-6"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-md font-semibold text-[#1b4332] dark:text-green-200">
                        {turma.nome}
                      </h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${statusClasse}`}>
                        {status}
                      </span>
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-300">
                      {formatarDataBrasileira(di || turma.data_inicio)} a{" "}
                      {formatarDataBrasileira(df || turma.data_fim)}
                    </p>

                    {modoadministradorPresencas && (
                      <div className="flex justify-end">
                        <BotaoPrimario
                          onClick={() => {
                            const novaTurma = estaExpandida ? null : turma.id;
                            if (!estaExpandida) {
                              console.log("📅 Expandindo turma", turma.id);
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

                            // usuário dentro do bloco (se houver)
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
                                      <th className="py-2 px-2 w-1/3 font-medium whitespace-nowrap">
                                        📅 Data
                                      </th>
                                      <th className="py-2 px-2 w-1/3 font-medium whitespace-nowrap">
                                        🟡 Situação
                                      </th>
                                      <th className="py-2 px-2 w-1/3 font-medium whitespace-nowrap">
                                        ✔️ Ações
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {datasGrade.map((dataObj) => {
                                      const dataISO = formatarParaISO(dataObj); // yyyy-mm-dd

                                      // presença do usuário naquele dia
                                      const estaPresente = Array.isArray(usuarioBloco?.presencas)
                                        ? usuarioBloco.presencas.some(
                                            (p) =>
                                              String(p?.usuario_id ?? usuarioBloco.id) ===
                                                String(usuarioId) &&
                                              p?.presente === true &&
                                              isSameYMD(p?.data, dataISO)
                                          )
                                        : false;

                                      // janela: abre 60 min após o início do dia; fecha 15 dias após o fim
                                      const inicioAulaDT = new Date(`${dataISO}T${hi}`);
                                      const abreJanela = new Date(
                                        inicioAulaDT.getTime() + 60 * 60 * 1000
                                      );
                                      const now = new Date();
                                      const antesDaJanela = now < abreJanela;
                                      const dentroDaJanela =
                                        fimMais15 ? now >= abreJanela && now <= fimMais15 : false;

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
                                        <tr key={`${usuarioId}-${dataISO}`} className="border-t">
                                          <td className="py-1 px-2 text-left">
                                            {formatarDataBrasileira(dataISO)}
                                          </td>
                                          <td className="py-1 px-2 text-left">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusClasse}`}>
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
                                              >
                                                Confirmar
                                              </button>
                                            ) : (
                                              <span className="text-gray-400 text-xs">—</span>
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
