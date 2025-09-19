// ✅ src/pages/RecuperarSenha.jsx
import { useState } from "react";
import { toast } from "react-toastify";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import { apiPost } from "../services/api";

// Rodapé institucional
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
    if (loading) return;

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
      await apiPost("/api/usuarios/recuperar-senha", { email: emailTrim });

      const ok =
        "Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.";
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

  // Para mudar a cor do HERO desta página depois, altere as classes from-*/via-*/to-* abaixo.
  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900">
      {/* HERO inline — sem badge, com ícone no título */}
      <section
        aria-label="Seção de destaque"
        className="w-full bg-gradient-to-r from-sky-700 via-cyan-700 to-teal-600 text-white"
      >
        <div className="max-w-6xl mx-auto px-4 py-10 md:py-12">
          <div className="flex flex-col items-center text-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold inline-flex items-center gap-2">
              <Mail size={22} aria-hidden="true" className="translate-y-[1px]" />
              Recuperar Senha
            </h1>
            <p className="text-white/90 max-w-2xl">
              Informe seu e-mail cadastrado para receber um link de redefinição.
            </p>
          </div>
        </div>
      </section>

      {/* Conteúdo */}
      <main role="main" className="flex-1 flex items-start justify-center px-4 py-8">
        <form
          onSubmit={handleSubmit}
          className="bg-lousa text-white rounded-2xl shadow-xl p-8 w-full max-w-md space-y-6"
          aria-label="Formulário de recuperação de senha"
        >
          <h2 className="text-2xl font-bold text-center inline-flex items-center justify-center gap-2">
            <Mail size={20} aria-hidden="true" />
            Recuperar Senha
          </h2>

          {(mensagem || erro) && (
            <div aria-live="polite">
              {mensagem && (
                <p className="text-green-300 text-sm text-center" role="status">
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

          <label htmlFor="email" className="sr-only">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            placeholder="Digite seu e-mail cadastrado"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (erro) setErro("");
            }}
            onPaste={(e) => {
              const t = (e.clipboardData.getData("text") || "").trim();
              if (t) {
                e.preventDefault();
                setEmail(t);
              }
            }}
            className="w-full px-4 py-2.5 rounded bg-white text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-emerald-700"
            autoComplete="email"
            inputMode="email"
            aria-required="true"
            autoFocus
          />

          {/* Primário — alto contraste sobre o lousa */}
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

          {/* Secundário — NÃO verde. Violeta para alto contraste sobre o lousa */}
          <BotaoSecundario
            type="button"
            onClick={() => window.history.back()}
            className="
              w-full
              border border-violet-400 text-violet-300 font-medium
              bg-transparent
              hover:bg-violet-400 hover:text-violet-900
              focus-visible:ring-2 focus-visible:ring-violet-400/60
              rounded
              transition-colors duration-200
            "
          >
            Voltar
          </BotaoSecundario>

          <p className="text-[11px] text-white/80 text-center">
            Verifique sua caixa de entrada e o spam. O link tem tempo limitado de uso.
          </p>
        </form>
      </main>

      <Footer />
    </div>
  );
}
