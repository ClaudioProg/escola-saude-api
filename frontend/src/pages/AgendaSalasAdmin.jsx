/* eslint-disable no-console */
// ✅ src/pages/AgendaSalasAdmin.jsx — PREMIUM CALENDÁRIO MENSAL ADMIN
// - Calendário mensal real, responsivo e orientado ao DIA
// - Dias bloqueados em cinza
// - Dias totalmente ocupados em lilás suave
// - Dias com disponibilidade em branco
// - Clique no dia abre modal com visão completa do dia
// - Auditório + Sala de Reunião / Manhã + Tarde / solicitante / aprovador / termo
// - Integração com ModalReservaAdmin para edição do slot
// - PDF do termo disponível quando houver termo assinado
// - Anti-fuso: sem new Date("YYYY-MM-DD")

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Users,
  ShieldCheck,
  Info,
  FileText,
  MapPin,
  Sparkles,
  Waves,
  X,
  Pencil,
  Trash2,
  Lock,
  CheckCircle2,
  CalendarRange,
  FileSignature,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Footer from "../components/Footer";
import ModalReservaAdmin from "../components/ModalReservaAdmin";

/* ───────────────────────── Constantes ───────────────────────── */
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
  auditorio: { conforto: 50, max: 60, labelCurta: "Auditório" },
  sala_reuniao: { conforto: 25, max: 30, labelCurta: "Sala de Reunião" },
};

const PERIODOS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
];

const SALAS_ORDEM = ["auditorio", "sala_reuniao"];

/* ─────────────────────── Helpers gerais ─────────────────────── */
function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

function pad2(v) {
  return String(v).padStart(2, "0");
}

