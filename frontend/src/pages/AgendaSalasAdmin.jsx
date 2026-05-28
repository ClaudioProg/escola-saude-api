// 📁 src/pages/AgendaSalasAdmin.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Página administrativa da agenda de salas.
//
// Contratos oficiais usados:
// - GET    /api/sala/agenda-admin?ano=YYYY&mes=M&sala=auditorio|sala_reuniao
// - DELETE /api/sala/admin/reservas/:id
// - GET    /api/sala/admin/reservas/:id/termo-pdf
//
// Status oficiais do backend atual:
// - pendente
// - aprovado
// - rejeitado
// - cancelado
// - bloqueado
//
// Diretrizes v2.0:
// - sem status "confirmado" enquanto não existir no banco;
// - sem status/alias "excluido/excluída/excluida";
// - sem toast direto;
// - sem relatório mensal se o backend não exporta mais essa rota;
// - cancelamento lógico no backend, não exclusão física;
// - resposta padrão ok/data/message/code/meta;
// - UX/UI premium real;
// - mobile-first;
// - acessível;
// - anti-fuso: sem new Date("YYYY-MM-DD").

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSignature,
  FileText,
  Info,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Waves,
  X,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useNavigate } from "react-router-dom";

import api, { apiGetFile } from "../services/api";
import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";
import ModalReservaAdmin from "../components/agendaSalas/ModalReservaAdmin";

/* =========================================================================
   Constantes
=========================================================================== */

const NOMES_MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const DIAS_SEMANA_LONGOS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const CAPACIDADES_SALA = {
  auditorio: {
    conforto: 50,
    max: 60,
    labelCurta: "Auditório",
  },
  sala_reuniao: {
    conforto: 25,
    max: 30,
    labelCurta: "Sala de Reunião",
  },
};

const PERIODOS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
];

const SALAS_ORDEM = ["auditorio", "sala_reuniao"];

const STATUS_OFICIAL = new Set([
  "pendente",
  "aprovado",
  "rejeitado",
  "cancelado",
  "bloqueado",
]);

const STATUS_OCUPA_SLOT = new Set(["pendente", "aprovado", "bloqueado"]);

/* =========================================================================
   Helpers
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function getHojeISO() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function splitISO(dateISO) {
  const [year, month, day] = String(dateISO || "").split("-").map(Number);

  return {
    year: Number.isFinite(year) ? year : 0,
    month: Number.isFinite(month) ? month : 0,
    day: Number.isFinite(day) ? day : 0,
  };
}

function criarMatrixMes(ano, mesIndex) {
  const primeiroDia = new Date(ano, mesIndex, 1);
  const ultimoDia = new Date(ano, mesIndex + 1, 0);
  const primeiroDiaSemana = primeiroDia.getDay();
  const diasNoMes = ultimoDia.getDate();

  const semanas = [];
  let semanaAtual = new Array(7).fill(null);
  let dia = 1;

  for (let index = 0; index < primeiroDiaSemana; index += 1) {
    semanaAtual[index] = null;
  }

  for (let index = primeiroDiaSemana; index < 7; index += 1) {
    semanaAtual[index] = dia;
    dia += 1;
  }

  semanas.push(semanaAtual);

  while (dia <= diasNoMes) {
    semanaAtual = new Array(7).fill(null);

    for (let index = 0; index < 7 && dia <= diasNoMes; index += 1) {
      semanaAtual[index] = dia;
      dia += 1;
    }

    semanas.push(semanaAtual);
  }

  return semanas;
}

function formatISO(ano, mesIndex, dia) {
  return `${ano}-${pad2(mesIndex + 1)}-${pad2(dia)}`;
}

function formatDataBR(dataISO) {
  const { day, month, year } = splitISO(dataISO);

  if (!day || !month || !year) return "—";

  return `${pad2(day)}/${pad2(month)}/${year}`;
}

function formatDateTimeBR(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = date.getFullYear();
  const hour = pad2(date.getHours());
  const minute = pad2(date.getMinutes());

  return `${day}/${month}/${year} às ${hour}:${minute}`;
}

function getDayOfWeekFromISO(dataISO) {
  const { year, month, day } = splitISO(dataISO);

  if (!year || !month || !day) return 0;

  return new Date(year, month - 1, day).getDay();
}

function getDiaSemanaLabelLongo(dataISO) {
  return DIAS_SEMANA_LONGOS[getDayOfWeekFromISO(dataISO)] || "";
}

function keySlot(dataISO, periodo, sala) {
  return `${dataISO}|${periodo}|${sala}`;
}

function unwrapData(response) {
  if (response?.data && typeof response.data === "object" && "ok" in response.data) {
    return response.data.data || {};
  }

  if (response && typeof response === "object" && "ok" in response) {
    return response.data || {};
  }

  return response?.data || response || {};
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function normalizarStatus(status) {
  const value = String(status || "pendente").trim().toLowerCase();

  return STATUS_OFICIAL.has(value) ? value : "pendente";
}

function reservaOcupaSlot(reserva) {
  if (!reserva) return false;

  return STATUS_OCUPA_SLOT.has(normalizarStatus(reserva.status));
}

function normalizeReserva(raw) {
  const dataISO = String(raw?.data || "").slice(0, 10);
  const status = normalizarStatus(raw?.status);

  return {
    id: raw?.id ?? null,
    sala: raw?.sala || null,
    data: dataISO,
    dataISO,
    periodo: raw?.periodo || "manha",
    status,
    qtd_pessoas: raw?.qtd_pessoas ?? null,
    coffee_break: Boolean(raw?.coffee_break),
    observacao: raw?.observacao ?? raw?.observacao_admin ?? "",
    finalidade: raw?.finalidade ?? "",
    solicitante_id: raw?.solicitante_id ?? null,
    solicitante_nome: raw?.solicitante_nome ?? null,
    solicitante_unidade: raw?.solicitante_unidade ?? raw?.unidade_nome ?? null,
    aprovador_id: raw?.aprovador_id ?? null,
    aprovador_nome: raw?.aprovador_nome ?? null,
    termo_aceito: Boolean(raw?.termo_aceito),
    termo_assinado_em: raw?.termo_assinado_em ?? null,
    assinatura_id: raw?.assinatura_id ?? null,
    criado_em: raw?.criado_em ?? raw?.created_at ?? null,
    atualizado_em: raw?.atualizado_em ?? raw?.updated_at ?? null,
    pendente_aprovacao: status === "pendente",
    aprovado: status === "aprovado",
    finalizada_sem_ocupar: status === "rejeitado" || status === "cancelado",
    ocupa_slot: STATUS_OCUPA_SLOT.has(status),
  };
}

function classesStatusSlot(status) {
  const normalized = normalizarStatus(status);

  const map = {
    pendente:
      "bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-100 dark:border-amber-900/60",
    aprovado:
      "bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-100 dark:border-emerald-900/60",
    rejeitado:
      "bg-rose-50 text-rose-900 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-100 dark:border-rose-900/60",
    cancelado:
      "bg-rose-50 text-rose-900 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-100 dark:border-rose-900/60",
    bloqueado:
      "bg-sky-50 text-sky-900 border border-sky-200 dark:bg-sky-950/20 dark:text-sky-100 dark:border-sky-900/60",
  };

  return (
    map[normalized] ||
    "bg-white text-slate-800 border border-slate-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
  );
}

function labelStatus(status) {
  const normalized = normalizarStatus(status);

  const map = {
    pendente: "Pendente",
    aprovado: "Aprovado",
    rejeitado: "Rejeitado",
    cancelado: "Cancelado",
    bloqueado: "Bloqueado",
  };

  return map[normalized] || "Livre";
}

function getStatusTone(status) {
  const normalized = normalizarStatus(status);

  const map = {
    pendente: "text-amber-700 bg-amber-100 border-amber-200",
    aprovado: "text-emerald-700 bg-emerald-100 border-emerald-200",
    rejeitado: "text-rose-700 bg-rose-100 border-rose-200",
    cancelado: "text-rose-700 bg-rose-100 border-rose-200",
    bloqueado: "text-sky-700 bg-sky-100 border-sky-200",
  };

  return map[normalized] || "text-slate-700 bg-slate-100 border-slate-200";
}

function limparPrefixosFeriado(texto) {
  const value = String(texto || "").trim();

  if (!value) return "";

  return value
    .replace(/^feriado\s*[-—:]\s*/i, "")
    .replace(/^ponto\s*facultativo\s*[-—:]\s*/i, "Ponto Facultativo — ")
    .trim();
}

