// ✅ src/pages/RecuperarSenha.jsx
import { useState } from "react";
import { toast } from "react-toastify";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import { apiPost } from "../services/api";

// Cabeçalho compacto + rodapé institucional
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import { Mail } from "lucide-react";

export default function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const emailValido = (v) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

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
    if (!emailValido(emailTrim)) {
      const m = "Informe um e-mail válido.";
      setErro(m);
      toast.warning("⚠️ " + m);
      return;
    }

    setLoading(true);
    toast.info("⏳ Enviando solicitação...");
    try {
      // padronizado com outras rotas: prefixo /api
      await apiPost("/api/usuarios/recuperar-senha", { email: emailTrim });

      const ok = "Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.";
      setMensagem(ok);
      toast.success("✅ Instruções enviadas (se cadastrado).");
      setEmail("");
    } catch (err) {
      const msg =
        err?.data?.erro ||
        err?.data?.message ||
        err?.message ||
        "Erro ao enviar solicitação.";
      setErro(msg);
      toast.error(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900">
      {/* 🟦 Área de conta/usuário = petróleo */}
      <PageHeader title="Recuperar Senha" icon={Mail} variant="petroleo" />

      <main role="main" className="flex-1 flex items-center justify-center px-4">
        <form
          onSubmit={handleSubmit}
          className="bg-lousa text-white rounded-2xl shadow-xl p-8 w-full max-w-md space-y-6"
          aria-label="Formulário de recuperação de senha"
        >
          <h2 className="text-2xl font-bold text-center">🔐 Recuperar Senha</h2>

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

          <label htmlFor="email" className="sr-only">E-mail</label>
          <input
            id="email"
            type="email"
            placeholder="Digite seu e-mail cadastrado"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (erro) setErro(""); }}
            className="w-full px-4 py-2 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-emerald-700"
            autoComplete="email"
            inputMode="email"
            aria-required="true"
          />

          <BotaoPrimario
  type="submit"
  className="w-full"
  aria-label="Enviar instruções de recuperação"
  disabled={loading}
  loading={loading}
  cor="amareloOuro"
  leftIcon={<Mail size={16} />}
>
  {loading ? "Enviando..." : "Enviar instruções"}
</BotaoPrimario>

<BotaoSecundario
  type="button"
  onClick={() => window.history.back()}
  variant="outline"
  className="
    w-full
    !border-[#A7F3D0] !text-[#A7F3D0]
    hover:!bg-[#A7F3D0] hover:!text-[#064E3B]
    focus-visible:!ring-2 focus-visible:!ring-[#A7F3D0]/60
    disabled:opacity-60 disabled:cursor-not-allowed
  "
>
  Voltar
</BotaoSecundario>
        </form>
      </main>

      {/* Rodapé institucional */}
      <Footer />
    </div>
  );
}
