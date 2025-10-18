// ✅ src/pages/ConfirmarPresenca.jsx (paleta fixa de 3 cores, rotas corrigidas, UX/a11y refinado)
import { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";

/* ---------------- Helpers locais ---------------- */
function safeAtob(s) {
  try {
    return atob(s);
  } catch {
    // tenta normalizar o padding do JWT
    const pad = s.length % 4 === 2 ? "==" : s.length % 4 === 3 ? "=" : "";
    try {
      return atob(s + pad);
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
// token simples: aceita "Bearer x.y.z" e "x.y.z"; checa nbf/exp
function getValidToken() {
  const raw = getRawToken();
  if (!raw) return null;
  const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payloadStr = safeAtob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadStr || "{}");
    const now = Date.now() / 1000;
    if (payload?.nbf && now < payload.nbf) return null;
    if (payload?.exp && now >= payload.exp) return null;
    return token;
  } catch {
    return null;
  }
}

/* ---------------- HeaderHero ---------------- */
function HeaderHero({ status }) {
  const isOk = status === "ok";
  const isErr = status === "err";
  // Paleta fixa de 3 cores (página Confirmar Presença): emerald → teal → cyan
  const gradient = "from-emerald-900 via-teal-700 to-cyan-600";

  return (
    <header className={`relative isolate overflow-hidden bg-gradient-to-br ${gradient} text-white`} role="banner">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 text-center">
        <div className="inline-flex items-center gap-2">
          <QrCode className="w-6 h-6" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Confirmação de Presença</h1>
        </div>
        <p className="mt-2 text-sm sm:text-base text-white/90">
          Escaneie o QR e deixe o resto com a gente. A confirmação é autenticada e idempotente.
        </p>

        {/* estado visual sutil */}
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15">
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

      {/* Glow decorativo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[800px] -translate-x-1/2 rounded-full blur-3xl opacity-25 bg-cyan-300"
      />
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
  const [attempts, setAttempts] = useState(0);
  const [requiresLogin, setRequiresLogin] = useState(false);

  // a11y
  const liveRef = useRef(null);
  const titleRef = useRef(null);
  const [nowStr] = useState(() =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date())
  );

  const setLive = (text) => {
    if (liveRef.current) liveRef.current.textContent = text;
  };

  const buildNext = () => {
    const base = location.pathname;
    const q = new URLSearchParams(location.search);
    q.set("turma", String(turmaId || ""));
    return `${base}?${q.toString()}`;
  };

  const goToLogin = () => {
    const next = buildNext();
    navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true });
  };

  const goToRegister = () => {
    const next = buildNext();
    // 🔧 rota pública de cadastro no app
    navigate(`/cadastro?next=${encodeURIComponent(next)}`, { replace: true });
  };

  // ação principal
  async function confirmar(controller) {
    if (!turmaId || !/^\d+$/.test(String(turmaId))) {
      setStatus("err");
      setMsg("Parâmetro 'turma' ausente ou inválido.");
      setDetail("Use o QR correto desta sala/turma.");
      setRequiresLogin(false);
      setLive("Parâmetro inválido.");
      titleRef.current?.focus();
      return;
    }

    // ✅ Pré-checagem: não logado → mensagem + CTA
    const tokenOk = getValidToken();
    if (!tokenOk) {
      setStatus("err");
      setMsg("Você precisa estar logado para registrar presença.");
      setDetail(
        "Entre na sua conta para confirmar a presença nesta turma. Voltaremos automaticamente para esta tela após o login."
      );
      setRequiresLogin(true);
      setLive("Login necessário para confirmar presença.");
      titleRef.current?.focus();
      return;
    }

    try {
      setStatus("loading");
      setMsg("Confirmando presença…");
      setDetail("");
      setRequiresLogin(false);
      setLive("Iniciando confirmação.");

      // OBS: apiPost já prefixa /api quando necessário
      await apiPost(`/presencas/confirmar-qr/${encodeURIComponent(turmaId)}`, {}, { signal: controller?.signal });

      setStatus("ok");
      setMsg("✅ Presença confirmada com sucesso!");
      setDetail("");
      setLive("Presença confirmada.");
      titleRef.current?.focus();
    } catch (e) {
      const code = e?.status || e?.response?.status;
      const serverMsg = e?.response?.data?.mensagem || e?.response?.data?.message || "";

      if (code === 401) {
        // não logado → login e volta pra cá
        goToLogin();
        return;
      }

      setStatus("err");
      if (code === 403) {
        setMsg("Acesso negado: você não está inscrito nesta turma.");
        setDetail(
          "Verifique se seu cadastro está correto para este evento/turma. Se você não estiver logado com a conta correta, entre e tente novamente."
        );
        setRequiresLogin(false);
      } else if (code === 409) {
        // Alguns backends usam 409 tanto para fora do período quanto para 'já confirmada'
        const already = /já (foi )?confirmad/i.test(serverMsg);
        setMsg(already ? "Sua presença já foi confirmada." : "Hoje não está dentro do período/datas desta turma.");
        setDetail(
          already
            ? "Não é necessário repetir a leitura do QR. Se precisar, confira suas presenças."
            : "Confirme com a equipe a data correta ou o cronograma da turma."
        );
        setRequiresLogin(false);
      } else {
        setMsg("Não foi possível confirmar a presença no momento.");
        setDetail("Tente novamente. Se persistir, procure a equipe de suporte.");
        setRequiresLogin(false);
      }
      setLive("Falha na confirmação de presença.");
      titleRef.current?.focus();
    }
  }

  // auto-executa ao montar (com cancelamento seguro)
  useEffect(() => {
    const controller = new AbortController();
    confirmar(controller);
    return () => controller.abort("route-change");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaId]);

  const onRetry = () => {
    setAttempts((n) => n + 1);
    const controller = new AbortController();
    confirmar(controller);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900 dark:bg-zinc-900 dark:text-white">
      <HeaderHero status={status} />

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
                  ? "text-red-700 dark:text-red-400"
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
                <p className="font-medium">{/^\d+$/.test(String(turmaId)) ? turmaId : "—"}</p>
              </div>
              <div className="rounded-lg border dark:border-zinc-700 p-3">
                <p className="text-zinc-500 dark:text-zinc-400">Horário local</p>
                <p className="font-medium">{nowStr}</p>
              </div>
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
                    onClick={() => navigate("/")}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border dark:border-zinc-700 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <Home className="w-4 h-4" />
                    Ir para a Home
                  </button>
                </>
              ) : (
                <>
                  {/* Se precisa logar, mostra CTAs de login/registro */}
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
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={onRetry}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm transition"
                      >
                        <Loader2 className="w-4 h-4" />
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
                </ul>
              </div>
            )}

            {/* contador de tentativas (debug leve) */}
            <p className="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">Tentativas: {attempts}</p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