function motivoBloqueio({
  diaSemana,
  ehFeriado,
  feriadoObj,
  ehBloqueada,
  bloqueioObj,
}) {
  if (ehBloqueada) {
    const motivo = String(
      bloqueioObj?.motivo ||
        bloqueioObj?.descricao ||
        bloqueioObj?.titulo ||
        ""
    ).trim();

    return motivo ? `Bloqueado — ${motivo}` : "Bloqueado";
  }

  if (ehFeriado) {
    const nomeCru =
      feriadoObj?.nome ||
      feriadoObj?.titulo ||
      feriadoObj?.descricao ||
      feriadoObj?.motivo ||
      "";

    const nome = limparPrefixosFeriado(nomeCru);
    const tipo = String(feriadoObj?.tipo || "").trim().toLowerCase();

    if (nome) return nome;
    if (tipo === "ponto_facultativo") return "Ponto Facultativo";

    return "Feriado";
  }

  if (diaSemana === 6) return "Sábado";
  if (diaSemana === 0) return "Domingo";

  return "Indisponível";
}

/* =========================================================================
   Componentes de UI locais
=========================================================================== */

function DashboardCard({ icon: Icon, label, value, loading }) {
  return (
    <div className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            {label}
          </p>

          <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
            {loading ? <Skeleton width={60} /> : value}
          </div>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 ring-1 ring-sky-100 dark:bg-sky-950/30 dark:text-sky-200 dark:ring-sky-900">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function SoftIconButton({ title, ariaLabel, onClick, disabled = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cx(
        "rounded-full border border-slate-200 bg-white/80 p-2 shadow-sm transition hover:bg-white",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2",
        "dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:bg-zinc-900 dark:focus-visible:ring-offset-zinc-950",
        disabled ? "cursor-not-allowed opacity-50" : ""
      )}
    >
      {children}
    </button>
  );
}

