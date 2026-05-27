/* eslint-disable no-console */
// ✅ frontend/src/components/eventos/CardTurmaAdministrador.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Card administrativo premium de turma vinculada a evento.
//
// Contratos aplicados:
// - Pasta do domínio: src/components/eventos/
// - Componentes visuais globais vêm de ../ui/
// - Date-only seguro: YYYY-MM-DD tratado por partes
// - Sem new Date("YYYY-MM-DD")
// - Sem formatDateBr legado
// - Sem assinante_id como fallback funcional
// - Sem campos paralelos de vagas/carga como fonte principal
// - Sem status em_andamento
// - Sem status desconhecido
// - Status oficial: programado | andamento | encerrado | sem_datas
// - Rótulo oficial: Datas, não Encontros
// - Horário oficial: HH:mm ou HH:mm:ss convertido para HH:mm
// - Contrato principal da turma:
//   {
//     id,
//     nome,
//     datas: [{ data, horario_inicio, horario_fim }],
//     data_inicio,
//     data_fim,
//     horario_inicio,
//     horario_fim,
//     vagas_total,
//     carga_horaria,
//     organizadores,
//     organizador_assinante_id,
//     organizador_assinante
//   }
//
// Diretriz visual:
// - Card administrativo mais claro, com hierarquia, diagnóstico, ações agrupadas,
//   melhor leitura mobile e melhor separação entre informação e operação.

import PropTypes from "prop-types";
import { motion } from "framer-motion";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  QrCode,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Constantes oficiais
────────────────────────────────────────────────────────────── */

const STATUS_TURMA = Object.freeze({
  PROGRAMADO: "programado",
  ANDAMENTO: "andamento",
  ENCERRADO: "encerrado",
  SEM_DATAS: "sem_datas",
});

/* ─────────────────────────────────────────────────────────────
   Helpers date-only / hora
────────────────────────────────────────────────────────────── */

function pad2(value) {
  return String(value).padStart(2, "0");
}

function todayLocalYmd() {
  const now = new Date();

  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate()
  )}`;
}

function isDateOnly(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeDateOnly(value) {
  if (!value) return "";

  if (typeof value === "object" && value?.data) {
    return normalizeDateOnly(value.data);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(
      value.getDate()
    )}`;
  }

  if (typeof value === "string") {
    const raw = value.trim();

    if (isDateOnly(raw)) return raw;

    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : "";
  }

  return "";
}

function normalizeHHmm(value, fallback = "") {
  if (typeof value !== "string") return fallback;

  const raw = value.trim();

  if (!raw) return fallback;
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw.slice(0, 5);

  return fallback;
}

function formatDateBr(value) {
  const date = normalizeDateOnly(value);

  if (!date) return "";

  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

/* ─────────────────────────────────────────────────────────────
   Helpers de turma
────────────────────────────────────────────────────────────── */

function clamp(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) return min;

  return Math.max(min, Math.min(max, number));
}

function toPositiveInt(value, fallback = 0) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 0) return fallback;

  return number;
}

function getDatasTurma(turma) {
  const datas = Array.isArray(turma?.datas) ? turma.datas : [];

  if (datas.length) {
    return datas
      .map((item) => ({
        data: normalizeDateOnly(item?.data || item),
        horario_inicio: normalizeHHmm(
          item?.horario_inicio || turma?.horario_inicio || "",
          ""
        ),
        horario_fim: normalizeHHmm(
          item?.horario_fim || turma?.horario_fim || "",
          ""
        ),
      }))
      .filter((item) => item.data)
      .sort((a, b) => a.data.localeCompare(b.data));
  }

  const dataInicio = normalizeDateOnly(turma?.data_inicio);
  const dataFim = normalizeDateOnly(turma?.data_fim || turma?.data_inicio);
  const horarioInicio = normalizeHHmm(turma?.horario_inicio || "", "");
  const horarioFim = normalizeHHmm(turma?.horario_fim || "", "");

  if (!dataInicio) return [];

  if (dataFim && dataFim !== dataInicio) {
    return [
      {
        data: dataInicio,
        horario_inicio: horarioInicio,
        horario_fim: horarioFim,
      },
      {
        data: dataFim,
        horario_inicio: horarioInicio,
        horario_fim: horarioFim,
      },
    ];
  }

  return [
    {
      data: dataInicio,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
    },
  ];
}

function getRangeTurma(turma) {
  const datas = getDatasTurma(turma);

  const dataInicio =
    datas[0]?.data || normalizeDateOnly(turma?.data_inicio) || "";

  const dataFim =
    datas.at(-1)?.data ||
    normalizeDateOnly(turma?.data_fim) ||
    dataInicio ||
    "";

  const primeiroComHorario = datas.find((item) => item.horario_inicio);
  const ultimoComHorario = [...datas].reverse().find((item) => item.horario_fim);

  const horarioInicio =
    normalizeHHmm(turma?.horario_inicio || "", "") ||
    primeiroComHorario?.horario_inicio ||
    "";

  const horarioFim =
    normalizeHHmm(turma?.horario_fim || "", "") ||
    ultimoComHorario?.horario_fim ||
    "";

  return {
    datas,
    dataInicio,
    dataFim,
    horarioInicio,
    horarioFim,
  };
}

