// ✅ frontend/src/pages/ConfirmarPresenca.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Página de confirmação de presença via QR.
//
// Contratos aplicados:
// - Rota backend oficial: POST /presenca/qr
// - Função oficial de API: apiPresencaConfirmarQr
// - Parâmetro oficial na URL: turma_id
// - Payload oficial: { turma_id }
// - Sem /presencas
// - Sem /confirmar-qr/:turmaId
// - Sem apiPost direto na página
// - Sem Footer antigo
// - Sem query antiga "turma"
// - Sem turmaId como contrato interno principal
// - Sem style inline
// - Validação local apenas para UX; regra final fica no backend
// - Redirecionamento preservando turma_id
// - Acessível, mobile-first, dark mode e reduced motion.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  Home,
  Loader2,
  LogIn,
  QrCode,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserPlus,
  XCircle,
} from "lucide-react";

import { apiPresencaConfirmarQr } from "../services/api";

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function safeAtob(value) {
  try {
    return atob(value);
  } catch {
    const pad =
      value.length % 4 === 2 ? "==" : value.length % 4 === 3 ? "=" : "";

    try {
      return atob(value + pad);
    } catch {
      return "";
    }
  }
}

function getRawToken() {
  try {
    const raw = localStorage.getItem("token");

    return raw ? raw.trim() : null;
  } catch {
    return null;
  }
}

function getValidToken() {
  const raw = getRawToken();

  if (!raw) return null;

  const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw;
  const parts = token.split(".");

  if (parts.length !== 3) return null;

  try {
    const payloadStr = safeAtob(
      parts[1].replace(/-/g, "+").replace(/_/g, "/")
    );

    const payload = JSON.parse(payloadStr || "{}");
    const now = Date.now() / 1000;

    if (payload?.nbf && now < payload.nbf) return null;
    if (payload?.exp && now >= payload.exp) return null;

    return token;
  } catch {
    return null;
  }
}

function toPositiveInt(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function isAbortLike(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || error || "").toLowerCase();

  return (
    name === "AbortError" ||
    message.includes("aborted") ||
    message.includes("abort") ||
    message.includes("canceled") ||
    message.includes("cancelled")
  );
}

function getApiStatus(error) {
  return Number(error?.status || error?.response?.status || 0);
}

function getApiMessage(error) {
  return (
    error?.data?.message ||
    error?.response?.data?.message ||
    error?.message ||
    ""
  );
}

function getMensagemErro(error) {
  const status = getApiStatus(error);
  const backendMessage = getApiMessage(error);

  if (status === 401) {
    return {
      status,
      titulo: "Você precisa estar logado para registrar presença.",
      detalhe:
        "Entre na sua conta para confirmar a presença nesta turma. Após o login, retornaremos automaticamente para esta tela.",
      subtitulo: "A confirmação é autenticada.",
      requiresLogin: true,
    };
  }

  if (status === 403) {
    return {
      status,
      titulo: backendMessage || "Acesso negado para confirmar presença.",
      detalhe:
        "Verifique se você está logado com a conta correta e se está inscrito nesta turma.",
      subtitulo: "Conta ou inscrição inválida.",
      requiresLogin: false,
    };
  }

  if (status === 409) {
    return {
      status,
      titulo:
        backendMessage ||
        "Ainda não é possível confirmar presença para esta turma.",
      detalhe:
        "A confirmação só funciona no dia e horário permitidos. Confirme com a organização o cronograma da turma.",
      subtitulo: "Fora do período permitido.",
      requiresLogin: false,
    };
  }

  if (status === 404) {
    return {
      status,
      titulo: backendMessage || "Turma não encontrada.",
      detalhe:
        "O QR Code pode estar desatualizado ou pertencer a outra turma. Solicite o QR correto à organização.",
      subtitulo: "QR Code inválido ou desatualizado.",
      requiresLogin: false,
    };
  }

  return {
    status,
    titulo: backendMessage || "Não foi possível confirmar a presença no momento.",
    detalhe: "Tente novamente. Se persistir, procure a equipe de suporte.",
    subtitulo: "Falha temporária.",
    requiresLogin: false,
  };
}

/* ─────────────────────────────────────────────────────────────
 * Componentes locais
 * ───────────────────────────────────────────────────────────── */

