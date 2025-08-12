// ✅ src/pages/RedefinirSenha.jsx
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import BotaoPrimario from "../components/BotaoPrimario";
import { apiPost } from "../services/api"; // ✅ usa cliente central

export default function RedefinirSenha() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setMensagem("");

    if (!novaSenha || !confirmarSenha) {
      const msg = "Preencha todos os campos.";
      setErro(msg);
      toast.warning(`⚠️ ${msg}`);
      return;
    }

    if (novaSenha !== confirmarSenha) {
      const msg = "As senhas não coincidem.";
      setErro(msg);
      toast.warning(`⚠️ ${msg}`);
      return;
    }

    const senhaForte = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!senhaForte.test(novaSenha)) {
      const msg =
        "A senha deve conter ao menos 8 caracteres, incluindo letra maiúscula, minúscula, número e símbolo.";
      setErro(msg);
      toast.warning(`⚠️ ${msg}`);
      return;
    }

    setLoading(true);
    toast.info("⏳ Redefinindo senha...");
    try {
      // ✅ agora via baseURL da env (HTTPS) e tratamento padronizado
      await apiPost("/api/usuarios/redefinir-senha", { token, novaSenha });

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
    <main className="min-h-screen flex items-center justify-center bg-gelo dark:bg-zinc-900 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-lousa text-white rounded-2xl shadow-xl p-8 w-full max-w-md space-y-6"
        aria-label="Formulário de redefinição de senha"
      >
        <h2 className="text-2xl font-bold text-center">🔐 Redefinir Senha</h2>

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

        <label htmlFor="novaSenha" className="sr-only">Nova senha</label>
        <input
          id="novaSenha"
          type="password"
          placeholder="Nova senha"
          value={novaSenha}
          onChange={(e) => {
            setNovaSenha(e.target.value);
            if (erro) setErro("");
          }}
          className="w-full px-4 py-2 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-lousa"
          autoComplete="new-password"
          aria-required="true"
        />

        <label htmlFor="confirmarSenha" className="sr-only">Confirmar nova senha</label>
        <input
          id="confirmarSenha"
          type="password"
          placeholder="Confirmar nova senha"
          value={confirmarSenha}
          onChange={(e) => {
            setConfirmarSenha(e.target.value);
            if (erro) setErro("");
          }}
          className="w-full px-4 py-2 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-lousa"
          autoComplete="new-password"
          aria-required="true"
        />

        <BotaoPrimario
          type="submit"
          disabled={loading}
          className="w-full"
          aria-label="Redefinir senha"
        >
          {loading ? "Salvando..." : "Redefinir Senha"}
        </BotaoPrimario>
      </form>
    </main>
  );
}
