/* eslint-disable no-console */
// ✅ src/pages/ConfirmarPresenca.jsx — premium + robusto (anti-fuso, idempotência, anticorrida, UX melhor)
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiPost } from "../services/api";
import Footer from "../components/Footer";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  QrCode,
  Home,
  UserCheck,
  LogIn,
  UserPlus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

/* ---------------- Helpers locais ---------------- */
function getRawToken() {
  try {
    const raw = localStorage.getItem("token");
    return raw ? raw.trim() : null;
  } catch {
    return null;
  }
}

// JWT: aceita "Bearer x.y.z" ou "x.y.z"; valida nbf/exp; URL-safe + padding
function getValidToken() {
  const raw = getRawToken();
  if (!raw) return null;
  const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(b64 + pad));
    const now = Date.now() / 1000;
    if (payload?.nbf && now < payload.nbf) return null;
    if (payload?.exp && now >= payload.exp) return null;
    return token;
  } catch {
    return null;
  }
}

function isNumericId(v) {
  return /^\d+$/.test(String(v || ""));
}

/* ---------------- HeaderHero (padronizado) ---------------- */
function HeaderHero({ status, subtitle }) {
  const isOk = status === "ok";
  const isErr = status === "err";

  return (
    <header
      className="relative isolate overflow-hidden bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-700 text-white"
      role="banner"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(52% 60% at 50% 0%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 32%, rgba(255,255,255,0) 60%)",
        }}
        aria-hidden="true"
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 md:py-12 min-h-[150px] sm:min-h-[180px] text-center flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-2">
          <QrCode className="w-6 h-6" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Confirmação de Presença
          </h1>
        </div>

        <p className="text-sm sm:text-base text-white/90 max-w-2xl">
          {subtitle ||
            "Escaneie o QR e deixe o resto com a gente. A confirmação é autenticada e idempotente."}
        </p>

        {/* chip de estado */}
        <div className="mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15">
          {isOk ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm">Presença confirmada</span>
            </>
          ) : isErr ? (
            <>
              <XCircle className="w-4 h-4" />
              <span className="text-sm">Ação necessária</span>
            </>
          ) : (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Processando…</span>
            </>
          )}
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[800px] -translate-x-1/2 rounded-full blur-3xl opacity-25 bg-cyan-300"
      />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* ---------------- Página ---------------- */
