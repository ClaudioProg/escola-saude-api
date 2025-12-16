// ✅ src/pages/Login.jsx
import { useState, useEffect, useMemo, useRef } from "react";
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
  ArrowRight,
  Mail,
  IdCard,
} from "lucide-react";

import BotaoPrimario from "../components/BotaoPrimario";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import { apiPost } from "../services/api";

import useEscolaTheme from "../hooks/useEscolaTheme";
import ThemeTogglePills from "../components/ThemeTogglePills";

/* ---------------------- utils CPF ---------------------- */
function aplicarMascaraCPF(valor) {
  return valor
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
    for (let i = 0; i < len - 1; i++) soma += parseInt(arr[i], 10) * (len - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const d1 = calc(s, 10);
  const d2 = calc(s, 11);
  return d1 === parseInt(s[9], 10) && d2 === parseInt(s[10], 10);
}
function validarCPF(c) {
  const maskOk = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(c);
  return maskOk && cpfChecksumValido(c);
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

  const hasGoogleClient = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  // ✅ theme (light/dark/system)
  const { theme, setTheme, isDark } = useEscolaTheme();

  const redirectPath = useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search);
      const raw = sp.get("redirect") || "";
      if (!raw) return null;
      if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
      return null;
    } catch {
      return null;
    }
  }, [location.search]);

  useEffect(() => {
    document.title = "Entrar — Escola da Saúde";
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (location.pathname === "/login" && token) navigate("/", { replace: true });
  }, [navigate, location]);

  function persistirSessao(payload) {
    const { token, usuario } = payload || {};
    if (!token || !usuario) throw new Error("Resposta de login inválida.");

    const perfilArray = Array.isArray(usuario.perfil)
      ? usuario.perfil
      : typeof usuario.perfil === "string"
      ? usuario.perfil.split(",").map((p) => p.trim()).filter(Boolean)
      : [];

    localStorage.setItem("token", token);
    localStorage.setItem("nome", usuario.nome || "");
    localStorage.setItem("perfil", JSON.stringify(perfilArray));
    localStorage.setItem("usuario", JSON.stringify({ ...usuario, perfil: perfilArray }));
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (loading || loadingGoogle) return;

    setErroCpf("");
    setErroSenha("");

    if (!validarCPF(cpf)) {
      setErroCpf("CPF inválido. Verifique os dígitos e o formato 000.000.000-00.");
      cpfRef.current?.focus();
      return;
    }
    if (!senha) {
      setErroSenha("Digite sua senha.");
      senhaRef.current?.focus();
      return;
    }
    if (senha.length < 8) {
      setErroSenha("A senha deve conter pelo menos 8 caracteres.");
      senhaRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      const payload = await apiPost(
        "/login",
        { cpf: apenasDigitos(cpf), senha },
        { auth: false, on401: "silent" }
      );
      persistirSessao(payload);
      toast.success("✅ Login realizado com sucesso!");
      navigate(redirectPath || "/", { replace: true });
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
      persistirSessao(payload);
      toast.success("✅ Login com Google realizado com sucesso!");
      navigate(redirectPath || "/", { replace: true });
    } catch (err) {
      const serverMsg =
        err?.data?.erro || err?.data?.message || err?.message || "Erro ao fazer login com Google.";
      toast.error(serverMsg);
    } finally {
      setLoadingGoogle(false);
    }
  }

  const IdentIcon = cpf ? IdCard : User;

  return (
    <main
      className={[
        "min-h-screen transition-colors",
        isDark
          ? "bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100"
          : "bg-slate-50 text-slate-900",
      ].join(" ")}
    >
      {/* Skip link (a11y) */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50
                   rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow"
      >
        Pular para o conteúdo
      </a>

      {/* Header hero */}
<header className="relative overflow-hidden">
  {/* Gradiente verde → roxo → azul */}
  <div
    className="
      absolute inset-0
      bg-gradient-to-br
      from-emerald-600
      via-teal-600
      via-sky-700
      to-violet-600
      
    "
  />
  {isDark && <div className="absolute inset-0 bg-black/35" />}

  {/* blobs decorativos */}
  <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/25 blur-3xl" />
  <div className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/20 blur-3xl" />

  <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-12">
    {/* Toggle de tema bem no canto */}
    <div className="lg:absolute lg:right-4 lg:top-6 flex justify-end">
      <ThemeTogglePills theme={theme} setTheme={setTheme} variant="glass" />
    </div>

    {/* Logo institucional à esquerda */}
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

    {/* Conteúdo central */}
    <div className="flex flex-col items-center text-center gap-3">
      <div className="inline-flex items-center gap-2 text-white/90 text-xs font-semibold">
        <Sparkles className="h-4 w-4" />
        <span>Portal oficial • acesso autenticado</span>
      </div>

      <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
        Escola Municipal de Saúde Pública de Santos
      </h1>

      <p className="text-sm text-white/90 max-w-2xl">
        Acesse sua conta para inscrições, presenças, avaliações e certificados.
      </p>
    </div>
  </div>
</header>



      {/* Conteúdo */}
      <section
        id="conteudo"
        className={["mx-auto max-w-6xl px-4 sm:px-6 py-8 md:py-12", isDark ? "bg-transparent" : "bg-slate-50"].join(" ")}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Painel lateral (desktop) */}
          <aside className="hidden lg:block lg:col-span-5">
            <div
              className={[
                "h-full rounded-3xl border p-8 transition-colors",
                isDark ? "border-white/10 bg-zinc-900/50 shadow-none" : "border-slate-200 bg-white shadow-sm",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <div className={["rounded-2xl p-3", isDark ? "bg-emerald-500/15" : "bg-emerald-100"].join(" ")}>
                  <ShieldCheck className={["h-6 w-6", isDark ? "text-emerald-300" : "text-emerald-700"].join(" ")} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">Acesso seguro</h2>
                  <p className={["mt-1 text-sm", isDark ? "text-zinc-300" : "text-slate-600"].join(" ")}>
                    Entre com CPF e senha. Você também pode usar o Google quando disponível.
                  </p>
                </div>
              </div>

              {/* Ministats */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <MiniStatLite title="Sessão" value="Token JWT" isDark={isDark} />
                <MiniStatLite title="Acesso" value="Perfis (RBAC)" isDark={isDark} />
                <MiniStatLite title="Mobile" value="PWA ready" isDark={isDark} />
                <MiniStatLite title="Suporte" value="Escola da Saúde" isDark={isDark} />
              </div>

              <div className={["mt-6 text-xs space-y-2", isDark ? "text-zinc-300" : "text-slate-600"].join(" ")}>
                <p>• Navegação por teclado e alto contraste.</p>
                <p>• Não compartilhe sua senha com terceiros.</p>
                <p>• Se o Caps Lock estiver ligado, atenção ao digitar a senha.</p>
              </div>
            </div>
          </aside>

          {/* Card login */}
          <div className="lg:col-span-7">
            <div
              className={[
                "rounded-3xl border p-6 transition-colors md:p-8",
                isDark ? "border-white/10 bg-zinc-900/50 shadow-none" : "border-slate-200 bg-white shadow-xl",
              ].join(" ")}
            >
              {/* Logo + título */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={[
                      "h-12 w-12 rounded-2xl flex items-center justify-center border overflow-hidden",
                      isDark ? "bg-emerald-500/10 border-white/10" : "bg-emerald-50 border-emerald-100",
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
                    <h2 className="text-lg md:text-xl font-extrabold">Acesse sua conta</h2>
                    <p className={["text-xs", isDark ? "text-zinc-300" : "text-slate-500"].join(" ")}>
                      CPF + senha (ou Google). Use o link para recuperar se necessário.
                    </p>
                  </div>
                </div>

                <span
                  className={[
                    "hidden sm:inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold",
                    isDark ? "border-white/10 bg-zinc-950/40 text-zinc-200" : "border-slate-200 bg-slate-50 text-slate-700",
                  ].join(" ")}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Ambiente autenticado
                </span>
              </div>

              <form
                onSubmit={handleLogin}
                className="mt-6 space-y-4"
                aria-label="Formulário de Login"
                aria-busy={loading || loadingGoogle ? "true" : "false"}
              >
                {/* CPF */}
                <div>
                  <label htmlFor="cpf" className="block text-sm font-semibold">
                    CPF
                  </label>

                  <div className="mt-2 relative">
                    <span className={["absolute left-3 top-1/2 -translate-y-1/2", isDark ? "text-zinc-300" : "text-slate-500"].join(" ")}>
                      <IdentIcon className="h-5 w-5" />
                    </span>

                    <input
                      id="cpf"
                      name="cpf"
                      ref={cpfRef}
                      type="text"
                      value={cpf}
                      onChange={(e) => {
                        setCpf(aplicarMascaraCPF(e.target.value));
                        if (erroCpf) setErroCpf("");
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const text = (e.clipboardData.getData("text") || "").trim();
                        setCpf(aplicarMascaraCPF(text));
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
                      aria-label="Digite seu CPF"
                      aria-invalid={!!erroCpf}
                      aria-describedby={erroCpf ? "erro-cpf" : undefined}
                    />
                  </div>

                  <div className="min-h-[1rem]" aria-live="polite">
                    {erroCpf ? (
                      <p id="erro-cpf" className="text-red-500 dark:text-red-300 text-xs mt-1" role="alert">
                        {erroCpf}
                      </p>
                    ) : (
                      <p className={["mt-2 text-xs", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
                        Dica: CPF pode ser colado com ou sem pontuação.
                      </p>
                    )}
                  </div>
                </div>

                {/* Senha */}
                <div>
                  <label htmlFor="senha" className="block text-sm font-semibold">
                    Senha
                  </label>

                  <div className="mt-2 relative">
                    <span className={["absolute left-3 top-1/2 -translate-y-1/2", isDark ? "text-zinc-300" : "text-slate-500"].join(" ")}>
                      <Lock className="h-5 w-5" />
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
                      aria-label="Digite sua senha"
                      aria-invalid={!!erroSenha}
                      aria-describedby={erroSenha || capsLockOn ? "erro-senha aviso-caps" : undefined}
                    />

                    <button
                      type="button"
                      onClick={() => setMostrarSenha((prev) => !prev)}
                      className={[
                        "absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-2.5 py-2",
                        "focus:outline-none focus:ring-2 focus:ring-emerald-500/70",
                        isDark ? "text-zinc-300 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100",
                      ].join(" ")}
                      aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                      title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {mostrarSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>

                  <div className="min-h-[1.25rem]" aria-live="polite">
                    {erroSenha ? (
                      <p id="erro-senha" className="text-red-500 dark:text-red-300 text-xs mt-1" role="alert">
                        {erroSenha}
                      </p>
                    ) : null}

                    {capsLockOn && !erroSenha ? (
                      <p
                        id="aviso-caps"
                        className={["mt-1 text-[11px] flex items-center gap-1", isDark ? "text-amber-300" : "text-amber-700"].join(" ")}
                        role="status"
                      >
                        <AlertTriangle className="h-3 w-3" /> Atenção: Caps Lock está ativado.
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
                        isDark ? "text-emerald-300 hover:bg-white/5" : "text-emerald-700",
                      ].join(" ")}
                    >
                      Criar cadastro
                    </button>
                  </div>
                </div>

                {/* CTA principal (mantive seu BotaoPrimario) */}
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

                {/* Google */}
                <div className="pt-2">
                  <div className={["text-center text-xs font-bold", isDark ? "text-zinc-300" : "text-slate-600"].join(" ")}>
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
                          theme="outline"
                          size="large"
                          shape="rectangular"
                          text="signin_with"
                          locale="pt-BR"
                          useOneTap={false}
                        />
                      </div>
                    ) : (
                      <small className={["text-center block", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
                        Login com Google indisponível no momento.
                      </small>
                    )}
                  </div>

                  {redirectPath ? (
                    <p className={["mt-3 text-[11px] text-center", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
                      Após o login, você será levado para:{" "}
                      <span className="font-semibold">{redirectPath}</span>
                    </p>
                  ) : null}
                </div>

                <p className={["pt-2 text-[11px] text-center", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
                  Ao continuar, você concorda com o uso dos seus dados para fins de controle de
                  eventos, presença e certificação, conforme a política institucional da Escola da Saúde.
                </p>

                {/* SR status */}
                <div className="sr-only" aria-live="polite">
                  {loading ? "Processando login" : ""}
                </div>
              </form>
            </div>

            <p className={["mt-4 text-center text-xs", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
              <span className="font-semibold">Segurança:</span> não compartilhe sua senha. Use um gerenciador de senhas, se possível.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function MiniStatLite({ title, value, isDark }) {
  return (
    <div
      className={[
        "rounded-2xl border px-4 py-3 transition-colors",
        isDark ? "border-white/10 bg-zinc-950/35" : "border-slate-200 bg-white shadow-sm",
      ].join(" ")}
    >
      <div className={["text-[11px] font-bold", isDark ? "text-zinc-300" : "text-slate-500"].join(" ")}>
        {title}
      </div>
      <div className={["mt-1 text-sm font-extrabold", isDark ? "text-zinc-100" : "text-slate-900"].join(" ")}>
        {value}
      </div>
    </div>
  );
}