function getStatusKey({ turma, hojeISO }) {
  const { dataInicio, dataFim } = getRangeTurma(turma);

  if (!dataInicio || !dataFim) return STATUS_TURMA.SEM_DATAS;
  if (dataFim < dataInicio) return STATUS_TURMA.SEM_DATAS;

  const today = normalizeDateOnly(hojeISO) || todayLocalYmd();

  if (today < dataInicio) return STATUS_TURMA.PROGRAMADO;
  if (today > dataFim) return STATUS_TURMA.ENCERRADO;

  return STATUS_TURMA.ANDAMENTO;
}

function periodoTexto(turma) {
  const { dataInicio, dataFim } = getRangeTurma(turma);

  if (dataInicio && dataFim) {
    return dataInicio === dataFim
      ? formatDateBr(dataInicio)
      : `${formatDateBr(dataInicio)} a ${formatDateBr(dataFim)}`;
  }

  if (dataInicio) return formatDateBr(dataInicio);

  return "Datas a definir";
}

function horarioTexto(turma) {
  const { horarioInicio, horarioFim } = getRangeTurma(turma);

  if (horarioInicio && horarioFim) return `${horarioInicio} às ${horarioFim}`;
  if (horarioInicio) return `A partir de ${horarioInicio}`;
  if (horarioFim) return `Até ${horarioFim}`;

  return "Horário a definir";
}

function resolveAssinanteNome(turma) {
  if (!turma) return null;

  if (turma?.organizador_assinante?.nome) {
    return turma.organizador_assinante.nome;
  }

  const assinanteId = Number(turma?.organizador_assinante_id);

  if (!Number.isFinite(assinanteId)) return null;

  const organizadores = Array.isArray(turma?.organizadores) ? turma.organizadores : [];

  for (const item of organizadores) {
    const id = Number(typeof item === "object" ? item.id : item);
    const nome = typeof item === "object" ? item?.nome : null;

    if (id === assinanteId) return nome || null;
  }

  return null;
}

function getCargaHoraria(turma) {
  const value = Number(turma?.carga_horaria);

  return Number.isFinite(value) && value > 0 ? value : null;
}

function getorganizadores(turma) {
  const raw = Array.isArray(turma?.organizadores) ? turma.organizadores : [];
  const map = new Map();

  for (const item of raw) {
    const id = Number(item?.id ?? item);

    if (!Number.isFinite(id) || map.has(id)) continue;

    map.set(id, {
      id,
      nome:
        typeof item === "object" && item?.nome
          ? String(item.nome).trim()
          : `organizador ${id}`,
    });
  }

  return [...map.values()];
}

function getStatusText(statusKey) {
  if (statusKey === STATUS_TURMA.PROGRAMADO) return "Programado";
  if (statusKey === STATUS_TURMA.ANDAMENTO) return "Em andamento";
  if (statusKey === STATUS_TURMA.ENCERRADO) return "Encerrado";

  return "Sem datas";
}

/* ─────────────────────────────────────────────────────────────
   UI helpers
────────────────────────────────────────────────────────────── */

const STATUS_BAR = {
  [STATUS_TURMA.PROGRAMADO]: "from-emerald-500 via-teal-500 to-cyan-500",
  [STATUS_TURMA.ANDAMENTO]: "from-amber-500 via-orange-500 to-rose-500",
  [STATUS_TURMA.ENCERRADO]: "from-rose-600 via-red-600 to-zinc-700",
  [STATUS_TURMA.SEM_DATAS]: "from-zinc-400 via-zinc-500 to-zinc-600",
};

function StatusTurmaBadge({ statusKey, label }) {
  const tones = {
    programado:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200",
    andamento:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200",
    encerrado:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200",
    sem_datas:
      "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black ${
        tones[statusKey] || tones.sem_datas
      }`}
    >
      {label}
    </span>
  );
}

function BadgeOcupacao({ pct }) {
  const percentual = clamp(pct, 0, 100);

  const cls =
    percentual >= 100
      ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800/60"
      : percentual >= 75
        ? "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800/60"
        : "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800/60";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${cls}`}>
      {percentual}%
    </span>
  );
}

