  // ✅ src/pages/Cadastro.jsx — padronizado (ícone+título na mesma linha, gradiente 3 cores fixas, Footer padrão)
  import { useState, useMemo, useEffect, useRef } from "react";
  import { useNavigate } from "react-router-dom";
  import { Eye, EyeOff, ShieldCheck, HelpCircle } from "lucide-react";
  import { toast } from "react-toastify";
  import BotaoPrimario from "../components/BotaoPrimario";
  import BotaoSecundario from "../components/BotaoSecundario";
  import Spinner from "../components/Spinner";
  import Footer from "../components/Footer";
  import { apiGetPublic, apiPost } from "../services/api";


  function RegrasDicasCadastro() {
    return (
      <section
        aria-labelledby="regras-cadastro"
        className="w-full max-w-3xl mx-auto mb-6"
      >
        <div className="bg-white text-zinc-900 rounded-2xl shadow-sm border border-black/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-violet-700" aria-hidden="true" />
            <h2 id="regras-cadastro" className="text-base font-bold">
              Regras &amp; Dicas para criar sua conta
            </h2>
          </div>
  
          <ol className="space-y-4">
            <li className="flex items-start gap-3">
              <span className="flex-none w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold grid place-items-center">1</span>
              <div>
                <p className="font-semibold">Como começar</p>
                <p className="text-sm text-zinc-700">
                  Na tela inicial, clique em <strong>“Criar Conta”</strong> e preencha todos os campos obrigatórios.
                </p>
              </div>
            </li>
  
            <li className="flex items-start gap-3">
              <span className="flex-none w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold grid place-items-center">2</span>
              <div>
                <p className="font-semibold">Nome completo (formatação correta)</p>
                <p className="text-sm text-zinc-700">
                  Digite o nome com apenas a primeira letra de cada palavra em maiúsculo. Evite tudo maiúsculo ou tudo minúsculo.
                </p>
                <ul className="mt-1 text-sm">
                  <li>✅ <strong>José Raimundo da Silva</strong></li>
                  <li>❌ JOSÉ RAIMUNDO DA SILVA</li>
                  <li>❌ josé raimundo da silva</li>
                </ul>
              </div>
            </li>
  
            <li className="flex items-start gap-3">
              <span className="flex-none w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold grid place-items-center">3</span>
              <div>
                <p className="font-semibold">Registro (Servidores da Prefeitura de Santos)</p>
                <p className="text-sm text-zinc-700">
                  Este campo é <strong>exclusivo para servidores</strong> da Prefeitura de Santos. Se você não é servidor, <strong>deixe em branco</strong>.
                  Quando preenchido, use o formato <code className="px-1 py-0.5 bg-zinc-100 rounded">00.000-0</code>.
                </p>
              </div>
            </li>
  
            <li className="flex items-start gap-3">
              <span className="flex-none w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold grid place-items-center">4</span>
              <div>
                <p className="font-semibold">Unidade de vínculo</p>
                <p className="text-sm text-zinc-700">
                  Se você não trabalha na Prefeitura de Santos, escolha <strong>“Outros”</strong>.
                </p>
              </div>
            </li>
  
            <li className="flex items-start gap-3">
              <span className="flex-none w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold grid place-items-center">5</span>
              <div>
                <p className="font-semibold">E-mail e CPF</p>
                <p className="text-sm text-zinc-700">
                  Confira com atenção. Esses dados serão usados para <strong>login</strong> e <strong>recuperação de senha</strong>.
                </p>
              </div>
            </li>
  
            <li className="flex items-start gap-3">
              <span className="flex-none w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold grid place-items-center">6</span>
              <div>
                <p className="font-semibold">Senha forte (obrigatória)</p>
                <p className="text-sm text-zinc-700">
                  Mínimo de <strong>8 caracteres</strong>, contendo <strong>maiúscula</strong>, <strong>minúscula</strong>, <strong>número</strong> e <strong>símbolo</strong>.
                  Evite reutilizar senhas de outros serviços.
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  Ex.: <code className="px-1 py-0.5 bg-zinc-100 rounded">Saude@2025</code> (apenas um exemplo, não use exatamente este).
                </p>
              </div>
            </li>
  
            <li className="flex items-start gap-3">
              <span className="flex-none w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold grid place-items-center">7</span>
              <div>
                <p className="font-semibold">Demais campos de perfil</p>
                <p className="text-sm text-zinc-700">
                  Preencha <em>Gênero</em>, <em>Orientação sexual</em>, <em>Cor/raça</em>, <em>Escolaridade</em>, <em>Deficiência</em> e <em>Cargo</em>.
                  Se não possuir deficiência, selecione <strong>“Não possuo”</strong>.
                </p>
              </div>
            </li>
  
            <li className="flex items-start gap-3">
              <span className="flex-none w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold grid place-items-center">8</span>
              <div>
                <p className="font-semibold">Conferência e envio</p>
                <p className="text-sm text-zinc-700">
                  Revise os dados e clique em <strong>Cadastrar</strong> para finalizar.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>
    );
  }
  
  export default function Cadastro() {
    // ───────────────────────────── refs para foco
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

    // ───────────────────────────── state básico
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
    const [orientacoes, setOrientacoes] = useState([]);
    const [coresRacas, setCoresRacas] = useState([]);
    const [escolaridades, setEscolaridades] = useState([]);
    const [deficiencias, setDeficiencias] = useState([]);

    // senha
    const [senha, setSenha] = useState("");
    const [confirmarSenha, setConfirmarSenha] = useState("");
    const [mostrarSenha, setMostrarSenha] = useState(false);

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

    // foco inicial
    useEffect(() => {
      document.getElementById("skip-to-form")?.focus();
      refNome.current?.focus();
    }, []);

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
          const [uni, car, gen, ori, cr, esc, def] = await Promise.allSettled([
            apiGetPublic("/unidades"),
            apiGetPublic("/cargos"),
            apiGetPublic("/generos"),
            apiGetPublic("/orientacoes-sexuais"),
            apiGetPublic("/cores-racas"),
            apiGetPublic("/escolaridades"),
            apiGetPublic("/deficiencias"),
          ]);
          if (!alive) return;
          const ok = (p) => (p.status === "fulfilled" ? (p.value || []) : []);

          setUnidades(
            ok(uni).sort((a, b) => (a.sigla || a.nome || "").localeCompare(b.sigla || b.nome || ""))
          );
          setCargos(ok(car).sort((a, b) => (a.nome || "").localeCompare(b.nome || "")));
          setGeneros(ok(gen));
          setOrientacoes(ok(ori));
          setCoresRacas(ok(cr));
          setEscolaridades(ok(esc));
          setDeficiencias(ok(def));

          if (![ok(car), ok(gen), ok(ori), ok(cr), ok(esc), ok(def)].every((l) => l.length)) {
            toast.warn("Algumas listas não estão disponíveis no servidor.");
          }
        } catch (e) {
          console.warn("Falha ao carregar listas", e);
          toast.error("Não foi possível carregar as listas.");
        } finally {
          alive && setLoadingLookups(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, []);

    // máscaras/validações
    const aplicarMascaraCPF = (v) =>
      String(v || "")
        .replace(/\D/g, "")
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

    const validarCPF = (c) => /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(c || "");
    const validarEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

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

    // helper: classes de input
    const errCls = (has) =>
      `w-full px-4 py-2 rounded bg-white text-gray-800 placeholder-gray-400 focus:outline-none ${
        has ? "ring-2 ring-red-500 focus:ring-red-600" : "focus:ring-2 focus:ring-lousa"
      }`;

    function aplicarErrosServidor(fields = {}) {
      setErroNome("");
      setErroCpf("");
      setErroEmail("");
      setErroData("");
      setErroPerfil("");
      setErroSenha("");
      setErroConfirmarSenha("");

      let focou = false;
      const focar = (ref) => {
        if (!focou) {
          ref?.current?.focus();
          focou = true;
        }
      };

      if (fields.nome) {
        setErroNome(fields.nome || "Digite o nome completo (mínimo 12 caracteres).");
        focar(refNome);
      }
      if (fields.cpf) {
        setErroCpf(fields.cpf);
        focar(refCpf);
      }
      if (fields.email) {
        setErroEmail(fields.email);
        focar(refEmail);
      }
      if (fields.data_nascimento) {
        setErroData(fields.data_nascimento);
        focar(refData);
      }
      if (fields.senha || fields.novaSenha) {
        setErroSenha(fields.senha || fields.novaSenha);
        focar(refSenha);
      }

      const algumPerfilErro =
        fields.unidade_id ||
        fields.genero_id ||
        fields.orientacao_sexual_id ||
        fields.cor_raca_id ||
        fields.escolaridade_id ||
        fields.deficiencia_id ||
        fields.cargo_id;

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

    // submit
    async function handleSubmit(e) {
      e.preventDefault();
      if (loading) return;

      if (hpRef.current?.value) {
        toast.error("Falha na validação.");
        return;
      }

      setErro("");
      setErroNome("");
      setErroCpf("");
      setErroEmail("");
      setErroData("");
      setErroPerfil("");
      setErroSenha("");
      setErroConfirmarSenha("");

      const nomeTrim = nome.trim();
      const emailTrim = email.trim().toLowerCase();
      const cpfNum = cpf.replace(/\D/g, "");

      if (!nomeTrim) {
        setErroNome("Nome é obrigatório.");
        refNome.current?.focus();
        return;
      }
      if (nomeTrim.length < 12) {
        setErroNome("Digite o nome completo (mínimo 12 caracteres).");
        refNome.current?.focus();
        return;
      }
      if (!validarCPF(cpf)) {
        setErroCpf("CPF inválido. Use 000.000.000-00.");
        refCpf.current?.focus();
        return;
      }
      if (!validarEmail(emailTrim)) {
        setErroEmail("E-mail inválido.");
        refEmail.current?.focus();
        return;
      }
      if (!dataNascimento) {
        setErroData("Data de nascimento é obrigatória.");
        refData.current?.focus();
        return;
      }
      if (
        !unidadeId ||
        !cargoId ||
        !generoId ||
        !orientacaoSexualId ||
        !corRacaId ||
        !escolaridadeId ||
        !deficienciaId
      ) {
        setErroPerfil("Preencha todos os campos de perfil.");
        (refUnidade.current ||
          refGenero.current ||
          refOrientacao.current ||
          refCorRaca.current ||
          refEscolaridade.current ||
          refDeficiencia.current ||
          refCargo.current)?.focus();
        return;
      }
      if (!senhaForteRe.test(senha)) {
        setErroSenha("A senha precisa ter 8+ caracteres, com maiúscula, minúscula, número e símbolo.");
        refSenha.current?.focus();
        return;
      }
      if (senha !== confirmarSenha) {
        setErroConfirmarSenha("As senhas não coincidem.");
        refConfirmar.current?.focus();
        return;
      }

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

    // ───────────────────────────── UI
    return (
      <>
        <a
          href="#form-cadastro"
          id="skip-to-form"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:bg-white focus:text-lousa focus:px-3 focus:py-2 focus:rounded"
        >
          Pular para o formulário
        </a>

        {/* HERO padronizado (ícone + título MESMA linha, 3 cores fixas da página) */}
        <header role="banner" className="bg-gradient-to-br from-violet-900 via-indigo-800 to-fuchsia-700 text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-10 text-center">
            <div className="inline-flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Cadastro</h1>
            </div>
            <p className="mt-2 text-sm md:text-base text-white/90">Crie sua conta para acessar cursos, presenças e certificados.</p>
          </div>
        </header>

        <main role="main" className="min-h-[calc(100vh-220px)] bg-gelo dark:bg-zinc-900 flex items-start justify-center px-2 py-8">
        <div className="w-full max-w-3xl mx-auto">
        <RegrasDicasCadastro />
          <form
            id="form-cadastro"
            onSubmit={handleSubmit}
            noValidate
            className="bg-lousa text-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-3xl space-y-4"
            aria-label="Formulário de Cadastro"
          >
            {erro && (
              <p className="text-red-300 text-sm text-center" role="alert" aria-live="assertive">
                {erro}
              </p>
            )}

            {/* Grupo: Dados pessoais */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold uppercase tracking-wide text-white/90">Dados pessoais</legend>

              <div>
                <label htmlFor="nome" className="block text-sm mb-1">Nome completo</label>
                <input
                  id="nome"
                  ref={refNome}
                  type="text"
                  placeholder="Nome completo"
                  value={nome}
                  onChange={(e) => { setNome(e.target.value); setErroNome(""); }}
                  className={errCls(!!erroNome)}
                  autoComplete="name"
                  required
                  aria-describedby={erroNome ? "erro-nome" : undefined}
                  aria-invalid={!!erroNome}
                />
                {erroNome && <p id="erro-nome" className="text-red-300 text-xs mt-1" role="alert">{erroNome}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cpf" className="block text-sm mb-1">CPF</label>
                  <input
                    id="cpf"
                    ref={refCpf}
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => { setCpf(aplicarMascaraCPF(e.target.value)); setErroCpf(""); }}
                    maxLength={14}
                    className={errCls(!!erroCpf)}
                    autoComplete="username"
                    inputMode="numeric"
                    required
                    aria-describedby={erroCpf ? "erro-cpf" : undefined}
                    aria-invalid={!!erroCpf}
                  />
                  {erroCpf && <p id="erro-cpf" className="text-red-300 text-xs mt-1" role="alert">{erroCpf}</p>}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm mb-1">E-mail</label>
                  <input
                    id="email"
                    ref={refEmail}
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErroEmail(""); }}
                    className={errCls(!!erroEmail)}
                    autoComplete="email"
                    required
                    aria-describedby={erroEmail ? "erro-email" : undefined}
                    aria-invalid={!!erroEmail}
                  />
                  {erroEmail && <p id="erro-email" className="text-red-300 text-xs mt-1" role="alert">{erroEmail}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-white/10">
                <div>
                  <label htmlFor="registro" className="block text-sm mb-1">Registro (Servidores da Prefeitura)</label>
                  <input
                    id="registro"
                    type="text"
                    placeholder="Ex.: 00.000-0"
                    value={registro}
                    onChange={(e) => setRegistro(maskRegistro(e.target.value))}
                    className={errCls(false)}
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label htmlFor="dataNascimento" className="block text-sm mb-1">Data de nascimento</label>
                  <input
                    id="dataNascimento"
                    ref={refData}
                    type="date"
                    value={dataNascimento}
                    onChange={(e) => { setDataNascimento(e.target.value); setErroData(""); }}
                    className={errCls(!!erroData)}
                    required
                    aria-describedby={erroData ? "erro-data" : undefined}
                    aria-invalid={!!erroData}
                  />
                  {erroData && <p id="erro-data" className="text-red-300 text-xs mt-1" role="alert">{erroData}</p>}
                </div>
              </div>
            </fieldset>

            {/* Grupo: Perfil */}
            <fieldset className="space-y-3 pt-3 border-t border-white/10">
              <legend className="text-sm font-semibold uppercase tracking-wide text-white/90">Perfil</legend>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Unidade</label>
                  <select
                    ref={refUnidade}
                    value={unidadeId}
                    onChange={(e) => { setUnidadeId(e.target.value); setErroPerfil(""); }}
                    className={errCls(!!erroPerfil)}
                    disabled={loading || loadingLookups}
                    required
                  >
                    <option value="">{loadingLookups ? "Carregando..." : "Selecione…"}</option>
                    {unidades.map((u) => (
                      <option key={u.id} value={String(u.id)}>{u.sigla || u.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm mb-1">Gênero</label>
                  <select
                    ref={refGenero}
                    value={generoId}
                    onChange={(e) => { setGeneroId(e.target.value); setErroPerfil(""); }}
                    className={errCls(!!erroPerfil)}
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
                  <label className="block text-sm mb-1">Orientação sexual</label>
                  <select
                    ref={refOrientacao}
                    value={orientacaoSexualId}
                    onChange={(e) => { setOrientacaoSexualId(e.target.value); setErroPerfil(""); }}
                    className={errCls(!!erroPerfil)}
                    disabled={loading || loadingLookups}
                    required
                  >
                    <option value="">{loadingLookups ? "Carregando..." : "Selecione…"}</option>
                    {orientacoes.map((o) => (
                      <option key={o.id} value={String(o.id)}>{o.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm mb-1">Cor/raça</label>
                  <select
                    ref={refCorRaca}
                    value={corRacaId}
                    onChange={(e) => { setCorRacaId(e.target.value); setErroPerfil(""); }}
                    className={errCls(!!erroPerfil)}
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
                  <label className="block text-sm mb-1">Escolaridade</label>
                  <select
                    ref={refEscolaridade}
                    value={escolaridadeId}
                    onChange={(e) => { setEscolaridadeId(e.target.value); setErroPerfil(""); }}
                    className={errCls(!!erroPerfil)}
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
                  <label className="block text-sm mb-1">Deficiência</label>
                  <select
                    ref={refDeficiencia}
                    value={deficienciaId}
                    onChange={(e) => { setDeficienciaId(e.target.value); setErroPerfil(""); }}
                    className={errCls(!!erroPerfil)}
                    disabled={loading || loadingLookups}
                    required
                  >
                    <option value="">{loadingLookups ? "Carregando..." : "Selecione…"}</option>
                    {deficiencias.map((d) => (
                      <option key={d.id} value={String(d.id)}>{d.nome}</option>
                    ))}
                  </select>
                  <p className="text-xs text-white/70 mt-1">Se não possuir, escolha “Não possuo”.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1">Cargo</label>
                <select
                  ref={refCargo}
                  value={cargoId}
                  onChange={(e) => { setCargoId(e.target.value); setErroPerfil(""); }}
                  className={errCls(!!erroPerfil)}
                  disabled={loading || loadingLookups}
                  required
                >
                  <option value="">{loadingLookups ? "Carregando..." : "Selecione…"}</option>
                  {cargos.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.nome}</option>
                  ))}
                </select>
              </div>

              {erroPerfil && <p className="text-red-300 text-xs" role="alert">{erroPerfil}</p>}
            </fieldset>

            {/* Grupo: Senha */}
            <fieldset className="space-y-3 pt-3 border-t border-white/10">
              <legend className="text-sm font-semibold uppercase tracking-wide text-white/90">Segurança</legend>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="relative">
                  <label htmlFor="senha" className="block text-sm mb-1">Senha</label>
                  <input
                    id="senha"
                    ref={refSenha}
                    type={mostrarSenha ? "text" : "password"}
                    placeholder="Senha forte"
                    value={senha}
                    onChange={(e) => { setSenha(e.target.value); setErroSenha(""); }}
                    className={errCls(!!erroSenha) + " pr-12"}
                    autoComplete="new-password"
                    required
                    aria-describedby={erroSenha ? "erro-senha" : "dica-senha"}
                    aria-invalid={!!erroSenha}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((v) => !v)}
                    className="absolute top-8 right-3 text-lousa"
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                  <p id="dica-senha" className="text-xs text-white/70 mt-1">
                    Use letras maiúsculas/minúsculas, números e símbolo.
                  </p>
                  {erroSenha && <p id="erro-senha" className="text-red-300 text-xs mt-1" role="alert">{erroSenha}</p>}

                  {senha && (
                    <div className="mt-2 h-2 bg-gray-300 rounded" aria-label="Força da senha">
                      <div
                        className={`h-2 rounded transition-all duration-300 ${
                          forcaSenha === 1
                            ? "w-1/5 bg-red-500"
                            : forcaSenha === 2
                            ? "w-2/5 bg-yellow-500"
                            : forcaSenha === 3
                            ? "w-3/5 bg-blue-500"
                            : "w-full bg-green-500"
                        }`}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="confirmarSenha" className="block text-sm mb-1">Confirmar senha</label>
                  <input
                    id="confirmarSenha"
                    ref={refConfirmar}
                    type="password"
                    placeholder="Confirmar senha"
                    value={confirmarSenha}
                    onChange={(e) => { setConfirmarSenha(e.target.value); setErroConfirmarSenha(""); }}
                    className={errCls(!!erroConfirmarSenha)}
                    autoComplete="new-password"
                    required
                    aria-describedby={erroConfirmarSenha ? "erro-confirma" : undefined}
                    aria-invalid={!!erroConfirmarSenha}
                  />
                  {erroConfirmarSenha && <p id="erro-confirma" className="text-red-300 text-xs mt-1" role="alert">{erroConfirmarSenha}</p>}
                </div>
              </div>

              {/* Honeypot invisível */}
              <div aria-hidden="true" className="hidden">
                <label>Deixe em branco</label>
                <input ref={hpRef} type="text" tabIndex={-1} autoComplete="off" />
              </div>
            </fieldset>

            {/* Ações */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <BotaoPrimario
                type="submit"
                className="
                  w-full flex justify-center items-center gap-2
                  !bg-[#FA8072] hover:!bg-[#f56c5b] active:!bg-[#e66a5f]
                  !text-white transition-colors
                  focus-visible:!ring-2 focus-visible:!ring-[#FA8072]/60
                  disabled:opacity-60 disabled:cursor-not-allowed
                "
                disabled={loading || loadingLookups}
                aria-busy={loading}
              >
                {loading ? <Spinner pequeno /> : "Cadastrar"}
              </BotaoPrimario>

              <BotaoSecundario
                type="button"
                onClick={() => navigate("/login")}
                className="
                  w-full
                  border border-violet-400 text-violet-300 font-medium
                  bg-transparent
                  hover:bg-violet-400 hover:text-violet-900
                  focus-visible:ring-2 focus-visible:ring-violet-400/60
                  rounded
                  transition-colors duration-200
                "
                disabled={loading}
              >
                Voltar para login
              </BotaoSecundario>
            </div>

            {/* 🔗 Links públicos */}
            <p className="text-xs text-white/80 text-center mt-2 flex flex-wrap items-center justify-center gap-2">
              <HelpCircle size={14} aria-hidden="true" />
              Dúvidas?
              <a
                href="/ajuda/cadastro"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:opacity-90"
              >
                Central de Ajuda
              </a>
              <span>•</span>
              <a
                href="/privacidade"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:opacity-90"
              >
                Privacidade
              </a>
            </p>

            <p className="text-xs text-white/70 text-center mt-2">
              Ao se cadastrar, você concorda com o uso dos seus dados para controle de eventos, presença e certificação.
            </p>
          </form>
          </div>
        </main>

        <Footer />
      </>
    );
  }
