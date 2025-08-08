import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "react-toastify";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import Spinner from "../components/Spinner";

export default function Cadastro() {
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [erro, setErro] = useState("");
  const [erroNome, setErroNome] = useState("");
  const [erroCpf, setErroCpf] = useState("");
  const [erroEmail, setErroEmail] = useState("");
  const [erroSenha, setErroSenha] = useState("");
  const [erroConfirmarSenha, setErroConfirmarSenha] = useState("");

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.getElementById("nome")?.focus();
  }, []);

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

  function validarEmail(email) {
    return /\S+@\S+\.\S+/.test(email);
  }

  function calcularForcaSenha(s) {
    let score = 0;
    if (s.length >= 8) score++;
    if (/[A-Z]/.test(s)) score++;
    if (/[a-z]/.test(s)) score++;
    if (/\d/.test(s)) score++;
    if (/[\W_]/.test(s)) score++;
    return Math.min(score, 4);
  }

  const forcaSenha = useMemo(() => calcularForcaSenha(senha), [senha]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(""); setErroNome(""); setErroCpf(""); setErroEmail(""); setErroSenha(""); setErroConfirmarSenha("");

    if (!nome) {
      setErroNome("Nome é obrigatório.");
      return;
    }
    if (!validarCPF(cpf)) {
      setErroCpf("CPF inválido. Digite no formato 000.000.000-00.");
      return;
    }
    if (!validarEmail(email)) {
      setErroEmail("E-mail inválido.");
      return;
    }
    if (senha.length < 8) {
      setErroSenha("Senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (senha !== confirmarSenha) {
      setErroConfirmarSenha("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://escola-saude-api.onrender.com/api/usuarios/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          cpf: cpf.replace(/\D/g, ""),
          email,
          senha,
          perfil: "usuario",
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.mensagem || "Erro ao criar conta.");

      toast.success("✅ Cadastro realizado com sucesso!");
      setTimeout(() => navigate("/login"), 2200);
    } catch (err) {
      setErro(err.message || "Erro inesperado.");
      setSenha(""); setConfirmarSenha("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main role="main" className="min-h-screen bg-gelo flex items-center justify-center px-2">
      <form
        onSubmit={handleSubmit}
        className="bg-lousa text-white rounded-2xl shadow-xl p-8 w-full max-w-lg space-y-5"
        aria-label="Formulário de Cadastro"
      >
        <h2 className="text-2xl font-bold text-center">Criar Conta</h2>

        {/* 🔴 Mensagens gerais de erro */}
        {erro && (
          <p className="text-red-300 text-sm text-center" aria-live="assertive">
            {erro}
          </p>
        )}

        {/* Nome */}
        <div>
          <input
            id="nome"
            type="text"
            placeholder="Nome completo"
            value={nome}
            onChange={(e) => { setNome(e.target.value); setErroNome(""); }}
            className="w-full px-4 py-2 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-lousa focus:outline-none"
            autoComplete="name"
          />
          {erroNome && <p className="text-red-500 text-xs mt-1">{erroNome}</p>}
        </div>

        {/* CPF */}
        <div>
          <input
            type="text"
            placeholder="CPF"
            value={cpf}
            onChange={(e) => { setCpf(aplicarMascaraCPF(e.target.value)); setErroCpf(""); }}
            maxLength={14}
            className="w-full px-4 py-2 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-lousa focus:outline-none"
            autoComplete="username"
          />
          {erroCpf && <p className="text-red-500 text-xs mt-1">{erroCpf}</p>}
        </div>

        {/* E-mail */}
        <div>
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErroEmail(""); }}
            className="w-full px-4 py-2 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-lousa focus:outline-none"
            autoComplete="email"
          />
          {erroEmail && <p className="text-red-500 text-xs mt-1">{erroEmail}</p>}
        </div>

        {/* Senha */}
        <div className="relative">
          <input
            type={mostrarSenha ? "text" : "password"}
            placeholder="Senha"
            value={senha}
            onChange={(e) => { setSenha(e.target.value); setErroSenha(""); }}
            className="w-full px-4 py-2 pr-12 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-lousa focus:outline-none"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            className="absolute top-1/2 right-3 transform -translate-y-1/2 text-lousa"
            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
          >
            {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          {erroSenha && <p className="text-red-500 text-xs mt-1">{erroSenha}</p>}
        </div>

        {/* Barra de força da senha */}
        {senha && (
          <div className="mt-2 h-2 bg-gray-300 rounded" aria-label="Força da senha">
            <div
              className={`h-2 rounded transition-all duration-300 ${
                forcaSenha === 1
                  ? "bg-red-500 w-1/5"
                  : forcaSenha === 2
                  ? "bg-yellow-500 w-2/5"
                  : forcaSenha === 3
                  ? "bg-blue-500 w-3/5"
                  : forcaSenha >= 4
                  ? "bg-green-500 w-full"
                  : ""
              }`}
            />
          </div>
        )}

        {/* Confirmar senha */}
        <div>
          <input
            type="password"
            placeholder="Confirmar senha"
            value={confirmarSenha}
            onChange={(e) => { setConfirmarSenha(e.target.value); setErroConfirmarSenha(""); }}
            className="w-full px-4 py-2 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-lousa focus:outline-none"
            autoComplete="new-password"
          />
          {erroConfirmarSenha && <p className="text-red-500 text-xs mt-1">{erroConfirmarSenha}</p>}
        </div>

        {/* Botões */}
        <BotaoPrimario type="submit" className="w-full flex justify-center items-center gap-2" disabled={loading}>
          {loading ? <Spinner pequeno /> : "Cadastrar"}
        </BotaoPrimario>

        <BotaoSecundario type="button" onClick={() => navigate("/login")} className="w-full mt-2">
          Voltar para login
        </BotaoSecundario>

        {/* Termos */}
        <p className="text-xs text-white/70 text-center mt-4">
          Ao se cadastrar, você concorda com o uso dos seus dados para controle de eventos,
          presença e certificação, conforme a política institucional da Escola da Saúde.
        </p>
      </form>
    </main>
  );
}
