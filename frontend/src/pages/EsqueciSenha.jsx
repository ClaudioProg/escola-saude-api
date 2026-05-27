// ✅ frontend/src/pages/EsqueciSenha.jsx — v2.1
// Atualizado em: 21/05/2026
// Plataforma Escola da Saúde

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Clock,
  Info,
  Mail,
  Sparkles,
} from "lucide-react";

import Footer from "../components/layout/Footer";
import useEscolaTheme from "../hooks/useEscolaTheme";
import { apiEsqueciSenha } from "../services/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COOLDOWN_KEY = "esqueciSenha:cooldownUntil";
const COOLDOWN_SECONDS = 30;

const SAFE_MESSAGE =
  "Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizarEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function emailValido(value) {
  return EMAIL_RE.test(normalizarEmail(value));
}

function SpinnerLocal() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]"
      aria-hidden="true"
    />
  );
}

const BotaoLocal = forwardRef(function BotaoLocal(
  {
    children,
    variant = "primary",
    className = "",
    leftIcon = null,
    loading = false,
    disabled = false,
    ...props
  },
  ref
) {
  const base =
    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition focus:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60";

  const variants = {
    primary:
      "bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-600 text-white shadow-lg shadow-emerald-950/15 hover:brightness-110 focus-visible:ring-emerald-500/25",
    secondary:
      "border border-slate-200 bg-white/80 text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:ring-emerald-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:hover:bg-white/[0.07]",
    neutral:
      "border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 focus-visible:ring-emerald-500/20 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-white/5",
  };

  return (
    <button
      ref={ref}
      className={cx(base, variants[variant] || variants.primary, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <SpinnerLocal /> : leftIcon}
      {children}
    </button>
  );
});

function HeaderHero({ isDark }) {
  return (
    <header
      className="relative px-4 pt-4 sm:px-6"
      role="banner"
      aria-label="Cabeçalho de recuperação de acesso"
    >
      <div
        className={cx(
          "relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] border backdrop-blur-xl",
          "shadow-[0_30px_120px_-40px_rgba(15,23,42,.85)]",
          isDark
            ? "border-white/10 bg-white/[0.03]"
            : "border-white/70 bg-white/20"
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#10b981_0%,#0f766e_45%,#0369a1_100%)]" />
        {isDark ? <div className="absolute inset-0 bg-black/35" /> : null}

        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'%3E%3Cg fill='white' fill-opacity='1'%3E%3Ccircle cx='1' cy='1' r='1'/%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />

        <div
          className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/16 blur-3xl"
          aria-hidden="true"
        />

        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white shadow"
        >
          Pular para o conteúdo
        </a>

        <div className="relative px-5 py-7 text-center sm:px-8 md:py-8">
          <div className="flex flex-col items-center gap-4">
            <div className="inline-flex rounded-[1.75rem] bg-white p-3 shadow-xl ring-1 ring-white/80">
              <img
                src="/logo_escola.png"
                alt="Logotipo da Escola Municipal de Saúde Pública de Santos"
                className="h-16 w-16 object-contain sm:h-20 sm:w-20"
                loading="eager"
              />
            </div>

            <div className="inline-flex items-center gap-2 text-xs font-semibold text-white/90">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>Portal oficial • recuperação segura</span>
            </div>

            <h1 className="max-w-6xl whitespace-nowrap text-2xl font-black tracking-[-0.035em] text-white md:text-4xl">
              Esqueci minha senha
            </h1>

            <p className="max-w-2xl text-sm leading-relaxed text-white/90 md:text-base">
              Informe seu e-mail cadastrado para receber as instruções de
              redefinição.
            </p>
          </div>
        </div>

        <div className="h-px w-full bg-white/25" aria-hidden="true" />
      </div>
    </header>
  );
}

function InfoCard({ isDark }) {
  return (
    <aside
      className={cx(
        "overflow-hidden rounded-3xl border transition-all",
        isDark
          ? "border-white/10 bg-white/[0.04] backdrop-blur-xl"
          : "border-white/80 bg-white/85 shadow-[0_12px_40px_-24px_rgba(15,23,42,.16)] backdrop-blur"
      )}
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500/45 via-teal-500/20 to-transparent" />

      <div className="p-6">
        <div className="mb-4 flex items-center justify-center gap-2 text-center">
          <BadgeCheck
            className={cx(
              "h-5 w-5",
              isDark ? "text-emerald-300" : "text-emerald-700"
            )}
            aria-hidden="true"
          />
          <h2
            className={cx(
              "text-base font-extrabold",
              isDark ? "text-zinc-100" : "text-slate-900"
            )}
          >
            Como funciona
          </h2>
        </div>

        <ul
          className={cx(
            "space-y-2 text-sm leading-6",
            isDark ? "text-zinc-300" : "text-slate-700"
          )}
        >
          <li>• Informe o e-mail usado no cadastro.</li>
          <li>• Enviaremos um link de redefinição, se o e-mail existir.</li>
          <li>
            • Verifique também <strong>Spam</strong> e <strong>Lixeira</strong>.
          </li>
          <li>• O link expira após período limitado.</li>
        </ul>

        <div
          className={cx(
            "mt-4 flex gap-2 rounded-2xl border p-3 text-xs",
            isDark
              ? "border-white/10 bg-white/5 text-zinc-200"
              : "border-slate-200 bg-slate-50 text-slate-700"
          )}
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Por segurança, a plataforma <strong>não informa</strong> se o e-mail
            existe na base.
          </p>
        </div>
      </div>
    </aside>
  );
}

function ModalNaoRecebiEmail({
  open,
  onClose,
  onResend,
  cooldown,
  loading,
  isDark,
}) {
  const firstRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const timer = setTimeout(() => firstRef.current?.focus?.(), 80);

    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-nao-recebi"
      aria-describedby="desc-nao-recebi"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar modal"
      />

      <div
        className={cx(
          "relative w-full max-w-md rounded-3xl border p-6 shadow-2xl backdrop-blur-xl",
          isDark
            ? "border-white/10 bg-zinc-950/92 text-zinc-100"
            : "border-white/80 bg-white/95 text-slate-900"
        )}
      >
        <h3
          id="titulo-nao-recebi"
          className="mb-2 text-center text-lg font-extrabold"
        >
          Não recebeu o e-mail?
        </h3>

        <p
          id="desc-nao-recebi"
          className={cx(
            "mb-4 text-center text-sm",
            isDark ? "text-zinc-300" : "text-slate-600"
          )}
        >
          Antes de reenviar, confira:
        </p>

        <ul
          className={cx(
            "space-y-2 text-sm",
            isDark ? "text-zinc-300" : "text-slate-700"
          )}
        >
          <li>• Verifique Spam e Lixeira.</li>
          <li>• Aguarde até 5 minutos.</li>
          <li>• Confirme se o e-mail foi digitado corretamente.</li>
          <li>• Domínios institucionais podem filtrar mensagens.</li>
        </ul>

        <div className="mt-5 flex flex-col gap-2">
          <BotaoLocal
            ref={firstRef}
            type="button"
            onClick={onResend}
            disabled={cooldown > 0 || loading}
            loading={loading}
            className="w-full"
          >
            {cooldown > 0 ? `Aguarde ${cooldown}s` : "Reenviar e-mail"}
          </BotaoLocal>

          <BotaoLocal
            type="button"
            variant="neutral"
            onClick={onClose}
            className="w-full"
          >
            Fechar
          </BotaoLocal>
        </div>
      </div>
    </div>
  );
}

export default function EsqueciSenha() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { isDark } = useEscolaTheme();

  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [abrirNaoRecebi, setAbrirNaoRecebi] = useState(false);

  const liveRef = useRef(null);
  const inputRef = useRef(null);

  const anim = useMemo(
    () => ({
      initial: reduceMotion ? false : { opacity: 0, y: 10 },
      animate: reduceMotion ? {} : { opacity: 1, y: 0 },
      transition: { duration: 0.35 },
    }),
    [reduceMotion]
  );

  const inputCls = useCallback(
    (hasError) =>
      cx(
        "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-all duration-200",
        "focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20",
        isDark
          ? "border-white/10 bg-black/30 text-zinc-100 placeholder:text-zinc-500"
          : "border-slate-300 bg-white/90 text-slate-900 shadow-sm placeholder:text-slate-400",
        hasError ? "border-red-500/60 ring-2 ring-red-500/60" : ""
      ),
    [isDark]
  );

  const setLive = useCallback((message) => {
    if (liveRef.current) liveRef.current.textContent = message || "";
  }, []);

  const startCooldown = useCallback((seconds) => {
    setCooldown(seconds);

    try {
      sessionStorage.setItem(
        COOLDOWN_KEY,
        String(Date.now() + seconds * 1000)
      );
    } catch {
      // Sem persistência de cooldown quando sessionStorage estiver indisponível.
    }
  }, []);

  const fail = useCallback(
    (message) => {
      setErro(message);
      setMensagem("");
      setLive(message);
      toast.warning(message);
      inputRef.current?.focus?.();
    },
    [setLive]
  );

  const enviarSolicitacao = useCallback(
    async ({ closeModal = false } = {}) => {
      if (loading || cooldown > 0) return;

      const emailTrim = normalizarEmail(email);

      if (!emailTrim) {
        fail("Digite seu e-mail.");
        return;
      }

      if (!emailValido(emailTrim)) {
        fail("Informe um e-mail válido.");
        return;
      }

      if (closeModal) setAbrirNaoRecebi(false);

      setLoading(true);
      setErro("");
      setMensagem("");
      setLive("Enviando solicitação…");

      try {
        await apiEsqueciSenha({ email: emailTrim });

        setMensagem(SAFE_MESSAGE);
        setErro("");
        setLive("Solicitação enviada.");
        toast.success("Instruções enviadas, se o e-mail estiver cadastrado.");
        startCooldown(COOLDOWN_SECONDS);
      } catch (error) {
        console.error("[EsqueciSenha] erro ao solicitar recuperação", error);

        setMensagem(SAFE_MESSAGE);
        setErro("");
        setLive("Solicitação enviada.");
        toast.success("Instruções enviadas, se o e-mail estiver cadastrado.");
        startCooldown(COOLDOWN_SECONDS);
      } finally {
        setLoading(false);
      }
    },
    [cooldown, email, fail, loading, setLive, startCooldown]
  );

  useEffect(() => {
    document.title = "Esqueci minha senha — Escola da Saúde";

    const timer = setTimeout(() => inputRef.current?.focus?.(), 80);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      const until = Number(sessionStorage.getItem(COOLDOWN_KEY) || 0);
      const diff = Math.ceil((until - Date.now()) / 1000);

      if (diff > 0) setCooldown(diff);
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    if (!cooldown) return undefined;

    const timer = setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(event) {
    event.preventDefault();
    await enviarSolicitacao();
  }

  return (
    <main
      className={cx(
        "relative flex min-h-screen flex-col overflow-hidden transition-colors",
        isDark ? "bg-[#030712] text-zinc-100" : "bg-[#f6f8fb] text-slate-900"
      )}
    >
      <div
        aria-hidden="true"
        className={cx(
          "pointer-events-none absolute inset-0 overflow-hidden",
          isDark ? "opacity-100" : "opacity-70"
        )}
      >
        <div className="absolute left-[-10%] top-[-10%] h-[28rem] w-[28rem] rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute right-[-8%] top-[10%] h-[26rem] w-[26rem] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[-15%] left-[20%] h-[24rem] w-[24rem] rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div
        aria-hidden="true"
        className={cx(
          "pointer-events-none absolute inset-0",
          isDark
            ? "bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)]"
            : "bg-[linear-gradient(rgba(15,23,42,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,.025)_1px,transparent_1px)]"
        )}
        style={{ backgroundSize: "36px 36px" }}
      />

      <div className="relative flex min-h-screen flex-col">
        <HeaderHero isDark={isDark} />

        <p ref={liveRef} className="sr-only" aria-live="polite" />

        <section id="conteudo" className="flex-1">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <motion.div {...anim}>
                  <InfoCard isDark={isDark} />
                </motion.div>
              </div>

              <div className="lg:col-span-7">
                <motion.div
                  {...anim}
                  className={cx(
                    "rounded-3xl border p-6 transition-colors md:p-8",
                    isDark
                      ? "border-white/10 bg-white/[0.04] shadow-[0_20px_80px_-40px_rgba(0,0,0,.85)] backdrop-blur-xl"
                      : "border-white/80 bg-white/85 shadow-[0_20px_60px_-30px_rgba(15,23,42,.18)] backdrop-blur-xl"
                  )}
                >
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex items-center gap-3">
                      <div
                        className={cx(
                          "flex h-12 w-12 items-center justify-center rounded-2xl border",
                          isDark
                            ? "border-white/10 bg-emerald-500/10"
                            : "border-emerald-100 bg-emerald-50"
                        )}
                        aria-hidden="true"
                      >
                        <Mail
                          className={cx(
                            "h-6 w-6",
                            isDark ? "text-emerald-300" : "text-emerald-700"
                          )}
                        />
                      </div>

                      <div>
                        <h2 className="text-lg font-extrabold md:text-xl">
                          Enviar instruções
                        </h2>
                        <p
                          className={cx(
                            "text-xs",
                            isDark ? "text-zinc-300" : "text-slate-500"
                          )}
                        >
                          A resposta é neutra para proteger os dados dos
                          usuários.
                        </p>
                      </div>
                    </div>
                  </div>

                  <form
                    onSubmit={handleSubmit}
                    className="mt-6 space-y-5"
                    aria-label="Formulário para redefinição de senha"
                    aria-busy={loading ? "true" : "false"}
                    noValidate
                  >
                    {mensagem || erro ? (
                      <div aria-live="polite">
                        {mensagem ? (
                          <p
                            className={cx(
                              "rounded-2xl border px-4 py-3 text-center text-sm font-semibold",
                              isDark
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            )}
                            role="status"
                          >
                            {mensagem}
                          </p>
                        ) : null}

                        {erro ? (
                          <p
                            className={cx(
                              "rounded-2xl border px-4 py-3 text-center text-sm font-semibold",
                              isDark
                                ? "border-red-500/20 bg-red-500/10 text-red-300"
                                : "border-red-200 bg-red-50 text-red-600"
                            )}
                            role="alert"
                          >
                            {erro}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-semibold"
                      >
                        E-mail
                      </label>

                      <input
                        id="email"
                        ref={inputRef}
                        type="email"
                        placeholder="Digite seu e-mail cadastrado"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          if (erro) setErro("");
                        }}
                        onPaste={(event) => {
                          const pasted = (
                            event.clipboardData.getData("text") || ""
                          ).trim();

                          if (pasted) {
                            event.preventDefault();
                            setEmail(pasted);
                          }
                        }}
                        className={inputCls(!!erro)}
                        autoComplete="email"
                        inputMode="email"
                        aria-required="true"
                        aria-invalid={!!erro}
                        aria-describedby={erro ? "erro-email" : "dica-email"}
                      />

                      {erro ? (
                        <p
                          id="erro-email"
                          className={cx(
                            "mt-1 text-xs",
                            isDark ? "text-red-300" : "text-red-600"
                          )}
                        >
                          {erro}
                        </p>
                      ) : (
                        <p
                          id="dica-email"
                          className={cx(
                            "mt-1 text-[11px]",
                            isDark ? "text-zinc-400" : "text-slate-500"
                          )}
                        >
                          Ex.: nome.sobrenome@santos.sp.gov.br
                        </p>
                      )}
                    </div>

                    <div
                      className={cx(
                        "flex gap-2 rounded-2xl border p-3 text-xs",
                        isDark
                          ? "border-white/10 bg-white/5 text-zinc-200"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      )}
                    >
                      <Clock
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <p>
                        {cooldown > 0
                          ? `Aguarde ${cooldown}s para solicitar novamente.`
                          : "Você pode solicitar novamente se necessário."}
                      </p>
                    </div>

                    <BotaoLocal
                      type="submit"
                      className="w-full"
                      aria-label="Enviar instruções de recuperação"
                      disabled={loading || cooldown > 0}
                      loading={loading}
                      leftIcon={<Mail size={16} aria-hidden="true" />}
                    >
                      {loading
                        ? "Enviando..."
                        : cooldown > 0
                          ? `Aguarde ${cooldown}s`
                          : "Enviar instruções"}
                    </BotaoLocal>

                    <button
                      type="button"
                      onClick={() => setAbrirNaoRecebi(true)}
                      className={cx(
                        "block w-full rounded-xl px-3 py-2 text-center text-xs font-semibold underline underline-offset-2 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/70",
                        isDark
                          ? "text-emerald-300 hover:bg-white/5"
                          : "text-emerald-700 hover:bg-emerald-50"
                      )}
                    >
                      Não recebi o e-mail
                    </button>

                    <BotaoLocal
                      type="button"
                      variant="secondary"
                      onClick={() => navigate("/login")}
                      className="w-full"
                      aria-label="Voltar para o login"
                      leftIcon={<ArrowLeft className="h-4 w-4 shrink-0" />}
                    >
                      Voltar para login
                    </BotaoLocal>

                    <div
                      className={cx(
                        "mt-1 flex gap-2 rounded-2xl border p-3 text-xs",
                        isDark
                          ? "border-white/10 bg-white/5 text-zinc-200"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      )}
                    >
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <p>
                        Se você não solicitou isso, ignore a mensagem. Nenhuma
                        alteração ocorre sem acessar o link.
                      </p>
                    </div>
                  </form>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        <ModalNaoRecebiEmail
          open={abrirNaoRecebi}
          onClose={() => setAbrirNaoRecebi(false)}
          onResend={() => enviarSolicitacao({ closeModal: true })}
          cooldown={cooldown}
          loading={loading}
          isDark={isDark}
        />

        <Footer />
      </div>
    </main>
  );
}