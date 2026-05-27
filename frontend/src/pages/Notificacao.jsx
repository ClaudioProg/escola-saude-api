// ✅ frontend/src/pages/Notificacao.jsx — v2.0
/* eslint-disable no-console */
/**
 * Plataforma Escola da Saúde
 *
 * Página oficial de notificações do usuário autenticado.
 *
 * Função:
 * - Listar notificações.
 * - Filtrar por tipo.
 * - Filtrar somente não lidas.
 * - Buscar localmente por título/mensagem/tipo.
 * - Paginar via backend.
 * - Marcar uma notificação como lida.
 * - Marcar todas como lidas.
 * - Navegar pelo link da notificação quando existir.
 *
 * Contrato oficial:
 * - apiNotificacaoListar(params)
 * - apiNotificacaoResumo()
 * - apiNotificacaoMarcarLida(id)
 * - apiNotificacaoMarcarTodasLidas()
 *
 * Query oficial:
 * - apenas_nao_lida
 * - tipo
 * - limite
 * - deslocamento
 *
 * Payload oficial:
 * {
 *   ok: true,
 *   data: [
 *     {
 *       id,
 *       tipo,
 *       titulo,
 *       mensagem,
 *       lida,
 *       criado_em,
 *       turma_id,
 *       evento_id,
 *       reserva_id,
 *       link,
 *       metadata
 *     }
 *   ],
 *   meta: {
 *     total,
 *     count,
 *     limite,
 *     deslocamento,
 *     tem_mais,
 *     apenas_nao_lida,
 *     tipo
 *   }
 * }
 *
 * Padrão:
 * - Sem apiGet/apiPatch direto.
 * - Sem "/api" dentro da página.
 * - Sem aliases de payload.
 * - Sem camelCase legado.
 * - Sem useOnceEffect.
 * - Mobile-first.
 * - Acessível.
 * - Anti-fuso.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Inbox,
  Info,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";

import useEscolaTheme from "../hooks/useEscolaTheme";
import {
  apiNotificacaoListar,
  apiNotificacaoResumo,
  apiNotificacaoMarcarLida,
  apiNotificacaoMarcarTodasLidas,
} from "../services/api";

/* ─────────────────────────────────────────────────────────────
   Constantes
────────────────────────────────────────────────────────────── */

const TIPOS_OFICIAIS = [
  { value: "todos", label: "Todos os tipos" },
  { value: "sistema", label: "Sistema" },
  { value: "aviso", label: "Aviso" },
  { value: "evento", label: "Evento" },
  { value: "certificado", label: "Certificado" },
  { value: "avaliacao", label: "Avaliação" },
  { value: "reserva_aprovada", label: "Reserva aprovada" },
  { value: "reserva_rejeitada", label: "Reserva não aprovada" },
  { value: "submissao", label: "Submissão" },
];

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 30];

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function unwrap(response) {
  return response?.data ?? response;
}

