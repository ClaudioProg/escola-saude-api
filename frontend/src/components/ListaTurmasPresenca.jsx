// ✅ src/components/ListaTurmasPresenca.jsx (Premium + sem window.confirm + bugfix pad2)
/* eslint-disable no-console */
import { useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import BotaoPrimario from "./BotaoPrimario";
import ModalConfirmacao from "./ModalConfirmacao";
import { toast } from "react-toastify";
import {
  formatarDataBrasileira,
  gerarIntervaloDeDatas,
  formatarCPF,
  formatarParaISO,
} from "../utils/data";
import { apiGet, apiPost, apiDelete } from "../services/api";
import {
  Trash2,
  CalendarDays,
  Clock,
  FileText,
  Users,
  ChevronDown,
  ChevronUp,
  BadgeCheck,
} from "lucide-react";

/* ===== abre 30min antes do início ===== */
const MINUTOS_ANTECIPACAO = 30;

/* ================= Helpers ================= */
function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}
const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const hhmm = (s, fb = "00:00") =>
  typeof s === "string" && /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : fb;
const isSameYMD = (a, b) => ymd(a) === ymd(b);
const isDateOnly = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

function toLocalDateFromYMDTime(dateOnly, timeHHmm = "12:00") {
  if (!isDateOnly(dateOnly)) return null;
  const [Y, M, D] = dateOnly.split("-").map(Number);
  const [h, m] = String(timeHHmm || "12:00")
    .slice(0, 5)
    .split(":")
    .map((x) => Number(x));
  const HH = Number.isFinite(h) ? h : 12;
  const MM = Number.isFinite(m) ? m : 0;
  return new Date(Y, (M || 1) - 1, D || 1, HH, MM, 0, 0);
}

function addMinutes(dt, min) {
  return dt ? new Date(dt.getTime() + min * 60 * 1000) : null;
}
function addDays(dt, days) {
  return dt ? new Date(dt.getTime() + days * 24 * 60 * 60 * 1000) : null;
}

function getStatusPorJanela({ di, df, hi, hf, agora = new Date() }) {
  const start = toLocalDateFromYMDTime(di, hi || "00:00");
  const end = toLocalDateFromYMDTime(df, hf || "23:59");
  if (!start || !end || Number.isNaN(+start) || Number.isNaN(+end)) return "Programado";
  if (agora < start) return "Programado";
  if (agora > end) return "Encerrado";
  return "Em andamento";
}

/* Barrinha colorida (padrão global) */
function barByStatus(status) {
  if (status === "Em andamento") return "bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300";
  if (status === "Encerrado") return "bg-gradient-to-r from-rose-600 via-rose-500 to-red-400";
  return "bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400"; // Programado
}

function statusPill(status) {
  const base = "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold border";
  if (status === "Em andamento")
    return cls(base, "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800");
  if (status === "Encerrado")
    return cls(base, "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/20 dark:text-rose-200 dark:border-rose-800");
  return cls(base, "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-200 dark:border-emerald-800");
}

