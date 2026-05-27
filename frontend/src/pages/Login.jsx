// ✅ frontend/src/pages/Login.jsx — v2.0
// Plataforma Escola da Saúde
// Login premium, institucional, mobile-first, acessível, sem sessão legada e com contrato oficial.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Building2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  HeartPulse,
  IdCard,
  Info,
  Instagram,
  KeyRound,
  Landmark,
  Loader2,
  Lock,
  LogIn,
  MonitorSmartphone,
  QrCode,
  ShieldCheck,
  Share2,
  Smartphone,
  Sparkles,
  User,
} from "lucide-react";

import Footer from "../components/layout/Footer";
import QrSiteEscola from "../components/institucional/QrSiteEscola";

import useEscolaTheme from "../hooks/useEscolaTheme";
import {
  apiAuthLogin,
  apiAuthGoogle,
  apiPerfilMe,
  clearAuthSession,
  isLoggedIn,
  persistAuthSession,
} from "../services/api";

/* ─────────────────────────────────────────────────────────────
   Constantes oficiais
────────────────────────────────────────────────────────────── */

const SITE_URL = "https://escoladasaude.vercel.app";
const INSTAGRAM_URL =
  "https://www.instagram.com/escoladasaudesms?igsh=Zzd5M3MyazZ0aXRm&utm_source=qr";

const IS_DEV =
  typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function logDev(...args) {
  if (IS_DEV) console.log("[Login]", ...args);
}

function errorDev(...args) {
  if (IS_DEV) console.error("[Login]", ...args);
}

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function sanitizeRedirectPath(raw) {
  const value = String(raw || "").trim();

  if (!value) return "/painel";
  if (!value.startsWith("/")) return "/painel";
  if (value.startsWith("//")) return "/painel";

  const blockedPrefixes = [
    "/login",
    "/cadastro",
    "/esqueci-senha",
    "/redefinir-senha",
  ];

  if (blockedPrefixes.some((prefix) => value.startsWith(prefix))) {
    return "/painel";
  }

  return value;
}

function apenasDigitos(value) {
  return String(value || "").replace(/\D/g, "");
}