function getHojeISO() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function splitISO(dateISO) {
  const [y, m, d] = String(dateISO || "").split("-").map(Number);
  return {
    year: Number.isFinite(y) ? y : 0,
    month: Number.isFinite(m) ? m : 0,
    day: Number.isFinite(d) ? d : 0,
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

  for (let i = 0; i < primeiroDiaSemana; i += 1) semanaAtual[i] = null;
  for (let i = primeiroDiaSemana; i < 7; i += 1) semanaAtual[i] = dia++;
  semanas.push(semanaAtual);

  while (dia <= diasNoMes) {
    const novaSemana = new Array(7).fill(null);
    for (let i = 0; i < 7 && dia <= diasNoMes; i += 1) novaSemana[i] = dia++;
    semanas.push(novaSemana);
  }

  return semanas;
}

function formatISO(ano, mesIndex, dia) {
  return `${ano}-${pad2(mesIndex + 1)}-${pad2(dia)}`;
}

function formatDataBR(dataISO) {
  if (!dataISO) return "—";
  const { day, month, year } = splitISO(dataISO);
  if (!day || !month || !year) return "—";
  return `${pad2(day)}/${pad2(month)}/${year}`;
}

function formatDateTimeBR(dateValue) {
  if (!dateValue) return "—";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "—";

  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yy = d.getFullYear();
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());

  return `${dd}/${mm}/${yy} às ${hh}:${mi}`;
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

/* ─────────────────── Normalização de reservas ─────────────────── */
function normalizeReserva(r) {
  const dataISO = (r.data || r.dataISO || r.dia || "").slice(0, 10);

  return {
    id: r.id ?? r.reserva_id ?? r.uuid ?? null,
    sala: r.sala || r.room || null,
    data: dataISO,
    dataISO,
    periodo: r.periodo || r.turno || r.slot || "manha",
    status: r.status || "pendente",
    qtd_pessoas: r.qtd_pessoas ?? r.qtdPessoas ?? r.qtd ?? r.capacidade ?? null,
    coffee_break: r.coffee_break ?? r.coffeeBreak ?? r.coffee ?? false,
    observacao: r.observacao ?? r.obs ?? r.observacao_admin ?? "",
    finalidade: r.finalidade ?? r.descricao ?? r.titulo ?? r.assunto ?? "",
    solicitante_id: r.solicitante_id ?? r.usuario_id ?? r.user_id ?? null,
    solicitante_nome:
      r.solicitante_nome ?? r.usuario_nome ?? r.nome_solicitante ?? r.nome ?? null,
    solicitante_unidade:
      r.solicitante_unidade ?? r.unidade ?? r.unidade_nome ?? r.setor ?? null,
    aprovador_id:
      r.aprovador_id ?? r.admin_id ?? r.aprovado_por_id ?? r.usuario_aprovador_id ?? null,
    aprovador_nome:
      r.aprovador_nome ??
      r.admin_nome ??
      r.aprovado_por_nome ??
      r.usuario_aprovador_nome ??
      null,
    termo_aceito: Boolean(r.termo_aceito),
    termo_assinado_em: r.termo_assinado_em ?? null,
    assinatura_id: r.assinatura_id ?? null,
    criado_em: r.criado_em ?? r.created_at ?? r.createdAt ?? null,
    atualizado_em: r.atualizado_em ?? r.updated_at ?? r.updatedAt ?? null,
  };
}

/* ─────────────────────── Status / UI ─────────────────────── */
function classesStatusSlot(status) {
  switch (status) {
    case "pendente":
      return "bg-amber-50 text-amber-900 border border-amber-200";
    case "aprovado":
    case "confirmado":
      return "bg-emerald-50 text-emerald-900 border border-emerald-200";
    case "rejeitado":
    case "cancelado":
      return "bg-rose-50 text-rose-900 border border-rose-200";
    case "bloqueado":
      return "bg-sky-50 text-sky-900 border border-sky-200";
    default:
      return "bg-white text-slate-800 border border-slate-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700";
  }
}

function labelStatus(status) {
  switch (status) {
    case "pendente":
      return "Pendente";
    case "aprovado":
      return "Aprovado";
    case "confirmado":
      return "Confirmado";
    case "rejeitado":
      return "Rejeitado";
    case "cancelado":
      return "Cancelado";
    case "bloqueado":
      return "Bloqueado (uso interno)";
    default:
      return "Livre";
  }
}

function getStatusTone(status) {
  switch (status) {
    case "pendente":
      return "text-amber-700 bg-amber-100 border-amber-200";
    case "aprovado":
    case "confirmado":
      return "text-emerald-700 bg-emerald-100 border-emerald-200";
    case "rejeitado":
    case "cancelado":
      return "text-rose-700 bg-rose-100 border-rose-200";
    case "bloqueado":
      return "text-sky-700 bg-sky-100 border-sky-200";
    default:
      return "text-slate-700 bg-slate-100 border-slate-200";
  }
}

/* ─────────────────────── Motivos ─────────────────────── */
function limparPrefixosFeriado(txt) {
  const s = String(txt || "").trim();
  if (!s) return "";
  return s
    .replace(/^feriado\s*[-—:]\s*/i, "")
    .replace(/^ponto\s*facultativo\s*[-—:]\s*/i, "Ponto Facultativo — ")
    .trim();
}

function motivoBloqueio({ diaSemana, ehFeriado, feriadoObj, ehBloqueada, bloqueioObj }) {
  if (ehBloqueada) {
    const motivo = String(
      bloqueioObj?.motivo || bloqueioObj?.descricao || bloqueioObj?.titulo || ""
    ).trim();

    return motivo ? `Bloqueado (uso interno) — ${motivo}` : "Bloqueado (uso interno)";
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

/* ─────────────────────── UI helpers ─────────────────────── */
function MiniStat({ icon: Icon, label, value, tone = "ocean", loading }) {
  const tones = {
    ocean: {
      ring: "ring-1 ring-white/15",
      iconBg: "bg-white/12",
      icon: "text-white",
      label: "text-white/80",
      value: "text-white",
    },
    ink: {
      ring: "ring-1 ring-white/10",
      iconBg: "bg-white/10",
      icon: "text-white",
      label: "text-white/75",
      value: "text-white",
    },
  };

  const t = tones[tone] || tones.ocean;

  return (
    <div
      className={cx(
        "rounded-2xl px-3 py-2.5 backdrop-blur",
        "bg-white/10 hover:bg-white/12 transition",
        t.ring
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cx("w-9 h-9 rounded-2xl grid place-items-center", t.iconBg)}>
          <Icon className={cx("w-4.5 h-4.5", t.icon)} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className={cx("text-[11px] uppercase tracking-wide", t.label)}>{label}</div>
          <div className={cx("text-lg font-extrabold leading-tight", t.value)}>
            {loading ? <Skeleton width={40} /> : value}
          </div>
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
        "p-2 rounded-full transition",
        "bg-white/80 hover:bg-white shadow-sm border border-slate-200",
        "dark:bg-zinc-900/70 dark:hover:bg-zinc-900 dark:border-zinc-800",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-500",
        "dark:focus-visible:ring-offset-zinc-950",
        disabled ? "opacity-50 cursor-not-allowed hover:bg-white" : ""
      )}
    >
      {children}
    </button>
  );
}

function CalendarDayCell({ dia, dataISO, diaInfo, eHoje, onClick }) {
  const { estado, motivo, ocupados, totalSlots, labelResumo } = diaInfo;

  const HOJE_BG = "bg-sky-100/70 dark:bg-sky-950/25";
  const HOJE_RING = "ring-2 ring-sky-500/70 dark:ring-sky-700/60";
  const HOJE_BADGE =
    "bg-sky-200 text-sky-950 border border-sky-300 dark:bg-sky-900/40 dark:text-sky-100 dark:border-sky-800";

  const cellTone = {
    bloqueado: "bg-slate-100 dark:bg-zinc-900/70 border-slate-200 dark:border-zinc-800",
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
        "relative min-h-[108px] sm:min-h-[132px] md:min-h-[150px] w-full text-left p-2.5 sm:p-3",
        "border-r border-b transition",
        cellTone,
        eHoje ? cx(HOJE_BG, HOJE_RING) : "",
        "hover:brightness-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
      )}
      aria-label={`Dia ${dia}. ${labelResumo}`}
      title={labelResumo}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div
            className={cx(
              "text-sm sm:text-base font-extrabold",
              eHoje ? "text-sky-800 dark:text-sky-200" : "text-slate-900 dark:text-white"
            )}
          >
            {dia}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400">
            {DIAS_SEMANA[getDayOfWeekFromISO(dataISO)]}
          </div>
        </div>

        {eHoje && (
          <span
            className={cx(
              "text-[10px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap",
              HOJE_BADGE
            )}
          >
            Hoje
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <span
          className={cx(
            "inline-flex w-fit items-center rounded-full border px-2 py-1 text-[10px] sm:text-[11px] font-extrabold",
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
          <p className="text-[11px] sm:text-xs leading-snug text-slate-600 dark:text-zinc-300 line-clamp-3">
            {motivo}
          </p>
        ) : (
          <div className="space-y-1">
            <p className="text-[11px] sm:text-xs text-slate-600 dark:text-zinc-300">
              {ocupados}/{totalSlots} horários ocupados
            </p>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className={cx(
                  "h-full rounded-full transition-all",
                  estado === "lotado" ? "bg-violet-400" : "bg-sky-500"
                )}
                style={{ width: `${Math.max(0, Math.min(100, (ocupados / totalSlots) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </button>
  );
}

function SlotCardDia({ slot, baseURL, onEditar, onExcluir }) {
  const status = slot?.reserva ? slot.reserva.status : "livre";
  const titulo = slot?.reserva?.finalidade?.trim()
    ? slot.reserva.finalidade.trim()
    : labelStatus(status);

  const solicitante = slot?.reserva?.solicitante_nome || "—";
  const aprovador =
    slot?.reserva?.aprovador_nome || (status === "aprovado" || status === "confirmado"
      ? "—"
      : "Não aprovado");

  const temTermo =
    Boolean(slot?.reserva?.termo_aceito) &&
    Boolean(slot?.reserva?.termo_assinado_em) &&
    Boolean(slot?.reserva?.assinatura_id);

  function abrirPdfTermo() {
  if (!slot?.reserva?.id) return;

  const url = `${baseURL}/salas/admin/reservas/${slot.reserva.id}/termo-pdf`;
  console.log("[AgendaSalasAdmin][PDF_TERMO] Abrindo termo:", {
    reservaId: slot.reserva.id,
    url,
  });

  window.open(url, "_blank", "noopener,noreferrer");
}

  return (
    <div
      className={cx(
        "rounded-2xl p-3 sm:p-4",
        slot?.reserva
          ? classesStatusSlot(status)
          : "bg-white border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-zinc-400 font-bold">
              {slot.periodoLabel}
            </span>
            <span
              className={cx(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold",
                getStatusTone(status)
              )}
            >
              {labelStatus(status)}
            </span>
            {temTermo && (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/20 dark:text-sky-300 dark:border-sky-900/60">
                <FileSignature className="w-3.5 h-3.5" />
                Termo assinado
              </span>
            )}
          </div>

          <p className="mt-2 text-sm sm:text-base font-extrabold leading-snug break-words text-slate-900 dark:text-white">
            {titulo}
          </p>

          {slot?.reserva ? (
            <div className="mt-3 space-y-1.5 text-[12px] sm:text-[13px] text-slate-700 dark:text-zinc-300">
              <p>
                <span className="font-semibold">Solicitante:</span> {solicitante}
              </p>

              <p>
                <span className="font-semibold">Aprovador:</span> {aprovador}
              </p>

              {slot?.reserva?.solicitante_unidade && (
                <p>
                  <span className="font-semibold">Unidade:</span> {slot.reserva.solicitante_unidade}
                </p>
              )}

              {slot?.reserva?.qtd_pessoas ? (
                <p>
                  <span className="font-semibold">Pessoas:</span> {slot.reserva.qtd_pessoas}
                </p>
              ) : null}

              {slot?.reserva?.coffee_break ? (
                <p>
                  <span className="font-semibold">Coffee break:</span> Sim
                </p>
              ) : null}

              {temTermo && (
                <p>
                  <span className="font-semibold">Assinado em:</span>{" "}
                  {formatDateTimeBR(slot.reserva.termo_assinado_em)}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-[12px] sm:text-[13px] text-slate-600 dark:text-zinc-400">
              Horário disponível para edição/criação.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onEditar}
          className={cx(
            "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-extrabold transition",
            "bg-slate-900 text-white hover:bg-slate-800",
            "dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          )}
        >
          <Pencil className="w-4 h-4" />
          {slot?.reserva ? "Editar" : "Reservar / Editar"}
        </button>

        {slot?.reserva && temTermo && (
          <button
            type="button"
            onClick={abrirPdfTermo}
            className={cx(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-extrabold transition",
              "bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100",
              "dark:bg-sky-950/20 dark:text-sky-300 dark:border-sky-900/60 dark:hover:bg-sky-950/30"
            )}
          >
            <FileText className="w-4 h-4" />
            Ver termo (PDF)
          </button>
        )}

        {slot?.reserva && (
          <button
            type="button"
            onClick={onExcluir}
            className={cx(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-extrabold transition",
              "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100",
              "dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/60 dark:hover:bg-rose-950/30"
            )}
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </button>
        )}
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ open, reserva, onClose, onConfirm, deleting }) {
  if (!open || !reserva) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-0 p-4 grid place-items-center">
        <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Confirmar exclusão
              </h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Esta ação removerá a reserva selecionada.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-5">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900/60 p-4">
              <p className="text-sm text-rose-800 dark:text-rose-200">
                <span className="font-extrabold">Reserva:</span> {reserva.finalidade || "Sem título"}
              </p>
              <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                <span className="font-semibold">Solicitante:</span> {reserva.solicitante_nome || "—"}
              </p>
              <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                <span className="font-semibold">Status:</span> {labelStatus(reserva.status)}
              </p>
            </div>

            <p className="mt-4 text-sm text-slate-600 dark:text-zinc-300">
              Confirme apenas se tiver certeza. Esta exclusão está protegida também no backend.
            </p>
          </div>

          <div className="px-5 pb-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-sm font-bold hover:bg-slate-50 dark:hover:bg-zinc-900"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={deleting}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-extrabold hover:bg-rose-700 disabled:opacity-60"
            >
              {deleting ? "Excluindo..." : "Excluir reserva"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalDiaAgenda({ open, diaDetalhe, baseURL, onClose, onEditarSlot, onExcluirReserva }) {
  if (!open || !diaDetalhe) return null;

  const { dataISO, bloqueado, motivo, salas } = diaDetalhe;

  return (
    <div className="fixed inset-0 z-[80]">
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="absolute inset-0 p-3 sm:p-5 grid place-items-center">
        <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-[28px] bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-2 text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wide">
                  <CalendarRange className="w-4 h-4" />
                  Agenda do dia
                </span>
              </div>

              <h3 className="mt-1 text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatDataBR(dataISO)} — {getDiaSemanaLabelLongo(dataISO)}
              </h3>

              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                Visualização consolidada de Auditório e Sala de Reunião.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto max-h-[calc(92vh-90px)] px-4 sm:px-6 py-5">
            {bloqueado ? (
              <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 p-6 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-200 dark:bg-zinc-800 grid place-items-center">
                  <Lock className="w-6 h-6 text-slate-700 dark:text-zinc-300" />
                </div>

                <h4 className="mt-4 text-xl font-extrabold text-slate-900 dark:text-white">
                  Dia bloqueado
                </h4>

                <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-zinc-300 max-w-2xl mx-auto">
                  {motivo || "Data indisponível para agendamento."}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {salas.map((salaItem) => (
                  <section
                    key={salaItem.sala}
                    className="rounded-3xl border border-slate-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950"
                  >
                    <div className="px-4 sm:px-5 py-4 bg-slate-50 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <h4 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                          {salaItem.label}
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-zinc-400">
                          Capacidade conforto: {salaItem.capacidade.conforto} • Máximo:{" "}
                          {salaItem.capacidade.max}
                        </p>
                      </div>

                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 dark:bg-zinc-800 px-3 py-1 text-xs font-bold text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                        {salaItem.ocupados}/2 ocupados
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 sm:p-5">
                      {salaItem.slots.map((slot) => (
                        <SlotCardDia
                          key={`${slot.sala}-${slot.periodo}`}
                          slot={slot}
                          baseURL={baseURL}
                          onEditar={() => onEditarSlot(slot)}
                          onExcluir={() => onExcluirReserva(slot)}
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

/* ───────────────────────────── Página ───────────────────────────── */
function AgendaSalasAdmin() {
  const navigate = useNavigate();
  const baseURL = (api.defaults?.baseURL || "/api").replace(/\/+$/, "");
  const hojeISO = useMemo(() => getHojeISO(), []);

  const hojeParts = splitISO(hojeISO);
  const [ano, setAno] = useState(hojeParts.year);
  const [mesIndex, setMesIndex] = useState((hojeParts.month || 1) - 1);

  const [loading, setLoading] = useState(false);
  const [reservasMap, setReservasMap] = useState({});
  const [feriadosMap, setFeriadosMap] = useState({});
  const [datasBloqueadasMap, setDatasBloqueadasMap] = useState({});

  const [modalAberto, setModalAberto] = useState(false);
  const [slotSelecionado, setSlotSelecionado] = useState(null);
  const [reservaSelecionada, setReservaSelecionada] = useState(null);

  const [diaModalAberto, setDiaModalAberto] = useState(false);
  const [diaSelecionadoISO, setDiaSelecionadoISO] = useState(null);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [reservaParaExcluir, setReservaParaExcluir] = useState(null);
  const [deletingReserva, setDeletingReserva] = useState(false);

  const semanas = useMemo(() => criarMatrixMes(ano, mesIndex), [ano, mesIndex]);

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
    const p = splitISO(agoraISO);
    setAno(p.year);
    setMesIndex((p.month || 1) - 1);
  }, []);

  const handleKeyNav = useCallback(
    (e) => {
      const tag = (e?.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;

      if (e.key === "ArrowLeft") mudarMes(-1);
      if (e.key === "ArrowRight") mudarMes(1);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
        e.preventDefault();
        hojeClick();
      }
    },
    [mudarMes, hojeClick]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyNav);
    return () => window.removeEventListener("keydown", handleKeyNav);
  }, [handleKeyNav]);

  useEffect(() => {
    carregarAgenda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mesIndex]);

  async function carregarAgenda() {
    try {
      setLoading(true);
      console.log("[AgendaSalasAdmin][LOAD] Carregando agenda do mês", {
        ano,
        mes: mesIndex + 1,
      });

      const anoParam = ano;
      const mesParam = mesIndex + 1;

      const qsAuditorio = new URLSearchParams({
        ano: String(anoParam),
        mes: String(mesParam),
        sala: "auditorio",
      }).toString();

      const qsSalaReuniao = new URLSearchParams({
        ano: String(anoParam),
        mes: String(mesParam),
        sala: "sala_reuniao",
      }).toString();

      const [respA, respS] = await Promise.all([
        api.get(`/salas/agenda-admin?${qsAuditorio}`),
        api.get(`/salas/agenda-admin?${qsSalaReuniao}`),
      ]);

      const dataAuditorio = respA?.data ?? respA ?? {};
      const dataSalaReuniao = respS?.data ?? respS ?? {};

      const novoMapaReservas = {};

      for (const r of dataAuditorio.reservas || []) {
        const nr = normalizeReserva(r);
        if (!nr.dataISO || !nr.sala) continue;
        novoMapaReservas[keySlot(nr.dataISO, nr.periodo, nr.sala)] = nr;
      }

      for (const r of dataSalaReuniao.reservas || []) {
        const nr = normalizeReserva(r);
        if (!nr.dataISO || !nr.sala) continue;
        novoMapaReservas[keySlot(nr.dataISO, nr.periodo, nr.sala)] = nr;
      }

      const ferMap = {};
      const feriadosBase = dataAuditorio.feriados?.length
        ? dataAuditorio.feriados
        : dataSalaReuniao.feriados || [];

      for (const f of feriadosBase || []) {
        const dataISO = (f.data || "").slice(0, 10);
        if (dataISO) ferMap[dataISO] = f;
      }

      const bloqueiosMap = {};
      const bloqueiosBase = dataAuditorio.datas_bloqueadas?.length
        ? dataAuditorio.datas_bloqueadas
        : dataSalaReuniao.datas_bloqueadas || [];

      for (const b of bloqueiosBase || []) {
        const dataISO = (b.data || "").slice(0, 10);
        if (dataISO) bloqueiosMap[dataISO] = b;
      }

      setReservasMap(novoMapaReservas);
      setFeriadosMap(ferMap);
      setDatasBloqueadasMap(bloqueiosMap);
    } catch (err) {
      console.error("[AgendaSalasAdmin][LOAD][ERRO]", err);
      toast.error("Erro ao carregar agenda de salas.");
    } finally {
      setLoading(false);
    }
  }

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

  function getReservaSlot(dataISO, periodo, salaKey) {
    return reservasMap[keySlot(dataISO, periodo, salaKey)] || null;
  }

  function getDiaInfo(dataISO) {
    const diaSemana = getDayOfWeekFromISO(dataISO);
    const ehFeriado = !!feriadosMap[dataISO];
    const ehBloqueada = !!datasBloqueadasMap[dataISO];
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
    const totalSlots = SALAS_ORDEM.length * PERIODOS.length;

    const salas = SALAS_ORDEM.map((salaKey) => {
      const slots = PERIODOS.map((p) => {
        const reserva = getReservaSlot(dataISO, p.value, salaKey);
        if (reserva) ocupados += 1;

        return {
          dataISO,
          sala: salaKey,
          salaLabel: CAPACIDADES_SALA[salaKey].labelCurta,
          periodo: p.value,
          periodoLabel: p.label,
          reserva,
        };
      });

      return {
        sala: salaKey,
        label: CAPACIDADES_SALA[salaKey].labelCurta,
        capacidade: CAPACIDADES_SALA[salaKey],
        ocupados: slots.filter((s) => !!s.reserva).length,
        slots,
      };
    });

    let estado = "vazio";
    if (bloqueado) estado = "bloqueado";
    else if (ocupados >= totalSlots) estado = "lotado";
    else estado = "parcial";

    const labelResumo =
      estado === "bloqueado"
        ? `Bloqueado. ${motivo || ""}`
        : estado === "lotado"
          ? "Sem horário disponível"
          : `${totalSlots - ocupados} horários disponíveis`;

    return {
      dataISO,
      bloqueado,
      motivo,
      ocupados,
      totalSlots,
      estado,
      salas,
      labelResumo,
    };
  }

  const diasDoMes = useMemo(() => {
    const last = new Date(ano, mesIndex + 1, 0).getDate();
    return Array.from({ length: last }, (_, i) => i + 1);
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

  const totalMes = useMemo(() => Object.keys(reservasMap).length, [reservasMap]);

  const totalAprovados = useMemo(
    () =>
      Object.values(reservasMap).filter(
        (r) => r?.status === "aprovado" || r?.status === "confirmado"
      ).length,
    [reservasMap]
  );

  const totalPendentes = useMemo(
    () => Object.values(reservasMap).filter((r) => r?.status === "pendente").length,
    [reservasMap]
  );

  const totalDiasBloqueados = useMemo(
    () => Object.values(diaInfosMap).filter((d) => d?.estado === "bloqueado").length,
    [diaInfosMap]
  );

  const totalDiasLotados = useMemo(
    () => Object.values(diaInfosMap).filter((d) => d?.estado === "lotado").length,
    [diaInfosMap]
  );

  const totalDiasComDisponibilidade = useMemo(
    () =>
      Object.values(diaInfosMap).filter((d) => d?.estado === "parcial" || d?.estado === "vazio")
        .length,
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

  function abrirExcluirReserva(slot) {
    if (!slot?.reserva?.id) {
      toast.info("Este horário ainda está livre, não há reserva para excluir.");
      return;
    }

    setReservaParaExcluir(slot.reserva);
    setConfirmDeleteOpen(true);
  }

  function fecharExcluirReserva() {
    if (deletingReserva) return;
    setConfirmDeleteOpen(false);
    setReservaParaExcluir(null);
  }

  async function confirmarExcluirReserva() {
    if (!reservaParaExcluir?.id) return;

    try {
      setDeletingReserva(true);

      console.log("[AgendaSalasAdmin][DELETE] Tentando excluir reserva", {
        reservaId: reservaParaExcluir.id,
      });

      await api.delete(`/salas/admin/reservas/${reservaParaExcluir.id}`);

      toast.success("Reserva excluída com sucesso.");
      setConfirmDeleteOpen(false);
      setReservaParaExcluir(null);
      fecharModalDia();
      await carregarAgenda();
    } catch (err) {
      console.error("[AgendaSalasAdmin][DELETE][ERRO]", err);
      toast.error(err?.response?.data?.erro || "Não foi possível excluir a reserva.");
    } finally {
      setDeletingReserva(false);
    }
  }

  function abrirRelatorioMensal() {
    const url = `${baseURL}/salas/admin/relatorio-mensal?ano=${ano}&mes=${mesIndex + 1}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-white dark:from-zinc-950 dark:via-zinc-950 dark:to-black text-gray-900 dark:text-gray-100">
      <header className="relative overflow-hidden text-white shadow-[0_20px_60px_-35px_rgba(2,6,23,0.75)]">
        <div
          className="absolute inset-0 bg-gradient-to-br from-slate-950 via-sky-900 to-violet-900"
          aria-hidden="true"
        />
        <div
          className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-cyan-400/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-fuchsia-400/15 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 opacity-[0.10] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.55)_1px,transparent_0)] [background-size:18px_18px]"
          aria-hidden="true"
        />

        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
        >
          Ir para o conteúdo
        </a>

        <div className="relative max-w-7xl mx-auto px-4 py-7 sm:py-9">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2.5 sm:p-3 rounded-2xl bg-white/12 ring-1 ring-white/15 backdrop-blur">
                <CalendarDays className="w-7 h-7 sm:w-8 sm:h-8" aria-hidden="true" />
              </div>

              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  Agenda de Salas — Administração
                </h1>
                <p className="mt-1 text-sm sm:text-base text-white/85 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 opacity-90" />
                  Calendário mensal premium com visão consolidada por dia
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 flex-wrap items-start">
              <div className="rounded-2xl px-3 py-2 bg-white/10 ring-1 ring-white/15 backdrop-blur">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-white/90">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="font-semibold">Auditório</span>
                </div>
                <p className="mt-1 text-sm font-extrabold">
                  {CAPACIDADES_SALA.auditorio.conforto}{" "}
                  <span className="text-white/70">/</span>{" "}
                  {CAPACIDADES_SALA.auditorio.max}{" "}
                  <span className="text-white/70">máx.</span>
                </p>
              </div>

              <div className="rounded-2xl px-3 py-2 bg-white/10 ring-1 ring-white/15 backdrop-blur">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-white/90">
                  <Users className="w-4 h-4" />
                  <span className="font-semibold">Sala de Reunião</span>
                </div>
                <p className="mt-1 text-sm font-extrabold">
                  {CAPACIDADES_SALA.sala_reuniao.conforto}{" "}
                  <span className="text-white/70">/</span>{" "}
                  {CAPACIDADES_SALA.sala_reuniao.max}{" "}
                  <span className="text-white/70">máx.</span>
                </p>
              </div>

              <button
                type="button"
                onClick={abrirRelatorioMensal}
                className={cx(
                  "inline-flex items-center gap-2 px-3 py-2 rounded-2xl",
                  "bg-white/12 hover:bg-white/16 ring-1 ring-white/15 backdrop-blur",
                  "text-white text-xs sm:text-sm font-extrabold transition",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70 focus-visible:ring-offset-transparent"
                )}
                title="Gerar PDF do mês"
              >
                <FileText className="w-4 h-4" />
                Relatório do mês (PDF)
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
            <MiniStat icon={Sparkles} label="Reservas no mês" value={totalMes} loading={loading} />
            <MiniStat
              icon={ShieldCheck}
              label="Aprovadas"
              value={totalAprovados}
              loading={loading}
            />
            <MiniStat icon={Waves} label="Pendentes" value={totalPendentes} loading={loading} />
            <MiniStat
              icon={Lock}
              label="Dias bloqueados"
              value={totalDiasBloqueados}
              loading={loading}
            />
            <MiniStat
              icon={CheckCircle2}
              label="Dias com vaga"
              value={totalDiasComDisponibilidade}
              loading={loading}
            />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/15" aria-hidden="true" />
      </header>

      <main id="conteudo" className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 sm:py-8">
        <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-white/85 dark:bg-zinc-950/80 backdrop-blur border-b border-slate-200/60 dark:border-zinc-800/70 mb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <SoftIconButton
                onClick={() => mudarMes(-1)}
                ariaLabel="Mês anterior"
                title="Mês anterior (atalho ←)"
              >
                <ChevronLeft className="w-4 h-4" />
              </SoftIconButton>

              <div className="px-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  Mês
                </p>
                <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                  {NOMES_MESES[mesIndex]} {ano}
                </p>
              </div>

              <SoftIconButton
                onClick={() => mudarMes(1)}
                ariaLabel="Próximo mês"
                title="Próximo mês (atalho →)"
              >
                <ChevronRight className="w-4 h-4" />
              </SoftIconButton>

              <button
                className={cx(
                  "ml-1 px-3 py-1.5 rounded-2xl text-xs font-extrabold",
                  "bg-sky-600 hover:bg-sky-700 text-white shadow-sm",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-500",
                  "dark:focus-visible:ring-offset-zinc-950"
                )}
                onClick={hojeClick}
                aria-label="Ir para o mês atual"
                title="Atalho: Ctrl/Cmd + H"
              >
                Hoje
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-2 md:items-center text-xs sm:text-sm">
              <span className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-800 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200">
                Clique no dia para ver Auditório + Sala de Reunião
              </span>

              {loading ? (
                <span className="text-slate-500 dark:text-zinc-400 inline-flex items-center gap-2">
                  <Skeleton width={160} height={18} />
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-800 dark:bg-violet-950/20 dark:border-violet-900/60 dark:text-violet-200">
                  {totalDiasLotados} dia(s) totalmente ocupado(s)
                </span>
              )}
            </div>
          </div>
        </div>

        {loading && (
          <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:bg-sky-950/20 dark:border-sky-900/50 dark:text-sky-200">
            Carregando agenda do mês...
          </div>
        )}

        <div className="mb-3 rounded-2xl bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] sm:text-xs text-slate-800 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 text-sky-700 dark:text-sky-300" />
            <p>
              <strong>Feriados</strong>, <strong>pontos facultativos</strong> e{" "}
              <strong>datas bloqueadas</strong> deixam o dia indisponível. Dias com todos os
              horários ocupados ficam em <strong>lilás suave</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/admin/calendario-bloqueios")}
            className="inline-flex px-3 py-1.5 rounded-full text-[11px] font-extrabold border border-slate-300 text-slate-800 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800/70"
          >
            Gerenciar feriados
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
          {[
            {
              c: "bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-700",
              t: "Dia com disponibilidade",
            },
            { c: "bg-violet-100 border-violet-300", t: "Dia totalmente ocupado" },
            { c: "bg-slate-200 border-slate-300", t: "Bloqueado / fim de semana / feriado" },
          ].map((it) => (
            <span
              key={it.t}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/70 dark:bg-zinc-950/40 border border-slate-200/70 dark:border-zinc-800"
            >
              <span className={cx("w-3 h-3 rounded-full border", it.c)} />
              {it.t}
            </span>
          ))}
        </div>

        <section className="bg-white dark:bg-zinc-950 rounded-3xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[11px] sm:text-sm">
            {DIAS_SEMANA.map((d) => (
              <div
                key={d}
                className="py-2.5 text-center font-bold text-slate-600 dark:text-zinc-300 uppercase tracking-wide"
              >
                {d}
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
                        className="min-h-[108px] sm:min-h-[132px] md:min-h-[150px] border-r border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/30"
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

          {!loading && !Object.keys(reservasMap).length && (
            <div className="p-6 text-center text-sm text-slate-500 dark:text-zinc-400">
              Nenhuma reserva localizada para {NOMES_MESES[mesIndex]} / {ano}. Ainda assim, os
              dias seguem clicáveis para criação ou análise.
            </div>
          )}
        </section>
      </main>

      <Footer />

      <ModalDiaAgenda
        open={diaModalAberto}
        diaDetalhe={diaDetalheSelecionado}
        baseURL={baseURL}
        onClose={fecharModalDia}
        onEditarSlot={abrirEditarSlot}
        onExcluirReserva={abrirExcluirReserva}
      />

      <ConfirmDeleteModal
        open={confirmDeleteOpen}
        reserva={reservaParaExcluir}
        onClose={fecharExcluirReserva}
        onConfirm={confirmarExcluirReserva}
        deleting={deletingReserva}
      />

      {modalAberto && slotSelecionado && (
        <ModalReservaAdmin
          onClose={fecharModalSlot}
          slot={slotSelecionado}
          reserva={reservaSelecionada}
          sala={slotSelecionado.sala}
          capacidadeSala={CAPACIDADES_SALA[slotSelecionado.sala]}
          recarregar={carregarAgenda}
          baseURL={baseURL}
          origem="calendario_dia"
        />
      )}
    </div>
  );
}

export default AgendaSalasAdmin;