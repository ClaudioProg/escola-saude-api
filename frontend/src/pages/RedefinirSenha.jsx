// ✅ frontend/src/pages/RedefinirSenha.jsx — v2.1
// Atualizado em: 21/05/2026
// Plataforma Escola da Saúde
//
// Redefinição de senha via tela /redefinir-senha/:token.
// API oficial: POST /auth/redefinir-senha com token no body.
//
// Revisão premium:
// - alinhado visualmente com Login e EsqueciSenha;
// - header compacto, institucional e arredondado;
// - dark mode real;
// - fundo premium com glow e grid sutil;
// - cards em glassmorphism controlado;
// - inputs com foco premium;
// - sem ThemeTogglePills no cabeçalho;
// - sem badges redundantes;
// - acessível, mobile-first e sem compatibilidade legada.

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Lock,
  LogIn,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

import Footer from "../components/layout/Footer";
import useEscolaTheme from "../hooks/useEscolaTheme";
import { apiRedefinirSenha } from "../services/api";

const IS_DEV =
  typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

const SENHA_FORTE_RE =
  /^(?=\S{8,}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/;

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function debugLog(scope, payload) {
  if (!IS_DEV) return;

  try {
    console.log(scope, payload);
  } catch {
    // noop
  }
}

function maskToken(token) {
  const value = String(token || "");

  if (!value) {
    return {
      present: false,
      length: 0,
      preview: "",
    };
  }

  return {
    present: true,
    length: value.length,
    preview:
      value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : "***",
  };
}

function avaliarForca(value) {
  const senha = String(value || "");
  let score = 0;

  if (senha.length >= 8) score += 1;
  if (/[A-Z]/.test(senha)) score += 1;
  if (/[a-z]/.test(senha)) score += 1;
  if (/\d/.test(senha)) score += 1;
  if (/[^A-Za-z0-9\s]/.test(senha)) score += 1;

  if (/\s/.test(senha)) score = Math.max(0, score - 1);

  return Math.min(score, 5);
}

function textoForca(score) {
  return (
    ["Muito fraca", "Fraca", "Ok", "Boa", "Forte", "Excelente"][score] || "—"
  );
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
      "bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-950/15 hover:brightness-110 focus-visible:ring-amber-500/25",
    secondary:
      "border border-slate-200 bg-white/80 text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:ring-amber-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:hover:bg-white/[0.07]",
    danger:
      "border border-amber-200 bg-amber-50 text-amber-900 shadow-sm hover:bg-amber-100 focus-visible:ring-amber-500/20 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/15",
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

function Rule({ ok, children, isDark }) {
  return (
    <div
      className={cx(
        "flex items-start gap-2 text-xs",
        isDark ? "text-zinc-300" : "text-slate-600"
      )}
    >
      {ok ? (
        <CheckCircle2
          className={cx(
            "mt-0.5 h-4 w-4 shrink-0",
            isDark ? "text-emerald-300" : "text-emerald-700"
          )}
          aria-hidden="true"
        />
      ) : (
        <XCircle
          className={cx(
            "mt-0.5 h-4 w-4 shrink-0",
            isDark ? "text-zinc-500" : "text-slate-400"
          )}
          aria-hidden="true"
        />
      )}

      <span>{children}</span>
    </div>
  );
}

function HeaderHero({ isDark }) {
  return (
    <header
      className="relative px-4 pt-4 sm:px-6"
      role="banner"
      aria-label="Cabeçalho de redefinição de senha"
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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#f59e0b_0%,#d97706_40%,#92400e_100%)]" />
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
              <span>Portal oficial • redefinição segura</span>
            </div>

            <h1 className="text-2xl font-black tracking-[-0.03em] text-white md:text-4xl">
              Redefinir senha
            </h1>

            <p className="max-w-2xl text-sm leading-relaxed text-white/90 md:text-base">
              Defina uma nova senha forte para proteger sua conta institucional.
            </p>
          </div>
        </div>

        <div className="h-px w-full bg-white/25" aria-hidden="true" />
      </div>
    </header>
  );
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  inputRef,
  visible,
  onToggleVisible,
  capsOn,
  setCapsOn,
  invalid,
  describedBy,
  disabled,
  isDark,
  inputCls,
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>

      <div className="relative mt-2">
        <input
          id={id}
          ref={inputRef}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyUp={(event) => setCapsOn(event.getModifierState?.("CapsLock"))}
          onKeyDown={(event) => setCapsOn(event.getModifierState?.("CapsLock"))}
          className={inputCls(invalid)}
          autoComplete="new-password"
          required
          aria-invalid={invalid}
          aria-describedby={describedBy}
          disabled={disabled}
        />

        <button
          type="button"
          onClick={onToggleVisible}
          className={cx(
            "absolute inset-y-0 right-2 my-1 flex items-center gap-2 rounded-xl px-3 text-xs font-semibold transition",
            isDark
              ? "text-zinc-200 hover:bg-white/5"
              : "text-slate-700 hover:bg-slate-100",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70"
          )}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          title={visible ? "Ocultar senha" : "Mostrar senha"}
          disabled={disabled}
        >
          {visible ? (
            <EyeOff size={18} aria-hidden="true" />
          ) : (
            <Eye size={18} aria-hidden="true" />
          )}
        </button>
      </div>

      {capsOn ? (
        <p
          className={cx(
            "mt-1 flex items-center gap-1 text-[11px]",
            isDark ? "text-amber-300" : "text-amber-700"
          )}
        >
          <AlertTriangle size={12} aria-hidden="true" />
          Caps Lock ativado
        </p>
      ) : null}
    </div>
  );
}

export default function RedefinirSenha() {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { isDark } = useEscolaTheme();
  const reduceMotion = useReducedMotion();

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const [verSenha1, setVerSenha1] = useState(false);
  const [verSenha2, setVerSenha2] = useState(false);
  const [caps1, setCaps1] = useState(false);
  const [caps2, setCaps2] = useState(false);

  const liveRef = useRef(null);
  const s1Ref = useRef(null);
  const s2Ref = useRef(null);

  const tokenLimpo = useMemo(() => String(token || "").trim(), [token]);

  const tokenValido = useMemo(() => tokenLimpo.length > 0, [tokenLimpo]);

  const s1 = useMemo(() => String(novaSenha || ""), [novaSenha]);
  const s2 = useMemo(() => String(confirmarSenha || ""), [confirmarSenha]);

  const forca = useMemo(() => avaliarForca(s1), [s1]);

  const regras = useMemo(
    () => ({
      len: s1.length >= 8,
      upper: /[A-Z]/.test(s1),
      lower: /[a-z]/.test(s1),
      digit: /\d/.test(s1),
      sym: /[^A-Za-z0-9\s]/.test(s1),
      noSpaces: !/\s/.test(s1),
    }),
    [s1]
  );

  const atendeRegra = useMemo(() => SENHA_FORTE_RE.test(s1), [s1]);
  const senhasIguais = useMemo(() => !!s1 && s1 === s2, [s1, s2]);

  const barraCls = useMemo(() => {
    if (forca >= 4) return "bg-emerald-400";
    if (forca >= 2) return "bg-amber-300";
    return "bg-rose-300";
  }, [forca]);

  const anim = useMemo(
    () => ({
      initial: reduceMotion ? false : { opacity: 0, y: 10 },
      animate: reduceMotion ? {} : { opacity: 1, y: 0 },
      transition: { duration: 0.35 },
    }),
    [reduceMotion]
  );

  const inputCls = useCallback(
    (invalid) =>
      cx(
        "w-full rounded-2xl border px-4 py-3 pr-14 text-sm outline-none transition-all duration-200",
        "focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20",
        isDark
          ? "border-white/10 bg-black/30 text-zinc-100 placeholder:text-zinc-500"
          : "border-slate-300 bg-white/90 text-slate-900 shadow-sm placeholder:text-slate-400",
        invalid ? "border-red-500/60 ring-2 ring-red-500/60" : ""
      ),
    [isDark]
  );

  const setLive = useCallback((text) => {
    if (liveRef.current) liveRef.current.textContent = text || "";
  }, []);

  const fail = useCallback(
    (message, focusRef) => {
      setErro(message);
      setMensagem("");
      setLive(message);
      toast.warning(message);

      window.setTimeout(() => focusRef?.current?.focus?.(), 0);

      debugLog("[AUTH][REDEFINIR_SENHA_VALIDACAO]", {
        reason: message,
      });
    },
    [setLive]
  );

  useEffect(() => {
    document.title = "Redefinir senha — Escola da Saúde";
  }, []);

  useEffect(() => {
    const masked = maskToken(tokenLimpo);

    debugLog("[AUTH][REDEFINIR_SENHA_MOUNT]", {
      pathname: location.pathname,
      tokenPresent: masked.present,
      tokenLength: masked.length,
      tokenPreview: masked.preview,
      tela: "/redefinir-senha/:token",
      apiOficial: "POST /auth/redefinir-senha",
      tokenNaApi: "body",
    });
  }, [location.pathname, tokenLimpo]);

  useEffect(() => {
    if (!tokenValido) {
      const message = "Link inválido ou expirado. Solicite uma nova recuperação.";

      setErro(message);
      setMensagem("");
      setLive(message);
    }
  }, [setLive, tokenValido]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    setErro("");
    setMensagem("");

    if (!tokenValido) {
      fail("Link inválido ou expirado. Solicite uma nova recuperação.", s1Ref);
      return;
    }

    if (!s1 || !s2) {
      fail("Preencha todos os campos.", !s1 ? s1Ref : s2Ref);
      return;
    }

    if (/\s/.test(s1)) {
      fail("A senha não pode conter espaços.", s1Ref);
      return;
    }

    if (!SENHA_FORTE_RE.test(s1)) {
      fail(
        "A senha deve ter 8+ caracteres, com maiúscula, minúscula, número e símbolo.",
        s1Ref
      );
      return;
    }

    if (s1 !== s2) {
      fail("As senhas não coincidem.", s2Ref);
      return;
    }

    setLoading(true);
    setLive("Redefinindo senha…");

    try {
      await apiRedefinirSenha({
        token: tokenLimpo,
        novaSenha: s1,
      });

      const ok = "Senha redefinida com sucesso. Redirecionando para o login…";

      setMensagem(ok);
      setErro("");
      setLive("Senha redefinida.");
      toast.success("Senha redefinida com sucesso.");

      setNovaSenha("");
      setConfirmarSenha("");

      window.setTimeout(() => navigate("/login"), 1500);
    } catch (error) {
      console.error("[AUTH][REDEFINIR_SENHA_ERRO]", error);

      const message =
        error?.data?.erro ||
        error?.data?.message ||
        error?.message ||
        "Não foi possível redefinir a senha. O link pode estar expirado. Solicite uma nova recuperação.";

      setErro(message);
      setMensagem("");
      setLive("Falha ao redefinir senha.");
      toast.error(message);

      debugLog("[AUTH][REDEFINIR_SENHA_FALHA]", {
        message,
        status: error?.status || null,
      });
    } finally {
      setLoading(false);
    }
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
        <div className="absolute left-[-10%] top-[-10%] h-[28rem] w-[28rem] rounded-full bg-amber-500/15 blur-3xl" />
        <div className="absolute right-[-8%] top-[10%] h-[26rem] w-[26rem] rounded-full bg-orange-500/10 blur-3xl" />
        <div className="absolute bottom-[-15%] left-[20%] h-[24rem] w-[24rem] rounded-full bg-yellow-500/10 blur-3xl" />
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
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 md:py-12">
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
              <aside className="lg:col-span-5">
                <motion.div {...anim}>
                  <div
                    className={cx(
                      "overflow-hidden rounded-3xl border transition-all",
                      isDark
                        ? "border-white/10 bg-white/[0.04] backdrop-blur-xl"
                        : "border-white/80 bg-white/85 shadow-[0_12px_40px_-24px_rgba(15,23,42,.16)] backdrop-blur"
                    )}
                  >
                    <div className="h-1.5 w-full bg-gradient-to-r from-amber-500/45 via-orange-500/20 to-transparent" />

                    <div className="p-6">
                      <div className="mb-3 flex items-center justify-center gap-2">
                        <ShieldCheck
                          className={cx(
                            "h-5 w-5",
                            isDark ? "text-amber-300" : "text-amber-700"
                          )}
                          aria-hidden="true"
                        />
                        <h2 className="text-base font-extrabold">
                          Recomendações
                        </h2>
                      </div>

                      <div
                        className={cx(
                          "rounded-2xl border p-4",
                          isDark
                            ? "border-white/10 bg-white/5"
                            : "border-slate-200 bg-slate-50"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <Info
                            className="mt-0.5 h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          <p
                            className={cx(
                              "text-sm",
                              isDark ? "text-zinc-200" : "text-slate-700"
                            )}
                          >
                            Use uma senha <strong>única</strong>, sem espaços e
                            diferente de senhas usadas em outros serviços.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <Rule ok={regras.len} isDark={isDark}>
                          8+ caracteres
                        </Rule>
                        <Rule ok={regras.upper} isDark={isDark}>
                          1 letra maiúscula
                        </Rule>
                        <Rule ok={regras.lower} isDark={isDark}>
                          1 letra minúscula
                        </Rule>
                        <Rule ok={regras.digit} isDark={isDark}>
                          1 número
                        </Rule>
                        <Rule ok={regras.sym} isDark={isDark}>
                          1 símbolo
                        </Rule>
                        <Rule ok={regras.noSpaces} isDark={isDark}>
                          Sem espaços
                        </Rule>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </aside>

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
                  <form
                    onSubmit={handleSubmit}
                    className="space-y-5"
                    aria-busy={loading ? "true" : "false"}
                    aria-label="Formulário de redefinição de senha"
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
                          <div
                            className={cx(
                              "rounded-2xl border px-4 py-3 text-sm",
                              isDark
                                ? "border-red-500/30 bg-red-500/10 text-red-200"
                                : "border-red-200 bg-red-50 text-red-700"
                            )}
                            role="alert"
                          >
                            <div className="flex items-start gap-2">
                              <AlertTriangle
                                className="mt-0.5 h-4 w-4 shrink-0"
                                aria-hidden="true"
                              />
                              <div className="min-w-0 flex-1">
                                <p>{erro}</p>

                                {!tokenValido ? (
                                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                    <BotaoLocal
                                      type="button"
                                      variant="danger"
                                      onClick={() => navigate("/esqueci-senha")}
                                      className="w-full"
                                      leftIcon={<RefreshCcw size={16} />}
                                      aria-label="Solicitar novo link"
                                    >
                                      Solicitar novo link
                                    </BotaoLocal>

                                    <BotaoLocal
                                      type="button"
                                      variant="secondary"
                                      onClick={() => navigate("/login")}
                                      className="w-full"
                                      leftIcon={<LogIn size={16} />}
                                      aria-label="Voltar ao login"
                                    >
                                      Voltar ao login
                                    </BotaoLocal>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <PasswordInput
                      id="novaSenha"
                      label="Nova senha"
                      value={novaSenha}
                      onChange={setNovaSenha}
                      inputRef={s1Ref}
                      visible={verSenha1}
                      onToggleVisible={() => setVerSenha1((value) => !value)}
                      capsOn={caps1}
                      setCapsOn={setCaps1}
                      invalid={!!novaSenha && !atendeRegra}
                      describedBy="ajuda-senha"
                      disabled={!tokenValido || loading}
                      isDark={isDark}
                      inputCls={inputCls}
                    />

                    <div id="ajuda-senha">
                      <div
                        className={cx(
                          "h-2 w-full overflow-hidden rounded-full",
                          isDark ? "bg-white/10" : "bg-black/10"
                        )}
                      >
                        <div
                          className={cx("h-full transition-all", barraCls)}
                          style={{ width: `${(forca / 5) * 100}%` }}
                        />
                      </div>

                      <div
                        className={cx(
                          "mt-1 flex items-center justify-between text-[11px]",
                          isDark ? "text-zinc-300" : "text-slate-600"
                        )}
                      >
                        <span>
                          Força: <strong>{textoForca(forca)}</strong>
                        </span>

                        <span
                          className={cx(
                            "inline-flex items-center gap-1",
                            atendeRegra
                              ? isDark
                                ? "text-emerald-300"
                                : "text-emerald-700"
                              : ""
                          )}
                        >
                          {atendeRegra ? (
                            <CheckCircle2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          ) : null}
                          {atendeRegra ? "Regras ok" : "Atenda as regras"}
                        </span>
                      </div>
                    </div>

                    <PasswordInput
                      id="confirmarSenha"
                      label="Confirmar nova senha"
                      value={confirmarSenha}
                      onChange={setConfirmarSenha}
                      inputRef={s2Ref}
                      visible={verSenha2}
                      onToggleVisible={() => setVerSenha2((value) => !value)}
                      capsOn={caps2}
                      setCapsOn={setCaps2}
                      invalid={!!confirmarSenha && !senhasIguais}
                      describedBy="ajuda-confirmacao"
                      disabled={!tokenValido || loading}
                      isDark={isDark}
                      inputCls={inputCls}
                    />

                    <div id="ajuda-confirmacao" className="mt-1">
                      {confirmarSenha && !senhasIguais ? (
                        <p
                          className={cx(
                            "text-xs",
                            isDark ? "text-red-300" : "text-red-600"
                          )}
                        >
                          As senhas não coincidem.
                        </p>
                      ) : confirmarSenha && senhasIguais ? (
                        <p
                          className={cx(
                            "flex items-center gap-1 text-xs",
                            isDark ? "text-emerald-300" : "text-emerald-700"
                          )}
                        >
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          Senhas conferem.
                        </p>
                      ) : null}
                    </div>

                    <BotaoLocal
                      type="submit"
                      className="w-full"
                      loading={loading}
                      disabled={loading || !tokenValido}
                      leftIcon={
                        loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Lock size={16} />
                        )
                      }
                      aria-label="Redefinir senha"
                    >
                      {loading ? "Salvando..." : "Redefinir senha"}
                    </BotaoLocal>

                    <BotaoLocal
                      type="button"
                      variant="secondary"
                      onClick={() => navigate("/login")}
                      className="w-full"
                      leftIcon={<LogIn size={16} />}
                      aria-label="Voltar ao login"
                    >
                      Voltar ao login
                    </BotaoLocal>
                  </form>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}