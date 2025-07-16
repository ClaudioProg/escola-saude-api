// ✅ src/pages/RecuperarSenha.jsx
import { useState } from "react";
import { toast } from "react-toastify";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";

export default function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMensagem("");
    setErro("");

    if (!email) {
      setErro("Digite seu e-mail.");
      toast.warning("⚠️ Digite seu e-mail.");
      return;
    }

    setLoading(true);
    toast.info("⏳ Enviando solicitação...");
    try {
      const response = await fetch("http://localhost:3000/api/usuarios/recuperar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.erro || "Erro ao enviar solicitação.");
      }

      setMensagem("Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.");
      toast.success("✅ Instruções enviadas ao e-mail (se cadastrado).");
      setEmail("");
    } catch (err) {
      setErro(err.message);
      toast.error(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-gelo dark:bg-zinc-900 px-4"
      aria-label="Tela de recuperação de senha"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-lousa text-white rounded-2xl shadow-xl p-8 w-full max-w-md space-y-6"
      >
        <h2 className="text-2xl font-bold text-center mb-3">🔐 Recuperar Senha</h2>

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

        <label htmlFor="email" className="sr-only">E-mail</label>
        <input
          id="email"
          type="email"
          placeholder="Digite seu e-mail cadastrado"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (erro) setErro("");
          }}
          className="w-full px-4 py-2 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-lousa"
          autoComplete="email"
          aria-required="true"
        />

        <BotaoPrimario
          type="submit"
          disabled={loading}
          className="w-full"
          aria-label="Enviar instruções de recuperação de senha"
        >
          {loading ? "Enviando..." : "Enviar instruções"}
        </BotaoPrimario>

        <BotaoSecundario
          type="button"
          onClick={() => window.history.back()}
          className="w-full"
          aria-label="Voltar para a tela anterior"
        >
          Voltar
        </BotaoSecundario>
      </form>
    </main>
  );
}
