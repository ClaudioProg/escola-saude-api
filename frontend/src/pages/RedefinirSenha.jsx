// ✅ src/pages/RedefinirSenha.jsx — premium (kit base Escola)
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  LogIn,
  Sparkles,
} from "lucide-react";

import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import Footer from "../components/Footer";
import { apiPost } from "../services/api";

import useEscolaTheme from "../hooks/useEscolaTheme";
import ThemeTogglePills from "../components/ThemeTogglePills";

/* ───────── HeaderHero premium (âmbar exclusivo) ───────── */
function HeaderHero({ theme, setTheme, isDark }) {
  return (
    <header className="relative overflow-hidden" role="banner">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-700 via-amber-800 to-orange-700" />
      {isDark && <div className="absolute inset-0 bg-black/35" />}

      {/* blobs */}
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
      <div className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/15 blur-3xl" />

      {/* skip link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50
                   rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white shadow"
      >
        Pular para o conteúdo
      </a>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-12">
        {/* toggle */}
        <div className="lg:absolute lg:right-4 lg:top-6 flex justify-end">
          <ThemeTogglePills theme={theme} setTheme={setTheme} variant="glass" />
        </div>

        {/* logo lateral */}
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
            <span>Portal oficial • segurança da conta</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Redefinir senha
          </h1>

          <p className="text-sm text-white/90 max-w-2xl">
            Defina uma nova senha forte para proteger sua conta.
          </p>
        </div>
      </div>
    </header>
  );
}

/* ───────── Helpers ───────── */
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
const textoForca = (n) =>
  ["Muito fraca", "Fraca", "Ok", "Boa", "Forte", "Excelente"][n] || "—";

