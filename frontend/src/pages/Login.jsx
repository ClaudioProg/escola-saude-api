import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { toast } from "react-toastify";
import { LogIn, Eye, EyeOff, User, Lock } from "lucide-react";
import BotaoPrimario from "../components/BotaoPrimario";
import CarregandoSkeleton from "../components/CarregandoSkeleton";

export default function Login() {
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [erroCpf, setErroCpf] = useState("");
  const [erroSenha, setErroSenha] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (location.pathname === "/login" && token) {
      navigate("/dashboard");
    }
  }, [navigate, location]);

  function aplicarMascaraCPF(valor) {
    return valor
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function validarCPF(cpf) {
    return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpf);
  }

  async function handleLogin(e) {
    e.preventDefault();
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
      const response = await fetch("https://escola-saude-api.onrender.com/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: cpf.replace(/\D/g, ""), senha }),
      });

      const data = await response.json();
      if (!response.ok) {
        setSenha("");
        throw new Error(data.erro || data.message || "Erro ao fazer login.");
      }

      localStorage.clear();
      localStorage.setItem("token", data.token);
      localStorage.setItem("nome", data.usuario.nome);
      localStorage.setItem("perfil", data.usuario.perfil.join(","));
      localStorage.setItem("usuario", JSON.stringify(data.usuario));

      toast.success("✅ Login realizado com sucesso!");
      navigate("/dashboard");

    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginGoogle(credentialResponse) {
    setLoadingGoogle(true);
    try {
      const response = await fetch("https://escola-saude-api.onrender.com/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.erro || "Erro ao fazer login com Google.");
      }

      localStorage.clear();
      localStorage.setItem("token", data.token);
      localStorage.setItem("nome", data.usuario.nome);
      localStorage.setItem("perfil", data.usuario.perfil.join(","));
      localStorage.setItem("usuario", JSON.stringify(data.usuario));

      toast.success("✅ Login com Google realizado com sucesso!");
      navigate("/dashboard");

    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingGoogle(false);
    }
  }

  return (
    <main className="min-h-screen bg-gelo flex flex-col items-center justify-center px-2">
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
            onChange={(e) => setCpf(aplicarMascaraCPF(e.target.value))}
            placeholder="000.000.000-00"
            maxLength={14}
            autoFocus
            autoComplete="username"
            className={`w-full px-4 py-2 rounded bg-white dark:bg-gray-100 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-lousa
              ${erroCpf ? "border border-red-500" : ""}`}
            aria-label="Digite seu CPF"
            aria-invalid={!!erroCpf}
          />
          {erroCpf && <p className="text-red-500 text-xs mt-1">{erroCpf}</p>}
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
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              className="w-full px-4 py-2 rounded bg-white dark:bg-gray-100 text-gray-800 placeholder-gray-400 pr-14 focus:ring-2 focus:ring-lousa"
              aria-label="Digite sua senha"
              aria-invalid={!!erroSenha}
            />
            <button
              type="button"
              tabIndex={0}
              aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setMostrarSenha((prev) => !prev)}
              className="absolute top-1/2 right-3 transform -translate-y-1/2 text-lousa"
            >
              {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {erroSenha && <p className="text-red-500 text-xs mt-1">{erroSenha}</p>}
        </div>

        {/* Entrar */}
        <BotaoPrimario
          type="submit"
          className="w-full flex justify-center items-center gap-2 mt-2"
          aria-label="Entrar na plataforma"
          disabled={loading}
        >
          <LogIn size={16} /> {loading ? "Entrando..." : "Entrar"}
        </BotaoPrimario>

        <div className="text-center text-sm text-white mt-2">ou</div>

        {/* Google */}
        <div className="flex justify-center mt-1 mb-4">
          {loadingGoogle ? (
            <CarregandoSkeleton mensagem="Fazendo login com Google..." />
          ) : (
            <div className="scale-90 max-w-xs w-full flex justify-center">
              <GoogleLogin
                onSuccess={handleLoginGoogle}
                onError={() => toast.error("Erro no login com Google.")}
              />
            </div>
          )}
        </div>

        {/* Cadastro */}
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
  );
}
