// 📁 src/components/ListaTurmasAdministrador.jsx (Premium Plus)
/* eslint-disable no-console */
import PropTypes from "prop-types";
import { useMemo, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  CalendarDays,
  Clock3,
  Users,
  Layers,
  ChevronDown,
  ChevronUp,
  BadgeCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "react-toastify";

import BotaoPrimario from "./BotaoPrimario";
import ModalConfirmacao from "./ModalConfirmacao";
import {
  formatarDataBrasileira,
  gerarIntervaloDeDatas,
  formatarCPF,
  formatarParaISO,
} from "../utils/data";
import { apiGet, apiPost, apiDelete } from "../services/api";

/* ============================== Helpers ============================== */

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const hhmm = (s, fb = "00:00") =>
  typeof s === "string" && /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : fb;

function isYMD(str) {
  return typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

function parseYMD(dateOnly) {
  if (!isYMD(dateOnly)) return null;
  const [y, m, d] = dateOnly.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return { y, m, d };
}

/** Date-only safe: cria Date local sem parse ambíguo */
function toLocalDateFromYMDTime(dateOnly, timeHHmm = "12:00") {
  const parts = parseYMD(dateOnly);
  if (!parts) return null;
  const [hh, mm] = String(timeHHmm || "12:00")
    .slice(0, 5)
    .split(":")
    .map(Number);

  const H = Number.isFinite(hh) ? hh : 12;
  const M = Number.isFinite(mm) ? mm : 0;
  return new Date(parts.y, parts.m - 1, parts.d, H, M, 0, 0);
}

const isSameYMD = (a, b) => ymd(a) === ymd(b);

function statusPorJanela({ di, df, hi, hf, agora = new Date() }) {
  const inicio = di ? toLocalDateFromYMDTime(di, hi || "00:00") : null;
  const fim = df ? toLocalDateFromYMDTime(df, hf || "23:59") : null;
  if (!inicio || !fim || Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return "Desconhecido";
  if (agora < inicio) return "Programado";
  if (agora > fim) return "Encerrado";
  return "Em andamento";
}

/** Cores globais: Programado=verde, Andamento=amarelo, Encerrado=vermelho */
function statusPillClass(status) {
  switch (status) {
    case "Programado":
      return "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-200 dark:border-emerald-800";
    case "Em andamento":
      return "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800";
    case "Encerrado":
      return "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/20 dark:text-rose-200 dark:border-rose-800";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/25 dark:text-slate-200 dark:border-slate-800";
  }
}

function topBarByStatus(status) {
  switch (status) {
    case "Programado":
      return "from-emerald-600 via-emerald-500 to-teal-400";
    case "Em andamento":
      return "from-amber-600 via-orange-500 to-yellow-400";
    case "Encerrado":
      return "from-rose-700 via-red-600 to-orange-500";
    default:
      return "from-slate-500 via-slate-400 to-slate-300";
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

function countTotalTurmas(evento) {
  return Array.isArray(evento?.turmas) ? evento.turmas.filter((t) => t?.id).length : 0;
}

function keyFimTurma(t) {
  const df = ymd(t?.data_fim);
  const hf = hhmm(t?.horario_fim, "23:59");
  const di = ymd(t?.data_inicio);

  if (df) return toLocalDateFromYMDTime(df, hf)?.getTime?.() ?? -Infinity;
  if (di) return toLocalDateFromYMDTime(di, "23:59")?.getTime?.() ?? -Infinity;
  return -Infinity;
}

/* ============================= UI Bits ============================= */

function StatMini({ icon: Icon, label, value }) {
  return (
    <div
      className={cls(
        "rounded-2xl border border-slate-200 bg-white/75 backdrop-blur px-3 py-2 shadow-sm",
        "dark:bg-slate-950/35 dark:border-slate-800"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cls(
            "inline-flex h-9 w-9 items-center justify-center rounded-2xl",
            "bg-slate-100 border border-slate-200 text-slate-700",
            "dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
          )}
          aria-hidden="true"
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  return (
    <span
      className={cls(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold border",
        statusPillClass(status)
      )}
      aria-label={`Status: ${status}`}
      title="Status calculado por data+hora"
    >
      {status === "Programado" ? <Clock3 size={14} aria-hidden="true" /> : null}
      {status === "Em andamento" ? <BadgeCheck size={14} aria-hidden="true" /> : null}
      {status === "Encerrado" ? <ShieldAlert size={14} aria-hidden="true" /> : null}
      {status}
    </span>
  );
}

function SkeletonBox({ className = "" }) {
  return (
    <div
      className={cls(
        "animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/60",
        className
      )}
      aria-hidden="true"
    />
  );
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
  mostrarBotaoRemover = true,
}) {
  const [turmaExpandidaId, setTurmaExpandidaId] = useState(null);
  const [presencasPorTurma, setPresencasPorTurma] = useState({});
  const [removendoId, setRemovendoId] = useState(null);
  const [idsRemovidos, setIdsRemovidos] = useState(() => new Set());

  // loading por confirmação (turma#usuario#data)
  const [confirmandoKey, setConfirmandoKey] = useState(null);

  // loading por turma ao expandir
  const [loadingTurmaSet, setLoadingTurmaSet] = useState(() => new Set());

  // Modais premium
  const [confirmPresenca, setConfirmPresenca] = useState(null); // {dataISO,turmaId,usuarioId,nome}
  const [confirmRemover, setConfirmRemover] = useState(null); // {turmaId,turmaNome}

  // ----- Ordenadores (mais recente primeiro) -----
  const ordenarTurmasPorMaisNovo = (a, b) => keyFimTurma(b) - keyFimTurma(a);
  const keyEventoMaisNovo = (ev) => Math.max(...(ev?.turmas || []).map(keyFimTurma), -Infinity);
  const ordenarEventosPorMaisNovo = (a, b) => keyEventoMaisNovo(b) - keyEventoMaisNovo(a);

  const eventosOrdenados = useMemo(() => eventos.slice().sort(ordenarEventosPorMaisNovo), [eventos]);

  const markTurmaLoading = (turmaId, on) => {
    setLoadingTurmaSet((prev) => {
      const next = new Set(prev);
      if (on) next.add(String(turmaId));
      else next.delete(String(turmaId));
      return next;
    });
  };

  // ----- Carregar presenças (bloco rico + tentativa de datas_turma) -----
  const carregarPresencas = useCallback(async (turmaId) => {
    try {
      markTurmaLoading(turmaId, true);

      const detalhes = await apiGet(`/api/presencas/turma/${turmaId}/detalhes`, { on403: "silent" });
      const usuarios = Array.isArray(detalhes?.usuarios) ? detalhes.usuarios : [];

      let datas = [];

      // tenta datas_turma
      try {
        const viaDatas = await apiGet(`/api/datas/turma/${turmaId}?via=datas`, { on403: "silent" });
        const arr = Array.isArray(viaDatas) ? viaDatas : [];
        datas = arr
          .map((x) => (typeof x === "string" ? x.slice(0, 10) : x?.data?.slice(0, 10)))
          .filter(Boolean);
      } catch {}

      // fallback: datas distintas via presenças
      if (!datas.length) {
        try {
          const viaPres = await apiGet(`/api/datas/turma/${turmaId}?via=presencas`, { on403: "silent" });
          const arr2 = Array.isArray(viaPres) ? viaPres : [];
          datas = arr2
            .map((x) => (typeof x === "string" ? x.slice(0, 10) : x?.data?.slice(0, 10)))
            .filter(Boolean);
        } catch {}
      }

      // último recurso: "datas" do próprio /detalhes
      if (!datas.length) {
        const arr3 = Array.isArray(detalhes?.datas) ? detalhes.datas : [];
        datas = arr3
          .map((d) => (typeof d === "string" ? d.slice(0, 10) : d?.data?.slice(0, 10)))
          .filter(Boolean);
      }

      datas = Array.from(new Set(datas)).sort();
      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: { datas, usuarios } }));
    } catch (err) {
      console.error("❌ Erro ao carregar presenças:", err);
      toast.error("Erro ao carregar presenças.");
      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: { datas: [], usuarios: [] } }));
    } finally {
      markTurmaLoading(turmaId, false);
    }
  }, []);

  // ----- Confirmar presença simples (via modal) -----
  async function confirmarPresencaAgora({ dataISO, turmaId, usuarioId, nome }) {
    const key = `${turmaId}#${usuarioId}#${dataISO}`;
    if (confirmandoKey) return false;

    try {
      setConfirmandoKey(key);
      await apiPost(`/api/presencas/confirmar-simples`, {
        turma_id: turmaId,
        usuario_id: usuarioId,
        data: dataISO, // "YYYY-MM-DD"
      });

      toast.success("✅ Presença confirmada com sucesso.");
      await carregarPresencas(turmaId);
      return true;
    } catch (err) {
      if (err?.status === 409) {
        toast.success("✅ Presença já estava confirmada.");
        await carregarPresencas(turmaId);
        return true;
      }
      const msg = err?.data?.message || err?.message || "Erro ao confirmar presença.";
      console.error("❌ Falha na confirmação de presença:", err);
      toast.error(`❌ ${msg}`);
      return false;
    } finally {
      setConfirmandoKey(null);
    }
  }

  // ----- Excluir turma (via modal) -----
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
        toast.error(
          `Não é possível excluir: ${c.presencas || 0} presenças / ${c.certificados || 0} certificados.`
        );
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

  // Fecha detalhe se turma removida
  useEffect(() => {
    if (turmaExpandidaId && idsRemovidos.has(String(turmaExpandidaId))) {
      setTurmaExpandidaId(null);
    }
  }, [idsRemovidos, turmaExpandidaId]);

  return (
    <>
      <div className="grid grid-cols-1 gap-8" role="region" aria-label="Lista de turmas dos eventos">
        <AnimatePresence>
          {eventosOrdenados.map((evento) => {
            const eventoId = evento?.evento_id ?? evento?.id;
            const turmasValidas = (evento?.turmas || [])
              .filter((t) => t && t.id && !idsRemovidos.has(String(t.id)))
              .sort(ordenarTurmasPorMaisNovo);

            const maisRecente = turmasValidas?.[0]?.data_fim ? ymd(turmasValidas[0].data_fim) : "";

            return (
              <motion.section
                key={eventoId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cls(
                  "relative rounded-3xl overflow-hidden",
                  "border border-slate-200 bg-white/70 backdrop-blur shadow-sm",
                  "dark:bg-slate-950/35 dark:border-slate-800"
                )}
              >
                {/* Barra premium superior */}
                <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 opacity-80" />

                {/* Glow sutil */}
                <div className="pointer-events-none absolute -top-28 -right-28 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-28 -left-28 w-72 h-72 rounded-full bg-fuchsia-500/10 blur-3xl" />

                <div className="relative p-4 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white break-words">
                        📘 Evento: {evento?.titulo || "—"}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Gestão de turmas e presenças (admin)
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full sm:w-auto">
                      <StatMini icon={Layers} label="Turmas" value={`${countTotalTurmas(evento)}`} />
                      <StatMini icon={Users} label="Listadas" value={`${turmasValidas.length}`} />
                      <StatMini
                        icon={CalendarDays}
                        label="Mais recente"
                        value={maisRecente ? formatarDataBrasileira(maisRecente) : "—"}
                      />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4">
                    {turmasValidas.map((turma) => {
                      const di = ymd(turma.data_inicio);
                      const df = ymd(turma.data_fim);
                      const hi = hhmm(turma.horario_inicio, "08:00");
                      const hf = hhmm(turma.horario_fim, "17:00");

                      const status = statusPorJanela({ di, df, hi, hf, agora: hoje || new Date() });
                      const estaExpandida = turmaExpandidaId === turma.id;

                      // fallback de datas
                      const inicioNoon = di ? toLocalDateFromYMDTime(di, "12:00") : null;
                      const fimNoon = df ? toLocalDateFromYMDTime(df, "12:00") : null;
                      const datasFallback =
                        inicioNoon && fimNoon ? gerarIntervaloDeDatas(inicioNoon, fimNoon) : [];

                      const bloco = presencasPorTurma[turma.id];
                      const datasGrade = montarDatasGrade(turma, bloco, datasFallback);

                      // janela admin: 60 min após início do encontro até 60 dias após fim da turma
                      const fimDT = df ? toLocalDateFromYMDTime(df, hf) : null;
                      const fimValido = fimDT && !Number.isNaN(fimDT.getTime());
                      const fimMais60 = fimValido
                        ? new Date(fimDT.getTime() + 60 * 24 * 60 * 60 * 1000)
                        : null;

                      const isLoadingTurma = loadingTurmaSet.has(String(turma.id));

                      return (
                        <motion.div
                          key={turma.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className={cls(
                            "relative rounded-3xl overflow-hidden",
                            "border border-slate-200 bg-white shadow-sm",
                            "dark:bg-slate-950/40 dark:border-slate-800"
                          )}
                          aria-label={`Turma ${turma.nome}`}
                        >
                          {/* Barrinha por status */}
                          <div className={cls("h-1.5 w-full bg-gradient-to-r", topBarByStatus(status))} />

                          <div className="p-4 sm:p-5">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white break-words">
                                    {turma.nome || `Turma ${turma.id}`}
                                  </h4>
                                  <StatusPill status={status} />
                                </div>

                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                  {formatarDataBrasileira(di || turma.data_inicio)} a{" "}
                                  {formatarDataBrasileira(df || turma.data_fim)}
                                  <span className="mx-2 opacity-50">•</span>
                                  {hi} – {hf}
                                </p>

                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span
                                    className={cls(
                                      "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold border",
                                      "bg-slate-50 text-slate-700 border-slate-200",
                                      "dark:bg-slate-900/25 dark:text-slate-200 dark:border-slate-800"
                                    )}
                                  >
                                    <CalendarDays size={14} aria-hidden="true" />
                                    {datasGrade.length} dia(s)
                                  </span>

                                  <span
                                    className={cls(
                                      "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold border",
                                      "bg-slate-50 text-slate-700 border-slate-200",
                                      "dark:bg-slate-900/25 dark:text-slate-200 dark:border-slate-800"
                                    )}
                                  >
                                    <Users size={14} aria-hidden="true" />
                                    {(inscritosPorTurma?.[turma.id] || []).length} inscrito(s)
                                  </span>

                                  <span
                                    className={cls(
                                      "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold border",
                                      "bg-slate-50 text-slate-700 border-slate-200",
                                      "dark:bg-slate-900/25 dark:text-slate-200 dark:border-slate-800"
                                    )}
                                    title="Regra de confirmação manual"
                                  >
                                    <Clock3 size={14} aria-hidden="true" />
                                    Janela: 60min após início → 60 dias após fim
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {typeof gerarRelatorioPDF === "function" && (
                                  <BotaoPrimario
                                    onClick={() => gerarRelatorioPDF?.(turma.id)}
                                    aria-label="Gerar relatório em PDF desta turma"
                                    variant="secondary"
                                    className="rounded-xl"
                                  >
                                    Exportar PDF
                                  </BotaoPrimario>
                                )}

                                {modoadministradorPresencas && (
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
                                    className="rounded-xl"
                                    iconRight={estaExpandida ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  >
                                    {estaExpandida ? "Recolher" : "Ver detalhes"}
                                  </BotaoPrimario>
                                )}

                                {mostrarBotaoRemover && (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmRemover({ turmaId: turma.id, turmaNome: turma.nome })}
                                    disabled={removendoId === turma.id}
                                    title="Remover turma"
                                    className={cls(
                                      "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold",
                                      "border-rose-200 hover:bg-rose-50 active:scale-[0.98]",
                                      "dark:border-rose-900/40 dark:hover:bg-rose-900/20",
                                      "disabled:opacity-60 disabled:cursor-not-allowed"
                                    )}
                                    aria-label={`Remover turma ${turma.nome}`}
                                  >
                                    <Trash2 size={14} />
                                    {removendoId === turma.id ? "Removendo..." : "Remover"}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Detalhes */}
                            <AnimatePresence>
                              {modoadministradorPresencas && estaExpandida && (
                                <motion.div
                                  id={`turma-${turma.id}-detalhes`}
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden mt-4"
                                >
                                  <div className="rounded-2xl border border-slate-200 bg-white/70 dark:bg-slate-950/30 dark:border-slate-800 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <h5 className="font-extrabold text-sm text-slate-900 dark:text-white">
                                          Inscritos & Presenças
                                        </h5>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                          Confirmação manual libera 60 min após início do encontro e permanece até 60 dias após o fim da turma.
                                        </p>
                                      </div>
                                      {isLoadingTurma && (
                                        <span className="text-xs text-slate-500 dark:text-slate-400">Carregando…</span>
                                      )}
                                    </div>

                                    {isLoadingTurma ? (
                                      <div className="mt-4 grid gap-2">
                                        <SkeletonBox className="h-20" />
                                        <SkeletonBox className="h-20" />
                                        <SkeletonBox className="h-20" />
                                      </div>
                                    ) : (inscritosPorTurma[turma.id] || []).length === 0 ? (
                                      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                                        Nenhum inscrito encontrado para esta turma.
                                      </p>
                                    ) : (
                                      <div className="mt-4 grid grid-cols-1 gap-3">
                                        {(inscritosPorTurma[turma.id] || []).map((i) => {
                                          const usuarioId = i.usuario_id ?? i.id;
                                          const blocoTurma = presencasPorTurma[turma.id];
                                          const usuarioBloco = blocoTurma?.usuarios?.find(
                                            (u) => String(u.id) === String(usuarioId)
                                          );

                                          return (
                                            <div
                                              key={`${turma.id}#${usuarioId}`}
                                              className={cls(
                                                "rounded-2xl border border-slate-200 bg-white",
                                                "dark:bg-slate-950/40 dark:border-slate-800"
                                              )}
                                            >
                                              <div className="p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                                <div className="min-w-0">
                                                  <p className="font-bold text-slate-900 dark:text-white break-words">
                                                    {i.nome || "—"}
                                                  </p>
                                                  <p className="text-xs text-slate-600 dark:text-slate-300">
                                                    CPF: {formatarCPF(i.cpf) || "Não informado"}
                                                  </p>
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                  ID: {String(usuarioId)}
                                                </div>
                                              </div>

                                              {/* Mobile: cards por dia */}
                                              <div className="px-4 pb-4 grid gap-2 md:hidden">
                                                {datasGrade.map(({ dataISO, hi: hiDia }) => {
                                                  const presente = Array.isArray(usuarioBloco?.presencas)
                                                    ? usuarioBloco.presencas.some(
                                                        (p) =>
                                                          String(p?.usuario_id ?? usuarioBloco.id) === String(usuarioId) &&
                                                          p?.presente === true &&
                                                          isSameYMD(p?.data, dataISO)
                                                      )
                                                    : false;

                                                  const inicioDia = toLocalDateFromYMDTime(dataISO, hiDia);
                                                  const abreJanela = inicioDia
                                                    ? new Date(inicioDia.getTime() + 60 * 60 * 1000)
                                                    : null;

                                                  const now = new Date();
                                                  const antesDaJanela = abreJanela ? now < abreJanela : true;
                                                  const dentroDaJanela = !antesDaJanela && (fimMais60 ? now <= fimMais60 : false);

                                                  const podeConfirmar = !presente && dentroDaJanela;

                                                  const statusTexto = presente
                                                    ? "Presente"
                                                    : antesDaJanela
                                                      ? "Aguardando"
                                                      : dentroDaJanela
                                                        ? "Faltou"
                                                        : "Fora do prazo";

                                                  const statusChip =
                                                    presente
                                                      ? "bg-emerald-500 text-white"
                                                      : antesDaJanela
                                                        ? "bg-amber-400 text-slate-900"
                                                        : dentroDaJanela
                                                          ? "bg-rose-500 text-white"
                                                          : "bg-slate-300 text-slate-900 dark:bg-slate-800 dark:text-slate-100";

                                                  const key = `${turma.id}#${usuarioId}#${dataISO}`;
                                                  const loading = confirmandoKey === key;

                                                  return (
                                                    <div
                                                      key={key}
                                                      className={cls(
                                                        "rounded-2xl border border-slate-200 bg-white p-3",
                                                        "dark:bg-slate-950/35 dark:border-slate-800"
                                                      )}
                                                    >
                                                      <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                            {formatarDataBrasileira(dataISO)}
                                                          </p>
                                                          <p className="text-xs text-slate-600 dark:text-slate-300">
                                                            Início: {hiDia}
                                                          </p>
                                                        </div>

                                                        <span
                                                          className={cls(
                                                            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                                                            statusChip
                                                          )}
                                                        >
                                                          {statusTexto}
                                                        </span>
                                                      </div>

                                                      <div className="mt-2 flex items-center justify-between gap-2">
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                          {presente
                                                            ? "Presença confirmada."
                                                            : antesDaJanela
                                                              ? "Aguardando liberar (60 min após início)."
                                                              : dentroDaJanela
                                                                ? "Pode confirmar."
                                                                : "Janela encerrada."}
                                                        </p>

                                                        {podeConfirmar ? (
                                                          <button
                                                            onClick={() =>
                                                              setConfirmPresenca({
                                                                dataISO,
                                                                turmaId: turma.id,
                                                                usuarioId,
                                                                nome: i.nome,
                                                              })
                                                            }
                                                            disabled={loading}
                                                            className={cls(
                                                              "rounded-xl px-3 py-2 text-xs font-bold text-white",
                                                              "bg-teal-700 hover:bg-teal-800 active:scale-[0.98]",
                                                              "disabled:opacity-60 disabled:cursor-not-allowed",
                                                              "focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none"
                                                            )}
                                                            aria-label={`Confirmar presença de ${i.nome} em ${formatarDataBrasileira(dataISO)}`}
                                                          >
                                                            {loading ? "Confirmando..." : "Confirmar"}
                                                          </button>
                                                        ) : (
                                                          <span className="text-xs text-slate-400" aria-hidden="true">
                                                            —
                                                          </span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>

                                              {/* Desktop: tabela */}
                                              <div className="hidden md:block px-4 pb-4">
                                                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                                                  <table className="w-full text-xs">
                                                    <thead className="bg-slate-50 dark:bg-slate-900/40">
                                                      <tr className="text-left text-slate-600 dark:text-slate-200">
                                                        <th className="py-2 px-3 font-semibold whitespace-nowrap">📅 Data</th>
                                                        <th className="py-2 px-3 font-semibold whitespace-nowrap">🟡 Situação</th>
                                                        <th className="py-2 px-3 font-semibold whitespace-nowrap">✔️ Ações</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                                      {datasGrade.map(({ dataISO, hi: hiDia }) => {
                                                        const presente = Array.isArray(usuarioBloco?.presencas)
                                                          ? usuarioBloco.presencas.some(
                                                              (p) =>
                                                                String(p?.usuario_id ?? usuarioBloco.id) === String(usuarioId) &&
                                                                p?.presente === true &&
                                                                isSameYMD(p?.data, dataISO)
                                                            )
                                                          : false;

                                                        const inicioDia = toLocalDateFromYMDTime(dataISO, hiDia);
                                                        const abreJanela = inicioDia
                                                          ? new Date(inicioDia.getTime() + 60 * 60 * 1000)
                                                          : null;

                                                        const now = new Date();
                                                        const antesDaJanela = abreJanela ? now < abreJanela : true;
                                                        const dentroDaJanela = !antesDaJanela && (fimMais60 ? now <= fimMais60 : false);

                                                        const podeConfirmar = !presente && dentroDaJanela;

                                                        const statusTexto = presente
                                                          ? "Presente"
                                                          : antesDaJanela
                                                            ? "Aguardando"
                                                            : dentroDaJanela
                                                              ? "Faltou"
                                                              : "Fora do prazo";

                                                        const statusClasse = presente
                                                          ? "bg-emerald-500 text-white"
                                                          : antesDaJanela
                                                            ? "bg-amber-400 text-slate-900"
                                                            : dentroDaJanela
                                                              ? "bg-rose-500 text-white"
                                                              : "bg-slate-300 text-slate-900 dark:bg-slate-800 dark:text-slate-100";

                                                        const key = `${turma.id}#${usuarioId}#${dataISO}`;
                                                        const loading = confirmandoKey === key;

                                                        return (
                                                          <tr key={key} className="bg-white dark:bg-transparent">
                                                            <td className="py-2 px-3 whitespace-nowrap">
                                                              {formatarDataBrasileira(dataISO)}
                                                            </td>
                                                            <td className="py-2 px-3">
                                                              <span
                                                                className={cls(
                                                                  "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                                                                  statusClasse
                                                                )}
                                                                aria-label={`Status em ${formatarDataBrasileira(dataISO)}: ${statusTexto}`}
                                                              >
                                                                {statusTexto}
                                                              </span>
                                                            </td>
                                                            <td className="py-2 px-3">
                                                              {podeConfirmar ? (
                                                                <button
                                                                  onClick={() =>
                                                                    setConfirmPresenca({
                                                                      dataISO,
                                                                      turmaId: turma.id,
                                                                      usuarioId,
                                                                      nome: i.nome,
                                                                    })
                                                                  }
                                                                  disabled={loading}
                                                                  className={cls(
                                                                    "rounded-xl px-3 py-2 text-[11px] font-extrabold text-white",
                                                                    "bg-teal-700 hover:bg-teal-800 active:scale-[0.98]",
                                                                    "disabled:opacity-60 disabled:cursor-not-allowed",
                                                                    "focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none"
                                                                  )}
                                                                >
                                                                  {loading ? "Confirmando..." : "Confirmar"}
                                                                </button>
                                                              ) : (
                                                                <span className="text-slate-400 text-xs" aria-hidden="true">
                                                                  —
                                                                </span>
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
                                  </div>
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

      {/* ===================== MODAIS PREMIUM ===================== */}

      {/* Confirmar presença */}
      <ModalConfirmacao
        isOpen={!!confirmPresenca}
        onClose={() => setConfirmPresenca(null)}
        onConfirmar={() =>
          confirmPresenca
            ? confirmarPresencaAgora(confirmPresenca)
            : true
        }
        titulo="Confirmar presença"
        mensagem={
          confirmPresenca ? (
            <div className="space-y-2">
              <p>
                Confirmar presença de <strong>{confirmPresenca.nome || "participante"}</strong> em{" "}
                <strong>{formatarDataBrasileira(confirmPresenca.dataISO)}</strong>?
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
        onConfirmar={() =>
          confirmRemover
            ? removerTurmaAgora(confirmRemover)
            : true
        }
        titulo="Remover turma"
        mensagem={
          confirmRemover ? (
            <div className="space-y-2">
              <p>
                Remover a turma <strong>{confirmRemover.turmaNome || `#${confirmRemover.turmaId}`}</strong>?
              </p>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 mt-0.5" aria-hidden="true" />
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
          data_fim: PropTypes.string, // ISO date or "YYYY-MM-DD"
          horario_inicio: PropTypes.string, // "HH:MM"
          horario_fim: PropTypes.string, // "HH:MM"
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