function getErrorMessage(error, fallback) {
  const data = error?.response?.data || error?.data || {};

  return data?.message || data?.erro || error?.message || fallback;
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

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function toPositiveInt(value, fallback = 1) {
  const number = Number(value);

  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function lower(value) {
  return String(value || "").trim().toLowerCase();
}

function formatarDataLocalLegivel(value) {
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

function dataOrdenacao(value) {
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

function tipoLabel(tipo) {
  const item = TIPOS_OFICIAIS.find((option) => option.value === lower(tipo));

  return item?.label || "Notificação";
}

function tipoIcone(tipo) {
  const value = lower(tipo);

  if (value === "evento") {
    return CalendarDays;
  }

  if (value === "certificado" || value === "reserva_aprovada") {
    return CheckCircle2;
  }

  if (value === "avaliacao") {
    return Star;
  }

  if (value === "reserva_rejeitada") {
    return XCircle;
  }

  if (value === "submissao") {
    return Sparkles;
  }

  if (value === "aviso" || value === "sistema") {
    return Info;
  }

  return Bell;
}

function tipoTone(tipo) {
  const value = lower(tipo);

  if (value === "evento") {
    return {
      icon: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
      badge:
        "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200",
      bar: "from-sky-500 via-cyan-500 to-blue-500",
    };
  }

  if (value === "certificado" || value === "reserva_aprovada") {
    return {
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
      badge:
        "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
      bar: "from-emerald-500 via-teal-500 to-cyan-500",
    };
  }

  if (value === "avaliacao") {
    return {
      icon: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
      badge:
        "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200",
      bar: "from-violet-500 via-fuchsia-500 to-pink-500",
    };
  }

  if (value === "reserva_rejeitada") {
    return {
      icon: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
      badge:
        "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
      bar: "from-rose-500 via-red-500 to-orange-500",
    };
  }

  if (value === "submissao") {
    return {
      icon: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
      badge:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
      bar: "from-amber-400 via-orange-400 to-yellow-500",
    };
  }

  return {
    icon: "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200",
    badge:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200",
    bar: "from-slate-400 via-slate-500 to-slate-600",
  };
}

function normalizeListaResponse(response) {
  const payload = response || {};

  return {
    lista: Array.isArray(payload?.data) ? payload.data : [],
    meta: payload?.meta || {
      total: 0,
      count: 0,
      limite: 10,
      deslocamento: 0,
      tem_mais: false,
      apenas_nao_lida: false,
      tipo: null,
    },
  };
}

function normalizeResumoResponse(response) {
  const payload = response || {};

  return {
    total: toNumber(payload.total, 0),
    nao_lida: toNumber(payload.nao_lida, 0),
    por_tipo: payload.por_tipo || {},
  };
}

function matchesBusca(item, busca) {
  const q = lower(busca);

  if (!q) return true;

  return (
    lower(item?.titulo).includes(q) ||
    lower(item?.mensagem).includes(q) ||
    lower(item?.tipo).includes(q) ||
    lower(tipoLabel(item?.tipo)).includes(q)
  );
}

/* ─────────────────────────────────────────────────────────────
   Componentes locais
────────────────────────────────────────────────────────────── */

function InfoRibbon() {
  return (
    <div className="rounded-[26px] border border-violet-200/70 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 p-4 shadow-sm dark:border-violet-400/15 dark:from-violet-950/30 dark:via-zinc-900/40 dark:to-fuchsia-950/20 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-2xl bg-violet-600/10 p-3 text-violet-700 dark:bg-violet-400/10 dark:text-violet-200">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">
            Central oficial de notificações
          </p>

          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            Acompanhe avisos, certificados, avaliações, reservas, submissões e atualizações
            vinculadas ao seu usuário na plataforma.
          </p>
        </div>
      </div>
    </div>
  );
}

function GhostAction({ icon: Icon, children, onClick, loading = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5"
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

function MetaBadge({ children, className = "" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold",
        className
      )}
    >
      {children}
    </span>
  );
}

function FieldSelect({ id, label, value, onChange, children }) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-bold text-slate-700 dark:text-zinc-300"
      >
        {label}
      </label>

      <select
        id={id}
        value={value}
        onChange={onChange}
        className="min-h-[42px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-violet-500/60 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100"
      >
        {children}
      </select>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900/55"
        >
          <div className="h-1.5 w-full animate-pulse bg-slate-200 dark:bg-zinc-800" />
          <div className="flex gap-3 p-4">
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-slate-200 dark:bg-zinc-800" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-48 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
              <div className="h-3 w-full animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
              <div className="h-8 w-32 animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onLimparFiltros }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-zinc-900/55 sm:p-8">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-700 dark:bg-violet-400/10 dark:text-violet-200">
        <Inbox className="h-7 w-7" aria-hidden="true" />
      </div>

      <h3 className="mt-4 text-lg font-extrabold text-slate-900 dark:text-zinc-100">
        Nenhuma notificação encontrada
      </h3>

      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 dark:text-zinc-400">
        Ajuste os filtros ou limpe a busca para verificar outras notificações.
      </p>

      <button
        type="button"
        onClick={onLimparFiltros}
        className="mt-4 inline-flex min-h-[40px] items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 py-2 text-sm font-extrabold text-white transition hover:bg-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Limpar filtros
      </button>
    </div>
  );
}

function NotificacaoCard({ item, onMarcarLida, marcando, reduceMotion }) {
  const naoLida = item?.lida !== true;
  const tone = tipoTone(item?.tipo);
  const Icon = tipoIcone(item?.tipo);
  const criadoEm = formatarDataLocalLegivel(item?.criado_em);
  const hasLink = Boolean(item?.link);

  return (
    <motion.article
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      exit={reduceMotion ? {} : { opacity: 0, y: 8 }}
      transition={{ duration: 0.22 }}
      className={cx(
        "overflow-hidden rounded-[26px] border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg",
        naoLida
          ? "border-amber-200 bg-amber-50/90 dark:border-amber-900/40 dark:bg-amber-950/20"
          : "border-slate-200 bg-white dark:border-white/10 dark:bg-zinc-900/55"
      )}
      role="listitem"
    >
      <div className={cx("h-1.5 w-full bg-gradient-to-r", tone.bar)} />

      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className={cx("shrink-0 rounded-2xl p-3", tone.icon)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-sm font-extrabold leading-tight text-slate-900 dark:text-zinc-100 sm:text-base">
                {item?.titulo || "Notificação"}
              </h2>

              <MetaBadge className={tone.badge}>{tipoLabel(item?.tipo)}</MetaBadge>

              {naoLida ? (
                <MetaBadge className="border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/30 dark:text-amber-200">
                  não lida
                </MetaBadge>
              ) : (
                <MetaBadge className="border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                  lida
                </MetaBadge>
              )}
            </div>

            {item?.mensagem ? (
              <p className="mt-2 break-words text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
                {String(item.mensagem)}
              </p>
            ) : null}

            {criadoEm ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {criadoEm}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onMarcarLida(item)}
                disabled={!naoLida || marcando}
                className={cx(
                  "inline-flex min-h-[38px] items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-extrabold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:cursor-not-allowed disabled:opacity-60",
                  naoLida
                    ? "border border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100 dark:hover:bg-amber-900/40"
                    : "border border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300"
                )}
                aria-label={
                  naoLida
                    ? hasLink
                      ? "Ver mais e marcar notificação como lida"
                      : "Marcar notificação como lida"
                    : "Notificação já lida"
                }
              >
                {hasLink && naoLida ? (
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
                {marcando
                  ? "Salvando..."
                  : naoLida
                    ? hasLink
                      ? "Ver mais"
                      : "Marcar como lida"
                    : "Lida"}
              </button>

              {naoLida && hasLink ? (
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  Ao abrir, ela será marcada como lida.
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

/* ─────────────────────────────────────────────────────────────
   Página
────────────────────────────────────────────────────────────── */

export default function Notificacao() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { isDark } = useEscolaTheme();

  const liveRef = useRef(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  const [notificacoes, setNotificacoes] = useState([]);
  const [meta, setMeta] = useState({
    total: 0,
    count: 0,
    limite: 10,
    deslocamento: 0,
    tem_mais: false,
    apenas_nao_lida: false,
    tipo: null,
  });

  const [resumo, setResumo] = useState({
    total: 0,
    nao_lida: 0,
    por_tipo: {},
  });

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [marcandoId, setMarcandoId] = useState(null);
  const [marcandoTodas, setMarcandoTodas] = useState(false);

  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [apenasNaoLida, setApenasNaoLida] = useState(false);
  const [ordenacao, setOrdenacao] = useState("recentes");
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(10);

  const setLive = useCallback((message) => {
    if (liveRef.current) {
      liveRef.current.textContent = message || "";
    }
  }, []);

  useEffect(() => {
    document.title = "Notificações — Escola da Saúde";
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort?.("unmount");
    };
  }, []);

  const carregar = useCallback(async () => {
    try {
      abortRef.current?.abort?.("nova-requisicao");

      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setErro("");
      setLive("Carregando notificações...");

      const deslocamento = (pagina - 1) * limite;

      const [listaResponse, resumoResponse] = await Promise.all([
        apiNotificacaoListar(
          {
            apenas_nao_lida: apenasNaoLida ? 1 : undefined,
            tipo: tipo !== "todos" ? tipo : undefined,
            limite,
            deslocamento,
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
      setMeta(listaPayload.meta);
      setResumo(resumoPayload);
      setLive("Notificações carregadas.");
    } catch (error) {
  if (isAbortRequest(error)) return;

  const message = getErrorMessage(
        error,
        "Não foi possível carregar suas notificações."
      );

      console.error("[Notificacao] erro ao carregar notificações", {
  message: error?.message,
  status: error?.status,
  code: error?.code,
  data: error?.data,
  raw: error,
});

      if (!mountedRef.current) return;

      setNotificacoes([]);
      setErro(message);
      setLive("Falha ao carregar notificações.");
      toast.error(message);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [apenasNaoLida, limite, pagina, setLive, tipo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    setPagina(1);
  }, [tipo, apenasNaoLida, limite]);

  const limparFiltros = useCallback(() => {
    setBusca("");
    setTipo("todos");
    setApenasNaoLida(false);
    setOrdenacao("recentes");
    setPagina(1);
  }, []);

  const listaFiltrada = useMemo(() => {
    const filtrada = notificacoes.filter((item) => matchesBusca(item, busca));

    return filtrada.sort((a, b) => {
      if (ordenacao === "antigos") {
        return dataOrdenacao(a?.criado_em) - dataOrdenacao(b?.criado_em);
      }

      if (ordenacao === "titulo_az") {
        return String(a?.titulo || "").localeCompare(
          String(b?.titulo || ""),
          "pt-BR"
        );
      }

      if (ordenacao === "titulo_za") {
        return String(b?.titulo || "").localeCompare(
          String(a?.titulo || ""),
          "pt-BR"
        );
      }

      return dataOrdenacao(b?.criado_em) - dataOrdenacao(a?.criado_em);
    });
  }, [busca, notificacoes, ordenacao]);

  const totalBackend = toNumber(meta.total, 0);
  const totalPaginas = Math.max(1, Math.ceil(totalBackend / limite));

  const podeVoltar = pagina > 1;
  const podeAvancar = Boolean(meta.tem_mais) && pagina < totalPaginas;

  const marcarLida = useCallback(
    async (item) => {
      if (!item?.id || item?.lida === true) return;

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

        if (item.link) {
          navigate(item.link);
        }
      } catch (error) {
        console.error("[Notificacao] erro ao marcar notificação", {
          id: item?.id,
          message: error?.message,
        });

        toast.error("Não foi possível marcar a notificação como lida.");
      } finally {
        setMarcandoId(null);
      }
    },
    [navigate]
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
    } catch (error) {
      console.error("[Notificacao] erro ao marcar todas", {
        message: error?.message,
      });

      toast.error("Não foi possível marcar todas as notificações como lidas.");
    } finally {
      setMarcandoTodas(false);
    }
  }, [resumo.nao_lida]);

  return (
    <>
      <main className="mx-auto max-w-6xl p-4 md:p-6" id="conteudo">
        <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

        <HeaderHero
  titulo="Minhas Notificações"
  subtitulo="Acompanhe avisos, certificados, avaliações, reservas, submissões e atualizações da Escola da Saúde."
  badge="Central de notificações • Escola da Saúde"
  icone={Bell}
  gradient="from-violet-900 via-fuchsia-800 to-pink-700"
  isDark={isDark}
/>

        {loading ? (
          <div
            className="sticky top-0 z-40 mt-4 h-1 w-full overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950/30"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Carregando notificações"
          >
            <div
              className={cx(
                "h-full w-1/3 bg-violet-700",
                reduceMotion ? "" : "animate-pulse"
              )}
            />
          </div>
        ) : null}

        <div className="mt-6">
          <InfoRibbon />
        </div>

        <section
          className="mt-8 overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/90 shadow-sm dark:border-white/10 dark:bg-zinc-900/55"
          aria-label="Resumo e ações de notificações"
        >
          <div className="h-1.5 w-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600" />

          <div className="p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                  <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                  Resumo
                </div>

                <h1 className="mt-3 text-xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100 sm:text-2xl">
                  Suas notificações
                </h1>

                <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                  {toNumber(resumo.total, 0)} no total •{" "}
                  {toNumber(resumo.nao_lida, 0)} não lida(s)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <GhostAction
                  icon={RefreshCw}
                  onClick={carregar}
                  loading={loading}
                >
                  {loading ? "Atualizando…" : "Atualizar"}
                </GhostAction>

                <GhostAction
                  icon={Check}
                  onClick={marcarTodas}
                  loading={marcandoTodas}
                  disabled={!toNumber(resumo.nao_lida, 0)}
                >
                  {marcandoTodas ? "Marcando…" : "Marcar todas"}
                </GhostAction>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                  Total
                </p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-zinc-100">
                  {toNumber(resumo.total, 0)}
                </p>
              </div>

              <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                  Não lidas
                </p>
                <p className="mt-1 text-2xl font-extrabold text-amber-900 dark:text-amber-100">
                  {toNumber(resumo.nao_lida, 0)}
                </p>
              </div>

              <div className="rounded-[24px] border border-violet-200 bg-violet-50 p-4 dark:border-violet-400/20 dark:bg-violet-400/10">
                <p className="text-xs font-bold text-violet-700 dark:text-violet-200">
                  Página
                </p>
                <p className="mt-1 text-2xl font-extrabold text-violet-900 dark:text-violet-100">
                  {pagina}/{totalPaginas}
                </p>
              </div>

              <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-4 dark:border-sky-400/20 dark:bg-sky-400/10">
                <p className="text-xs font-bold text-sky-700 dark:text-sky-200">
                  Exibindo
                </p>
                <p className="mt-1 text-2xl font-extrabold text-sky-900 dark:text-sky-100">
                  {listaFiltrada.length}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="mt-6 rounded-[30px] border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/55 sm:p-5"
          aria-label="Filtros de notificações"
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px_180px_140px]">
            <div>
              <label
                htmlFor="busca-notificacao"
                className="mb-1 block text-xs font-bold text-slate-700 dark:text-zinc-300"
              >
                Buscar
              </label>

              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />

                <input
                  id="busca-notificacao"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Buscar por título, mensagem ou tipo..."
                  className="min-h-[42px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-violet-500/60 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100"
                />

                {busca ? (
                  <button
                    type="button"
                    onClick={() => setBusca("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 transition hover:bg-slate-100 dark:hover:bg-zinc-900"
                    aria-label="Limpar busca"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>

            <FieldSelect
              id="tipo-notificacao"
              label="Tipo"
              value={tipo}
              onChange={(event) => setTipo(event.target.value)}
            >
              {TIPOS_OFICIAIS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FieldSelect>

            <FieldSelect
              id="ordenacao-notificacao"
              label="Ordenação"
              value={ordenacao}
              onChange={(event) => setOrdenacao(event.target.value)}
            >
              <option value="recentes">Mais recentes</option>
              <option value="antigos">Mais antigas</option>
              <option value="titulo_az">Título A-Z</option>
              <option value="titulo_za">Título Z-A</option>
            </FieldSelect>

            <FieldSelect
              id="limite-notificacao"
              label="Por página"
              value={limite}
              onChange={(event) => setLimite(toPositiveInt(event.target.value, 10))}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </FieldSelect>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setApenasNaoLida((value) => !value)}
              className={cx(
                "inline-flex min-h-[38px] items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-extrabold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60",
                apenasNaoLida
                  ? "border-amber-700 bg-amber-700 text-white hover:bg-amber-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5"
              )}
              aria-pressed={apenasNaoLida}
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              Somente não lidas
            </button>

            <GhostAction icon={RefreshCw} onClick={limparFiltros}>
              Limpar filtros
            </GhostAction>
          </div>
        </section>

        <section className="mt-6" aria-label="Lista de notificações">
          {erro ? (
            <div
              className="mb-4 rounded-[26px] border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
              role="alert"
            >
              <p className="font-extrabold">Erro ao carregar notificações</p>
              <p className="mt-1 text-sm">{erro}</p>

              <button
                type="button"
                onClick={carregar}
                className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-rose-100 px-3 py-2 text-sm font-extrabold transition hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-900/60"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Tentar novamente
              </button>
            </div>
          ) : null}

          {loading ? <LoadingSkeleton /> : null}

          {!loading && !erro && listaFiltrada.length === 0 ? (
            <EmptyState onLimparFiltros={limparFiltros} />
          ) : null}

          {!loading && !erro && listaFiltrada.length > 0 ? (
            <div role="list" className="space-y-3">
              <AnimatePresence initial={false}>
                {listaFiltrada.map((item) => (
                  <NotificacaoCard
                    key={item.id}
                    item={item}
                    marcando={marcandoId === item.id}
                    onMarcarLida={marcarLida}
                    reduceMotion={reduceMotion}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900/55 sm:flex-row">
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Página <strong>{pagina}</strong> de <strong>{totalPaginas}</strong> •{" "}
              <strong>{totalBackend}</strong> registro(s) no filtro do servidor
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPagina((current) => Math.max(1, current - 1))}
                disabled={!podeVoltar}
                className="inline-flex min-h-[38px] items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Anterior
              </button>

              <button
                type="button"
                onClick={() =>
                  setPagina((current) => Math.min(totalPaginas, current + 1))
                }
                disabled={!podeAvancar}
                className="inline-flex min-h-[38px] items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5"
              >
                Próxima
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}