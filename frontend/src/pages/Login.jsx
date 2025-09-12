// ✅ src/pages/Login.jsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { toast } from "react-toastify";
import { LogIn, Eye, EyeOff, User, Lock } from "lucide-react";

import BotaoPrimario from "../components/BotaoPrimario";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import Footer from "../components/Footer";
import { apiPost } from "../services/api";

export default function Login() {
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [erroCpf, setErroCpf] = useState("");
  const [erroSenha, setErroSenha] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  const hasGoogleClient = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // guarda (memorizado) um redirect seguro (mesmo host e começa com "/")
  const redirectPath = useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search);
      const raw = sp.get("redirect") || "";
      if (!raw) return null;
      // evita URLs externas
      if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
      return null;
    } catch {
      return null;
    }
  }, [location.search]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (location.pathname === "/login" && token) navigate("/dashboard", { replace: true });
  }, [navigate, location]);

  function aplicarMascaraCPF(valor) {
    return valor
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function validarCPF(c) {
    return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(c);
  }

  function persistirSessao(payload) {
    const { token, usuario } = payload || {};
    if (!token || !usuario) throw new Error("Resposta de login inválida.");

    const perfilArray = Array.isArray(usuario.perfil)
      ? usuario.perfil
      : typeof usuario.perfil === "string"
      ? usuario.perfil.split(",").map((p) => p.trim()).filter(Boolean)
      : [];

    // mantemos somente o essencial para evitar resíduos
    localStorage.clear();
    localStorage.setItem("token", token);
    localStorage.setItem("nome", usuario.nome || "");
    localStorage.setItem("perfil", JSON.stringify(perfilArray));
    localStorage.setItem("usuario", JSON.stringify({ ...usuario, perfil: perfilArray }));
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (loading) return;

    setErroCpf("");
    setErroSenha("");

    if (!validarCPF(cpf)) {
      setErroCpf("CPF inválido. Digite no formato 000.000.000-00.");
      return;
    }
    if (!senha) {
      setErroSenha("Digite sua senha.");
      return;
    }
    if (senha.length < 8) {
      setErroSenha("A senha deve conter pelo menos 8 caracteres.");
      return;
    }

    setLoading(true);
    try {
      // ⚠️ auth:false para NÃO enviar Authorization no login
      const payload = await apiPost(
        "/login", // ajuste para /auth/login se necessário
        { cpf: cpf.replace(/\D/g, ""), senha },
        { auth: false, on401: "silent" }
      );
      persistirSessao(payload);
      toast.success("✅ Login realizado com sucesso!");
      navigate(redirectPath || "/dashboard", { replace: true });
    } catch (err) {
      const serverMsg =
        err?.data?.erro || err?.data?.message || err?.message || "Erro ao fazer login.";
      setSenha("");
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
    if (loadingGoogle) return;

    setLoadingGoogle(true);
    try {
      const payload = await apiPost(
        "/auth/google",
        { credential: credentialResponse.credential },
        { auth: false, on401: "silent" }
      );
      persistirSessao(payload);
      toast.success("✅ Login com Google realizado com sucesso!");
      navigate(redirectPath || "/dashboard", { replace: true });
    } catch (err) {
      const serverMsg =
        err?.data?.erro || err?.data?.message || err?.message || "Erro ao fazer login com Google.";
      toast.error(serverMsg);
    } finally {
      setLoadingGoogle(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gelo">
      <main className="flex-1 flex flex-col items-center justify-center px-3">
        <img
          src="/logo_escola.png"
          alt="Logotipo da Escola Municipal de Saúde Pública de Santos"
          className="w-32 mb-7 drop-shadow-xl"
          loading="lazy"
        />

        <form
          onSubmit={handleLogin}
          className="bg-lousa text-white rounded-2xl shadow-xl p-8 w-full max-w-md space-y-6"
          aria-label="Formulário de Login"
        >
          <h2 className="text-2xl font-bold text-center mb-2">Acessar Plataforma</h2>

          {/* CPF */}
          <div>
            <label htmlFor="cpf" className="block mb-1 text-sm font-medium flex items-center gap-1">
              <User size={16} aria-hidden="true" /> CPF
            </label>
            <input
              id="cpf"
              name="cpf"
              type="text"
              value={cpf}
              onChange={(e) => {
                setCpf(aplicarMascaraCPF(e.target.value));
                if (erroCpf) setErroCpf("");
              }}
              placeholder="000.000.000-00"
              maxLength={14}
              autoFocus
              autoComplete="username"
              className={`w-full px-4 py-2 rounded bg-white dark:bg-gray-100 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-lousa ${
                erroCpf ? "border border-red-500" : ""
              }`}
              aria-label="Digite seu CPF"
              aria-invalid={!!erroCpf}
              aria-describedby={erroCpf ? "erro-cpf" : undefined}
              inputMode="numeric"
            />
            {erroCpf && (
              <p id="erro-cpf" className="text-red-200 text-xs mt-1" role="alert">
                {erroCpf}
              </p>
            )}
          </div>

          {/* Senha */}
          <div>
            <label htmlFor="senha" className="block mb-1 text-sm font-medium flex items-center gap-1">
              <Lock size={16} aria-hidden="true" /> Senha
            </label>
            <div className="relative">
              <input
                id="senha"
                name="senha"
                type={mostrarSenha ? "text" : "password"}
                value={senha}
                onChange={(e) => {
                  setSenha(e.target.value);
                  if (erroSenha) setErroSenha("");
                }}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                className="w-full px-4 py-2 rounded bg-white dark:bg-gray-100 text-gray-800 placeholder-gray-400 pr-14 focus:ring-2 focus:ring-lousa"
                aria-label="Digite sua senha"
                aria-invalid={!!erroSenha}
                aria-describedby={erroSenha ? "erro-senha" : undefined}
              />
              <button
                type="button"
                tabIndex={0}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setMostrarSenha((prev) => !prev)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-lousa focus:outline-none focus:ring-2 focus:ring-white/60 rounded"
                title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {erroSenha && (
              <p id="erro-senha" className="text-red-200 text-xs mt-1" role="alert">
                {erroSenha}
              </p>
            )}

            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => navigate("/recuperar-senha")}
                className="text-sm underline text-white/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lousa focus:ring-offset-lousa/20 rounded"
              >
                Esqueceu sua senha?
              </button>
            </div>
          </div>

          <BotaoPrimario
            type="submit"
            className="w-full flex justify-center items-center gap-2 mt-1"
            aria-label="Entrar na plataforma"
            disabled={loading || loadingGoogle}
          >
            <LogIn size={16} /> {loading ? "Entrando..." : "Entrar"}
          </BotaoPrimario>

          <div className="text-center text-sm text-white mt-2">ou</div>

          <div className="flex justify-center mt-1 mb-2">
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
              <small className="text-white/80 text-center block">
                Login com Google indisponível no momento.
              </small>
            )}
          </div>

          {redirectPath && (
            <p className="text-[11px] text-center text-white/70">
              Após o login, você será levado para: <span className="font-semibold">{redirectPath}</span>
            </p>
          )}

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate("/cadastro")}
              className="text-sm underline focus:ring-2 focus:ring-lousa"
            >
              Ainda não tem conta? Criar cadastro
            </button>
          </div>

          <p className="text-xs text-center text-white/70 mt-4">
            Ao continuar, você concorda com o uso dos seus dados para fins de controle de eventos,
            presença e certificação, conforme a política institucional da Escola da Saúde.
          </p>
        </form>
      </main>

      {/* Rodapé institucional em página pública também, para consistência visual */}
      <Footer />
    </div>
  );
}
