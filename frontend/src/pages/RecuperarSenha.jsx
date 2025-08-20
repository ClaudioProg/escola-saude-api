// src/pages/RecuperarSenha.jsx
import { useState } from "react";
import { toast } from "react-toastify";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import { apiPost } from "../services/api";

export default function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMensagem("");
    setErro("");

    const emailTrim = String(email).trim();
    if (!emailTrim) {
      const m = "Digite seu e-mail.";
      setErro(m);
      toast.warning("⚠️ " + m);
      return;
    }

    setLoading(true);
    toast.info("⏳ Enviando solicitação...");
    try {
      await apiPost("/usuarios/recuperar-senha", { email: emailTrim });
      setMensagem("Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.");
      toast.success("✅ Instruções enviadas (se cadastrado).");
      setEmail("");
    } catch (err) {
      const msg = err?.data?.erro || err?.data?.message || err?.message || "Erro ao enviar solicitação.";
      setErro(msg);
      toast.error(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gelo dark:bg-zinc-900 px-4">
      <form onSubmit={handleSubmit} className="bg-lousa text-white rounded-2xl shadow-xl p-8 w-full max-w-md space-y-6">
        <h2 className="text-2xl font-bold text-center mb-3">🔐 Recuperar Senha</h2>

        {mensagem && <p className="text-green-300 text-sm text-center" role="alert">{mensagem}</p>}
        {erro && <p className="text-red-300 text-sm text-center" role="alert">{erro}</p>}

        <label htmlFor="email" className="sr-only">E-mail</label>
        <input
          id="email"
          type="email"
          placeholder="Digite seu e-mail cadastrado"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (erro) setErro(""); }}
          className="w-full px-4 py-2 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-lousa"
          autoComplete="email"
          aria-required="true"
        />

        <BotaoPrimario type="submit" disabled={loading} className="w-full">
          {loading ? "Enviando..." : "Enviar instruções"}
        </BotaoPrimario>

        <BotaoSecundario type="button" onClick={() => window.history.back()} className="w-full">
          Voltar
        </BotaoSecundario>
      </form>
    </main>
  );
}
