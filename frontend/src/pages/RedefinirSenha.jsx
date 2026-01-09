// ✅ src/pages/RedefinirSenha.jsx — premium (kit base Escola) + a11y + motion-safe + UX (checklist, caps lock, barra, evitar vazamento)
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion, useReducedMotion } from "framer-motion";
import {
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  LogIn,
  Sparkles,
  BadgeCheck,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
} from "lucide-react";

import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import Footer from "../components/Footer";
import { apiPost } from "../services/api";

import useEscolaTheme from "../hooks/useEscolaTheme";
import ThemeTogglePills from "../components/ThemeTogglePills";

/* ───────── helpers ───────── */
const cx = (...c) => c.filter(Boolean).join(" ");

const SENHA_FORTE_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

const avaliarForca = (s) => {
  const v = String(s || "");
  let score = 0;
  if (v.length >= 8) score++;
  if (/[A-Z]/.test(v)) score++;
  if (/[a-z]/.test(v)) score++;
  if (/\d/.test(v)) score++;
  if (/[\W_]/.test(v)) score++;
  return Math.min(score, 5);
};

const textoForca = (n) => ["Muito fraca", "Fraca", "Ok", "Boa", "Forte", "Excelente"][n] || "—";

function Rule({ ok, children, isDark }) {
  return (
    <div className={cx("flex items-start gap-2 text-xs", isDark ? "text-zinc-300" : "text-slate-600")}>
      {ok ? (
        <CheckCircle2 className={cx("w-4 h-4 mt-0.5", isDark ? "text-emerald-300" : "text-emerald-700")} aria-hidden="true" />
      ) : (
        <XCircle className={cx("w-4 h-4 mt-0.5", isDark ? "text-zinc-500" : "text-slate-400")} aria-hidden="true" />
      )}
      <span>{children}</span>
    </div>
  );
}

