// 📁 src/pages/AgendaSalasUsuario.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Página do usuário para agendamento de salas.
//
// Contratos oficiais usados:
// - GET    /api/sala/agenda-usuario?ano=YYYY&mes=M
// - DELETE /api/sala/minhas/:id
// - POST   /api/sala/minhas/:id/confirmar-uso
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
// - sem aliases "excluido/excluído/negado/solicitado/em_analise";
// - sem toast direto;
// - sem Footer antigo;
// - sem ModalConfirmacao antigo;
// - cancelamento lógico no backend, não exclusão física;
// - resposta padrão ok/data/message/code/meta;
// - UX/UI premium real;
// - mobile-first;
// - acessível;
// - anti-fuso: sem new Date("YYYY-MM-DD") para data civil.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Lock,
  Pencil,
  RefreshCcw,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

import api from "../services/api";
import HeaderHero from "../components/layout/HeaderHero";
import Footer from "../components/layout/Footer";
import ModalSolicitarReserva from "../components/agendaSalas/ModalSolicitarReserva";

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

const SALAS = [
  {
    value: "sala_reuniao",
    label: "Sala de Reunião",
    conforto: 25,
    max: 30,
  },
  {
    value: "auditorio",
    label: "Auditório",
    conforto: 50,
    max: 60,
  },
];

const PERIODOS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
];

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

function getHojeParts() {
  const now = new Date();

  return {
    ano: now.getFullYear(),
    mesIndex: now.getMonth(),
    dia: now.getDate(),
  };
}

function getHojeISO() {
  const { ano, mesIndex, dia } = getHojeParts();

  return `${ano}-${pad2(mesIndex + 1)}-${pad2(dia)}`;
}

function formatISO(ano, mesIndex, dia) {
  return `${ano}-${pad2(mesIndex + 1)}-${pad2(dia)}`;
}

function splitISO(dateISO) {
  const [year, month, day] = String(dateISO || "").split("-").map(Number);

  return {
    year: Number.isFinite(year) ? year : 0,
    month: Number.isFinite(month) ? month : 0,
    day: Number.isFinite(day) ? day : 0,
  };
}

function formatDataBR(dateISO) {
  const { year, month, day } = splitISO(dateISO);

  if (!year || !month || !day) return "—";

  return `${pad2(day)}/${pad2(month)}/${year}`;
}