/* ───────── Página ───────── */
export default function RedefinirSenha() {
  const { token } = useParams();
  const navigate = useNavigate();

  const { theme, setTheme, isDark } = useEscolaTheme();

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
    if (liveRef.current) liveRef.current.textContent = t;
  }, []);

  useEffect(() => {
    document.title = "Redefinir senha — Escola da Saúde";
  }, []);

  const tokenValido = useMemo(
    () => typeof token === "string" && token.trim().length > 0,
    [token]
  );

  useEffect(() => {
    if (!tokenValido) {
      const msg = "Link inválido ou expirado. Solicite uma nova recuperação.";
      setErro(msg);
      setLive(msg);
    }
  }, [tokenValido, setLive]);

  const forca = avaliarForca(novaSenha);
  const atendeRegra = SENHA_FORTE_RE.test(novaSenha);
  const senhasIguais =
    novaSenha.trim() && novaSenha.trim() === confirmarSenha.trim();

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setErro("");
    setMensagem("");

    if (!tokenValido) {
      const m = "Link inválido ou expirado. Gere um novo link.";
      setErro(m);
      setLive(m);
      toast.error("❌ " + m);
      return;
    }

    const s1 = novaSenha.trim();
    const s2 = confirmarSenha.trim();

    if (!s1 || !s2) {
      const m = "Preencha todos os campos.";
      setErro(m);
      setLive(m);
      toast.warning("⚠️ " + m);
      (!s1 ? s1Ref : s2Ref).current?.focus();
      return;
    }

    if (!SENHA_FORTE_RE.test(s1)) {
      const m =
        "A senha deve ter 8+ caracteres, com maiúscula, minúscula, número e símbolo.";
      setErro(m);
      setLive(m);
      toast.warning("⚠️ " + m);
      s1Ref.current?.focus();
      return;
    }

    if (s1 !== s2) {
      const m = "As senhas não coincidem.";
      setErro(m);
      setLive(m);
      toast.warning("⚠️ " + m);
      s2Ref.current?.focus();
      return;
    }

    setLoading(true);
    setLive("Redefinindo senha…");

    try {
      // ✅ sem "/api" (api.js injeta)
      await apiPost(
        "/usuarios/redefinir-senha",
        { token, novaSenha: s1 },
        { auth: false, on401: "silent" }
      );

      const ok = "Senha redefinida com sucesso! Redirecionando para o login…";
      setMensagem(ok);
      setLive("Senha redefinida.");
      toast.success("✅ Senha redefinida!");
      setNovaSenha("");
      setConfirmarSenha("");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      const msg =
        err?.data?.erro ||
        err?.data?.message ||
        err?.message ||
        "Erro ao redefinir senha.";
      setErro(msg);
      setLive("Falha ao redefinir senha.");
      toast.error(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  const inputCls = (invalid) =>
    [
      "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition",
      "focus:ring-2 focus:ring-amber-500/70",
      isDark
        ? "border-white/10 bg-zinc-950/30 text-zinc-100 placeholder:text-zinc-500"
        : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400",
      invalid ? "ring-2 ring-red-500/60 border-red-500/60" : "",
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

      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <section id="conteudo" role="main" className="flex-1">
        <div className="mx-auto max-w-xl px-4 sm:px-6 py-8 md:py-12">
          <div
            className={[
              "rounded-3xl border p-6 md:p-8",
              isDark
                ? "border-white/10 bg-zinc-900/50"
                : "border-slate-200 bg-white shadow-xl",
            ].join(" ")}
          >
            <form onSubmit={handleSubmit} className="space-y-5">
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
                    >
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
                    onChange={(e) =>
                      setNovaSenha(e.target.value.replace(/\s/g, ""))
                    }
                    onKeyUp={(e) =>
                      setCaps1(e.getModifierState?.("CapsLock"))
                    }
                    className={inputCls(!atendeRegra && !!novaSenha)}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setVerSenha1((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-zinc-200"
                  >
                    {verSenha1 ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {caps1 && (
                  <p className="text-amber-300 text-[11px] mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} /> Caps Lock ativado
                  </p>
                )}

                <div className="mt-2">
                  <div className="h-2 w-full rounded bg-black/10 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        forca >= 4
                          ? "bg-emerald-400"
                          : forca >= 2
                          ? "bg-amber-300"
                          : "bg-rose-300"
                      }`}
                      style={{ width: `${(forca / 5) * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] mt-1 opacity-80">
                    Força: {textoForca(forca)}
                  </p>
                </div>
              </div>

              {/* Confirmar senha */}
              <div>
                <label
                  htmlFor="confirmarSenha"
                  className="block text-sm font-semibold"
                >
                  Confirmar nova senha
                </label>
                <div className="relative mt-1">
                  <input
                    id="confirmarSenha"
                    ref={s2Ref}
                    type={verSenha2 ? "text" : "password"}
                    value={confirmarSenha}
                    onChange={(e) =>
                      setConfirmarSenha(e.target.value.replace(/\s/g, ""))
                    }
                    onKeyUp={(e) =>
                      setCaps2(e.getModifierState?.("CapsLock"))
                    }
                    className={inputCls(
                      !!confirmarSenha && !senhasIguais
                    )}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setVerSenha2((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-zinc-200"
                  >
                    {verSenha2 ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {caps2 && (
                  <p className="text-amber-300 text-[11px] mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} /> Caps Lock ativado
                  </p>
                )}

                {!!confirmarSenha && !senhasIguais && (
                  <p className="text-red-400 text-xs mt-1">
                    As senhas não coincidem.
                  </p>
                )}
              </div>

              <BotaoPrimario
                type="submit"
                className="w-full"
                loading={loading}
                disabled={loading}
                cor="amareloOuro"
                leftIcon={<Lock size={16} />}
              >
                {loading ? "Salvando..." : "Redefinir senha"}
              </BotaoPrimario>

              <BotaoSecundario
                type="button"
                onClick={() => navigate("/login")}
                className="w-full rounded-2xl py-3 flex items-center justify-center gap-2"
              >
                <LogIn size={16} />
                Voltar ao login
              </BotaoSecundario>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