function aplicarMascaraCPF(value) {
  return apenasDigitos(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function cpfChecksumValido(cpf) {
  const digits = apenasDigitos(cpf);

  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calc = (arr, len) => {
    let soma = 0;

    for (let i = 0; i < len - 1; i += 1) {
      soma += parseInt(arr[i], 10) * (len - i);
    }

    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const d1 = calc(digits, 10);
  const d2 = calc(digits, 11);

  return d1 === parseInt(digits[9], 10) && d2 === parseInt(digits[10], 10);
}

function validarCPF(value) {
  return cpfChecksumValido(value);
}

function safeOpen(url) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function getApiErrorMessage(error, fallback) {
  return (
    error?.data?.erro ||
    error?.data?.message ||
    error?.response?.data?.erro ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function getAuthPayload(response) {
  const payload =
    response?.data && typeof response.data === "object" ? response.data : response;

  if (!payload || typeof payload !== "object") {
    return null;
  }

  return {
    token: payload.token,
    usuario: payload.usuario,
  };
}

function usuarioSessaoValido(usuario) {
  return Boolean(
    usuario &&
      typeof usuario === "object" &&
      Number.isFinite(Number(usuario.id)) &&
      typeof usuario.perfil === "string" &&
      usuario.perfil.trim() === usuario.perfil &&
      usuario.perfil.length > 0
  );
}

function useQrSize() {
  const [size, setSize] = useState(() => {
    if (typeof window === "undefined") return 240;

    const width = window.innerWidth;
    if (width < 360) return 210;
    if (width < 768) return 220;
    return 240;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onResize = () => {
      const width = window.innerWidth;
      const next = width < 360 ? 210 : width < 768 ? 220 : 240;
      setSize(next);
    };

    window.addEventListener("resize", onResize, { passive: true });

    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}

/* ─────────────────────────────────────────────────────────────
   Componentes locais
────────────────────────────────────────────────────────────── */

function SpinnerLocal() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]"
      aria-hidden="true"
    />
  );
}

function BotaoLocal({
  children,
  variant = "primary",
  className = "",
  leftIcon = null,
  loading = false,
  disabled = false,
  ...props
}) {
  const base =
    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

  const variants = {
    primary:
      "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-900/10 hover:bg-amber-400 focus-visible:ring-amber-500/70",
    secondary:
      "border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 focus-visible:ring-emerald-500/60 dark:border-emerald-600/50 dark:bg-emerald-700/40 dark:text-emerald-100 dark:hover:bg-emerald-700/60",
  };

  return (
    <button
      className={cx(base, variants[variant] || variants.primary, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <SpinnerLocal /> : leftIcon}
      {children}
    </button>
  );
}

function SkeletonLoginGoogle({ mensagem }) {
  return (
    <div className="flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-300">
      <SpinnerLocal />
      <span>{mensagem}</span>
    </div>
  );
}

function FeaturePill({ children, isDark }) {
  return (
    <div
      className={cx(
        "rounded-2xl border px-3 py-2 text-xs font-bold",
        isDark
          ? "border-white/10 bg-zinc-950/35 text-zinc-200"
          : "border-slate-200 bg-white text-slate-700 shadow-sm"
      )}
    >
      {children}
    </div>
  );
}

function MiniStatLite({ title, value, isDark, icon: Icon }) {
  return (
    <div
      className={cx(
        "rounded-2xl border px-4 py-3 transition-colors",
        isDark
          ? "border-white/10 bg-zinc-950/35"
          : "border-slate-200 bg-white shadow-sm"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={cx(
              "text-[11px] font-bold uppercase tracking-wide",
              isDark ? "text-zinc-300" : "text-slate-500"
            )}
          >
            {title}
          </div>
          <div
            className={cx(
              "mt-1 text-sm font-extrabold",
              isDark ? "text-zinc-100" : "text-slate-900"
            )}
          >
            {value}
          </div>
        </div>

        {Icon ? (
          <div
            className={cx(
              "rounded-xl p-2",
              isDark
                ? "bg-white/5 text-zinc-200"
                : "bg-slate-100 text-slate-700"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InstitutionalCard({
  icon: Icon,
  title,
  subtitle,
  children,
  isDark,
  accent = "emerald",
}) {
  const accentMap = {
    emerald: isDark
      ? "from-emerald-500/35 via-emerald-400/10 to-transparent"
      : "from-emerald-500/30 via-emerald-300/10 to-transparent",
    sky: isDark
      ? "from-sky-500/35 via-sky-400/10 to-transparent"
      : "from-sky-500/30 via-sky-300/10 to-transparent",
    violet: isDark
      ? "from-violet-500/35 via-violet-400/10 to-transparent"
      : "from-violet-500/30 via-violet-300/10 to-transparent",
    amber: isDark
      ? "from-amber-500/35 via-amber-400/10 to-transparent"
      : "from-amber-500/30 via-amber-300/10 to-transparent",
    rose: isDark
      ? "from-rose-500/35 via-rose-400/10 to-transparent"
      : "from-rose-500/30 via-rose-300/10 to-transparent",
  };

  return (
    <article
      className={cx(
        "overflow-hidden rounded-3xl border transition-colors",
        isDark
          ? "border-white/10 bg-white/[0.04] backdrop-blur-xl"
          : "border-white/10 bg-white/[0.04] backdrop-blur-xl"
      )}
    >
      <div
        className={cx(
          "h-1.5 w-full rounded-t-3xl bg-gradient-to-r",
          accentMap[accent] || accentMap.emerald
        )}
        aria-hidden="true"
      />

      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div
            className={cx(
              "rounded-2xl border p-3",
              isDark
                ? "border-white/10 bg-zinc-950/35 text-zinc-100"
                : "border-slate-200 bg-slate-50 text-slate-800"
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <h3
              className={cx(
                "text-lg font-extrabold tracking-tight",
                isDark ? "text-zinc-100" : "text-slate-900"
              )}
            >
              {title}
            </h3>

            {subtitle ? (
              <p
                className={cx(
                  "mt-1 text-sm font-semibold",
                  isDark ? "text-emerald-300" : "text-emerald-700"
                )}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className={cx(
            "mt-4 space-y-3 text-sm leading-relaxed",
            isDark ? "text-zinc-300" : "text-slate-700"
          )}
        >
          {children}
        </div>
      </div>
    </article>
  );
}

function QrCard({
  title,
  subtitle,
  icon: Icon,
  url,
  qrSize,
  isDark,
  accent = "emerald",
}) {
  const bar = {
    emerald: "from-emerald-500/40 via-teal-500/15 to-transparent",
    pink: "from-pink-500/40 via-rose-500/15 to-transparent",
  };

  return (
    <div
      className={cx(
        "rounded-3xl border p-5 sm:p-6",
        isDark
          ? "border-white/10 bg-zinc-900/55"
          : "border-slate-200 bg-white shadow-sm"
      )}
    >
      <div
        className={cx(
          "h-1.5 w-full rounded-full bg-gradient-to-r",
          bar[accent] || bar.emerald
        )}
        aria-hidden="true"
      />

      <div className="mt-4 flex items-start gap-3">
        <div
          className={cx(
            "rounded-2xl border p-3",
            isDark
              ? "border-white/10 bg-zinc-950/35 text-zinc-100"
              : "border-slate-200 bg-slate-50 text-slate-800"
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <h3
            className={cx(
              "text-sm font-extrabold",
              isDark ? "text-zinc-100" : "text-slate-900"
            )}
          >
            {title}
          </h3>
          <p
            className={cx(
              "mt-1 break-words text-[12px]",
              isDark ? "text-zinc-400" : "text-slate-600"
            )}
          >
            {subtitle}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center">
        <QrSiteEscola size={qrSize} showLogo={false} url={url} />
      </div>
    </div>
  );
}

function ActionBtn({ onClick, icon: Icon, children, isDark }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex min-h-[40px] items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-extrabold transition",
        "focus:outline-none focus:ring-2 focus:ring-emerald-500/70",
        isDark
          ? "border-white/10 bg-zinc-900/35 text-zinc-200 hover:bg-white/5"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {children}
    </button>
  );
}

function SessionCheckBanner({ isDark }) {
  return (
    <div
      className={cx(
        "mt-6 rounded-2xl border p-4",
        isDark
          ? "border-emerald-500/20 bg-emerald-500/10"
          : "border-emerald-200/40 bg-emerald-500/5"
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <Loader2
          className="h-5 w-5 animate-spin text-emerald-600 dark:text-emerald-300"
          aria-hidden="true"
        />
        <div>
          <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Verificando sua sessão...
          </div>
          <div className="mt-0.5 text-xs text-emerald-700/80 dark:text-emerald-300/80">
            Aguarde um instante para liberar o acesso com segurança.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Página
────────────────────────────────────────────────────────────── */

export default function Login() {
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingSessionCheck, setLoadingSessionCheck] = useState(true);
  const [erroCpf, setErroCpf] = useState("");
  const [erroSenha, setErroSenha] = useState("");
  const [capsLockOn, setCapsLockOn] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const cpfRef = useRef(null);
  const senhaRef = useRef(null);
  const mountedRef = useRef(false);
  const qrSize = useQrSize();

  const hasGoogleClient = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const { isDark } = useEscolaTheme();

const redirectPath = useMemo(() => {
  try {
    const params = new URLSearchParams(location.search);
    const raw = params.get("next") || "";
    return sanitizeRedirectPath(raw);
  } catch {
    return "/painel";
  }
}, [location.search]);

 const inputBaseClass = useMemo(
  () =>
    cx(
      "w-full rounded-2xl border py-3 text-sm outline-none transition-all duration-200",
      "focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500",
      isDark
        ? "border-white/10 bg-black/30 text-zinc-100 placeholder:text-zinc-500"
        : "border-slate-300 bg-white/90 text-slate-900 placeholder:text-slate-400 shadow-sm"
    ),
  [isDark]
);

  useEffect(() => {
    mountedRef.current = true;
    document.title = "Entrar — Escola da Saúde";

    return () => {
      mountedRef.current = false;
    };
  }, []);

useEffect(() => {
  let cancelled = false;

  async function validarSessaoExistente() {
    if (!isLoggedIn()) {
      logDev("sem token oficial salvo; permanece na tela de login");

      if (!cancelled && mountedRef.current) {
        setLoadingSessionCheck(false);
      }

      return;
    }

    logDev("token oficial encontrado; validando sessão em /perfil/me", {
      pathname: location.pathname,
      redirectPath,
    });

    try {
      const response = await apiPerfilMe({
        on401: "silent",
        on403: "silent",
      });

      const usuarioRecebido =
        response?.data && typeof response.data === "object"
          ? response.data
          : response;

      if (!usuarioSessaoValido(usuarioRecebido)) {
        throw new Error("Sessão inválida: payload de perfil fora do contrato oficial.");
      }

      if (!cancelled && mountedRef.current) {
        logDev("sessão válida no login; redirecionando", {
          redirectPath,
          perfil: usuarioRecebido.perfil,
        });

        navigate(redirectPath || "/painel", { replace: true });
      }
    } catch (error) {
      errorDev("sessão salva inválida no login", {
        message: error?.message,
        status: error?.status || null,
      });

      clearAuthSession();
    } finally {
      if (!cancelled && mountedRef.current) {
        setLoadingSessionCheck(false);
      }
    }
  }

  if (location.pathname === "/login") {
    validarSessaoExistente();
  } else {
    setLoadingSessionCheck(false);
  }

  return () => {
    cancelled = true;
  };
}, [navigate, location.pathname, redirectPath]);

  useEffect(() => {
    const onKey = (event) => {
      const active = document.activeElement;
      const tag = active?.tagName?.toLowerCase();

      if (tag === "input" || tag === "textarea" || active?.isContentEditable) {
        return;
      }

      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        cpfRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

 const persistirSessao = useCallback((response) => {
  const payload = getAuthPayload(response);

  if (!payload?.token || !usuarioSessaoValido(payload.usuario)) {
    throw new Error("Resposta de login fora do contrato oficial.");
  }

  persistAuthSession(payload.token, payload.usuario);

  logDev("sessão persistida com sucesso", {
    usuario_id: payload.usuario.id,
    perfil: payload.usuario.perfil,
  });
}, []);

  const redirecionarPosLogin = useCallback(
    (payload) => {
      persistirSessao(payload);

      const destino = redirectPath || "/painel";

      logDev("redirecionando pós-login", { destino });

      window.setTimeout(() => {
        navigate(destino, { replace: true });
      }, 0);
    },
    [navigate, persistirSessao, redirectPath]
  );

  const validarFormulario = useCallback(() => {
    setErroCpf("");
    setErroSenha("");

    const cpfDigits = apenasDigitos(cpf);

    if (!validarCPF(cpfDigits)) {
      setErroCpf("CPF inválido. Verifique os dígitos.");
      cpfRef.current?.focus();
      return false;
    }

    if (!senha) {
      setErroSenha("Digite sua senha.");
      senhaRef.current?.focus();
      return false;
    }

    if (senha.length < 8) {
      setErroSenha("A senha deve conter pelo menos 8 caracteres.");
      senhaRef.current?.focus();
      return false;
    }

    return true;
  }, [cpf, senha]);

async function handleLogin(event) {
  event.preventDefault();

  if (loading || loadingGoogle || loadingSessionCheck) return;
  if (!validarFormulario()) return;

  setLoading(true);

  logDev("iniciando login por CPF", {
    cpf_tamanho: apenasDigitos(cpf).length,
    redirectPath,
  });

  try {
    const response = await apiAuthLogin(
  {
    cpf: apenasDigitos(cpf),
    senha,
  },
  {
    on401: "silent",
  }
);

    toast.success("Login realizado com sucesso!");
    redirecionarPosLogin(response);
  } catch (error) {
    const serverMsg = getApiErrorMessage(
      error,
      "Não foi possível entrar. Verifique CPF e senha e tente novamente."
    );

    errorDev("falha no login por CPF", {
      message: serverMsg,
      status: error?.status || null,
    });

    setSenha("");
    setMostrarSenha(false);
    senhaRef.current?.focus();
    toast.error(serverMsg);
  } finally {
    if (mountedRef.current) {
      setLoading(false);
    }
  }
}

async function handleLoginGoogle(credentialResponse) {
  if (!credentialResponse?.credential) {
    toast.error("Credencial do Google ausente.");
    return;
  }

  if (loadingGoogle || loading || loadingSessionCheck) return;

  setLoadingGoogle(true);

  logDev("iniciando login com Google", {
    redirectPath,
    credencial_presente: true,
  });

  try {
    const response = await apiAuthGoogle(
  {
    credential: credentialResponse.credential,
  },
  {
    on401: "silent",
  }
);

    toast.success("Login com Google realizado com sucesso!");
    redirecionarPosLogin(response);
  } catch (error) {
    const serverMsg = getApiErrorMessage(
      error,
      "Não foi possível entrar com Google. Tente novamente ou use CPF e senha."
    );

    errorDev("falha no login com Google", {
      message: serverMsg,
      status: error?.status || null,
    });

    toast.error(serverMsg);
  } finally {
    if (mountedRef.current) {
      setLoadingGoogle(false);
    }
  }
}

  const abrirSite = useCallback(() => safeOpen(SITE_URL), []);
  const abrirInstagram = useCallback(() => safeOpen(INSTAGRAM_URL), []);

  const copiarSite = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SITE_URL);
      toast.success("Link da plataforma copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }, []);

  const compartilhar = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Escola da Saúde de Santos",
          text: "Acesse a plataforma oficial da Escola da Saúde.",
          url: SITE_URL,
        });
        return;
      }

      await navigator.clipboard.writeText(SITE_URL);
      toast.success("Link copiado para compartilhamento.");
    } catch {
      // cancelamento do compartilhamento não precisa gerar erro
    }
  }, []);

  const IdentIcon = cpf ? IdCard : User;

  return (
    <>
      <main
  className={cx(
    "relative min-h-screen overflow-hidden transition-colors",
    isDark
      ? "bg-[#030712] text-zinc-100"
      : "bg-[#f6f8fb] text-slate-900"
  )}
>
  {/* Glow superior */}
  <div
    aria-hidden="true"
    className={cx(
      "pointer-events-none absolute inset-0 overflow-hidden",
      isDark ? "opacity-100" : "opacity-70"
    )}
  >
    <div className="absolute left-[-10%] top-[-10%] h-[28rem] w-[28rem] rounded-full bg-emerald-500/15 blur-3xl" />

    <div className="absolute right-[-8%] top-[10%] h-[26rem] w-[26rem] rounded-full bg-cyan-500/10 blur-3xl" />

    <div className="absolute bottom-[-15%] left-[20%] h-[24rem] w-[24rem] rounded-full bg-sky-500/10 blur-3xl" />
  </div>

  {/* Grid texture */}
  <div
    aria-hidden="true"
    className={cx(
      "pointer-events-none absolute inset-0",
      isDark
        ? "bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)]"
        : "bg-[linear-gradient(rgba(15,23,42,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,.025)_1px,transparent_1px)]"
    )}
    style={{
      backgroundSize: "36px 36px",
    }}
  />
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow"
        >
          Pular para o conteúdo
        </a>

        <header className="relative px-4 pt-4 sm:px-6">
<div
  className={cx(
    "relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] border backdrop-blur-xl",
    "shadow-[0_30px_120px_-40px_rgba(15,23,42,.85)]",
    isDark
      ? "border-white/10 bg-white/[0.03]"
      : "border-white/70 bg-white/20"
  )}
>    
<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#10b981_0%,#0f766e_45%,#0369a1_100%)]" />
    <div
  aria-hidden="true"
  className="absolute inset-0 opacity-[0.08]"
  style={{
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'%3E%3Cg fill='white' fill-opacity='1'%3E%3Ccircle cx='1' cy='1' r='1'/%3E%3C/g%3E%3C/svg%3E\")",
  }}
/>

    <div
      className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/20 blur-3xl"
      aria-hidden="true"
    />
    <div
      className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/16 blur-3xl"
      aria-hidden="true"
    />

    <div className="relative px-5 py-7 text-center sm:px-8 md:py-8">
      <div className="flex flex-col items-center gap-4">
        <div className="inline-flex rounded-[1.75rem] bg-white p-3 shadow-xl ring-1 ring-white/80">
          <img
            src="/logo_escola.png"
            alt="Logotipo da Escola Municipal de Saúde Pública de Santos"
            className="h-16 w-16 object-contain sm:h-20 sm:w-20"
            loading="eager"
          />
        </div>

        <div className="inline-flex items-center gap-2 text-xs font-semibold text-white/90">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>Portal oficial • acesso seguro</span>
        </div>

        <h1 className="max-w-6xl whitespace-nowrap text-2xl font-black tracking-[-0.035em] text-white md:text-4xl">
          Escola Municipal de Saúde Pública de Santos
        </h1>

        <p className="max-w-3xl text-sm leading-relaxed text-white/90 md:text-base">
          Plataforma institucional para inscrições, presenças, avaliações,
          certificados e rotinas acadêmico-administrativas da Escola da Saúde.
        </p>
      </div>
    </div>

    <div className="h-px w-full bg-white/25" aria-hidden="true" />
  </div>
</header>

        <section
          id="conteudo"
          className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-12"
        >
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
            <aside className="space-y-6 xl:col-span-5">
              <InstitutionalCard
                icon={ShieldCheck}
                title="Acesso seguro"
                subtitle="Entre com CPF e senha"
                isDark={isDark}
                accent="emerald"
              >
                <p>
                  Use seu <strong>CPF</strong> e sua <strong>senha</strong> para
                  acessar o painel. Quando disponível, também é possível entrar
                  com sua conta Google vinculada.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <MiniStatLite
                    title="Sessão"
                    value="Token JWT"
                    isDark={isDark}
                    icon={ShieldCheck}
                  />
                  <MiniStatLite
                    title="Perfis"
                    value="Acesso por perfil"
                    isDark={isDark}
                    icon={Landmark}
                  />
                  <MiniStatLite
                    title="Mobile"
                    value="Responsivo"
                    isDark={isDark}
                    icon={Smartphone}
                  />
                  <MiniStatLite
                    title="Suporte"
                    value="Escola da Saúde"
                    isDark={isDark}
                    icon={HeartPulse}
                  />
                </div>

                <div className="space-y-2 pt-1 text-xs">
                  <p>• Não compartilhe sua senha.</p>
                  <p>• Use a recuperação caso tenha esquecido o acesso.</p>
                  <p>• O CPF pode ser digitado com ou sem pontuação.</p>
                </div>
              </InstitutionalCard>

              <InstitutionalCard
                icon={Building2}
                title="Escola da Saúde"
                subtitle="Educação permanente e articulação ensino-serviço"
                isDark={isDark}
                accent="emerald"
              >
                <p>
                  A <strong>Escola Municipal de Saúde Pública de Santos</strong>{" "}
                  apoia ações formativas, acompanhamento institucional,
                  articulação ensino-serviço e rotinas acadêmicas da rede.
                </p>

                <p>
                  A plataforma organiza os principais fluxos digitais em um
                  ambiente único, com mais clareza para usuários, equipes e
                  gestores.
                </p>
              </InstitutionalCard>

              <InstitutionalCard
                icon={BookOpenCheck}
                title="O que você encontra"
                subtitle="Ambiente digital oficial"
                isDark={isDark}
                accent="sky"
              >
                <p>
                  Acesse inscrições, presenças, avaliações, certificados,
                  submissões, chamadas e demais funcionalidades conforme seu
                  perfil de acesso.
                </p>

                <p>
                  O objetivo é reduzir retrabalho, melhorar rastreabilidade e
                  facilitar a experiência do usuário.
                </p>
              </InstitutionalCard>
            </aside>

            <div className="space-y-6 xl:col-span-7">
              <div
                className={cx(
                  "rounded-3xl border p-6 transition-colors md:p-8",
                  isDark
                    ? "border-white/10 bg-white/[0.04] shadow-[0_20px_80px_-40px_rgba(0,0,0,.85)] backdrop-blur-xl"
                    : "border-white/80 bg-white/85 shadow-[0_20px_60px_-30px_rgba(15,23,42,.18)] backdrop-blur-xl"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cx(
                        "flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border",
                        isDark
                          ? "border-white/10 bg-emerald-500/10"
                          : "border-emerald-100 bg-emerald-50"
                      )}
                      aria-hidden="true"
                    >
                      <img
                        src="/logo_escola.png"
                        alt=""
                        className="h-10 w-10 object-contain"
                        loading="lazy"
                      />
                    </div>

                    <div className="min-w-0">
                      <h2 className="text-lg font-extrabold md:text-xl">
                        Acesse sua conta
                      </h2>
                      <p
                        className={cx(
                          "text-xs",
                          isDark ? "text-zinc-300" : "text-slate-500"
                        )}
                      >
                        CPF + senha, com validação segura da sessão.
                      </p>
                    </div>
                  </div>

                  <span
                    className={cx(
                      "hidden items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold sm:inline-flex",
                      isDark
                        ? "border-white/10 bg-zinc-950/40 text-zinc-200"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                    )}
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Ambiente autenticado
                  </span>
                </div>

                {loadingSessionCheck ? (
                  <SessionCheckBanner isDark={isDark} />
                ) : (
                  <form
                    onSubmit={handleLogin}
                    className="mt-6 space-y-4"
                    aria-label="Formulário de Login"
                    aria-busy={loading || loadingGoogle ? "true" : "false"}
                    noValidate
                  >
                    <div>
                      <label htmlFor="cpf" className="block text-sm font-semibold">
                        CPF
                      </label>

                      <div className="relative mt-2">
                        <span
                          className={cx(
                            "absolute left-3 top-1/2 -translate-y-1/2",
                            isDark ? "text-zinc-300" : "text-slate-500"
                          )}
                        >
                          <IdentIcon className="h-5 w-5" aria-hidden="true" />
                        </span>

                        <input
                          id="cpf"
                          name="cpf"
                          ref={cpfRef}
                          type="text"
                          value={cpf}
                          onChange={(event) => {
                            setCpf(aplicarMascaraCPF(event.target.value));
                            if (erroCpf) setErroCpf("");
                          }}
                          onPaste={(event) => {
                            event.preventDefault();
                            const text = event.clipboardData.getData("text") || "";
                            setCpf(aplicarMascaraCPF(text));
                            if (erroCpf) setErroCpf("");
                          }}
                          onBlur={() => {
                            if (cpf && !validarCPF(cpf)) {
                              setErroCpf("CPF inválido.");
                            }
                          }}
                          placeholder="000.000.000-00"
                          maxLength={14}
                          autoFocus
                          autoComplete="username"
                          inputMode="numeric"
                          disabled={loading || loadingGoogle}
                          className={cx(
                            inputBaseClass,
                            "pl-11 pr-4",
                            erroCpf
                              ? "border-red-500/60 ring-2 ring-red-500/60"
                              : ""
                          )}
                          aria-invalid={!!erroCpf}
                          aria-describedby={erroCpf ? "erro-cpf" : "dica-cpf"}
                        />
                      </div>

                      <div className="min-h-[1rem]" aria-live="polite">
                        {erroCpf ? (
                          <p
                            id="erro-cpf"
                            className="mt-1 text-xs text-red-500 dark:text-red-300"
                            role="alert"
                          >
                            {erroCpf}
                          </p>
                        ) : (
                          <p
                            id="dica-cpf"
                            className={cx(
                              "mt-2 text-xs",
                              isDark ? "text-zinc-400" : "text-slate-500"
                            )}
                          >
                            Você pode colar o CPF com ou sem pontuação.
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="senha" className="block text-sm font-semibold">
                        Senha
                      </label>

                      <div className="relative mt-2">
                        <span
                          className={cx(
                            "absolute left-3 top-1/2 -translate-y-1/2",
                            isDark ? "text-zinc-300" : "text-slate-500"
                          )}
                        >
                          <Lock className="h-5 w-5" aria-hidden="true" />
                        </span>

                        <input
                          id="senha"
                          name="senha"
                          ref={senhaRef}
                          type={mostrarSenha ? "text" : "password"}
                          value={senha}
                          onChange={(event) => {
                            setSenha(event.target.value);
                            if (erroSenha) setErroSenha("");
                          }}
                          onKeyUp={(event) =>
                            setCapsLockOn(event.getModifierState?.("CapsLock"))
                          }
                          onKeyDown={(event) =>
                            setCapsLockOn(event.getModifierState?.("CapsLock"))
                          }
                          placeholder="Digite sua senha"
                          autoComplete="current-password"
                          disabled={loading || loadingGoogle}
                          className={cx(
                            inputBaseClass,
                            "pl-11 pr-12",
                            erroSenha
                              ? "border-red-500/60 ring-2 ring-red-500/60"
                              : ""
                          )}
                          aria-invalid={!!erroSenha}
                          aria-describedby={
                            erroSenha || capsLockOn ? "senha-feedback" : undefined
                          }
                        />

                        <button
                          type="button"
                          onClick={() => setMostrarSenha((prev) => !prev)}
                          className={cx(
                            "absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-2.5 py-2",
                            "focus:outline-none focus:ring-2 focus:ring-emerald-500/70",
                            isDark
                              ? "text-zinc-300 hover:bg-white/10"
                              : "text-slate-600 hover:bg-slate-100"
                          )}
                          aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                          title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                          disabled={loading || loadingGoogle}
                        >
                          {mostrarSenha ? (
                            <EyeOff className="h-5 w-5" aria-hidden="true" />
                          ) : (
                            <Eye className="h-5 w-5" aria-hidden="true" />
                          )}
                        </button>
                      </div>

                      <div
                        id="senha-feedback"
                        className="min-h-[1.25rem]"
                        aria-live="polite"
                      >
                        {erroSenha ? (
                          <p
                            className="mt-1 text-xs text-red-500 dark:text-red-300"
                            role="alert"
                          >
                            {erroSenha}
                          </p>
                        ) : null}

                        {capsLockOn && !erroSenha ? (
                          <p
                            className={cx(
                              "mt-1 flex items-center gap-1 text-[11px]",
                              isDark ? "text-amber-300" : "text-amber-700"
                            )}
                            role="status"
                          >
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            Atenção: Caps Lock está ativado.
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-2 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                        <button
                          type="button"
                          onClick={() => navigate("/esqueci-senha")}
                          className={cx(
                            "inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 font-semibold hover:underline sm:w-auto",
                            "focus:outline-none focus:ring-2 focus:ring-emerald-500/70",
                            isDark
                              ? "text-sky-300 hover:bg-white/5"
                              : "text-sky-700"
                          )}
                        >
                          <KeyRound className="h-4 w-4" aria-hidden="true" />
                          Esqueci minha senha
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate("/cadastro")}
                          className={cx(
                            "w-full rounded-xl px-3 py-2 font-extrabold hover:underline sm:w-auto",
                            "focus:outline-none focus:ring-2 focus:ring-emerald-500/70",
                            isDark
                              ? "text-emerald-300 hover:bg-white/5"
                              : "text-emerald-700"
                          )}
                        >
                          Criar cadastro
                        </button>
                      </div>
                    </div>

                    <BotaoLocal
                      type="submit"
                      className="w-full"
                      aria-label="Entrar na plataforma"
                      disabled={loading || loadingGoogle}
                      loading={loading}
                      leftIcon={<LogIn size={16} aria-hidden="true" />}
                    >
                      {loading ? "Entrando..." : "Entrar"}
                    </BotaoLocal>

                    <div className="pt-2">
                      <div
                        className={cx(
                          "text-center text-xs font-bold",
                          isDark ? "text-zinc-300" : "text-slate-600"
                        )}
                      >
                        ou
                      </div>

                      <div className="mt-3 flex justify-center">
                        {loadingGoogle ? (
                          <SkeletonLoginGoogle mensagem="Fazendo login com Google..." />
                        ) : hasGoogleClient ? (
                          <div className="flex w-full max-w-xs justify-center scale-90">
                            <GoogleLogin
                              onSuccess={handleLoginGoogle}
                              onError={() => toast.error("Erro no login com Google.")}
                              theme={isDark ? "filled_black" : "outline"}
                              size="large"
                              shape="rectangular"
                              text="signin_with"
                              locale="pt-BR"
                              useOneTap={false}
                            />
                          </div>
                        ) : (
                          <small
                            className={cx(
                              "block text-center",
                              isDark ? "text-zinc-400" : "text-slate-500"
                            )}
                          >
                            Login com Google indisponível no momento.
                          </small>
                        )}
                      </div>

                      {redirectPath ? (
                        <p
                          className={cx(
                            "mt-3 text-center text-[11px]",
                            isDark ? "text-zinc-400" : "text-slate-500"
                          )}
                        >
                          Após o login, você será levado para:{" "}
                          <span className="font-semibold">{redirectPath}</span>
                        </p>
                      ) : null}
                    </div>

                    <p
                      className={cx(
                        "pt-2 text-center text-[11px]",
                        isDark ? "text-zinc-400" : "text-slate-500"
                      )}
                    >
                      Ao continuar, você concorda com o uso dos seus dados para
                      fins de controle de eventos, presença, avaliação e
                      certificação.
                    </p>

                    <div className="sr-only" aria-live="polite">
                      {loading ? "Processando login" : ""}
                    </div>
                  </form>
                )}
              </div>

              <section aria-label="Links oficiais">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2
                      className={cx(
                        "text-xl font-extrabold",
                        isDark ? "text-zinc-100" : "text-slate-900"
                      )}
                    >
                      Links oficiais
                    </h2>
                    <p
                      className={cx(
                        "mt-1 text-sm",
                        isDark ? "text-zinc-400" : "text-slate-600"
                      )}
                    >
                      Acesse a plataforma e o Instagram oficial da Escola da
                      Saúde.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <ActionBtn onClick={abrirSite} icon={ExternalLink} isDark={isDark}>
                      Abrir plataforma
                    </ActionBtn>
                    <ActionBtn onClick={copiarSite} icon={Copy} isDark={isDark}>
                      Copiar link
                    </ActionBtn>
                    <ActionBtn
                      onClick={abrirInstagram}
                      icon={Instagram}
                      isDark={isDark}
                    >
                      Instagram
                    </ActionBtn>
                    <ActionBtn onClick={compartilhar} icon={Share2} isDark={isDark}>
                      Compartilhar
                    </ActionBtn>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <QrCard
                    title="Plataforma da Escola"
                    subtitle="escoladasaude.vercel.app"
                    icon={QrCode}
                    url={SITE_URL}
                    qrSize={qrSize}
                    isDark={isDark}
                    accent="emerald"
                  />
                  <QrCard
                    title="Instagram oficial"
                    subtitle="@escoladasaudesms"
                    icon={Instagram}
                    url={INSTAGRAM_URL}
                    qrSize={qrSize}
                    isDark={isDark}
                    accent="pink"
                  />
                </div>
              </section>
            </div>
          </div>

          <section
            className="mt-10 space-y-6"
            aria-label="Informações públicas da plataforma"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2
                  className={cx(
                    "text-2xl font-extrabold tracking-tight",
                    isDark ? "text-zinc-100" : "text-slate-900"
                  )}
                >
                  Informações úteis
                </h2>
                <p
                  className={cx(
                    "mt-1 text-sm",
                    isDark ? "text-zinc-400" : "text-slate-600"
                  )}
                >
                  Entenda a finalidade da plataforma e como instalá-la como
                  aplicativo.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <Info className="h-4 w-4" aria-hidden="true" />
                Conteúdo público e institucional
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <InstitutionalCard
                icon={ClipboardCheck}
                title="Benefícios para o usuário"
                subtitle="Mais clareza, autonomia e agilidade"
                isDark={isDark}
                accent="amber"
              >
                <p>
                  A centralização das informações facilita o acompanhamento de
                  inscrições, pendências, presenças e certificados.
                </p>

                <div className="grid grid-cols-1 gap-2 pt-1">
                  <FeaturePill isDark={isDark}>
                    ✔ Mais autonomia no acompanhamento
                  </FeaturePill>
                  <FeaturePill isDark={isDark}>
                    ✔ Menos retrabalho e mais organização
                  </FeaturePill>
                  <FeaturePill isDark={isDark}>
                    ✔ Acesso rápido a documentos e rotinas
                  </FeaturePill>
                </div>
              </InstitutionalCard>

              <InstitutionalCard
                icon={FileText}
                title="Finalidade institucional"
                subtitle="Plataforma oficial da Escola da Saúde"
                isDark={isDark}
                accent="violet"
              >
                <p>
                  A plataforma reúne em um único ambiente digital fluxos
                  acadêmicos e administrativos da Escola da Saúde.
                </p>

                <p>
                  Isso fortalece a comunicação com os usuários e melhora a
                  eficiência no acompanhamento das ações formativas.
                </p>
              </InstitutionalCard>

              <InstitutionalCard
                icon={MonitorSmartphone}
                title="Instale como aplicativo"
                subtitle="Mais rápido, prático e fácil de acessar"
                isDark={isDark}
                accent="emerald"
              >
                <p>
                  Em dispositivos compatíveis, a plataforma pode ser instalada
                  como aplicativo, sem necessidade de loja.
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <FeaturePill isDark={isDark}>⚡ Acesso rápido</FeaturePill>
                  <FeaturePill isDark={isDark}>📲 Tela cheia</FeaturePill>
                  <FeaturePill isDark={isDark}>🚀 Mais fluidez</FeaturePill>
                  <FeaturePill isDark={isDark}>🔔 Notificações</FeaturePill>
                </div>
              </InstitutionalCard>
            </div>

            <InstitutionalCard
              icon={Smartphone}
              title="Como instalar a plataforma como aplicativo"
              subtitle="Passo a passo para celular, tablet e computador"
              isDark={isDark}
              accent="rose"
            >
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 font-extrabold">
                    <span>🍎</span>
                    <span>iPhone / iPad</span>
                  </div>
                  <ul className="ml-5 list-disc space-y-1 text-sm">
                    <li>
                      Acesse <strong>{SITE_URL}</strong> no Safari.
                    </li>
                    <li>
                      Toque em <strong>Compartilhar</strong>.
                    </li>
                    <li>
                      Selecione <strong>Adicionar à Tela de Início</strong>.
                    </li>
                    <li>
                      Confirme em <strong>Adicionar</strong>.
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 font-extrabold">
                    <span>📱</span>
                    <span>Android</span>
                  </div>
                  <ul className="ml-5 list-disc space-y-1 text-sm">
                    <li>
                      Acesse <strong>{SITE_URL}</strong> no Chrome.
                    </li>
                    <li>
                      Toque no menu <strong>⋮</strong>.
                    </li>
                    <li>
                      Escolha <strong>Instalar app</strong> ou{" "}
                      <strong>Adicionar à tela inicial</strong>.
                    </li>
                    <li>
                      Confirme em <strong>Instalar</strong>.
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 font-extrabold">
                    <span>💻</span>
                    <span>Computador</span>
                  </div>
                  <ul className="ml-5 list-disc space-y-1 text-sm">
                    <li>
                      Acesse <strong>{SITE_URL}</strong> no Chrome ou Edge.
                    </li>
                    <li>
                      Clique no ícone <strong>Instalar</strong> na barra de
                      endereço.
                    </li>
                    <li>
                      Confirme em <strong>Instalar</strong>.
                    </li>
                    <li>Abra a plataforma em janela própria.</li>
                  </ul>
                </div>
              </div>

              <div
                className={cx(
                  "mt-6 rounded-2xl border p-4",
                  isDark
                    ? "border-white/10 bg-zinc-950/35"
                    : "border-slate-200 bg-slate-50"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cx(
                      "rounded-xl p-2",
                      isDark
                        ? "bg-white/5 text-zinc-100"
                        : "bg-white text-slate-700"
                    )}
                  >
                    <BadgeCheck className="h-5 w-5" aria-hidden="true" />
                  </div>

                  <div className="space-y-2 text-sm">
                    <p className="font-extrabold">
                      Como saber se instalou corretamente?
                    </p>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <FeaturePill isDark={isDark}>
                        ✔ O ícone aparece na tela inicial
                      </FeaturePill>
                      <FeaturePill isDark={isDark}>
                        ✔ A plataforma abre em janela própria
                      </FeaturePill>
                      <FeaturePill isDark={isDark}>
                        ✔ A navegação fica mais direta
                      </FeaturePill>
                      <FeaturePill isDark={isDark}>
                        ✔ O acesso fica mais prático
                      </FeaturePill>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <div
                    className={cx(
                      "inline-flex items-center gap-2 rounded-2xl px-3 py-2 font-bold",
                      isDark
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-emerald-50 text-emerald-700"
                    )}
                  >
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    Android: ⋮ → Instalar app
                  </div>

                  <div
                    className={cx(
                      "inline-flex items-center gap-2 rounded-2xl px-3 py-2 font-bold",
                      isDark
                        ? "bg-sky-500/10 text-sky-300"
                        : "bg-sky-50 text-sky-700"
                    )}
                  >
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    iPhone: Compartilhar → Tela de Início
                  </div>
                </div>
              </div>
            </InstitutionalCard>
          </section>
        </section>
      </main>

      <Footer />
    </>
  );
}