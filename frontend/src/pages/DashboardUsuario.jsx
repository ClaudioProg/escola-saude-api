// ✅ frontend/src/pages/DashboardUsuario.jsx — v2.0
/* eslint-disable no-console */
/**
 * Plataforma Escola da Saúde
 *
 * Dashboard premium do usuário autenticado.
 *
 * Função:
 * - Exibir resumo do usuário.
 * - Exibir notificações não lidas.
 * - Exibir informações institucionais publicadas.
 *
 * Contrato oficial esperado:
 * - apiDashboardResumo()              → GET /dashboard
 * - apiInformacaoPublicadaListar()    → GET /informacao/publicada
 * - apiNotificacaoListar()            → GET /notificacao
 * - apiNotificacaoResumo()            → GET /notificacao/resumo
 * - apiNotificacaoMarcarLida(id)      → PATCH /notificacao/:id/lida
 * - apiNotificacaoMarcarTodasLidas()  → PATCH /notificacao/lida/todas
 *
 * Padrão:
 * - Sem apiGet/apiPatch direto no componente.
 * - Sem rota /dashboard-usuario.
 * - Sem /api dentro das chamadas do frontend.
 * - Sem fallbacks camelCase legados.
 * - Campos do dashboard em snake_case.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import DOMPurify from "dompurify";
import { toast } from "react-toastify";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BellRing,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Info,
  LayoutPanelTop,
  Megaphone,
  Newspaper,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  XCircle,
} from "lucide-react";

import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";

import useEscolaTheme from "../hooks/useEscolaTheme";
import {
  apiDashboardResumo,
  apiInformacaoPublicadaListar,
  apiNotificacaoListar,
  apiNotificacaoResumo,
  apiNotificacaoMarcarLida,
  apiNotificacaoMarcarTodasLidas,
  apiPesquisaListarPublicadas,
} from "../services/api";

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function clamp(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) return min;

  return Math.max(min, Math.min(max, number));
}

function unwrap(response) {
  return response?.data ?? response;
}

function getErrorMessage(error, fallback) {
  const data = error?.response?.data || error?.data || {};

  return data?.message || data?.erro || error?.message || fallback;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function todayYmd() {
  const now = new Date();
  const pad = (item) => String(item).padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatDateYmd(value) {
  const ymd = String(value || "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "—";

  const [year, month, day] = ymd.split("-");

  return `${day}/${month}/${year}`;
}

function formatDateTime(value) {
  const text = String(value || "").trim();

  if (!text) return "";

  const onlyDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (onlyDate) {
    return `${onlyDate[3]}/${onlyDate[2]}/${onlyDate[1]}`;
  }

  const dateTime = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/
  );

  if (dateTime) {
    const [, year, month, day, hour, minute] = dateTime;
    return `${day}/${month}/${year} ${hour}:${minute}`;
  }

  return text;
}

function sanitizeHtml(html = "") {
  return DOMPurify.sanitize(String(html || ""), {
    USE_PROFILES: { html: true },
  });
}

function getPublicationStatus(item) {
  const hoje = todayYmd();

  if (!item?.ativo) return "inativa";
  if (item?.data_inicio_exibicao && hoje < item.data_inicio_exibicao) {
    return "agendada";
  }
  if (item?.data_fim_exibicao && hoje > item.data_fim_exibicao) {
    return "expirada";
  }

  return "ativa";
}

function getPublicationPeriod(item) {
  if (!item?.data_inicio_exibicao && !item?.data_fim_exibicao) return "";

  if (item?.data_inicio_exibicao && item?.data_fim_exibicao) {
    return `${formatDateYmd(item.data_inicio_exibicao)} até ${formatDateYmd(
      item.data_fim_exibicao
    )}`;
  }

  if (item?.data_inicio_exibicao) {
    return `A partir de ${formatDateYmd(item.data_inicio_exibicao)}`;
  }

  return `Até ${formatDateYmd(item.data_fim_exibicao)}`;
}

function normalizeNotificationType(tipo) {
  const value = String(tipo || "").trim();

  if (value === "evento") return "evento";
  if (value === "certificado") return "certificado";
  if (value === "avaliacao") return "avaliacao";
  if (value === "reserva_aprovada") return "reserva_aprovada";
  if (value === "reserva_rejeitada") return "reserva_rejeitada";
  if (value === "submissao") return "submissao";
  if (value === "aviso") return "aviso";

  return "outro";
}

function notificationTypeLabel(tipo) {
  const value = normalizeNotificationType(tipo);

  const labels = {
    evento: "Evento",
    certificado: "Certificado",
    avaliacao: "Avaliação",
    reserva_aprovada: "Reserva aprovada",
    reserva_rejeitada: "Reserva não aprovada",
    submissao: "Submissão",
    aviso: "Aviso",
    outro: "Atualização",
  };

  return labels[value] || labels.outro;
}

/* ─────────────────────────────────────────────────────────────
   Componentes visuais locais
────────────────────────────────────────────────────────────── */

