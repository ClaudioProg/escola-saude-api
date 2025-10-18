// ✅ src/pages/Perfil.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import { toast } from "react-toastify";
import ModalAssinatura from "../components/ModalAssinatura";
import { apiGet, apiPatch, apiPerfilMe, setPerfilIncompletoFlag } from "../services/api";
import Footer from "../components/Footer";
import BotaoPrimario from "../components/BotaoPrimario";
import { User, Save, Edit } from "lucide-react";

/* ───────────────── HeaderHero padronizado + ministats ───────────────── */
function HeaderHero({
  onSave,
  onAssinatura,
  podeGerenciarAssinatura = false,
  salvando = false,
  variant = "petroleo",
  stats = { completo: false, pendentes: 0, percent: 0 },
}) {
  const variants = {
    sky: "from-sky-900 via-sky-800 to-sky-700",
    violet: "from-violet-900 via-violet-800 to-violet-700",
    amber: "from-amber-900 via-amber-800 to-amber-700",
    rose: "from-rose-900 via-rose-800 to-rose-700",
    teal: "from-teal-900 via-teal-800 to-teal-700",
    indigo: "from-indigo-900 via-indigo-800 to-indigo-700",
    petroleo: "from-slate-900 via-teal-900 to-slate-800",
  };
  const grad = variants[variant] ?? variants.petroleo;

  return (
    <header className={`relative isolate overflow-hidden bg-gradient-to-br ${grad} text-white`} role="banner">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(52% 60% at 50% 0%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 32%, rgba(255,255,255,0) 60%)",
        }}
        aria-hidden="true"
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 md:py-12 min-h-[150px] sm:min-h-[180px]">
        <div className="flex flex-col items-center text-center gap-3 sm:gap-4">
          <div className="inline-flex items-center justify-center gap-2">
            <User className="w-6 h-6" aria-hidden="true" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Meu Perfil</h1>
          </div>
          <p className="text-sm sm:text-base text-white/90 max-w-2xl">
            Atualize seus dados pessoais e preferências. O CPF aparece somente para consulta.
          </p>

          {/* ministats */}
          <div className="mt-1 sm:mt-2 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
              <div className="text-[11px] uppercase tracking-wide text-white/80">Status</div>
              <div className="text-sm font-semibold">{stats.completo ? "Completo" : "Incompleto"}</div>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
              <div className="text-[11px] uppercase tracking-wide text-white/80">Completude</div>
              <div className="text-sm font-semibold">{stats.percent.toFixed(0)}%</div>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
              <div className="text-[11px] uppercase tracking-wide text-white/80">Pendentes</div>
              <div className="text-sm font-semibold">{stats.pendentes}</div>
            </div>
          </div>

          {/* Ações (sem repetir na página) */}
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            <BotaoPrimario
              onClick={onSave}
              disabled={salvando}
              aria-label="Salvar alterações no perfil"
              icone={<Save className="w-4 h-4" />}
            >
              {salvando ? "Salvando..." : "Salvar alterações"}
            </BotaoPrimario>

            {podeGerenciarAssinatura && (
              <BotaoPrimario
                onClick={onAssinatura}
                variante="secundario"
                aria-label="Gerenciar assinatura digital"
                icone={<Edit className="w-4 h-4" />}
              >
                Gerenciar assinatura
              </BotaoPrimario>
            )}
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* ───────────────── Página ───────────────── */
export default function Perfil() {
  const [usuario, setUsuario] = useState(null);

  // básicos
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState(""); // read-only
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [registro, setRegistro] = useState("");
  const [dataNascimento, setDataNascimento] = useState(""); // YYYY-MM-DD

  // selects (sempre strings)
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

  // flags
  const [salvando, setSalvando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [carregandoListas, setCarregandoListas] = useState(true);

  // erros por campo
  const [eNome, setENome] = useState("");
  const [eEmail, setEEmail] = useState("");
  const [eSenha, setESenha] = useState("");
  const [eRegistro, setERegistro] = useState("");
  const [eData, setEData] = useState("");
  const [eUnidade, setEUnidade] = useState("");
  const [eCargo, setECargo] = useState("");
  const [eGenero, setEGenero] = useState("");
  const [eOrientacao, setEOrientacao] = useState("");
  const [eCor, setECor] = useState("");
  const [eEscolaridade, setEEscolaridade] = useState("");
  const [eDeficiencia, setEDeficiencia] = useState("");

  // refs
  const rNome = useRef(null);
  const rEmail = useRef(null);
  const rSenha = useRef(null);
  const rRegistro = useRef(null);
  const rData = useRef(null);
  const rUnidade = useRef(null);
  const rCargo = useRef(null);
  const rGenero = useRef(null);
  const rOrientacao = useRef(null);
  const rCor = useRef(null);
  const rEscolaridade = useRef(null);
  const rDeficiencia = useRef(null);

  // helpers
  const stripPrefixNum = (s) => String(s || "").replace(/^\d+\s*-\s*/, "");
  const validarEmail = (v) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const asStr = (v) => (v === null || v === undefined ? "" : String(v));
  const aplicarMascaraCPF = (v) =>
    String(v || "")
      .replace(/\D/g, "")
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  const maskRegistro = (raw) => {
    const d = String(raw || "").replace(/\D/g, "").slice(0, 6);
    let out = d;
    if (d.length > 2) out = d.slice(0, 2) + "." + d.slice(2);
    if (d.length > 5) out = out.slice(0, 6) + "-" + d.slice(5);
    return out;
  };
  const toYMD = (val) => {
    if (!val) return "";
    const s = String(val);
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    const y = d.getUTCFullYear();
    const mth = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${mth}-${day}`;
  };

  // 1) hidrata do localStorage (rápido p/ UI)
  useEffect(() => {
    try {
      const dadosString = localStorage.getItem("usuario");
      if (!dadosString) return;
      const dados = JSON.parse(dadosString);
      const perfilString = Array.isArray(dados.perfil) ? dados.perfil[0] : dados.perfil;
      const u = { ...dados, perfil: perfilString };
      setUsuario(u);
      setNome(u.nome || "");
      setCpf(aplicarMascaraCPF(u.cpf || ""));
      setEmail(u.email || "");
      setRegistro(maskRegistro(u.registro || ""));
      setDataNascimento(toYMD(u.data_nascimento) || "");
      setUnidadeId(asStr(u.unidade_id));
      setCargoId(asStr(u.cargo_id));
      setGeneroId(asStr(u.genero_id));
      setOrientacaoSexualId(asStr(u.orientacao_sexual_id));
      setCorRacaId(asStr(u.cor_raca_id));
      setEscolaridadeId(asStr(u.escolaridade_id));
      setDeficienciaId(asStr(u.deficiencia_id));
    } catch (erro) {
      console.error("Erro ao carregar localStorage:", erro);
      toast.error("Erro ao carregar dados do perfil.");
    }
  }, []);

  // 2) hidrata do backend (fonte da verdade)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await apiPerfilMe({ on401: "silent", on403: "silent" });
        if (!alive || !me) return;
        let antigo = {};
        try {
          antigo = JSON.parse(localStorage.getItem("usuario") || "{}");
        } catch {}
        const cpfFinal = me.cpf ?? antigo.cpf ?? "";
        setNome(me.nome || "");
        setCpf(aplicarMascaraCPF(cpfFinal));
        setEmail(me.email || "");
        setRegistro(maskRegistro(me.registro || ""));
        setDataNascimento(toYMD(me.data_nascimento) || "");
        setUnidadeId(asStr(me.unidade_id));
        setCargoId(asStr(me.cargo_id));
        setGeneroId(asStr(me.genero_id));
        setOrientacaoSexualId(asStr(me.orientacao_sexual_id));
        setCorRacaId(asStr(me.cor_raca_id));
        setEscolaridadeId(asStr(me.escolaridade_id));
        setDeficienciaId(asStr(me.deficiencia_id));

        try {
          const novo = { ...antigo, ...me, cpf: me.cpf ?? antigo.cpf };
          localStorage.setItem("usuario", JSON.stringify(novo));
          localStorage.setItem("nome", novo.nome || "");
          setUsuario(novo);
        } catch {}
      } catch (e) {
        console.warn("Falha ao buscar perfil:", e?.message || e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // listas auxiliares
  useEffect(() => {
    (async () => {
      try {
        setCarregandoListas(true);
        const [uni, car, gen, ori, cr, esc, def] = await Promise.all([
          apiGet("/api/unidades", { on403: "silent" }),
          apiGet("/api/cargos", { on403: "silent" }),
          apiGet("/api/generos", { on403: "silent" }),
          apiGet("/api/orientacoes-sexuais", { on403: "silent" }),
          apiGet("/api/cores-racas", { on403: "silent" }),
          apiGet("/api/escolaridades", { on403: "silent" }),
          apiGet("/api/deficiencias", { on403: "silent" }),
        ]);
        setUnidades((uni || []).sort((a, b) => (a.nome || "").localeCompare(b.nome || "")));
        setCargos((car || []).sort((a, b) => stripPrefixNum(a.nome).localeCompare(stripPrefixNum(b.nome))));
        setGeneros(gen || []);
        setOrientacoes(ori || []);
        setCoresRacas(cr || []);
        setEscolaridades(esc || []);
        setDeficiencias(def || []);
      } catch (e) {
        console.warn(e);
        toast.error("Não foi possível carregar as listas auxiliares.");
      } finally {
        setCarregandoListas(false);
      }
    })();
  }, []);

  // campos obrigatórios que contam para completude
  const requiredFields = useMemo(
    () => [
      ["unidadeId", unidadeId],
      ["cargoId", cargoId],
      ["generoId", generoId],
      ["orientacaoSexualId", orientacaoSexualId],
      ["corRacaId", corRacaId],
      ["escolaridadeId", escolaridadeId],
      ["deficienciaId", deficienciaId],
      ["dataNascimento", dataNascimento],
      ["nome", nome],
      ["email", email],
    ],
    [
      unidadeId,
      cargoId,
      generoId,
      orientacaoSexualId,
      corRacaId,
      escolaridadeId,
      deficienciaId,
      dataNascimento,
      nome,
      email,
    ]
  );

  const pendentes = requiredFields.filter(([, v]) => !String(v || "").trim()).length;
  const completo = pendentes === 0;
  const percent = Math.round(((requiredFields.length - pendentes) / requiredFields.length) * 100);

  // status (para hero)
  const stats = useMemo(
    () => ({ completo, pendentes, percent }),
    [completo, pendentes, percent]
  );

  // limpar erros
  const clearErrors = () => {
    setENome(""); setEEmail(""); setESenha("");
    setERegistro(""); setEData("");
    setEUnidade(""); setECargo(""); setEGenero("");
    setEOrientacao(""); setECor(""); setEEscolaridade(""); setEDeficiencia("");
  };

  // aplicar erros do servidor e focar
  const aplicarErrosServidor = (fields = {}) => {
    clearErrors();
    let focou = false;
    const focar = (ref) => {
      if (!focou && ref?.current) {
        ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
        ref.current.focus();
        focou = true;
      }
    };

    if (fields.nome) { setENome(fields.nome); focar(rNome); }
    if (fields.email) { setEEmail(fields.email); focar(rEmail); }
    if (fields.senha || fields.novaSenha) { setESenha(fields.senha || fields.novaSenha); focar(rSenha); }
    if (fields.registro) { setERegistro(fields.registro); focar(rRegistro); }
    if (fields.data_nascimento) { setEData(fields.data_nascimento); focar(rData); }
    if (fields.unidade_id) { setEUnidade(fields.unidade_id); focar(rUnidade); }
    if (fields.cargo_id) { setECargo(fields.cargo_id); focar(rCargo); }
    if (fields.genero_id) { setEGenero(fields.genero_id); focar(rGenero); }
    if (fields.orientacao_sexual_id) { setEOrientacao(fields.orientacao_sexual_id); focar(rOrientacao); }
    if (fields.cor_raca_id) { setECor(fields.cor_raca_id); focar(rCor); }
    if (fields.escolaridade_id) { setEEscolaridade(fields.escolaridade_id); focar(rEscolaridade); }
    if (fields.deficiencia_id) { setEDeficiencia(fields.deficiencia_id); focar(rDeficiencia); }
  };

  const salvarAlteracoes = async () => {
    if (!usuario?.id) return;
    clearErrors();

    // validações rápidas
    if (!nome.trim()) { setENome("Informe seu nome."); rNome.current?.focus(); return; }
    if (!validarEmail(email)) { setEEmail("E-mail inválido."); rEmail.current?.focus(); return; }
    if (senha && senha.length < 8) { setESenha("A nova senha deve ter pelo menos 8 caracteres."); rSenha.current?.focus(); return; }
    if (dataNascimento && !/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
      setEData("Data inválida (use YYYY-MM-DD)."); rData.current?.focus(); return;
    }

    const payload = {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      ...(senha ? { senha } : {}),
      registro: registro?.trim() || null,
      data_nascimento: dataNascimento || null,
      unidade_id: unidadeId ? Number(unidadeId) : null,
      cargo_id: cargoId ? Number(cargoId) : null,
      genero_id: generoId ? Number(generoId) : null,
      orientacao_sexual_id: orientacaoSexualId ? Number(orientacaoSexualId) : null,
      cor_raca_id: corRacaId ? Number(corRacaId) : null,
      escolaridade_id: escolaridadeId ? Number(escolaridadeId) : null,
      deficiencia_id: deficienciaId ? Number(deficienciaId) : null,
    };

    try {
      setSalvando(true);
      const resp = await apiPatch(`/api/perfil/me`, payload, { auth: true });

      // reconsulta perfil e atualiza flags
      const atualizado = await apiPerfilMe({ on401: "silent", on403: "silent" });
      setPerfilIncompletoFlag(!!atualizado?.perfil_incompleto || !!resp?.perfilIncompleto);

      const antigo = JSON.parse(localStorage.getItem("usuario") || "{}");
      const novo = { ...antigo, ...atualizado };
      localStorage.setItem("usuario", JSON.stringify(novo));
      localStorage.setItem("nome", novo.nome || "");
      setUsuario(novo);
      setSenha("");

      // ressincroniza campos
      setCpf(aplicarMascaraCPF(novo.cpf ?? cpf ?? ""));
      setRegistro(maskRegistro(novo.registro || ""));
      setDataNascimento(toYMD(novo.data_nascimento) || "");
      setUnidadeId(asStr(novo.unidade_id));
      setCargoId(asStr(novo.cargo_id));
      setGeneroId(asStr(novo.genero_id));
      setOrientacaoSexualId(asStr(novo.orientacao_sexual_id));
      setCorRacaId(asStr(novo.cor_raca_id));
      setEscolaridadeId(asStr(novo.escolaridade_id));
      setDeficienciaId(asStr(novo.deficiencia_id));

      toast.success("✅ Dados atualizados com sucesso!");
    } catch (err) {
      console.error(err);
      const data = err?.data || {};
      const fields = data?.fields || {};
      const msg = data?.erro || data?.message || "Não foi possível salvar as alterações.";
      aplicarErrosServidor(fields);
      toast.error(`❌ ${msg}`);
    } finally {
      setSalvando(false);
    }
  };

  const podeGerenciarAssinatura =
    (Array.isArray(usuario?.perfil)
      ? usuario.perfil.map((p) => String(p).toLowerCase())
      : [String(usuario?.perfil || "").toLowerCase()]
    ).some((p) => p === "instrutor" || p === "administrador");

  // carregamento inicial
  if (!usuario) {
    return (
      <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900">
        <HeaderHero
          onSave={salvarAlteracoes}
          onAssinatura={() => setModalAberto(true)}
          podeGerenciarAssinatura={false}
          salvando={true}
          variant="petroleo"
          stats={{ completo: false, pendentes: 0, percent: 0 }}
        />
        <main role="main" className="flex-1 max-w-3xl mx-auto px-4 py-8">
          <p className="text-center text-gray-600 dark:text-gray-300">🔄 Carregando dados do perfil...</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900">
      {/* hero petróleo (área de conta) – padronizado */}
      <HeaderHero
        onSave={salvarAlteracoes}
        onAssinatura={() => setModalAberto(true)}
        podeGerenciarAssinatura={podeGerenciarAssinatura}
        salvando={salvando}
        variant="petroleo"
        stats={stats}
      />

      <main role="main" className="flex-1 max-w-3xl mx-auto px-4 py-8">
        <h1 className="sr-only">Meu Perfil</h1>

        <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow space-y-6">
          {/* alert de status do cadastro */}
          {completo ? (
            <div role="status" aria-live="polite" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-green-800 text-sm dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
              ✅ <strong className="font-medium">Cadastro completo!</strong> Você já tem acesso à plataforma.
            </div>
          ) : (
            <div role="alert" aria-live="polite" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
              <strong className="font-medium">Ação necessária:</strong> Preencha o cadastro para acesso completo.
            </div>
          )}

          {/* Básicos */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Nome completo <span className="text-red-600">*</span>
              </label>
              <input
                id="nome"
                ref={rNome}
                type="text"
                value={nome}
                onChange={(e) => { setNome(e.target.value); setENome(""); }}
                className={`mt-1 w-full px-4 py-2 border rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 ${eNome ? "border-red-500 focus:ring-red-600" : "focus:ring-emerald-700"}`}
                aria-invalid={!!eNome}
                aria-describedby={eNome ? "erro-nome" : undefined}
                autoComplete="name"
              />
              {eNome && <p id="erro-nome" className="text-xs text-red-500 mt-1">{eNome}</p>}
            </div>

            <div>
              <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                CPF
              </label>
              <input
                id="cpf"
                type="text"
                value={cpf}
                readOnly
                placeholder="—"
                className="mt-1 w-full px-4 py-2 border rounded-md bg-gray-100 dark:bg-zinc-700/60 dark:text-white text-gray-700 cursor-not-allowed"
                aria-readonly="true"
                aria-label="CPF (somente leitura)"
              />
              <p className="text-xs text-gray-500 mt-1">O CPF não pode ser alterado nesta tela.</p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                E-mail <span className="text-red-600">*</span>
              </label>
              <input
                id="email"
                ref={rEmail}
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEEmail(""); }}
                className={`mt-1 w-full px-4 py-2 border rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 ${eEmail ? "border-red-500 focus:ring-red-600" : "focus:ring-emerald-700"}`}
                autoComplete="email"
                aria-invalid={!!eEmail}
                aria-describedby={eEmail ? "erro-email" : undefined}
              />
              {eEmail && <p id="erro-email" className="text-xs text-red-500 mt-1">{eEmail}</p>}
            </div>

            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Nova senha (opcional)
              </label>
              <input
                id="senha"
                ref={rSenha}
                type="password"
                value={senha}
                onChange={(e) => { setSenha(e.target.value); setESenha(""); }}
                placeholder="Digite para alterar a senha"
                className={`mt-1 w-full px-4 py-2 border rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 ${eSenha ? "border-red-500 focus:ring-red-600" : "focus:ring-emerald-700"}`}
                autoComplete="new-password"
                minLength={8}
                aria-invalid={!!eSenha}
                aria-describedby={eSenha ? "erro-senha" : undefined}
              />
              {eSenha && <p id="erro-senha" className="text-xs text-red-500 mt-1">{eSenha}</p>}
            </div>
          </section>

          {/* Registro + Data de nascimento */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-white/10 pt-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Registro (Servidores da Prefeitura)
              </label>
              <input
                ref={rRegistro}
                type="text"
                value={registro}
                onChange={(e) => { setRegistro(maskRegistro(e.target.value)); setERegistro(""); }}
                className={`mt-1 w-full px-4 py-2 rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:ring-2 ${eRegistro ? "border border-red-500 focus:ring-red-600" : "focus:ring-emerald-700"} disabled:opacity-60`}
                placeholder="Ex.: 10.010-1"
                disabled={salvando}
                inputMode="numeric"
                aria-invalid={!!eRegistro}
                aria-describedby={eRegistro ? "erro-registro" : undefined}
              />
              {eRegistro && <p id="erro-registro" className="text-xs text-red-500 mt-1">{eRegistro}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Data de nascimento <span className="text-red-600">*</span>
              </label>
              <input
                ref={rData}
                type="date"
                value={dataNascimento}
                onChange={(e) => { setDataNascimento(e.target.value); setEData(""); }}
                className={`mt-1 w-full px-4 py-2 rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:ring-2 ${eData ? "border border-red-500 focus:ring-red-600" : "focus:ring-emerald-700"} disabled:opacity-60`}
                disabled={salvando}
                aria-invalid={!!eData}
                aria-describedby={eData ? "erro-data" : undefined}
              />
              {eData && <p id="erro-data" className="text-xs text-red-500 mt-1">{eData}</p>}
            </div>
          </section>

          {/* Unidade + Escolaridade */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-white/10 pt-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Unidade <span className="text-red-600">*</span>
              </label>
              <select
                ref={rUnidade}
                value={unidadeId}
                onChange={(e) => { setUnidadeId(e.target.value); setEUnidade(""); }}
                className={`mt-1 w-full px-4 py-2 rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:ring-2 ${eUnidade ? "border border-red-500 focus:ring-red-600" : "focus:ring-emerald-700"} disabled:opacity-60`}
                disabled={salvando || carregandoListas}
                aria-invalid={!!eUnidade}
                aria-describedby={eUnidade ? "erro-unidade" : undefined}
              >
                <option value="">Selecione…</option>
                {unidades.map((u) => (
                  <option key={u.id} value={String(u.id)}>{u.sigla}</option>
                ))}
              </select>
              {eUnidade && <p id="erro-unidade" className="text-xs text-red-500 mt-1">{eUnidade}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Escolaridade <span className="text-red-600">*</span>
              </label>
              <select
                ref={rEscolaridade}
                value={escolaridadeId}
                onChange={(e) => { setEscolaridadeId(e.target.value); setEEscolaridade(""); }}
                className={`mt-1 w-full px-4 py-2 rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:ring-2 ${eEscolaridade ? "border border-red-500 focus:ring-red-600" : "focus:ring-emerald-700"} disabled:opacity-60`}
                disabled={salvando || carregandoListas}
                aria-invalid={!!eEscolaridade}
                aria-describedby={eEscolaridade ? "erro-escolaridade" : undefined}
              >
                <option value="">Selecione…</option>
                {escolaridades.map((esc) => (
                  <option key={esc.id} value={String(esc.id)}>{esc.nome}</option>
                ))}
              </select>
              {eEscolaridade && <p id="erro-escolaridade" className="text-xs text-red-500 mt-1">{eEscolaridade}</p>}
            </div>
          </section>

          {/* Cargo */}
          <section className="grid grid-cols-1 gap-5 border-t border-white/10 pt-1">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Cargo <span className="text-red-600">*</span>
              </label>
              <select
                ref={rCargo}
                value={cargoId}
                onChange={(e) => { setCargoId(e.target.value); setECargo(""); }}
                className={`mt-1 w-full px-4 py-2 rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:ring-2 ${eCargo ? "border border-red-500 focus:ring-red-600" : "focus:ring-emerald-700"} disabled:opacity-60`}
                disabled={salvando || carregandoListas}
                aria-invalid={!!eCargo}
                aria-describedby={eCargo ? "erro-cargo" : undefined}
              >
                <option value="">Selecione…</option>
                {cargos.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.nome}</option>
                ))}
              </select>
              {eCargo && <p id="erro-cargo" className="text-xs text-red-500 mt-1">{eCargo}</p>}
            </div>
          </section>

          {/* Demográficos */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-white/10 pt-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Gênero <span className="text-red-600">*</span>
              </label>
              <select
                ref={rGenero}
                value={generoId}
                onChange={(e) => { setGeneroId(e.target.value); setEGenero(""); }}
                className={`mt-1 w-full px-4 py-2 rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:ring-2 ${eGenero ? "border border-red-500 focus:ring-red-600" : "focus:ring-emerald-700"} disabled:opacity-60`}
                disabled={salvando || carregandoListas}
                aria-invalid={!!eGenero}
                aria-describedby={eGenero ? "erro-genero" : undefined}
              >
                <option value="">Selecione…</option>
                {generos.map((g) => (
                  <option key={g.id} value={String(g.id)}>{g.nome}</option>
                ))}
              </select>
              {eGenero && <p id="erro-genero" className="text-xs text-red-500 mt-1">{eGenero}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Orientação sexual <span className="text-red-600">*</span>
              </label>
              <select
                ref={rOrientacao}
                value={orientacaoSexualId}
                onChange={(e) => { setOrientacaoSexualId(e.target.value); setEOrientacao(""); }}
                className={`mt-1 w-full px-4 py-2 rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:ring-2 ${eOrientacao ? "border border-red-500 focus:ring-red-600" : "focus:ring-emerald-700"} disabled:opacity-60`}
                disabled={salvando || carregandoListas}
                aria-invalid={!!eOrientacao}
                aria-describedby={eOrientacao ? "erro-orientacao" : undefined}
              >
                <option value="">Selecione…</option>
                {orientacoes.map((o) => (
                  <option key={o.id} value={String(o.id)}>{o.nome}</option>
                ))}
              </select>
              {eOrientacao && <p id="erro-orientacao" className="text-xs text-red-500 mt-1">{eOrientacao}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Cor/raça <span className="text-red-600">*</span>
              </label>
              <select
                ref={rCor}
                value={corRacaId}
                onChange={(e) => { setCorRacaId(e.target.value); setECor(""); }}
                className={`mt-1 w-full px-4 py-2 rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:ring-2 ${eCor ? "border border-red-500 focus:ring-red-600" : "focus:ring-emerald-700"} disabled:opacity-60`}
                disabled={salvando || carregandoListas}
                aria-invalid={!!eCor}
                aria-describedby={eCor ? "erro-cor" : undefined}
              >
                <option value="">Selecione…</option>
                {coresRacas.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.nome}</option>
                ))}
              </select>
              {eCor && <p id="erro-cor" className="text-xs text-red-500 mt-1">{eCor}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Deficiência <span className="text-red-600">*</span>
              </label>
              <select
                ref={rDeficiencia}
                value={deficienciaId}
                onChange={(e) => { setDeficienciaId(e.target.value); setEDeficiencia(""); }}
                className={`mt-1 w-full px-4 py-2 rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:ring-2 ${eDeficiencia ? "border border-red-500 focus:ring-red-600" : "focus:ring-emerald-700"} disabled:opacity-60`}
                disabled={salvando || carregandoListas}
                aria-invalid={!!eDeficiencia}
                aria-describedby={eDeficiencia ? "erro-deficiencia" : undefined}
              >
                <option value="">Selecione…</option>
                {deficiencias.map((d) => (
                  <option key={d.id} value={String(d.id)}>{d.nome}</option>
                ))}
              </select>
              {eDeficiencia && <p id="erro-deficiencia" className="text-xs text-red-500 mt-1">{eDeficiencia}</p>}
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Se não possuir, escolha “Não possuo”.</p>
            </div>
          </section>
        </div>

        {/* modal de assinatura */}
        <ModalAssinatura isOpen={modalAberto} onClose={() => setModalAberto(false)} />
      </main>

      <Footer />
    </div>
  );
}
