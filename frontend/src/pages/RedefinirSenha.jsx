// ✅ src/pages/RedefinirSenha.jsx
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import BotaoPrimario from "../components/BotaoPrimario";
import { apiPost } from "../services/api";

// Cabeçalho compacto + rodapé
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import { Lock, Eye, EyeOff } from "lucide-react";

export default function RedefinirSenha() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [verSenha1, setVerSenha1] = useState(false);
  const [verSenha2, setVerSenha2] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setMensagem("");

    const s1 = novaSenha.trim();
    const s2 = confirmarSenha.trim();

    if (!s1 || !s2) {
      const msg = "Preencha todos os campos.";
      setErro(msg);
      toast.warning(`⚠️ ${msg}`);
      return;
    }

    if (s1 !== s2) {
      const msg = "As senhas não coincidem.";
      setErro(msg);
      toast.warning(`⚠️ ${msg}`);
      return;
    }

    // mínimo: 8 chars, 1 maiúscula, 1 minúscula, 1 número, 1 símbolo
    const senhaForte = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!senhaForte.test(s1)) {
      const msg =
        "A senha deve conter ao menos 8 caracteres, incluindo letra maiúscula, minúscula, número e símbolo.";
      setErro(msg);
      toast.warning(`⚠️ ${msg}`);
      return;
    }

    setLoading(true);
    toast.info("⏳ Redefinindo senha...");
    try {
      await apiPost("/api/usuarios/redefinir-senha", { token, novaSenha: s1 });

      setMensagem("Senha redefinida com sucesso! Redirecionando para login...");
      toast.success("✅ Senha redefinida com sucesso!");
      setNovaSenha("");
      setConfirmarSenha("");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      const msg =
        err?.data?.erro ||
        err?.data?.message ||
        err?.message ||
        "Erro ao redefinir senha.";
      setErro(msg);
      toast.error(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900">
      {/* 🟦 Cabeçalho: área de conta/usuário = petróleo */}
      <PageHeader title="Redefinir Senha" icon={Lock} variant="petroleo" />

      <main role="main" className="flex-1 flex items-center justify-center px-4">
        <form
          onSubmit={handleSubmit}
          className="bg-lousa text-white rounded-2xl shadow-xl p-8 w-full max-w-md space-y-6"
          aria-label="Formulário de redefinição de senha"
        >
          <h2 className="text-2xl font-bold text-center">🔐 Redefinir Senha</h2>

          {(mensagem || erro) && (
            <div aria-live="polite">
              {mensagem && (
                <p className="text-green-300 text-sm text-center" role="alert">
                  {mensagem}
                </p>
              )}
              {erro && (
                <p className="text-red-300 text-sm text-center" role="alert">
                  {erro}
                </p>
              )}
            </div>
          )}

          {/* Nova senha */}
          <div>
            <label htmlFor="novaSenha" className="sr-only">Nova senha</label>
            <div className="relative">
              <input
                id="novaSenha"
                type={verSenha1 ? "text" : "password"}
                placeholder="Nova senha"
                value={novaSenha}
                onChange={(e) => {
                  setNovaSenha(e.target.value);
                  if (erro) setErro("");
                }}
                className="w-full px-4 py-2 pr-10 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-emerald-700"
                autoComplete="new-password"
                inputMode="text"
                minLength={8}
                pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$"
                aria-required="true"
              />
              <button
                type="button"
                onClick={() => setVerSenha1((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center justify-center p-1 text-gray-600 hover:text-gray-800"
                aria-label={verSenha1 ? "Ocultar senha" : "Mostrar senha"}
                title={verSenha1 ? "Ocultar senha" : "Mostrar senha"}
              >
                {verSenha1 ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirmar nova senha */}
          <div>
            <label htmlFor="confirmarSenha" className="sr-only">Confirmar nova senha</label>
            <div className="relative">
              <input
                id="confirmarSenha"
                type={verSenha2 ? "text" : "password"}
                placeholder="Confirmar nova senha"
                value={confirmarSenha}
                onChange={(e) => {
                  setConfirmarSenha(e.target.value);
                  if (erro) setErro("");
                }}
                className="w-full px-4 py-2 pr-10 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-emerald-700"
                autoComplete="new-password"
                inputMode="text"
                minLength={8}
                pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$"
                aria-required="true"
              />
              <button
                type="button"
                onClick={() => setVerSenha2((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center justify-center p-1 text-gray-600 hover:text-gray-800"
                aria-label={verSenha2 ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                title={verSenha2 ? "Ocultar confirmação" : "Mostrar confirmação"}
              >
                {verSenha2 ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <BotaoPrimario
            type="submit"
            disabled={loading}
            className="w-full"
            aria-label="Redefinir senha"
          >
            {loading ? "Salvando..." : "Redefinir Senha"}
          </BotaoPrimario>

          <p className="text-xs text-white/80 text-center">
            Dica: use uma frase-senha com letras maiúsculas/minúsculas, números e símbolos.
          </p>
        </form>
      </main>

      {/* Rodapé institucional */}
      <Footer />
    </div>
  );
}
