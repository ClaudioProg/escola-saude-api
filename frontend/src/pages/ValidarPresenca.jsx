// 📁 src/pages/ValidarPresenca.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Página:
// - Validação de presença por QR Code.
//
// Função:
// - Confirmar presença a partir de código recebido na URL;
// - aceitar contrato oficial por token ou turma_id;
// - orientar usuário em caso de falha;
// - redirecionar para login quando necessário.
//
// Contratos oficiais esperados:
// - GET  /api/presenca/confirmar/:turma_id
// - POST /api/presenca/confirmar-via-token
//
// Query oficial:
// - ?codigo=TOKEN_OU_TURMA_ID
//
// Diretrizes v2.0:
// - sem apiGet/apiPost direto;
// - sem rota plural presencas;
// - sem PageHeader antigo;
// - sem Footer antigo;
// - sem CarregandoSkeleton antigo;
// - sem fallback de endpoint;
// - sem aliases de query;
// - sem logs no browser;
// - resposta padrão ok/data/message/code;
// - erro orientativo;
// - suporte com modo debug apenas via ?debug=1;
// - anti-fuso preservado;
// - UX/UI premium real;
// - mobile-first;
// - acessível.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Home,
  Info,
  Loader2,
  LogIn,
  QrCode,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";

import api from "../services/api";
import Footer from "../components/layout/Footer";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";

/* =========================================================================
   Constantes
=========================================================================== */

const JWT_REGEX = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/* =========================================================================
   Helpers
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function safeDecodeURIComponent(input) {
  if (!input) return "";

  try {
    return decodeURIComponent(input);
  } catch {
    return String(input);
  }
}

function unwrapResponseMessage(response, fallback = "Presença confirmada com sucesso.") {
  const payload =
    response?.data && typeof response.data === "object" && "ok" in response.data
      ? response.data
      : response || null;

  return (
    payload?.message ||
    payload?.data?.message ||
    payload?.data?.mensagem ||
    fallback
  );
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function getHttpStatus(error) {
  return error?.response?.status || error?.status || null;
}

function normalizarCodigo(raw) {
  return safeDecodeURIComponent(raw).trim();
}

function extrairTurmaIdDeUrlOficial(rawUrl) {
  const url = new URL(rawUrl);

  const turmaId = url.searchParams.get("turma_id");

  if (!turmaId) return "";

  return String(turmaId).trim();
}

function detectarTipoCodigo(codigo) {
  if (!codigo) return "ausente";
  if (/^https?:\/\//i.test(codigo)) return "url";
  if (/^\d+$/.test(codigo)) return "turma_id";
  if (JWT_REGEX.test(codigo)) return "token";

  return "desconhecido";
}

/* =========================================================================
   UI local
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
    warning: {
      icon: AlertCircle,
      className:
        "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100",
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
        <Icon className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          {title ? <p className="font-black">{title}</p> : null}
          <p className={title ? "mt-1" : ""}>{message}</p>
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1 transition hover:bg-white/40 dark:hover:bg-white/10"
            aria-label="Fechar mensagem"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  icon: Icon,
  loading = false,
  variant = "primary",
  className = "",
  ...props
}) {
  const variants = {
    primary:
      "border-orange-700 bg-orange-700 text-white shadow-sm hover:bg-orange-600 dark:border-orange-500 dark:bg-orange-600 dark:hover:bg-orange-500",
    secondary:
      "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900",
    success:
      "border-emerald-700 bg-emerald-700 text-white shadow-sm hover:bg-emerald-600 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500",
  };

  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant] || variants.primary,
        className
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="h-4 w-4" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}

function HeaderHero() {
  return (
    <header className="relative isolate overflow-hidden text-white" role="banner">
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-950 via-orange-800 to-amber-700"
        aria-hidden="true"
      />
      <div
        className="absolute -left-28 -top-28 h-96 w-96 rounded-full bg-amber-300/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-28 -right-28 h-96 w-96 rounded-full bg-orange-300/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 opacity-[0.10] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.65)_1px,transparent_0)] [background-size:18px_18px]"
        aria-hidden="true"
      />

      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white/20 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow"
      >
        Ir para o conteúdo
      </a>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />
            Registro de presença • QR Code
          </div>

          <div className="flex items-center justify-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
              <QrCode className="h-7 w-7" aria-hidden="true" />
            </span>

            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Validar Presença
            </h1>
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
            Estamos conferindo o QR Code e registrando sua presença conforme as regras da turma.
          </p>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-px bg-white/25"
        aria-hidden="true"
      />
    </header>
  );
}

function StatusBadge({ status }) {
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/35 dark:text-emerald-200">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        Confirmada
      </span>
    );
  }

  if (status === "erro") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-100 px-3 py-1 text-xs font-black text-rose-800 dark:border-rose-800/50 dark:bg-rose-900/35 dark:text-rose-200">
        <XCircle className="h-4 w-4" aria-hidden="true" />
        Falhou
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-black text-slate-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      Validando
    </span>
  );
}

function DebugPanel({ codigo, turmaId, tipoCodigo, requestId, visible }) {
  if (!visible) return null;

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300">
      <p className="mb-3 font-black text-slate-900 dark:text-white">
        Informações de suporte
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="font-bold text-slate-500 dark:text-zinc-400">Tipo</p>
          <p className="break-all font-mono">{tipoCodigo || "—"}</p>
        </div>

        <div>
          <p className="font-bold text-slate-500 dark:text-zinc-400">
            Turma detectada
          </p>
          <p className="break-all font-mono">{turmaId || "—"}</p>
        </div>

        <div className="sm:col-span-2">
          <p className="font-bold text-slate-500 dark:text-zinc-400">Código</p>
          <p className="break-all font-mono">{codigo || "—"}</p>
        </div>

        <div className="sm:col-span-2">
          <p className="font-bold text-slate-500 dark:text-zinc-400">
            Request ID
          </p>
          <p className="break-all font-mono">{requestId || "—"}</p>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Página
=========================================================================== */

