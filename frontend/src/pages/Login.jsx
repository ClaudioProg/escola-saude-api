// ✅ src/pages/Login.jsx
// premium + institucional + QR públicos + PWA + mobile-first + dark/light/system + a11y
// + login robusto + diagnóstico + redirect pós-login validado
// + premiumrização estrutural, segurança e UX refinada

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { toast } from "react-toastify";
import {
  LogIn,
  Eye,
  EyeOff,
  User,
  Lock,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  IdCard,
  QrCode,
  ExternalLink,
  Copy,
  Instagram,
  Share2,
  Building2,
  BookOpenCheck,
  FileText,
  ClipboardCheck,
  Smartphone,
  HeartPulse,
  Landmark,
  Info,
  MonitorSmartphone,
  BadgeCheck,
  ArrowRight,
  Loader2,
  KeyRound,
} from "lucide-react";

import BotaoPrimario from "../components/BotaoPrimario";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import Footer from "../components/Footer";
import QrSiteEscola from "../components/QrSiteEscola";
import api, { apiPost } from "../services/api";

import useEscolaTheme from "../hooks/useEscolaTheme";
import ThemeTogglePills from "../components/ThemeTogglePills";

/* ---------------------- constants ---------------------- */
const SITE_URL = "https://escoladasaude.vercel.app";
const INSTAGRAM_URL =
  "https://www.instagram.com/escoladasaudesms?igsh=Zzd5M3MyazZ0aXRm&utm_source=qr";

const IS_DEV =
  typeof import.meta !== "undefined" &&
  Boolean(import.meta.env?.DEV);

/* ---------------------- utils/logs ---------------------- */
function logDev(...args) {
  if (IS_DEV) console.log("[Login]", ...args);
}

function errorDev(...args) {
  if (IS_DEV) console.error("[Login]", ...args);
}

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function getStoredToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("access_token") ||
    null
  );
}

function sanitizeRedirectPath(raw) {
  const value = String(raw || "").trim();

  if (!value) return "/painel";
  if (!value.startsWith("/")) return "/painel";
  if (value.startsWith("//")) return "/painel";

  const blockedPrefixes = [
    "/login",
    "/cadastro",
    "/recuperar-senha",
    "/esqueci-senha",
    "/redefinir-senha",
  ];

  if (blockedPrefixes.some((prefix) => value.startsWith(prefix))) {
    return "/painel";
  }

  return value;
}

