// ✅ src/pages/Cadastro.jsx — premium (kit base Escola) — UX+segurança
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  ShieldCheck,
  HelpCircle,
  Sparkles,
  UserPlus,
  BadgeCheck,
  AlertTriangle,
} from "lucide-react";
import { toast } from "react-toastify";

import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import Spinner from "../components/Spinner";
import Footer from "../components/Footer";
import { apiGetPublic, apiPost } from "../services/api";

import useEscolaTheme from "../hooks/useEscolaTheme";
import ThemeTogglePills from "../components/ThemeTogglePills";

/* =========================
   UI helpers
========================= */
function NumberBullet({ n }) {
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white text-[12px] font-bold shadow-sm select-none shrink-0"
      aria-label={`Item ${n}`}
    >
      {n}
    </span>
  );
}

function RegrasDicasCadastro({ isDark, IconeCabecalho = ShieldCheck }) {
  const regras = [
    {
      titulo: "Como começar",
      conteudo: (
        <p>
          Na tela inicial, clique em <strong>“Criar cadastro”</strong> e preencha todos os campos obrigatórios.
        </p>
      ),
    },
    {
      titulo: "Nome completo (formatação correta)",
      conteudo: (
        <>
          <p>Digite o nome com apenas a primeira letra de cada palavra em maiúsculo. Evite tudo maiúsculo ou tudo minúsculo.</p>
          <ul className={["mt-2 space-y-1 text-sm", isDark ? "text-zinc-300" : "text-slate-700"].join(" ")}>
            <li>✅ <strong>José Raimundo da Silva</strong></li>
            <li>❌ JOSÉ RAIMUNDO DA SILVA</li>
            <li>❌ josé raimundo da silva</li>
          </ul>
        </>
      ),
    },
    {
      titulo: "Registro (Servidores da Prefeitura de Santos)",
      conteudo: (
        <p>
          Este campo é <strong>exclusivo para servidores</strong> da Prefeitura de Santos. Se você não é servidor, <strong>deixe em branco</strong>.
        </p>
      ),
    },
    {
      titulo: "Unidade de vínculo",
      conteudo: <p>Se você não trabalha na Prefeitura de Santos, escolha <strong>“Outros”</strong>.</p>,
    },
    {
      titulo: "E-mail e CPF",
      conteudo: <p>Confira com atenção. Esses dados serão usados para <strong>login</strong> e <strong>recuperação de senha</strong>.</p>,
    },
    {
      titulo: "Senha forte (obrigatória)",
      conteudo: (
        <>
          <p>
            Mínimo de <strong>8 caracteres</strong>, contendo <strong>maiúscula</strong>, <strong>minúscula</strong>, <strong>número</strong> e <strong>símbolo</strong>.
            Evite reutilizar senhas de outros serviços.
          </p>
          <p className={["text-xs mt-1", isDark ? "text-zinc-400" : "text-slate-600"].join(" ")}>
            Ex.: <code className={["px-1 py-0.5 rounded", isDark ? "bg-white/10" : "bg-slate-100"].join(" ")}>Saude@2025</code> (apenas exemplo)
          </p>
        </>
      ),
    },
    {
      titulo: "Demais campos de perfil",
      conteudo: (
        <p>
          Preencha <em>Gênero</em>, <em>Orientação sexual</em>, <em>Cor/raça</em>, <em>Escolaridade</em>, <em>Deficiência</em> e <em>Cargo</em>.
          Se não possuir deficiência, selecione <strong>“Não possuo”</strong>.
        </p>
      ),
    },
    {
      titulo: "Conferência e envio",
      conteudo: <p>Revise os dados e clique em <strong>Cadastrar</strong> para finalizar.</p>,
    },
  ];

  const Card = ({ children }) => (
    <div
      className={[
        "rounded-3xl border p-6 transition-all",
        isDark ? "bg-zinc-900/55 border-white/10 hover:bg-white/5" : "bg-white border-slate-200 shadow-sm hover:shadow-md",
      ].join(" ")}
    >
      {children}
    </div>
  );

  return (
    <section className="w-full">
      <div className="flex items-center justify-center gap-2 mb-4 text-center">
        <IconeCabecalho className={["w-5 h-5", isDark ? "text-emerald-300" : "text-emerald-700"].join(" ")} aria-hidden="true" />
        <h2 className={["text-base font-extrabold text-center", isDark ? "text-zinc-100" : "text-slate-900"].join(" ")}>
          Regras &amp; Dicas para criar sua conta
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <ol className="list-none pl-0 space-y-4 [text-align:justify] [&>li]:list-none [&>li]:marker:hidden [&>li]:before:hidden">
            {regras.map((regra, i) => (
              <li key={i} className="flex gap-3 list-none">
                <NumberBullet n={i + 1} />
                <div className={["text-sm leading-6", isDark ? "text-zinc-300" : "text-slate-700"].join(" ")}>
                  <p className={["font-semibold mb-1", isDark ? "text-zinc-100" : "text-slate-900"].join(" ")}>
                    {regra.titulo}
                  </p>
                  {regra.conteudo}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </section>
  );
}

/* =========================
   Helpers (formatadores/validadores)
========================= */
const palavrasMinusculasPt = new Set(["da","de","do","das","dos","e","a","o","das","dos","di","du"]);
function titleCasePtBr(nome) {
  const s = String(nome || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return "";
  return s
    .split(" ")
    .map((p, i) => (i > 0 && palavrasMinusculasPt.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

const aplicarMascaraCPF = (v) =>
  String(v || "")
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const validarCPF = (c) => /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(c || "");
const validarEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

/* =========================
   Page
========================= */
export default function Cadastro() {
  // refs para foco
  const refNome = useRef(null);
  const refCpf = useRef(null);
  const refEmail = useRef(null);
  const refData = useRef(null);
  const refUnidade = useRef(null);
  const refGenero = useRef(null);
  const refOrientacao = useRef(null);
  const refCorRaca = useRef(null);
  const refEscolaridade = useRef(null);
  const refDeficiencia = useRef(null);
  const refCargo = useRef(null);
  const refSenha = useRef(null);
  const refConfirmar = useRef(null);

  // state básico
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [registro, setRegistro] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");

  // selects (IDs string)
  const [unidadeId, setUnidadeId] = useState("");
  const [cargoId, setCargoId] = useState("");
  const [generoId, setGeneroId] = useState("");
  const [orientacaoSexualId, setOrientacaoSexualId] = useState("");
  const [corRacaId, setCorRacaId] = useState("");
  const [escolaridadeId, setEscolaridadeId] = useState("");
  const [deficienciaId, setDeficienciaId] = useState("");

  // listas
  const [unidades, setUnidades] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [generos, setGeneros] = useState([]);
  const [orientacao, setOrientacao] = useState([]);
  const [coresRacas, setCoresRacas] = useState([]);
  const [escolaridades, setEscolaridades] = useState([]);
  const [deficiencias, setDeficiencias] = useState([]);

  // senha
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  // erros
  const [erro, setErro] = useState("");
  const [erroNome, setErroNome] = useState("");
  const [erroCpf, setErroCpf] = useState("");
  const [erroEmail, setErroEmail] = useState("");
  const [erroData, setErroData] = useState("");
  const [erroPerfil, setErroPerfil] = useState("");
  const [erroSenha, setErroSenha] = useState("");
  const [erroConfirmarSenha, setErroConfirmarSenha] = useState("");

  // controle
  const [loading, setLoading] = useState(false);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const navigate = useNavigate();

  // honeypot anti-bot
  const hpRef = useRef(null);

  // theme
  const { theme, setTheme, isDark } = useEscolaTheme();

  // foco inicial
  useEffect(() => {
    document.title = "Cadastro — Escola da Saúde";
    refNome.current?.focus();
  }, []);

  // ordenar unidades por SIGLA (fallback para nome)
  const orderBySigla = (arr = []) =>
    [...arr].sort((a, b) =>
      String(a?.sigla ?? a?.nome ?? "").localeCompare(String(b?.sigla ?? b?.nome ?? ""), "pt-BR", { sensitivity: "base" })
    );

  // máscara registro 00.000-0
  const maskRegistro = (raw) => {
    const d = String(raw || "").replace(/\D/g, "").slice(0, 6);
    let out = d;
    if (d.length > 2) out = d.slice(0, 2) + "." + d.slice(2);
    if (d.length > 5) out = out.slice(0, 6) + "-" + d.slice(5);
    return out;
  };

  // lookups públicos
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingLookups(true);
        const data = await apiGetPublic("/perfil/opcao");
        if (!alive) return;

        const uni = Array.isArray(data?.unidades) ? data.unidades : [];
        const car = Array.isArray(data?.cargos) ? data.cargos : [];
        const gen = Array.isArray(data?.generos) ? data.generos : [];
        const ori = Array.isArray(data?.orientacaoSexuais) ? data.orientacaoSexuais : [];
        const cr  = Array.isArray(data?.coresRacas) ? data.coresRacas : [];
        const esc = Array.isArray(data?.escolaridades) ? data.escolaridades : [];
        const def = Array.isArray(data?.deficiencias) ? data.deficiencias : [];

        // garante "Outros" na Unidade (se parceiro externo)
        const temOutros = uni.some(u => (u.sigla || u.nome || "").toLowerCase() === "outros");
        const unidadesFinal = temOutros ? uni : [...uni, { id: 999999, sigla: "Outros", nome: "Outros" }];

        setUnidades(orderBySigla(unidadesFinal));
        setCargos([...car].sort((a, b) => (a?.nome || "").localeCompare(b?.nome || "", "pt-BR", { sensitivity: "base" })));
        setGeneros(gen);
        setOrientacao(ori);
        setCoresRacas(cr);
        setEscolaridades(esc);
        setDeficiencias(def);

        if (![uni, car, gen, ori, cr, esc, def].every((l) => l.length)) {
          toast.warn("Algumas listas não estão disponíveis no servidor.");
        }
      } catch (e) {
        console.warn("[Cadastro] Falha ao carregar lookups", e);
        toast.error("Não foi possível carregar as listas.");
      } finally {
        alive && setLoadingLookups(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // validações
  const senhaForteRe = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  const forcaSenha = useMemo(() => {
    const s = senha || "";
    let score = 0;
    if (s.length >= 8) score++;
    if (/[A-Z]/.test(s)) score++;
    if (/[a-z]/.test(s)) score++;
    if (/\d/.test(s)) score++;
    if (/[\W_]/.test(s)) score++;
    return Math.min(score, 4);
  }, [senha]);

  // input classes
  const inputCls = (hasErr) =>
    [
      "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition",
      "focus:ring-2 focus:ring-emerald-500/70",
      isDark
        ? "border-white/10 bg-zinc-950/30 text-zinc-100 placeholder:text-zinc-500"
        : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400",
      hasErr ? "ring-2 ring-red-500/60 border-red-500/60" : "",
    ].join(" ");
  const selectCls = (hasErr) => [inputCls(hasErr), "appearance-none"].join(" ");

  function aplicarErrosServidor(fields = {}) {
    setErroNome(""); setErroCpf(""); setErroEmail(""); setErroData("");
    setErroPerfil(""); setErroSenha(""); setErroConfirmarSenha("");

    let focou = false;
    const focar = (ref) => { if (!focou) { ref?.current?.focus(); focou = true; } };

    if (fields.nome) { setErroNome(fields.nome || "Digite o nome completo (mínimo 12 caracteres)."); focar(refNome); }
    if (fields.cpf) { setErroCpf(fields.cpf); focar(refCpf); }
    if (fields.email) { setErroEmail(fields.email); focar(refEmail); }
    if (fields.data_nascimento) { setErroData(fields.data_nascimento); focar(refData); }
    if (fields.senha || fields.novaSenha) { setErroSenha(fields.senha || fields.novaSenha); focar(refSenha); }

    const algumPerfilErro =
      fields.unidade_id || fields.genero_id || fields.orientacao_sexual_id || fields.cor_raca_id ||
      fields.escolaridade_id || fields.deficiencia_id || fields.cargo_id;

    if (algumPerfilErro) {
      setErroPerfil("Revise os campos de perfil destacados.");
      if (fields.unidade_id) focar(refUnidade);
      else if (fields.genero_id) focar(refGenero);
      else if (fields.orientacao_sexual_id) focar(refOrientacao);
      else if (fields.cor_raca_id) focar(refCorRaca);
      else if (fields.escolaridade_id) focar(refEscolaridade);
      else if (fields.deficiencia_id) focar(refDeficiencia);
      else if (fields.cargo_id) focar(refCargo);
    }
  }

  // handlers auxiliares
  const onBlurNome = useCallback(() => {
    if (!nome) return;
    const t = titleCasePtBr(nome);
    if (t && t !== nome) setNome(t);
  }, [nome]);

  function limparErrosVisuais() {
    setErro(""); setErroNome(""); setErroCpf(""); setErroEmail("");
    setErroData(""); setErroPerfil(""); setErroSenha(""); setErroConfirmarSenha("");
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") limparErrosVisuais();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") {
        const btn = document.querySelector("#btn-cadastrar");
        btn?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    if (hpRef.current?.value) {
      toast.error("Falha na validação.");
      return;
    }

    limparErrosVisuais();

    const nomeTrim = nome.trim();
    const emailTrim = email.trim().toLowerCase();
    const cpfNum = cpf.replace(/\D/g, "");

    if (!nomeTrim) { setErroNome("Nome é obrigatório."); refNome.current?.focus(); return; }
    if (nomeTrim.length < 12) { setErroNome("Digite o nome completo (mínimo 12 caracteres)."); refNome.current?.focus(); return; }
    if (!validarCPF(cpf)) { setErroCpf("CPF inválido. Use 000.000.000-00."); refCpf.current?.focus(); return; }
    if (!validarEmail(emailTrim)) { setErroEmail("E-mail inválido."); refEmail.current?.focus(); return; }
    if (!dataNascimento) { setErroData("Data de nascimento é obrigatória."); refData.current?.focus(); return; }
    if (!unidadeId || !cargoId || !generoId || !orientacaoSexualId || !corRacaId || !escolaridadeId || !deficienciaId) {
      setErroPerfil("Preencha todos os campos de perfil.");
      (refUnidade.current || refGenero.current || refOrientacao.current || refCorRaca.current ||
        refEscolaridade.current || refDeficiencia.current || refCargo.current)?.focus();
      return;
    }
    if (!senhaForteRe.test(senha)) { setErroSenha("A senha precisa ter 8+ caracteres, com maiúscula, minúscula, número e símbolo."); refSenha.current?.focus(); return; }
    if (senha !== confirmarSenha) { setErroConfirmarSenha("As senhas não coincidem."); refConfirmar.current?.focus(); return; }

    const payload = {
      nome: nomeTrim,
      cpf: cpfNum,
      email: emailTrim,
      senha,
      perfil: "usuario",
      unidade_id: Number(unidadeId),
      cargo_id: Number(cargoId),
      genero_id: Number(generoId),
      orientacao_sexual_id: Number(orientacaoSexualId),
      cor_raca_id: Number(corRacaId),
      escolaridade_id: Number(escolaridadeId),
      deficiencia_id: Number(deficienciaId),
      data_nascimento: dataNascimento,
      registro: registro ? registro : null,
    };

    setLoading(true);
    try {
      await apiPost("/usuarios/cadastro", payload);
      toast.success("✅ Cadastro realizado com sucesso!");
      setTimeout(() => navigate("/login"), 800);
    } catch (error) {
      const data = error?.response?.data || error?.data || {};
      const msg = data?.message || data?.erro || error?.message || "Erro ao criar conta.";
      const fields = data?.fieldErrors || data?.fields || {};

      aplicarErrosServidor(fields);

      if (fields?.cpf || /cpf/i.test(msg)) setErroCpf(fields.cpf || "CPF já cadastrado.");
      if (fields?.email || /e-?mail/i.test(msg)) setErroEmail(fields.email || "E-mail já cadastrado.");

      setErro(msg);
      setSenha("");
      setConfirmarSenha("");
    } finally {
      setLoading(false);
    }
  }

  const labelForca = useMemo(() => {
    if (!senha) return null;
    if (forcaSenha <= 1) return { t: "Fraca", cls: isDark ? "text-red-300" : "text-red-600" };
    if (forcaSenha === 2) return { t: "Média", cls: isDark ? "text-amber-300" : "text-amber-700" };
    if (forcaSenha === 3) return { t: "Boa", cls: isDark ? "text-sky-300" : "text-sky-700" };
    return { t: "Forte", cls: isDark ? "text-emerald-300" : "text-emerald-700" };
  }, [senha, forcaSenha, isDark]);

  // caps lock detector
  const onSenhaKey = (e) => setCapsOn(e.getModifierState && e.getModifierState("CapsLock"));

  return (
    <>
      {/* Skip link (a11y) */}
      <a
        href="#form-cadastro"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow"
      >
        Pular para o formulário
      </a>

      <main
        className={[
          "min-h-screen transition-colors",
          isDark ? "bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100" : "bg-slate-50 text-slate-900",
        ].join(" ")}
      >
        {/* HeaderHero */}
        <header className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-900 via-indigo-800 to-fuchsia-700" />
          {isDark && <div className="absolute inset-0 bg-black/35" />}

          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/15 blur-3xl" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-12">
            <div className="lg:absolute lg:right-4 lg:top-6 flex justify-end">
              <ThemeTogglePills variant="glass" />
            </div>

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

            <div className="flex flex-col items-center text-center gap-3">
              <div className="inline-flex items-center gap-2 text-white/90 text-xs font-semibold">
                <Sparkles className="h-4 w-4" />
                <span>Portal oficial • criação de conta</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Cadastro</h1>
              <p className="text-sm text-white/90 max-w-2xl">
                Crie sua conta para acessar cursos, presenças, avaliações e certificados.
              </p>
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-8 md:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Regras (desktop) */}
            <aside className="lg:col-span-5">
              <RegrasDicasCadastro isDark={isDark} IconeCabecalho={ShieldCheck} />
            </aside>

            {/* Form */}
            <div className="lg:col-span-7">
              <div
                className={[
                  "rounded-3xl border p-6 md:p-8 transition-colors",
                  isDark ? "border-white/10 bg-zinc-900/50 shadow-none" : "border-slate-200 bg-white shadow-xl",
                ].join(" ")}
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        "h-12 w-12 rounded-2xl flex items-center justify-center border",
                        isDark ? "bg-violet-500/10 border-white/10" : "bg-violet-50 border-violet-100",
                      ].join(" ")}
                    >
                      <UserPlus className={["h-6 w-6", isDark ? "text-violet-300" : "text-violet-700"].join(" ")} />
                    </div>
                    <div>
                      <h2 className="text-lg md:text-xl font-extrabold">Criar conta</h2>
                      <p className={["text-xs", isDark ? "text-zinc-300" : "text-slate-500"].join(" ")}>
                        Preencha com atenção. Os campos de perfil são obrigatórios.
                      </p>
                    </div>
                  </div>

                  <span
                    className={[
                      "hidden sm:inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold",
                      isDark ? "border-white/10 bg-zinc-950/40 text-zinc-200" : "border-slate-200 bg-slate-50 text-slate-700",
                    ].join(" ")}
                  >
                    <BadgeCheck className="h-4 w-4" />
                    Cadastro seguro
                  </span>
                </div>

                <form
                  id="form-cadastro"
                  onSubmit={handleSubmit}
                  noValidate
                  className="mt-6 space-y-5"
                  aria-label="Formulário de Cadastro"
                  aria-busy={loading ? "true" : "false"}
                >
                  {erro ? (
                    <p className={["text-sm text-center", isDark ? "text-red-300" : "text-red-600"].join(" ")} role="alert" aria-live="assertive">
                      {erro}
                    </p>
                  ) : null}

                  {/* Dados pessoais */}
                  <fieldset className="space-y-3">
                    <legend className={["text-xs font-extrabold uppercase tracking-wide", isDark ? "text-zinc-300" : "text-slate-700"].join(" ")}>
                      Dados pessoais
                    </legend>

                    <div>
                      <label htmlFor="nome" className="block text-sm font-semibold">Nome completo</label>
                      <input
                        id="nome"
                        ref={refNome}
                        type="text"
                        placeholder="Nome completo"
                        value={nome}
                        onChange={(e) => { setNome(e.target.value); setErroNome(""); }}
                        onBlur={onBlurNome}
                        className={inputCls(!!erroNome)}
                        autoComplete="name"
                        autoCapitalize="words"
                        required
                        aria-describedby={erroNome ? "erro-nome" : undefined}
                        aria-invalid={!!erroNome}
                      />
                      {erroNome ? (
                        <p id="erro-nome" className={["text-xs mt-1", isDark ? "text-red-300" : "text-red-600"].join(" ")} role="alert">
                          {erroNome}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="cpf" className="block text-sm font-semibold">CPF</label>
                        <input
                          id="cpf"
                          ref={refCpf}
                          type="text"
                          placeholder="000.000.000-00"
                          value={cpf}
                          onChange={(e) => { setCpf(aplicarMascaraCPF(e.target.value)); setErroCpf(""); }}
                          maxLength={14}
                          className={inputCls(!!erroCpf)}
                          autoComplete="username"
                          inputMode="numeric"
                          required
                          aria-describedby={erroCpf ? "erro-cpf" : undefined}
                          aria-invalid={!!erroCpf}
                        />
                        {erroCpf ? (
                          <p id="erro-cpf" className={["text-xs mt-1", isDark ? "text-red-300" : "text-red-600"].join(" ")} role="alert">
                            {erroCpf}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label htmlFor="email" className="block text-sm font-semibold">E-mail</label>
                        <input
                          id="email"
                          ref={refEmail}
                          type="email"
                          placeholder="seu@email.com"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setErroEmail(""); }}
                          className={inputCls(!!erroEmail)}
                          autoComplete="email"
                          required
                          aria-describedby={erroEmail ? "erro-email" : undefined}
                          aria-invalid={!!erroEmail}
                        />
                        {erroEmail ? (
                          <p id="erro-email" className={["text-xs mt-1", isDark ? "text-red-300" : "text-red-600"].join(" ")} role="alert">
                            {erroEmail}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className={["grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t", isDark ? "border-white/10" : "border-slate-200"].join(" ")}>
                      <div>
                        <label htmlFor="registro" className="block text-sm font-semibold">Registro (Servidores da Prefeitura)</label>
                        <input
                          id="registro"
                          type="text"
                          placeholder="Ex.: 00.000-0"
                          value={registro}
                          onChange={(e) => setRegistro(maskRegistro(e.target.value))}
                          className={inputCls(false)}
                          autoComplete="off"
                          inputMode="numeric"
                        />
                        <p className={["mt-1 text-[11px]", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
                          Se não for servidor, deixe em branco.
                        </p>
                      </div>

                      <div>
                        <label htmlFor="dataNascimento" className="block text-sm font-semibold">Data de nascimento</label>
                        <input
                          id="dataNascimento"
                          ref={refData}
                          type="date"
                          value={dataNascimento}
                          onChange={(e) => { setDataNascimento(e.target.value); setErroData(""); }}
                          className={inputCls(!!erroData)}
                          required
                          aria-describedby={erroData ? "erro-data" : undefined}
                          aria-invalid={!!erroData}
                        />
                        {erroData ? (
                          <p id="erro-data" className={["text-xs mt-1", isDark ? "text-red-300" : "text-red-600"].join(" ")} role="alert">
                            {erroData}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </fieldset>

                  {/* Perfil */}
                  <fieldset className={["space-y-3 pt-3 border-t", isDark ? "border-white/10" : "border-slate-200"].join(" ")}>
                    <legend className={["text-xs font-extrabold uppercase tracking-wide", isDark ? "text-zinc-300" : "text-slate-700"].join(" ")}>
                      Perfil
                    </legend>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold">Unidade</label>
                        <select
                          ref={refUnidade}
                          value={unidadeId}
                          onChange={(e) => { setUnidadeId(e.target.value); setErroPerfil(""); }}
                          className={selectCls(!!erroPerfil)}
                          disabled={loading || loadingLookups}
                          required
                        >
                          <option value="">{loadingLookups ? "Carregando..." : "Selecione…"}</option>
                          {unidades.map((u) => (
                            <option key={u.id} value={String(u.id)}>
                              {u.sigla || u.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold">Gênero</label>
                        <select
                          ref={refGenero}
                          value={generoId}
                          onChange={(e) => { setGeneroId(e.target.value); setErroPerfil(""); }}
                          className={selectCls(!!erroPerfil)}
                          disabled={loading || loadingLookups}
                          required
                        >
                          <option value="">{loadingLookups ? "Carregando..." : "Selecione…"}</option>
                          {generos.map((g) => (
                            <option key={g.id} value={String(g.id)}>{g.nome}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold">Orientação sexual</label>
                        <select
                          ref={refOrientacao}
                          value={orientacaoSexualId}
                          onChange={(e) => { setOrientacaoSexualId(e.target.value); setErroPerfil(""); }}
                          className={selectCls(!!erroPerfil)}
                          disabled={loading || loadingLookups}
                          required
                        >
                          <option value="">{loadingLookups ? "Carregando..." : "Selecione…"}</option>
                          {orientacao.map((o) => (
                            <option key={o.id} value={String(o.id)}>{o.nome}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold">Cor/raça</label>
                        <select
                          ref={refCorRaca}
                          value={corRacaId}
                          onChange={(e) => { setCorRacaId(e.target.value); setErroPerfil(""); }}
                          className={selectCls(!!erroPerfil)}
                          disabled={loading || loadingLookups}
                          required
                        >
                          <option value="">{loadingLookups ? "Carregando..." : "Selecione…"}</option>
                          {coresRacas.map((c) => (
                            <option key={c.id} value={String(c.id)}>{c.nome}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold">Escolaridade</label>
                        <select
                          ref={refEscolaridade}
                          value={escolaridadeId}
                          onChange={(e) => { setEscolaridadeId(e.target.value); setErroPerfil(""); }}
                          className={selectCls(!!erroPerfil)}
                          disabled={loading || loadingLookups}
                          required
                        >
                          <option value="">{loadingLookups ? "Carregando..." : "Selecione…"}</option>
                          {escolaridades.map((esc) => (
                            <option key={esc.id} value={String(esc.id)}>{esc.nome}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold">Deficiência</label>
                        <select
                          ref={refDeficiencia}
                          value={deficienciaId}
                          onChange={(e) => { setDeficienciaId(e.target.value); setErroPerfil(""); }}
                          className={selectCls(!!erroPerfil)}
                          disabled={loading || loadingLookups}
                          required
                        >
                          <option value="">{loadingLookups ? "Carregando..." : "Selecione…"}</option>
                          {deficiencias.map((d) => (
                            <option key={d.id} value={String(d.id)}>{d.nome}</option>
                          ))}
                        </select>
                        <p className={["text-[11px] mt-1", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
                          Se não possuir, escolha “Não possuo”.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold">Cargo</label>
                      <select
                        ref={refCargo}
                        value={cargoId}
                        onChange={(e) => { setCargoId(e.target.value); setErroPerfil(""); }}
                        className={selectCls(!!erroPerfil)}
                        disabled={loading || loadingLookups}
                        required
                      >
                        <option value="">{loadingLookups ? "Carregando..." : "Selecione…"}</option>
                        {cargos.map((c) => (
                          <option key={c.id} value={String(c.id)}>{c.nome}</option>
                        ))}
                      </select>
                    </div>

                    {erroPerfil ? (
                      <p className={["text-xs", isDark ? "text-red-300" : "text-red-600"].join(" ")} role="alert">
                        {erroPerfil}
                      </p>
                    ) : null}
                  </fieldset>

                  {/* Segurança */}
                  <fieldset className={["space-y-3 pt-3 border-t", isDark ? "border-white/10" : "border-slate-200"].join(" ")}>
                    <legend className={["text-xs font-extrabold uppercase tracking-wide", isDark ? "text-zinc-300" : "text-slate-700"].join(" ")}>
                      Segurança
                    </legend>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="relative">
                        <label htmlFor="senha" className="block text-sm font-semibold">Senha</label>
                        <input
                          id="senha"
                          ref={refSenha}
                          type={mostrarSenha ? "text" : "password"}
                          placeholder="Senha forte"
                          value={senha}
                          onChange={(e) => { setSenha(e.target.value); setErroSenha(""); }}
                          onKeyUp={onSenhaKey}
                          onKeyDown={onSenhaKey}
                          className={[inputCls(!!erroSenha), "pr-12"].join(" ")}
                          autoComplete="new-password"
                          required
                          aria-describedby={erroSenha ? "erro-senha" : "dica-senha"}
                          aria-invalid={!!erroSenha}
                          inputMode="text"
                          pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}"
                        />
                        <button
                          type="button"
                          onClick={() => setMostrarSenha((v) => !v)}
                          className={[
                            "absolute right-2 top-[34px] rounded-xl px-2.5 py-2",
                            "focus:outline-none focus:ring-2 focus:ring-emerald-500/70",
                            isDark ? "text-zinc-300 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100",
                          ].join(" ")}
                          aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>

                        <p id="dica-senha" className={["text-[11px] mt-1", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
                          Use maiúscula/minúscula, números e símbolo.
                        </p>
                        {capsOn && (
                          <p className="mt-1 text-[11px] inline-flex items-center gap-1 text-amber-600 dark:text-amber-300">
                            <AlertTriangle size={12} /> Caps Lock ativo
                          </p>
                        )}

                        {erroSenha ? (
                          <p id="erro-senha" className={["text-xs mt-1", isDark ? "text-red-300" : "text-red-600"].join(" ")} role="alert">
                            {erroSenha}
                          </p>
                        ) : null}

                        {/* força */}
                        {senha ? (
                          <div className="mt-2">
                            <div className="flex items-center justify-between">
                              <span className={["text-[11px] font-bold", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>Força</span>
                              <span className={["text-[11px] font-extrabold", labelForca?.cls || ""].join(" ")}>{labelForca?.t}</span>
                            </div>
                            <div className={["mt-1 h-2 rounded-full overflow-hidden", isDark ? "bg-white/10" : "bg-slate-200"].join(" ")}>
                              <div
                                className={[
                                  "h-full rounded-full transition-all duration-300",
                                  forcaSenha <= 1 ? "w-1/4 bg-red-500" :
                                  forcaSenha === 2 ? "w-2/4 bg-amber-500" :
                                  forcaSenha === 3 ? "w-3/4 bg-sky-500" : "w-full bg-emerald-500",
                                ].join(" ")}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <label htmlFor="confirmarSenha" className="block text-sm font-semibold">Confirmar senha</label>
                        <input
                          id="confirmarSenha"
                          ref={refConfirmar}
                          type="password"
                          placeholder="Confirmar senha"
                          value={confirmarSenha}
                          onChange={(e) => { setConfirmarSenha(e.target.value); setErroConfirmarSenha(""); }}
                          className={inputCls(!!erroConfirmarSenha)}
                          autoComplete="new-password"
                          required
                          aria-describedby={erroConfirmarSenha ? "erro-confirma" : undefined}
                          aria-invalid={!!erroConfirmarSenha}
                        />
                        {erroConfirmarSenha ? (
                          <p id="erro-confirma" className={["text-xs mt-1", isDark ? "text-red-300" : "text-red-600"].join(" ")} role="alert">
                            {erroConfirmarSenha}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Honeypot invisível */}
                    <div aria-hidden="true" className="hidden">
                      <label>Deixe em branco</label>
                      <input ref={hpRef} type="text" tabIndex={-1} autoComplete="off" />
                    </div>
                  </fieldset>

                  {/* Ações */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
                    <BotaoPrimario
                      id="btn-cadastrar"
                      type="submit"
                      className={[
                        "w-full flex justify-center items-center gap-2",
                        "focus-visible:!ring-2 focus-visible:!ring-emerald-500/60",
                        "disabled:opacity-60 disabled:cursor-not-allowed",
                      ].join(" ")}
                      disabled={loading || loadingLookups}
                      aria-busy={loading}
                      leftIcon={<UserPlus size={16} />}
                    >
                      {loading ? <Spinner pequeno /> : "Cadastrar"}
                    </BotaoPrimario>

                    <BotaoSecundario
                      type="button"
                      onClick={() => navigate("/login")}
                      className={[
                        "w-full rounded-2xl border text-sm font-extrabold py-3",
                        isDark ? "border-white/10 bg-zinc-900/40 text-zinc-200 hover:bg-white/5" : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100",
                        "focus-visible:ring-2 focus-visible:ring-emerald-500/60 transition",
                      ].join(" ")}
                      disabled={loading}
                    >
                      Voltar para login
                    </BotaoSecundario>
                  </div>

                  <p className={["text-[11px] text-center mt-2", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
                    Ao se cadastrar, você concorda com o uso dos seus dados para controle de eventos, presença e certificação.
                  </p>

                  {/* Links públicos */}
                  <p className={["text-[11px] text-center mt-2 flex flex-wrap items-center justify-center gap-2", isDark ? "text-zinc-400" : "text-slate-600"].join(" ")}>
                    <HelpCircle size={14} aria-hidden="true" />
                    <a href="/privacidade" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:opacity-90">
                      Privacidade
                    </a>
                  </p>

                  {/* SR status */}
                  <div className="sr-only" aria-live="polite">
                    {loading ? "Enviando cadastro" : ""}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </>
  );
}