export default function ValidarPresenca() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const reduceMotion = useReducedMotion();

  const mountedRef = useRef(true);
  const runIdRef = useRef(0);
  const lockRef = useRef(false);
  const liveRef = useRef(null);

  const params = useMemo(() => new URLSearchParams(search), [search]);

  const isDebug = params.get("debug") === "1";
  const rawCodigo = params.get("codigo") || "";

  const [status, setStatus] = useState("loading");
  const [mensagem, setMensagem] = useState("Validando seu QR Code…");
  const [detalhe, setDetalhe] = useState("");
  const [mensagemLocal, setMensagemLocal] = useState(null);

  const [codigoNormalizado, setCodigoNormalizado] = useState("");
  const [tipoCodigo, setTipoCodigo] = useState("");
  const [turmaDetectada, setTurmaDetectada] = useState("");
  const [requestId, setRequestId] = useState("");

  const linkValidacao = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, [search]);

  function setLive(text) {
    if (liveRef.current) {
      liveRef.current.textContent = text;
    }
  }

  useEffect(() => {
    document.title = "Validar Presença | Escola da Saúde";
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  function safeSet(fn) {
    if (mountedRef.current) fn();
  }

  const copiarLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(linkValidacao);

      safeSet(() => {
        setMensagemLocal({
          type: "success",
          title: "Link copiado",
          message: "O link de validação foi copiado para a área de transferência.",
        });
      });
    } catch {
      safeSet(() => {
        setMensagemLocal({
          type: "warning",
          title: "Não foi possível copiar",
          message:
            "Seu navegador não permitiu copiar automaticamente. Copie o endereço diretamente na barra do navegador.",
        });
      });
    }
  }, [linkValidacao]);

  const irParaLogin = useCallback(
    (codigo) => {
      const redirect = `/validar-presenca?codigo=${encodeURIComponent(codigo)}`;
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, {
        replace: true,
      });
    },
    [navigate]
  );

  const goHome = useCallback(() => {
    navigate("/", { replace: true });
  }, [navigate]);

  const confirmarPorTurmaId = useCallback(async (turmaId) => {
    const response = await api.get(`/presenca/confirmar/${Number(turmaId)}`);
    return unwrapResponseMessage(response);
  }, []);

  const confirmarPorToken = useCallback(async (token) => {
    const response = await api.post("/presenca/confirmar-via-token", {
      token,
    });

    return unwrapResponseMessage(response);
  }, []);

  const runValidacao = useCallback(
    async ({ force = false } = {}) => {
      const myRunId = ++runIdRef.current;

      if (lockRef.current && !force) return;

      lockRef.current = true;

      safeSet(() => {
        setStatus("loading");
        setMensagem("Validando seu QR Code…");
        setDetalhe("");
        setMensagemLocal(null);
        setCodigoNormalizado("");
        setTipoCodigo("");
        setTurmaDetectada("");
        setRequestId("");
      });

      const codigo = normalizarCodigo(rawCodigo);
      const tipo = detectarTipoCodigo(codigo);

      safeSet(() => {
        setCodigoNormalizado(codigo);
        setTipoCodigo(tipo);
      });

      try {
        if (!codigo) {
          throw new Error("Código ausente. Abra novamente pelo QR Code ou confira o link.");
        }

        let message = "";
        let turmaIdDetectado = "";

        if (tipo === "url") {
          turmaIdDetectado = extrairTurmaIdDeUrlOficial(codigo);

          safeSet(() => setTurmaDetectada(turmaIdDetectado));

          if (!/^\d+$/.test(String(turmaIdDetectado || ""))) {
            throw new Error(
              "QR Code inválido. O link não contém o parâmetro oficial turma_id."
            );
          }

          message = await confirmarPorTurmaId(turmaIdDetectado);
        } else if (tipo === "turma_id") {
          turmaIdDetectado = codigo;

          safeSet(() => setTurmaDetectada(turmaIdDetectado));

          message = await confirmarPorTurmaId(codigo);
        } else if (tipo === "token") {
          message = await confirmarPorToken(codigo);
        } else {
          throw new Error("Formato de código não reconhecido.");
        }

        if (myRunId !== runIdRef.current) return;

        safeSet(() => {
          setStatus("ok");
          setMensagem(message || "Presença confirmada com sucesso.");
          setDetalhe(
            "Registro concluído. Você pode retornar à página inicial ou fechar esta tela."
          );
        });

        setLive("Presença confirmada com sucesso.");
      } catch (error) {
        const httpStatus = getHttpStatus(error);

        if (httpStatus === 401) {
          lockRef.current = false;

          if (isDebug) {
            safeSet(() => {
              setStatus("erro");
              setMensagem("Login necessário.");
              setDetalhe(
                "Você precisa estar autenticado para confirmar presença nesta turma."
              );
              setRequestId(
                error?.response?.data?.requestId ||
                  error?.data?.requestId ||
                  ""
              );
            });

            setLive("Login necessário para confirmar presença.");
            return;
          }

          return irParaLogin(codigo);
        }

        if (myRunId !== runIdRef.current) return;

        safeSet(() => {
          setStatus("erro");
          setMensagem(
            getErrorMessage(
              error,
              "Não foi possível confirmar sua presença."
            )
          );
          setDetalhe(
            "Confira se você está inscrito na turma, se a janela de confirmação está aberta e se o QR Code corresponde ao evento correto."
          );
          setRequestId(
            error?.response?.data?.requestId ||
              error?.data?.requestId ||
              ""
          );
        });

        setLive("Falha na confirmação de presença.");
      } finally {
        if (myRunId === runIdRef.current) {
          lockRef.current = false;
        }
      }
    },
    [
      rawCodigo,
      confirmarPorTurmaId,
      confirmarPorToken,
      irParaLogin,
      isDebug,
    ]
  );

  useEffect(() => {
    runValidacao({ force: true });
  }, [runValidacao]);

  const tentarNovamente = useCallback(() => {
    runValidacao({ force: true });
  }, [runValidacao]);

  const tituloResultado =
    status === "ok"
      ? "Presença confirmada"
      : status === "erro"
        ? "Falha na confirmação"
        : "Validando presença";

  const tone =
    status === "ok"
      ? "text-emerald-700 dark:text-emerald-300"
      : status === "erro"
        ? "text-rose-700 dark:text-rose-300"
        : "text-slate-900 dark:text-white";

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-white to-white text-slate-950 dark:from-zinc-950 dark:via-zinc-950 dark:to-black dark:text-white">
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <HeaderHero />

      {status === "loading" ? (
        <div
          className="sticky left-0 top-0 z-40 h-1 w-full bg-orange-100 dark:bg-orange-950/30"
          role="progressbar"
          aria-label="Validando presença"
        >
          <div
            className={cx(
              "h-full w-1/3 bg-orange-600",
              reduceMotion ? "" : "animate-pulse"
            )}
          />
        </div>
      ) : null}

      <section
        id="conteudo"
        role="main"
        className="mx-auto flex w-full max-w-4xl flex-1 items-center px-4 py-8 sm:px-6"
      >
        <div className="w-full">
          {mensagemLocal ? (
            <div className="mb-5">
              <AlertBox
                type={mensagemLocal.type}
                title={mensagemLocal.title}
                message={mensagemLocal.message}
                onClose={() => setMensagemLocal(null)}
              />
            </div>
          ) : null}

          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
            aria-live="polite"
            aria-atomic="true"
          >
            <div
              className={cx(
                "h-2",
                status === "ok"
                  ? "bg-gradient-to-r from-emerald-700 via-emerald-500 to-teal-400"
                  : status === "erro"
                    ? "bg-gradient-to-r from-rose-700 via-rose-500 to-orange-400"
                    : "bg-gradient-to-r from-orange-700 via-orange-500 to-amber-400"
              )}
              aria-hidden="true"
            />

            <div className="p-5 sm:p-8">
              {status === "loading" ? (
                <div className="space-y-5">
                  <div className="flex justify-center">
                    <StatusBadge status={status} />
                  </div>

                  <CarregandoSkeleton linhas={3} />

                  <p className="text-center text-sm text-slate-600 dark:text-zinc-300">
                    {mensagem}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex justify-center">
                    <StatusBadge status={status} />
                  </div>

                  <div className="mt-5 flex justify-center">
                    <div
                      className={cx(
                        "grid h-20 w-20 place-items-center rounded-3xl",
                        status === "ok"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-200"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-950/35 dark:text-rose-200"
                      )}
                    >
                      {status === "ok" ? (
                        <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
                      ) : (
                        <XCircle className="h-10 w-10" aria-hidden="true" />
                      )}
                    </div>
                  </div>

                  <h2
                    className={cx(
                      "mt-5 text-center text-2xl font-black tracking-tight sm:text-3xl",
                      tone
                    )}
                    role={status === "erro" ? "alert" : "status"}
                  >
                    {tituloResultado}
                  </h2>

                  <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-slate-700 dark:text-zinc-300 sm:text-base">
                    {mensagem}
                  </p>

                  {detalhe ? (
                    <div
                      className={cx(
                        "mt-5 rounded-2xl border p-4 text-sm leading-relaxed",
                        status === "ok"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100"
                          : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 h-4 w-4 flex-none" />
                        <p>{detalhe}</p>
                      </div>
                    </div>
                  ) : null}

                  <DebugPanel
                    visible={isDebug}
                    codigo={codigoNormalizado}
                    turmaId={turmaDetectada}
                    tipoCodigo={tipoCodigo}
                    requestId={requestId}
                  />

                  <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {status === "erro" ? (
                      <ActionButton
                        onClick={tentarNovamente}
                        icon={RefreshCcw}
                        className="w-full"
                      >
                        Tentar novamente
                      </ActionButton>
                    ) : null}

                    {status === "erro" ? (
                      <ActionButton
                        onClick={() => irParaLogin(codigoNormalizado)}
                        icon={LogIn}
                        variant="secondary"
                        className="w-full"
                      >
                        Fazer login
                      </ActionButton>
                    ) : null}

                    <ActionButton
                      onClick={copiarLink}
                      icon={Copy}
                      variant={status === "ok" ? "success" : "secondary"}
                      className="w-full"
                    >
                      Copiar link
                    </ActionButton>

                    <ActionButton
                      onClick={goHome}
                      icon={Home}
                      variant="secondary"
                      className="w-full"
                    >
                      Início
                    </ActionButton>
                  </div>
                </>
              )}
            </div>
          </motion.section>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 flex-none text-orange-600 dark:text-orange-300" />
              <p>
                Se a presença não for confirmada, verifique se você está logado,
                inscrito na turma correta e dentro da janela de confirmação
                definida para o evento.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}