/* ───────── HeaderHero premium (âmbar exclusivo) ───────── */
function HeaderHero({ theme, setTheme, isDark }) {
  return (
    <header className="relative overflow-hidden" role="banner" aria-label="Cabeçalho de redefinição de senha">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-700 via-amber-800 to-orange-700" />
      {isDark && <div className="absolute inset-0 bg-black/35" />}

      {/* blobs */}
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/15 blur-3xl" aria-hidden="true" />

      {/* skip link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white shadow"
      >
        Pular para o conteúdo
      </a>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-12">
        {/* toggle */}
        <div className="lg:absolute lg:right-4 lg:top-6 flex justify-end">
          <ThemeTogglePills theme={theme} setTheme={setTheme} variant="glass" />
        </div>

        {/* logo lateral */}
        <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 hidden sm:flex" aria-hidden="true">
          <div className="rounded-3xl bg-white/25 backdrop-blur p-5 ring-1 ring-white/30 shadow-lg">
            <img src="/logo_escola.png" alt="" className="h-20 w-20 md:h-24 md:w-24 object-contain" loading="lazy" />
          </div>
        </div>

        {/* conteúdo central */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="inline-flex items-center gap-2 text-white/90 text-xs font-semibold">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>Portal oficial • segurança da conta</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Redefinir senha</h1>

          <p className="text-sm text-white/90 max-w-2xl">
            Defina uma nova senha forte para proteger sua conta.
          </p>

          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              Segurança reforçada
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-xs font-semibold">
              <BadgeCheck className="w-4 h-4" aria-hidden="true" />
              Boas práticas
            </span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* ───────── Página ───────── */
export default function RedefinirSenha() {
  const { token } = useParams();
  const navigate = useNavigate();

  const { theme, setTheme, isDark } = useEscolaTheme();
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

  const setLive = useCallback((t) => {
    if (liveRef.current) liveRef.current.textContent = t || "";
  }, []);

  useEffect(() => {
    document.title = "Redefinir senha — Escola da Saúde";
  }, []);

  const tokenValido = useMemo(() => typeof token === "string" && token.trim().length > 0, [token]);

  useEffect(() => {
    if (!tokenValido) {
      const msg = "Link inválido ou expirado. Solicite uma nova recuperação.";
      setErro(msg);
      setMensagem("");
      setLive(msg);
    }
  }, [tokenValido, setLive]);

  const s1 = useMemo(() => novaSenha.trim(), [novaSenha]);
  const s2 = useMemo(() => confirmarSenha.trim(), [confirmarSenha]);

  const forca = useMemo(() => avaliarForca(s1), [s1]);

  const regras = useMemo(
    () => ({
      len: s1.length >= 8,
      upper: /[A-Z]/.test(s1),
      lower: /[a-z]/.test(s1),
      digit: /\d/.test(s1),
      sym: /[\W_]/.test(s1),
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
        "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition",
        "focus:ring-2 focus:ring-amber-500/70",
        isDark
          ? "border-white/10 bg-zinc-950/30 text-zinc-100 placeholder:text-zinc-500"
          : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400",
        invalid ? "ring-2 ring-red-500/60 border-red-500/60" : ""
      ),
    [isDark]
  );

  const fail = useCallback(
    (m, focusRef) => {
      setErro(m);
      setMensagem("");
      setLive(m);
      toast.warning("⚠️ " + m);
      setTimeout(() => focusRef?.current?.focus?.(), 0);
    },
    [setLive]
  );

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (loading) return;

      setErro("");
      setMensagem("");

      if (!tokenValido) return fail("Link inválido ou expirado. Gere um novo link.", s1Ref);

      if (!s1 || !s2) return fail("Preencha todos os campos.", !s1 ? s1Ref : s2Ref);

      if (!SENHA_FORTE_RE.test(s1))
        return fail("A senha deve ter 8+ caracteres, com maiúscula, minúscula, número e símbolo.", s1Ref);

      if (s1 !== s2) return fail("As senhas não coincidem.", s2Ref);

      setLoading(true);
      setLive("Redefinindo senha…");

      try {
        // ✅ sem "/api" (api.js injeta)
        await apiPost("/usuarios/redefinir-senha", { token, novaSenha: s1 }, { auth: false, on401: "silent" });

        const ok = "Senha redefinida com sucesso! Redirecionando para o login…";
        setMensagem(ok);
        setErro("");
        setLive("Senha redefinida.");
        toast.success("✅ Senha redefinida!");

        setNovaSenha("");
        setConfirmarSenha("");

        setTimeout(() => navigate("/login"), 1500);
      } catch (err) {
        console.error(err);

        // ✅ UX segura: msg consistente (evita detalhes excessivos)
        const msg =
          err?.data?.erro ||
          err?.data?.message ||
          "Não foi possível redefinir a senha. O link pode estar expirado. Solicite uma nova recuperação.";

        setErro(msg);
        setMensagem("");
        setLive("Falha ao redefinir senha.");
        toast.error(`❌ ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    [fail, loading, navigate, s1, s2, setLive, token, tokenValido]
  );

  return (
    <main
      className={cx(
        "min-h-screen flex flex-col transition-colors",
        isDark ? "bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100" : "bg-slate-50 text-slate-900"
      )}
    >
      <HeaderHero theme={theme} setTheme={setTheme} isDark={isDark} />

      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <section id="conteudo" role="main" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 md:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Ajuda (desktop) */}
            <aside className="lg:col-span-5">
              <motion.div {...anim}>
                <div
                  className={cx(
                    "rounded-3xl border p-6",
                    isDark ? "border-white/10 bg-zinc-900/55 hover:bg-white/5" : "border-slate-200 bg-white shadow-sm hover:shadow-md"
                  )}
                >
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <ShieldCheck className={cx("w-5 h-5", isDark ? "text-amber-300" : "text-amber-700")} aria-hidden="true" />
                    <h2 className="text-base font-extrabold">Recomendações</h2>
                  </div>

                  <div className={cx("rounded-2xl border p-4", isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50")}>
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 mt-0.5" aria-hidden="true" />
                      <p className={cx("text-sm", isDark ? "text-zinc-200" : "text-slate-700")}>
                        Use uma senha <strong>única</strong> e não compartilhe com ninguém. Evite datas, nomes e padrões comuns.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Rule ok={regras.len} isDark={isDark}>8+ caracteres</Rule>
                    <Rule ok={regras.upper} isDark={isDark}>1 letra maiúscula</Rule>
                    <Rule ok={regras.lower} isDark={isDark}>1 letra minúscula</Rule>
                    <Rule ok={regras.digit} isDark={isDark}>1 número</Rule>
                    <Rule ok={regras.sym} isDark={isDark}>1 símbolo (ex.: ! @ # %)</Rule>
                  </div>
                </div>
              </motion.div>
            </aside>

            {/* Form */}
            <div className="lg:col-span-7">
              <motion.div
                {...anim}
                className={cx(
                  "rounded-3xl border p-6 md:p-8",
                  isDark ? "border-white/10 bg-zinc-900/50" : "border-slate-200 bg-white shadow-xl"
                )}
              >
                <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading ? "true" : "false"}>
                  {(mensagem || erro) && (
                    <div aria-live="polite">
                      {!!mensagem && (
                        <p className={cx("text-sm text-center", isDark ? "text-emerald-300" : "text-emerald-700")} role="status">
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

                  {/* Nova senha */}
                  <div>
                    <label htmlFor="novaSenha" className="block text-sm font-semibold">
                      Nova senha
                    </label>

                    <div className="relative mt-1">
                      <input
                        id="novaSenha"
                        ref={s1Ref}
                        type={verSenha1 ? "text" : "password"}
                        value={novaSenha}
                        onChange={(e) => setNovaSenha(e.target.value.replace(/\s/g, ""))}
                        onKeyUp={(e) => setCaps1(e.getModifierState?.("CapsLock"))}
                        className={inputCls(!!novaSenha && !atendeRegra)}
                        autoComplete="new-password"
                        required
                        aria-invalid={!!novaSenha && !atendeRegra}
                        aria-describedby="ajuda-senha"
                      />

                      <button
                        type="button"
                        onClick={() => setVerSenha1((v) => !v)}
                        className={cx(
                          "absolute inset-y-0 right-2 my-1 px-3 rounded-xl flex items-center gap-2 text-xs font-semibold",
                          isDark ? "text-zinc-200 hover:bg-white/5" : "text-slate-700 hover:bg-slate-100",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70"
                        )}
                        aria-label={verSenha1 ? "Ocultar senha" : "Mostrar senha"}
                        title={verSenha1 ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {verSenha1 ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                      </button>
                    </div>

                    {caps1 && (
                      <p className={cx("text-[11px] mt-1 flex items-center gap-1", isDark ? "text-amber-300" : "text-amber-700")}>
                        <AlertTriangle size={12} aria-hidden="true" /> Caps Lock ativado
                      </p>
                    )}

                    <div className="mt-2" id="ajuda-senha">
                      <div className={cx("h-2 w-full rounded bg-black/10 overflow-hidden", isDark ? "bg-white/10" : "bg-black/10")}>
                        <div className={cx("h-full transition-all", barraCls)} style={{ width: `${(forca / 5) * 100}%` }} />
                      </div>
                      <div className={cx("mt-1 flex items-center justify-between text-[11px]", isDark ? "text-zinc-300" : "text-slate-600")}>
                        <span>Força: <strong>{textoForca(forca)}</strong></span>
                        <span className={cx("inline-flex items-center gap-1", atendeRegra ? (isDark ? "text-emerald-300" : "text-emerald-700") : "")}>
                          {atendeRegra ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> : null}
                          {atendeRegra ? "Regras ok" : "Atenda as regras"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Confirmar senha */}
                  <div>
                    <label htmlFor="confirmarSenha" className="block text-sm font-semibold">
                      Confirmar nova senha
                    </label>

                    <div className="relative mt-1">
                      <input
                        id="confirmarSenha"
                        ref={s2Ref}
                        type={verSenha2 ? "text" : "password"}
                        value={confirmarSenha}
                        onChange={(e) => setConfirmarSenha(e.target.value.replace(/\s/g, ""))}
                        onKeyUp={(e) => setCaps2(e.getModifierState?.("CapsLock"))}
                        className={inputCls(!!confirmarSenha && !senhasIguais)}
                        autoComplete="new-password"
                        required
                        aria-invalid={!!confirmarSenha && !senhasIguais}
                        aria-describedby="ajuda-confirmacao"
                      />

                      <button
                        type="button"
                        onClick={() => setVerSenha2((v) => !v)}
                        className={cx(
                          "absolute inset-y-0 right-2 my-1 px-3 rounded-xl flex items-center gap-2 text-xs font-semibold",
                          isDark ? "text-zinc-200 hover:bg-white/5" : "text-slate-700 hover:bg-slate-100",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70"
                        )}
                        aria-label={verSenha2 ? "Ocultar senha" : "Mostrar senha"}
                        title={verSenha2 ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {verSenha2 ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                      </button>
                    </div>

                    {caps2 && (
                      <p className={cx("text-[11px] mt-1 flex items-center gap-1", isDark ? "text-amber-300" : "text-amber-700")}>
                        <AlertTriangle size={12} aria-hidden="true" /> Caps Lock ativado
                      </p>
                    )}

                    <div id="ajuda-confirmacao" className="mt-1">
                      {!!confirmarSenha && !senhasIguais ? (
                        <p className={cx("text-xs", isDark ? "text-red-300" : "text-red-600")}>
                          As senhas não coincidem.
                        </p>
                      ) : !!confirmarSenha && senhasIguais ? (
                        <p className={cx("text-xs flex items-center gap-1", isDark ? "text-emerald-300" : "text-emerald-700")}>
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Senhas conferem.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <BotaoPrimario
                    type="submit"
                    className="w-full"
                    loading={loading}
                    disabled={loading || !tokenValido}
                    cor="amareloOuro"
                    leftIcon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock size={16} />}
                    aria-label="Redefinir senha"
                  >
                    {loading ? "Salvando..." : "Redefinir senha"}
                  </BotaoPrimario>

                  <BotaoSecundario
                    type="button"
                    onClick={() => navigate("/login")}
                    className={cx(
                      "w-full rounded-2xl py-3 flex items-center justify-center gap-2",
                      "focus-visible:ring-2 focus-visible:ring-amber-500/60 transition"
                    )}
                    aria-label="Voltar ao login"
                  >
                    <LogIn size={16} aria-hidden="true" />
                    Voltar ao login
                  </BotaoSecundario>
                </form>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
