// ✅ src/pages/RecuperarSenha.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { Mail, ExternalLink } from "lucide-react";

import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import Footer from "../components/Footer";
import { apiPost } from "../services/api";

/* ───────── HeaderHero padronizado ───────── */
function HeaderHero() {
  // Gradiente exclusivo desta página (sky → cyan → teal)
  const grad = "from-sky-700 via-cyan-700 to-teal-600";
  return (
    <header className={`w-full bg-gradient-to-br ${grad} text-white`} role="banner">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Pular para o conteúdo
      </a>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="inline-flex items-center gap-2">
            <Mail className="w-5 h-5" aria-hidden="true" />
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Recuperar Senha
            </h1>
          </div>
          <p className="text-sm text-white/90 max-w-2xl">
            Informe seu e-mail cadastrado para receber um link de redefinição.
          </p>
        </div>
      </div>
    </header>
  );
}

/* ───────── Página ───────── */
export default function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0); // anti-spam leve

  const liveRef = useRef(null);
  const inputRef = useRef(null);

  const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

  useEffect(() => {
    document.title = "Recuperar Senha | Escola da Saúde";
    // foco no input ao entrar
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // cooldown decrescente
  useEffect(() => {
    if (!cooldown) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const setLive = useCallback((msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading || cooldown > 0) return;

    setMensagem("");
    setErro("");

    const emailTrim = String(email).trim();
    if (!emailTrim) {
      const m = "Digite seu e-mail.";
      setErro(m);
      setLive(m);
      toast.warning("⚠️ " + m);
      inputRef.current?.focus();
      return;
    }
    if (!emailValido(emailTrim)) {
      const m = "Informe um e-mail válido.";
      setErro(m);
      setLive(m);
      toast.warning("⚠️ " + m);
      inputRef.current?.focus();
      return;
    }

    setLoading(true);
    setLive("Enviando solicitação…");
    toast.info("⏳ Enviando solicitação…");

    try {
      await apiPost("/api/usuarios/recuperar-senha", { email: emailTrim });

      const ok =
        "Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.";
      setMensagem(ok);
      setLive("Solicitação enviada.");
      toast.success("✅ Instruções enviadas (se cadastrado).");
      setEmail("");
      // cooldown de 30s para evitar spam
      setCooldown(30);
    } catch (err) {
      const msg =
        err?.data?.erro ||
        err?.data?.message ||
        err?.message ||
        "Erro ao enviar solicitação.";
      setErro(msg);
      setLive("Falha ao enviar solicitação.");
      toast.error(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  const abrirEmailCliente = () => {
    try {
      window.open("mailto:", "_blank", "noopener,noreferrer");
    } catch {}
  };

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero />

      {/* live region para mensagens curtas */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <main id="conteudo" role="main" className="flex-1 flex items-start justify-center px-4 py-8">
        <form
          onSubmit={handleSubmit}
          className="bg-lousa text-white rounded-2xl shadow-xl p-7 sm:p-8 w-full max-w-md space-y-6"
          aria-label="Formulário de recuperação de senha"
        >
          <h2 className="text-center text-lg font-bold inline-flex items-center justify-center gap-2">
            <Mail className="w-4 h-4" aria-hidden="true" />
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

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              E-mail
            </label>
            <input
              id="email"
              ref={inputRef}
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
              className="w-full px-4 py-2.5 rounded bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-emerald-700"
              autoComplete="email"
              inputMode="email"
              aria-required="true"
              aria-invalid={!!erro}
              aria-describedby={erro ? "erro-email" : undefined}
            />
            {erro && (
              <p id="erro-email" className="text-red-300 text-xs mt-1">
                {erro}
              </p>
            )}
          </div>

          <BotaoPrimario
            type="submit"
            className="w-full"
            aria-label="Enviar instruções de recuperação"
            disabled={loading || cooldown > 0}
            loading={loading}
            cor="amareloOuro"
            leftIcon={<Mail size={16} />}
          >
            {loading ? "Enviando..." : cooldown > 0 ? `Aguarde ${cooldown}s` : "Enviar instruções"}
          </BotaoPrimario>

          <div className="flex flex-col sm:flex-row gap-2">
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

            <button
              type="button"
              onClick={abrirEmailCliente}
              className="w-full inline-flex items-center justify-center gap-2 rounded border border-white/30 px-4 py-2 text-sm hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60"
              aria-label="Abrir seu aplicativo de e-mail"
              title="Abrir cliente de e-mail"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir e-mail
            </button>
          </div>

          <p className="text-[11px] text-white/80 text-center">
            Verifique a caixa de entrada e o spam. O link tem tempo limitado de uso.
          </p>
        </form>
      </main>

      <Footer />
    </div>
  );
}
