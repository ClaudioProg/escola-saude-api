// ✅ src/pages/RecuperarSenha.jsx — premium (kit base Escola) + a11y + motion-safe + feedback seguro (não vaza existência)
// Obs: mantém seu fluxo, mas melhora: debounce de focus, modal acessível, cooldown persistente, abort-safe UI, aria-busy.
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { motion, useReducedMotion } from "framer-motion";
import {
  Mail,
  Sparkles,
  BadgeCheck,
  ArrowLeft,
  AlertTriangle,
  Info,
  Clock,
} from "lucide-react";

import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import Footer from "../components/Footer";
import { apiPost } from "../services/api";

import useEscolaTheme from "../hooks/useEscolaTheme";
import ThemeTogglePills from "../components/ThemeTogglePills";

/* ───────── helpers ───────── */
const cx = (...c) => c.filter(Boolean).join(" ");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COOLDOWN_KEY = "recuperarSenha:cooldownUntil";

/* ───────── HeaderHero premium ───────── */
function HeaderHero({ theme, setTheme, isDark }) {
  return (
    <header className="relative overflow-hidden" role="banner" aria-label="Cabeçalho da recuperação de senha">
      {/* gradiente exclusivo desta página */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-700 via-cyan-700 to-teal-600" />
      {isDark && <div className="absolute inset-0 bg-black/35" />}

      {/* blobs */}
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/25 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/20 blur-3xl" aria-hidden="true" />

      {/* skip link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white shadow"
      >
        Pular para o conteúdo
      </a>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-12">
        {/* toggle no canto */}
        <div className="lg:absolute lg:right-4 lg:top-6 flex justify-end">
          <ThemeTogglePills variant="glass" />
        </div>

        {/* logo grande à esquerda (desktop) */}
        <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 hidden sm:flex" aria-hidden="true">
          <div className="rounded-3xl bg-white/25 backdrop-blur p-5 ring-1 ring-white/30 shadow-lg">
            <img
              src="/logo_escola.png"
              alt=""
              className="h-20 w-20 md:h-24 md:w-24 object-contain"
              loading="lazy"
            />
          </div>
        </div>

        {/* conteúdo central */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="inline-flex items-center gap-2 text-white/90 text-xs font-semibold">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
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

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* ───────── Modal premium: “Não recebi o e-mail” ───────── */
function ModalNaoRecebiEmail({ open, onClose, onResend, cooldown, isDark }) {
  const firstRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => firstRef.current?.focus?.(), 80);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-nao-recebi"
      aria-describedby="desc-nao-recebi"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* modal */}
      <div
        className={cx(
          "relative w-full max-w-md rounded-3xl border p-6 shadow-2xl",
          isDark ? "bg-zinc-900/85 border-white/10 text-zinc-100" : "bg-white border-slate-200 text-slate-900"
        )}
      >
        <h3 id="titulo-nao-recebi" className="text-lg font-extrabold text-center mb-2">
          Não recebeu o e-mail?
        </h3>

        <p
          id="desc-nao-recebi"
          className={cx("text-sm text-center mb-4", isDark ? "text-zinc-300" : "text-slate-600")}
        >
          Antes de reenviar, confira:
        </p>

        <ul className={cx("text-sm space-y-2", isDark ? "text-zinc-300" : "text-slate-700")}>
          <li className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>
              Verifique <strong>Spam</strong> e <strong>Lixeira</strong>
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>
              Aguarde até <strong>5 minutos</strong>
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>Confirme se o e-mail foi digitado corretamente</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>Domínios institucionais podem filtrar mensagens</span>
          </li>
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
            className={cx(
              "w-full rounded-2xl border py-3 font-extrabold",
              isDark
                ? "border-white/10 bg-zinc-900/40 text-zinc-200 hover:bg-white/5"
                : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100"
            )}
          >
            Fechar
          </BotaoSecundario>
        </div>
      </div>
    </div>
  );
}

/* ───────── Mini card “Como funciona” ───────── */
function InfoCard({ isDark }) {
  return (
    <div
      className={cx(
        "rounded-3xl border p-6 transition-all",
        isDark ? "bg-zinc-900/55 border-white/10 hover:bg-white/5" : "bg-white border-slate-200 shadow-sm hover:shadow-md"
      )}
    >
      <div className="flex items-center justify-center gap-2 mb-3 text-center">
        <BadgeCheck className={cx("h-5 w-5", isDark ? "text-teal-300" : "text-teal-700")} aria-hidden="true" />
        <h2 className={cx("text-base font-extrabold", isDark ? "text-zinc-100" : "text-slate-900")}>Como funciona</h2>
      </div>

      <ul className={cx("text-sm leading-6 space-y-2", isDark ? "text-zinc-300" : "text-slate-700")}>
        <li>• Você informa o e-mail cadastrado.</li>
        <li>• Enviamos um link de redefinição (se o e-mail existir).</li>
        <li>
          • Verifique também <strong>Spam</strong> e <strong>Lixeira</strong>.
        </li>
        <li>• O link expira após um período limitado.</li>
      </ul>

      <div className={cx("mt-4 rounded-2xl border p-3 text-xs flex gap-2", isDark ? "border-white/10 bg-white/5 text-zinc-200" : "border-slate-200 bg-slate-50 text-slate-700")}>
        <Info className="w-4 h-4 mt-0.5" aria-hidden="true" />
        <p>
          Por segurança, a plataforma <strong>não informa</strong> se o e-mail existe na base.
        </p>
      </div>
    </div>
  );
}

/* ───────── Página ───────── */
export default function RecuperarSenha() {
  const reduceMotion = useReducedMotion();

  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  // cooldown persistente
  const [cooldown, setCooldown] = useState(0);

  const [abrirNaoRecebi, setAbrirNaoRecebi] = useState(false);

  const liveRef = useRef(null);
  const inputRef = useRef(null);

  const { theme, setTheme, isDark } = useEscolaTheme();

  const setLive = useCallback((msg) => {
    if (liveRef.current) liveRef.current.textContent = msg || "";
  }, []);

  const emailValido = useCallback((v) => EMAIL_RE.test(String(v || "").trim()), []);

  const inputCls = useCallback(
    (hasErr) =>
      cx(
        "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition",
        "focus:ring-2 focus:ring-teal-500/70",
        isDark
          ? "border-white/10 bg-zinc-950/30 text-zinc-100 placeholder:text-zinc-500"
          : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400",
        hasErr ? "ring-2 ring-red-500/60 border-red-500/60" : ""
      ),
    [isDark]
  );

  const anim = useMemo(
    () => ({
      initial: reduceMotion ? false : { opacity: 0, y: 10 },
      animate: reduceMotion ? {} : { opacity: 1, y: 0 },
      transition: { duration: 0.35 },
    }),
    [reduceMotion]
  );

  // título + focus
  useEffect(() => {
    document.title = "Recuperar senha — Escola da Saúde";
    const t = setTimeout(() => inputRef.current?.focus?.(), 80);
    return () => clearTimeout(t);
  }, []);

  // recuperar cooldown persistido
  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(COOLDOWN_KEY) || 0);
      const diff = Math.ceil((until - Date.now()) / 1000);
      if (diff > 0) setCooldown(diff);
    } catch {
      // noop
    }
  }, []);

  // timer do cooldown
  useEffect(() => {
    if (!cooldown) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const startCooldown = useCallback((seconds) => {
    setCooldown(seconds);
    try {
      localStorage.setItem(COOLDOWN_KEY, String(Date.now() + seconds * 1000));
    } catch {
      // noop
    }
  }, []);

  const fail = useCallback(
    (msg) => {
      setErro(msg);
      setMensagem("");
      setLive(msg);
      toast.warning("⚠️ " + msg);
      inputRef.current?.focus?.();
    },
    [setLive]
  );

  const okMessage =
    "Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.";

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (loading || cooldown > 0) return;

      setMensagem("");
      setErro("");

      const emailTrim = String(email).trim();
      if (!emailTrim) return fail("Digite seu e-mail.");
      if (!emailValido(emailTrim)) return fail("Informe um e-mail válido.");

      setLoading(true);
      setLive("Enviando solicitação…");

      try {
        // ✅ manter mensagem neutra (não vaza existência do e-mail)
        await apiPost(
          "/usuarios/recuperar-senha",
          { email: emailTrim },
          { auth: false, on401: "silent" }
        );

        setMensagem(okMessage);
        setErro("");
        setLive("Solicitação enviada.");
        toast.success("✅ Instruções enviadas (se cadastrado).");

// ✅ mantém o e-mail preenchido para reenvio/checagem
startCooldown(30);
      } catch (err) {
        // ✅ segurança: evitar mensagem que possa permitir enumeração de usuários
        console.error(err);
        setMensagem(okMessage);
        setErro("");
        setLive("Solicitação enviada.");
        toast.success("✅ Instruções enviadas (se cadastrado).");
        startCooldown(30);
      } finally {
        setLoading(false);
      }
    },
    [cooldown, email, emailValido, fail, loading, setLive, startCooldown]
  );

  // Reenvio
  const reenviarEmail = useCallback(async () => {
    if (cooldown > 0 || loading) return;
  
    const emailTrim = String(email).trim();
    if (!emailTrim) return fail("Digite seu e-mail.");
    if (!emailValido(emailTrim)) return fail("Informe um e-mail válido.");
  
    setAbrirNaoRecebi(false);
    setLoading(true);
    setLive("Reenviando solicitação…");
  
    try {
      await apiPost("/usuarios/recuperar-senha", { email: emailTrim }, { auth: false, on401: "silent" });
  
      setMensagem(okMessage);
      setErro("");
      setLive("Solicitação enviada.");
      toast.success("✅ Instruções enviadas (se cadastrado).");
      startCooldown(30);
    } catch (err) {
      console.error(err);
      setMensagem(okMessage);
      setErro("");
      setLive("Solicitação enviada.");
      toast.success("✅ Instruções enviadas (se cadastrado).");
      startCooldown(30);
    } finally {
      setLoading(false);
    }
  }, [cooldown, loading, email, emailValido, fail, okMessage, setLive, startCooldown]);
  

  return (
    <main
      className={cx(
        "min-h-screen flex flex-col transition-colors",
        isDark ? "bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100" : "bg-slate-50 text-slate-900"
      )}
    >
      <HeaderHero theme={theme} setTheme={setTheme} isDark={isDark} />

      {/* live region */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <section id="conteudo" role="main" className="flex-1">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 md:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* lateral */}
            <aside className="lg:col-span-5">
              <motion.div {...anim}>
                <InfoCard isDark={isDark} />
              </motion.div>
            </aside>

            {/* form */}
            <div className="lg:col-span-7">
              <motion.div
                {...anim}
                className={cx(
                  "rounded-3xl border p-6 md:p-8 transition-colors",
                  isDark ? "border-white/10 bg-zinc-900/50 shadow-none" : "border-slate-200 bg-white shadow-xl"
                )}
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cx(
                        "h-12 w-12 rounded-2xl flex items-center justify-center border",
                        isDark ? "bg-teal-500/10 border-white/10" : "bg-teal-50 border-teal-100"
                      )}
                      aria-hidden="true"
                    >
                      <Mail className={cx("h-6 w-6", isDark ? "text-teal-300" : "text-teal-700")} />
                    </div>

                    <div>
                      <h2 className="text-lg md:text-xl font-extrabold">Enviar instruções</h2>
                      <p className={cx("text-xs", isDark ? "text-zinc-300" : "text-slate-500")}>
                        Segurança: sempre mostramos a mesma mensagem, mesmo se o e-mail não existir.
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
                      {!!mensagem && (
                        <p
                          className={cx("text-sm text-center", isDark ? "text-emerald-300" : "text-emerald-700")}
                          role="status"
                        >
                          {mensagem}
                        </p>
                      )}

                      {!!erro && (
                        <p className={cx("text-sm text-center", isDark ? "text-red-300" : "text-red-600")} role="alert">
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
                      <p id="dica-email" className={cx("text-[11px] mt-1", isDark ? "text-zinc-400" : "text-slate-500")}>
                        Ex.: nome.sobrenome@santos.sp.gov.br
                      </p>
                    ) : (
                      <p id="erro-email" className={cx("text-xs mt-1", isDark ? "text-red-300" : "text-red-600")}>
                        {erro}
                      </p>
                    )}
                  </div>

                  {/* cooldown hint */}
                  <div className={cx("rounded-2xl border p-3 text-xs flex gap-2", isDark ? "border-white/10 bg-white/5 text-zinc-200" : "border-slate-200 bg-slate-50 text-slate-700")}>
                    <Clock className="w-4 h-4 mt-0.5" aria-hidden="true" />
                    <p>
                      {cooldown > 0
                        ? `Aguarde ${cooldown}s para solicitar novamente (proteção contra abuso).`
                        : "Você pode solicitar novamente se necessário."}
                    </p>
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

                  {/* link premium */}
                  <button
                    type="button"
                    onClick={() => setAbrirNaoRecebi(true)}
                    className={cx(
                      "block w-full text-center text-xs underline underline-offset-2",
                      isDark ? "text-teal-300 hover:opacity-90" : "text-teal-700 hover:opacity-90"
                    )}
                  >
                    Não recebi o e-mail
                  </button>

                  <div className="w-full">
                  <button
  type="button"
  onClick={() => window.history.back()}
  className={cx(
    // LARGURA TOTAL + ALINHAMENTO HORIZONTAL
    "w-full inline-flex items-center justify-center gap-2 whitespace-nowrap",
    // ALTURA/RAIO iguais ao padrão
    "rounded-2xl text-sm font-extrabold py-3",
    // VISUAL (dark/light)
    isDark
      ? "bg-emerald-700/40 hover:bg-emerald-700/60 border border-emerald-600/50 text-emerald-100"
      : "bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800",
    // A11y/foco
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 transition"
  )}
  aria-label="Voltar para a página anterior"
>
  <ArrowLeft className="w-4 h-4 shrink-0" />
  <span>Voltar</span>
</button>
                  </div>

                  <div className={cx("mt-1 rounded-2xl border p-3 text-xs flex gap-2", isDark ? "border-white/10 bg-white/5 text-zinc-200" : "border-slate-200 bg-slate-50 text-slate-700")}>
                    <AlertTriangle className="w-4 h-4 mt-0.5" aria-hidden="true" />
                    <p>
                      Se você não solicitou isso, ignore a mensagem. Nenhuma alteração ocorre sem acessar o link.
                    </p>
                  </div>
                </form>
              </motion.div>
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
