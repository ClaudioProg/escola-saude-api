// ✅ src/pages/RedefinirSenha.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import BotaoPrimario from "../components/BotaoPrimario";
import Footer from "../components/Footer";
import { apiPost } from "../services/api";
import { Lock, Eye, EyeOff, AlertTriangle, LogIn } from "lucide-react";

/* ───────── HeaderHero padronizado (âmbar exclusivo desta página) ───────── */
function HeaderHero() {
  // Mantém tipografia/tamanhos alinhados ao resto do app
  const grad = "from-amber-700 via-amber-800 to-orange-700";
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
            <Lock className="w-5 h-5" aria-hidden="true" />
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Redefinir Senha
            </h1>
          </div>
          <p className="text-sm text-white/90 max-w-2xl">
            Defina uma nova senha forte para sua conta.
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
  return Math.min(score, 5); // 0..5
};
const textoForca = (n) =>
  ["Muito fraca", "Fraca", "Ok", "Boa", "Forte", "Excelente"][n] || "—";

/* ───────── Página ───────── */
export default function RedefinirSenha() {
  const { token } = useParams();
  const navigate = useNavigate();

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
    document.title = "Redefinir Senha | Escola da Saúde";
  }, []);

  // feedback inicial se token ausente
  const tokenValido = useMemo(() => typeof token === "string" && token.trim().length > 0, [token]);

  useEffect(() => {
    if (!tokenValido) {
      const msg = "Link inválido ou ausente. Solicite uma nova recuperação.";
      setErro(msg);
      setLive(msg);
    }
  }, [tokenValido, setLive]);

  const forca = avaliarForca(novaSenha);
  const atendeRegra = SENHA_FORTE_RE.test(novaSenha);
  const senhasIguais = novaSenha.trim() && novaSenha.trim() === confirmarSenha.trim();

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setErro("");
    setMensagem("");

    if (!tokenValido) {
      const m = "Link inválido ou expirado. Gere um novo link de redefinição.";
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
        "A senha deve ter 8+ caracteres e incluir: maiúscula, minúscula, número e símbolo.";
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
    toast.info("⏳ Redefinindo senha...");

    try {
      await apiPost("/api/usuarios/redefinir-senha", { token, novaSenha: s1 });
      const ok = "Senha redefinida com sucesso! Redirecionando para o login…";
      setMensagem(ok);
      setLive("Senha redefinida.");
      toast.success("✅ Senha redefinida com sucesso!");
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

  const voltarLogin = () => navigate("/login");

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero />

      {/* Live region acessível */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <main
        id="conteudo"
        role="main"
        className="flex-1 flex items-start justify-center px-4 py-8"
      >
        <form
          onSubmit={handleSubmit}
          className="bg-lousa text-white rounded-2xl shadow-xl p-7 sm:p-8 w-full max-w-md space-y-6"
          aria-label="Formulário de redefinição de senha"
        >
          <h2 className="text-center text-lg font-bold inline-flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" aria-hidden="true" />
            Redefinir Senha
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

          {/* Nova senha */}
          <div>
            <label htmlFor="novaSenha" className="block text-sm mb-1">
              Nova senha
            </label>
            <div className="relative">
              <input
                id="novaSenha"
                ref={s1Ref}
                type={verSenha1 ? "text" : "password"}
                placeholder="Nova senha"
                value={novaSenha}
                onChange={(e) => {
                  // impede espaços invisíveis acidentais
                  setNovaSenha(e.target.value.replace(/\s/g, ""));
                  if (erro) setErro("");
                }}
                onKeyUp={(e) => setCaps1(e.getModifierState?.("CapsLock"))}
                className="w-full px-4 py-2.5 pr-10 rounded bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-emerald-700"
                autoComplete="new-password"
                minLength={8}
                pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$"
                aria-invalid={!atendeRegra}
                aria-describedby="ajuda-senha ajuda-forca"
                required
              />
              <button
                type="button"
                onClick={() => setVerSenha1((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center justify-center p-1 text-gray-200 hover:text-white"
                aria-label={verSenha1 ? "Ocultar senha" : "Mostrar senha"}
                title={verSenha1 ? "Ocultar senha" : "Mostrar senha"}
              >
                {verSenha1 ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Aviso CapsLock */}
            {caps1 && (
              <p className="text-amber-200 text-[11px] mt-1 flex items-center gap-1" role="status">
                <AlertTriangle size={12} /> Atenção: Caps Lock está ativado.
              </p>
            )}

            {/* Requisitos + Força */}
            <p id="ajuda-senha" className="text-[11px] text-white/80 mt-2">
              Mínimo 8 caracteres, com maiúscula, minúscula, número e símbolo.
            </p>
            <div
              id="ajuda-forca"
              className="mt-2"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={5}
              aria-valuenow={forca}
              aria-valuetext={`Força: ${textoForca(forca)}`}
            >
              <div className="w-full h-2 rounded bg-white/20 overflow-hidden">
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
              <p className="text-[11px] mt-1 text-white/80">Força: {textoForca(forca)}</p>
            </div>
          </div>

          {/* Confirmar nova senha */}
          <div>
            <label htmlFor="confirmarSenha" className="block text-sm mb-1">
              Confirmar nova senha
            </label>
            <div className="relative">
              <input
                id="confirmarSenha"
                ref={s2Ref}
                type={verSenha2 ? "text" : "password"}
                placeholder="Confirme a nova senha"
                value={confirmarSenha}
                onChange={(e) => {
                  setConfirmarSenha(e.target.value.replace(/\s/g, ""));
                  if (erro) setErro("");
                }}
                onKeyUp={(e) => setCaps2(e.getModifierState?.("CapsLock"))}
                className="w-full px-4 py-2.5 pr-10 rounded bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-emerald-700"
                autoComplete="new-password"
                minLength={8}
                pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$"
                aria-invalid={!!confirmarSenha && !senhasIguais}
                aria-describedby={!!confirmarSenha && !senhasIguais ? "erro-confirm" : undefined}
                required
              />
              <button
                type="button"
                onClick={() => setVerSenha2((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center justify-center p-1 text-gray-200 hover:text-white"
                aria-label={verSenha2 ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                title={verSenha2 ? "Ocultar confirmação" : "Mostrar confirmação"}
              >
                {verSenha2 ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {caps2 && (
              <p className="text-amber-200 text-[11px] mt-1 flex items-center gap-1" role="status">
                <AlertTriangle size={12} /> Atenção: Caps Lock está ativado.
              </p>
            )}
            {!!confirmarSenha && !senhasIguais && (
              <p id="erro-confirm" className="text-red-300 text-xs mt-1">
                As senhas não coincidem.
              </p>
            )}
          </div>

          <BotaoPrimario
            type="submit"
            disabled={loading}
            className="w-full"
            aria-label="Redefinir senha"
            loading={loading}
            cor="amareloOuro"
          >
            {loading ? "Salvando..." : "Redefinir Senha"}
          </BotaoPrimario>

          <button
            type="button"
            onClick={verLogin => voltarLogin()}
            className="w-full inline-flex items-center justify-center gap-2 rounded border border-white/30 px-4 py-2 text-sm hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label="Voltar ao login"
            title="Voltar ao login"
          >
            <LogIn className="w-4 h-4" />
            Voltar ao login
          </button>

          <p className="text-[11px] text-white/80 text-center">
            Dica: use uma frase-senha com letras maiúsculas/minúsculas, números e símbolos.
          </p>
        </form>
      </main>

      <Footer />
    </div>
  );
}
