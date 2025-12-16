// ✅ src/pages/RecuperarSenha.jsx — premium (kit base Escola)
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { Mail, Sparkles, BadgeCheck, ArrowLeft } from "lucide-react";

import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import Footer from "../components/Footer";
import { apiPost } from "../services/api";

import useEscolaTheme from "../hooks/useEscolaTheme";
import ThemeTogglePills from "../components/ThemeTogglePills";

/* ───────── HeaderHero premium ───────── */
function HeaderHero({ theme, setTheme, isDark }) {
  return (
    <header className="relative overflow-hidden" role="banner">
      {/* gradiente exclusivo desta página */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-700 via-cyan-700 to-teal-600" />
      {isDark && <div className="absolute inset-0 bg-black/35" />}

      {/* blobs */}
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/25 blur-3xl" />
      <div className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/20 blur-3xl" />

      {/* skip link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50
                   rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white shadow"
      >
        Pular para o conteúdo
      </a>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-12">
        {/* toggle no canto */}
        <div className="lg:absolute lg:right-4 lg:top-6 flex justify-end">
          <ThemeTogglePills theme={theme} setTheme={setTheme} variant="glass" />
        </div>

        {/* logo grande à esquerda (desktop) */}
        <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 hidden sm:flex">
          <div className="rounded-3xl bg-white/25 backdrop-blur p-5 ring-1 ring-white/30 shadow-lg">
            <img
              src="/logo_escola.png"
              alt="Logotipo da Escola Municipal de Saúde Pública de Santos"
              className="h-20 w-20 md:h-24 md:w-24 object-contain"
              loading="lazy"
            />
          </div>
        </div>

        {/* conteúdo central */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="inline-flex items-center gap-2 text-white/90 text-xs font-semibold">
            <Sparkles className="h-4 w-4" />
            <span>Portal oficial • recuperação de acesso</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Recuperar senha
          </h1>

          <p className="text-sm text-white/90 max-w-2xl">
            Informe seu e-mail cadastrado para receber um link de redefinição.
          </p>
        </div>
      </div>
    </header>
  );
}

/* ───────── Modal premium: “Não recebi o e-mail” ───────── */
function ModalNaoRecebiEmail({ open, onClose, onResend, cooldown, isDark }) {
  const firstRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => firstRef.current?.focus(), 80);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-nao-recebi"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* modal */}
      <div
        className={[
          "relative w-full max-w-md rounded-3xl border p-6 shadow-2xl",
          isDark
            ? "bg-zinc-900/85 border-white/10 text-zinc-100"
            : "bg-white border-slate-200 text-slate-900",
        ].join(" ")}
      >
        <h3
          id="titulo-nao-recebi"
          className="text-lg font-extrabold text-center mb-2"
        >
          Não recebeu o e-mail?
        </h3>

        <p
          className={[
            "text-sm text-center mb-4",
            isDark ? "text-zinc-300" : "text-slate-600",
          ].join(" ")}
        >
          Antes de reenviar, confira:
        </p>

        <ul
          className={[
            "text-sm space-y-2",
            isDark ? "text-zinc-300" : "text-slate-700",
          ].join(" ")}
        >
          <li>
            • Verifique <strong>Spam</strong> e <strong>Lixeira</strong>
          </li>
          <li>
            • Aguarde até <strong>5 minutos</strong>
          </li>
          <li>• Confirme se o e-mail foi digitado corretamente</li>
          <li>• Domínios institucionais podem filtrar mensagens</li>
        </ul>

        <div className="mt-5 flex flex-col gap-2">
          <BotaoPrimario
            ref={firstRef}
            type="button"
            onClick={onResend}
            disabled={cooldown > 0}
            className="w-full"
          >
            {cooldown > 0 ? `Aguarde ${cooldown}s` : "Reenviar e-mail"}
          </BotaoPrimario>

          <BotaoSecundario
            type="button"
            onClick={onClose}
            className={[
              "w-full rounded-2xl border py-3 font-extrabold",
              isDark
                ? "border-white/10 bg-zinc-900/40 text-zinc-200 hover:bg-white/5"
                : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100",
            ].join(" ")}
          >
            Fechar
          </BotaoSecundario>
        </div>
      </div>
    </div>
  );
}