function HeaderHero({ status, subtitle }) {
  const isOk = status === "ok";
  const isErr = status === "err";

  return (
    <header
      className="relative isolate overflow-hidden bg-gradient-to-br from-emerald-950 via-teal-800 to-cyan-700 text-white"
      role="banner"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[800px] max-w-[95vw] -translate-x-1/2 rounded-full bg-cyan-300/25 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-white/10 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-[180px] max-w-5xl flex-col items-center justify-center gap-3 px-4 py-8 text-center sm:px-6 sm:py-10">
        <div className="inline-flex items-center gap-2">
          <QrCode className="h-6 w-6" aria-hidden="true" />

          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            Confirmação de presença
          </h1>
        </div>

        <p className="max-w-2xl text-sm text-white/90 sm:text-base">
          {subtitle ||
            "Use o QR Code oficial da turma para registrar sua presença com segurança."}
        </p>

        <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 ring-1 ring-white/15">
          {isOk ? (
            <>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm font-bold">Presença confirmada</span>
            </>
          ) : isErr ? (
            <>
              <XCircle className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm font-bold">Ação necessária</span>
            </>
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span className="text-sm font-bold">Processando</span>
            </>
          )}
        </div>

        <div className="mt-3 inline-flex max-w-2xl items-start gap-2 rounded-2xl bg-white/10 px-3 py-2 text-left ring-1 ring-white/15">
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-white/90"
            aria-hidden="true"
          />

          <p className="text-xs leading-relaxed text-white/90 sm:text-sm">
            A confirmação é autenticada e validada pelas regras oficiais da
            turma no backend.
          </p>
        </div>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 h-px bg-white/25"
        aria-hidden="true"
      />
    </header>
  );
}