function SectionShell({
  title,
  subtitle,
  action,
  icon: Icon = Activity,
  gradient = "from-emerald-600 via-teal-500 to-sky-600",
  children,
}) {
  return (
    <section
      className="mt-8 overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/90 shadow-sm dark:border-white/10 dark:bg-zinc-900/55"
      aria-label={title}
    >
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />

      <div className="p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              Painel
            </div>

            <h2 className="mt-3 text-xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100 sm:text-2xl">
              {title}
            </h2>

            {subtitle ? (
              <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-zinc-400">
                {subtitle}
              </p>
            ) : null}
          </div>

          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </section>
  );
}

function InfoRibbon() {
  return (
    <div className="rounded-[26px] border border-emerald-200/70 bg-gradient-to-r from-emerald-50 via-white to-sky-50 p-4 shadow-sm dark:border-emerald-400/15 dark:from-emerald-950/30 dark:via-zinc-900/40 dark:to-sky-950/20 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-2xl bg-emerald-600/10 p-3 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">
            Ambiente institucional, seguro e orientado por dados
          </p>

          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            Acompanhe seus indicadores de participação, notificações não lidas e
            publicações oficiais disponibilizadas pela Escola da Saúde.
          </p>
        </div>
      </div>
    </div>
  );
}

function MetaBadge({ icon: Icon, children, className = "" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-extrabold tracking-wide",
        className
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

function GhostAction({ icon: Icon, children, onClick, loading = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5"
    >
      {Icon ? (
        <Icon
          className={cx("h-4 w-4", loading ? "animate-spin" : "")}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}

function MiniStat({ icon: Icon, label, value, hint, tone = "emerald", onClick }) {
  const toneMap = {
    emerald: {
      soft: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-200 dark:bg-emerald-400/10",
      bar: "from-emerald-500 via-teal-500 to-cyan-500",
    },
    violet: {
      soft: "bg-violet-600/10 text-violet-700 dark:text-violet-200 dark:bg-violet-400/10",
      bar: "from-violet-500 via-fuchsia-500 to-pink-500",
    },
    amber: {
      soft: "bg-amber-600/10 text-amber-800 dark:text-amber-200 dark:bg-amber-400/10",
      bar: "from-amber-400 via-orange-400 to-amber-500",
    },
    rose: {
      soft: "bg-rose-600/10 text-rose-800 dark:text-rose-200 dark:bg-rose-400/10",
      bar: "from-rose-500 via-red-500 to-orange-500",
    },
    sky: {
      soft: "bg-sky-600/10 text-sky-700 dark:text-sky-200 dark:bg-sky-400/10",
      bar: "from-sky-500 via-cyan-500 to-blue-500",
    },
  };

  const cfg = toneMap[tone] || toneMap.emerald;
  const clickable = typeof onClick === "function";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={cx(
        "group overflow-hidden rounded-[26px] border border-slate-200/80 bg-white text-left shadow-sm transition-all dark:border-white/10 dark:bg-zinc-900/55",
        clickable
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          : "cursor-default"
      )}
      aria-label={`${label}: ${value ?? "—"}`}
    >
      <div className={`h-1.5 w-full bg-gradient-to-r ${cfg.bar}`} />

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-400">
              {label}
            </div>

            <div className="mt-2 text-2xl font-extrabold leading-none tracking-tight text-slate-900 dark:text-zinc-100 sm:text-[1.75rem]">
              {value}
            </div>

            {hint ? (
              <div className="mt-2 text-[12px] leading-relaxed text-slate-600 dark:text-zinc-400 sm:text-[13px]">
                {hint}
              </div>
            ) : null}
          </div>

          <div className={`shrink-0 rounded-2xl p-3 ${cfg.soft}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        {clickable ? (
          <div className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold text-slate-500 transition group-hover:text-slate-700 dark:text-zinc-400 dark:group-hover:text-zinc-200">
            Ver área
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
        ) : null}
      </div>
    </button>
  );
}

function NotaUsuarioCard({ nota, loading }) {
  const value = Number(nota);
  const nota10 = Number.isFinite(value) ? clamp(value, 0, 10) : null;
  const percent = nota10 === null ? 0 : (nota10 / 10) * 100;

  const barClass =
    nota10 === null
      ? "bg-slate-400"
      : nota10 >= 9
        ? "bg-emerald-500"
        : nota10 >= 7
          ? "bg-lime-500"
          : nota10 >= 5
            ? "bg-amber-500"
            : nota10 >= 3
              ? "bg-orange-500"
              : "bg-rose-600";

  const label =
    nota10 === null
      ? "Sem nota"
      : nota10 >= 9
        ? "Excelente"
        : nota10 >= 7
          ? "Bom"
          : nota10 >= 5
            ? "Regular"
            : nota10 >= 3
              ? "Atenção"
              : "Crítico";

  return (
    <div className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900/55 lg:col-span-2">
      <div className="h-1.5 w-full bg-gradient-to-r from-slate-500 via-slate-600 to-slate-700" />

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-400">
              Nota do usuário
            </div>

            <div className="mt-2 text-2xl font-extrabold leading-none tracking-tight text-slate-900 dark:text-zinc-100 sm:text-[1.75rem]">
              {loading ? "…" : nota10 === null ? "—" : nota10.toFixed(1)}
            </div>

            <div className="mt-2 text-[12px] text-slate-600 dark:text-zinc-400 sm:text-[13px]">
              Indicador consolidado de participação e desempenho.
            </div>
          </div>

          <div className="shrink-0 rounded-2xl bg-slate-100 p-3 text-slate-800 dark:bg-zinc-800 dark:text-zinc-100">
            <Star className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-5">
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={10}
            aria-valuenow={nota10 ?? 0}
          >
            <div
              className={cx("h-full rounded-full transition-all duration-700", barClass)}
              style={{ width: loading ? "35%" : `${percent}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[12px]">
            <span className="text-slate-600 dark:text-zinc-400">Status</span>
            <span className="font-extrabold text-slate-900 dark:text-zinc-100">
              {loading ? "Carregando…" : label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationIcon({ tipo }) {
  const value = normalizeNotificationType(tipo);

  if (value === "evento") {
    return (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
        <CalendarDays className="h-5 w-5" aria-hidden="true" />
      </span>
    );
  }

  if (value === "certificado" || value === "reserva_aprovada") {
    return (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
      </span>
    );
  }

  if (value === "avaliacao") {
    return (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
        <Star className="h-5 w-5" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
      <Info className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

function NotificationCard({ item, onMarcarLida, disabled }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className={cx(
        "overflow-hidden rounded-[26px] border border-amber-200/80 bg-amber-50/80 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-amber-900/40 dark:bg-amber-950/15",
        disabled ? "pointer-events-none opacity-70" : ""
      )}
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />

      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <NotificationIcon tipo={item?.tipo} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-extrabold leading-tight text-slate-900 dark:text-zinc-100">
                {item?.titulo || "Notificação"}
              </p>

              <MetaBadge className="border-slate-200 bg-white/80 text-slate-700 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                {notificationTypeLabel(item?.tipo)}
              </MetaBadge>

              <MetaBadge className="border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/30 dark:text-amber-200">
                não lida
              </MetaBadge>
            </div>

            {item?.mensagem ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
                {String(item.mensagem)}
              </p>
            ) : null}

            {(item?.criado_em || item?.data) ? (
              <p className="mt-3 text-[12px] text-slate-500 dark:text-zinc-400">
                {formatDateTime(item.criado_em || item.data)}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <GhostAction icon={Check} onClick={() => onMarcarLida(item, false)}>
                Marcar como lida
              </GhostAction>

              <GhostAction icon={ExternalLink} onClick={() => onMarcarLida(item, true)}>
                Ver mais
              </GhostAction>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function PesquisaAbertaCard({ item, onResponder }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="overflow-hidden rounded-[26px] border border-emerald-200/80 bg-emerald-50/80 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-emerald-900/40 dark:bg-emerald-950/15"
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-extrabold leading-tight text-slate-900 dark:text-zinc-100">
                {item?.titulo || "Pesquisa aberta"}
              </p>

              <MetaBadge className="border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/30 dark:text-emerald-200">
                aberta
              </MetaBadge>
            </div>

            {item?.descricao ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
                {String(item.descricao)}
              </p>
            ) : null}

            <div className="mt-4">
              <GhostAction icon={ExternalLink} onClick={() => onResponder(item)}>
                Responder pesquisa
              </GhostAction>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function PublicationCard({ item }) {
  const reduceMotion = useReducedMotion();
  const [imageOk, setImageOk] = useState(true);

  const html = useMemo(() => sanitizeHtml(item?.conteudo_html || ""), [item]);
  const status = getPublicationStatus(item);
  const period = getPublicationPeriod(item);

  const statusConfig = {
    ativa: {
      label: "Ativa",
      icon: BadgeCheck,
      className:
        "border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
    },
    agendada: {
      label: "Agendada",
      icon: CalendarDays,
      className:
        "border-amber-200/70 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
    },
    expirada: {
      label: "Expirada",
      icon: AlertTriangle,
      className:
        "border-rose-200/70 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
    },
    inativa: {
      label: "Inativa",
      icon: XCircle,
      className:
        "border-slate-200/70 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300",
    },
  }[status];

  const StatusIcon = statusConfig.icon;
  const TipoIcon = item?.tipo_exibicao === "comunicado" ? Newspaper : Sparkles;

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="group overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl dark:border-white/10 dark:bg-zinc-900/55"
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

      {item?.imagem_url && imageOk ? (
        <img
          src={item.imagem_url}
          alt={item?.titulo || "Publicação institucional"}
          className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-[1.02] sm:h-64"
          loading="lazy"
          decoding="async"
          onError={() => setImageOk(false)}
        />
      ) : (
        <div className="grid h-56 w-full place-items-center bg-gradient-to-br from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 sm:h-64">
          <div className="px-4 text-center font-semibold text-zinc-600 dark:text-zinc-300">
            <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-70" />
            Imagem indisponível
          </div>
        </div>
      )}

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <MetaBadge className="border-slate-300/70 bg-slate-100/80 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {item?.badge || "Escola da Saúde"}
          </MetaBadge>

          <MetaBadge className="border-sky-200/80 bg-sky-50/80 text-sky-800 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
            <TipoIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {item?.tipo_exibicao === "comunicado" ? "Comunicado" : "Destaque"}
          </MetaBadge>

          <MetaBadge className={statusConfig.className}>
            <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {statusConfig.label}
          </MetaBadge>

          {period ? (
            <MetaBadge
              icon={CalendarDays}
              className="border-slate-200 bg-slate-50/80 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300"
            >
              {period}
            </MetaBadge>
          ) : null}
        </div>

        <div className="mt-5">
          <h3 className="text-xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-zinc-100 sm:text-[1.35rem]">
            {item?.titulo || "Informação institucional"}
          </h3>

          {item?.subtitulo ? (
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600 dark:text-zinc-400">
              {item.subtitulo}
            </p>
          ) : null}
        </div>

        <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/10" />

        <div
          className="prose prose-sm mt-5 max-w-none dark:prose-invert prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-headings:font-extrabold prose-a:break-all"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </motion.article>
  );
}

function CardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900/55"
        >
          <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon = Sparkles, title, message }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-zinc-900/55 sm:p-8">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>

      <h3 className="mt-4 text-lg font-extrabold text-slate-900 dark:text-zinc-100">
        {title}
      </h3>

      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 dark:text-zinc-400">
        {message}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Página
────────────────────────────────────────────────────────────── */

export default function DashboardUsuario() {
  const navigate = useNavigate();
  const { isDark } = useEscolaTheme();

  const [resumo, setResumo] = useState(null);
  const [loadingResumo, setLoadingResumo] = useState(true);
  const [erroResumo, setErroResumo] = useState("");

  const [publicacoes, setPublicacoes] = useState([]);
  const [loadingPublicacoes, setLoadingPublicacoes] = useState(true);
  const [erroPublicacoes, setErroPublicacoes] = useState("");

  const [notificacoesNaoLidas, setNotificacoesNaoLidas] = useState([]);
  const [loadingNotificacoes, setLoadingNotificacoes] = useState(true);
  const [erroNotificacoes, setErroNotificacoes] = useState("");
  const [resumoNotificacoes, setResumoNotificacoes] = useState({
    total: 0,
    nao_lida: 0,
    por_tipo: {},
  });

const [marcandoNotifId, setMarcandoNotifId] = useState(null);
const [marcandoTodasNotifs, setMarcandoTodasNotifs] = useState(false);

const [pesquisasAbertas, setPesquisasAbertas] = useState([]);
const [loadingPesquisas, setLoadingPesquisas] = useState(true);
const [erroPesquisas, setErroPesquisas] = useState("");

  useEffect(() => {
    document.title = "Dashboard do Usuário — Escola da Saúde";
  }, []);

  const carregarResumo = useCallback(async () => {
    try {
      setLoadingResumo(true);
      setErroResumo("");

      const response = await apiDashboardResumo();
      const payload = unwrap(response) || {};

      setResumo(payload);
    } catch (error) {
      console.error("[DashboardUsuario] erro ao carregar resumo", {
        message: error?.message,
      });

      const message = getErrorMessage(
        error,
        "Não foi possível carregar seu resumo."
      );

      setResumo(null);
      setErroResumo(message);
      toast.error(message);
    } finally {
      setLoadingResumo(false);
    }
  }, []);

  const carregarPublicacoes = useCallback(async () => {
    try {
      setLoadingPublicacoes(true);
      setErroPublicacoes("");

      const response = await apiInformacaoPublicadaListar();
      const payload = unwrap(response) || {};
      const itens = Array.isArray(payload?.itens)
        ? payload.itens
        : Array.isArray(payload)
          ? payload
          : [];

      setPublicacoes(itens.filter((item) => getPublicationStatus(item) === "ativa"));
    } catch (error) {
      console.error("[DashboardUsuario] erro ao carregar publicações", {
        message: error?.message,
      });

      const message = getErrorMessage(
        error,
        "Não foi possível carregar as publicações institucionais."
      );

      setPublicacoes([]);
      setErroPublicacoes(message);
      toast.error(message);
    } finally {
      setLoadingPublicacoes(false);
    }
  }, []);

    const carregarNotificacoesNaoLidas = useCallback(async () => {
    try {
      setLoadingNotificacoes(true);
      setErroNotificacoes("");

      const [responseLista, responseResumo] = await Promise.all([
        apiNotificacaoListar(),
        apiNotificacaoResumo(),
      ]);

      const payloadLista = unwrap(responseLista) || {};
      const payloadResumo = unwrap(responseResumo) || {};

      const itens = Array.isArray(payloadLista?.itens)
        ? payloadLista.itens
        : Array.isArray(payloadLista)
          ? payloadLista
          : [];

      setNotificacoesNaoLidas(itens.filter((item) => !item?.lida));

      setResumoNotificacoes({
        total: toNumber(payloadResumo?.total, 0),
        nao_lida: toNumber(payloadResumo?.nao_lida, 0),
        por_tipo: payloadResumo?.por_tipo || {},
      });
    } catch (error) {
      console.error("[DashboardUsuario] erro ao carregar notificações", {
        message: error?.message,
      });

      const message = getErrorMessage(
        error,
        "Não foi possível carregar as notificações."
      );

      setNotificacoesNaoLidas([]);
      setErroNotificacoes(message);
      toast.error(message);
    } finally {
      setLoadingNotificacoes(false);
    }
  }, []);

const carregarPesquisasAbertas = useCallback(async () => {
  try {
    setLoadingPesquisas(true);
    setErroPesquisas("");

    const response = await apiPesquisaListarPublicadas();
    const payload = unwrap(response) || {};

    const itens = Array.isArray(payload?.itens)
      ? payload.itens
      : Array.isArray(payload)
        ? payload
        : [];

    setPesquisasAbertas(itens);
  } catch (error) {
    console.error("[DashboardUsuario] erro ao carregar pesquisas abertas", {
      message: error?.message,
    });

    setPesquisasAbertas([]);
    setErroPesquisas("Não foi possível carregar as pesquisas abertas.");
  } finally {
    setLoadingPesquisas(false);
  }
}, []);

useEffect(() => {
  carregarResumo();
  carregarPublicacoes();
  carregarNotificacoesNaoLidas();
  carregarPesquisasAbertas();
}, [
  carregarResumo,
  carregarPublicacoes,
  carregarNotificacoesNaoLidas,
  carregarPesquisasAbertas,
]);

  const stats = useMemo(() => {
    return {
      inscricao: toNumber(resumo?.inscricao_futura, 0),
      certificadoEmitido: toNumber(resumo?.certificado_emitido, 0),
      presencaTotal: toNumber(resumo?.presenca_total, 0),
      faltaTotal: toNumber(resumo?.falta_total, 0),
      notaUsuario:
        resumo?.nota_usuario === null || resumo?.nota_usuario === undefined
          ? null
          : Number(resumo.nota_usuario),
      avaliacaoPendente: toNumber(resumo?.avaliacao_pendente, 0),
    };
  }, [resumo]);

  const go = useCallback(
    (path) => {
      if (!path) return;
      navigate(path);
    },
    [navigate]
  );

  const marcarNotificacaoLida = useCallback(
    async (item, abrirCentral = false) => {
      if (!item?.id) return;

      try {
        setMarcandoNotifId(item.id);

        await apiNotificacaoMarcarLida(item.id);

        setNotificacoesNaoLidas((prev) =>
          prev.filter((notificacao) => notificacao.id !== item.id)
        );

        setResumoNotificacoes((prev) => ({
          ...prev,
          nao_lida: Math.max(0, toNumber(prev?.nao_lida, 0) - 1),
        }));

        if (typeof window.atualizarContadorNotificacao === "function") {
          window.atualizarContadorNotificacao();
        }

        if (abrirCentral) {
          navigate("/notificacao");
        }
      } catch (error) {
        console.error("[DashboardUsuario] erro ao marcar notificação", {
          notificacaoId: item?.id,
          message: error?.message,
        });

        toast.error("Não foi possível atualizar a notificação.");
      } finally {
        setMarcandoNotifId(null);
      }
    },
    [navigate]
  );

  const marcarTodasNotificacoes = useCallback(async () => {
    if (!resumoNotificacoes?.nao_lida) return;

    try {
      setMarcandoTodasNotifs(true);

      await apiNotificacaoMarcarTodasLidas();

      setNotificacoesNaoLidas([]);
      setResumoNotificacoes((prev) => ({
        ...prev,
        nao_lida: 0,
      }));

      if (typeof window.atualizarContadorNotificacao === "function") {
        window.atualizarContadorNotificacao();
      }

      toast.success("Notificações marcadas como lidas.");
    } catch (error) {
      console.error("[DashboardUsuario] erro ao marcar todas notificações", {
        message: error?.message,
      });

      toast.error("Não foi possível marcar todas as notificações.");
    } finally {
      setMarcandoTodasNotifs(false);
    }
  }, [resumoNotificacoes?.nao_lida]);

  const responderPesquisa = useCallback(
  (item) => {
    if (item?.tipo === "externa" && item?.link_externo) {
      window.open(item.link_externo, "_blank", "noopener,noreferrer");
      return;
    }

    navigate(`/pesquisa/${item.id}/responder`);
  },
  [navigate]
);

  return (
    <>
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <HeaderHero
  titulo="Dashboard do Usuário"
  subtitulo="Seu resumo de inscrições, presenças, certificados, notificações e publicações institucionais."
  badge="Escola da Saúde • Oficial • Ambiente Seguro"
  icon={Sparkles}
  gradient="from-emerald-700 via-teal-600 to-sky-700"
  isDark={isDark}
/>

        <div className="mt-6">
          <InfoRibbon />
        </div>

        <SectionShell
          title="Resumo geral"
          subtitle="Acompanhe seus indicadores acadêmicos e operacionais."
          icon={LayoutPanelTop}
          gradient="from-emerald-600 via-teal-500 to-sky-600"
        >

          {erroResumo ? (
            <div
              className="rounded-[26px] border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700 dark:text-amber-300" />
                <div>
                  <p className="font-extrabold text-amber-800 dark:text-amber-200">
                    Não foi possível carregar seu resumo
                  </p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                    {erroResumo}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat
              icon={ClipboardList}
              label="Inscrições futuras"
              value={loadingResumo ? "…" : stats.inscricao}
              hint="Cursos que você ainda vai realizar"
              tone="emerald"
              onClick={() => go("/eventos")}
            />

            <MiniStat
              icon={FileText}
              label="Certificados emitidos"
              value={loadingResumo ? "…" : stats.certificadoEmitido}
              hint="Documentos já disponíveis"
              tone="violet"
              onClick={() => go("/certificados")}
            />

            <MiniStat
              icon={CheckCircle2}
              label="Presenças"
              value={loadingResumo ? "…" : stats.presencaTotal}
              hint="Registros confirmados em cursos concluídos"
              tone="amber"
              onClick={() => go("/minhas-presencas")}
            />

            <MiniStat
              icon={XCircle}
              label="Faltas"
              value={loadingResumo ? "…" : stats.faltaTotal}
              hint="Ocorrências registradas em cursos concluídos"
              tone="rose"
              onClick={() => go("/minhas-presencas")}
            />

            <MiniStat
              icon={Star}
              label="Avaliações pendentes"
              value={loadingResumo ? "…" : stats.avaliacaoPendente}
              hint="Cursos encerrados aguardando avaliação"
              tone="sky"
              onClick={() => go("/avaliacoes")}
            />

            <NotaUsuarioCard nota={stats.notaUsuario} loading={loadingResumo} />
          </div>
        </SectionShell>

        <SectionShell
          title="Notificações não lidas"
          subtitle="Acompanhe aprovações, certificados, avaliações, reservas e demais avisos importantes."
          icon={Bell}
          gradient="from-violet-600 via-fuchsia-500 to-pink-500"
          action={
            <div className="flex flex-wrap items-center gap-2.5">
              <MetaBadge className="border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200">
                <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                {toNumber(resumoNotificacoes?.nao_lida, 0)} não lida(s)
              </MetaBadge>

              <GhostAction
                icon={RefreshCw}
                onClick={carregarNotificacoesNaoLidas}
                loading={loadingNotificacoes}
              >
                {loadingNotificacoes ? "Atualizando…" : "Recarregar"}
              </GhostAction>

              <GhostAction icon={ExternalLink} onClick={() => go("/notificacao")}>
                Ver todas
              </GhostAction>

              <GhostAction
                icon={Check}
                onClick={marcarTodasNotificacoes}
                loading={marcandoTodasNotifs}
                disabled={!toNumber(resumoNotificacoes?.nao_lida, 0)}
              >
                {marcandoTodasNotifs ? "Marcando…" : "Marcar todas"}
              </GhostAction>
            </div>
          }
        >
          {loadingNotificacoes ? <CardSkeleton count={4} /> : null}

          {!loadingNotificacoes && erroNotificacoes ? (
            <div
              className="rounded-[26px] border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700 dark:text-amber-300" />
                <div className="min-w-0">
                  <p className="font-extrabold text-amber-800 dark:text-amber-200">
                    Não foi possível carregar as notificações
                  </p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                    {erroNotificacoes}
                  </p>

                  <div className="mt-3">
                    <GhostAction
                      icon={RefreshCw}
                      onClick={carregarNotificacoesNaoLidas}
                    >
                      Tentar novamente
                    </GhostAction>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!loadingNotificacoes &&
          !erroNotificacoes &&
          notificacoesNaoLidas.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {notificacoesNaoLidas.map((item) => (
                <NotificationCard
                  key={item.id}
                  item={item}
                  disabled={marcandoNotifId === item.id}
                  onMarcarLida={marcarNotificacaoLida}
                />
              ))}
            </div>
          ) : null}

          {!loadingNotificacoes &&
          !erroNotificacoes &&
          notificacoesNaoLidas.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Você está em dia"
              message="Nenhuma notificação não lida no momento."
            />
          ) : null}
        </SectionShell>

                <SectionShell
          title="Pesquisas abertas"
          subtitle="Pesquisas institucionais disponíveis para participação."
          icon={ClipboardList}
          gradient="from-emerald-600 via-teal-500 to-cyan-500"
          action={
            <div className="flex flex-wrap items-center gap-2.5">
              {!loadingPesquisas && pesquisasAbertas.length > 0 ? (
                <MetaBadge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                  <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                  {pesquisasAbertas.length} aberta(s)
                </MetaBadge>
              ) : null}

              <GhostAction
                icon={RefreshCw}
                onClick={carregarPesquisasAbertas}
                loading={loadingPesquisas}
              >
                {loadingPesquisas ? "Atualizando…" : "Recarregar"}
              </GhostAction>
            </div>
          }
        >
          {loadingPesquisas ? <CardSkeleton count={2} /> : null}

          {!loadingPesquisas && erroPesquisas ? (
            <div
              className="rounded-[26px] border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700 dark:text-amber-300" />
                <div className="min-w-0">
                  <p className="font-extrabold text-amber-800 dark:text-amber-200">
                    Não foi possível carregar as pesquisas
                  </p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                    {erroPesquisas}
                  </p>

                  <div className="mt-3">
                    <GhostAction icon={RefreshCw} onClick={carregarPesquisasAbertas}>
                      Tentar novamente
                    </GhostAction>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!loadingPesquisas &&
          !erroPesquisas &&
          pesquisasAbertas.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {pesquisasAbertas.map((item) => (
                <PesquisaAbertaCard
                  key={item.id}
                  item={item}
                  onResponder={responderPesquisa}
                />
              ))}
            </div>
          ) : null}

          {!loadingPesquisas &&
          !erroPesquisas &&
          pesquisasAbertas.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Nenhuma pesquisa aberta"
              message="Quando houver pesquisas institucionais ativas, elas aparecerão aqui."
            />
          ) : null}
        </SectionShell>

        <SectionShell
          title="Informações institucionais"
          subtitle="Comunicados, campanhas e publicações oficiais cadastradas pela administração."
          icon={Megaphone}
          gradient="from-sky-600 via-cyan-500 to-emerald-500"
          action={
            <div className="flex flex-wrap items-center gap-2.5">
              {!loadingPublicacoes && publicacoes.length > 0 ? (
                <MetaBadge className="border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                  <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
                  {publicacoes.length} ativa(s)
                </MetaBadge>
              ) : null}

              <GhostAction
                icon={RefreshCw}
                onClick={carregarPublicacoes}
                loading={loadingPublicacoes}
              >
                {loadingPublicacoes ? "Atualizando…" : "Recarregar"}
              </GhostAction>
            </div>
          }
        >
          {loadingPublicacoes ? <CardSkeleton count={2} /> : null}

          {!loadingPublicacoes && erroPublicacoes ? (
            <div
              className="rounded-[26px] border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700 dark:text-amber-300" />
                <div className="min-w-0">
                  <p className="font-extrabold text-amber-800 dark:text-amber-200">
                    Não foi possível carregar as publicações
                  </p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                    {erroPublicacoes}
                  </p>

                  <div className="mt-3">
                    <GhostAction icon={RefreshCw} onClick={carregarPublicacoes}>
                      Tentar novamente
                    </GhostAction>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!loadingPublicacoes && publicacoes.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {publicacoes.map((item) => (
                <PublicationCard key={item.id} item={item} />
              ))}
            </div>
          ) : null}

          {!loadingPublicacoes && !erroPublicacoes && publicacoes.length === 0 ? (
            <EmptyState
              icon={BellRing}
              title="Nenhuma publicação disponível"
              message="Quando a administração cadastrar novos conteúdos ativos, eles aparecerão aqui automaticamente."
            />
          ) : null}
        </SectionShell>
      </main>

      <Footer />
    </>
  );
}