function AlertBox({ type = "info", title, message, onClose }) {
  const config = {
    info: {
      icon: Info,
      className:
        "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-100",
    },
    success: {
      icon: CheckCircle2,
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100",
    },
    error: {
      icon: AlertCircle,
      className:
        "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-100",
    },
  };

  const item = config[type] || config.info;
  const Icon = item.icon;

  return (
    <div className={cx("rounded-2xl border px-4 py-3 text-sm", item.className)}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 flex-none" />
        <div className="min-w-0 flex-1">
          {title ? <p className="font-black">{title}</p> : null}
          <p className={title ? "mt-1" : ""}>{message}</p>
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1 transition hover:bg-white/40"
            aria-label="Fechar mensagem"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CalendarDayCell({ dia, dataISO, diaInfo, eHoje, onClick }) {
  const { estado, motivo, labelResumo, salasDisponiveis, temPendencia } = diaInfo;

  const cellTone = {
    bloqueado:
      "bg-slate-100 dark:bg-zinc-900/70 border-slate-200 dark:border-zinc-800",
    lotado:
      "bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-900/50",
    parcial: "bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800",
    vazio: "bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800",
  }[estado];

  const chipTone = {
    bloqueado: "bg-slate-200 text-slate-700 border-slate-300",
    lotado: "bg-violet-100 text-violet-800 border-violet-200",
    parcial: "bg-sky-50 text-sky-800 border-sky-200",
    vazio: "bg-emerald-50 text-emerald-800 border-emerald-200",
  }[estado];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "relative min-h-[108px] w-full border-b border-r p-2.5 text-left transition sm:min-h-[132px] sm:p-3 md:min-h-[150px]",
        cellTone,
        eHoje ? "bg-sky-100/70 ring-2 ring-sky-500/70 dark:bg-sky-950/25 dark:ring-sky-700/60" : "",
        "hover:brightness-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
      )}
      aria-label={`Dia ${dia}. ${labelResumo}`}
      title={labelResumo}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div
            className={cx(
              "text-sm font-extrabold sm:text-base",
              eHoje
                ? "text-sky-800 dark:text-sky-200"
                : "text-slate-900 dark:text-white"
            )}
          >
            {dia}
          </div>

          <div className="text-[10px] text-slate-500 dark:text-zinc-400 sm:text-[11px]">
            {DIAS_SEMANA[getDayOfWeekFromISO(dataISO)]}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          {eHoje ? (
            <span className="rounded-full border border-sky-300 bg-sky-200 px-2 py-0.5 text-[10px] font-extrabold text-sky-950 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-100">
              Hoje
            </span>
          ) : null}

          {temPendencia ? (
            <span
              className="h-2.5 w-2.5 rounded-full border border-amber-500 bg-amber-400"
              title="Há solicitação pendente neste dia"
            />
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {(estado === "parcial" || estado === "vazio") && salasDisponiveis > 0 ? (
          <span className="inline-flex w-fit items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold text-sky-700 sm:text-[11px]">
            {salasDisponiveis} sala{salasDisponiveis === 1 ? "" : "s"}
          </span>
        ) : null}

        <span
          className={cx(
            "inline-flex w-fit items-center rounded-full border px-2 py-1 text-[10px] font-extrabold sm:text-[11px]",
            chipTone
          )}
        >
          {estado === "bloqueado"
            ? "Bloqueado"
            : estado === "lotado"
              ? "Sem vaga"
              : "Disponível"}
        </span>

        {estado === "bloqueado" ? (
          <p className="line-clamp-3 text-[11px] leading-snug text-slate-600 dark:text-zinc-300 sm:text-xs">
            {motivo}
          </p>
        ) : null}
      </div>
    </button>
  );
}

function SlotCardDia({ slot, onEditar, onCancelar }) {
  const status = slot?.reserva ? normalizarStatus(slot.reserva.status) : "livre";
  const titulo = slot?.reserva?.finalidade?.trim()
    ? slot.reserva.finalidade.trim()
    : slot?.reserva
      ? labelStatus(status)
      : "Horário livre";

  const solicitante = slot?.reserva?.solicitante_nome || "—";
  const aprovador =
    slot?.reserva?.aprovador_nome || (status === "aprovado" ? "—" : "Não aprovado");

  const temTermo =
    Boolean(slot?.reserva?.termo_aceito) &&
    Boolean(slot?.reserva?.termo_assinado_em) &&
    Boolean(slot?.reserva?.assinatura_id);

  async function abrirPdfTermo() {
    if (!slot?.reserva?.id) return;

    try {
      const { blob, filename } = await apiGetFile(
        `/sala/admin/reservas/${slot.reserva.id}/termo-pdf`
      );

      if (!blob || typeof blob.size !== "number" || blob.size <= 0) {
        throw new Error("Resposta inválida ao gerar o PDF do termo.");
      }

      if (
        blob?.type &&
        !String(blob.type).includes("pdf") &&
        !String(blob.type).includes("octet-stream")
      ) {
        throw new Error("A rota retornou um conteúdo que não é PDF.");
      }

      const blobUrl = URL.createObjectURL(blob);
      const novaAba = window.open(blobUrl, "_blank", "noopener,noreferrer");

      if (!novaAba) {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename || `termo-reserva-${slot.reserva.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (error) {
      console.error("[AgendaSalasAdmin][PDF_TERMO][ERRO]", error);
      slot?.onMessage?.({
        type: "error",
        title: "Não foi possível abrir o termo",
        message:
          "O PDF do termo não pôde ser carregado. Verifique se a reserva possui termo assinado e tente novamente.",
      });
    }
  }

  return (
    <div
      className={cx(
        "rounded-2xl p-3 sm:p-4",
        slot?.reserva
          ? classesStatusSlot(status)
          : "border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-300">
              {slot.periodoLabel}
            </span>

            <span
              className={cx(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold",
                getStatusTone(status)
              )}
            >
              {slot?.reserva ? labelStatus(status) : "Livre"}
            </span>

            {temTermo ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-300">
                <FileSignature className="h-3.5 w-3.5" />
                Termo assinado
              </span>
            ) : null}
          </div>

          <p className="mt-2 break-words text-sm font-extrabold leading-snug text-slate-900 dark:text-zinc-50 sm:text-base">
            {titulo}
          </p>

          {slot?.reserva ? (
            <div className="mt-3 space-y-1.5 text-[12px] text-slate-700 dark:text-zinc-200 sm:text-[13px]">
              <p>
                <span className="font-semibold">Solicitante:</span> {solicitante}
              </p>

              <p>
                <span className="font-semibold">Aprovador:</span> {aprovador}
              </p>

              {slot?.reserva?.solicitante_unidade ? (
                <p>
                  <span className="font-semibold">Unidade:</span>{" "}
                  {slot.reserva.solicitante_unidade}
                </p>
              ) : null}

              {slot?.reserva?.qtd_pessoas ? (
                <p>
                  <span className="font-semibold">Pessoas:</span>{" "}
                  {slot.reserva.qtd_pessoas}
                </p>
              ) : null}

              {slot?.reserva?.coffee_break ? (
                <p>
                  <span className="font-semibold">Coffee break:</span> Sim
                </p>
              ) : null}

              {temTermo ? (
                <p>
                  <span className="font-semibold">Assinado em:</span>{" "}
                  {formatDateTimeBR(slot.reserva.termo_assinado_em)}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-[12px] text-slate-600 dark:text-zinc-300 sm:text-[13px]">
              Horário disponível para criação de reserva administrativa.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onEditar}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-[12px] font-extrabold text-white transition hover:bg-slate-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
        >
          <Pencil className="h-4 w-4" />
          {slot?.reserva ? "Editar" : "Reservar"}
        </button>

        {slot?.reserva && temTermo ? (
          <button
            type="button"
            onClick={abrirPdfTermo}
            className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] font-extrabold text-sky-700 transition hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-300 dark:hover:bg-sky-950/30"
          >
            <FileText className="h-4 w-4" />
            Ver termo
          </button>
        ) : null}

        {slot?.reserva ? (
          <button
            type="button"
            onClick={onCancelar}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-extrabold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/30"
          >
            <Trash2 className="h-4 w-4" />
            Cancelar
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ConfirmCancelModal({ open, reserva, onClose, onConfirm, loading }) {
  if (!open || !reserva) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancelar-reserva-title"
          className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
            <div>
              <h3
                id="cancelar-reserva-title"
                className="text-lg font-extrabold text-slate-900 dark:text-white"
              >
                Cancelar reserva
              </h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                O backend v2.0 preserva o histórico e altera o status para cancelado.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-full border border-slate-200 p-2 transition hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-800 dark:hover:bg-zinc-900"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 py-5">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/20">
              <p className="text-sm text-rose-800 dark:text-rose-200">
                <span className="font-extrabold">Reserva:</span>{" "}
                {reserva.finalidade || "Sem título"}
              </p>
              <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                <span className="font-semibold">Solicitante:</span>{" "}
                {reserva.solicitante_nome || "—"}
              </p>
              <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                <span className="font-semibold">Status atual:</span>{" "}
                {labelStatus(reserva.status)}
              </p>
            </div>

            <p className="mt-4 text-sm text-slate-600 dark:text-zinc-300">
              Confirme apenas se realmente deseja cancelar esta reserva. O horário será liberado para nova utilização.
            </p>
          </div>

          <div className="flex justify-end gap-2 px-5 pb-5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold transition hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              Voltar
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-extrabold text-white transition hover:bg-rose-700 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {loading ? "Cancelando..." : "Cancelar reserva"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalDiaAgenda({
  open,
  diaDetalhe,
  onClose,
  onEditarSlot,
  onCancelarReserva,
  onMessage,
}) {
  if (!open || !diaDetalhe) return null;

  const { dataISO, bloqueado, motivo, salas } = diaDetalhe;

  return (
    <div className="fixed inset-0 z-[80]">
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="absolute inset-0 grid place-items-center p-3 sm:p-5">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-dia-agenda-title"
          className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 dark:border-zinc-800 sm:px-6">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                <CalendarRange className="h-4 w-4" />
                Agenda do dia
              </span>

              <h3
                id="modal-dia-agenda-title"
                className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white sm:text-2xl"
              >
                {formatDataBR(dataISO)} — {getDiaSemanaLabelLongo(dataISO)}
              </h3>

              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                Visualização consolidada de Auditório e Sala de Reunião.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 p-2 transition hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[calc(92vh-90px)] overflow-y-auto px-4 py-5 sm:px-6">
            {bloqueado ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-200 dark:bg-zinc-800">
                  <Lock className="h-6 w-6 text-slate-700 dark:text-zinc-300" />
                </div>

                <h4 className="mt-4 text-xl font-extrabold text-slate-900 dark:text-white">
                  Dia bloqueado
                </h4>

                <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600 dark:text-zinc-300 sm:text-base">
                  {motivo || "Data indisponível para agendamento."}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {salas.map((salaItem) => (
                  <section
                    key={salaItem.sala}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/60 sm:px-5">
                      <div>
                        <h4 className="text-base font-extrabold text-slate-900 dark:text-white sm:text-lg">
                          {salaItem.label}
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-zinc-400">
                          Capacidade conforto: {salaItem.capacidade.conforto} • Máximo:{" "}
                          {salaItem.capacidade.max}
                        </p>
                      </div>

                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {salaItem.ocupados}/2 ocupados
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 md:grid-cols-2">
                      {salaItem.slots.map((slot) => (
                        <SlotCardDia
                          key={`${slot.sala}-${slot.periodo}`}
                          slot={{
                            ...slot,
                            onMessage,
                          }}
                          onEditar={() => onEditarSlot(slot)}
                          onCancelar={() => onCancelarReserva(slot)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Página
=========================================================================== */

function AgendaSalasAdmin() {
  const navigate = useNavigate();
  const liveRef = useRef(null);

  const hojeISO = useMemo(() => getHojeISO(), []);
  const hojeParts = splitISO(hojeISO);

  const [ano, setAno] = useState(hojeParts.year);
  const [mesIndex, setMesIndex] = useState((hojeParts.month || 1) - 1);

  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const [reservasMap, setReservasMap] = useState({});
  const [feriadosMap, setFeriadosMap] = useState({});
  const [datasBloqueadasMap, setDatasBloqueadasMap] = useState({});

  const [modalAberto, setModalAberto] = useState(false);
  const [slotSelecionado, setSlotSelecionado] = useState(null);
  const [reservaSelecionada, setReservaSelecionada] = useState(null);

  const [diaModalAberto, setDiaModalAberto] = useState(false);
  const [diaSelecionadoISO, setDiaSelecionadoISO] = useState(null);

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [reservaParaCancelar, setReservaParaCancelar] = useState(null);
  const [cancelandoReserva, setCancelandoReserva] = useState(false);

  const semanas = useMemo(() => criarMatrixMes(ano, mesIndex), [ano, mesIndex]);

  function setLive(texto) {
    if (liveRef.current) {
      liveRef.current.textContent = texto;
    }
  }

  function showMessage(payload) {
    setMensagem(payload);
    setLive(`${payload.title || ""} ${payload.message || ""}`.trim());
  }

  const mudarMes = useCallback(
    (delta) => {
      let novoMes = mesIndex + delta;
      let novoAno = ano;

      if (novoMes < 0) {
        novoMes = 11;
        novoAno -= 1;
      } else if (novoMes > 11) {
        novoMes = 0;
        novoAno += 1;
      }

      setMesIndex(novoMes);
      setAno(novoAno);
    },
    [ano, mesIndex]
  );

  const hojeClick = useCallback(() => {
    const agoraISO = getHojeISO();
    const parts = splitISO(agoraISO);

    setAno(parts.year);
    setMesIndex((parts.month || 1) - 1);
  }, []);

  const handleKeyNav = useCallback(
    (event) => {
      const tag = String(event?.target?.tagName || "").toLowerCase();

      if (["input", "select", "textarea"].includes(tag)) return;

      if (event.key === "ArrowLeft") mudarMes(-1);
      if (event.key === "ArrowRight") mudarMes(1);

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "h") {
        event.preventDefault();
        hojeClick();
      }
    },
    [mudarMes, hojeClick]
  );

  useEffect(() => {
    document.title = "Agenda de Salas | Administração";
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyNav);

    return () => window.removeEventListener("keydown", handleKeyNav);
  }, [handleKeyNav]);

  const carregarAgenda = useCallback(async () => {
    setLoading(true);
    setMensagem(null);
    setLive("Carregando agenda de salas.");

    try {
      const paramsBase = {
        ano: String(ano),
        mes: String(mesIndex + 1),
      };

      const qsAuditorio = new URLSearchParams({
        ...paramsBase,
        sala: "auditorio",
      }).toString();

      const qsSalaReuniao = new URLSearchParams({
        ...paramsBase,
        sala: "sala_reuniao",
      }).toString();

      const [respAuditorio, respSalaReuniao] = await Promise.all([
        api.get(`/sala/agenda-admin?${qsAuditorio}`),
        api.get(`/sala/agenda-admin?${qsSalaReuniao}`),
      ]);

      const dataAuditorio = unwrapData(respAuditorio);
      const dataSalaReuniao = unwrapData(respSalaReuniao);

      const novoMapaReservas = {};

      for (const item of dataAuditorio.reservas || []) {
        const reserva = normalizeReserva(item);

        if (!reserva.dataISO || !reserva.sala) continue;

        const key = keySlot(reserva.dataISO, reserva.periodo, reserva.sala);

        if (!novoMapaReservas[key]) novoMapaReservas[key] = [];
        novoMapaReservas[key].push(reserva);
      }

      for (const item of dataSalaReuniao.reservas || []) {
        const reserva = normalizeReserva(item);

        if (!reserva.dataISO || !reserva.sala) continue;

        const key = keySlot(reserva.dataISO, reserva.periodo, reserva.sala);

        if (!novoMapaReservas[key]) novoMapaReservas[key] = [];
        novoMapaReservas[key].push(reserva);
      }

      const feriadosBase =
        dataAuditorio.feriados?.length
          ? dataAuditorio.feriados
          : dataSalaReuniao.feriados || [];

      const bloqueiosBase =
        dataAuditorio.datas_bloqueadas?.length
          ? dataAuditorio.datas_bloqueadas
          : dataSalaReuniao.datas_bloqueadas || [];

      const feriados = {};
      const bloqueios = {};

      for (const feriado of feriadosBase) {
        const dataISO = String(feriado.data || "").slice(0, 10);
        if (dataISO) feriados[dataISO] = feriado;
      }

      for (const bloqueio of bloqueiosBase) {
        const dataISO = String(bloqueio.data || "").slice(0, 10);
        if (dataISO) bloqueios[dataISO] = bloqueio;
      }

      setReservasMap(novoMapaReservas);
      setFeriadosMap(feriados);
      setDatasBloqueadasMap(bloqueios);

      setLive("Agenda de salas carregada.");
    } catch (error) {
      console.error("[AgendaSalasAdmin][carregarAgenda]", error);

      showMessage({
        type: "error",
        title: "Erro ao carregar agenda",
        message: getErrorMessage(
          error,
          "Não foi possível carregar a agenda de salas. Verifique sua conexão e tente novamente."
        ),
      });
    } finally {
      setLoading(false);
    }
  }, [ano, mesIndex]);

  useEffect(() => {
    carregarAgenda();
  }, [carregarAgenda]);

  function abrirModalSlot(slot) {
    if (!slot?.dataISO || !slot?.periodo || !slot?.sala) return;

    setSlotSelecionado({
      dataISO: slot.dataISO,
      periodo: slot.periodo,
      sala: slot.sala,
    });

    setReservaSelecionada(slot.reserva || null);
    setModalAberto(true);
  }

  function fecharModalSlot() {
    setModalAberto(false);
    setSlotSelecionado(null);
    setReservaSelecionada(null);
  }

  function fecharModalDia() {
    setDiaModalAberto(false);
    setDiaSelecionadoISO(null);
  }

  function prioridadeReservaAdmin(reserva) {
    if (!reserva) return 0;

    const status = normalizarStatus(reserva.status);

    if (status === "pendente") return 50;
    if (status === "aprovado") return 40;
    if (status === "bloqueado") return 30;
    if (status === "rejeitado" || status === "cancelado") return 0;

    return 10;
  }

  function getReservasSlot(dataISO, periodo, salaKey) {
    const raw = reservasMap[keySlot(dataISO, periodo, salaKey)];

    if (!raw) return [];

    return Array.isArray(raw) ? raw : [raw];
  }

  function getReservaSlot(dataISO, periodo, salaKey) {
    const reservas = getReservasSlot(dataISO, periodo, salaKey);

    if (!reservas.length) return null;

    const reservasAtivas = reservas.filter(reservaOcupaSlot);

    if (!reservasAtivas.length) return null;

    return [...reservasAtivas].sort(
      (a, b) => prioridadeReservaAdmin(b) - prioridadeReservaAdmin(a)
    )[0];
  }

  function getDiaInfo(dataISO) {
    const diaSemana = getDayOfWeekFromISO(dataISO);
    const ehFeriado = Boolean(feriadosMap[dataISO]);
    const ehBloqueada = Boolean(datasBloqueadasMap[dataISO]);
    const ehFimDeSemana = diaSemana === 0 || diaSemana === 6;
    const bloqueado = ehFimDeSemana || ehFeriado || ehBloqueada;

    const motivo = bloqueado
      ? motivoBloqueio({
          diaSemana,
          ehFeriado,
          feriadoObj: feriadosMap[dataISO],
          ehBloqueada,
          bloqueioObj: datasBloqueadasMap[dataISO],
        })
      : null;

    let ocupados = 0;
    let temPendencia = false;
    let salasDisponiveis = 0;

    const totalSlots = SALAS_ORDEM.length * PERIODOS.length;

    const salas = SALAS_ORDEM.map((salaKey) => {
      const slots = PERIODOS.map((periodo) => {
        const reserva = getReservaSlot(dataISO, periodo.value, salaKey);
        const ocupa = reservaOcupaSlot(reserva);

        if (ocupa) ocupados += 1;
        if (reserva?.status === "pendente") temPendencia = true;

        return {
          dataISO,
          sala: salaKey,
          salaLabel: CAPACIDADES_SALA[salaKey].labelCurta,
          periodo: periodo.value,
          periodoLabel: periodo.label,
          reserva,
        };
      });

      const ocupadosSala = slots.filter((slot) => reservaOcupaSlot(slot.reserva)).length;

      if (ocupadosSala < PERIODOS.length) {
        salasDisponiveis += 1;
      }

      return {
        sala: salaKey,
        label: CAPACIDADES_SALA[salaKey].labelCurta,
        capacidade: CAPACIDADES_SALA[salaKey],
        ocupados: ocupadosSala,
        slots,
      };
    });

    let estado = "vazio";

    if (bloqueado) estado = "bloqueado";
    else if (ocupados >= totalSlots) estado = "lotado";
    else if (ocupados > 0) estado = "parcial";

    const labelResumo =
      estado === "bloqueado"
        ? `Bloqueado. ${motivo || ""}`
        : estado === "lotado"
          ? "Sem horário disponível"
          : `${salasDisponiveis} sala(s) com disponibilidade`;

    return {
      dataISO,
      bloqueado,
      motivo,
      ocupados,
      totalSlots,
      estado,
      salas,
      salasDisponiveis,
      temPendencia,
      labelResumo,
    };
  }

  const diasDoMes = useMemo(() => {
    const last = new Date(ano, mesIndex + 1, 0).getDate();

    return Array.from({ length: last }, (_, index) => index + 1);
  }, [ano, mesIndex]);

  const diaInfosMap = useMemo(() => {
    const map = {};

    for (const dia of diasDoMes) {
      const dataISO = formatISO(ano, mesIndex, dia);
      map[dataISO] = getDiaInfo(dataISO);
    }

    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mesIndex, diasDoMes, reservasMap, feriadosMap, datasBloqueadasMap]);

  const diaDetalheSelecionado = useMemo(() => {
    if (!diaSelecionadoISO) return null;

    return diaInfosMap[diaSelecionadoISO] || null;
  }, [diaSelecionadoISO, diaInfosMap]);

  const reservasFlat = useMemo(
    () =>
      Object.values(reservasMap).flatMap((item) =>
        Array.isArray(item) ? item : [item]
      ),
    [reservasMap]
  );

  const reservasAtivas = useMemo(
    () => reservasFlat.filter(reservaOcupaSlot),
    [reservasFlat]
  );

  const totalMes = reservasAtivas.length;

  const totalAprovados = reservasAtivas.filter(
    (reserva) => normalizarStatus(reserva.status) === "aprovado"
  ).length;

  const totalPendentes = reservasAtivas.filter(
    (reserva) => normalizarStatus(reserva.status) === "pendente"
  ).length;

  const totalDiasBloqueados = useMemo(
    () => Object.values(diaInfosMap).filter((dia) => dia?.estado === "bloqueado").length,
    [diaInfosMap]
  );

  const totalDiasLotados = useMemo(
    () => Object.values(diaInfosMap).filter((dia) => dia?.estado === "lotado").length,
    [diaInfosMap]
  );

  const totalDiasComDisponibilidade = useMemo(
    () =>
      Object.values(diaInfosMap).filter(
        (dia) => dia?.estado === "parcial" || dia?.estado === "vazio"
      ).length,
    [diaInfosMap]
  );

  function abrirDia(dataISO) {
    setDiaSelecionadoISO(dataISO);
    setDiaModalAberto(true);
  }

  function abrirEditarSlot(slot) {
    fecharModalDia();
    abrirModalSlot(slot);
  }

  function abrirCancelarReserva(slot) {
    if (!slot?.reserva?.id) {
      showMessage({
        type: "info",
        title: "Horário livre",
        message: "Este horário ainda não possui reserva para cancelar.",
      });
      return;
    }

    setReservaParaCancelar(slot.reserva);
    setConfirmCancelOpen(true);
  }

  function fecharCancelarReserva() {
    if (cancelandoReserva) return;

    setConfirmCancelOpen(false);
    setReservaParaCancelar(null);
  }

  async function confirmarCancelarReserva() {
    if (!reservaParaCancelar?.id) return;

    setCancelandoReserva(true);
    setMensagem(null);

    try {
      await api.delete(`/sala/admin/reservas/${reservaParaCancelar.id}`);

      showMessage({
        type: "success",
        title: "Reserva cancelada",
        message:
          "A reserva foi cancelada com sucesso e o histórico operacional foi preservado.",
      });

      setConfirmCancelOpen(false);
      setReservaParaCancelar(null);
      fecharModalDia();

      await carregarAgenda();
    } catch (error) {
      console.error("[AgendaSalasAdmin][cancelarReserva]", error);

      showMessage({
        type: "error",
        title: "Não foi possível cancelar",
        message: getErrorMessage(
          error,
          "A reserva não pôde ser cancelada. Verifique o status atual e tente novamente."
        ),
      });
    } finally {
      setCancelandoReserva(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-white to-white text-gray-900 dark:from-zinc-950 dark:via-zinc-950 dark:to-black dark:text-gray-100">
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <HeaderHero
  titulo="Agenda administrativa de salas"
  subtitulo="Gestão premium de reservas, bloqueios, disponibilidade e utilização institucional dos ambientes da Escola da Saúde."
  icon={CalendarDays}
/>

     <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8">
      <section className="mb-5 space-y-4">
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
    <DashboardCard
      icon={Sparkles}
      label="Reservas"
      value={totalMes}
      loading={loading}
    />

    <DashboardCard
      icon={ShieldCheck}
      label="Aprovadas"
      value={totalAprovados}
      loading={loading}
    />

    <DashboardCard
      icon={Waves}
      label="Pendentes"
      value={totalPendentes}
      loading={loading}
    />

    <DashboardCard
      icon={Lock}
      label="Bloqueados"
      value={totalDiasBloqueados}
      loading={loading}
    />

    <DashboardCard
      icon={CheckCircle2}
      label="Disponíveis"
      value={totalDiasComDisponibilidade}
      loading={loading}
    />
  </div>

  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
    <button
      type="button"
      onClick={carregarAgenda}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 rounded-[1.5rem] bg-white px-5 py-4 text-sm font-black text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60 dark:bg-zinc-900 dark:text-white dark:ring-zinc-800 dark:hover:bg-zinc-800"
    >
      <RefreshCcw className={cx("h-4 w-4", loading && "animate-spin")} />
      {loading ? "Atualizando..." : "Atualizar agenda"}
    </button>

    <button
      type="button"
      onClick={() => navigate("/admin/calendario-bloqueios")}
      className="inline-flex items-center justify-center gap-2 rounded-[1.5rem] bg-slate-900 px-5 py-4 text-sm font-black text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
    >
      <Lock className="h-4 w-4" />
      Gerenciar bloqueios
    </button>
  </div>
</section>
        {mensagem ? (
          <div className="mb-4">
            <AlertBox
              type={mensagem.type}
              title={mensagem.title}
              message={mensagem.message}
              onClose={() => setMensagem(null)}
            />
          </div>
        ) : null}

        <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-slate-200/60 bg-white/85 px-4 py-3 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/80">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <SoftIconButton
                onClick={() => mudarMes(-1)}
                ariaLabel="Mês anterior"
                title="Mês anterior (atalho ←)"
              >
                <ChevronLeft className="h-4 w-4" />
              </SoftIconButton>

              <div className="px-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  Mês
                </p>
                <p className="text-base font-extrabold leading-tight text-slate-900 dark:text-white sm:text-lg">
                  {NOMES_MESES[mesIndex]} {ano}
                </p>
              </div>

              <SoftIconButton
                onClick={() => mudarMes(1)}
                ariaLabel="Próximo mês"
                title="Próximo mês (atalho →)"
              >
                <ChevronRight className="h-4 w-4" />
              </SoftIconButton>

              <button
                type="button"
                className="ml-1 rounded-2xl bg-sky-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
                onClick={hojeClick}
                aria-label="Ir para o mês atual"
                title="Atalho: Ctrl/Cmd + H"
              >
                Hoje
              </button>

              <button
                type="button"
                onClick={carregarAgenda}
                disabled={loading}
                className="ml-1 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                <RefreshCcw className={cx("h-3.5 w-3.5", loading && "animate-spin")} />
                Atualizar
              </button>
            </div>

            <div className="flex flex-col gap-2 text-xs sm:text-sm md:flex-row md:items-center">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                Clique no dia para ver Auditório + Sala de Reunião
              </span>

              {loading ? (
                <span className="inline-flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                  <Skeleton width={160} height={18} />
                </span>
              ) : (
                <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-200">
                  {totalDiasLotados} dia(s) totalmente ocupado(s)
                </span>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-200">
            Carregando agenda do mês...
          </div>
        ) : null}

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 sm:text-xs">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 text-sky-700 dark:text-sky-300" />
            <p>
              <strong>Feriados</strong>, <strong>pontos facultativos</strong> e{" "}
              <strong>datas bloqueadas</strong> deixam o dia indisponível. Dias com todos os horários ocupados ficam em{" "}
              <strong>lilás suave</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/admin/calendario-bloqueios")}
            className="inline-flex rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-extrabold text-slate-800 transition hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800/70"
          >
            Gerenciar feriados
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-700 dark:text-zinc-300 sm:text-sm">
          {[
            {
              c: "bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-700",
              t: "Dia com disponibilidade",
            },
            {
              c: "bg-violet-100 border-violet-300",
              t: "Dia totalmente ocupado",
            },
            {
              c: "bg-slate-200 border-slate-300",
              t: "Bloqueado / fim de semana / feriado",
            },
            {
              c: "bg-amber-400 border-amber-500",
              t: "Há pendência no dia",
            },
          ].map((item) => (
            <span
              key={item.t}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/70 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-950/40"
            >
              <span className={cx("h-3 w-3 rounded-full border", item.c)} />
              {item.t}
            </span>
          ))}
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-[11px] dark:border-zinc-800 dark:bg-zinc-900 sm:text-sm">
            {DIAS_SEMANA.map((dia) => (
              <div
                key={dia}
                className="py-2.5 text-center font-bold uppercase tracking-wide text-slate-600 dark:text-zinc-300"
              >
                {dia}
              </div>
            ))}
          </div>

          <div className="grid">
            {semanas.map((semana, idxSemana) => (
              <div key={idxSemana} className="grid grid-cols-7">
                {semana.map((dia, idxDia) => {
                  if (!dia) {
                    return (
                      <div
                        key={`${idxSemana}-${idxDia}`}
                        className="min-h-[108px] border-b border-r border-slate-200 bg-slate-50/50 dark:border-zinc-800 dark:bg-zinc-950/30 sm:min-h-[132px] md:min-h-[150px]"
                      />
                    );
                  }

                  const dataISO = formatISO(ano, mesIndex, dia);
                  const diaInfo = diaInfosMap[dataISO];
                  const eHoje = dataISO === hojeISO;

                  return (
                    <CalendarDayCell
                      key={dataISO}
                      dia={dia}
                      dataISO={dataISO}
                      diaInfo={diaInfo}
                      eHoje={eHoje}
                      onClick={() => abrirDia(dataISO)}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {!loading && !Object.keys(reservasMap).length ? (
            <div className="p-6 text-center text-sm text-slate-500 dark:text-zinc-400">
              Nenhuma reserva ativa localizada para {NOMES_MESES[mesIndex]} / {ano}. Os dias continuam clicáveis para criação ou análise.
            </div>
          ) : null}
        </section>
      </main>

      <Footer />

      <ModalDiaAgenda
        open={diaModalAberto}
        diaDetalhe={diaDetalheSelecionado}
        onClose={fecharModalDia}
        onEditarSlot={abrirEditarSlot}
        onCancelarReserva={abrirCancelarReserva}
        onMessage={showMessage}
      />

      <ConfirmCancelModal
        open={confirmCancelOpen}
        reserva={reservaParaCancelar}
        onClose={fecharCancelarReserva}
        onConfirm={confirmarCancelarReserva}
        loading={cancelandoReserva}
      />

      {modalAberto && slotSelecionado
  ? createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5">
        <ModalReservaAdmin
          onClose={fecharModalSlot}
          slot={slotSelecionado}
          reserva={reservaSelecionada}
          sala={slotSelecionado.sala}
          capacidadeSala={CAPACIDADES_SALA[slotSelecionado.sala]}
          recarregar={carregarAgenda}
          origem="calendario_dia"
        />
      </div>,
      document.body
    )
  : null}
    </div>
  );
}

export default AgendaSalasAdmin;