function StatusIcon({ status }) {
  if (status === "ok") {
    return (
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-3xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
        <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
      </span>
    );
  }

  if (status === "err") {
    return (
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-3xl bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
        <XCircle className="h-8 w-8" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-3xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
      <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
    </span>
  );
}

function InfoBox({ turma_id, nowStr }) {
  return (
    <div className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-700 dark:bg-zinc-950/50">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
          Turma
        </p>

        <p className="mt-1 font-black text-slate-950 dark:text-white">
          {toPositiveInt(turma_id) || "—"}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-700 dark:bg-zinc-950/50">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
          Horário local
        </p>

        <p className="mt-1 font-black text-slate-950 dark:text-white">
          {nowStr}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Página
 * ───────────────────────────────────────────────────────────── */

export default function ConfirmarPresenca() {
  const reduceMotion = useReducedMotion();

  const [searchParams] = useSearchParams();
  const { turma_id: turmaIdFromPath } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const turma_id = useMemo(() => {
    return searchParams.get("turma_id") || turmaIdFromPath || "";
  }, [searchParams, turmaIdFromPath]);

  const [status, setStatus] = useState("loading");
  const [msg, setMsg] = useState("Confirmando presença...");
  const [detail, setDetail] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [subtitle, setSubtitle] = useState("");

  const liveRef = useRef(null);
  const titleRef = useRef(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(0);

  const [nowStr] = useState(() =>
    new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date())
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      try {
        abortRef.current?.abort?.("route-change");
      } catch {
        // noop
      }
    };
  }, []);

  const setLive = useCallback((text) => {
    if (liveRef.current) {
      liveRef.current.textContent = text;
    }
  }, []);

  const buildRedirect = useCallback(() => {
    const query = new URLSearchParams(location.search);

    query.set("turma_id", String(turma_id || ""));

    return `${location.pathname}?${query.toString()}`;
  }, [location.pathname, location.search, turma_id]);

  const goToLogin = useCallback(() => {
    const redirect = buildRedirect();

    navigate(`/login?redirect=${encodeURIComponent(redirect)}`, {
      replace: true,
    });
  }, [buildRedirect, navigate]);

  const goToRegister = useCallback(() => {
    const redirect = buildRedirect();

    navigate(`/cadastro?redirect=${encodeURIComponent(redirect)}`, {
      replace: true,
    });
  }, [buildRedirect, navigate]);

  const focusTitleSoon = useCallback(() => {
    requestAnimationFrame(() => titleRef.current?.focus?.());
  }, []);

  const confirmar = useCallback(
    async ({ silent = false } = {}) => {
      const turmaIdSeguro = toPositiveInt(turma_id);

      if (!turmaIdSeguro) {
        setStatus("err");
        setMsg("Parâmetro turma_id ausente ou inválido.");
        setDetail("Use o QR Code correto desta turma.");
        setRequiresLogin(false);
        setSubtitle("Não foi possível identificar a turma.");
        setLive("Parâmetro turma_id inválido.");
        focusTitleSoon();
        return;
      }

      const tokenOk = getValidToken();

      if (!tokenOk) {
        setStatus("err");
        setMsg("Você precisa estar logado para registrar presença.");
        setDetail(
          "Entre na sua conta para confirmar a presença nesta turma. Após o login, retornaremos automaticamente para esta tela."
        );
        setRequiresLogin(true);
        setSubtitle("A confirmação é autenticada.");
        setLive("Login necessário para confirmar presença.");
        focusTitleSoon();
        return;
      }

      try {
        abortRef.current?.abort?.("new-attempt");
      } catch {
        // noop
      }

      const controller = new AbortController();

      abortRef.current = controller;
      inFlightRef.current += 1;

      const myFlight = inFlightRef.current;

      if (!silent) {
        setStatus("loading");
        setMsg("Confirmando presença...");
        setDetail("");
        setRequiresLogin(false);
        setSubtitle("Aguarde alguns segundos.");
        setLive("Iniciando confirmação.");
      }

      try {
        await apiPresencaConfirmarQr(turmaIdSeguro, {
          signal: controller.signal,
        });

        if (!mountedRef.current || myFlight !== inFlightRef.current) return;

        setStatus("ok");
        setMsg("Presença confirmada com sucesso!");
        setDetail("Você já pode fechar esta tela ou conferir em Minhas presenças.");
        setRequiresLogin(false);
        setSubtitle("Registro concluído.");
        setLive("Presença confirmada.");
        focusTitleSoon();
      } catch (error) {
        if (isAbortLike(error)) return;
        if (!mountedRef.current || myFlight !== inFlightRef.current) return;

        const info = getMensagemErro(error);

        if (info.status === 401) {
          goToLogin();
          return;
        }

        setStatus("err");
        setMsg(info.titulo);
        setDetail(info.detalhe);
        setRequiresLogin(info.requiresLogin);
        setSubtitle(info.subtitulo);
        setLive("Falha na confirmação de presença.");
        focusTitleSoon();
      }
    },
    [focusTitleSoon, goToLogin, setLive, turma_id]
  );

  useEffect(() => {
    confirmar({ silent: false });

    return () => {
      try {
        abortRef.current?.abort?.("route-change");
      } catch {
        // noop
      }
    };
  }, [confirmar]);

  const onRetry = useCallback(() => {
    setAttempts((value) => value + 1);
    confirmar({ silent: false });
  }, [confirmar]);

  const onGoHome = useCallback(() => {
    navigate("/", {
      replace: true,
    });
  }, [navigate]);

  const onGoMyPresences = useCallback(() => {
    navigate("/minha-presenca");
  }, [navigate]);

  const goHomeSmart = useCallback(() => {
    const tokenOk = getValidToken();

    navigate(tokenOk ? "/" : "/login", {
      replace: false,
    });
  }, [navigate]);

  const titleColor = classNames(
    status === "ok" && "text-emerald-700 dark:text-emerald-300",
    status === "err" && "text-rose-700 dark:text-rose-300",
    status === "loading" && "text-slate-950 dark:text-zinc-100"
  );

  return (
    <div className="flex min-h-dvh flex-col bg-white text-slate-950 dark:bg-zinc-950 dark:text-white">
      <HeaderHero status={status} subtitle={subtitle} />

      {status === "loading" && (
        <div
          className="sticky top-0 z-40 h-1 w-full bg-emerald-100 dark:bg-emerald-950"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Processando confirmação"
        >
          <div className="h-full w-1/3 animate-pulse bg-emerald-700 dark:bg-emerald-500" />
        </div>
      )}

      <main role="main" className="flex-1 px-3 py-8 sm:px-4">
        <p
          ref={liveRef}
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        />

        <section className="mx-auto max-w-xl">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-zinc-900 dark:ring-zinc-800"
          >
            <div className="flex items-start gap-4">
              <StatusIcon status={status} />

              <div className="min-w-0 flex-1">
                <h2
                  ref={titleRef}
                  tabIndex={-1}
                  className={classNames(
                    "text-lg font-black outline-none",
                    titleColor
                  )}
                >
                  {msg}
                </h2>

                {detail && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
                    {detail}
                  </p>
                )}
              </div>
            </div>

            <InfoBox turma_id={turma_id} nowStr={nowStr} />

            <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              Confirmação autenticada e controlada pelo backend.
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {status === "loading" ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-black text-white disabled:opacity-70"
                >
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Processando...
                </button>
              ) : status === "ok" ? (
                <>
                  <button
                    type="button"
                    onClick={onGoMyPresences}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <UserCheck className="h-4 w-4" aria-hidden="true" />
                    Ver minhas presenças
                  </button>

                  <button
                    type="button"
                    onClick={onGoHome}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Home className="h-4 w-4" aria-hidden="true" />
                    Ir para a Home
                  </button>
                </>
              ) : requiresLogin ? (
                <>
                  <button
                    type="button"
                    onClick={goToLogin}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    Entrar e confirmar
                  </button>

                  <button
                    type="button"
                    onClick={goToRegister}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    Criar conta
                  </button>

                  <button
                    type="button"
                    onClick={goHomeSmart}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Home className="h-4 w-4" aria-hidden="true" />
                    Voltar
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Tentar novamente
                  </button>

                  <button
                    type="button"
                    onClick={onGoHome}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Home className="h-4 w-4" aria-hidden="true" />
                    Ir para a Home
                  </button>
                </>
              )}
            </div>

            {status !== "loading" && (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                <p className="mb-1 font-black">Dica rápida</p>

                <ul className="list-disc space-y-1 pl-4">
                  <li>Garanta que você está logado com a conta correta.</li>
                  <li>
                    Se o QR Code for de outra turma, peça um novo à organização.
                  </li>
                  <li>
                    Se aparecer fora do período, confirme o dia e horário do
                    encontro.
                  </li>
                </ul>
              </div>
            )}

            <p className="mt-4 text-[11px] font-medium text-slate-400 dark:text-zinc-500">
              Tentativas manuais: {attempts}
            </p>
          </motion.div>
        </section>
      </main>
    </div>
  );
}