export default function ConfirmarPresenca() {
  const [searchParams] = useSearchParams();
  const { turmaId: turmaIdFromPath } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // turma pode vir como /presenca?turma=123 ou /presenca/123
  const turmaId = useMemo(
    () => searchParams.get("turma") || turmaIdFromPath || "",
    [searchParams, turmaIdFromPath]
  );

  // estados
  const [status, setStatus] = useState("loading"); // "loading" | "ok" | "err"
  const [msg, setMsg] = useState("Confirmando presença…");
  const [detail, setDetail] = useState("");
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [subtitle, setSubtitle] = useState("");

  // a11y
  const liveRef = useRef(null);
  const titleRef = useRef(null);

  // anticorrida + abort
  const abortRef = useRef(null);
  const inFlightRef = useRef(0);

  // “agora” (uma vez) — só para exibir, não decide regra
  const [nowStr] = useState(() =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date())
  );

  const setLive = (text) => {
    if (liveRef.current) liveRef.current.textContent = text;
  };

  // redirecionamento consistente com Login.jsx (usa ?redirect=…)
  const buildRedirect = useCallback(() => {
    const base = location.pathname;
    const q = new URLSearchParams();
    q.set("turma", String(turmaId || ""));
    return `${base}?${q.toString()}`;
  }, [location.pathname, turmaId]);

  const goToLogin = useCallback(() => {
    const redirect = buildRedirect();
    navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
  }, [navigate, buildRedirect]);

  const goToRegister = useCallback(() => {
    const redirect = buildRedirect();
    navigate(`/cadastro?redirect=${encodeURIComponent(redirect)}`, { replace: true });
  }, [navigate, buildRedirect]);

  const safeFocusTitle = () => {
    // evita jump visual; dá foco para SR/teclado
    requestAnimationFrame(() => titleRef.current?.focus?.());
  };

  // ação principal
  const confirmar = useCallback(
    async ({ silent = false } = {}) => {
      const turmaOk = isNumericId(turmaId);

      if (!turmaOk) {
        setStatus("err");
        setMsg("Parâmetro 'turma' ausente ou inválido.");
        setDetail("Use o QR correto desta sala/turma.");
        setRequiresLogin(false);
        setSubtitle("Não foi possível identificar a turma.");
        setLive("Parâmetro inválido.");
        safeFocusTitle();
        return;
      }

      // Pré-checagem de sessão
      const tokenOk = getValidToken();
      if (!tokenOk) {
        setStatus("err");
        setMsg("Você precisa estar logado para registrar presença.");
        setDetail(
          "Entre na sua conta para confirmar a presença nesta turma. Após o login, voltaremos automaticamente para esta tela."
        );
        setRequiresLogin(true);
        setSubtitle("A confirmação é autenticada.");
        setLive("Login necessário para confirmar presença.");
        safeFocusTitle();
        return;
      }

      // abort request anterior
      try {
        abortRef.current?.abort?.();
      } catch {}
      const controller = new AbortController();
      abortRef.current = controller;

      inFlightRef.current += 1;
      const myFlight = inFlightRef.current;

      if (!silent) {
        setStatus("loading");
        setMsg("Confirmando presença…");
        setDetail("");
        setRequiresLogin(false);
        setSubtitle("Aguarde alguns segundos.");
        setLive("Iniciando confirmação.");
      }

      try {
        // helper de API já prefixa /api quando necessário
        await apiPost(
          `/presencas/confirmar-qr/${encodeURIComponent(String(turmaId))}`,
          {},
          { signal: controller.signal }
        );

        // se outra chamada começou depois, ignora (anticorrida)
        if (myFlight !== inFlightRef.current) return;

        setStatus("ok");
        setMsg("✅ Presença confirmada com sucesso!");
        setDetail("Você já pode fechar esta tela ou conferir em “Minhas presenças”.");
        setRequiresLogin(false);
        setSubtitle("Registro concluído.");
        setLive("Presença confirmada.");
        safeFocusTitle();
      } catch (e) {
        if (e?.name === "AbortError") return;

        const code = e?.status || e?.response?.status;

        // se backend respondeu 401, manda pro login
        if (code === 401) {
          goToLogin();
          return;
        }

        setStatus("err");
        setRequiresLogin(false);

        if (code === 403) {
          setMsg("Acesso negado: você não está inscrito nesta turma.");
          setDetail(
            "Verifique se você está logado com a conta correta e se está inscrito nesta turma."
          );
          setSubtitle("Conta ou inscrição inválida.");
        } else if (code === 409) {
          // Conflito: regra de período/datas/hora
          setMsg("Ainda não é possível confirmar presença para esta turma.");
          setDetail(
            "A confirmação só funciona no período permitido. Confirme com a organização o horário correto."
          );
          setSubtitle("Fora do período permitido.");
        } else if (code === 404) {
          setMsg("Turma não encontrada.");
          setDetail("O QR pode estar desatualizado. Solicite o QR correto à organização.");
          setSubtitle("QR inválido ou desatualizado.");
        } else {
          setMsg("Não foi possível confirmar a presença no momento.");
          setDetail("Tente novamente. Se persistir, procure a equipe de suporte.");
          setSubtitle("Falha temporária.");
        }

        setLive("Falha na confirmação de presença.");
        safeFocusTitle();
      }
    },
    [turmaId, goToLogin]
  );

  // auto-executa ao montar (com cancelamento seguro)
  useEffect(() => {
    confirmar({ silent: false });
    return () => {
      try {
        abortRef.current?.abort?.();
      } catch {}
    };
  }, [confirmar]);

  const onRetry = () => {
    setAttempts((n) => n + 1);
    confirmar({ silent: false });
  };

  // “voltar para home” inteligente: se tiver token, vai para /; senão, login
  const goHomeSmart = () => {
    const tokenOk = getValidToken();
    navigate(tokenOk ? "/" : "/login", { replace: false });
  };

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900 dark:bg-zinc-900 dark:text-white">
      <HeaderHero status={status} subtitle={subtitle} />

      {/* barra de progresso fina no topo */}
      {status === "loading" && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-emerald-100 dark:bg-emerald-950 z-40"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Processando confirmação"
        >
          <div className="h-full bg-emerald-700 dark:bg-emerald-600 animate-pulse w-1/3" />
        </div>
      )}

      <main role="main" className="flex-1 px-3 sm:px-4 py-8">
        {/* Live region acessível */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        <section className="max-w-xl mx-auto">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm ring-1 ring-zinc-200/60 dark:ring-zinc-700/60 p-5">
            {/* título focável para leitores de tela após transição de estado */}
            <h2
              ref={titleRef}
              tabIndex={-1}
              className={`text-lg font-semibold ${
                status === "ok"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : status === "err"
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {msg}
            </h2>

            {/* detalhes amigáveis */}
            {detail && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{detail}</p>}

            {/* contexto da operação */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border dark:border-zinc-700 p-3">
                <p className="text-zinc-500 dark:text-zinc-400">Turma</p>
                <p className="font-medium">{isNumericId(turmaId) ? turmaId : "—"}</p>
              </div>
              <div className="rounded-lg border dark:border-zinc-700 p-3">
                <p className="text-zinc-500 dark:text-zinc-400">Horário local</p>
                <p className="font-medium">{nowStr}</p>
              </div>
            </div>

            {/* selo segurança */}
            <div className="mt-3 inline-flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 px-3 py-2 rounded-xl">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              Confirmação autenticada • operação idempotente
            </div>

            {/* ações */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {status === "loading" ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm disabled:opacity-60"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processando…
                </button>
              ) : status === "ok" ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate("/minhas-presencas")}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm transition"
                  >
                    <UserCheck className="w-4 h-4" />
                    Ver minhas presenças
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/notificacao")}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border dark:border-zinc-700 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    title="Ver notificações"
                  >
                    <QrCode className="w-4 h-4" />
                    Ver notificações
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border dark:border-zinc-700 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <Home className="w-4 h-4" />
                    Ir para a Home
                  </button>
                </>
              ) : (
                <>
                  {requiresLogin ? (
                    <>
                      <button
                        type="button"
                        onClick={goToLogin}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm transition"
                      >
                        <LogIn className="w-4 h-4" />
                        Entrar e confirmar
                      </button>
                      <button
                        type="button"
                        onClick={goToRegister}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border dark:border-zinc-700 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <UserPlus className="w-4 h-4" />
                        Criar conta
                      </button>
                      <button
                        type="button"
                        onClick={goHomeSmart}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border dark:border-zinc-700 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <Home className="w-4 h-4" />
                        Voltar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={onRetry}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm transition"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Tentar novamente
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate("/")}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border dark:border-zinc-700 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <Home className="w-4 h-4" />
                        Ir para a Home
                      </button>
                    </>
                  )}
                </>
              )}
            </div>

            {/* ajuda rápida */}
            {status !== "loading" && (
              <div className="mt-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 p-3 text-xs">
                <p className="font-medium mb-1">Dica rápida</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Garanta que você está logado com a conta correta.</li>
                  <li>Se o QR foi impresso para outra turma, peça um novo à organização.</li>
                  <li>Se aparecer “fora do período”, confirme o horário/dia do encontro.</li>
                </ul>
              </div>
            )}

            {/* contador de tentativas */}
            <p className="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">
              Tentativas: {attempts}
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