/* datetime → dd/mm/yyyy HH:mm */
function formatarDataHoraBR(v) {
  if (!v) return "";
  let d = null;

  if (v instanceof Date && !Number.isNaN(+v)) d = v;
  else if (typeof v === "number") d = new Date(v);
  else if (typeof v === "string") {
    const s = v.includes("T") ? v : v.replace(" ", "T");
    const try1 = new Date(s);
    if (!Number.isNaN(+try1)) d = try1;
    else return "";
  }

  if (!d || Number.isNaN(+d)) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const HH = String(d.getHours()).padStart(2, "0");
  const MM = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${HH}:${MM}`;
}

/* Ordenadores */
const keyFimTurma = (t) => {
  const df = ymd(t?.data_fim);
  const hf = hhmm(t?.horario_fim, "23:59");
  const di = ymd(t?.data_inicio);
  if (df) return toLocalDateFromYMDTime(df, hf)?.getTime?.() ?? -Infinity;
  if (di) return toLocalDateFromYMDTime(di, "23:59")?.getTime?.() ?? -Infinity;
  return -Infinity;
};
const ordenarTurmasPorMaisNovo = (a, b) => keyFimTurma(b) - keyFimTurma(a);
const keyEventoMaisNovo = (ev) => Math.max(...(ev?.turmas || []).map(keyFimTurma), -Infinity);
const ordenarEventosPorMaisNovo = (a, b) => keyEventoMaisNovo(b) - keyEventoMaisNovo(a);

/* Export CSV (data ativa) */
function exportarCSVDataAtiva(turmaId, dataYMD, mapaUsuarios) {
  const SEP = ";";
  const BOM = "\uFEFF";
  const header = ["Nome", "CPF", "Status", "Confirmado em"].join(SEP);
  const rows = [];

  for (const u of mapaUsuarios.values()) {
    const prObj = u.presencas.get(dataYMD);
    const presente = !!(prObj && prObj.presente);
    const statusTxt = presente ? "Presente" : "Sem presença";

    let confirmadoStr = "";
    if (presente && prObj?.confirmadoEm) {
      confirmadoStr = formatarDataHoraBR(prObj.confirmadoEm) || "";
      if (!confirmadoStr && typeof prObj.confirmadoEm === "string" && /^\d{2}:\d{2}/.test(prObj.confirmadoEm)) {
        confirmadoStr = `${formatarDataBrasileira(dataYMD)} ${prObj.confirmadoEm.slice(0, 5)}`;
      }
    }

    const nome = String(u.nome ?? "").replace(/"/g, '""');
    const cpf = String(formatarCPF(u.cpf) || u.cpf || "").replace(/"/g, '""');
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

/* monta objeto {presente, confirmadoEm} a partir de um registro p */
function toPresencaInfo(p, dataYMD) {
  const presente = !!p?.presente;
  let ts =
    p?.confirmado_em ||
    p?.data_confirmacao ||
    p?.data_hora ||
    p?.momento ||
    p?.timestamp ||
    p?.created_at ||
    p?.updated_at ||
    null;

  if (!ts && typeof p?.hora === "string") {
    const h = hhmm(p.hora);
    if (h) ts = `${dataYMD}T${h}:00`;
  }
  return { presente, confirmadoEm: ts || null };
}

/* ========================== Componente ========================== */
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

  // { [id]: { datas:[], usuarios:[] } }
  const [presencasPorTurma, setPresencasPorTurma] = useState({});
  const [carregandoTurmas, setCarregandoTurmas] = useState(() => new Set());

  // loading por confirmação (turma#usuario#data)
  const [confirmandoKey, setConfirmandoKey] = useState(null);

  // visão "data"
  const [dataAtivaPorTurma, setDataAtivaPorTurma] = useState({});
  const [somenteSemPresencaPorTurma, setSomenteSemPresencaPorTurma] = useState({});

  // exclusão
  const [removendoId, setRemovendoId] = useState(null);
  const [idsRemovidos, setIdsRemovidos] = useState(() => new Set());

  // MODAIS premium (sem window.confirm)
  const [confirmPresenca, setConfirmPresenca] = useState(null); // {dataYMD, turmaId, usuarioId, nome}
  const [confirmRemover, setConfirmRemover] = useState(null); // {turmaId, turmaNome}

  const eventosOrdenados = useMemo(() => eventos.slice().sort(ordenarEventosPorMaisNovo), [eventos]);

  const carregarPresencas = useCallback(async (turmaId) => {
    const markLoading = (on) =>
      setCarregandoTurmas((prev) => {
        const next = new Set(prev);
        if (on) next.add(String(turmaId));
        else next.delete(String(turmaId));
        return next;
      });

    // ✅ robusto: extrai "YYYY-MM-DD" de string, objeto {data}, etc.
    const pickDate = (x) => {
      if (!x) return null;
      if (typeof x === "string") return ymd(x);
      if (typeof x?.data === "string") return ymd(x.data);
      return null;
    };

    try {
      markLoading(true);

      const detalhes = await apiGet(`/api/presencas/turma/${turmaId}/detalhes`, { on403: "silent" });
      const usuarios = Array.isArray(detalhes?.usuarios) ? detalhes.usuarios : [];
      let datas = [];

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
        datas = arr3.map(pickDate).filter(Boolean);
      }

      datas = Array.from(new Set(datas)).sort();

      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: { datas, usuarios } }));

      // ✅ inicializa data ativa (visão "data") após carregar — sem depender do render anterior
      setDataAtivaPorTurma((prev) => {
        if (prev[turmaId]) return prev;
        if (!datas.length) return prev;
        return { ...prev, [turmaId]: datas[0] };
      });
    } catch (err) {
      console.error("❌ Erro ao carregar presenças:", err);
      toast.error("Erro ao carregar presenças.");
      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: { datas: [], usuarios: [] } }));
    } finally {
      markLoading(false);
    }
  }, []);

  async function removerTurmaAgora({ turmaId, turmaNome }) {
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
      return true;
    } catch (err) {
      const code = err?.data?.erro;
      if (err?.status === 409 || code === "TURMA_COM_REGISTROS") {
        const c = err?.data?.contagens || {};
        toast.error(`Não é possível excluir: ${c.presencas || 0} presenças / ${c.certificados || 0} certificados.`);
      } else if (err?.status === 404) {
        toast.warn("Turma não encontrada. Atualize a página.");
      } else {
        toast.error("Erro ao remover turma.");
      }
      console.error("[removerTurma] erro:", err);
      return false;
    } finally {
      setRemovendoId(null);
    }
  }

  async function confirmarPresencaAgora({ dataYMD, turmaId, usuarioId, nome }) {
    const key = `${turmaId}#${usuarioId}#${dataYMD}`;
    if (confirmandoKey) return false;

    try {
      setConfirmandoKey(key);
      await apiPost(`/api/presencas/confirmar-simples`, {
        turma_id: turmaId,
        usuario_id: usuarioId,
        data: dataYMD,
      });

      toast.success("✅ Presença confirmada com sucesso.");
      await carregarPresencas(turmaId);
      return true;
    } catch (err) {
      const st = err?.status ?? err?.response?.status;
      if (st === 409 || st === 208) {
        toast.success("✅ Presença já estava confirmada.");
        await carregarPresencas(turmaId);
        return true;
      }
      const erroMsg =
        err?.data?.erro ||
        err?.response?.data?.mensagem ||
        err?.data?.message ||
        err?.message ||
        "Erro ao confirmar presença.";
      console.error("❌ Falha na confirmação de presença:", err);
      toast.error(`❌ ${erroMsg}`);
      return false;
    } finally {
      setConfirmandoKey(null);
    }
  }

  function montarDatasGrade(turma, bloco, datasFallback) {
    const baseHi = hhmm(turma?.horario_inicio, "08:00");
    const baseHf = hhmm(turma?.horario_fim, "17:00");

    // 1) bloco rico
    if (Array.isArray(bloco?.datas) && bloco.datas.length) {
      return bloco.datas.map((d) => ({ dataISO: ymd(d), hi: baseHi, hf: baseHf })).filter((x) => x.dataISO);
    }

    // 2) datas_turma
    if (Array.isArray(turma?.datas) && turma.datas.length) {
      return turma.datas
        .map((d) => ({
          dataISO: ymd(d?.data || d),
          hi: hhmm(d?.horario_inicio, baseHi),
          hf: hhmm(d?.horario_fim, baseHf),
        }))
        .filter((x) => x.dataISO);
    }

    // 3) encontros
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

    // 4) fallback intervalo
    return (datasFallback || []).map((d) => ({
      dataISO: formatarParaISO(d),
      hi: baseHi,
      hf: baseHf,
    }));
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-8" role="region" aria-label="Gestão de presenças por turmas">
        <AnimatePresence>
          {eventosOrdenados.map((evento) => {
            const eventoId = evento.evento_id ?? evento.id;
            const turmasValidas = (evento.turmas || [])
              .filter((t) => t && t.id && !idsRemovidos.has(String(t.id)))
              .sort(ordenarTurmasPorMaisNovo);

            return (
              <motion.section
                key={eventoId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cls(
                  "rounded-3xl border border-zinc-200/80 dark:border-zinc-800",
                  "bg-white/70 dark:bg-zinc-900/40 backdrop-blur shadow-sm overflow-hidden"
                )}
              >
                <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 opacity-80" />
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-white break-words">
                        📘 Evento: {evento.titulo || "—"}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                        Turmas: {turmasValidas.length}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4">
                    {turmasValidas.map((turma) => {
                      const agora = hoje instanceof Date ? hoje : new Date();

                      const di = ymd(turma.data_inicio);
                      const df = ymd(turma.data_fim);
                      const hi = hhmm(turma.horario_inicio, "08:00");
                      const hf = hhmm(turma.horario_fim, "17:00");

                      const status = getStatusPorJanela({ di, df, hi, hf, agora });
                      const estaExpandida = turmaExpandidaId === turma.id;

                      // fallback datas (intervalo)
                      const inicioNoon = di ? toLocalDateFromYMDTime(di, "12:00") : null;
                      const fimNoon = df ? toLocalDateFromYMDTime(df, "12:00") : null;
                      const datasFallback = inicioNoon && fimNoon ? gerarIntervaloDeDatas(inicioNoon, fimNoon) : [];

                      const bloco = presencasPorTurma[turma.id];
                      const datasGrade = montarDatasGrade(turma, bloco, datasFallback);

                      const isLoadingTurma = carregandoTurmas.has(String(turma.id));

                      // visão por data
                      const datasVisaoData = (presencasPorTurma[turma.id]?.datas || []).slice().sort();
                      const alunos = inscritosPorTurma[turma.id] || [];
                      const det = presencasPorTurma[turma.id] || { usuarios: [] };

                      // ✅ fim da janela: fim da TURMA + 60 dias
                      const fimTurmaDT = df ? toLocalDateFromYMDTime(df, hf) : null;
                      const janelaFinal = addDays(fimTurmaDT, 60);

                      return (
                        <motion.div
                          key={turma.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className={cls(
                            "relative rounded-3xl border border-zinc-200/80 dark:border-zinc-800",
                            "bg-white dark:bg-zinc-950/30 shadow-sm overflow-hidden"
                          )}
                          aria-labelledby={`turma-${turma.id}-titulo`}
                        >
                          <div className={cls("absolute top-0 left-0 right-0 h-1.5", barByStatus(status))} aria-hidden="true" />

                          <div className="p-4 sm:p-5">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4
                                    id={`turma-${turma.id}-titulo`}
                                    className="text-base font-extrabold text-zinc-900 dark:text-white break-words"
                                  >
                                    {turma.nome || `Turma ${turma.id}`}
                                  </h4>
                                  <span className={statusPill(status)}>{status}</span>
                                </div>

                                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                                  <span className="inline-flex items-center gap-1">
                                    <CalendarDays size={14} aria-hidden="true" />
                                    {formatarDataBrasileira(di || turma.data_inicio)} a {formatarDataBrasileira(df || turma.data_fim)}
                                  </span>
                                  <span className="mx-2 opacity-50">•</span>
                                  <span className="inline-flex items-center gap-1">
                                    <Clock size={14} aria-hidden="true" />
                                    {hi}–{hf}
                                  </span>
                                </p>

                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold border
                                    bg-zinc-50 text-zinc-700 border-zinc-200
                                    dark:bg-zinc-900/25 dark:text-zinc-200 dark:border-zinc-800"
                                  >
                                    <Users size={14} aria-hidden="true" />
                                    {(inscritosPorTurma?.[turma.id] || []).length} inscrito(s)
                                  </span>

                                  <span className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold border
                                    bg-zinc-50 text-zinc-700 border-zinc-200
                                    dark:bg-zinc-900/25 dark:text-zinc-200 dark:border-zinc-800"
                                  >
                                    <CalendarDays size={14} aria-hidden="true" />
                                    {datasGrade.length} dia(s)
                                  </span>

                                  <span
                                    className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold border
                                      bg-zinc-50 text-zinc-700 border-zinc-200
                                      dark:bg-zinc-900/25 dark:text-zinc-200 dark:border-zinc-800"
                                    title="Libera 30min antes do início do encontro e vai até 60 dias após o fim da turma"
                                  >
                                    <BadgeCheck size={14} aria-hidden="true" />
                                    Janela: -30min até +60 dias
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {mostrarBotaoRemover && (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmRemover({ turmaId: turma.id, turmaNome: turma.nome })}
                                    disabled={removendoId === turma.id}
                                    className={cls(
                                      "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold",
                                      "border-rose-200 hover:bg-rose-50 active:scale-[0.98]",
                                      "dark:border-rose-900/40 dark:hover:bg-rose-900/20",
                                      "disabled:opacity-60 disabled:cursor-not-allowed"
                                    )}
                                    aria-label={removendoId === turma.id ? "Removendo turma…" : `Remover turma ${turma.nome}`}
                                  >
                                    <Trash2 size={14} />
                                    {removendoId === turma.id ? "Removendo..." : "Remover"}
                                  </button>
                                )}

                                {modoadministradorPresencas && typeof gerarRelatorioPDF === "function" && (
                                  <BotaoPrimario onClick={() => gerarRelatorioPDF?.(turma.id)} variant="secondary">
                                    Exportar PDF
                                  </BotaoPrimario>
                                )}

                                {modoadministradorPresencas && (
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
                                    className="rounded-xl"
                                    iconRight={estaExpandida ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  >
                                    {estaExpandida ? "Recolher" : "Ver detalhes"}
                                  </BotaoPrimario>
                                )}
                              </div>
                            </div>

                            <AnimatePresence>
                              {modoadministradorPresencas && estaExpandida && (
                                <motion.div
                                  id={`turma-${turma.id}-detalhes`}
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden mt-4"
                                >
                                  {isLoadingTurma ? (
                                    <div className="animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800 h-28" aria-live="polite" />
                                  ) : (
                                    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/40 p-4">
                                      {/* =================== POR PESSOA =================== */}
                                      {agrupamento === "pessoa" && (
                                        <>
                                          <div className="font-extrabold text-sm text-zinc-900 dark:text-white mb-2">
                                            Inscritos (por pessoa)
                                          </div>

                                          {(inscritosPorTurma[turma.id] || []).length === 0 ? (
                                            <p className="text-sm text-zinc-600 dark:text-zinc-300">
                                              Nenhum inscrito encontrado para esta turma.
                                            </p>
                                          ) : (
                                            <div className="grid grid-cols-1 gap-3">
                                              {(inscritosPorTurma[turma.id] || []).map((i) => {
                                                const usuarioId = i.usuario_id ?? i.id;
                                                const usuarioBloco = bloco?.usuarios?.find(
                                                  (u) => String(u.id) === String(usuarioId)
                                                );

                                                return (
                                                  <div
                                                    key={`${turma.id}#${usuarioId}`}
                                                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/30"
                                                  >
                                                    <div className="p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                                      <div className="min-w-0">
                                                        <div className="font-bold text-sm text-zinc-900 dark:text-white break-words">
                                                          {i.nome || "—"}
                                                        </div>
                                                        <div className="text-xs text-zinc-600 dark:text-zinc-300">
                                                          CPF: {formatarCPF(i.cpf) || "Não informado"}
                                                        </div>
                                                      </div>
                                                    </div>

                                                    {/* Mobile: cards */}
                                                    <div className="px-4 pb-4 grid gap-2 md:hidden">
                                                      {datasGrade.map(({ dataISO, hi: hiDia }) => {
                                                        const estaPresente = Array.isArray(usuarioBloco?.presencas)
                                                          ? usuarioBloco.presencas.some(
                                                              (p) =>
                                                                String(p?.usuario_id ?? usuarioBloco.id) === String(usuarioId) &&
                                                                p?.presente === true &&
                                                                isSameYMD(p?.data, dataISO)
                                                            )
                                                          : false;

                                                        const inicioAula = toLocalDateFromYMDTime(dataISO, hiDia || hi);
                                                        const abreJanela = addMinutes(inicioAula, -MINUTOS_ANTECIPACAO);
                                                        const now = new Date();

                                                        const antesDaJanela = abreJanela ? now < abreJanela : true;
                                                        const dentroDaJanela = abreJanela && janelaFinal
                                                          ? now >= abreJanela && now <= janelaFinal
                                                          : false;

                                                        const podeConfirmar = !estaPresente && dentroDaJanela;

                                                        const statusTxt = estaPresente
                                                          ? "Presente"
                                                          : antesDaJanela
                                                            ? "Aguardando"
                                                            : dentroDaJanela
                                                              ? "Faltou"
                                                              : "Fora do prazo";

                                                        const badgeCls = estaPresente
                                                          ? "bg-emerald-500 text-white"
                                                          : antesDaJanela
                                                            ? "bg-amber-300 text-zinc-900"
                                                            : dentroDaJanela
                                                              ? "bg-rose-500 text-white"
                                                              : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200";

                                                        const actionKey = `${turma.id}#${usuarioId}#${dataISO}`;
                                                        const loading = confirmandoKey === actionKey;

                                                        return (
                                                          <div
                                                            key={actionKey}
                                                            className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/20 p-3"
                                                          >
                                                            <div className="flex items-start justify-between gap-2">
                                                              <div>
                                                                <div className="text-sm font-bold text-zinc-900 dark:text-white">
                                                                  {formatarDataBrasileira(dataISO)}
                                                                </div>
                                                                <div className="text-xs text-zinc-600 dark:text-zinc-300">
                                                                  Início: {hiDia || hi} • Libera {MINUTOS_ANTECIPACAO}min antes
                                                                </div>
                                                              </div>
                                                              <span className={cls("inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold", badgeCls)}>
                                                                {statusTxt}
                                                              </span>
                                                            </div>

                                                            <div className="mt-2 flex items-center justify-between gap-2">
                                                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                                                {estaPresente
                                                                  ? "Presença confirmada."
                                                                  : antesDaJanela
                                                                    ? "Aguardando abrir."
                                                                    : dentroDaJanela
                                                                      ? "Pode confirmar."
                                                                      : "Janela encerrada."}
                                                              </div>

                                                              {podeConfirmar ? (
                                                                <button
                                                                  onClick={() =>
                                                                    setConfirmPresenca({
                                                                      dataYMD: dataISO,
                                                                      turmaId: turma.id,
                                                                      usuarioId,
                                                                      nome: i.nome,
                                                                    })
                                                                  }
                                                                  disabled={loading}
                                                                  className="rounded-xl px-3 py-2 text-xs font-extrabold text-white bg-teal-700 hover:bg-teal-800 active:scale-[0.98]
                                                                           disabled:opacity-60 disabled:cursor-not-allowed"
                                                                >
                                                                  {loading ? "Confirmando..." : "Confirmar"}
                                                                </button>
                                                              ) : (
                                                                <span className="text-xs text-zinc-400" aria-hidden="true">—</span>
                                                              )}
                                                            </div>
                                                          </div>
                                                        );
                                                      })}
                                                    </div>

                                                    {/* Desktop: tabela */}
                                                    <div className="hidden md:block px-4 pb-4">
                                                      <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                                                        <table className="w-full text-xs">
                                                          <thead className="bg-zinc-50 dark:bg-zinc-900/40">
                                                            <tr className="text-left text-zinc-600 dark:text-zinc-300">
                                                              <th className="py-2 px-3 font-semibold whitespace-nowrap">📅 Data</th>
                                                              <th className="py-2 px-3 font-semibold whitespace-nowrap">🟡 Situação</th>
                                                              <th className="py-2 px-3 font-semibold whitespace-nowrap">✔️ Ações</th>
                                                            </tr>
                                                          </thead>
                                                          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                                            {datasGrade.map(({ dataISO, hi: hiDia }) => {
                                                              const estaPresente = Array.isArray(usuarioBloco?.presencas)
                                                                ? usuarioBloco.presencas.some(
                                                                    (p) =>
                                                                      String(p?.usuario_id ?? usuarioBloco.id) === String(usuarioId) &&
                                                                      p?.presente === true &&
                                                                      isSameYMD(p?.data, dataISO)
                                                                  )
                                                                : false;

                                                              const inicioAula = toLocalDateFromYMDTime(dataISO, hiDia || hi);
                                                              const abreJanela = addMinutes(inicioAula, -MINUTOS_ANTECIPACAO);
                                                              const now = new Date();

                                                              const antesDaJanela = abreJanela ? now < abreJanela : true;
                                                              const dentroDaJanela = abreJanela && janelaFinal
                                                                ? now >= abreJanela && now <= janelaFinal
                                                                : false;

                                                              const statusTexto = estaPresente
                                                                ? "Presente"
                                                                : antesDaJanela
                                                                  ? "Aguardando"
                                                                  : dentroDaJanela
                                                                    ? "Faltou"
                                                                    : "Fora do prazo";

                                                              const statusClasse = estaPresente
                                                                ? "bg-emerald-500 text-white"
                                                                : antesDaJanela
                                                                  ? "bg-amber-300 text-zinc-900"
                                                                  : dentroDaJanela
                                                                    ? "bg-rose-500 text-white"
                                                                    : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";

                                                              const podeConfirmar = !estaPresente && dentroDaJanela;

                                                              const actionKey = `${turma.id}#${usuarioId}#${dataISO}`;
                                                              const loading = confirmandoKey === actionKey;

                                                              return (
                                                                <tr key={actionKey} className="bg-white dark:bg-transparent">
                                                                  <td className="py-2 px-3 whitespace-nowrap">{formatarDataBrasileira(dataISO)}</td>
                                                                  <td className="py-2 px-3">
                                                                    <span className={cls("inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold", statusClasse)}>
                                                                      {statusTexto}
                                                                    </span>
                                                                  </td>
                                                                  <td className="py-2 px-3">
                                                                    {podeConfirmar ? (
                                                                      <button
                                                                        onClick={() =>
                                                                          setConfirmPresenca({
                                                                            dataYMD: dataISO,
                                                                            turmaId: turma.id,
                                                                            usuarioId,
                                                                            nome: i.nome,
                                                                          })
                                                                        }
                                                                        disabled={loading}
                                                                        className="rounded-xl px-3 py-2 text-[11px] font-extrabold text-white bg-teal-700 hover:bg-teal-800 active:scale-[0.98]
                                                                                 disabled:opacity-60 disabled:cursor-not-allowed"
                                                                      >
                                                                        {loading ? "Confirmando..." : "Confirmar"}
                                                                      </button>
                                                                    ) : (
                                                                      <span className="text-xs text-zinc-400" aria-hidden="true">—</span>
                                                                    )}
                                                                  </td>
                                                                </tr>
                                                              );
                                                            })}
                                                          </tbody>
                                                        </table>
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </>
                                      )}

                                      {/* =================== POR DATA =================== */}
                                      {agrupamento === "data" && (
                                        <>
                                          {datasVisaoData.length === 0 ? (
                                            <p className="text-sm text-zinc-600 dark:text-zinc-300">
                                              Nenhuma data registrada para esta turma.
                                            </p>
                                          ) : (
                                            (() => {
                                              const dataAtiva = dataAtivaPorTurma[turma.id] || datasVisaoData[0];

                                              // monta mapa de usuários (inscritos) com presenças
                                              const mapaUsuarios = new Map();
                                              for (const a of alunos) {
                                                const uid = a?.usuario_id ?? a?.id;
                                                if (!uid) continue;
                                                mapaUsuarios.set(uid, {
                                                  id: uid,
                                                  nome: a?.nome || "—",
                                                  cpf: a?.cpf || "",
                                                  presencas: new Map(),
                                                });
                                              }

                                              for (const u of det.usuarios || []) {
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

                                              const inicioDia = toLocalDateFromYMDTime(dataAtiva, hiDia);
                                              const abreJanela = addMinutes(inicioDia, -MINUTOS_ANTECIPACAO);
                                              const agoraLocal = new Date();
                                              const antesDaJanela = abreJanela ? agoraLocal < abreJanela : true;

                                              // contadores
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
                                                <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/40 overflow-hidden">
                                                  {/* Tabs de datas */}
                                                  <div className="p-4 flex flex-wrap gap-2">
                                                    {datasVisaoData.map((d) => {
                                                      const active = d === dataAtiva;
                                                      return (
                                                        <button
                                                          key={d}
                                                          type="button"
                                                          onClick={() => setDataAtivaPorTurma((p) => ({ ...p, [turma.id]: d }))}
                                                          className={cls(
                                                            "px-3 py-1.5 rounded-full text-xs font-semibold border transition",
                                                            active
                                                              ? "bg-violet-700 text-white border-violet-700"
                                                              : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                                          )}
                                                        >
                                                          {d.split("-").reverse().join("/")}
                                                        </button>
                                                      );
                                                    })}
                                                  </div>

                                                  {/* Header resumo + ações */}
                                                  <header className="px-4 pb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                                    <div className="flex items-start gap-3">
                                                      <CalendarDays className="w-4 h-4 text-zinc-600 dark:text-zinc-300 mt-0.5" />
                                                      <div>
                                                        <h4 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                                                          {dataAtiva.split("-").reverse().join("/")}
                                                        </h4>
                                                        <div className="text-xs text-zinc-600 dark:text-zinc-300">
                                                          <Clock className="inline w-3.5 h-3.5 mr-1" />
                                                          {hiDia}–{hfDia}
                                                        </div>
                                                        {antesDaJanela && (
                                                          <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                                                            Confirmação manual libera {MINUTOS_ANTECIPACAO} min antes do início.
                                                          </div>
                                                        )}
                                                        {janelaFinal && (
                                                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                                                            Janela final: {formatarDataHoraBR(janelaFinal) || "—"}
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2">
                                                      {[
                                                        ["inscritos", totalInscritos],
                                                        ["presentes", presentes, "text-emerald-600 dark:text-emerald-400"],
                                                        ["faltas", faltas, "text-rose-600 dark:text-rose-400"],
                                                        ["aguardando", aguardando, "text-amber-600 dark:text-amber-400"],
                                                      ].map(([lbl, n, c]) => (
                                                        <div key={lbl} className="min-w-[86px]">
                                                          <div className="inline-flex flex-col items-center justify-center px-3 py-2 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-700">
                                                            <div className={cls("leading-none font-extrabold text-2xl", c || "")}>{n}</div>
                                                            <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                                              {lbl}
                                                            </div>
                                                          </div>
                                                        </div>
                                                      ))}

                                                      <button
                                                        onClick={() => exportarCSVDataAtiva(turma.id, dataAtiva, mapaUsuarios)}
                                                        className="inline-flex items-center gap-2 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700
                                                                 text-slate-900 dark:text-slate-100 text-xs px-3 py-2 rounded-xl"
                                                        title="Exportar CSV da data ativa"
                                                      >
                                                        <FileText className="w-4 h-4" />
                                                        Exportar CSV
                                                      </button>
                                                    </div>
                                                  </header>

                                                  {/* Filtros */}
                                                  <div className="px-4 pb-2 flex items-center justify-between">
                                                    <label className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-200">
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

                                                  {/* Mobile: cards */}
                                                  <div className="px-4 pb-4 grid gap-2 md:hidden">
                                                    {listaUsuarios.map((u) => {
                                                      const info = u.presencas.get(dataAtiva);
                                                      const presente = !!(info && info.presente);

                                                      let confirmadoStr = "—";
                                                      if (presente && info?.confirmadoEm) {
                                                        confirmadoStr = formatarDataHoraBR(info.confirmadoEm) || "—";
                                                        if (
                                                          confirmadoStr === "—" &&
                                                          typeof info.confirmadoEm === "string" &&
                                                          /^\d{2}:\d{2}/.test(info.confirmadoEm)
                                                        ) {
                                                          confirmadoStr = `${formatarDataBrasileira(dataAtiva)} ${info.confirmadoEm.slice(0, 5)}`;
                                                        }
                                                      }

                                                      const inicioDiaDT = toLocalDateFromYMDTime(dataAtiva, hiDia);
                                                      const abre = addMinutes(inicioDiaDT, -MINUTOS_ANTECIPACAO);
                                                      const agora2 = new Date();
                                                      const podeConfirmar =
                                                        !presente && abre && janelaFinal ? agora2 >= abre && agora2 <= janelaFinal : false;

                                                      const statusTxt = presente ? "Presente" : (abre && agora2 < abre ? "Aguardando" : "Faltou");

                                                      const badgeCls = presente
                                                        ? "bg-emerald-500 text-white"
                                                        : (abre && agora2 < abre)
                                                          ? "bg-amber-300 text-zinc-900"
                                                          : "bg-rose-500 text-white";

                                                      const actionKey = `${turma.id}#${u.id}#${dataAtiva}`;
                                                      const loading = confirmandoKey === actionKey;

                                                      return (
                                                        <div key={actionKey} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/20 p-3">
                                                          <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                              <div className="font-bold text-sm text-zinc-900 dark:text-white truncate">{u.nome}</div>
                                                              <div className="text-xs text-zinc-600 dark:text-zinc-300">
                                                                CPF: {formatarCPF(u.cpf) || u.cpf || "—"}
                                                              </div>
                                                            </div>
                                                            <span className={cls("inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold", badgeCls)}>
                                                              {statusTxt}
                                                            </span>
                                                          </div>

                                                          <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                                                            Confirmado em: <span className="font-semibold">{confirmadoStr}</span>
                                                          </div>

                                                          <div className="mt-2 flex justify-end">
                                                            {podeConfirmar ? (
                                                              <button
                                                                onClick={() =>
                                                                  setConfirmPresenca({
                                                                    dataYMD: dataAtiva,
                                                                    turmaId: turma.id,
                                                                    usuarioId: u.id,
                                                                    nome: u.nome,
                                                                  })
                                                                }
                                                                disabled={loading}
                                                                className="rounded-xl px-3 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]
                                                                         disabled:opacity-60 disabled:cursor-not-allowed"
                                                              >
                                                                {loading ? "Confirmando..." : "Confirmar"}
                                                              </button>
                                                            ) : (
                                                              <span className="text-xs text-zinc-400" aria-hidden="true">—</span>
                                                            )}
                                                          </div>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>

                                                  {/* Desktop: tabela */}
                                                  <div className="hidden md:block px-4 pb-4 overflow-x-auto">
                                                    <table className="min-w-full text-sm table-fixed">
                                                      <thead>
                                                        <tr className="text-left text-zinc-600 dark:text-zinc-300">
                                                          <th className="py-2 pr-4 w-[32%]">👤 Nome</th>
                                                          <th className="py-2 pr-4 w-[18%]">CPF</th>
                                                          <th className="py-2 pr-4 w-[18%]">Situação</th>
                                                          <th className="py-2 pr-4 w-[22%]">Confirmado em</th>
                                                          <th className="py-2 pr-4 w-[10%]">Ações</th>
                                                        </tr>
                                                      </thead>
                                                      <tbody>
                                                        {listaUsuarios.map((u) => {
                                                          const info = u.presencas.get(dataAtiva);
                                                          const presente = !!(info && info.presente);

                                                          let confirmadoStr = "—";
                                                          if (presente && info?.confirmadoEm) {
                                                            confirmadoStr = formatarDataHoraBR(info.confirmadoEm) || "—";
                                                            if (
                                                              confirmadoStr === "—" &&
                                                              typeof info.confirmadoEm === "string" &&
                                                              /^\d{2}:\d{2}/.test(info.confirmadoEm)
                                                            ) {
                                                              confirmadoStr = `${formatarDataBrasileira(dataAtiva)} ${info.confirmadoEm.slice(0, 5)}`;
                                                            }
                                                          }

                                                          const inicioDiaDT = toLocalDateFromYMDTime(dataAtiva, hiDia);
                                                          const abre = addMinutes(inicioDiaDT, -MINUTOS_ANTECIPACAO);
                                                          const agora2 = new Date();
                                                          const podeConfirmar =
                                                            !presente && abre && janelaFinal ? agora2 >= abre && agora2 <= janelaFinal : false;

                                                          const statusTxt = presente ? "Presente" : (abre && agora2 < abre ? "Aguardando" : "Faltou");

                                                          const badgeCls = presente
                                                            ? "bg-emerald-500 text-white"
                                                            : (abre && agora2 < abre)
                                                              ? "bg-amber-300 text-zinc-900"
                                                              : "bg-rose-500 text-white";

                                                          const actionKey = `${turma.id}#${u.id}#${dataAtiva}`;
                                                          const loading = confirmandoKey === actionKey;

                                                          return (
                                                            <tr key={actionKey} className="border-t border-zinc-200 dark:border-zinc-800">
                                                              <td className="py-2 pr-4 whitespace-nowrap overflow-hidden text-ellipsis">{u.nome}</td>
                                                              <td className="py-2 pr-4 whitespace-nowrap">{formatarCPF(u.cpf) || u.cpf || "—"}</td>
                                                              <td className="py-2 pr-4">
                                                                <span className={cls("inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold", badgeCls)}>
                                                                  {statusTxt}
                                                                </span>
                                                              </td>
                                                              <td className="py-2 pr-4">{confirmadoStr}</td>
                                                              <td className="py-2 pr-4">
                                                                {podeConfirmar ? (
                                                                  <button
                                                                    onClick={() =>
                                                                      setConfirmPresenca({
                                                                        dataYMD: dataAtiva,
                                                                        turmaId: turma.id,
                                                                        usuarioId: u.id,
                                                                        nome: u.nome,
                                                                      })
                                                                    }
                                                                    disabled={loading}
                                                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700
                                                                             disabled:opacity-60 disabled:cursor-not-allowed"
                                                                  >
                                                                    {loading ? "Confirmando..." : "Confirmar"}
                                                                  </button>
                                                                ) : (
                                                                  <span className="text-xs text-zinc-400" aria-hidden="true">—</span>
                                                                )}
                                                              </td>
                                                            </tr>
                                                          );
                                                        })}
                                                      </tbody>
                                                    </table>
                                                  </div>
                                                </section>
                                              );
                                            })()
                                          )}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.section>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ======================= MODAIS PREMIUM ======================= */}

      {/* Confirmar presença */}
      <ModalConfirmacao
        isOpen={!!confirmPresenca}
        onClose={() => setConfirmPresenca(null)}
        onConfirmar={() => (confirmPresenca ? confirmarPresencaAgora(confirmPresenca) : true)}
        titulo="Confirmar presença"
        mensagem={
          confirmPresenca ? (
            <div className="space-y-2">
              <p>
                Confirmar presença de <strong>{confirmPresenca.nome || "participante"}</strong> em{" "}
                <strong>{formatarDataBrasileira(confirmPresenca.dataYMD)}</strong>?
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                A presença será registrada como <strong>presente</strong> para esta data.
              </p>
            </div>
          ) : (
            "Confirmar presença?"
          )
        }
        textoBotaoConfirmar="Confirmar"
        textoBotaoCancelar="Cancelar"
        variant="primary"
        level={6}
      />

      {/* Remover turma */}
      <ModalConfirmacao
        isOpen={!!confirmRemover}
        onClose={() => setConfirmRemover(null)}
        onConfirmar={() => (confirmRemover ? removerTurmaAgora(confirmRemover) : true)}
        titulo="Remover turma"
        mensagem={
          confirmRemover ? (
            <div className="space-y-2">
              <p>
                Remover a turma <strong>{confirmRemover.turmaNome || `#${confirmRemover.turmaId}`}</strong>?
              </p>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                <div className="flex items-start gap-2">
                  <BadgeCheck className="w-5 h-5 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-bold">Atenção</p>
                    <p>
                      Se houver <strong>presenças</strong> ou <strong>certificados</strong>, o backend bloqueará a exclusão.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            "Remover turma?"
          )
        }
        textoBotaoConfirmar={removendoId ? "Removendo..." : "Sim, remover"}
        textoBotaoCancelar="Cancelar"
        variant="danger"
        level={6}
      />
    </>
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
