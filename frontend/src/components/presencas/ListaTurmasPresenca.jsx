// ✅ src/components/presencas/ListaTurmasPresenca.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Componente orquestrador da gestão de presenças por evento/turma.
//
// Contratos aplicados:
// - Sem toast direto;
// - Sem BotaoPrimario legado;
// - Sem apiGet/apiPost/apiDelete direto;
// - Sem /api manual no frontend;
// - Sem /api/presencas/turma/:id/detalhes;
// - Sem /api/presencas/confirmar-simples;
// - Sem /api/turmas/:id direto;
// - Presenças da turma via api.presenca.turmaDetalhe(turma_id);
// - PDF recebido por prop gerarRelatorioPDF(turma_id, turma_nome);
// - Controle por pessoa/data delegado para ControlePresencaInscritos;
// - ModalConfirmacao v2.0 em src/components/ui;
// - Botao v2.0 em src/components/ui;
// - AppToast v2.0 em src/components/ui;
// - Date-only seguro em YYYY-MM-DD;
// - Mobile-first, dark mode, acessível e sem duplicar regra de presença.

import { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Download,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";

import { api } from "../../services/api";
import Botao from "../ui/Botao";
import ModalConfirmacao from "../ui/ModalConfirmacao";
import CarregandoSkeleton from "../ui/CarregandoSkeleton";
import NadaEncontrado from "../ui/NadaEncontrado";
import {
  notifyError,
  notifySuccess,
  notifyWarning,
} from "../ui/AppToast";

import ControlePresencaInscritos from "./ControlePresencaInscritos";
import StatusPresencaBadge from "./StatusPresencaBadge";

/* ─────────────────────────────────────────────────────────────
 * Configuração
 * ───────────────────────────────────────────────────────────── */

const STATUS = Object.freeze({
  PROGRAMADO: "programado",
  ANDAMENTO: "andamento",
  ENCERRADO: "encerrado",
});

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

function classNames(...parts) {
  return parts.filter(Boolean).join(" ");
}

function toPositiveInt(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function ymd(value) {
  const safe = String(value || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(safe)) return safe;
  if (/^\d{4}-\d{2}-\d{2}T/.test(safe)) return safe.slice(0, 10);

  return "";
}

function hhmm(value, fallback = "00:00") {
  const safe = String(value || "").trim();

  if (/^\d{2}:\d{2}$/.test(safe)) return safe;
  if (/^\d{2}:\d{2}:\d{2}$/.test(safe)) return safe.slice(0, 5);

  return fallback;
}

function toLocalDateTime(dateOnly, timeHHmm = "00:00") {
  const data = ymd(dateOnly);
  const hora = hhmm(timeHHmm, "00:00");

  if (!data) return null;

  const [year, month, day] = data.split("-").map(Number);
  const [hour, minute] = hora.split(":").map(Number);

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function formatarDataBR(value) {
  const data = ymd(value);

  if (!data) return "—";

  const [year, month, day] = data.split("-");
  return `${day}/${month}/${year}`;
}

function formatarPeriodoTurma(turma) {
  const inicio = ymd(turma?.data_inicio);
  const fim = ymd(turma?.data_fim);
  const hi = hhmm(turma?.horario_inicio, "");
  const hf = hhmm(turma?.horario_fim, "");

  const datas =
    inicio && fim
      ? `${formatarDataBR(inicio)} a ${formatarDataBR(fim)}`
      : "Período a definir";

  const horas = hi || hf ? `${hi || "—"}–${hf || "—"}` : "Horário a definir";

  return `${datas} • ${horas}`;
}

function getTurmaId(turma) {
  return toPositiveInt(turma?.turma_id || turma?.id);
}

function getEventoId(evento) {
  return toPositiveInt(evento?.evento_id || evento?.id);
}

function getStatusTurma(turma, agora = new Date()) {
  const inicio = toLocalDateTime(
    turma?.data_inicio,
    hhmm(turma?.horario_inicio, "00:00")
  );

  const fim = toLocalDateTime(
    turma?.data_fim,
    hhmm(turma?.horario_fim, "23:59")
  );

  if (!inicio || !fim) return STATUS.PROGRAMADO;
  if (agora < inicio) return STATUS.PROGRAMADO;
  if (agora > fim) return STATUS.ENCERRADO;

  return STATUS.ANDAMENTO;
}

function statusLabel(status) {
  if (status === STATUS.ANDAMENTO) return "Em andamento";
  if (status === STATUS.ENCERRADO) return "Encerrado";
  return "Programado";
}

function statusBarClass(status) {
  if (status === STATUS.ANDAMENTO) {
    return "bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300";
  }

  if (status === STATUS.ENCERRADO) {
    return "bg-gradient-to-r from-rose-600 via-rose-500 to-red-400";
  }

  return "bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400";
}

function statusPillClass(status) {
  const base =
    "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-black";

  if (status === STATUS.ANDAMENTO) {
    return classNames(
      base,
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
    );
  }

  if (status === STATUS.ENCERRADO) {
    return classNames(
      base,
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-200"
    );
  }

  return classNames(
    base,
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-200"
  );
}

function getTurmaFimKey(turma) {
  const fim = ymd(turma?.data_fim) || ymd(turma?.data_inicio);
  const hora = hhmm(turma?.horario_fim, "23:59");

  const date = toLocalDateTime(fim, hora);

  return date ? date.getTime() : -Infinity;
}

function ordenarTurmasDesc(a, b) {
  return getTurmaFimKey(b) - getTurmaFimKey(a);
}

function getEventoFimKey(evento) {
  const turmas = Array.isArray(evento?.turmas) ? evento.turmas : [];

  return Math.max(...turmas.map(getTurmaFimKey), -Infinity);
}

function ordenarEventosDesc(a, b) {
  return getEventoFimKey(b) - getEventoFimKey(a);
}

function getErrorMessage(error, fallback) {
  return (
    error?.data?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function unwrapData(response) {
  return response?.data !== undefined ? response.data : response;
}

function normalizeDetalhePresenca(response, turma) {
  const data = unwrapData(response);

  const datasBrutas = Array.isArray(data?.datas)
    ? data.datas
    : Array.isArray(turma?.datas)
      ? turma.datas
      : Array.isArray(turma?.encontros)
        ? turma.encontros
        : [];

  const datas = datasBrutas
    .map((item) => ({
      data: ymd(item?.data || item),
      horario_inicio: hhmm(item?.horario_inicio || item?.inicio || turma?.horario_inicio, ""),
      horario_fim: hhmm(item?.horario_fim || item?.fim || turma?.horario_fim, ""),
    }))
    .filter((item) => item.data)
    .sort((a, b) => a.data.localeCompare(b.data));

  const usuarios = Array.isArray(data?.usuarios) ? data.usuarios : [];

  const presencas = [];

  for (const usuario of usuarios) {
    const usuario_id = toPositiveInt(usuario?.usuario_id || usuario?.id);

    if (!usuario_id) continue;

    for (const presenca of usuario?.presencas || []) {
      const data_presenca = ymd(presenca?.data_presenca || presenca?.data);
      if (!data_presenca) continue;

      presencas.push({
        usuario_id,
        data_presenca,
        presente: presenca?.presente === true,
        confirmado_em: presenca?.confirmado_em || null,
      });
    }
  }

  return {
    datas,
    usuarios,
    presencas,
  };
}

function getPresencaMap(presencas = []) {
  const map = new Map();

  for (const item of presencas) {
    const usuario_id = toPositiveInt(item?.usuario_id);
    const data = ymd(item?.data_presenca || item?.data);

    if (!usuario_id || !data) continue;

    map.set(`${usuario_id}#${data}`, item?.presente === true);
  }

  return map;
}

/* ─────────────────────────────────────────────────────────────
 * UI local
 * ───────────────────────────────────────────────────────────── */

function StatPill({ icon: Icon, label, value, tone = "slate" }) {
  const tones = {
    slate:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/25 dark:text-slate-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/25 dark:text-amber-200",
    rose:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-200",
    violet:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-900/25 dark:text-violet-200",
  };

  return (
    <span
      className={classNames(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold",
        tones[tone] || tones.slate
      )}
    >
      {Icon ? <Icon size={14} aria-hidden="true" /> : null}
      {label ? <span>{label}</span> : null}
      {value !== undefined && value !== null ? <strong>{value}</strong> : null}
    </span>
  );
}

function EmptyBox({ title, text }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex items-start gap-3">
        <AlertCircle
          className="mt-0.5 h-5 w-5 text-slate-500"
          aria-hidden="true"
        />

        <div className="min-w-0">
          <p className="font-black text-slate-900 dark:text-white">{title}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{text}</p>
        </div>
      </div>
    </div>
  );
}

function VisaoPorData({
  turma,
  inscritos = [],
  datas = [],
  presencas = [],
}) {
  const [dataAtiva, setDataAtiva] = useState(() => datas?.[0]?.data || "");

  const dataSelecionada = useMemo(() => {
    if (dataAtiva && datas.some((item) => item.data === dataAtiva)) {
      return dataAtiva;
    }

    return datas?.[0]?.data || "";
  }, [dataAtiva, datas]);

  const presencaMap = useMemo(() => getPresencaMap(presencas), [presencas]);

  const resumo = useMemo(() => {
    let presentes = 0;
    let ausentes = 0;

    for (const inscrito of inscritos) {
      const usuario_id = toPositiveInt(inscrito?.usuario_id || inscrito?.id);

      if (!usuario_id || !dataSelecionada) continue;

      if (presencaMap.get(`${usuario_id}#${dataSelecionada}`) === true) {
        presentes += 1;
      } else {
        ausentes += 1;
      }
    }

    return {
      total: inscritos.length,
      presentes,
      ausentes,
    };
  }, [dataSelecionada, inscritos, presencaMap]);

  if (!Array.isArray(datas) || datas.length === 0) {
    return (
      <EmptyBox
        title="Nenhuma data encontrada"
        text="Não há datas retornadas para esta turma."
      />
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/30">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h5 className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Visão por data
          </h5>

          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Turma: {turma?.nome || `#${getTurmaId(turma) || "—"}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatPill icon={Users} label="Inscritos" value={resumo.total} />
          <StatPill
            icon={BadgeCheck}
            label="Presentes"
            value={resumo.presentes}
            tone="emerald"
          />
          <StatPill
            icon={AlertCircle}
            label="Ausentes"
            value={resumo.ausentes}
            tone="rose"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {datas.map((item) => {
          const active = item.data === dataSelecionada;

          return (
            <button
              key={item.data}
              type="button"
              onClick={() => setDataAtiva(item.data)}
              className={classNames(
                "rounded-full border px-3 py-1.5 text-xs font-black transition",
                active
                  ? "border-violet-700 bg-violet-700 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {formatarDataBR(item.data)}
            </button>
          );
        })}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 dark:bg-slate-900/60 dark:text-slate-200">
            <tr>
              <th scope="col" className="px-3 py-3 text-left font-black">
                Nome
              </th>
              <th scope="col" className="px-3 py-3 text-left font-black">
                Situação
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {inscritos.map((inscrito) => {
              const usuario_id = toPositiveInt(
                inscrito?.usuario_id || inscrito?.id
              );

              const presente =
                usuario_id && dataSelecionada
                  ? presencaMap.get(`${usuario_id}#${dataSelecionada}`) === true
                  : false;

              return (
                <tr key={usuario_id || inscrito?.email || inscrito?.nome}>
                  <td className="px-3 py-3 text-slate-950 dark:text-white">
                    <div className="font-semibold">
                      {inscrito?.nome || "Participante"}
                    </div>
                    {inscrito?.email ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {inscrito.email}
                      </div>
                    ) : null}
                  </td>

                  <td className="px-3 py-3">
                    <StatusPresencaBadge
                      status={presente ? "presente" : "faltou"}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Componente principal
 * ───────────────────────────────────────────────────────────── */

export default function ListaTurmasPresenca({
  eventos = [],
  hoje,
  carregarInscritos,
  carregarAvaliacao,
  gerarRelatorioPDF,
  inscritosPorTurma = {},
  avaliacaoPorTurma = {},
  navigate,
  modoadministradorPresencas = false,
  onTurmaRemovida,
  mostrarBotaoRemover = false,
  agrupamento = "pessoa",
}) {
  const [turmaExpandidaId, setTurmaExpandidaId] = useState(null);
  const [presencasPorTurma, setPresencasPorTurma] = useState({});
  const [carregandoTurmas, setCarregandoTurmas] = useState(() => new Set());
  const [confirmRemover, setConfirmRemover] = useState(null);
  const [removendoId, setRemovendoId] = useState(null);
  const [idsRemovidos, setIdsRemovidos] = useState(() => new Set());

  const agora = hoje instanceof Date ? hoje : new Date();

  const eventosOrdenados = useMemo(() => {
    return (Array.isArray(eventos) ? eventos : [])
      .slice()
      .sort(ordenarEventosDesc);
  }, [eventos]);

  const marcarCarregando = useCallback((turma_id, loading) => {
    setCarregandoTurmas((prev) => {
      const next = new Set(prev);

      if (loading) next.add(String(turma_id));
      else next.delete(String(turma_id));

      return next;
    });
  }, []);

  const carregarPresencas = useCallback(
    async (turma) => {
      const turma_id = getTurmaId(turma);

      if (!turma_id) {
        notifyError("turma_id inválido para carregar presenças.");
        return;
      }

      try {
        marcarCarregando(turma_id, true);

        const response = await api.presenca.turmaDetalhe(turma_id, {
          on403: "silent",
        });

        const detalhe = normalizeDetalhePresenca(response, turma);

        setPresencasPorTurma((prev) => ({
          ...prev,
          [turma_id]: detalhe,
        }));
      } catch (error) {
        notifyError(
          getErrorMessage(error, "Erro ao carregar presenças da turma.")
        );

        setPresencasPorTurma((prev) => ({
          ...prev,
          [turma_id]: {
            datas: [],
            usuarios: [],
            presencas: [],
          },
        }));
      } finally {
        marcarCarregando(turma_id, false);
      }
    },
    [marcarCarregando]
  );

  const removerTurmaAgora = useCallback(
    async ({ turma_id }) => {
      if (!turma_id) return false;

      if (typeof api?.turma?.remover !== "function") {
        notifyError(
          "Remoção de turma não está disponível no contrato atual do frontend."
        );
        return false;
      }

      try {
        setRemovendoId(turma_id);

        await api.turma.remover(turma_id);

        setIdsRemovidos((prev) => {
          const next = new Set(prev);
          next.add(String(turma_id));
          return next;
        });

        notifySuccess("Turma removida com sucesso.");
        onTurmaRemovida?.(turma_id);

        return true;
      } catch (error) {
        const status = Number(error?.status || error?.response?.status || 0);

        if (status === 409) {
          notifyError(
            "Não é possível excluir esta turma porque já existem registros vinculados."
          );
        } else if (status === 404) {
          notifyWarning("Turma não encontrada. Atualize a página.");
        } else {
          notifyError(getErrorMessage(error, "Erro ao remover turma."));
        }

        return false;
      } finally {
        setRemovendoId(null);
      }
    },
    [onTurmaRemovida]
  );

  const toggleTurma = useCallback(
    async (turma) => {
      const turma_id = getTurmaId(turma);

      if (!turma_id) {
        notifyError("turma_id inválido.");
        return;
      }

      const estaExpandida = turmaExpandidaId === turma_id;

      if (estaExpandida) {
        setTurmaExpandidaId(null);
        return;
      }

      setTurmaExpandidaId(turma_id);

      try {
        await Promise.allSettled([
          carregarInscritos?.(turma_id),
          carregarAvaliacao?.(turma_id),
          carregarPresencas(turma),
        ]);
      } catch {
        // Promise.allSettled já captura; mantido por segurança.
      }
    },
    [
      carregarAvaliacao,
      carregarInscritos,
      carregarPresencas,
      turmaExpandidaId,
    ]
  );

  if (!eventosOrdenados.length) {
    return (
      <NadaEncontrado
        titulo="Nenhuma turma encontrada"
        subtitulo="Não há eventos ou turmas disponíveis para gestão de presenças."
      />
    );
  }

  return (
    <>
      <div
        className="grid grid-cols-1 gap-8"
        role="region"
        aria-label="Gestão de presenças por turmas"
      >
        <AnimatePresence>
          {eventosOrdenados.map((evento) => {
            const eventoId = getEventoId(evento) || evento?.titulo;

            const turmasValidas = (Array.isArray(evento?.turmas)
              ? evento.turmas
              : []
            )
              .filter((turma) => {
                const turma_id = getTurmaId(turma);

                return turma_id && !idsRemovidos.has(String(turma_id));
              })
              .sort(ordenarTurmasDesc);

            return (
              <motion.section
                key={eventoId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/45"
              >
                <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 opacity-80" />

                <div className="p-4 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="break-words text-lg font-black text-slate-950 dark:text-white sm:text-xl">
                        Evento: {evento?.titulo || "—"}
                      </h2>

                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {turmasValidas.length} turma
                        {turmasValidas.length === 1 ? "" : "s"} vinculada
                        {turmasValidas.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>

                  {!turmasValidas.length ? (
                    <div className="mt-5">
                      <EmptyBox
                        title="Nenhuma turma válida"
                        text="Este evento não possui turmas disponíveis para gestão de presença."
                      />
                    </div>
                  ) : (
                    <div className="mt-5 grid grid-cols-1 gap-4">
                      {turmasValidas.map((turma) => {
                        const turma_id = getTurmaId(turma);
                        const status = getStatusTurma(turma, agora);
                        const estaExpandida = turmaExpandidaId === turma_id;
                        const isLoadingTurma = carregandoTurmas.has(
                          String(turma_id)
                        );

                        const inscritos = inscritosPorTurma?.[turma_id] || [];
                        const detalhe = presencasPorTurma?.[turma_id] || {
                          datas: [],
                          usuarios: [],
                          presencas: [],
                        };

                        const avaliacao = avaliacaoPorTurma?.[turma_id] || [];
                        const datas = detalhe.datas || [];
                        const presencas = detalhe.presencas || [];

                        return (
                          <motion.article
                            key={turma_id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/35"
                            aria-labelledby={`turma-${turma_id}-titulo`}
                          >
                            <div
                              className={classNames(
                                "absolute left-0 right-0 top-0 h-1.5",
                                statusBarClass(status)
                              )}
                              aria-hidden="true"
                            />

                            <div className="p-4 sm:p-5">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3
                                      id={`turma-${turma_id}-titulo`}
                                      className="break-words text-base font-black text-slate-950 dark:text-white"
                                    >
                                      {turma?.nome || `Turma ${turma_id}`}
                                    </h3>

                                    <span className={statusPillClass(status)}>
                                      {statusLabel(status)}
                                    </span>
                                  </div>

                                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                    <span className="inline-flex items-center gap-1">
                                      <CalendarDays size={14} aria-hidden="true" />
                                      {formatarPeriodoTurma(turma)}
                                    </span>
                                  </p>

                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <StatPill
                                      icon={Users}
                                      label="Inscritos"
                                      value={inscritos.length}
                                    />

                                    <StatPill
                                      icon={CalendarDays}
                                      label="Dias"
                                      value={datas.length || "—"}
                                    />

                                    <StatPill
                                      icon={ClipboardCheck}
                                      label="Avaliações"
                                      value={
                                        Array.isArray(avaliacao)
                                          ? avaliacao.length
                                          : "—"
                                      }
                                      tone="violet"
                                    />
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  {mostrarBotaoRemover && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setConfirmRemover({
                                          turma_id,
                                          turma_nome: turma?.nome,
                                        })
                                      }
                                      disabled={removendoId === turma_id}
                                      className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-800 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/40 dark:text-rose-200 dark:hover:bg-rose-900/20"
                                      aria-label={
                                        removendoId === turma_id
                                          ? "Removendo turma"
                                          : `Remover turma ${turma?.nome || turma_id}`
                                      }
                                    >
                                      <Trash2 size={14} aria-hidden="true" />
                                      {removendoId === turma_id
                                        ? "Removendo..."
                                        : "Remover"}
                                    </button>
                                  )}

                                  {modoadministradorPresencas &&
                                    typeof gerarRelatorioPDF === "function" && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          gerarRelatorioPDF(
                                            turma_id,
                                            turma?.nome || `turma_${turma_id}`
                                          )
                                        }
                                        className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-900 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                                        title="Exportar lista de presença em PDF"
                                      >
                                        <Download className="h-4 w-4" />
                                        Exportar PDF
                                      </button>
                                    )}

                                  {modoadministradorPresencas && (
                                    <Botao
                                      type="button"
                                      variant="primario"
                                      size="sm"
                                      onClick={() => toggleTurma(turma)}
                                      aria-expanded={estaExpandida}
                                      aria-controls={`turma-${turma_id}-detalhes`}
                                      className="rounded-2xl"
                                    >
                                      <span className="inline-flex items-center gap-2">
                                        {estaExpandida ? "Recolher" : "Ver detalhes"}
                                        {estaExpandida ? (
                                          <ChevronUp
                                            size={16}
                                            aria-hidden="true"
                                          />
                                        ) : (
                                          <ChevronDown
                                            size={16}
                                            aria-hidden="true"
                                          />
                                        )}
                                      </span>
                                    </Botao>
                                  )}
                                </div>
                              </div>

                              <AnimatePresence>
                                {modoadministradorPresencas && estaExpandida && (
                                  <motion.div
                                    id={`turma-${turma_id}-detalhes`}
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-4 overflow-hidden"
                                  >
                                    {isLoadingTurma ? (
                                      <CarregandoSkeleton
                                        texto="Carregando presenças da turma..."
                                        linhas={4}
                                      />
                                    ) : (
                                      <div className="rounded-2xl border border-slate-200 bg-white/75 p-4 dark:border-slate-800 dark:bg-slate-900/45">
                                        {agrupamento === "data" ? (
                                          <VisaoPorData
                                            turma={turma}
                                            inscritos={inscritos}
                                            datas={datas}
                                            presencas={presencas}
                                          />
                                        ) : inscritos.length === 0 ? (
                                          <EmptyBox
                                            title="Nenhum inscrito encontrado"
                                            text="Esta turma ainda não possui inscritos carregados."
                                          />
                                        ) : (
                                          <ControlePresencaInscritos
                                            inscritos={inscritos}
                                            turma={{
                                              ...turma,
                                              turma_id,
                                            }}
                                            presencas={presencas}
                                            datas={datas}
                                            carregarPresencas={() =>
                                              carregarPresencas(turma)
                                            }
                                          />
                                        )}
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </motion.article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.section>
            );
          })}
        </AnimatePresence>
      </div>

      <ModalConfirmacao
        isOpen={!!confirmRemover}
        onClose={() => setConfirmRemover(null)}
        onConfirmar={async () => {
          if (!confirmRemover) return false;

          const ok = await removerTurmaAgora(confirmRemover);

          if (ok) {
            setConfirmRemover(null);
          }

          return ok;
        }}
        titulo="Remover turma"
        mensagem={
          confirmRemover ? (
            <div className="space-y-2">
              <p>
                Remover a turma{" "}
                <strong>
                  {confirmRemover.turma_nome ||
                    `#${confirmRemover.turma_id}`}
                </strong>
                ?
              </p>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                <div className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 h-5 w-5" aria-hidden="true" />

                  <div>
                    <p className="font-black">Atenção</p>
                    <p>
                      Se houver presenças, certificados ou outros registros
                      vinculados, o backend deve bloquear a exclusão.
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

/* ─────────────────────────────────────────────────────────────
 * PropTypes
 * ───────────────────────────────────────────────────────────── */

StatPill.propTypes = {
  icon: PropTypes.elementType,
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  tone: PropTypes.oneOf(["slate", "emerald", "amber", "rose", "violet"]),
};

EmptyBox.propTypes = {
  title: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
};

VisaoPorData.propTypes = {
  turma: PropTypes.object.isRequired,
  inscritos: PropTypes.array,
  datas: PropTypes.array,
  presencas: PropTypes.array,
};

ListaTurmasPresenca.propTypes = {
  eventos: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      evento_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      titulo: PropTypes.string,
      turmas: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
          turma_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
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
  carregarAvaliacao: PropTypes.func.isRequired,
  gerarRelatorioPDF: PropTypes.func,
  inscritosPorTurma: PropTypes.object,
  avaliacaoPorTurma: PropTypes.object,
  navigate: PropTypes.func,
  modoadministradorPresencas: PropTypes.bool,
  onTurmaRemovida: PropTypes.func,
  mostrarBotaoRemover: PropTypes.bool,
  agrupamento: PropTypes.oneOf(["pessoa", "data"]),
};