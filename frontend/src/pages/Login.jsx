// ✅ src/pages/Login.jsx
// premium + institucional + QR públicos + mobile-first + dark/light/system + a11y

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
  GraduationCap,
  Building2,
  BookOpenCheck,
  FileText,
  ClipboardCheck,
  Smartphone,
  HeartPulse,
  Landmark,
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
    for (let i = 0; i < len - 1; i += 1) soma += parseInt(arr[i], 10) * (len - i);
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

/* ---------------------- mini ui ---------------------- */
function MiniStatLite({ title, value, isDark, icon: Icon }) {
  return (
    <div
      className={[
        "rounded-2xl border px-4 py-3 transition-colors",
        isDark
          ? "border-white/10 bg-zinc-950/35"
          : "border-slate-200 bg-white shadow-sm",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={[
              "text-[11px] font-bold uppercase tracking-wide",
              isDark ? "text-zinc-300" : "text-slate-500",
            ].join(" ")}
          >
            {title}
          </div>
          <div
            className={[
              "mt-1 text-sm font-extrabold",
              isDark ? "text-zinc-100" : "text-slate-900",
            ].join(" ")}
          >
            {value}
          </div>
        </div>

        {Icon ? (
          <div
            className={[
              "rounded-xl p-2",
              isDark ? "bg-white/5 text-zinc-200" : "bg-slate-100 text-slate-700",
            ].join(" ")}
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
  };

  return (
    <article
      className={[
        "overflow-hidden rounded-3xl border transition-colors",
        isDark
          ? "border-white/10 bg-zinc-900/55"
          : "border-slate-200 bg-white shadow-sm",
      ].join(" ")}
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
            className={[
              "rounded-2xl border p-3",
              isDark
                ? "border-white/10 bg-zinc-950/35 text-zinc-100"
                : "border-slate-200 bg-slate-50 text-slate-800",
            ].join(" ")}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <h3
              className={[
                "text-lg font-extrabold tracking-tight",
                isDark ? "text-zinc-100" : "text-slate-900",
              ].join(" ")}
            >
              {title}
            </h3>
            {subtitle ? (
              <p
                className={[
                  "mt-1 text-sm font-semibold",
                  isDark ? "text-emerald-300" : "text-emerald-700",
                ].join(" ")}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className={[
            "mt-4 space-y-3 text-sm leading-relaxed",
            isDark ? "text-zinc-300" : "text-slate-700",
          ].join(" ")}
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
      className={[
        "rounded-3xl border p-5 sm:p-6",
        isDark
          ? "border-white/10 bg-zinc-900/55"
          : "border-slate-200 bg-white shadow-sm",
      ].join(" ")}
    >
      <div
        className={`h-1.5 w-full rounded-full bg-gradient-to-r ${
          bar[accent] || bar.emerald
        }`}
        aria-hidden="true"
      />

      <div className="mt-4 flex items-start gap-3">
        <div
          className={[
            "rounded-2xl border p-3",
            isDark
              ? "border-white/10 bg-zinc-950/35 text-zinc-100"
              : "border-slate-200 bg-slate-50 text-slate-800",
          ].join(" ")}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <h3
            className={[
              "text-sm font-extrabold",
              isDark ? "text-zinc-100" : "text-slate-900",
            ].join(" ")}
          >
            {title}
          </h3>
          <p
            className={[
              "mt-1 text-[12px] break-words",
              isDark ? "text-zinc-400" : "text-slate-600",
            ].join(" ")}
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
      className={[
        "inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-extrabold transition",
        isDark
          ? "border-white/10 bg-zinc-900/35 text-zinc-200 hover:bg-white/5"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {children}
    </button>
  );
}

export default function Login() {
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [erroCpf, setErroCpf] = useState("");
  const [erroSenha, setErroSenha] = useState("");
  const [capsLockOn, setCapsLockOn] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const cpfRef = useRef(null);
  const senhaRef = useRef(null);
  const qrSize = useQrSize();

  const hasGoogleClient = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const { isDark } = useEscolaTheme();

  const redirectPath = useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search);
      const raw = sp.get("next") || sp.get("redirect") || "";
      if (!raw) return "/painel";
      if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
      return "/painel";
    } catch {
      return "/painel";
    }
  }, [location.search]);

  useEffect(() => {
    document.title = "Entrar — Escola da Saúde";
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (location.pathname === "/login" && token) {
      navigate(redirectPath || "/painel", { replace: true });
    }
  }, [navigate, location.pathname, redirectPath]);

  useEffect(() => {
    const onKey = (e) => {
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
    if (!token || !usuario) throw new Error("Resposta de login inválida.");

    api.persistSession(token, usuario);

    window.dispatchEvent(
      new CustomEvent("auth:changed", {
        detail: {
          authenticated: true,
          usuario,
        },
      })
    );
  }, []);

  const redirecionarPosLogin = useCallback(
    (payload) => {
      persistirSessao(payload);

      const destino = redirectPath || "/painel";

      setTimeout(() => {
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
    if (loading || loadingGoogle) return;
    if (!validarFormulario()) return;

    setLoading(true);

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

      setSenha("");
      setMostrarSenha(false);
      senhaRef.current?.focus();
      toast.error(serverMsg);
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginGoogle(credentialResponse) {
    if (!credentialResponse?.credential) {
      toast.error("Credencial do Google ausente.");
      return;
    }
    if (loadingGoogle || loading) return;

    setLoadingGoogle(true);

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

      toast.error(serverMsg);
    } finally {
      setLoadingGoogle(false);
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
        className={[
          "min-h-screen transition-colors",
          isDark
            ? "bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100"
            : "bg-slate-50 text-slate-900",
        ].join(" ")}
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
                <span>Portal oficial • acesso à plataforma institucional</span>
              </div>

              <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight max-w-4xl">
                Escola Municipal de Saúde Pública de Santos
              </h1>

              <p className="text-sm md:text-base text-white/90 max-w-3xl leading-relaxed">
                Plataforma institucional criada em <strong>setembro de 2025</strong> para
                apoiar inscrições, presenças, avaliações, certificados, submissões e o
                acompanhamento das ações formativas da Escola da Saúde.
              </p>

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
              <div
                className={[
                  "rounded-3xl border p-6 md:p-8 transition-colors",
                  isDark
                    ? "border-white/10 bg-zinc-900/50 shadow-none"
                    : "border-slate-200 bg-white shadow-sm",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={[
                      "rounded-2xl p-3",
                      isDark ? "bg-emerald-500/15" : "bg-emerald-100",
                    ].join(" ")}
                  >
                    <ShieldCheck
                      className={[
                        "h-6 w-6",
                        isDark ? "text-emerald-300" : "text-emerald-700",
                      ].join(" ")}
                    />
                  </div>

                  <div>
                    <h2 className="text-lg font-extrabold">Acesso seguro</h2>
                    <p
                      className={[
                        "mt-1 text-sm",
                        isDark ? "text-zinc-300" : "text-slate-600",
                      ].join(" ")}
                    >
                      Entre com CPF e senha. Você também pode usar o Google quando disponível.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <MiniStatLite
                    title="Sessão"
                    value="Token JWT"
                    isDark={isDark}
                    icon={ShieldCheck}
                  />
                  <MiniStatLite
                    title="Acesso"
                    value="Perfis (RBAC)"
                    isDark={isDark}
                    icon={Landmark}
                  />
                  <MiniStatLite
                    title="Mobile"
                    value="PWA ready"
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

                <div
                  className={[
                    "mt-6 text-xs space-y-2",
                    isDark ? "text-zinc-300" : "text-slate-600",
                  ].join(" ")}
                >
                  <p>• Navegação por teclado e alto contraste.</p>
                  <p>• Não compartilhe sua senha com terceiros.</p>
                  <p>• Se o Caps Lock estiver ligado, atenção ao digitar a senha.</p>
                </div>
              </div>

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
                title="Para que serve a plataforma da Escola?"
                subtitle="Criada em setembro/2025"
                isDark={isDark}
                accent="sky"
              >
                <p>
                  A plataforma foi criada em <strong>setembro de 2025</strong> com a
                  finalidade de modernizar e organizar digitalmente os fluxos formativos,
                  acadêmicos e administrativos da Escola da Saúde.
                </p>

                <p>
                  Nela, é possível realizar <strong>inscrições em cursos e eventos</strong>,
                  acompanhar <strong>presenças</strong>, responder{" "}
                  <strong>avaliações</strong>, emitir e baixar{" "}
                  <strong>certificados</strong>, acessar conteúdos e recursos de apoio,
                  além de operar funcionalidades específicas ligadas a{" "}
                  <strong>submissões, chamadas, votações e acompanhamento institucional</strong>,
                  conforme o perfil do usuário.
                </p>
              </InstitutionalCard>
            </aside>

            <div className="xl:col-span-7 space-y-6">
              <div
                className={[
                  "rounded-3xl border p-6 transition-colors md:p-8",
                  isDark
                    ? "border-white/10 bg-zinc-900/50 shadow-none"
                    : "border-slate-200 bg-white shadow-xl",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={[
                        "h-12 w-12 rounded-2xl flex items-center justify-center border overflow-hidden",
                        isDark
                          ? "bg-emerald-500/10 border-white/10"
                          : "bg-emerald-50 border-emerald-100",
                      ].join(" ")}
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
                        className={[
                          "text-xs",
                          isDark ? "text-zinc-300" : "text-slate-500",
                        ].join(" ")}
                      >
                        CPF + senha (ou Google). Use o link para recuperar se necessário.
                      </p>
                    </div>
                  </div>

                  <span
                    className={[
                      "hidden sm:inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold",
                      isDark
                        ? "border-white/10 bg-zinc-950/40 text-zinc-200"
                        : "border-slate-200 bg-slate-50 text-slate-700",
                    ].join(" ")}
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Ambiente autenticado
                  </span>
                </div>

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
                        className={[
                          "absolute left-3 top-1/2 -translate-y-1/2",
                          isDark ? "text-zinc-300" : "text-slate-500",
                        ].join(" ")}
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
                        className={[
                          "w-full rounded-2xl border pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/70",
                          isDark
                            ? "border-white/10 bg-zinc-950/30 text-zinc-100 placeholder:text-zinc-500"
                            : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400",
                          erroCpf ? "ring-2 ring-red-500/60 border-red-500/60" : "",
                        ].join(" ")}
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
                          className={[
                            "mt-2 text-xs",
                            isDark ? "text-zinc-400" : "text-slate-500",
                          ].join(" ")}
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
                        className={[
                          "absolute left-3 top-1/2 -translate-y-1/2",
                          isDark ? "text-zinc-300" : "text-slate-500",
                        ].join(" ")}
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
                        className={[
                          "w-full rounded-2xl border pl-11 pr-12 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/70",
                          isDark
                            ? "border-white/10 bg-zinc-950/30 text-zinc-100 placeholder:text-zinc-500"
                            : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400",
                          erroSenha ? "ring-2 ring-red-500/60 border-red-500/60" : "",
                        ].join(" ")}
                        aria-invalid={!!erroSenha}
                        aria-describedby={(erroSenha || capsLockOn) ? "senha-feedback" : undefined}
                      />

                      <button
                        type="button"
                        onClick={() => setMostrarSenha((prev) => !prev)}
                        className={[
                          "absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-2.5 py-2",
                          "focus:outline-none focus:ring-2 focus:ring-emerald-500/70",
                          isDark
                            ? "text-zinc-300 hover:bg-white/10"
                            : "text-slate-600 hover:bg-slate-100",
                        ].join(" ")}
                        aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                        title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
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
                          className={[
                            "mt-1 text-[11px] flex items-center gap-1",
                            isDark ? "text-amber-300" : "text-amber-700",
                          ].join(" ")}
                          role="status"
                        >
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Atenção:
                          Caps Lock está ativado.
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => navigate("/recuperar-senha")}
                        className={[
                          "w-full sm:w-auto font-semibold hover:underline rounded-xl px-3 py-2",
                          "focus:outline-none focus:ring-2 focus:ring-emerald-500/70",
                          isDark ? "text-sky-300 hover:bg-white/5" : "text-sky-700",
                        ].join(" ")}
                      >
                        Esqueci minha senha
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate("/cadastro")}
                        className={[
                          "w-full sm:w-auto font-extrabold hover:underline rounded-xl px-3 py-2",
                          "focus:outline-none focus:ring-2 focus:ring-emerald-500/70",
                          isDark
                            ? "text-emerald-300 hover:bg-white/5"
                            : "text-emerald-700",
                        ].join(" ")}
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
                      className={[
                        "text-center text-xs font-bold",
                        isDark ? "text-zinc-300" : "text-slate-600",
                      ].join(" ")}
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
                          className={[
                            "text-center block",
                            isDark ? "text-zinc-400" : "text-slate-500",
                          ].join(" ")}
                        >
                          Login com Google indisponível no momento.
                        </small>
                      )}
                    </div>

                    {redirectPath ? (
                      <p
                        className={[
                          "mt-3 text-[11px] text-center",
                          isDark ? "text-zinc-400" : "text-slate-500",
                        ].join(" ")}
                      >
                        Após o login, você será levado para:{" "}
                        <span className="font-semibold">{redirectPath}</span>
                      </p>
                    ) : null}
                  </div>

                  <p
                    className={[
                      "pt-2 text-[11px] text-center",
                      isDark ? "text-zinc-400" : "text-slate-500",
                    ].join(" ")}
                  >
                    Ao continuar, você concorda com o uso dos seus dados para fins de
                    controle de eventos, presença e certificação, conforme diretrizes
                    institucionais.
                  </p>

                  <div className="sr-only" aria-live="polite">
                    {loading ? "Processando login" : ""}
                  </div>
                </form>
              </div>

              <section aria-label="Links oficiais">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
                  <div>
                    <h2
                      className={[
                        "text-xl font-extrabold",
                        isDark ? "text-zinc-100" : "text-slate-900",
                      ].join(" ")}
                    >
                      Links oficiais
                    </h2>
                    <p
                      className={[
                        "mt-1 text-sm",
                        isDark ? "text-zinc-400" : "text-slate-600",
                      ].join(" ")}
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

          <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6" aria-label="Informações institucionais">
            <InstitutionalCard
              icon={GraduationCap}
              title="Finalidade institucional da Escola da Saúde"
              subtitle="Formação, integração ensino-serviço e qualificação do SUS"
              isDark={isDark}
              accent="violet"
            >
              <p>
                A Escola da Saúde desenvolve e apoia ações de{" "}
                <strong>qualificação dos trabalhadores</strong>, fomenta práticas de{" "}
                <strong>Educação Permanente em Saúde</strong> e fortalece a integração entre
                formação, serviço e gestão.
              </p>

              <p>
                Também atua na organização dos <strong>estágios das instituições de ensino</strong>{" "}
                nas unidades de saúde via <strong>COAPES</strong>, no acompanhamento dos{" "}
                <strong>Programas de Residência</strong> e no apoio aos fluxos do{" "}
                <strong>Comitê de Ética em Pesquisa</strong>, entre outras atribuições
                institucionais.
              </p>
            </InstitutionalCard>

            <InstitutionalCard
              icon={ClipboardCheck}
              title="O que é possível fazer na plataforma?"
              subtitle="Ambiente digital oficial da Escola da Saúde"
              isDark={isDark}
              accent="amber"
            >
              <p>
                A plataforma foi criada em <strong>setembro de 2025</strong> para reunir em
                um único ambiente digital os principais fluxos acadêmicos e administrativos da
                Escola da Saúde.
              </p>

              <p>
                Nela, é possível realizar <strong>inscrições em eventos e cursos</strong>,
                acompanhar <strong>presenças</strong>, preencher{" "}
                <strong>avaliações</strong>, emitir e baixar{" "}
                <strong>certificados</strong>, acessar materiais e operar funcionalidades
                relacionadas a <strong>submissões, chamadas, votações e outros módulos</strong>,
                de acordo com o perfil de acesso.
              </p>
            </InstitutionalCard>

            <InstitutionalCard
              icon={FileText}
              title="Benefícios para o usuário"
              subtitle="Mais clareza, autonomia e agilidade"
              isDark={isDark}
              accent="sky"
            >
              <p>
                A centralização das informações facilita o acompanhamento da vida acadêmica e
                formativa do usuário, reduz retrabalho e amplia a transparência sobre
                inscrições, pendências, presenças e certificações.
              </p>

              <p>
                O acesso público a estas informações nesta tela de entrada permite que o
                usuário conheça a finalidade institucional da Escola e compreenda melhor o
                papel da plataforma antes mesmo de autenticar.
              </p>
            </InstitutionalCard>

            <InstitutionalCard
  icon={Smartphone}
  title="Use a plataforma como aplicativo (PWA)"
  subtitle="Instalação rápida em celular, tablet e computador"
  isDark={isDark}
  accent="emerald"
>
  <p>
    A plataforma da Escola da Saúde pode ser instalada como um aplicativo
    (<strong>PWA</strong>) em dispositivos compatíveis, oferecendo acesso mais
    rápido, visual em tela cheia e melhor experiência de uso no dia a dia.
  </p>

  <p>
    Depois de instalada, ela pode funcionar como um app comum, facilitando o
    acesso a inscrições, presenças, avaliações, certificados e outras rotinas
    importantes da plataforma.
  </p>

  <div className="mt-4 space-y-1 text-sm">
    <p>✔ Acesso direto pela tela inicial</p>
    <p>✔ Abre sem a barra do navegador</p>
    <p>✔ Navegação mais rápida e prática</p>
    <p>✔ Melhor experiência em celular, tablet e computador</p>
  </div>

  <h4 className="font-extrabold mt-5">🍎 iPhone / iPad (Safari)</h4>
  <ul className="list-disc ml-6 space-y-1">
    <li>Acesse: <strong>https://escoladasaude.vercel.app</strong></li>
    <li>Toque em <strong>Compartilhar</strong></li>
    <li>Selecione <strong>Adicionar à Tela de Início</strong></li>
    <li>Confirme em <strong>Adicionar</strong></li>
  </ul>

  <h4 className="font-extrabold mt-5">📱 Android (Chrome)</h4>
  <ul className="list-disc ml-6 space-y-1">
    <li>Acesse: <strong>https://escoladasaude.vercel.app</strong></li>
    <li>Toque no menu <strong>⋮</strong></li>
    <li>Selecione <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong></li>
    <li>Confirme em <strong>Instalar</strong></li>
  </ul>

  <h4 className="font-extrabold mt-5">💻 Computador (Chrome / Edge)</h4>
  <ul className="list-disc ml-6 space-y-1">
    <li>Acesse: <strong>https://escoladasaude.vercel.app</strong></li>
    <li>Clique no ícone <strong>Instalar</strong> na barra de endereço</li>
    <li>Confirme em <strong>Instalar</strong></li>
  </ul>

  <h4 className="font-extrabold mt-5">✅ Como saber se instalou corretamente?</h4>
  <ul className="list-disc ml-6 space-y-1">
    <li>✔ O ícone aparece na tela inicial ou área de trabalho</li>
    <li>✔ A plataforma abre em janela própria</li>
    <li>✔ A navegação fica mais direta e prática</li>
  </ul>

  <div className="mt-5 rounded-2xl bg-slate-100 dark:bg-zinc-800 p-4">
    <p className="font-extrabold text-sm mb-1">📌 Atalho rápido</p>
    <p className="text-sm">Android → <strong>⋮ → Instalar app</strong></p>
    <p className="text-sm">iPhone → <strong>Compartilhar → Adicionar à Tela de Início</strong></p>
  </div>

  <p className="mt-5">
    📍 Em breve, após a finalização do processo de publicação, o aplicativo
    também estará disponível na <strong>Google Play Store</strong>.
  </p>
</InstitutionalCard>
          </section>
        </section>
      </main>

      <Footer />
    </>
  );
}