/* ───────── Página ───────── */
export default function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0); // anti-spam leve
  const [abrirNaoRecebi, setAbrirNaoRecebi] = useState(false);

  const liveRef = useRef(null);
  const inputRef = useRef(null);

  const { theme, setTheme, isDark } = useEscolaTheme();

  const emailValido = (v) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

  useEffect(() => {
    document.title = "Recuperar senha — Escola da Saúde";
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

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

    try {
      // ✅ sem "/api" aqui (seu api.js já injeta /api)
      await apiPost(
        "/usuarios/recuperar-senha",
        { email: emailTrim },
        { auth: false, on401: "silent" }
      );

      const ok =
        "Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.";
      setMensagem(ok);
      setLive("Solicitação enviada.");
      toast.success("✅ Instruções enviadas (se cadastrado).");
      setEmail("");
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

  // Reenvio: reaproveita o mesmo submit
  const reenviarEmail = async () => {
    if (cooldown > 0 || loading) return;
    setAbrirNaoRecebi(false);

    // reusa a mesma validação/fluxo
    await handleSubmit({
      preventDefault: () => {},
    });
  };

  const inputCls = (hasErr) =>
    [
      "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition",
      "focus:ring-2 focus:ring-teal-500/70",
      isDark
        ? "border-white/10 bg-zinc-950/30 text-zinc-100 placeholder:text-zinc-500"
        : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400",
      hasErr ? "ring-2 ring-red-500/60 border-red-500/60" : "",
    ].join(" ");

  return (
    <main
      className={[
        "min-h-screen flex flex-col transition-colors",
        isDark
          ? "bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100"
          : "bg-slate-50 text-slate-900",
      ].join(" ")}
    >
      <HeaderHero theme={theme} setTheme={setTheme} isDark={isDark} />

      {/* live region */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <section id="conteudo" role="main" className="flex-1">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 md:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* “Dica rápida” (desktop) */}
            <aside className="lg:col-span-5">
              <div
                className={[
                  "rounded-3xl border p-6 transition-all",
                  isDark
                    ? "bg-zinc-900/55 border-white/10 hover:bg-white/5"
                    : "bg-white border-slate-200 shadow-sm hover:shadow-md",
                ].join(" ")}
              >
                <div className="flex items-center justify-center gap-2 mb-3 text-center">
                  <BadgeCheck
                    className={[
                      "h-5 w-5",
                      isDark ? "text-teal-300" : "text-teal-700",
                    ].join(" ")}
                  />
                  <h2
                    className={[
                      "text-base font-extrabold",
                      isDark ? "text-zinc-100" : "text-slate-900",
                    ].join(" ")}
                  >
                    Como funciona
                  </h2>
                </div>

                <ul
                  className={[
                    "text-sm leading-6 space-y-2",
                    isDark ? "text-zinc-300" : "text-slate-700",
                  ].join(" ")}
                >
                  <li>• Você informa o e-mail cadastrado.</li>
                  <li>• Enviamos um link de redefinição (se o e-mail existir).</li>
                  <li>
                    • Verifique também <strong>Spam</strong> e{" "}
                    <strong>Lixeira</strong>.
                  </li>
                  <li>• O link expira após um período limitado.</li>
                </ul>
              </div>
            </aside>

            {/* Form */}
            <div className="lg:col-span-7">
              <div
                className={[
                  "rounded-3xl border p-6 md:p-8 transition-colors",
                  isDark
                    ? "border-white/10 bg-zinc-900/50 shadow-none"
                    : "border-slate-200 bg-white shadow-xl",
                ].join(" ")}
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        "h-12 w-12 rounded-2xl flex items-center justify-center border",
                        isDark
                          ? "bg-teal-500/10 border-white/10"
                          : "bg-teal-50 border-teal-100",
                      ].join(" ")}
                    >
                      <Mail
                        className={[
                          "h-6 w-6",
                          isDark ? "text-teal-300" : "text-teal-700",
                        ].join(" ")}
                      />
                    </div>
                    <div>
                      <h2 className="text-lg md:text-xl font-extrabold">
                        Enviar instruções
                      </h2>
                      <p
                        className={[
                          "text-xs",
                          isDark ? "text-zinc-300" : "text-slate-500",
                        ].join(" ")}
                      >
                        Segurança: sempre mostramos a mesma mensagem, mesmo se o
                        e-mail não existir.
                      </p>
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="mt-6 space-y-5"
                  aria-label="Formulário de recuperação de senha"
                  aria-busy={loading ? "true" : "false"}
                >
                  {(mensagem || erro) && (
                    <div aria-live="polite">
                      {mensagem && (
                        <p
                          className={[
                            "text-sm text-center",
                            isDark
                              ? "text-emerald-300"
                              : "text-emerald-700",
                          ].join(" ")}
                          role="status"
                        >
                          {mensagem}
                        </p>
                      )}
                      {erro && (
                        <p
                          className={[
                            "text-sm text-center",
                            isDark ? "text-red-300" : "text-red-600",
                          ].join(" ")}
                          role="alert"
                        >
                          {erro}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold">
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
                      className={inputCls(!!erro)}
                      autoComplete="email"
                      inputMode="email"
                      aria-required="true"
                      aria-invalid={!!erro}
                      aria-describedby={erro ? "erro-email" : "dica-email"}
                    />

                    {!erro ? (
                      <p
                        id="dica-email"
                        className={[
                          "text-[11px] mt-1",
                          isDark ? "text-zinc-400" : "text-slate-500",
                        ].join(" ")}
                      >
                        Ex.: nome.sobrenome@santos.sp.gov.br
                      </p>
                    ) : (
                      <p
                        id="erro-email"
                        className={[
                          "text-xs mt-1",
                          isDark ? "text-red-300" : "text-red-600",
                        ].join(" ")}
                      >
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
                    {loading
                      ? "Enviando..."
                      : cooldown > 0
                      ? `Aguarde ${cooldown}s`
                      : "Enviar instruções"}
                  </BotaoPrimario>

                  {/* link premium */}
                  <button
                    type="button"
                    onClick={() => setAbrirNaoRecebi(true)}
                    className={[
                      "block w-full text-center text-xs underline underline-offset-2",
                      isDark
                        ? "text-teal-300 hover:opacity-90"
                        : "text-teal-700 hover:opacity-90",
                    ].join(" ")}
                  >
                    Não recebi o e-mail
                  </button>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <BotaoSecundario
                      type="button"
                      onClick={() => window.history.back()}
                      className={[
                        "w-full rounded-2xl border text-sm font-extrabold py-3 flex items-center justify-center gap-2",
                        isDark
                          ? "border-white/10 bg-zinc-900/40 text-zinc-200 hover:bg-white/5"
                          : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100",
                        "focus-visible:ring-2 focus-visible:ring-teal-500/60 transition",
                      ].join(" ")}
                    >
                      <ArrowLeft size={16} />
                      Voltar
                    </BotaoSecundario>
                  </div>

                  <p
                    className={[
                      "text-[11px] text-center mt-2",
                      isDark ? "text-zinc-400" : "text-slate-500",
                    ].join(" ")}
                  >
                    Verifique a caixa de entrada e o spam. O link tem tempo
                    limitado de uso.
                  </p>
                </form>

                <div className="sr-only" aria-live="polite">
                  {loading ? "Enviando solicitação" : ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* modal premium */}
      <ModalNaoRecebiEmail
        open={abrirNaoRecebi}
        onClose={() => setAbrirNaoRecebi(false)}
        onResend={reenviarEmail}
        cooldown={cooldown}
        isDark={isDark}
      />

      <Footer />
    </main>
  );
}
