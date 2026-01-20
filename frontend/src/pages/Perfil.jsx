/* eslint-disable no-console */
// ✅ src/pages/Perfil.jsx — PREMIUM (kit base Escola) — v2 (mais robusto + a11y + anti-fuso + “salvar só se mudou”)
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { User, Save, Edit, Sparkles, ShieldCheck, RefreshCw } from "lucide-react";

import ModalAssinatura from "../components/ModalAssinatura";
import Footer from "../components/Footer";
import BotaoPrimario from "../components/BotaoPrimario";
import { apiGet, apiPatch, apiPerfilMe, setPerfilIncompletoFlag } from "../services/api";

import useEscolaTheme from "../hooks/useEscolaTheme";
import ThemeTogglePills from "../components/ThemeTogglePills";

/* ───────────────── HeaderHero premium + ministats ───────────────── */
function HeaderHero({
  theme,
  setTheme,
  isDark,
  onSave,
  onRefresh,
  onAssinatura,
  podeGerenciarAssinatura = false,
  salvando = false,
  atualizando = false,
  stats = { completo: false, pendentes: 0, percent: 0 },
  dirty = false,
}) {
  return (
    <header className="relative overflow-hidden" role="banner">
      {/* gradiente exclusivo desta página (perfil = petróleo) */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-teal-950 to-slate-900" />
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
        {/* toggle no canto */}
        <div className="lg:absolute lg:right-4 lg:top-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={atualizando}
            className={`hidden sm:inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-extrabold
              ${atualizando ? "opacity-60 cursor-not-allowed" : "hover:bg-white/10"}
              border-white/20 bg-white/10 text-white`}
            aria-label="Atualizar dados do perfil"
            title="Atualizar perfil"
          >
            <RefreshCw className={`h-4 w-4 ${atualizando ? "animate-spin" : ""}`} />
            {atualizando ? "Atualizando…" : "Atualizar"}
          </button>

          <ThemeTogglePills variant="glass" />
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

        <div className="flex flex-col items-center text-center gap-3">
          <div className="inline-flex items-center gap-2 text-white/90 text-xs font-semibold">
            <Sparkles className="h-4 w-4" />
            <span>Conta • dados pessoais • segurança</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight inline-flex items-center gap-2">
            <User className="w-6 h-6" aria-hidden="true" />
            Meu Perfil
          </h1>

          <p className="text-sm text-white/90 max-w-2xl">
            Atualize seus dados e preferências. O CPF é apenas para consulta.
          </p>

          {/* ministats */}
          <div className="mt-2 w-full max-w-2xl grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/10 px-3 py-2 text-center">
              <div className="text-[11px] uppercase tracking-wide text-white/80">Status</div>
              <div className="text-sm font-extrabold">
                {stats.completo ? "Completo" : "Incompleto"}
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2 text-center">
              <div className="text-[11px] uppercase tracking-wide text-white/80">Completude</div>
              <div className="text-sm font-extrabold">{Math.round(stats.percent)}%</div>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2 text-center">
              <div className="text-[11px] uppercase tracking-wide text-white/80">Pendentes</div>
              <div className="text-sm font-extrabold">{stats.pendentes}</div>
            </div>
          </div>

          {/* barra de progresso */}
          <div className="w-full max-w-2xl mt-2">
            <div className="h-2 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full bg-white/60 transition-all"
                style={{ width: `${Math.max(0, Math.min(100, stats.percent))}%` }}
              />
            </div>
          </div>

          {/* ações */}
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            <BotaoPrimario
              onClick={onSave}
              disabled={salvando || !dirty}
              aria-label="Salvar alterações no perfil"
              icone={<Save className="w-4 h-4" />}
              title={!dirty ? "Sem alterações para salvar" : "Salvar alterações"}
            >
              {salvando ? "Salvando..." : dirty ? "Salvar alterações" : "Sem alterações"}
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

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/20" aria-hidden="true" />
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
  const [dataNascimento, setDataNascimento] = useState(""); // YYYY-MM-DD (date-only)

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
  const [orientacao, setOrientacao] = useState([]);
  const [coresRacas, setCoresRacas] = useState([]);
  const [escolaridades, setEscolaridades] = useState([]);
  const [deficiencias, setDeficiencias] = useState([]);

  // flags
  const [salvando, setSalvando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [carregandoListas, setCarregandoListas] = useState(true);

  // assinatura (aviso)
  const [temAssinatura, setTemAssinatura] = useState(null); // null/true/false

  // theme
  const { theme, setTheme, isDark } = useEscolaTheme();

  // live region
  const liveRef = useRef(null);
  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

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

  // refs (foco)
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
  const validarEmail = (v) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
  const asStr = (v) => (v === null || v === undefined ? "" : String(v));

  const aplicarMascaraCPF = (v) =>
    String(v || "")
      .replace(/\D/g, "")
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

  // registro: só normaliza dígitos (não inventa máscara rígida)
  const normalizeRegistro = (raw) => String(raw || "").replace(/[^\d. -]/g, "").trim();

  // date-only: prioriza substring YYYY-MM-DD sem Date()
  const toYMD = (val) => {
    if (!val) return "";
    const s = String(val).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    return "";
  };

  const clearErrors = () => {
    setENome(""); setEEmail(""); setESenha("");
    setERegistro(""); setEData("");
    setEUnidade(""); setECargo(""); setEGenero("");
    setEOrientacao(""); setECor(""); setEEscolaridade(""); setEDeficiencia("");
  };

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

  /* ───── classes premium ───── */
  const cardCls = (extra = "") =>
    [
      "rounded-3xl border shadow-sm p-6 md:p-8",
      isDark ? "border-white/10 bg-zinc-900/50" : "border-slate-200 bg-white",
      extra,
    ].join(" ");

  const labelCls = "block text-sm font-semibold";
  const hintCls = isDark ? "text-[11px] text-zinc-400" : "text-[11px] text-slate-500";

  const inputCls = (err) =>
    [
      "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition",
      "focus:ring-2 focus:ring-emerald-500/70",
      isDark
        ? "border-white/10 bg-zinc-950/30 text-zinc-100 placeholder:text-zinc-500"
        : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400",
      err ? "ring-2 ring-red-500/60 border-red-500/60" : "",
    ].join(" ");

  const selectCls = (err) => [inputCls(err), "appearance-none"].join(" ");

  useEffect(() => {
    document.title = "Meu Perfil — Escola da Saúde";
  }, []);

  /* snapshot (para detectar dirty sem gambiarra) */
  const snapshot = useMemo(() => {
    const norm = (v) => String(v ?? "").trim();
    return {
      nome: norm(nome),
      email: norm(email).toLowerCase(),
      registro: norm(registro),
      data_nascimento: norm(dataNascimento),
      unidade_id: norm(unidadeId),
      cargo_id: norm(cargoId),
      genero_id: norm(generoId),
      orientacao_sexual_id: norm(orientacaoSexualId),
      cor_raca_id: norm(corRacaId),
      escolaridade_id: norm(escolaridadeId),
      deficiencia_id: norm(deficienciaId),
      // senha não entra no snapshot; é "opcional por digitação"
      senha_set: !!senha,
    };
  }, [
    nome,
    email,
    registro,
    dataNascimento,
    unidadeId,
    cargoId,
    generoId,
    orientacaoSexualId,
    corRacaId,
    escolaridadeId,
    deficienciaId,
    senha,
  ]);

  const [baseline, setBaseline] = useState(null);

  const dirty = useMemo(() => {
    if (!baseline) return false;
    // senha: se digitou, já considera dirty
    if (snapshot.senha_set) return true;

    const keys = Object.keys(snapshot).filter((k) => k !== "senha_set");
    return keys.some((k) => String(snapshot[k] ?? "") !== String(baseline[k] ?? ""));
  }, [baseline, snapshot]);

  /* 1) hidrata do localStorage (rápido para UI) */
  useEffect(() => {
    try {
      const dadosString = localStorage.getItem("usuario");
      if (!dadosString) return;

      const u = JSON.parse(dadosString);

      setUsuario(u);
      setNome(u.nome || "");
      setCpf(aplicarMascaraCPF(u.cpf || ""));
      setEmail(u.email || "");
      setRegistro(normalizeRegistro(u.registro || ""));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* fetch perfil (fonte da verdade) */
  const refreshPerfil = useCallback(async () => {
    setAtualizando(true);
    setLive("Atualizando perfil…");
    try {
      const me = await apiPerfilMe({ on401: "silent", on403: "silent" });
      if (!me) return;

      let antigo = {};
      try { antigo = JSON.parse(localStorage.getItem("usuario") || "{}"); } catch {}

      const cpfFinal = me.cpf ?? antigo.cpf ?? "";
      setNome(me.nome || "");
      setCpf(aplicarMascaraCPF(cpfFinal));
      setEmail(me.email || "");
      setRegistro(normalizeRegistro(me.registro || ""));
      setDataNascimento(toYMD(me.data_nascimento) || "");

      setUnidadeId(asStr(me.unidade_id));
      setCargoId(asStr(me.cargo_id));
      setGeneroId(asStr(me.genero_id));
      setOrientacaoSexualId(asStr(me.orientacao_sexual_id));
      setCorRacaId(asStr(me.cor_raca_id));
      setEscolaridadeId(asStr(me.escolaridade_id));
      setDeficienciaId(asStr(me.deficiencia_id));

      const novo = { ...antigo, ...me, cpf: me.cpf ?? antigo.cpf };
      localStorage.setItem("usuario", JSON.stringify(novo));
      localStorage.setItem("nome", novo.nome || "");
      setUsuario(novo);

      // baseline (para dirty)
      setBaseline({
        nome: String(me.nome || "").trim(),
        email: String(me.email || "").trim().toLowerCase(),
        registro: String(me.registro || "").trim(),
        data_nascimento: String(toYMD(me.data_nascimento) || "").trim(),
        unidade_id: String(me.unidade_id ?? "").trim(),
        cargo_id: String(me.cargo_id ?? "").trim(),
        genero_id: String(me.genero_id ?? "").trim(),
        orientacao_sexual_id: String(me.orientacao_sexual_id ?? "").trim(),
        cor_raca_id: String(me.cor_raca_id ?? "").trim(),
        escolaridade_id: String(me.escolaridade_id ?? "").trim(),
        deficiencia_id: String(me.deficiencia_id ?? "").trim(),
      });

      setLive("Perfil atualizado.");
    } catch (e) {
      console.warn("Falha ao atualizar perfil:", e?.message || e);
      toast.error("Não foi possível atualizar o perfil agora.");
      setLive("Falha ao atualizar perfil.");
    } finally {
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    // carrega baseline via backend assim que possível
    refreshPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* checar assinatura (aviso) — sem "/api" */
  useEffect(() => {
    (async () => {
      try {
        const r = await apiGet("/assinatura", { on401: "silent", on403: "silent" });
        const assinatura = r?.assinatura || r?.data?.assinatura || null;
        setTemAssinatura(!!assinatura);
      } catch {
        setTemAssinatura(false);
      }
    })();
  }, []);

  /* listas auxiliares — sem "/api" */
  useEffect(() => {
    (async () => {
      try {
        setCarregandoListas(true);

        const [uni, car, gen, ori, cr, esc, def] = await Promise.all([
          apiGet("/unidades", { on403: "silent" }),
          apiGet("/cargos", { on403: "silent" }),
          apiGet("/generos", { on403: "silent" }),
          apiGet("/orientacao-sexuais", { on403: "silent" }),
          apiGet("/cores-racas", { on403: "silent" }),
          apiGet("/escolaridades", { on403: "silent" }),
          apiGet("/deficiencias", { on403: "silent" }),
        ]);

        setUnidades((uni || []).sort((a, b) => (a.sigla || a.nome || "").localeCompare(b.sigla || b.nome || "", "pt-BR", { sensitivity: "base" })));
        setCargos((car || []).sort((a, b) => stripPrefixNum(a.nome).localeCompare(stripPrefixNum(b.nome), "pt-BR", { sensitivity: "base" })));

        setGeneros(gen || []);
        setOrientacao(ori || []);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const podeGerenciarAssinatura = useMemo(() => {
    const perfis = Array.isArray(usuario?.perfil)
      ? usuario.perfil.map((p) => String(p).toLowerCase())
      : [String(usuario?.perfil || "").toLowerCase()];
    return perfis.some((p) => p === "instrutor" || p === "administrador");
  }, [usuario?.perfil]);

  /* completude */
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
    [unidadeId, cargoId, generoId, orientacaoSexualId, corRacaId, escolaridadeId, deficienciaId, dataNascimento, nome, email]
  );

  const pendentes = requiredFields.filter(([, v]) => !String(v || "").trim()).length;
  const completo = pendentes === 0;
  const percent = Math.round(((requiredFields.length - pendentes) / requiredFields.length) * 100);

  const stats = useMemo(() => ({ completo, pendentes, percent }), [completo, pendentes, percent]);

  const salvarAlteracao = useCallback(async () => {
    if (!usuario?.id) return;
    if (!dirty) {
      toast.info("Nenhuma alteração para salvar.");
      return;
    }

    clearErrors();

    if (!nome.trim()) { setENome("Informe seu nome."); rNome.current?.focus(); return; }
    if (!validarEmail(email)) { setEEmail("E-mail inválido."); rEmail.current?.focus(); return; }
    if (senha && senha.length < 8) { setESenha("A nova senha deve ter pelo menos 8 caracteres."); rSenha.current?.focus(); return; }
    if (dataNascimento && !/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
      setEData("Data inválida (use o seletor de data).");
      rData.current?.focus();
      return;
    }

    const payload = {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      ...(senha ? { senha } : {}),
      registro: normalizeRegistro(registro) || null,
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
      setLive("Salvando alterações…");

      // ✅ sem "/api"
      await apiPatch("/perfil/me", payload, { auth: true });

      const atualizado = await apiPerfilMe({ on401: "silent", on403: "silent" });
      setPerfilIncompletoFlag(!!atualizado?.perfil_incompleto);

      const antigo = JSON.parse(localStorage.getItem("usuario") || "{}");
      const novo = { ...antigo, ...atualizado, cpf: atualizado?.cpf ?? antigo?.cpf };

      localStorage.setItem("usuario", JSON.stringify(novo));
      localStorage.setItem("nome", novo.nome || "");
      setUsuario(novo);

      // limpa senha e “re-hidrata” campos (fonte da verdade)
      setSenha("");
      setCpf(aplicarMascaraCPF(novo.cpf ?? cpf ?? ""));
      setRegistro(normalizeRegistro(novo.registro || ""));
      setDataNascimento(toYMD(novo.data_nascimento) || "");

      setUnidadeId(asStr(novo.unidade_id));
      setCargoId(asStr(novo.cargo_id));
      setGeneroId(asStr(novo.genero_id));
      setOrientacaoSexualId(asStr(novo.orientacao_sexual_id));
      setCorRacaId(asStr(novo.cor_raca_id));
      setEscolaridadeId(asStr(novo.escolaridade_id));
      setDeficienciaId(asStr(novo.deficiencia_id));

      // atualiza baseline (zera dirty)
      setBaseline({
        nome: String(novo.nome || "").trim(),
        email: String(novo.email || "").trim().toLowerCase(),
        registro: String(novo.registro || "").trim(),
        data_nascimento: String(toYMD(novo.data_nascimento) || "").trim(),
        unidade_id: String(novo.unidade_id ?? "").trim(),
        cargo_id: String(novo.cargo_id ?? "").trim(),
        genero_id: String(novo.genero_id ?? "").trim(),
        orientacao_sexual_id: String(novo.orientacao_sexual_id ?? "").trim(),
        cor_raca_id: String(novo.cor_raca_id ?? "").trim(),
        escolaridade_id: String(novo.escolaridade_id ?? "").trim(),
        deficiencia_id: String(novo.deficiencia_id ?? "").trim(),
      });

      toast.success("✅ Dados atualizados com sucesso!");
      setLive("Alterações salvas.");
    } catch (err) {
      console.error(err);
      const data = err?.data || {};
      const fields = data?.fields || data?.fieldErrors || {};
      const msg = data?.erro || data?.message || "Não foi possível salvar as alterações.";
      aplicarErrosServidor(fields);
      toast.error(`❌ ${msg}`);
      setLive("Falha ao salvar alterações.");
    } finally {
      setSalvando(false);
    }
  }, [
    usuario?.id,
    dirty,
    nome,
    email,
    senha,
    registro,
    dataNascimento,
    unidadeId,
    cargoId,
    generoId,
    orientacaoSexualId,
    corRacaId,
    escolaridadeId,
    deficienciaId,
    cpf,
  ]);

  // atalho Ctrl/Cmd+S
  useEffect(() => {
    const onKey = (e) => {
      const isSave = (e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === "s";
      if (!isSave) return;
      e.preventDefault();
      salvarAlteracao();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [salvarAlteracao]);

  if (!usuario) {
    return (
      <main className={["min-h-screen flex flex-col", isDark ? "bg-zinc-950 text-zinc-100" : "bg-slate-50 text-slate-900"].join(" ")}>
        <HeaderHero
          theme={theme}
          setTheme={setTheme}
          isDark={isDark}
          onSave={salvarAlteracao}
          onRefresh={refreshPerfil}
          onAssinatura={() => setModalAberto(true)}
          podeGerenciarAssinatura={false}
          salvando={true}
          atualizando={true}
          stats={{ completo: false, pendentes: 0, percent: 0 }}
          dirty={false}
        />
        <section className="flex-1 max-w-3xl mx-auto w-full px-4 py-10">
          <div className={cardCls("text-center")}>
            <p className={isDark ? "text-zinc-300" : "text-slate-600"}>🔄 Carregando dados do perfil...</p>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  return (
    <main className={["min-h-screen flex flex-col transition-colors", isDark ? "bg-zinc-950 text-zinc-100" : "bg-slate-50 text-slate-900"].join(" ")}>
      <p ref={liveRef} className="sr-only" aria-live="polite" />
      <HeaderHero
        theme={theme}
        setTheme={setTheme}
        isDark={isDark}
        onSave={salvarAlteracao}
        onRefresh={refreshPerfil}
        onAssinatura={() => setModalAberto(true)}
        podeGerenciarAssinatura={podeGerenciarAssinatura}
        salvando={salvando}
        atualizando={atualizando}
        stats={stats}
        dirty={dirty}
      />

      {/* CTA sticky no mobile */}
      <div className="lg:hidden sticky top-0 z-30 backdrop-blur border-b border-white/10">
        <div className={["px-4 py-3", isDark ? "bg-zinc-950/75" : "bg-white/80"].join(" ")}>
          <div className="flex gap-2">
            <BotaoPrimario
              onClick={refreshPerfil}
              disabled={atualizando}
              variante="secundario"
              className="flex-1 flex items-center justify-center gap-2"
              icone={<RefreshCw className={`w-4 h-4 ${atualizando ? "animate-spin" : ""}`} />}
              aria-label="Atualizar perfil"
            >
              {atualizando ? "Atualizando..." : "Atualizar"}
            </BotaoPrimario>

            <BotaoPrimario
              onClick={salvarAlteracao}
              disabled={salvando || !dirty}
              className="flex-1 flex items-center justify-center gap-2"
              icone={<Save className="w-4 h-4" />}
              aria-label="Salvar alterações"
            >
              {salvando ? "Salvando..." : dirty ? "Salvar" : "Sem alterações"}
            </BotaoPrimario>
          </div>
          <p className={["mt-2 text-[11px]", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
            Dica: use <strong>Ctrl/Cmd + S</strong> para salvar.
          </p>
        </div>
      </div>

      <section id="conteudo" role="main" className="flex-1">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 md:py-12 space-y-6">
          {/* status do cadastro */}
          <div
            role={completo ? "status" : "alert"}
            aria-live="polite"
            className={[
              "rounded-2xl border px-4 py-3 text-sm",
              completo
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200"
                : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200",
            ].join(" ")}
          >
            {completo ? (
              <>✅ <strong className="font-extrabold">Cadastro completo!</strong> Você já tem acesso total à plataforma.</>
            ) : (
              <><strong className="font-extrabold">Ação necessária:</strong> complete os campos obrigatórios para acesso total.</>
            )}
          </div>

          {/* aviso assinatura */}
          {podeGerenciarAssinatura && (
            <div
              role="status"
              aria-live="polite"
              className={[
                "rounded-2xl border px-4 py-3 text-sm",
                temAssinatura === false
                  ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200"
                  : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-200",
              ].join(" ")}
            >
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 mt-0.5" aria-hidden="true" />
                <div>
                  <strong className="font-extrabold">Assinatura digital:</strong>{" "}
                  {temAssinatura === false ? (
                    <>
                      você ainda não cadastrou uma assinatura. Vamos usar seu <em>nome em letra cursiva</em> como assinatura provisória.
                      Para trocar, clique em <em>Gerenciar assinatura</em> e desenhe a sua.
                    </>
                  ) : (
                    <>
                      se quiser trocar sua assinatura, clique em <em>Gerenciar assinatura</em>.
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Card: Dados pessoais */}
          <div className={cardCls()}>
            <h2 className={["text-lg md:text-xl font-extrabold mb-4", isDark ? "text-zinc-100" : "text-slate-900"].join(" ")}>
              Dados pessoais
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="nome" className={labelCls}>
                  Nome completo <span className="text-rose-600">*</span>
                </label>
                <input
                  id="nome"
                  ref={rNome}
                  type="text"
                  value={nome}
                  onChange={(e) => { setNome(e.target.value); setENome(""); }}
                  className={inputCls(!!eNome)}
                  aria-invalid={!!eNome}
                  aria-describedby={eNome ? "erro-nome" : undefined}
                  autoComplete="name"
                />
                {eNome ? <p id="erro-nome" className="text-xs mt-1 text-rose-600">{eNome}</p> : null}
              </div>

              <div>
                <label htmlFor="cpf" className={labelCls}>CPF</label>
                <input
                  id="cpf"
                  type="text"
                  value={cpf}
                  readOnly
                  className={[
                    "w-full rounded-2xl border px-4 py-3 text-sm",
                    isDark ? "border-white/10 bg-zinc-950/30 text-zinc-400" : "border-slate-200 bg-slate-100 text-slate-600",
                  ].join(" ")}
                  aria-readonly="true"
                />
                <p className={["mt-1", hintCls].join(" ")}>Somente leitura nesta tela.</p>
              </div>

              <div>
                <label htmlFor="email" className={labelCls}>
                  E-mail <span className="text-rose-600">*</span>
                </label>
                <input
                  id="email"
                  ref={rEmail}
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEEmail(""); }}
                  className={inputCls(!!eEmail)}
                  aria-invalid={!!eEmail}
                  aria-describedby={eEmail ? "erro-email" : "dica-email"}
                  autoComplete="email"
                />
                {!eEmail ? (
                  <p id="dica-email" className={["mt-1", hintCls].join(" ")}>
                    Ex.: nome.sobrenome@santos.sp.gov.br
                  </p>
                ) : (
                  <p id="erro-email" className="text-xs mt-1 text-rose-600">{eEmail}</p>
                )}
              </div>

              <div>
                <label htmlFor="senha" className={labelCls}>Nova senha (opcional)</label>
                <input
                  id="senha"
                  ref={rSenha}
                  type="password"
                  value={senha}
                  onChange={(e) => { setSenha(e.target.value); setESenha(""); }}
                  placeholder="Digite para alterar"
                  className={inputCls(!!eSenha)}
                  autoComplete="new-password"
                  minLength={8}
                  aria-invalid={!!eSenha}
                  aria-describedby={eSenha ? "erro-senha" : "dica-senha"}
                />
                {!eSenha ? (
                  <p id="dica-senha" className={["mt-1", hintCls].join(" ")}>
                    Mínimo 8 caracteres.
                  </p>
                ) : (
                  <p id="erro-senha" className="text-xs mt-1 text-rose-600">{eSenha}</p>
                )}
              </div>

              <div>
                <label htmlFor="registro" className={labelCls}>Registro (Servidores)</label>
                <input
                  id="registro"
                  ref={rRegistro}
                  type="text"
                  value={registro}
                  onChange={(e) => { setRegistro(normalizeRegistro(e.target.value)); setERegistro(""); }}
                  className={inputCls(!!eRegistro)}
                  placeholder="Se aplicável"
                  disabled={salvando}
                  aria-invalid={!!eRegistro}
                  aria-describedby={eRegistro ? "erro-registro" : "dica-registro"}
                />
                {!eRegistro ? (
                  <p id="dica-registro" className={["mt-1", hintCls].join(" ")}>
                    Se não for servidor, deixe em branco.
                  </p>
                ) : (
                  <p id="erro-registro" className="text-xs mt-1 text-rose-600">{eRegistro}</p>
                )}
              </div>

              <div>
                <label htmlFor="dataNascimento" className={labelCls}>
                  Data de nascimento <span className="text-rose-600">*</span>
                </label>
                <input
                  id="dataNascimento"
                  ref={rData}
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => { setDataNascimento(e.target.value); setEData(""); }}
                  className={inputCls(!!eData)}
                  disabled={salvando}
                  aria-invalid={!!eData}
                  aria-describedby={eData ? "erro-data" : undefined}
                />
                {eData ? <p id="erro-data" className="text-xs mt-1 text-rose-600">{eData}</p> : null}
              </div>
            </div>
          </div>

          {/* Card: Perfil institucional */}
          <div className={cardCls()}>
            <h2 className={["text-lg md:text-xl font-extrabold mb-4", isDark ? "text-zinc-100" : "text-slate-900"].join(" ")}>
              Perfil institucional
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  Unidade <span className="text-rose-600">*</span>
                </label>
                <select
                  ref={rUnidade}
                  value={unidadeId}
                  onChange={(e) => { setUnidadeId(e.target.value); setEUnidade(""); }}
                  className={selectCls(!!eUnidade)}
                  disabled={salvando || carregandoListas}
                  aria-invalid={!!eUnidade}
                  aria-describedby={eUnidade ? "erro-unidade" : undefined}
                >
                  <option value="">{carregandoListas ? "Carregando..." : "Selecione…"}</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={String(u.id)}>{u.sigla || u.nome}</option>
                  ))}
                </select>
                {eUnidade ? <p id="erro-unidade" className="text-xs mt-1 text-rose-600">{eUnidade}</p> : null}
              </div>

              <div>
                <label className={labelCls}>
                  Escolaridade <span className="text-rose-600">*</span>
                </label>
                <select
                  ref={rEscolaridade}
                  value={escolaridadeId}
                  onChange={(e) => { setEscolaridadeId(e.target.value); setEEscolaridade(""); }}
                  className={selectCls(!!eEscolaridade)}
                  disabled={salvando || carregandoListas}
                  aria-invalid={!!eEscolaridade}
                  aria-describedby={eEscolaridade ? "erro-escolaridade" : undefined}
                >
                  <option value="">{carregandoListas ? "Carregando..." : "Selecione…"}</option>
                  {escolaridades.map((esc) => (
                    <option key={esc.id} value={String(esc.id)}>{esc.nome}</option>
                  ))}
                </select>
                {eEscolaridade ? <p id="erro-escolaridade" className="text-xs mt-1 text-rose-600">{eEscolaridade}</p> : null}
              </div>

              <div className="md:col-span-2">
                <label className={labelCls}>
                  Cargo <span className="text-rose-600">*</span>
                </label>
                <select
                  ref={rCargo}
                  value={cargoId}
                  onChange={(e) => { setCargoId(e.target.value); setECargo(""); }}
                  className={selectCls(!!eCargo)}
                  disabled={salvando || carregandoListas}
                  aria-invalid={!!eCargo}
                  aria-describedby={eCargo ? "erro-cargo" : undefined}
                >
                  <option value="">{carregandoListas ? "Carregando..." : "Selecione…"}</option>
                  {cargos.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.nome}</option>
                  ))}
                </select>
                {eCargo ? <p id="erro-cargo" className="text-xs mt-1 text-rose-600">{eCargo}</p> : null}
              </div>
            </div>
          </div>

          {/* Card: Informações demográficas */}
          <div className={cardCls()}>
            <h2 className={["text-lg md:text-xl font-extrabold mb-4", isDark ? "text-zinc-100" : "text-slate-900"].join(" ")}>
              Informações demográficas
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  Gênero <span className="text-rose-600">*</span>
                </label>
                <select
                  ref={rGenero}
                  value={generoId}
                  onChange={(e) => { setGeneroId(e.target.value); setEGenero(""); }}
                  className={selectCls(!!eGenero)}
                  disabled={salvando || carregandoListas}
                  aria-invalid={!!eGenero}
                  aria-describedby={eGenero ? "erro-genero" : undefined}
                >
                  <option value="">{carregandoListas ? "Carregando..." : "Selecione…"}</option>
                  {generos.map((g) => (
                    <option key={g.id} value={String(g.id)}>{g.nome}</option>
                  ))}
                </select>
                {eGenero ? <p id="erro-genero" className="text-xs mt-1 text-rose-600">{eGenero}</p> : null}
              </div>

              <div>
                <label className={labelCls}>
                  Orientação sexual <span className="text-rose-600">*</span>
                </label>
                <select
                  ref={rOrientacao}
                  value={orientacaoSexualId}
                  onChange={(e) => { setOrientacaoSexualId(e.target.value); setEOrientacao(""); }}
                  className={selectCls(!!eOrientacao)}
                  disabled={salvando || carregandoListas}
                  aria-invalid={!!eOrientacao}
                  aria-describedby={eOrientacao ? "erro-orientacao" : undefined}
                >
                  <option value="">{carregandoListas ? "Carregando..." : "Selecione…"}</option>
                  {orientacao.map((o) => (
                    <option key={o.id} value={String(o.id)}>{o.nome}</option>
                  ))}
                </select>
                {eOrientacao ? <p id="erro-orientacao" className="text-xs mt-1 text-rose-600">{eOrientacao}</p> : null}
              </div>

              <div>
                <label className={labelCls}>
                  Cor/raça <span className="text-rose-600">*</span>
                </label>
                <select
                  ref={rCor}
                  value={corRacaId}
                  onChange={(e) => { setCorRacaId(e.target.value); setECor(""); }}
                  className={selectCls(!!eCor)}
                  disabled={salvando || carregandoListas}
                  aria-invalid={!!eCor}
                  aria-describedby={eCor ? "erro-cor" : undefined}
                >
                  <option value="">{carregandoListas ? "Carregando..." : "Selecione…"}</option>
                  {coresRacas.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.nome}</option>
                  ))}
                </select>
                {eCor ? <p id="erro-cor" className="text-xs mt-1 text-rose-600">{eCor}</p> : null}
              </div>

              <div>
                <label className={labelCls}>
                  Deficiência <span className="text-rose-600">*</span>
                </label>
                <select
                  ref={rDeficiencia}
                  value={deficienciaId}
                  onChange={(e) => { setDeficienciaId(e.target.value); setEDeficiencia(""); }}
                  className={selectCls(!!eDeficiencia)}
                  disabled={salvando || carregandoListas}
                  aria-invalid={!!eDeficiencia}
                  aria-describedby={eDeficiencia ? "erro-deficiencia" : "dica-deficiencia"}
                >
                  <option value="">{carregandoListas ? "Carregando..." : "Selecione…"}</option>
                  {deficiencias.map((d) => (
                    <option key={d.id} value={String(d.id)}>{d.nome}</option>
                  ))}
                </select>

                {!eDeficiencia ? (
                  <p id="dica-deficiencia" className={["mt-1", hintCls].join(" ")}>
                    Se não possuir, escolha “Não possuo”.
                  </p>
                ) : (
                  <p id="erro-deficiencia" className="text-xs mt-1 text-rose-600">{eDeficiencia}</p>
                )}
              </div>
            </div>
          </div>

          {/* Modal assinatura */}
          <ModalAssinatura
            isOpen={modalAberto}
            onClose={() => {
              setModalAberto(false);
              // ao fechar, re-checa assinatura
              (async () => {
                try {
                  const r = await apiGet("/assinatura", { on401: "silent", on403: "silent" });
                  const assinatura = r?.assinatura || r?.data?.assinatura || null;
                  setTemAssinatura(!!assinatura);
                } catch {
                  setTemAssinatura(false);
                }
              })();
            }}
          />
        </div>
      </section>

      <Footer />
    </main>
  );
}