/* ---------------------- utils CPF ---------------------- */
function aplicarMascaraCPF(valor) {
  return String(valor || "")
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function apenasDigitos(c) {
  return String(c || "").replace(/\D/g, "");
}

function cpfChecksumValido(cpf) {
  const s = apenasDigitos(cpf);
  if (s.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(s)) return false;

  const calc = (arr, len) => {
    let soma = 0;
    for (let i = 0; i < len - 1; i += 1) {
      soma += parseInt(arr[i], 10) * (len - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const d1 = calc(s, 10);
  const d2 = calc(s, 11);
  return d1 === parseInt(s[9], 10) && d2 === parseInt(s[10], 10);
}

function validarCPF(c) {
  const digits = apenasDigitos(c);
  if (digits.length !== 11) return false;
  return cpfChecksumValido(digits);
}

function maskOkOuFormatar(value) {
  const digits = apenasDigitos(value);
  return aplicarMascaraCPF(digits);
}

function safeOpen(url) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function useQrSize() {
  const [size, setSize] = useState(() => {
    if (typeof window === "undefined") return 240;
    const w = window.innerWidth;
    if (w < 360) return 210;
    if (w < 768) return 220;
    return 240;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onResize = () => {
      const w = window.innerWidth;
      const next = w < 360 ? 210 : w < 768 ? 220 : 240;
      setSize(next);
    };

    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}

/* ---------------------- ui blocks ---------------------- */
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
              isDark ? "bg-white/5 text-zinc-200" : "bg-slate-100 text-slate-700"
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
          ? "border-white/10 bg-zinc-900/55"
          : "border-slate-200 bg-white shadow-sm"
      )}
    >
      <div
        className={`h-1.5 w-full rounded-t-3xl bg-gradient-to-r ${
          accentMap[accent] || accentMap.emerald
        }`}
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

function QrCard({ title, subtitle, icon: Icon, url, qrSize, isDark, accent = "emerald" }) {
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
        className={`h-1.5 w-full rounded-full bg-gradient-to-r ${
          bar[accent] || bar.emerald
        }`}
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
              "mt-1 text-[12px] break-words",
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
        "inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-extrabold transition",
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

function SessionCheckBanner({ isDark }) {
  return (
    <div
      className={cx(
        "mt-6 rounded-2xl border p-4",
        isDark
          ? "border-emerald-500/20 bg-emerald-500/10"
          : "border-emerald-200/40 bg-emerald-500/5"
      )}
    >
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-600 dark:text-emerald-300" />
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
      const sp = new URLSearchParams(location.search);
      const raw = sp.get("next") || sp.get("redirect") || "";
      return sanitizeRedirectPath(raw);
    } catch {
      return "/painel";
    }
  }, [location.search]);

  const inputBaseClass = useMemo(
    () =>
      cx(
        "w-full rounded-2xl border py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/70",
        isDark
          ? "border-white/10 bg-zinc-950/30 text-zinc-100 placeholder:text-zinc-500"
          : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
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
      const token = getStoredToken();

      if (!token) {
        logDev("sem token salvo, permanece na tela de login");
        if (!cancelled && mountedRef.current) {
          setLoadingSessionCheck(false);
        }
        return;
      }

      logDev("token encontrado no login, validando sessão antes de redirecionar", {
        pathname: location.pathname,
        redirectPath,
      });

      try {
        const data = await api.authMe({
          auth: true,
          on401: "silent",
          on403: "silent",
        });

        const usuarioRecebido = data?.usuario || data?.user || null;

        if (!usuarioRecebido) {
          throw new Error("Sessão inválida: payload sem usuário.");
        }

        if (!cancelled && mountedRef.current) {
          logDev("sessão válida no login, redirecionando", {
            redirectPath,
            perfil: usuarioRecebido?.perfil,
          });

          navigate(redirectPath || "/painel", { replace: true });
          return;
        }
      } catch (error) {
        errorDev("sessão salva inválida no login", {
          message: error?.message,
          status: error?.status || error?.response?.status || null,
        });

        try {
          api.clearSession?.();
        } catch {
          localStorage.removeItem("token");
          localStorage.removeItem("authToken");
          localStorage.removeItem("access_token");
          localStorage.removeItem("usuario");
          localStorage.removeItem("user");
        }
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
    const onKey = (e) => {
      const active = document.activeElement;
      const tag = active?.tagName?.toLowerCase();

      if (tag === "input" || tag === "textarea" || active?.isContentEditable) {
        return;
      }

      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        cpfRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const persistirSessao = useCallback((payload) => {
    const { token, usuario } = payload || {};

    if (!token || !usuario) {
      throw new Error("Resposta de login inválida.");
    }

    api.persistSession(token, usuario);

    window.dispatchEvent(
      new CustomEvent("auth:changed", {
        detail: {
          authenticated: true,
          usuario,
        },
      })
    );

    logDev("sessão persistida com sucesso", {
      usuarioId: usuario?.id || usuario?.usuario_id || null,
      perfil: usuario?.perfil || null,
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

  async function handleLogin(e) {
    e.preventDefault();
    if (loading || loadingGoogle || loadingSessionCheck) return;
    if (!validarFormulario()) return;

    setLoading(true);

    logDev("iniciando login por CPF", {
      cpfLength: apenasDigitos(cpf).length,
      redirectPath,
    });

    try {
      const payload = await apiPost(
        "/login",
        { cpf: apenasDigitos(cpf), senha },
        { auth: false, on401: "silent" }
      );

      toast.success("✅ Login realizado com sucesso!");
      redirecionarPosLogin(payload);
    } catch (err) {
      const serverMsg =
        err?.data?.erro || err?.data?.message || err?.message || "Erro ao fazer login.";

      errorDev("falha no login por CPF", {
        message: serverMsg,
        status: err?.status || err?.response?.status || null,
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
      credentialPresent: true,
    });

    try {
      const payload = await apiPost(
        "/auth/google",
        { credential: credentialResponse.credential },
        { auth: false, on401: "silent" }
      );

      toast.success("✅ Login com Google realizado com sucesso!");
      redirecionarPosLogin(payload);
    } catch (err) {
      const serverMsg =
        err?.data?.erro ||
        err?.data?.message ||
        err?.message ||
        "Erro ao fazer login com Google.";

      errorDev("falha no login com Google", {
        message: serverMsg,
        status: err?.status || err?.response?.status || null,
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
      toast.success("🔗 Link da plataforma copiado!");
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
      } else {
        await navigator.clipboard.writeText(SITE_URL);
        toast.success("📎 Link copiado para compartilhamento.");
      }
    } catch {
      // noop
    }
  }, []);

  const IdentIcon = cpf ? IdCard : User;

  return (
    <>
      <main
        className={cx(
          "min-h-screen transition-colors",
          isDark
            ? "bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100"
            : "bg-slate-50 text-slate-900"
        )}
      >
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow"
        >
          Pular para o conteúdo
        </a>

        <header className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-teal-600 to-sky-700" />
          {isDark && <div className="absolute inset-0 bg-black/35" />}

          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/25 blur-3xl" />
          <div className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/20 blur-3xl" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-12">
            <div className="flex justify-end">
              <ThemeTogglePills variant="glass" />
            </div>

            <div className="mt-5 flex flex-col items-center text-center gap-3">
              <div className="inline-flex items-center gap-2 text-white/90 text-xs font-semibold">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>Portal oficial • acesso público e autenticado</span>
              </div>

              <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight max-w-4xl">
                Escola Municipal de Saúde Pública de Santos
              </h1>

              <p className="text-sm md:text-base text-white/90 max-w-3xl leading-relaxed">
                Plataforma institucional criada em <strong>setembro de 2025</strong> para
                apoiar ações formativas, acadêmicas e administrativas da Escola da Saúde.
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 max-w-3xl">
                <FeaturePill isDark={false}>Inscrições e eventos</FeaturePill>
                <FeaturePill isDark={false}>Presenças</FeaturePill>
                <FeaturePill isDark={false}>Avaliações</FeaturePill>
                <FeaturePill isDark={false}>Certificados</FeaturePill>
                <FeaturePill isDark={false}>Submissões e chamadas</FeaturePill>
              </div>

              <div className="mt-2 sm:hidden">
                <div className="rounded-3xl bg-white/20 backdrop-blur p-4 ring-1 ring-white/25 shadow-lg inline-flex">
                  <img
                    src="/logo_escola.png"
                    alt="Logotipo da Escola Municipal de Saúde Pública de Santos"
                    className="h-16 w-16 object-contain"
                    loading="lazy"
                  />
                </div>
              </div>

              <p className="text-[11px] text-white/80">
                Dica: pressione <strong>/</strong> para focar o CPF.
              </p>
            </div>

            <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 hidden sm:flex">
              <div className="rounded-3xl bg-white/25 backdrop-blur p-5 ring-1 ring-white/30 shadow-lg">
                <img
                  src="/logo_escola.png"
                  alt="Logotipo da Escola Municipal de Saúde Pública de Santos"
                  className="h-20 w-20 md:h-24 md:w-24 object-contain"
                  loading="lazy"
                />
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-white/25" aria-hidden="true" />
        </header>

        <section id="conteudo" className="mx-auto max-w-7xl px-4 sm:px-6 py-8 md:py-12">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <aside className="xl:col-span-5 space-y-6">
              <InstitutionalCard
                icon={ShieldCheck}
                title="Acesso seguro"
                subtitle="Autenticação institucional da plataforma"
                isDark={isDark}
                accent="emerald"
              >
                <p>
                  Entre com <strong>CPF e senha</strong> ou utilize o{" "}
                  <strong>login com Google</strong> quando disponível.
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
                    value="RBAC"
                    isDark={isDark}
                    icon={Landmark}
                  />
                  <MiniStatLite
                    title="Mobile"
                    value="PWA Ready"
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

                <div className="pt-1 text-xs space-y-2">
                  <p>• Navegação por teclado e alto contraste.</p>
                  <p>• Não compartilhe sua senha com terceiros.</p>
                  <p>• Use o link de recuperação caso não lembre sua senha.</p>
                </div>
              </InstitutionalCard>

              <InstitutionalCard
                icon={Building2}
                title="O que é a Escola da Saúde?"
                subtitle="Educação permanente e articulação ensino-serviço"
                isDark={isDark}
                accent="emerald"
              >
                <p>
                  A <strong>Escola Municipal de Saúde Pública de Santos</strong> atua no
                  fortalecimento da qualificação dos trabalhadores da saúde e na organização
                  de estratégias de aprendizagem voltadas ao SUS.
                </p>

                <p>
                  Entre suas finalidades estão a condução e o apoio à{" "}
                  <strong>Educação Permanente em Saúde</strong>, a articulação dos{" "}
                  <strong>estágios das instituições de ensino nas unidades de saúde</strong>{" "}
                  por meio do <strong>COAPES</strong>, o acompanhamento dos{" "}
                  <strong>Programas de Residência</strong> e o suporte às ações relacionadas
                  ao <strong>Comitê de Ética em Pesquisa</strong>.
                </p>
              </InstitutionalCard>

              <InstitutionalCard
                icon={BookOpenCheck}
                title="O que você encontra na plataforma?"
                subtitle="Ambiente digital oficial da Escola da Saúde"
                isDark={isDark}
                accent="sky"
              >
                <p>
                  Em um único ambiente, é possível realizar{" "}
                  <strong>inscrições em cursos e eventos</strong>, acompanhar{" "}
                  <strong>presenças</strong>, responder <strong>avaliações</strong>, emitir e
                  baixar <strong>certificados</strong> e acessar outros módulos institucionais.
                </p>

                <p>
                  A disponibilidade de funcionalidades pode variar conforme o{" "}
                  <strong>perfil de acesso</strong>, incluindo rotinas ligadas a{" "}
                  <strong>submissões, chamadas, votações e acompanhamento institucional</strong>.
                </p>
              </InstitutionalCard>
            </aside>

            <div className="xl:col-span-7 space-y-6">
              <div
                className={cx(
                  "rounded-3xl border p-6 transition-colors md:p-8",
                  isDark
                    ? "border-white/10 bg-zinc-900/50 shadow-none"
                    : "border-slate-200 bg-white shadow-xl"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cx(
                        "h-12 w-12 rounded-2xl flex items-center justify-center border overflow-hidden",
                        isDark
                          ? "bg-emerald-500/10 border-white/10"
                          : "bg-emerald-50 border-emerald-100"
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
                      <h2 className="text-lg md:text-xl font-extrabold">
                        Acesse sua conta
                      </h2>
                      <p
                        className={cx(
                          "text-xs",
                          isDark ? "text-zinc-300" : "text-slate-500"
                        )}
                      >
                        CPF + senha ou Google, com acesso rápido ao seu painel.
                      </p>
                    </div>
                  </div>

                  <span
                    className={cx(
                      "hidden sm:inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold",
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
                  >
                    <div>
                      <label htmlFor="cpf" className="block text-sm font-semibold">
                        CPF
                      </label>

                      <div className="mt-2 relative">
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
                          onChange={(e) => {
                            setCpf(maskOkOuFormatar(e.target.value));
                            if (erroCpf) setErroCpf("");
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            const text = (e.clipboardData.getData("text") || "").trim();
                            setCpf(maskOkOuFormatar(text));
                            if (erroCpf) setErroCpf("");
                          }}
                          onBlur={() => {
                            if (cpf && !validarCPF(cpf)) setErroCpf("CPF inválido.");
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
                            erroCpf ? "ring-2 ring-red-500/60 border-red-500/60" : ""
                          )}
                          aria-invalid={!!erroCpf}
                          aria-describedby={erroCpf ? "erro-cpf" : "dica-cpf"}
                        />
                      </div>

                      <div className="min-h-[1rem]" aria-live="polite">
                        {erroCpf ? (
                          <p
                            id="erro-cpf"
                            className="text-red-500 dark:text-red-300 text-xs mt-1"
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

                      <div className="mt-2 relative">
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
                          onChange={(e) => {
                            setSenha(e.target.value);
                            if (erroSenha) setErroSenha("");
                          }}
                          onKeyUp={(e) => setCapsLockOn(e.getModifierState?.("CapsLock"))}
                          onKeyDown={(e) => setCapsLockOn(e.getModifierState?.("CapsLock"))}
                          placeholder="Digite sua senha"
                          autoComplete="current-password"
                          disabled={loading || loadingGoogle}
                          className={cx(
                            inputBaseClass,
                            "pl-11 pr-12",
                            erroSenha ? "ring-2 ring-red-500/60 border-red-500/60" : ""
                          )}
                          aria-invalid={!!erroSenha}
                          aria-describedby={(erroSenha || capsLockOn) ? "senha-feedback" : undefined}
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

                      <div id="senha-feedback" className="min-h-[1.25rem]" aria-live="polite">
                        {erroSenha ? (
                          <p className="text-red-500 dark:text-red-300 text-xs mt-1" role="alert">
                            {erroSenha}
                          </p>
                        ) : null}

                        {capsLockOn && !erroSenha ? (
                          <p
                            className={cx(
                              "mt-1 text-[11px] flex items-center gap-1",
                              isDark ? "text-amber-300" : "text-amber-700"
                            )}
                            role="status"
                          >
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            Atenção: Caps Lock está ativado.
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => navigate("/recuperar-senha")}
                          className={cx(
                            "w-full sm:w-auto font-semibold hover:underline rounded-xl px-3 py-2 inline-flex items-center justify-center gap-2",
                            "focus:outline-none focus:ring-2 focus:ring-emerald-500/70",
                            isDark ? "text-sky-300 hover:bg-white/5" : "text-sky-700"
                          )}
                        >
                          <KeyRound className="h-4 w-4" />
                          Esqueci minha senha
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate("/cadastro")}
                          className={cx(
                            "w-full sm:w-auto font-extrabold hover:underline rounded-xl px-3 py-2",
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

                    <BotaoPrimario
                      type="submit"
                      className="w-full flex justify-center items-center gap-2"
                      aria-label="Entrar na plataforma"
                      disabled={loading || loadingGoogle}
                      loading={loading}
                      cor="amareloOuro"
                      leftIcon={<LogIn size={16} />}
                    >
                      {loading ? "Entrando..." : "Entrar"}
                    </BotaoPrimario>

                    <div className="pt-2">
                      <div
                        className={cx(
                          "text-center text-xs font-bold",
                          isDark ? "text-zinc-300" : "text-slate-600"
                        )}
                      >
                        ou
                      </div>

                      <div className="flex justify-center mt-3">
                        {loadingGoogle ? (
                          <CarregandoSkeleton mensagem="Fazendo login com Google..." />
                        ) : hasGoogleClient ? (
                          <div className="scale-90 max-w-xs w-full flex justify-center">
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
                              "text-center block",
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
                            "mt-3 text-[11px] text-center",
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
                        "pt-2 text-[11px] text-center",
                        isDark ? "text-zinc-400" : "text-slate-500"
                      )}
                    >
                      Ao continuar, você concorda com o uso dos seus dados para fins de
                      controle de eventos, presença e certificação, conforme diretrizes
                      institucionais.
                    </p>

                    <div className="sr-only" aria-live="polite">
                      {loading ? "Processando login" : ""}
                    </div>
                  </form>
                )}
              </div>

              <section aria-label="Links oficiais">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
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
                      Acesse a plataforma e o Instagram oficial da Escola da Saúde.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <ActionBtn onClick={abrirSite} icon={ExternalLink} isDark={isDark}>
                      Abrir plataforma
                    </ActionBtn>
                    <ActionBtn onClick={copiarSite} icon={Copy} isDark={isDark}>
                      Copiar link
                    </ActionBtn>
                    <ActionBtn onClick={abrirInstagram} icon={Instagram} isDark={isDark}>
                      Instagram
                    </ActionBtn>
                    <ActionBtn onClick={compartilhar} icon={Share2} isDark={isDark}>
                      Compartilhar
                    </ActionBtn>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

          <section className="mt-10 space-y-6" aria-label="Informações públicas da plataforma">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <h2
                  className={cx(
                    "text-2xl font-extrabold tracking-tight",
                    isDark ? "text-zinc-100" : "text-slate-900"
                  )}
                >
                  Informações úteis antes de entrar
                </h2>
                <p
                  className={cx(
                    "mt-1 text-sm",
                    isDark ? "text-zinc-400" : "text-slate-600"
                  )}
                >
                  Saiba como a plataforma pode ajudar, como instalá-la como aplicativo e quais
                  benefícios ela oferece ao usuário.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <Info className="h-4 w-4" aria-hidden="true" />
                Conteúdo público e institucional
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <InstitutionalCard
                icon={ClipboardCheck}
                title="Benefícios para o usuário"
                subtitle="Mais clareza, autonomia e agilidade"
                isDark={isDark}
                accent="amber"
              >
                <p>
                  A centralização das informações facilita o acompanhamento da vida acadêmica
                  e formativa do usuário, reduz retrabalho e amplia a transparência sobre
                  inscrições, pendências, presenças e certificações.
                </p>

                <div className="grid grid-cols-1 gap-2 pt-1">
                  <FeaturePill isDark={isDark}>✔ Mais autonomia no acompanhamento</FeaturePill>
                  <FeaturePill isDark={isDark}>✔ Menos retrabalho e mais organização</FeaturePill>
                  <FeaturePill isDark={isDark}>✔ Acesso rápido a documentos e rotinas</FeaturePill>
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
                  A plataforma foi criada para reunir em um único ambiente digital os fluxos
                  acadêmicos e administrativos da Escola da Saúde, tornando os processos mais
                  claros, organizados e acessíveis.
                </p>

                <p>
                  Isso fortalece a comunicação com os usuários e amplia a eficiência no
                  acompanhamento das ações formativas da instituição.
                </p>
              </InstitutionalCard>

              <InstitutionalCard
                icon={MonitorSmartphone}
                title="Instale como aplicativo (PWA)"
                subtitle="Mais rápido, prático e fácil de acessar"
                isDark={isDark}
                accent="emerald"
              >
                <p>
                  A plataforma pode ser instalada como um aplicativo em dispositivos
                  compatíveis, sem precisar de loja, com acesso mais rápido e experiência mais
                  fluida no dia a dia.
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
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 font-extrabold">
                    <span>🍎</span>
                    <span>iPhone / iPad (Safari)</span>
                  </div>
                  <ul className="list-disc ml-5 space-y-1 text-sm">
                    <li>Acesse <strong>{SITE_URL}</strong></li>
                    <li>Toque em <strong>Compartilhar</strong></li>
                    <li>Selecione <strong>Adicionar à Tela de Início</strong></li>
                    <li>Confirme em <strong>Adicionar</strong></li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 font-extrabold">
                    <span>📱</span>
                    <span>Android (Chrome)</span>
                  </div>
                  <ul className="list-disc ml-5 space-y-1 text-sm">
                    <li>Acesse <strong>{SITE_URL}</strong></li>
                    <li>Toque no menu <strong>⋮</strong></li>
                    <li>
                      Escolha <strong>Instalar app</strong> ou{" "}
                      <strong>Adicionar à tela inicial</strong>
                    </li>
                    <li>Confirme em <strong>Instalar</strong></li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 font-extrabold">
                    <span>💻</span>
                    <span>Computador (Chrome / Edge)</span>
                  </div>
                  <ul className="list-disc ml-5 space-y-1 text-sm">
                    <li>Acesse <strong>{SITE_URL}</strong></li>
                    <li>Clique no ícone <strong>Instalar</strong> na barra de endereço</li>
                    <li>Confirme em <strong>Instalar</strong></li>
                    <li>Abra a plataforma em janela própria</li>
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
                      isDark ? "bg-white/5 text-zinc-100" : "bg-white text-slate-700"
                    )}
                  >
                    <BadgeCheck className="h-5 w-5" aria-hidden="true" />
                  </div>

                  <div className="space-y-2 text-sm">
                    <p className="font-extrabold">Como saber se instalou corretamente?</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <FeaturePill isDark={isDark}>✔ O ícone aparece na tela inicial</FeaturePill>
                      <FeaturePill isDark={isDark}>✔ A plataforma abre em janela própria</FeaturePill>
                      <FeaturePill isDark={isDark}>✔ A navegação fica mais direta</FeaturePill>
                      <FeaturePill isDark={isDark}>✔ O acesso fica mais prático no dia a dia</FeaturePill>
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
                      isDark ? "bg-sky-500/10 text-sky-300" : "bg-sky-50 text-sky-700"
                    )}
                  >
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    iPhone: Compartilhar → Tela de Início
                  </div>
                </div>

                <p className="mt-4 text-sm">
                  📍 Em breve, após a finalização do processo de publicação, o aplicativo
                  também estará disponível na <strong>Google Play Store</strong>.
                </p>
              </div>
            </InstitutionalCard>
          </section>
        </section>
      </main>

      <Footer />
    </>
  );
}