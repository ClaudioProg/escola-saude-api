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
import { Trash2, CalendarDays, Clock, FileText } from "lucide-react";

/* ───────────────── Helpers ───────────────── */
const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const hhmm = (s, fb = "00:00") =>
  typeof s === "string" && /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : fb;
const isSameYMD = (a, b) => ymd(a) === ymd(b);

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

/* Barrinha colorida */
function barByStatus(status) {
  if (status === "Em andamento")
    return "bg-gradient-to-r from-amber-700 via-amber-600 to-amber-400";
  if (status === "Encerrado")
    return "bg-gradient-to-r from-rose-800 via-rose-700 to-rose-500";
  return "bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-500"; // Programado
}

/* datetime → dd/mm/yyyy HH:mm */
function formatarDataHoraBR(v) {
  if (!v) return "";
  let d = null;

  if (v instanceof Date && !isNaN(v)) d = v;
  else if (typeof v === "number") d = new Date(v);
  else if (typeof v === "string") {
    // normaliza "YYYY-MM-DD HH:mm:ss" → "YYYY-MM-DDTHH:mm:ss"
    const s = v.includes("T") ? v : v.replace(" ", "T");
    const try1 = new Date(s);
    if (!isNaN(try1)) d = try1;
    else {
      // caso venha só "HH:mm" junto com uma data; deixamos para quem chama montar
      return "";
    }
  }
  if (!d || isNaN(d)) return "";

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const HH = String(d.getHours()).padStart(2, "0");
  const MM = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${HH}:${MM}`;
}

/* ───────────────── Componente ───────────────── */
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
  agrupamento = "pessoa", // "pessoa" | "data"
}) {
  const [turmaExpandidaId, setTurmaExpandidaId] = useState(null);
  const [presencasPorTurma, setPresencasPorTurma] = useState({}); // { [id]: { datas:[], usuarios:[] } }
  const [carregandoTurmas, setCarregandoTurmas] = useState(() => new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  // visão "data"
  const [dataAtivaPorTurma, setDataAtivaPorTurma] = useState({}); // { [turmaId]: "YYYY-MM-DD" }
  const [somenteSemPresencaPorTurma, setSomenteSemPresencaPorTurma] = useState({}); // { [turmaId]: bool }

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

      try {
        const viaDatas = await apiGet(`/api/datas/turma/${turmaId}?via=datas`, { on403: "silent" });
        const arr = Array.isArray(viaDatas) ? viaDatas : [];
        datas = arr.map(pickDate).filter(Boolean);
      } catch {}

      if (!datas.length) {
        try {
          const viaPres = await apiGet(`/api/datas/turma/${turmaId}?via=presencas`, { on403: "silent" });
          const arr2 = Array.isArray(viaPres) ? viaPres : [];
          datas = arr2.map(pickDate).filter(Boolean);
        } catch {}
      }

      if (!datas.length) {
        const arr3 = Array.isArray(detalhes?.datas) ? detalhes.datas : [];
        datas = arr3.map((d) => (typeof d === "string" ? d.slice(0, 10) : null)).filter(Boolean);
      }

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

  function montarDatasGrade(turma, bloco, datasFallback) {
    const baseHi = hhmm(turma.horario_inicio, "08:00");
    const baseHf = hhmm(turma.horario_fim, "17:00");

    if (Array.isArray(bloco?.datas) && bloco.datas.length) {
      return bloco.datas
        .map((d) => ({ dataISO: ymd(d), hi: baseHi, hf: baseHf }))
        .filter((x) => x.dataISO);
    }

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

    return (datasFallback || []).map((d) => ({
      dataISO: formatarParaISO(d),
      hi: baseHi,
      hf: baseHf,
    }));
  }

  /* ===== Render ===== */
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
                const agora = new Date();

                const di = ymd(turma.data_inicio);
                const df = ymd(turma.data_fim);
                const hi = hhmm(turma.horario_inicio, "08:00");
                const hf = hhmm(turma.horario_fim, "17:00");

                const inicioDT = di ? new Date(`${di}T${hi}:00`) : null;
                const fimDT = df ? new Date(`${df}T${hf}:00`) : null;

                let status = "Desconhecido";
                if (inicioDT && fimDT) {
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

                const inicioNoon = di ? new Date(`${di}T12:00:00`) : null;
                const fimNoon = df ? new Date(`${df}T12:00:00`) : null;
                const datasFallback =
                  inicioNoon && fimNoon ? gerarIntervaloDeDatas(inicioNoon, fimNoon) : [];

                const bloco = presencasPorTurma[turma.id];
                const datasGrade = montarDatasGrade(turma, bloco, datasFallback);
                const isLoadingTurma = carregandoTurmas.has(String(turma.id));

                // visão por data
                const datasVisaoData = (presencasPorTurma[turma.id]?.datas || []).slice().sort();
                const usuariosVisaoData = presencasPorTurma[turma.id]?.usuarios || [];

                function exportarCSVDataAtiva(turmaId, dataYMD, mapaUsuarios) {
                  // Excel PT-BR: separador ; e BOM para acentuação
                  const SEP = ";";
                  const BOM = "\uFEFF";
                
                  // Cabeçalho com a nova coluna
                  const header = ["Nome", "CPF", "Status", "Confirmado em"].join(SEP);
                  const rows = [];
                
                  for (const u of mapaUsuarios.values()) {
                    // info da presença para a data ativa
                    const prObj = u.presencas.get(dataYMD);
                    const presente = !!(prObj && prObj.presente);
                
                    // Status textual igual ao da tabela
                    const statusTxt = presente ? "Presente" : "Sem presença";
                
                    // Data/Hora de confirmação — formata dd/mm/aaaa HH:mm (TZ Brasil)
                    let confirmadoStr = "";
                    if (presente && prObj?.confirmadoEm) {
                      // usa o helper do topo do arquivo
                      confirmadoStr = formatarDataHoraBR(prObj.confirmadoEm) || "";
                      // fallback: se backend mandou só "HH:mm"
                      if (!confirmadoStr && typeof prObj.confirmadoEm === "string" && /^\d{2}:\d{2}/.test(prObj.confirmadoEm)) {
                        confirmadoStr = `${formatarDataBrasileira(dataYMD)} ${prObj.confirmadoEm.slice(0,5)}`;
                      }
                    }
                
                    // Escapa aspas para CSV
                    const nome = String(u.nome ?? "").replace(/"/g, '""');
                    const cpf  = String(formatarCPF(u.cpf) || u.cpf || "").replace(/"/g, '""');
                    const conf = String(confirmadoStr).replace(/"/g, '""');
                
                    rows.push([`"${nome}"`, `"${cpf}"`, `"${statusTxt}"`, `"${conf}"`].join(SEP));
                  }
                
                  const csv = [header, ...rows].join("\r\n");
                  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `presencas_${turmaId}_${dataYMD}.csv`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                }
        

                // monta objeto {presente, confirmadoEm} a partir de um registro p
                function toPresencaInfo(p, dataYMD) {
                  const presente = !!p?.presente;
                  // pega vários campos comuns de timestamp
                  let ts =
                    p?.confirmado_em ||
                    p?.data_confirmacao ||
                    p?.data_hora ||
                    p?.momento ||
                    p?.timestamp ||
                    p?.created_at ||
                    p?.updated_at ||
                    null;
                  // se vier apenas "hora", monta YYYY-MM-DDTHH:mm:00
                  if (!ts && typeof p?.hora === "string") {
                    const h = hhmm(p.hora);
                    if (h) ts = `${dataYMD}T${h}:00`;
                  }
                  return { presente, confirmadoEm: ts || null };
                }

                return (
                  <motion.div
                    key={turma.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="relative border p-4 rounded-2xl bg-white dark:bg-gray-900 shadow-sm flex flex-col mb-6 overflow-hidden"
                    aria-labelledby={`turma-${turma.id}-titulo`}
                  >
                    {/* Barrinha superior */}
                    <div className={`absolute top-0 left-0 right-0 h-1.5 ${barByStatus(status)}`} aria-hidden="true" />

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

                        {mostrarBotaoRemover && (
                          <button
                            type="button"
                            onClick={() => removerTurma(turma.id, turma.nome)}
                            disabled={removendoId === turma.id}
                            title="Remover turma"
                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs
                                       hover:bg-red-50 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                            aria-disabled={removendoId === turma.id}
                            aria-label={removendoId === turma.id ? "Removendo turma…" : `Remover turma ${turma.nome}`}
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
                              if (datasVisaoData.length) {
                                setDataAtivaPorTurma((p) => ({ ...p, [turma.id]: datasVisaoData[0] }));
                              }
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
                        {isLoadingTurma && (
                          <div className="animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800 h-24 mb-4" aria-live="polite" />
                        )}

                        {!isLoadingTurma && (
                          <>
                            {/* ======= POR PESSOA ======= */}
                            {agrupamento === "pessoa" && (
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
                                              <th className="py-2 px-2 w-1/3 font-medium whitespace-nowrap">📅 Data</th>
                                              <th className="py-2 px-2 w-1/3 font-medium whitespace-nowrap">🟡 Situação</th>
                                              <th className="py-2 px-2 w-1/3 font-medium whitespace-nowrap">✔️ Ações</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {datasGrade.map((item) => {
                                              const dataISO = item.dataISO;
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
                                                  <td className="py-1 px-2 text-left">{formatarDataBrasileira(dataISO)}</td>
                                                  <td className="py-1 px-2 text-left">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusClasse}`}>
                                                      {statusTexto}
                                                    </span>
                                                  </td>
                                                  <td className="py-1 px-2 text-left">
                                                    {podeConfirmar && !antesDaJanela ? (
                                                      <button
                                                        onClick={() =>
                                                          confirmarPresenca(dataISO, turma.id, usuarioId, i.nome)
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

                            {/* ======= POR DATA ======= */}
                            {agrupamento === "data" && (
                              <>
                                {datasVisaoData.length === 0 ? (
                                  <p className="text-sm text-gray-600 dark:text-gray-300">
                                    Nenhuma data registrada para esta turma.
                                  </p>
                                ) : (
                                  (() => {
                                    const dataAtiva = dataAtivaPorTurma[turma.id] || datasVisaoData[0];

                                    // mapa de usuários: presencas.set(data, {presente, confirmadoEm})
                                    const alunos = inscritosPorTurma[turma.id] || [];
                                    const det = presencasPorTurma[turma.id] || { usuarios: [] };

                                    const mapaUsuarios = new Map();
                                    for (const a of alunos) {
                                      const uid = a?.usuario_id ?? a?.id;
                                      if (!uid) continue;
                                      mapaUsuarios.set(uid, { id: uid, nome: a?.nome || "—", cpf: a?.cpf || "", presencas: new Map() });
                                    }
                                    for (const u of (det.usuarios || [])) {
                                      const uid = u?.id ?? u?.usuario_id;
                                      if (!uid || !mapaUsuarios.has(uid)) continue;
                                      const alvo = mapaUsuarios.get(uid);
                                      (u.presencas || []).forEach((p) => {
                                        const d = ymd(p?.data_presenca || p?.data);
                                        if (!d) return;
                                        alvo.presencas.set(d, toPresencaInfo(p, d));
                                      });
                                    }

                                    const dGrade = datasGrade.find((x) => x.dataISO === dataAtiva);
                                    const hiDia = dGrade?.hi || hi;
                                    const hfDia = dGrade?.hf || hf;

                                    const inicioDia = new Date(`${dataAtiva}T${hiDia}:00`);
                                    const abreJanela = new Date(inicioDia.getTime() + 60 * 60 * 1000);
                                    const agoraLocal = new Date();
                                    const antesDaJanela = agoraLocal < abreJanela;

                                    const totalInscritos = mapaUsuarios.size;
                                    let presentes = 0, faltas = 0, aguardando = 0;
                                    for (const u of mapaUsuarios.values()) {
                                      const info = u.presencas.get(dataAtiva);
                                      const pr = !!(info && info.presente);
                                      if (pr) presentes += 1;
                                      else if (antesDaJanela) aguardando += 1;
                                      else faltas += 1;
                                    }

                                    const soPend = !!somenteSemPresencaPorTurma[turma.id];
                                    const listaUsuarios = Array.from(mapaUsuarios.values()).filter((u) => {
                                      if (!soPend) return true;
                                      const info = u.presencas.get(dataAtiva);
                                      return !(info && info.presente);
                                    });

                                    return (
                                      <section className="rounded-xl bg-white dark:bg-zinc-900/40 ring-1 ring-zinc-200 dark:ring-zinc-800">
                                        {/* abas de datas */}
                                        <div className="flex flex-wrap gap-2 px-4 mb-3">
                                          {datasVisaoData.map((d) => {
                                            const active = d === dataAtiva;
                                            return (
                                              <button
                                                key={d}
                                                type="button"
                                                onClick={() => setDataAtivaPorTurma((p) => ({ ...p, [turma.id]: d }))}
                                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition
                                                  ${active ? "bg-violet-700 text-white border-violet-700"
                                                    : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                                              >
                                                {d.split("-").reverse().join("/")}
                                              </button>
                                            );
                                          })}
                                        </div>

                                        {/* header resumo + ações */}
                                        <header className="px-4 pb-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                          <div className="flex items-center gap-3">
                                            <CalendarDays className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                                            <div>
                                              <h4 className="text-sm font-semibold">
                                                {dataAtiva.split("-").reverse().join("/")}
                                              </h4>
                                              <div className="text-xs text-zinc-600 dark:text-zinc-300">
                                                <Clock className="inline w-3.5 h-3.5 mr-1" />
                                                {hiDia}–{hfDia}
                                              </div>
                                              {antesDaJanela && (
                                                <div className="text-[11px] text-amber-600 dark:text-amber-300 mt-1">
                                                  Confirmação manual libera ~1h após o início da aula.
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          <div className="ml-0 sm:ml-auto flex flex-wrap items-center gap-2">
                                            {[
                                              ["inscritos", totalInscritos],
                                              ["presentes", presentes, "text-emerald-600 dark:text-emerald-400"],
                                              ["faltas", faltas, "text-rose-600 dark:text-rose-400"],
                                              ["aguardando", aguardando, "text-amber-600 dark:text-amber-400"],
                                            ].map(([lbl, n, cls]) => (
                                              <div key={lbl} className="min-w-[82px]">
                                                <div className="inline-flex flex-col items-center justify-center px-3 py-2 rounded-xl border border-zinc-200 bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-700">
                                                  <div className={`leading-none font-extrabold text-2xl sm:text-3xl ${cls || ""}`}>{n}</div>
                                                  <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{lbl}</div>
                                                </div>
                                              </div>
                                            ))}

                                            <button
                                              onClick={() => exportarCSVDataAtiva(turma.id, dataAtiva, mapaUsuarios)}
                                              className="inline-flex items-center gap-2 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-900 dark:text-slate-100 text-xs px-3 py-1.5 rounded-lg"
                                              title="Exportar CSV da data ativa"
                                            >
                                              <FileText className="w-4 h-4" />
                                              Exportar CSV
                                            </button>
                                          </div>
                                        </header>

                                        {/* filtros e tabela */}
                                        <div className="px-4 pb-4">
                                          <div className="mb-2 flex items-center justify-between">
                                            <label className="inline-flex items-center gap-2 text-xs">
                                              <input
                                                type="checkbox"
                                                checked={!!somenteSemPresencaPorTurma[turma.id]}
                                                onChange={(e) =>
                                                  setSomenteSemPresencaPorTurma((p) => ({ ...p, [turma.id]: e.target.checked }))
                                                }
                                              />
                                              Mostrar apenas sem presença
                                            </label>
                                            <div className="text-xs text-zinc-500">
                                              {listaUsuarios.length} de {totalInscritos} exibidos
                                            </div>
                                          </div>

                                          <div className="overflow-x-auto">
                                            <table className="min-w-full text-sm table-fixed">
                                              <thead>
                                                <tr className="text-left text-zinc-600 dark:text-zinc-300">
                                                  <th className="py-2 pr-4 w-[32%]">👤 Nome</th>
                                                  <th className="py-2 pr-4 w-[18%]">CPF</th>
                                                  <th className="py-2 pr-4 w-[20%]">Situação</th>
                                                  <th className="py-2 pr-4 w-[20%]">Confirmado em</th>{/* ⬅️ NOVO */}
                                                  <th className="py-2 pr-4 w-[10%]">Ações</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {listaUsuarios.map((u) => {
                                                  const info = u.presencas.get(dataAtiva);
                                                  const presente = !!(info && info.presente);
                                                  const statusTxt = presente ? "Presente" : (antesDaJanela ? "Aguardando" : "Faltou");

                                                  // monta string dd/mm/yyyy HH:mm a partir de info.confirmadoEm
                                                  let confirmadoStr = "—";
                                                  if (presente && info?.confirmadoEm) {
                                                    confirmadoStr = formatarDataHoraBR(info.confirmadoEm) || "—";
                                                    // fallback: se veio só HH:mm no backend
                                                    if (confirmadoStr === "—" && typeof info.confirmadoEm === "string" && /^\d{2}:\d{2}/.test(info.confirmadoEm)) {
                                                      confirmadoStr = `${formatarDataBrasileira(dataAtiva)} ${info.confirmadoEm.slice(0,5)}`;
                                                    }
                                                  }

                                                  return (
                                                    <tr key={`${u.id}-${dataAtiva}`} className="border-t border-zinc-200 dark:border-zinc-800">
                                                      <td className="py-2 pr-4 whitespace-nowrap overflow-hidden text-ellipsis">{u.nome}</td>
                                                      <td className="py-2 pr-4 whitespace-nowrap">{formatarCPF(u.cpf) || u.cpf || "—"}</td>
                                                      <td className="py-2 pr-4">{statusTxt}</td>
                                                      <td className="py-2 pr-4">{confirmadoStr}</td>
                                                      <td className="py-2 pr-4">
                                                        {!presente && !antesDaJanela ? (
                                                          <button
                                                            onClick={() => confirmarPresenca(dataAtiva, turma.id, u.id, u.nome)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/40"
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
                                      </section>
                                    );
                                  })()
                                )}
                              </>
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
  agrupamento: PropTypes.oneOf(["pessoa", "data"]),
};