function getDateFromISO(dateISO) {
  const { year, month, day } = splitISO(dateISO);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function getDayOfWeekFromISO(dateISO) {
  const date = getDateFromISO(dateISO);

  return date ? date.getDay() : 0;
}

function getDiaSemanaLongo(dateISO) {
  return DIAS_SEMANA_LONGOS[getDayOfWeekFromISO(dateISO)] || "";
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

function getMonthKey(ano, mesIndex) {
  return `${ano}-${pad2(mesIndex + 1)}`;
}

function addMonths(ano, mesIndex, delta) {
  const date = new Date(ano, mesIndex + delta, 1);

  return {
    ano: date.getFullYear(),
    mesIndex: date.getMonth(),
  };
}

function compareMonthKeys(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
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

function getSlotStatus(reserva) {
  if (!reserva) return "livre";

  const status = normalizarStatus(reserva.status);

  if (reserva?.minha === false) {
    return reservaOcupaSlot(reserva) ? "ocupado_por_outro" : "livre";
  }

  if (status === "pendente") return "minha_pendente";
  if (status === "aprovado") return "minha_aprovada";
  if (status === "rejeitado" || status === "cancelado") return "minha_finalizada";

  return reservaOcupaSlot(reserva) ? "minha_pendente" : "livre";
}

function getMinhaCorStatus(status) {
  const normalized = normalizarStatus(status);

  if (normalized === "pendente") return "pendente";
  if (normalized === "aprovado") return "aprovado";
  if (normalized === "rejeitado" || normalized === "cancelado") return "finalizada";

  return null;
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

function labelStatusUsuario(status) {
  const normalized = normalizarStatus(status);

  const map = {
    pendente: "Em análise",
    aprovado: "Aprovada",
    rejeitado: "Rejeitada",
    cancelado: "Cancelada",
    bloqueado: "Bloqueada",
  };

  return map[normalized] || "Em análise";
}

function statusBadgeClass(slotStatus) {
  const map = {
    minha_pendente:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/60",
    minha_aprovada:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900/60",
    minha_finalizada:
      "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-200 dark:border-rose-900/60",
  };

  return map[slotStatus] || map.minha_pendente;
}

function addDaysISO(dateISO, delta) {
  const { year, month, day } = splitISO(dateISO);

  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  date.setDate(date.getDate() + Number(delta || 0));

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
}

function getConfirmacaoUsoStatus(reserva, hojeISO) {
  if (!reserva || reserva?.minha !== true) return null;

  const status = normalizarStatus(reserva.status);

  if (status !== "aprovado") return null;

  const dataReserva = String(reserva.data || "").slice(0, 10);

  if (!dataReserva) return null;

  if (reserva.confirmado_em) {
    return {
      status: "confirmado",
      label: "Uso confirmado",
      message: "Você já confirmou que utilizará esta sala.",
    };
  }

  const inicioJanela = addDaysISO(dataReserva, -7);
  const fimJanela = addDaysISO(dataReserva, -2);

  if (!inicioJanela || !fimJanela) return null;

  if (hojeISO < inicioJanela) {
    return {
      status: "aguardando_prazo",
      label: "Confirmação ainda não aberta",
      message: `A confirmação poderá ser feita entre ${formatDataBR(
        inicioJanela
      )} e ${formatDataBR(fimJanela)}.`,
    };
  }

  if (hojeISO > fimJanela) {
    return {
      status: "prazo_vencido",
      label: "Prazo de confirmação vencido",
      message:
        "O prazo de confirmação foi encerrado. A reserva poderá ser cancelada pela Escola da Saúde.",
    };
  }

  return {
    status: "prazo_aberto",
    label: "Confirmação obrigatória",
    message:
      "Confirme se realmente utilizará o espaço reservado. A confirmação é obrigatória entre 7 dias e 48 horas antes da data.",
  };
}

function confirmacaoUsoBadgeClass(status) {
  const map = {
    confirmado:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200",
    prazo_aberto:
      "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200",
    aguardando_prazo:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300",
    prazo_vencido:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200",
  };

  return map[status] || map.aguardando_prazo;
}

/* =========================================================================
   Componentes locais
=========================================================================== */

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

function SoftIconButton({
  title,
  ariaLabel,
  onClick,
  disabled = false,
  children,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cx(
        "rounded-full border border-slate-200 bg-white p-2 shadow-sm transition dark:border-zinc-800 dark:bg-zinc-800",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
        disabled
          ? "cursor-not-allowed opacity-45"
          : "hover:bg-slate-50 dark:hover:bg-zinc-700"
      )}
    >
      {children}
    </button>
  );
}

function MiniStat({ icon: Icon, label, children }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:text-sm">
      <div className="flex items-center gap-2 font-black text-slate-800 dark:text-white">
        <Icon className="h-4 w-4 text-sky-700 dark:text-sky-300" />
        <span>{label}</span>
      </div>

      <div className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-zinc-400">
        {children}
      </div>
    </article>
  );
}

function ModalRegrasAgenda({ open, onClose }) {
  if (!open) return null;

  const regras = [
    ["Solicitação", "Escolha uma data útil, sala e período disponível."],
    ["Análise", "Solicitações pendentes aguardam avaliação da Escola da Saúde."],
    ["Confirmação obrigatória", "Reservas aprovadas devem ser confirmadas entre 7 dias e 48 horas antes da data."],
    ["Sem confirmação", "A reserva poderá ser cancelada pela Escola da Saúde."],
    ["Edição", "Solicitações pendentes podem ser editadas; reservas aprovadas exigem contato com a administração."],
    ["Indisponíveis", "Fins de semana, feriados, pontos facultativos e datas bloqueadas não aceitam solicitação."],
    ["Capacidade", "Respeite a lotação da sala escolhida."],
    ["Coffee break", "A indicação na reserva não garante aprovação automática."],
    ["Histórico", "Cancelamentos e alterações preservam rastreabilidade operacional."],
  ];

  return createPortal(
<div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-md">      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="regras-agenda-title"
        className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800"
      >
        <div className="h-2 bg-gradient-to-r from-sky-600 via-emerald-500 to-amber-400" />

        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-6 dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-sky-950/30">
          <div className="flex gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-800 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900/60">
              <Info className="h-6 w-6" aria-hidden="true" />
            </div>

            <div>
              <h2
                id="regras-agenda-title"
                className="text-2xl font-black tracking-tight text-slate-950 dark:text-white"
              >
                Dicas e regras do agendamento
              </h2>

              <p className="mt-1 max-w-xl text-sm font-medium text-slate-600 dark:text-zinc-300">
                Orientações essenciais para solicitar, acompanhar e confirmar o uso dos espaços da Escola da Saúde.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="Fechar dicas e regras"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
            <strong>Atenção:</strong> reservas aprovadas precisam ser confirmadas dentro do prazo. A falta de confirmação pode liberar o espaço para outras demandas institucionais.
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {regras.map(([titulo, texto]) => (
              <article
                key={titulo}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                <p className="text-sm font-black text-slate-950 dark:text-white">
                  {titulo}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
                  {texto}
                </p>
              </article>
            ))}
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/80 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
            Em caso de dúvida, acompanhe o status da solicitação ou procure a administração.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-2xl bg-sky-700 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-sky-800"
          >
            Entendi
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}

function ModalCancelamentoUsuario({
  open,
  reserva,
  loading,
  onClose,
  onConfirm,
}) {
  if (!open || !reserva) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancelar-solicitacao-title"
          className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
            <div>
              <h3
                id="cancelar-solicitacao-title"
                className="text-lg font-extrabold text-slate-900 dark:text-white"
              >
                Cancelar solicitação?
              </h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                O histórico será preservado e o status passará para cancelado.
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
                <span className="font-extrabold">Finalidade:</span>{" "}
                {reserva.finalidade || "Sem finalidade"}
              </p>
              <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                <span className="font-semibold">Sala:</span>{" "}
                {reserva.salaLabel || reserva.sala || "—"}
              </p>
              <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                <span className="font-semibold">Período:</span>{" "}
                {reserva.periodoLabel || reserva.periodo || "—"}
              </p>
            </div>

            <p className="mt-4 text-sm text-slate-600 dark:text-zinc-300">
              Você só pode cancelar solicitações pendentes. Após aprovação, procure a administração da Escola da Saúde.
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
              {loading ? "Cancelando..." : "Cancelar solicitação"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalDiaUsuario({
  open,
  detalheDia,
  hojeISO,
  onClose,
  onSolicitar,
  onEditarMinhaReserva,
  onCancelarMinhaReserva,
  onConfirmarUsoSala,
  loadingCancelamento,
  loadingConfirmacaoUso,
}) {
  if (!open || !detalheDia) return null;

  const {
    dataISO,
    estado,
    motivo,
    disponibilidade,
    minhasReservas = [],
  } = detalheDia;

  const semHorario = estado === "lotado";
  const bloqueado = estado === "bloqueado";

  return (
    <div className="fixed inset-0 z-[90]">
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="absolute inset-0 grid place-items-center p-3 sm:p-5">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-dia-usuario-title"
          className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 dark:border-zinc-800 sm:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                <CalendarRange className="h-4 w-4" />
                Disponibilidade do dia
              </div>
              <h3
                id="modal-dia-usuario-title"
                className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white sm:text-2xl"
              >
                {formatDataBR(dataISO)} — {getDiaSemanaLongo(dataISO)}
              </h3>
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

          <div className="max-h-[calc(92vh-84px)] overflow-y-auto px-4 py-5 sm:px-6">
            {bloqueado ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-200 dark:bg-zinc-800">
                  <Lock className="h-6 w-6 text-slate-700 dark:text-zinc-300" />
                </div>
                <h4 className="mt-4 text-xl font-extrabold text-slate-900 dark:text-white">
                  Dia bloqueado
                </h4>
                <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600 dark:text-zinc-300 sm:text-base">
                  {motivo || "Esta data não está disponível para solicitação."}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {minhasReservas.length > 0 ? (
                  <section className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                        Minhas solicitações e reservas deste dia
                      </h4>
                      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                        Solicitações pendentes podem ser editadas ou canceladas.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {minhasReservas.map((reserva) => {
  const slotStatus = reserva.slotStatus;
  const ehPendente = slotStatus === "minha_pendente";
  const confirmacaoUso = getConfirmacaoUsoStatus(reserva, hojeISO);
  const podeConfirmarUso = confirmacaoUso?.status === "prazo_aberto";
  const confirmandoEstaReserva =
    String(loadingConfirmacaoUso || "") === String(reserva.id || "");

                        return (
                          <div
                            key={reserva.id}
                            className={cx(
                              "rounded-2xl border p-4",
                              slotStatus === "minha_pendente"
                                ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/15"
                                : slotStatus === "minha_finalizada"
                                  ? "border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/15"
                                  : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/15"
                            )}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                                    {reserva.salaLabel} • {reserva.periodoLabel}
                                  </span>

                                  <span
                                    className={cx(
                                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold",
                                      statusBadgeClass(slotStatus)
                                    )}
                                  >
                                    {labelStatusUsuario(reserva.status)}
                                  </span>
                                </div>

                                <p className="mt-2 break-words text-sm font-extrabold text-slate-900 dark:text-white">
                                  {String(reserva.finalidade || "Sem finalidade").trim()}
                                </p>

                                {reserva.qtd_pessoas ? (
                                  <p className="mt-2 text-xs text-slate-600 dark:text-zinc-300">
                                    <span className="font-semibold">Pessoas:</span>{" "}
                                    {reserva.qtd_pessoas}
                                  </p>
                                ) : null}

                                {reserva.coffee_break ? (
                                  <p className="mt-1 text-xs text-slate-600 dark:text-zinc-300">
                                    <span className="font-semibold">Coffee break:</span> Sim
                                  </p>
                                ) : null}
                                {confirmacaoUso ? (
  <div
    className={cx(
      "mt-3 rounded-2xl border px-3 py-3 text-xs",
      confirmacaoUsoBadgeClass(confirmacaoUso.status)
    )}
  >
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="font-extrabold">{confirmacaoUso.label}</p>
        <p className="mt-1 leading-relaxed">{confirmacaoUso.message}</p>
      </div>

      {podeConfirmarUso ? (
        <button
          type="button"
          onClick={() => onConfirmarUsoSala(reserva)}
          disabled={confirmandoEstaReserva}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {confirmandoEstaReserva ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {confirmandoEstaReserva ? "Confirmando..." : "Confirmar uso"}
        </button>
      ) : null}
    </div>
  </div>
) : null}
                              </div>

                              {ehPendente ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onEditarMinhaReserva(reserva)}
                                    className="inline-flex items-center justify-center rounded-xl border border-amber-300 p-2 text-amber-700 transition hover:bg-amber-100"
                                    title="Editar solicitação"
                                    aria-label="Editar solicitação"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => onCancelarMinhaReserva(reserva)}
                                    disabled={loadingCancelamento}
                                    className="inline-flex items-center justify-center rounded-xl border border-rose-300 p-2 text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                                    title="Cancelar solicitação"
                                    aria-label="Cancelar solicitação"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {semHorario ? (
                  <div className="rounded-3xl border border-violet-200 bg-violet-50 p-6 text-center dark:border-violet-900/50 dark:bg-violet-950/15">
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 dark:bg-violet-900/30">
                      <Info className="h-6 w-6 text-violet-700 dark:text-violet-300" />
                    </div>
                    <h4 className="mt-4 text-xl font-extrabold text-slate-900 dark:text-white">
                      Sem horário disponível
                    </h4>
                    <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600 dark:text-zinc-300 sm:text-base">
                      Todos os horários disponíveis deste dia já estão ocupados.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/15 dark:text-sky-100">
                      Selecione um local e período disponível para solicitar o agendamento.
                    </div>

                    {disponibilidade.map((salaItem) => (
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
                              Capacidade conforto: {salaItem.conforto} • Máximo:{" "}
                              {salaItem.max}
                            </p>
                          </div>

                          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">
                            {salaItem.slots.length} horário(s) disponível(is)
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 md:grid-cols-2">
                          {salaItem.slots.map((slot) => (
                            <div
                              key={`${slot.sala}-${slot.periodo}`}
                              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                                    Período
                                  </p>
                                  <p className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">
                                    {slot.periodoLabel}
                                  </p>
                                </div>

                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Disponível
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => onSolicitar(slot)}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-extrabold text-white transition hover:bg-sky-700"
                              >
                                Solicitar agendamento
                                <ArrowRight className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </>
                )}
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

function AgendaSalasUsuario() {
  const hojeParts = getHojeParts();

  const [ano, setAno] = useState(hojeParts.ano);
  const [mesIndex, setMesIndex] = useState(hojeParts.mesIndex);
  const [hojeISO] = useState(() => getHojeISO());

  const minUserMonthKey = useMemo(
    () => getMonthKey(hojeParts.ano, 0),
    [hojeParts.ano]
  );

  const maxUserMonthKey = useMemo(() => {
    if (hojeParts.mesIndex === 10) {
      return getMonthKey(hojeParts.ano + 1, 0);
    }

    if (hojeParts.mesIndex === 11) {
      return getMonthKey(hojeParts.ano + 1, 1);
    }

    return getMonthKey(hojeParts.ano, 11);
  }, [hojeParts.ano, hojeParts.mesIndex]);

  const viewedMonthKey = useMemo(() => getMonthKey(ano, mesIndex), [ano, mesIndex]);
  const podeVoltar = compareMonthKeys(viewedMonthKey, minUserMonthKey) > 0;
  const podeAvancar = compareMonthKeys(viewedMonthKey, maxUserMonthKey) < 0;

  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [regrasAberto, setRegrasAberto] = useState(false);

  const [reservasMap, setReservasMap] = useState({});
  const [feriadosMap, setFeriadosMap] = useState({});
  const [datasBloqueadasMap, setDatasBloqueadasMap] = useState({});

  const [modalSolicitacaoAberto, setModalSolicitacaoAberto] = useState(false);
  const [slotSelecionado, setSlotSelecionado] = useState(null);

  const [modalDiaAberto, setModalDiaAberto] = useState(false);
  const [diaSelecionadoISO, setDiaSelecionadoISO] = useState(null);

  const [modalModo, setModalModo] = useState("criar");
  const [reservaEmEdicao, setReservaEmEdicao] = useState(null);

  const [cancelamento, setCancelamento] = useState({
    open: false,
    reserva: null,
  });
  const [cancelandoId, setCancelandoId] = useState(null);
  const [confirmandoUsoId, setConfirmandoUsoId] = useState(null);

  const semanas = useMemo(() => criarMatrixMes(ano, mesIndex), [ano, mesIndex]);
  const liveRef = useRef(null);

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
      const novo = addMonths(ano, mesIndex, delta);
      const novoKey = getMonthKey(novo.ano, novo.mesIndex);

      if (compareMonthKeys(novoKey, minUserMonthKey) < 0) return;
      if (compareMonthKeys(novoKey, maxUserMonthKey) > 0) return;

      setAno(novo.ano);
      setMesIndex(novo.mesIndex);
    },
    [ano, mesIndex, minUserMonthKey, maxUserMonthKey]
  );

  const hojeClick = useCallback(() => {
    setAno(hojeParts.ano);
    setMesIndex(hojeParts.mesIndex);
  }, [hojeParts.ano, hojeParts.mesIndex]);

  const handleKeyNav = useCallback(
    (event) => {
      const tag = String(event?.target?.tagName || "").toLowerCase();

      if (["input", "select", "textarea"].includes(tag)) return;

      if (event.key === "ArrowLeft" && podeVoltar) mudarMes(-1);
      if (event.key === "ArrowRight" && podeAvancar) mudarMes(1);
    },
    [podeVoltar, podeAvancar, mudarMes]
  );

  useEffect(() => {
    document.title = "Agendamento de Salas | Escola da Saúde";
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyNav);

    return () => window.removeEventListener("keydown", handleKeyNav);
  }, [handleKeyNav]);

  const carregarAgenda = useCallback(async () => {
    setLoading(true);
    setMensagem(null);
    setLive("Carregando disponibilidade das salas.");

    try {
      const query = new URLSearchParams({
        ano: String(ano),
        mes: String(mesIndex + 1),
      }).toString();

      const response = await api.get(`/sala/agenda-usuario?${query}`);
      const data = unwrapData(response);

      const map = {};

      for (const reserva of data.reservas || []) {
        const dataISO = String(reserva.data || "").slice(0, 10);
        const salaKey = reserva.sala;
        const periodoKey = reserva.periodo;

        if (!dataISO || !salaKey || !periodoKey) continue;

        if (!map[dataISO]) map[dataISO] = {};
        if (!map[dataISO][salaKey]) map[dataISO][salaKey] = {};
        if (!map[dataISO][salaKey][periodoKey]) {
          map[dataISO][salaKey][periodoKey] = [];
        }

        map[dataISO][salaKey][periodoKey].push({
          ...reserva,
          status: normalizarStatus(reserva.status),
        });
      }

      const feriados = {};
      const bloqueios = {};

      for (const feriado of data.feriados || []) {
        const dataISO = String(feriado.data || "").slice(0, 10);
        if (dataISO) feriados[dataISO] = feriado;
      }

      for (const bloqueio of data.datas_bloqueadas || []) {
        const dataISO = String(bloqueio.data || "").slice(0, 10);
        if (dataISO) bloqueios[dataISO] = bloqueio;
      }

      setReservasMap(map);
      setFeriadosMap(feriados);
      setDatasBloqueadasMap(bloqueios);

      setLive("Disponibilidade das salas carregada.");
    } catch (error) {
      console.error("[AgendaSalasUsuario][carregarAgenda]", error);

      showMessage({
        type: "error",
        title: "Erro ao carregar disponibilidade",
        message: getErrorMessage(
          error,
          "Não foi possível carregar a disponibilidade das salas. Verifique sua conexão e tente novamente."
        ),
      });

      setLive("Falha ao carregar disponibilidade das salas.");
    } finally {
      setLoading(false);
    }
  }, [ano, mesIndex]);

  useEffect(() => {
    carregarAgenda();
  }, [carregarAgenda]);

  function prioridadeReserva(reserva) {
    const status = normalizarStatus(reserva?.status);
    const minha = reserva?.minha === true;

    if (minha && status === "pendente") return 70;
    if (minha && status === "aprovado") return 60;
    if (!minha && STATUS_OCUPA_SLOT.has(status)) return 50;
    if (minha && (status === "rejeitado" || status === "cancelado")) return 40;

    return 10;
  }

  function getReservasDoSlot(salaValue, dataISO, periodo) {
    const raw = reservasMap[dataISO]?.[salaValue]?.[periodo];

    if (!raw) return [];

    return Array.isArray(raw) ? raw : [raw];
  }

  function getReservaDoSlot(salaValue, dataISO, periodo) {
    const reservas = getReservasDoSlot(salaValue, dataISO, periodo);

    if (!reservas.length) return null;

    return [...reservas].sort((a, b) => prioridadeReserva(b) - prioridadeReserva(a))[0];
  }

  function getMinhasReservasDoDia(dataISO) {
    const minhas = [];

    SALAS.forEach((salaItem) => {
      PERIODOS.forEach((periodo) => {
        const reservas = getReservasDoSlot(salaItem.value, dataISO, periodo.value);

        reservas
          .filter((reserva) => reserva?.minha === true)
          .sort((a, b) => prioridadeReserva(b) - prioridadeReserva(a))
          .forEach((reserva) => {
            const slotStatus = getSlotStatus(reserva);

            minhas.push({
              ...reserva,
              sala: salaItem.value,
              salaLabel: salaItem.label,
              periodo: periodo.value,
              periodoLabel: periodo.label,
              slotStatus,
            });
          });
      });
    });

    return minhas;
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

    const disponibilidade = [];
    const minhasReservas = getMinhasReservasDoDia(dataISO);

    let totalSlots = 0;
    let ocupados = 0;
    let minhasPendentes = 0;
    let minhasAprovadas = 0;

    SALAS.forEach((salaItem) => {
      const slotsDisponiveis = [];

      PERIODOS.forEach((periodo) => {
        totalSlots += 1;

        const reservasDoSlot = getReservasDoSlot(
          salaItem.value,
          dataISO,
          periodo.value
        );

        const reservaPrincipal = getReservaDoSlot(
          salaItem.value,
          dataISO,
          periodo.value
        );

        const slotStatus = getSlotStatus(reservaPrincipal);
        const slotOcupado = reservasDoSlot.some((item) => reservaOcupaSlot(item));

        if (slotOcupado) ocupados += 1;
        if (slotStatus === "minha_pendente") minhasPendentes += 1;
        if (slotStatus === "minha_aprovada") minhasAprovadas += 1;

        if (!slotOcupado) {
          slotsDisponiveis.push({
            dataISO,
            sala: salaItem.value,
            salaLabel: salaItem.label,
            periodo: periodo.value,
            periodoLabel: periodo.label,
            capacidadeSala: salaItem,
          });
        }
      });

      if (slotsDisponiveis.length > 0) {
        disponibilidade.push({
          sala: salaItem.value,
          label: salaItem.label,
          conforto: salaItem.conforto,
          max: salaItem.max,
          slots: slotsDisponiveis,
        });
      }
    });

    let estado = "disponivel";

    if (bloqueado) estado = "bloqueado";
    else if (ocupados >= totalSlots) estado = "lotado";

    const indicadoresUsuario = {
      pendente: false,
      aprovado: false,
      finalizada: false,
    };

    minhasReservas.forEach((reserva) => {
      const cor = getMinhaCorStatus(reserva?.status);
      if (cor) indicadoresUsuario[cor] = true;
    });

    return {
      dataISO,
      estado,
      motivo,
      disponibilidade,
      minhasReservas,
      totalSlots,
      ocupados,
      minhasPendentes,
      minhasAprovadas,
      salasDisponiveis: disponibilidade.length,
      indicadoresUsuario,
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

  const detalheDiaSelecionado = useMemo(() => {
    if (!diaSelecionadoISO) return null;

    return diaInfosMap[diaSelecionadoISO] || null;
  }, [diaSelecionadoISO, diaInfosMap]);

  const minhasPendentes = useMemo(() => {
    let total = 0;

    Object.values(diaInfosMap).forEach((dia) => {
      total += dia?.minhasPendentes || 0;
    });

    return total;
  }, [diaInfosMap]);

  const minhasAprovadas = useMemo(() => {
    let total = 0;

    Object.values(diaInfosMap).forEach((dia) => {
      total += dia?.minhasAprovadas || 0;
    });

    return total;
  }, [diaInfosMap]);

  const diasComDisponibilidade = useMemo(
    () => Object.values(diaInfosMap).filter((dia) => dia?.estado === "disponivel").length,
    [diaInfosMap]
  );

  const diasLotados = useMemo(
    () => Object.values(diaInfosMap).filter((dia) => dia?.estado === "lotado").length,
    [diaInfosMap]
  );

  function abrirDia(dataISO) {
    setDiaSelecionadoISO(dataISO);
    setModalDiaAberto(true);
  }

  function fecharModalDia() {
    setModalDiaAberto(false);
    setDiaSelecionadoISO(null);
  }

  function abrirSolicitacao(slot) {
    fecharModalDia();

    setSlotSelecionado({
      dataISO: slot.dataISO,
      periodo: slot.periodo,
      sala: slot.sala,
    });

    setReservaEmEdicao(null);
    setModalModo("criar");
    setModalSolicitacaoAberto(true);
  }

  function iniciarEdicao(reserva) {
    fecharModalDia();

    setSlotSelecionado({
      dataISO: String(reserva.data || "").slice(0, 10),
      periodo: reserva.periodo,
      sala: reserva.sala,
    });

    setReservaEmEdicao(reserva);
    setModalModo("editar");
    setModalSolicitacaoAberto(true);
  }

  function fecharModalSolicitacao() {
    setModalSolicitacaoAberto(false);
    setSlotSelecionado(null);
    setReservaEmEdicao(null);
    setModalModo("criar");
  }

  function solicitarCancelamentoReserva(reserva) {
    if (!reserva?.id || cancelandoId) return;

    setCancelamento({
      open: true,
      reserva,
    });
  }

  function fecharCancelamento() {
    if (cancelandoId) return;

    setCancelamento({
      open: false,
      reserva: null,
    });
  }

  async function executarCancelamentoReserva() {
    const reserva = cancelamento?.reserva;

    if (!reserva?.id) {
      setCancelamento({
        open: false,
        reserva: null,
      });
      return;
    }

    try {
      setCancelandoId(reserva.id);
      setMensagem(null);

      await api.delete(`/sala/minhas/${reserva.id}`);

      showMessage({
        type: "success",
        title: "Solicitação cancelada",
        message:
          "Sua solicitação foi cancelada com sucesso. O histórico operacional foi preservado.",
      });

      await carregarAgenda();
      fecharModalDia();
    } catch (error) {
      console.error("[AgendaSalasUsuario][cancelamento]", error);

      showMessage({
        type: "error",
        title: "Não foi possível cancelar",
        message: getErrorMessage(
          error,
          "A solicitação não pôde ser cancelada. Verifique se ela ainda está pendente."
        ),
      });
    } finally {
      setCancelandoId(null);
      setCancelamento({
        open: false,
        reserva: null,
      });
    }
  }

async function executarConfirmacaoUsoSala(reserva) {
  if (!reserva?.id || confirmandoUsoId) return;

  try {
    setConfirmandoUsoId(reserva.id);
    setMensagem(null);

    await api.post(`/sala/minhas/${reserva.id}/confirmar-uso`);

    showMessage({
      type: "success",
      title: "Uso da sala confirmado",
      message:
        "Sua confirmação foi registrada com sucesso. A Escola da Saúde foi informada de que você utilizará o espaço reservado.",
    });

    await carregarAgenda();
  } catch (error) {
    console.error("[AgendaSalasUsuario][confirmarUsoSala]", error);

    showMessage({
      type: "error",
      title: "Não foi possível confirmar o uso da sala",
      message: getErrorMessage(
        error,
        "A confirmação não pôde ser registrada. Verifique se a reserva está aprovada e dentro do prazo de 7 dias a 48 horas antes da data."
      ),
    });
  } finally {
    setConfirmandoUsoId(null);
  }
}

  const HOJE_BG = "bg-sky-100/70 dark:bg-sky-950/25";
  const HOJE_RING = "ring-2 ring-sky-500/70 dark:ring-sky-700/60";
  const HOJE_BADGE =
    "bg-sky-200 text-sky-950 border border-sky-300 dark:bg-sky-900/40 dark:text-sky-100 dark:border-sky-800";

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-sky-50 via-white to-white text-gray-900 dark:from-gray-950 dark:via-gray-950 dark:to-black dark:text-gray-100">
      <div className="mx-auto w-full max-w-7xl px-4 pt-5 pb-1">
  <HeaderHero
    titulo="Agendamento de Salas"
    subtitulo="Solicite horários disponíveis para o Auditório e a Sala de Reunião da Escola da Saúde."
    icone={CalendarDays}
    tamanho="lg"
    raio="xl"
  />
</div>

<section className="mx-auto mt-4 flex w-full max-w-7xl flex-col gap-3 px-4 lg:flex-row lg:items-center lg:justify-between">
  <div>
    <h2 className="text-base font-black text-slate-950 dark:text-white">
      Disponibilidade e minhas reservas
    </h2>

    <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
      Navegue pelo calendário, veja horários disponíveis e acompanhe suas solicitações.
    </p>
  </div>

  <div className="flex flex-wrap items-center gap-2">
    <button
      type="button"
      onClick={() => setRegrasAberto(true)}
      className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-white px-4 py-2 text-sm font-black text-sky-800 shadow-sm transition hover:bg-sky-50 dark:border-sky-900/60 dark:bg-zinc-900 dark:text-sky-200 dark:hover:bg-sky-950/30"
    >
      <Info className="h-4 w-4" />
      Dicas e regras
    </button>

    <button
      type="button"
      onClick={carregarAgenda}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-2xl bg-sky-700 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCcw className={cx("h-4 w-4", loading && "animate-spin")} />
      {loading ? "Atualizando..." : "Atualizar"}
    </button>
  </div>
</section>

<section className="mx-auto mt-4 grid w-full max-w-7xl grid-cols-1 gap-3 px-4 sm:grid-cols-2 xl:grid-cols-4">
  {SALAS.map((sala) => (
    <MiniStat key={sala.value} icon={Users} label={sala.label}>
      <strong>{sala.conforto}</strong> conforto / {sala.max} máximo
    </MiniStat>
  ))}

  <MiniStat icon={Sparkles} label="Minhas reservas">
    <strong>Pendentes:</strong> {loading ? "—" : minhasPendentes}
    <br />
    <strong>Aprovadas:</strong> {loading ? "—" : minhasAprovadas}
  </MiniStat>

  <MiniStat icon={CheckCircle2} label="Dias úteis">
    <strong>Com vaga:</strong> {loading ? "—" : diasComDisponibilidade}
    <br />
    <strong>Lotados:</strong> {loading ? "—" : diasLotados}
  </MiniStat>
</section>

      <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

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

        <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-white/50 bg-gradient-to-b from-white/85 to-white/60 px-4 py-3 backdrop-blur dark:border-gray-800 dark:from-gray-950/80 dark:to-gray-950/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <SoftIconButton
                onClick={() => mudarMes(-1)}
                ariaLabel="Mês anterior"
                title="Mês anterior (atalho ←)"
                disabled={!podeVoltar}
              >
                <ChevronLeft className="h-4 w-4" />
              </SoftIconButton>

              <div className="min-w-[160px] text-center">
                <p className="text-xs text-slate-500 dark:text-slate-300">Mês</p>
                <p className="text-base font-semibold text-slate-800 dark:text-white sm:text-lg">
                  {NOMES_MESES[mesIndex]} {ano}
                </p>
              </div>

              <SoftIconButton
                onClick={() => mudarMes(1)}
                ariaLabel="Próximo mês"
                title={
                  podeAvancar
                    ? "Próximo mês (atalho →)"
                    : "Limite de navegação atingido para a regra anual progressiva"
                }
                disabled={!podeAvancar}
              >
                <ChevronRight className="h-4 w-4" />
              </SoftIconButton>

              <button
                type="button"
                className="ml-2 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-sky-700"
                onClick={hojeClick}
                aria-label="Ir para o mês atual"
              >
                Hoje
              </button>

            </div>

            <div className="flex items-center gap-2">
              {!podeAvancar ? (
                <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                  Limite anual progressivo atingido
                </span>
              ) : null}

              {loading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Skeleton width={110} height={20} />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-200">
            Carregando disponibilidade...
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-2 text-xs sm:text-sm">
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full border border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900" />
            Há horários disponíveis
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full border border-violet-300 bg-violet-100" />
            Sem horário disponível
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full border border-slate-300 bg-slate-200" />
            Bloqueado / fim de semana / feriado
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full border border-amber-500 bg-amber-400" />
            Minha solicitação pendente
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full border border-emerald-600 bg-emerald-500" />
            Minha solicitação aprovada
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full border border-rose-600 bg-rose-500" />
            Minha solicitação rejeitada/cancelada
          </span>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-xs dark:border-zinc-800 dark:bg-zinc-800 sm:text-sm">
            {DIAS_SEMANA.map((dia) => (
              <div
                key={dia}
                className="py-2 text-center font-medium uppercase text-slate-600 dark:text-slate-200"
              >
                {dia}
              </div>
            ))}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
            {semanas.map((semana, idxSemana) => (
              <div key={idxSemana} className="grid grid-cols-7">
                {semana.map((dia, idxDia) => {
                  if (!dia) {
                    return (
                      <div
                        key={`${idxSemana}-${idxDia}`}
                        className="min-h-[110px] border-r border-slate-100 bg-slate-50/40 dark:border-zinc-800 dark:bg-zinc-900/40 sm:min-h-[140px]"
                      />
                    );
                  }

                  const dataISO = formatISO(ano, mesIndex, dia);
                  const eHoje = dataISO === hojeISO;
                  const diaInfo = diaInfosMap[dataISO];
                  const salasDisponiveis = diaInfo?.salasDisponiveis || 0;
                  const indicadores = diaInfo?.indicadoresUsuario || {};

                  const cellTone =
                    diaInfo?.estado === "bloqueado"
                      ? "bg-slate-100 dark:bg-zinc-900/70"
                      : diaInfo?.estado === "lotado"
                        ? "bg-violet-50 dark:bg-violet-950/15"
                        : "bg-white dark:bg-zinc-900";

                  const chipTone =
                    diaInfo?.estado === "bloqueado"
                      ? "bg-slate-200 text-slate-700 border-slate-300"
                      : diaInfo?.estado === "lotado"
                        ? "bg-violet-100 text-violet-800 border-violet-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200";

                  return (
                    <button
                      key={dataISO}
                      type="button"
                      onClick={() => abrirDia(dataISO)}
                      className={cx(
                        "min-h-[110px] border-r border-slate-100 p-2 text-left transition dark:border-zinc-800 sm:min-h-[140px]",
                        cellTone,
                        eHoje ? cx(HOJE_BG, HOJE_RING) : "",
                        "hover:brightness-[0.985] focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                      )}
                      aria-label={`Dia ${dia}`}
                      title={
                        diaInfo?.estado === "bloqueado"
                          ? diaInfo?.motivo || "Bloqueado"
                          : diaInfo?.estado === "lotado"
                            ? "Sem horário disponível"
                            : "Há horários disponíveis"
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div
                            className={cx(
                              "text-xs font-extrabold sm:text-sm",
                              eHoje
                                ? "text-sky-800 dark:text-sky-200"
                                : "text-slate-800 dark:text-white"
                            )}
                          >
                            {dia}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                            {DIAS_SEMANA[getDayOfWeekFromISO(dataISO)]}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          {eHoje ? (
                            <span
                              className={cx(
                                "rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                                HOJE_BADGE
                              )}
                            >
                              Hoje
                            </span>
                          ) : null}

                          {indicadores.pendente || indicadores.aprovado || indicadores.finalizada ? (
                            <div className="flex items-center gap-1.5">
                              {indicadores.pendente ? (
                                <span
                                  className="h-2.5 w-2.5 rounded-full border border-amber-500 bg-amber-400"
                                  title="Você possui solicitação pendente neste dia"
                                />
                              ) : null}
                              {indicadores.aprovado ? (
                                <span
                                  className="h-2.5 w-2.5 rounded-full border border-emerald-600 bg-emerald-500"
                                  title="Você possui solicitação aprovada neste dia"
                                />
                              ) : null}
                              {indicadores.finalizada ? (
                                <span
                                  className="h-2.5 w-2.5 rounded-full border border-rose-600 bg-rose-500"
                                  title="Você possui solicitação rejeitada ou cancelada neste dia"
                                />
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-col gap-2">
                        {diaInfo?.estado === "disponivel" ? (
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
                          {diaInfo?.estado === "bloqueado"
                            ? "Bloqueado"
                            : diaInfo?.estado === "lotado"
                              ? "Sem vaga"
                              : "Disponível"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />

      <ModalRegrasAgenda
  open={regrasAberto}
  onClose={() => setRegrasAberto(false)}
/>

<ModalDiaUsuario
  open={modalDiaAberto}
  detalheDia={detalheDiaSelecionado}
  hojeISO={hojeISO}
  onClose={fecharModalDia}
  onSolicitar={abrirSolicitacao}
  onEditarMinhaReserva={iniciarEdicao}
  onCancelarMinhaReserva={solicitarCancelamentoReserva}
  onConfirmarUsoSala={executarConfirmacaoUsoSala}
  loadingCancelamento={Boolean(cancelandoId)}
  loadingConfirmacaoUso={confirmandoUsoId}
/>

      {modalSolicitacaoAberto && slotSelecionado ? (
        <ModalSolicitarReserva
          onClose={fecharModalSolicitacao}
          recarregar={carregarAgenda}
          slot={modalModo === "criar" ? slotSelecionado : null}
          sala={slotSelecionado.sala}
          capacidadeSala={
            SALAS.find((sala) => sala.value === slotSelecionado.sala) || {
              conforto: 0,
              max: 0,
            }
          }
          modo={modalModo}
          reservaAtual={modalModo === "editar" ? reservaEmEdicao : null}
        />
      ) : null}

      <ModalCancelamentoUsuario
        open={cancelamento.open}
        reserva={cancelamento.reserva}
        loading={Boolean(cancelandoId)}
        onClose={fecharCancelamento}
        onConfirm={executarCancelamentoReserva}
      />
    </div>
  );
}

export default AgendaSalasUsuario;