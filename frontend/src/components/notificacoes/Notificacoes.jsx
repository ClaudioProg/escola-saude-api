// ✅ frontend/src/components/notificacoes/Notificacoes.jsx — v2.0
/* eslint-disable no-console */
/**
 * Plataforma Escola da Saúde
 *
 * Componente compacto oficial de notificações.
 *
 * Função:
 * - Exibir lista resumida de notificações do usuário autenticado.
 * - Exibir ministats de total, não lidas e tipos principais.
 * - Atualizar lista.
 * - Marcar uma notificação como lida.
 * - Marcar todas como lidas.
 *
 * Contrato oficial:
 * - apiNotificacaoListar(params)
 * - apiNotificacaoResumo()
 * - apiNotificacaoMarcarLida(id)
 * - apiNotificacaoMarcarTodasLidas()
 *
 * Payload oficial:
 * - id
 * - tipo
 * - titulo
 * - mensagem
 * - lida
 * - criado_em
 * - turma_id
 * - evento_id
 * - reserva_id
 * - link
 * - metadata
 *
 * Padrão:
 * - Sem apiGet/apiPost direto.
 * - Sem "/api" dentro do componente.
 * - Sem aliases de data/leitura.
 * - Sem tipos legados.
 * - Sem POST para marcar lida.
 * - Mobile-first.
 * - Acessível.
 * - Anti-fuso.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  Info,
  RefreshCw,
  Sparkles,
  Star,
  XCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

import {
  apiNotificacaoListar,
  apiNotificacaoResumo,
  apiNotificacaoMarcarLida,
  apiNotificacaoMarcarTodasLidas,
} from "../../services/api";

/* ─────────────────────────────────────────────────────────────
   Constantes
────────────────────────────────────────────────────────────── */

const LIMITE_COMPACTO = 8;