function ProgressOcupacao({ pct }) {
  const percentual = clamp(pct, 0, 100);

  const barClass =
    percentual >= 100
      ? "bg-red-600"
      : percentual >= 75
        ? "bg-orange-500"
        : "bg-green-600";

  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-800"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentual}
      aria-valuetext={`${percentual}% das vagas preenchidas`}
    >
      <div
        className={`h-full ${barClass} transition-all`}
        style={{ width: `${percentual}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

function InfoTile({ icon: Icon, label, value, tone = "zinc" }) {
  const tones = {
    zinc:
      "border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100",
    sky:
      "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100",
    amber:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
    violet:
      "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-100",
  };

  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${tones[tone] || tones.zinc}`}>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 dark:bg-white/5">
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-wide opacity-65">
            {label}
          </div>
          <div className="truncate text-sm font-black leading-tight">
            {value || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

function InstructorPills({ organizadores, assinanteNome }) {
  if (!organizadores.length && !assinanteNome) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {assinanteNome && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
          title={assinanteNome}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Assinante: {assinanteNome}
        </span>
      )}

      {organizadores.map((organizador) => (
        <span
          key={organizador.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-800 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200"
          title={organizador.nome}
        >
          <span
            className="h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-300"
            aria-hidden="true"
          />
          {organizador.nome}
        </span>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Componente
────────────────────────────────────────────────────────────── */

export default function CardTurmaAdministrador({
  turma,
  inscritos = [],
  hojeISO,
  estaExpandida = false,
  modoAdminPresencas = false,
  carregarInscritos,
  carregarAvaliacao,
  carregarPresencas,
  gerarRelatorioPDF,
  navigate,
  onExpandirOuRecolher,
  somenteInfo = false,
}) {
  if (!turma) return null;

  const turmaId = turma?.id;

  const statusKey = getStatusKey({ turma, hojeISO });
  const statusLabel = getStatusText(statusKey);

  const eventoJaIniciado =
    statusKey === STATUS_TURMA.ANDAMENTO || statusKey === STATUS_TURMA.ENCERRADO;

  const dentroDoPeriodo = statusKey === STATUS_TURMA.ANDAMENTO;

  const vagasTotais = toPositiveInt(turma?.vagas_total, 0);
  const qtdInscritos = Array.isArray(inscritos) ? inscritos.length : 0;

  const pct =
    vagasTotais > 0
      ? clamp(Math.round((qtdInscritos / vagasTotais) * 100), 0, 100)
      : 0;

  const cargaHoraria = getCargaHoraria(turma);
  const assinanteNome = resolveAssinanteNome(turma);
  const organizadores = getorganizadores(turma);

  const periodo = periodoTexto(turma);
  const horario = horarioTexto(turma);

  const { datas } = getRangeTurma(turma);
  const totalDatas = datas.length;

  const tituloId = `turma-${turmaId || "sem-id"}-titulo`;
  const periodoId = `turma-${turmaId || "sem-id"}-periodo`;

  const ir = (path) => {
    if (typeof navigate === "function" && path) navigate(path);
  };

  const barClass = STATUS_BAR[statusKey] || STATUS_BAR[STATUS_TURMA.SEM_DATAS];

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="relative overflow-hidden rounded-[1.35rem] border border-zinc-200 bg-white shadow-[0_14px_45px_-35px_rgba(15,23,42,0.55)] dark:border-zinc-800 dark:bg-zinc-950"
      role="region"
      aria-labelledby={tituloId}
      aria-describedby={periodoId}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${barClass}`}
        aria-hidden="true"
      />

      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <StatusTurmaBadge statusKey={statusKey} label={statusLabel} />

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-bold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {statusLabel}
                  </span>
                </div>

                <h4
                  id={tituloId}
                  className="break-words text-lg font-black leading-tight text-zinc-950 dark:text-white sm:text-xl"
                  title={turma?.nome || "Turma"}
                  aria-live="polite"
                >
                  {turma?.nome || "Turma"}
                </h4>

                <p
                  id={periodoId}
                  className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400"
                >
                  {periodo} · {horario}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <InfoTile
                icon={CalendarDays}
                label="Período"
                value={periodo}
                tone="violet"
              />

              <InfoTile
                icon={Clock}
                label="Horário"
                value={horario}
                tone="sky"
              />

              <InfoTile
                icon={CheckCircle2}
                label="Datas"
                value={totalDatas || "—"}
                tone="zinc"
              />

              <InfoTile
                icon={TrendingUp}
                label="Carga"
                value={cargaHoraria ? `${cargaHoraria}h` : "—"}
                tone="emerald"
              />
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-black text-zinc-900 dark:text-white">
                    Vagas e ocupação
                  </div>

                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Controle administrativo de inscrições desta turma.
                  </div>
                </div>

                <BadgeOcupacao pct={pct} />
              </div>

              {vagasTotais > 0 ? (
                <>
                  <div className="mb-1 flex items-center justify-between text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                    <span>
                      {qtdInscritos} de {vagasTotais} vagas preenchidas
                    </span>
                    <span>{pct}%</span>
                  </div>

                  <ProgressOcupacao pct={pct} />
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-3 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/30 dark:text-zinc-400">
                  Vagas não informadas.
                </div>
              )}
            </div>

            <div className="mt-4">
              <InstructorPills
                organizadores={organizadores}
                assinanteNome={assinanteNome}
              />
            </div>
          </div>

          {!somenteInfo && (
            <div className="w-full shrink-0 xl:w-[280px]">
              <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                <div className="mb-3 text-sm font-black text-zinc-900 dark:text-white">
                  Ações da turma
                </div>

                {!modoAdminPresencas ? (
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => carregarInscritos?.(turmaId)}
                      aria-label="Abrir lista de inscritos"
                      title="Inscritos"
                      variant="outline"
                      cor="verde"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Users size={16} aria-hidden="true" />
                        Inscritos
                      </span>
                    </button>

                    <button
                      onClick={() => carregarAvaliacao?.(turmaId)}
                      aria-label="Abrir avaliações da turma"
                      title="Avaliações"
                      variant="outline"
                      cor="azulPetroleo"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <BarChart3 size={16} aria-hidden="true" />
                        Avaliações
                      </span>
                    </button>

                    {dentroDoPeriodo && (
                      <button
                        onClick={() => ir("/scanner")}
                        aria-label="Abrir leitor de QR Code para presença"
                        title="Registro de presença por QR Code"
                        cor="verde"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <QrCode size={16} aria-hidden="true" />
                          QR Code
                        </span>
                      </button>
                    )}

                    {eventoJaIniciado && (
                      <button
                        onClick={() => gerarRelatorioPDF?.(turmaId)}
                        aria-label="Gerar PDF desta turma"
                        title="Gerar relatório em PDF"
                        variant="outline"
                        cor="laranjaQueimado"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <FileText size={16} aria-hidden="true" />
                          PDF
                        </span>
                      </button>
                    )}

                    <button
                      onClick={() => ir(`/turmas/editar/${turmaId}`)}
                      aria-label="Editar turma"
                      title="Editar turma"
                      variant="outline"
                      cor="amareloOuro"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Edit3 size={16} aria-hidden="true" />
                        Editar
                      </span>
                    </button>

                    <button
                      onClick={() => ir(`/turmas/presencas/${turmaId}`)}
                      aria-label="Ver presenças da turma"
                      title="Presenças"
                      variant="outline"
                      cor="vermelhoCoral"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays size={16} aria-hidden="true" />
                        Presenças
                      </span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (!turmaId) return;

                      onExpandirOuRecolher?.(turmaId);

                      if (!estaExpandida) {
                        carregarInscritos?.(turmaId);
                        carregarAvaliacao?.(turmaId);
                        carregarPresencas?.(turmaId);
                      }
                    }}
                    aria-label={
                      estaExpandida
                        ? "Recolher detalhes da turma"
                        : "Ver detalhes da turma"
                    }
                    rightIcon={<span aria-hidden>{estaExpandida ? "▴" : "▾"}</span>}
                    cor="azulPetroleo"
                  >
                    {estaExpandida ? "Recolher detalhes" : "Ver detalhes"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}

/* ─────────────────────────────────────────────────────────────
   PropTypes
────────────────────────────────────────────────────────────── */

BadgeOcupacao.propTypes = {
  pct: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

ProgressOcupacao.propTypes = {
  pct: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

InfoTile.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  tone: PropTypes.oneOf(["zinc", "emerald", "sky", "amber", "violet"]),
};

InstructorPills.propTypes = {
  organizadores: PropTypes.array,
  assinanteNome: PropTypes.string,
};

CardTurmaAdministrador.propTypes = {
  turma: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    nome: PropTypes.string,
    data_inicio: PropTypes.string,
    data_fim: PropTypes.string,
    horario_inicio: PropTypes.string,
    horario_fim: PropTypes.string,
    vagas_total: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    organizador_assinante_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    organizador_assinante: PropTypes.shape({
      nome: PropTypes.string,
    }),
    organizadores: PropTypes.array,
    carga_horaria: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    datas: PropTypes.arrayOf(
      PropTypes.shape({
        data: PropTypes.string,
        horario_inicio: PropTypes.string,
        horario_fim: PropTypes.string,
      })
    ),
  }).isRequired,

  inscritos: PropTypes.array,
  hojeISO: PropTypes.string,
  estaExpandida: PropTypes.bool,
  modoAdminPresencas: PropTypes.bool,

  carregarInscritos: PropTypes.func,
  carregarAvaliacao: PropTypes.func,
  carregarPresencas: PropTypes.func,
  gerarRelatorioPDF: PropTypes.func,
  navigate: PropTypes.func,
  onExpandirOuRecolher: PropTypes.func,

  somenteInfo: PropTypes.bool,
};