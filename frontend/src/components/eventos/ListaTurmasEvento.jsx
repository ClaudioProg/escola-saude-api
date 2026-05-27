/* eslint-disable no-console */
// ✅ frontend/src/components/eventos/ListaTurmasEvento.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Lista pública de turmas de evento.
//
// Contratos aplicados:
// - Pasta do domínio: src/components/eventos/
// - Date-only trafega como YYYY-MM-DD
// - Não usar new Date("YYYY-MM-DD")
// - Status oficial interno: programado | andamento | encerrado | sem_datas
// - Rótulo oficial: Datas, não Encontros
// - Horário oficial: HH:mm ou HH:mm:ss convertido para HH:mm
// - Ocupação oficial: vagas_preenchidas
// - Sem turma.inscritos como fonte paralela
// - Sem horário compacto 0830/830 como alias
// - Eventos restritos continuam visíveis, mas inscrição respeita elegibilidade
// - Congresso permite inscrição em múltiplas turmas
// - Outros tipos bloqueiam nova inscrição se já inscrito em uma turma do evento

import { memo, useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Eye,
  Lock,
  Sparkles,
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
   Helpers
────────────────────────────────────────────────────────────── */

function clamp(number, min = 0, max = 100) {
  const value = Number(number);

  if (!Number.isFinite(value)) return min;

  return Math.max(min, Math.min(max, value));
}

function toInt(value, fallback = 0) {
  const n = Number(value);

  if (!Number.isInteger(n) || n < 0) return fallback;

  return n;
}

function toPct(num, den) {
  const n = Number(num) || 0;
  const d = Number(den) || 0;

  if (d <= 0) return 0;

  return clamp(Math.round((n / d) * 100));
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function isDateOnly(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function ymdLocal(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());

  return `${y}-${m}-${d}`;
}

function hojeIsoLocal() {
  return ymdLocal(new Date());
}

function normalizeDateOnly(value) {
  if (!value) return "";

  if (typeof value === "object" && value?.data) {
    return normalizeDateOnly(value.data);
  }

  if (value instanceof Date) {
    return ymdLocal(value);
  }

  if (typeof value === "string") {
    const s = value.trim();

    if (isDateOnly(s)) return s;

    const matchIso = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (matchIso) return matchIso[1];
  }

  return "";
}

function brDate(value) {
  const date = normalizeDateOnly(value);

  if (!date) return "";

  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function normalizeTime(value) {
  if (typeof value !== "string") return "";

  const raw = value.trim();

  if (!raw) return "";
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw.slice(0, 5);

  return "";
}

function toDateLocal(dateOnly, time = "00:00") {
  if (!isDateOnly(dateOnly)) return null;

  const [year, month, day] = dateOnly.split("-").map(Number);
  const [hour, minute] = String(time || "00:00")
    .split(":")
    .map((part) => parseInt(part || "0", 10));

  return new Date(
    year,
    (month || 1) - 1,
    day || 1,
    Number.isFinite(hour) ? hour : 0,
    Number.isFinite(minute) ? minute : 0,
    0,
    0
  );
}

function statusPorJanela({ dataInicio, dataFim, horaInicio, horaFim, agora }) {
  if (!dataInicio || !dataFim) return STATUS_TURMA.SEM_DATAS;

  const start = toDateLocal(dataInicio, horaInicio || "00:00");
  const end = toDateLocal(dataFim, horaFim || "23:59");

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return STATUS_TURMA.SEM_DATAS;
  }

  if (agora < start) return STATUS_TURMA.PROGRAMADO;
  if (agora > end) return STATUS_TURMA.ENCERRADO;

  return STATUS_TURMA.ANDAMENTO;
}

function statusLabel(status) {
  if (status === STATUS_TURMA.ANDAMENTO) return "Em andamento";
  if (status === STATUS_TURMA.ENCERRADO) return "Encerrada";
  if (status === STATUS_TURMA.SEM_DATAS) return "Sem datas";

  return "Programada";
}

function getDatasTurma(turma) {
  const datas = Array.isArray(turma?.datas) ? turma.datas : [];

  if (datas.length) {
    return datas
      .map((item) => ({
        data: normalizeDateOnly(item?.data || item),
        horario_inicio: normalizeTime(
          item?.horario_inicio || turma?.horario_inicio || ""
        ),
        horario_fim: normalizeTime(item?.horario_fim || turma?.horario_fim || ""),
      }))
      .filter((item) => item.data)
      .sort((a, b) => a.data.localeCompare(b.data));
  }

  const dataInicio = normalizeDateOnly(turma?.data_inicio);
  const dataFim = normalizeDateOnly(turma?.data_fim || turma?.data_inicio);
  const horarioInicio = normalizeTime(turma?.horario_inicio || "");
  const horarioFim = normalizeTime(turma?.horario_fim || "");

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

  const inicioComHora = datas.find((item) => item.horario_inicio);
  const fimComHora = [...datas].reverse().find((item) => item.horario_fim);

  const horarioInicio =
    normalizeTime(turma?.horario_inicio || "") ||
    inicioComHora?.horario_inicio ||
    "";

  const horarioFim =
    normalizeTime(turma?.horario_fim || "") ||
    fimComHora?.horario_fim ||
    "";

  return {
    datas,
    dataInicio,
    dataFim,
    horarioInicio,
    horarioFim,
  };
}

function getVagasTotal(turma) {
  return toInt(turma?.vagas_total, 0);
}

function getVagasPreenchidas(turma) {
  return toInt(turma?.vagas_preenchidas, 0);
}

function barraClassPorPerc(percentual) {
  if (percentual >= 90) return "bg-gradient-to-r from-rose-600 to-red-600";
  if (percentual >= 70) return "bg-gradient-to-r from-amber-500 to-orange-500";

  return "bg-gradient-to-r from-emerald-600 to-teal-600";
}

function statusChipClass(status) {
  if (status === STATUS_TURMA.ANDAMENTO) {
    return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/25 dark:text-amber-200 dark:border-amber-800";
  }

  if (status === STATUS_TURMA.ENCERRADO) {
    return "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-200 dark:border-zinc-700";
  }

  if (status === STATUS_TURMA.SEM_DATAS) {
    return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700";
  }

  return "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-200 dark:border-emerald-800";
}

function normalizarTipoEvento(tipo = "") {
  return String(tipo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const chipBase =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm";

const chipStyles = {
  lotada:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/25 dark:text-rose-200 dark:border-rose-800",
  inscrito:
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/25 dark:text-indigo-200 dark:border-indigo-700",
  conflito:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/25 dark:text-amber-200 dark:border-amber-800",
  restrito:
    "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/25 dark:text-violet-200 dark:border-violet-800",
};

/* ─────────────────────────────────────────────────────────────
   Componentes internos
────────────────────────────────────────────────────────────── */

const MiniStat = memo(function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-2 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
          <Icon
            className="h-4 w-4 text-zinc-700 dark:text-zinc-200"
            aria-hidden="true"
          />
        </span>

        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            {label}
          </div>
          <div className="truncate text-sm font-extrabold text-zinc-900 dark:text-white">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
});

const TurmaCard = memo(function TurmaCard({
  turma,
  hojeIso,
  agora,
  isCongresso,
  inscritosSet,
  conflitosSet,
  openDates,
  onToggleDates,
  inscrever,
  inscrevendo,
  jaInscritoNoEvento,
  jaorganizadorDoEvento,
  mostrarStatusTurma,
  exibirRealizadosTotal,
  podeSeInscreverNoEvento,
  motivoBloqueioEvento,
}) {
  const turmaId = Number(turma?.id);
  const hasTurmaId = Number.isInteger(turmaId) && turmaId > 0;

  const jaInscrito = hasTurmaId && inscritosSet.has(turmaId);
  const emConflito = hasTurmaId && conflitosSet.has(turmaId);

  const bloquearOutrasTurmas =
    !isCongresso && jaInscritoNoEvento && !jaInscrito;

  const vagas = getVagasTotal(turma);
  const vagasPreenchidas = getVagasPreenchidas(turma);
  const inscritos = jaInscrito && vagasPreenchidas === 0 ? 1 : vagasPreenchidas;

  const temLimiteVagas = vagas > 0;
  const percentual = temLimiteVagas ? toPct(inscritos, vagas) : 0;
  const lotada = temLimiteVagas && inscritos >= vagas;

  const { datas, dataInicio, dataFim, horarioInicio, horarioFim } =
    getRangeTurma(turma);

  const statusTurma = statusPorJanela({
    dataInicio,
    dataFim,
    horaInicio: horarioInicio,
    horaFim: horarioFim,
    agora,
  });

  const encerrada = statusTurma === STATUS_TURMA.ENCERRADO;
  const semDatas = statusTurma === STATUS_TURMA.SEM_DATAS;

  const datasUnicas = [
    ...new Set(datas.map((item) => item.data).filter(Boolean)),
  ].sort();

  const datasRealizadas = datasUnicas.filter((data) => data <= hojeIso).length;
  const qtdDatas = datasUnicas.length;

  const manyDates = qtdDatas > 12;
  const isOpen = !!openDates[turmaId];

  const visibleDates = manyDates && !isOpen ? datasUnicas.slice(0, 8) : datasUnicas;

  const bloqueadoPororganizador = Boolean(jaorganizadorDoEvento);
  const bloqueadoPorElegibilidadeEvento = !podeSeInscreverNoEvento;
  const carregando = Number(inscrevendo) === turmaId;

  const disabled =
    !hasTurmaId ||
    bloqueadoPororganizador ||
    carregando ||
    jaInscrito ||
    lotada ||
    bloquearOutrasTurmas ||
    emConflito ||
    bloqueadoPorElegibilidadeEvento ||
    encerrada ||
    semDatas;

  const motivo =
    (!hasTurmaId && "Turma sem identificador válido") ||
    (bloqueadoPororganizador && "Você é organizador deste evento") ||
    (jaInscrito && "Você já está inscrito nesta turma") ||
    (bloqueadoPorElegibilidadeEvento &&
      (motivoBloqueioEvento || "Inscrição indisponível para o seu perfil")) ||
    (emConflito && "Conflito de horário com outra turma já inscrita") ||
    (bloquearOutrasTurmas && "Você já está inscrito em uma turma deste evento") ||
    (lotada && "Turma lotada") ||
    (encerrada && "Turma encerrada") ||
    (semDatas && "Turma sem datas definidas") ||
    "";

  const datasLabel =
    dataInicio && dataFim
      ? `${brDate(dataInicio)} a ${brDate(dataFim)}`
      : dataInicio
        ? `A partir de ${brDate(dataInicio)}`
        : dataFim
          ? `Até ${brDate(dataFim)}`
          : "Data a definir";

  const horarioLabel =
    horarioInicio && horarioFim ? `${horarioInicio} às ${horarioFim}` : "a definir";

  const ctaLabel = carregando
    ? "Processando..."
    : jaorganizadorDoEvento
      ? "organizador do evento"
      : jaInscrito
        ? "Inscrito"
        : bloqueadoPorElegibilidadeEvento
          ? "Inscrição indisponível"
          : emConflito
            ? "Conflito de horário"
            : bloquearOutrasTurmas
              ? "Indisponível"
              : lotada
                ? "Sem vagas"
                : encerrada
                  ? "Turma encerrada"
                  : semDatas
                    ? "Sem datas"
                    : "Inscrever-se";

  return (
    <article className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.35)] transition-all hover:shadow-[0_18px_50px_-28px_rgba(0,0,0,0.55)] dark:border-zinc-800 dark:bg-neutral-900">
      <div className="h-1.5 w-full bg-gradient-to-r from-fuchsia-500 via-indigo-500 to-emerald-500" />

      <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h4 className="break-words text-lg font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-xl">
              {turma?.nome || "Turma"}
            </h4>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <MiniStat icon={CalendarDays} label="Período" value={datasLabel} />
              <MiniStat icon={Clock3} label="Horário" value={horarioLabel} />
              <MiniStat
                icon={Users}
                label="Vagas"
                value={
                  temLimiteVagas
                    ? `${inscritos}/${vagas} (${percentual}%)`
                    : `${inscritos} inscrito(s)`
                }
              />
            </div>

            {Number.isFinite(Number(turma?.carga_horaria)) && (
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Carga horária:{" "}
                <span className="font-semibold">
                  {Number(turma.carga_horaria)}h
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            {(lotada || mostrarStatusTurma) && (
              <span
                className={`${chipBase} ${
                  lotada ? chipStyles.lotada : statusChipClass(statusTurma)
                }`}
                aria-label={
                  lotada ? "Turma lotada" : `Status: ${statusLabel(statusTurma)}`
                }
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {lotada ? "Lotada" : statusLabel(statusTurma)}
              </span>
            )}

            {jaInscrito && (
              <span
                className={`${chipBase} ${chipStyles.inscrito}`}
                title="Você está inscrito nesta turma"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Inscrito
              </span>
            )}

            {emConflito && (
              <span
                className={`${chipBase} ${chipStyles.conflito}`}
                title="Conflito de horário"
              >
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                Conflito
              </span>
            )}

            {bloqueadoPorElegibilidadeEvento && !jaInscrito && (
              <span
                className={`${chipBase} ${chipStyles.restrito}`}
                title={
                  motivoBloqueioEvento ||
                  "Inscrição indisponível para o seu perfil"
                }
              >
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                Restrita ao público elegível
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-200/70 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-4">
          {qtdDatas > 0 ? (
            <>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                  {qtdDatas} data{qtdDatas > 1 ? "s" : ""}

                  {exibirRealizadosTotal && (
                    <span
                      className="ml-2 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-200"
                      title="Datas realizadas até hoje"
                      aria-label={`Realizadas: ${datasRealizadas} de ${qtdDatas}`}
                    >
                      {datasRealizadas}/{qtdDatas} realizadas
                    </span>
                  )}
                </div>

                {temLimiteVagas && (
                  <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    Ocupação:{" "}
                    <span className="text-zinc-900 dark:text-white">
                      {percentual}%
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {visibleDates.map((data, index) => {
                  const jaOcorreu = data <= hojeIso;

                  return (
                    <span
                      key={`${turmaId || turma?.nome}-data-${index}`}
                      className={[
                        "rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm",
                        jaOcorreu
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-200"
                          : "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-200",
                      ].join(" ")}
                      title={jaOcorreu ? "Já ocorreu" : "Ainda por ocorrer"}
                    >
                      {brDate(data)}
                    </span>
                  );
                })}

                {manyDates && (
                  <button
                    type="button"
                    onClick={() => onToggleDates(turmaId)}
                    className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200 dark:hover:bg-zinc-900/60"
                    aria-expanded={isOpen}
                    aria-label={isOpen ? "Mostrar menos datas" : "Mostrar mais datas"}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {isOpen ? "Mostrar menos" : `+${Math.max(0, qtdDatas - 8)} mais`}
                      {isOpen ? (
                        <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Cronograma por datas ainda não definido.
            </div>
          )}
        </div>

        {temLimiteVagas && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <div className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {inscritos} de {vagas} vagas preenchidas
                </span>
              </div>

              <span className="font-semibold">{percentual}%</span>
            </div>

            <div
              className="h-2.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percentual}
              aria-valuetext={`${percentual}% das vagas preenchidas`}
            >
              <div
                className={`h-2.5 ${barraClassPorPerc(percentual)} transition-all`}
                style={{ width: `${percentual}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        )}

        {bloqueadoPorElegibilidadeEvento && !jaInscrito && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900 dark:border-violet-800/50 dark:bg-violet-950/20 dark:text-violet-200">
            <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />

            <span>
              Esta turma está visível para você, mas a inscrição está restrita.{" "}
              <strong>
                {motivoBloqueioEvento ||
                  "Inscrição indisponível para o seu perfil."}
              </strong>
            </span>
          </div>
        )}

        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => {
              if (disabled) return;
              inscrever?.(turma.id);
            }}
            disabled={disabled}
            aria-disabled={disabled}
            title={motivo}
            className={[
              "w-full min-w-[210px] rounded-2xl px-5 py-2.5 font-extrabold transition-all sm:w-auto",
              "focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
              disabled
                ? "cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
                : "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-md hover:brightness-[1.03] hover:shadow-xl",
            ].join(" ")}
            aria-label={
              jaorganizadorDoEvento
                ? "Você é organizador do evento"
                : jaInscrito
                  ? "Inscrito nesta turma"
                  : bloqueadoPorElegibilidadeEvento
                    ? "Inscrição indisponível para o seu perfil"
                    : emConflito
                      ? "Conflito de horário com outra turma já inscrita"
                      : lotada
                        ? "Turma sem vagas"
                        : bloquearOutrasTurmas
                          ? "Inscrição indisponível porque você já está inscrito em outra turma do evento"
                          : encerrada
                            ? "Turma encerrada"
                            : semDatas
                              ? "Turma sem datas definidas"
                              : "Inscrever-se na turma"
            }
          >
            <span className="inline-flex items-center gap-2">
              {ctaLabel}
              {!disabled && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </span>
          </button>
        </div>

        {disabled && motivo && (
          <div className="mt-2 text-center text-[12px] text-zinc-500 dark:text-zinc-400">
            {motivo}
          </div>
        )}
      </div>
    </article>
  );
});

/* ─────────────────────────────────────────────────────────────
   Componente principal
────────────────────────────────────────────────────────────── */

export default function ListaTurmasEvento({
  turmas = [],
  eventoId,
  eventoTipo = "",
  hoje = hojeIsoLocal(),
  inscricaoConfirmadas = [],
  inscrever,
  inscrevendo,
  jaInscritoNoEvento = false,
  jaorganizadorDoEvento = false,
  mostrarStatusTurma = true,
  exibirRealizadosTotal = false,
  turmasEmConflito = [],
  podeSeInscreverNoEvento = true,
  motivoBloqueioEvento = "",
}) {
  const isCongresso = normalizarTipoEvento(eventoTipo) === "congresso";

  const inscritosSet = useMemo(
    () =>
      new Set(
        (Array.isArray(inscricaoConfirmadas) ? inscricaoConfirmadas : [])
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0)
      ),
    [inscricaoConfirmadas]
  );

  const conflitosSet = useMemo(
    () =>
      new Set(
        (Array.isArray(turmasEmConflito) ? turmasEmConflito : [])
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0)
      ),
    [turmasEmConflito]
  );

  const hojeIso = useMemo(() => normalizeDateOnly(hoje) || hojeIsoLocal(), [hoje]);
  const agora = useMemo(() => new Date(), [hojeIso]);

  const [openDates, setOpenDates] = useState({});

  const handleToggleDates = useCallback((turmaId) => {
    setOpenDates((prev) => ({
      ...prev,
      [turmaId]: !prev[turmaId],
    }));
  }, []);

  const turmasOrdenadas = useMemo(() => {
    return [...(Array.isArray(turmas) ? turmas : [])].sort((a, b) => {
      const aRange = getRangeTurma(a);
      const bRange = getRangeTurma(b);

      if (
        aRange.dataInicio &&
        bRange.dataInicio &&
        aRange.dataInicio !== bRange.dataInicio
      ) {
        return aRange.dataInicio.localeCompare(bRange.dataInicio);
      }

      if (aRange.dataInicio && !bRange.dataInicio) return -1;
      if (!aRange.dataInicio && bRange.dataInicio) return 1;

      return String(a?.nome || "").localeCompare(String(b?.nome || ""), "pt-BR");
    });
  }, [turmas]);

  if (!turmasOrdenadas.length) {
    return (
      <div
        id={`turmas-${eventoId}`}
        className="mt-5 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400"
      >
        Nenhuma turma disponível para este evento no momento.
      </div>
    );
  }

  return (
    <div id={`turmas-${eventoId}`} className="mt-5 space-y-5">
      {turmasOrdenadas.map((turma) => (
        <TurmaCard
          key={
            turma?.id ||
            `${turma?.nome || "Turma"}-${getRangeTurma(turma).dataInicio || ""}`
          }
          turma={turma}
          hojeIso={hojeIso}
          agora={agora}
          isCongresso={isCongresso}
          inscritosSet={inscritosSet}
          conflitosSet={conflitosSet}
          openDates={openDates}
          onToggleDates={handleToggleDates}
          inscrever={inscrever}
          inscrevendo={inscrevendo}
          jaInscritoNoEvento={jaInscritoNoEvento}
          jaorganizadorDoEvento={jaorganizadorDoEvento}
          mostrarStatusTurma={mostrarStatusTurma}
          exibirRealizadosTotal={exibirRealizadosTotal}
          podeSeInscreverNoEvento={podeSeInscreverNoEvento}
          motivoBloqueioEvento={motivoBloqueioEvento}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PropTypes
────────────────────────────────────────────────────────────── */

const turmaShape = PropTypes.shape({
  id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  nome: PropTypes.string,
  data_inicio: PropTypes.string,
  data_fim: PropTypes.string,
  horario_inicio: PropTypes.string,
  horario_fim: PropTypes.string,
  vagas_total: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  vagas_preenchidas: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  carga_horaria: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  datas: PropTypes.arrayOf(
    PropTypes.shape({
      data: PropTypes.string,
      horario_inicio: PropTypes.string,
      horario_fim: PropTypes.string,
    })
  ),
});

ListaTurmasEvento.propTypes = {
  turmas: PropTypes.arrayOf(turmaShape),
  eventoId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  eventoTipo: PropTypes.string,
  hoje: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  inscricaoConfirmadas: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.number, PropTypes.string])
  ),
  inscrever: PropTypes.func,
  inscrevendo: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  jaInscritoNoEvento: PropTypes.bool,
  jaorganizadorDoEvento: PropTypes.bool,
  mostrarStatusTurma: PropTypes.bool,
  exibirRealizadosTotal: PropTypes.bool,
  turmasEmConflito: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.number, PropTypes.string])
  ),
  podeSeInscreverNoEvento: PropTypes.bool,
  motivoBloqueioEvento: PropTypes.string,
};

MiniStat.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

TurmaCard.propTypes = {
  turma: turmaShape.isRequired,
  hojeIso: PropTypes.string.isRequired,
  agora: PropTypes.instanceOf(Date).isRequired,
  isCongresso: PropTypes.bool.isRequired,
  inscritosSet: PropTypes.instanceOf(Set).isRequired,
  conflitosSet: PropTypes.instanceOf(Set).isRequired,
  openDates: PropTypes.object.isRequired,
  onToggleDates: PropTypes.func.isRequired,
  inscrever: PropTypes.func,
  inscrevendo: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  jaInscritoNoEvento: PropTypes.bool.isRequired,
  jaorganizadorDoEvento: PropTypes.bool.isRequired,
  mostrarStatusTurma: PropTypes.bool.isRequired,
  exibirRealizadosTotal: PropTypes.bool.isRequired,
  podeSeInscreverNoEvento: PropTypes.bool.isRequired,
  motivoBloqueioEvento: PropTypes.string,
};