const TIPOS_OFICIAIS = new Set([
  "sistema",
  "aviso",
  "evento",
  "certificado",
  "avaliacao",
  "reserva_aprovada",
  "reserva_rejeitada",
  "submissao",
]);

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function lower(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizarTipo(tipo) {
  const value = lower(tipo);

  return TIPOS_OFICIAIS.has(value) ? value : "sistema";
}

function tipoLabel(tipo) {
  const value = normalizarTipo(tipo);

  const labels = {
    sistema: "Sistema",
    aviso: "Aviso",
    evento: "Evento",
    certificado: "Certificado",
    avaliacao: "Avaliação",
    reserva_aprovada: "Reserva aprovada",
    reserva_rejeitada: "Reserva não aprovada",
    submissao: "Submissão",
  };

  return labels[value] || "Notificação";
}

function tipoIcone(tipo) {
  const value = normalizarTipo(tipo);

  if (value === "evento") return CalendarDays;
  if (value === "certificado" || value === "reserva_aprovada") return CheckCircle2;
  if (value === "avaliacao") return Star;
  if (value === "reserva_rejeitada") return XCircle;
  if (value === "submissao") return FileText;
  if (value === "aviso" || value === "sistema") return Info;

  return Bell;
}

function tipoTone(tipo) {
  const value = normalizarTipo(tipo);

  if (value === "evento") {
    return {
      icon: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
      badge:
        "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200",
      bar: "from-sky-500 via-cyan-500 to-blue-500",
      left: "border-l-sky-600",
    };
  }

  if (value === "certificado" || value === "reserva_aprovada") {
    return {
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
      badge:
        "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
      bar: "from-emerald-500 via-teal-500 to-cyan-500",
      left: "border-l-emerald-600",
    };
  }

  if (value === "avaliacao") {
    return {
      icon: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
      badge:
        "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200",
      bar: "from-violet-500 via-fuchsia-500 to-pink-500",
      left: "border-l-violet-600",
    };
  }

  if (value === "reserva_rejeitada") {
    return {
      icon: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
      badge:
        "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
      bar: "from-rose-500 via-red-500 to-orange-500",
      left: "border-l-rose-600",
    };
  }

  if (value === "submissao") {
    return {
      icon: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
      badge:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
      bar: "from-amber-400 via-orange-400 to-yellow-500",
      left: "border-l-amber-500",
    };
  }

  return {
    icon: "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200",
    badge:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200",
    bar: "from-slate-400 via-slate-500 to-slate-600",
    left: "border-l-slate-500",
  };
}

function formatDateTimeBRNoShift(value) {
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

function sortKeyNoShift(value) {
  const text = String(value || "").trim();

  const dateTime = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/
  );

  if (dateTime) {
    const [, year, month, day, hour, minute, second = "00"] = dateTime;
    return Number(`${year}${month}${day}${hour}${minute}${second}`);
  }

  const onlyDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (onlyDate) {
    return Number(`${onlyDate[1]}${onlyDate[2]}${onlyDate[3]}000000`);
  }

  return 0;
}

function isNaoLida(item) {
  return item?.lida !== true;
}

function isAbortRequest(error) {
  const text = String(error?.message || error || "").toLowerCase();

  return (
    error?.name === "AbortError" ||
    text === "unmount" ||
    text === "nova-requisicao" ||
    text.includes("unmount") ||
    text.includes("nova-requisicao") ||
    text.includes("aborted")
  );
}

function normalizeListaResponse(response) {
  const payload = response || {};

  return {
    lista: Array.isArray(payload?.data) ? payload.data : [],
    meta: payload?.meta || {
      total: 0,
      count: 0,
      limite: LIMITE_COMPACTO,
      deslocamento: 0,
      tem_mais: false,
      apenas_nao_lida: false,
      tipo: null,
    },
  };
}

function normalizeResumoResponse(response) {
  const payload = response?.data || response || {};

  return {
    total: toNumber(payload.total, 0),
    nao_lida: toNumber(payload.nao_lida, 0),
    por_tipo: payload.por_tipo || {},
  };
}

/* ─────────────────────────────────────────────────────────────
   Componentes locais
────────────────────────────────────────────────────────────── */

function HeaderCompacto({
  total,
  naoLida,
  porTipo,
  onAtualizar,
  onMarcarTodas,
  carregando,
  marcandoTodas,
}) {
  return (
    <header className="mb-4 overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900/70">
      <div className="bg-gradient-to-br from-violet-900 via-fuchsia-800 to-pink-700 px-4 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 shrink-0" aria-hidden="true" />
              <h3 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">
                Minhas Notificações
              </h3>
            </div>

            <p className="mt-1 text-sm text-white/90">
              Acompanhe avisos, certificados, avaliações, reservas e submissões.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onAtualizar}
              disabled={carregando}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 text-xs font-extrabold transition hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-60"
              title="Atualizar lista"
            >
              <RefreshCw
                className={cx("h-4 w-4", carregando ? "animate-spin" : "")}
                aria-hidden="true"
              />
              Atualizar
            </button>

            <button
              type="button"
              onClick={onMarcarTodas}
              disabled={naoLida === 0 || marcandoTodas}
              className={cx(
                "inline-flex min-h-[38px] items-center gap-2 rounded-2xl px-3 py-2 text-xs font-extrabold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-60",
                naoLida === 0 || marcandoTodas
                  ? "bg-white/10 text-white/70"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              )}
              title={naoLida ? "Marcar todas como lidas" : "Nenhuma não lida"}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {marcandoTodas ? "Marcando..." : "Marcar todas"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <MiniStatHeader label="Total" value={total} />
          <MiniStatHeader label="Não lidas" value={naoLida} />
          <MiniStatHeader label="Eventos" value={porTipo.evento?.total || 0} />
          <MiniStatHeader
            label="Avaliações"
            value={porTipo.avaliacao?.total || 0}
          />
          <MiniStatHeader
            label="Reservas"
            value={
              toNumber(porTipo.reserva_aprovada?.total, 0) +
              toNumber(porTipo.reserva_rejeitada?.total, 0)
            }
          />
        </div>
      </div>
    </header>
  );
}

function MiniStatHeader({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 p-2.5">
      <div className="text-[11px] font-extrabold uppercase tracking-wide text-white/75">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-black">{toNumber(value, 0)}</div>
    </div>
  );
}

function LoadingList() {
  return (
    <ul className="space-y-3" aria-busy="true" aria-live="polite" role="list">
      {Array.from({ length: 4 }).map((_, index) => (
        <li
          key={index}
          className="overflow-hidden rounded-[26px] border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900"
        >
          <div className="h-1 animate-pulse bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex gap-3 p-4">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-11/12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ onAtualizar }) {
  return (
    <div
      className="overflow-hidden rounded-[26px] border border-black/5 bg-white text-center text-gray-700 shadow-sm dark:border-white/10 dark:bg-zinc-900 dark:text-gray-200"
      role="status"
      aria-live="polite"
    >
      <div className="h-1 bg-gradient-to-r from-slate-500 via-zinc-500 to-stone-500" />

      <div className="p-6">
        <Bell className="mx-auto mb-2 h-10 w-10 opacity-80" aria-hidden="true" />

        <p className="font-extrabold">Nenhuma notificação por aqui.</p>

        <p className="mt-1 text-sm opacity-80">
          Volte mais tarde ou clique em “Atualizar”.
        </p>

        <button
          type="button"
          onClick={onAtualizar}
          className="mt-4 inline-flex min-h-[38px] items-center gap-2 rounded-2xl bg-violet-700 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Atualizar
        </button>
      </div>
    </div>
  );
}

function NotificacaoItem({ item, onMarcarLida, marcando }) {
  const tipo = normalizarTipo(item?.tipo);
  const tone = tipoTone(tipo);
  const Icon = tipoIcone(tipo);
  const naoLida = isNaoLida(item);
  const dataStr = formatDateTimeBRNoShift(item?.criado_em);
  const hasLink = Boolean(item?.link);

  return (
    <li
      role="listitem"
      className={cx(
        "overflow-hidden rounded-[26px] border border-black/5 bg-white shadow-sm transition-colors dark:border-white/10 dark:bg-zinc-900",
        naoLida ? "ring-1 ring-amber-200/70 dark:ring-amber-700/40" : ""
      )}
    >
      <div className={cx("h-1 bg-gradient-to-r", tone.bar)} />

      <div
        className={cx(
          "border-l-4 p-4",
          tone.left,
          naoLida
            ? "bg-amber-50/70 dark:bg-amber-900/10"
            : "bg-white dark:bg-zinc-900"
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cx("shrink-0 rounded-2xl p-2.5", tone.icon)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="break-words text-sm font-extrabold leading-tight text-slate-900 dark:text-white sm:text-base">
                {item?.titulo || "Notificação"}
              </p>

              <span
                className={cx(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-extrabold",
                  tone.badge
                )}
              >
                {tipoLabel(tipo)}
              </span>

              {naoLida ? (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  não lida
                </span>
              ) : null}
            </div>

            {item?.mensagem ? (
              <p className="mt-1 break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {String(item.mensagem)}
              </p>
            ) : null}

            {(dataStr || hasLink) ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {dataStr ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-300">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {dataStr}
                  </span>
                ) : null}

                {hasLink ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-xs font-extrabold text-sky-700 underline underline-offset-2 transition hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-200"
                    onClick={() => onMarcarLida(item, true)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    Ver mais
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => onMarcarLida(item, false)}
            className={cx(
              "ml-1 inline-flex shrink-0 items-center gap-1 rounded-2xl px-2.5 py-1.5 text-xs font-extrabold transition focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60",
              naoLida
                ? "bg-amber-100 text-amber-900 hover:bg-amber-200 focus-visible:ring-amber-400 dark:bg-amber-900/30 dark:text-amber-100 dark:hover:bg-amber-900/40"
                : "bg-slate-100 text-slate-500 focus-visible:ring-slate-400 dark:bg-zinc-800 dark:text-zinc-300"
            )}
            disabled={!naoLida || marcando}
            title={naoLida ? "Marcar como lida" : "Já lida"}
            aria-label={naoLida ? "Marcar como lida" : "Notificação já lida"}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            {marcando ? "Salvando..." : naoLida ? "Marcar" : "Lida"}
          </button>
        </div>
      </div>
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────
   Componente principal
────────────────────────────────────────────────────────────── */

export default function Notificacoes() {
  const navigate = useNavigate();

  const [notificacoes, setNotificacoes] = useState([]);
  const [resumo, setResumo] = useState({
    total: 0,
    nao_lida: 0,
    por_tipo: {},
  });

  const [loading, setLoading] = useState(true);
  const [marcandoId, setMarcandoId] = useState(null);
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  const [a11yMsg, setA11yMsg] = useState("");

  const a11yRef = useRef(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  const anunciar = useCallback((msg) => {
    setA11yMsg(msg || "");
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort?.("unmount");
    };
  }, []);

  const carregarNotificacao = useCallback(async () => {
    try {
      abortRef.current?.abort?.("nova-requisicao");

      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      anunciar("Carregando notificações.");

      const [listaResponse, resumoResponse] = await Promise.all([
        apiNotificacaoListar(
          {
            limite: LIMITE_COMPACTO,
            deslocamento: 0,
          },
          {
            signal: controller.signal,
          }
        ),
        apiNotificacaoResumo({
  signal: controller.signal,
}),
      ]);

      if (!mountedRef.current) return;

      const listaPayload = normalizeListaResponse(listaResponse);
      const resumoPayload = normalizeResumoResponse(resumoResponse);

      setNotificacoes(listaPayload.lista);
      setResumo(resumoPayload);
      anunciar(`Lista atualizada. ${listaPayload.lista.length} notificação(ões).`);
       } catch (error) {
  if (isAbortRequest(error)) return;

  console.error("[Notificacoes] erro ao carregar", {
        message: error?.message,
        status: error?.status,
        code: error?.code,
        data: error?.data,
        details: error?.details,
        adminHint: error?.adminHint,
        raw: error,
      });

      if (!mountedRef.current) return;

      toast.error(
        error?.message ||
          error?.data?.message ||
          "Não foi possível carregar notificações."
      );

      setNotificacoes([]);
      anunciar("Erro ao carregar notificações.");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [anunciar]);

  useEffect(() => {
    carregarNotificacao();
  }, [carregarNotificacao]);

  const listaOrdenada = useMemo(() => {
    return [...notificacoes].sort((a, b) => {
      const unreadDelta = (isNaoLida(b) ? 1 : 0) - (isNaoLida(a) ? 1 : 0);

      if (unreadDelta !== 0) return unreadDelta;

      return sortKeyNoShift(b?.criado_em) - sortKeyNoShift(a?.criado_em);
    });
  }, [notificacoes]);

  const marcarComoLida = useCallback(
    async (item, navegar = false) => {
      if (!item?.id || item?.lida === true) {
        if (navegar && item?.link) navigate(item.link);
        return;
      }

      try {
        setMarcandoId(item.id);

        await apiNotificacaoMarcarLida(item.id);

        setNotificacoes((prev) =>
          prev.map((notificacao) =>
            notificacao.id === item.id
              ? {
                  ...notificacao,
                  lida: true,
                }
              : notificacao
          )
        );

        setResumo((prev) => ({
          ...prev,
          nao_lida: Math.max(0, toNumber(prev.nao_lida, 0) - 1),
        }));

        if (typeof window.atualizarContadorNotificacao === "function") {
          window.atualizarContadorNotificacao();
        }

        anunciar("Notificação marcada como lida.");

        if (navegar && item.link) {
          navigate(item.link);
        }
      } catch (error) {
        console.error("[Notificacoes] erro ao marcar lida", {
          id: item?.id,
          message: error?.message,
        });

        toast.error("Não foi possível marcar como lida.");
      } finally {
        setMarcandoId(null);
      }
    },
    [anunciar, navigate]
  );

  const marcarTodas = useCallback(async () => {
    if (!toNumber(resumo.nao_lida, 0)) return;

    try {
      setMarcandoTodas(true);

      await apiNotificacaoMarcarTodasLidas();

      setNotificacoes((prev) =>
        prev.map((item) => ({
          ...item,
          lida: true,
        }))
      );

      setResumo((prev) => ({
        ...prev,
        nao_lida: 0,
      }));

      if (typeof window.atualizarContadorNotificacao === "function") {
        window.atualizarContadorNotificacao();
      }

      toast.success("Notificações marcadas como lidas.");
      anunciar("Todas as notificações não lidas foram marcadas como lidas.");
    } catch (error) {
      console.error("[Notificacoes] erro ao marcar todas", {
        message: error?.message,
      });

      toast.error("Não foi possível marcar todas como lidas.");
    } finally {
      setMarcandoTodas(false);
    }
  }, [anunciar, resumo.nao_lida]);

  return (
    <section className="mb-8">
      <span
        ref={a11yRef}
        tabIndex={-1}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {a11yMsg}
      </span>

      <HeaderCompacto
        total={resumo.total}
        naoLida={resumo.nao_lida}
        porTipo={resumo.por_tipo}
        onAtualizar={carregarNotificacao}
        onMarcarTodas={marcarTodas}
        carregando={loading}
        marcandoTodas={marcandoTodas}
      />

      {loading ? (
        <LoadingList />
      ) : notificacoes.length === 0 ? (
        <EmptyState onAtualizar={carregarNotificacao} />
      ) : (
        <ul className="space-y-3" role="list" aria-live="polite">
          {listaOrdenada.map((item) => (
            <NotificacaoItem
              key={item.id}
              item={item}
              marcando={marcandoId === item.id}
              onMarcarLida={marcarComoLida}
            />
          ))}
        </ul>
      )}
    </section>
  );
}