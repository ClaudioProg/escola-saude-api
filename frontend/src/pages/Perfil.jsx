// 📁 src/pages/Perfil.jsx
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Breadcrumbs from "../components/Breadcrumbs";
import ModalAssinatura from "../components/ModalAssinatura";
import { apiGet, apiPatch, apiPerfilMe, setPerfilIncompletoFlag } from "../services/api";

export default function Perfil() {
  const [usuario, setUsuario] = useState(null);

  // básicos
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [registro, setRegistro] = useState("");             // (opcional) com máscara
  const [dataNascimento, setDataNascimento] = useState(""); // YYYY-MM-DD

  // selects (IDs) — SEMPRE STRINGS
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

  // helpers
  const stripPrefixNum = (s) => String(s || "").replace(/^\d+\s*-\s*/, "");
  const validarEmail = (v) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const asStr = (v) => (v === null || v === undefined ? "" : String(v));

  // máscara de registro (aceita só números também): 00.000-0
  const maskRegistro = (raw) => {
    const d = String(raw || "").replace(/\D/g, "").slice(0, 6);
    let out = d;
    if (d.length > 2) out = d.slice(0, 2) + "." + d.slice(2);
    if (d.length > 5) out = out.slice(0, 6) + "-" + d.slice(5);
    return out;
  };

  // 🔧 Corrige fuso: sempre devolve só YYYY-MM-DD, sem usar Date()
  const toYMD = (val) => {
    if (!val) return "";
    const s = String(val);
    // já vem em yyyy-mm-dd*  -> corta em 10
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    // fallback: tenta Date, mas retorna apenas yyyy-mm-dd
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    const y = d.getUTCFullYear();
    const mth = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${mth}-${day}`;
  };

  // 1) Hidrata com o que houver no localStorage (mais rápido pra UI)
  useEffect(() => {
    try {
      const dadosString = localStorage.getItem("usuario");
      if (!dadosString) return;

      const dados = JSON.parse(dadosString);
      const perfilString = Array.isArray(dados.perfil) ? dados.perfil[0] : dados.perfil;
      const u = { ...dados, perfil: perfilString };

      setUsuario(u);
      setNome(u.nome || "");
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
      console.error("Erro ao carregar dados do localStorage:", erro);
      toast.error("Erro ao carregar dados do perfil.");
    }
  }, []);

  // 2) Hidrata do backend (fonte da verdade) e sincroniza localStorage
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await apiPerfilMe({ on401: "silent", on403: "silent" });
        if (!alive || !me) return;

        setNome(me.nome || "");
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
          const antigo = JSON.parse(localStorage.getItem("usuario") || "{}");
          const novo = { ...antigo, ...me };
          localStorage.setItem("usuario", JSON.stringify(novo));
          localStorage.setItem("nome", novo.nome || "");
          setUsuario(novo);
        } catch {}
      } catch (e) {
        console.warn("Falha ao buscar perfil:", e?.message || e);
      }
    })();
    return () => { alive = false; };
  }, []);

  // listas auxiliares
  useEffect(() => {
    (async () => {
      try {
        setCarregandoListas(true);
        const [uni, car, gen, ori, cr, esc, def] = await Promise.all([
          apiGet("/unidades", { on403: "silent" }),
          apiGet("/cargos", { on403: "silent" }),
          apiGet("/generos", { on403: "silent" }),
          apiGet("/orientacoes-sexuais", { on403: "silent" }),
          apiGet("/cores-racas", { on403: "silent" }),
          apiGet("/escolaridades", { on403: "silent" }),
          apiGet("/deficiencias", { on403: "silent" }),
        ]);

        setUnidades((uni || []).sort((a, b) => (a.nome || "").localeCompare(b.nome || "")));
        setCargos((car || []).sort((a, b) => stripPrefixNum(a.nome).localeCompare(stripPrefixNum(b.nome))));

        // respeita o display_order do backend
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

  // ⚠️ Perfil incompleto? (usa os estados atuais da tela)
  const perfilIncompleto = [
    unidadeId, cargoId, generoId, orientacaoSexualId,
    corRacaId, escolaridadeId, deficienciaId, dataNascimento,
  ].some((v) => !String(v || "").trim());

  const salvarAlteracoes = async () => {
    if (!usuario?.id) return;

    if (!nome.trim()) {
      toast.warn("Informe seu nome.");
      return;
    }
    if (!validarEmail(email)) {
      toast.warn("Informe um e-mail válido.");
      return;
    }
    if (senha && senha.length < 8) {
      toast.warn("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (dataNascimento && !/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
      toast.warn("Data de nascimento inválida.");
      return;
    }

    const payload = {
      nome: nome.trim(),
      email: email.trim(),
      ...(senha ? { senha } : {}),
      registro: registro?.trim() || null,
      data_nascimento: dataNascimento || null, // já está em YYYY-MM-DD
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
      await apiPatch(`/api/perfil/me`, payload, { auth: true });

      // reconsulta o perfil (também atualiza a flag global via apiPerfilMe)
      const atualizado = await apiPerfilMe({ on401: "silent", on403: "silent" });
      // reforça o broadcast da flag (caso o caller use a flag para navegação)
      setPerfilIncompletoFlag(!!atualizado?.perfil_incompleto);

      const novo = { ...(JSON.parse(localStorage.getItem("usuario") || "{}")), ...atualizado };
      localStorage.setItem("usuario", JSON.stringify(novo));
      localStorage.setItem("nome", novo.nome || "");

      setUsuario(novo);
      setSenha("");

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
      toast.error("❌ Não foi possível salvar as alterações.");
    } finally {
      setSalvando(false);
    }
  };

  if (!usuario) {
    return (
      <div className="p-4 text-center text-gray-600 dark:text-gray-300">
        🔄 Carregando dados do perfil...
      </div>
    );
  }

  const podeGerenciarAssinatura =
    (Array.isArray(usuario.perfil)
      ? usuario.perfil.map((p) => String(p).toLowerCase())
      : [String(usuario.perfil || "").toLowerCase()]
    ).some((p) => p === "instrutor" || p === "administrador");

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 min-h-screen bg-gelo dark:bg-zinc-900">
      <Breadcrumbs trilha={[{ label: "Painel" }, { label: "Perfil" }]} />

      <h1 className="text-2xl font-bold mb-6 text-lousa dark:text-white text-center">
        👤 Meu Perfil
      </h1>

      <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow space-y-6">

        {/* 🔴/🟢 Avisos de status do cadastro */}
        {perfilIncompleto ? (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
          >
            <strong className="font-medium">Ação necessária:</strong>{" "}
            Preencha todo o cadastro para ter acesso completo à plataforma.
          </div>
        ) : (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-green-800 text-sm dark:bg-green-900/20 dark:border-green-800 dark:text-green-300"
          >
            ✅ <strong className="font-medium">Cadastro completo!</strong> Você já tem acesso total à plataforma.
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
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full px-4 py-2 border rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-lousa"
              aria-label="Nome completo"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              E-mail <span className="text-red-600">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-4 py-2 border rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-lousa"
              aria-label="E-mail"
            />
          </div>

          <div>
            <label htmlFor="senha" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Nova senha (opcional)
            </label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite para alterar a senha"
              className="mt-1 w-full px-4 py-2 border rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-lousa"
              aria-label="Nova senha"
            />
            {senha && senha.length < 8 && (
              <p className="text-xs text-red-500 mt-1">
                A nova senha deve ter pelo menos 8 caracteres.
              </p>
            )}
          </div>
        </section>

        {/* Registro + Data de nascimento */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-white/10 pt-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Registro (Servidores da Prefeitura)
            </label>
            <input
              type="text"
              value={registro}
              onChange={(e) => setRegistro(maskRegistro(e.target.value))}
              className="mt-1 w-full px-4 py-2 rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:ring-2 focus:ring-lousa disabled:opacity-60"
              placeholder="Ex.: 10.010-1"
              disabled={salvando}
            />
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
              Você pode digitar só números (<strong>100101</strong>).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Data de nascimento <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              className="mt-1 w-full px-4 py-2 rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:ring-2 focus:ring-lousa disabled:opacity-60"
              disabled={salvando}
            />
          </div>
        </section>

        {/* Unidade + Escolaridade */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-white/10 pt-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Unidade <span className="text-red-600">*</span>
            </label>
            <select
              value={unidadeId}
              onChange={(e) => setUnidadeId(e.target.value)}
              className="mt-1 w-full px-4 py-2 rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:ring-2 focus:ring-lousa disabled:opacity-60"
              disabled={salvando || carregandoListas}
            >
              <option value="">Selecione…</option>
              {unidades.map((u) => (
                <option key={u.id} value={String(u.id)}>{u.sigla}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Escolaridade <span className="text-red-600">*</span>
            </label>
            <select
              value={escolaridadeId}
              onChange={(e) => setEscolaridadeId(e.target.value)}
              className="mt-1 w-full px-4 py-2 rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:ring-2 focus:ring-lousa disabled:opacity-60"
              disabled={salvando || carregandoListas}
            >
              <option value="">Selecione…</option>
              {escolaridades.map((esc) => (
                <option key={esc.id} value={String(esc.id)}>{esc.nome}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Cargo em linha inteira */}
        <section className="grid grid-cols-1 gap-5 border-t border-white/10 pt-1">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Cargo <span className="text-red-600">*</span>
            </label>
            <select
              value={cargoId}
              onChange={(e) => setCargoId(e.target.value)}
              className="mt-1 w-full px-4 py-2 rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:ring-2 focus:ring-lousa disabled:opacity-60"
              disabled={salvando || carregandoListas}
            >
              <option value="">Selecione…</option>
              {cargos.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.nome}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Demográficos */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-white/10 pt-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Gênero <span className="text-red-600">*</span>
            </label>
            <select
              value={generoId}
              onChange={(e) => setGeneroId(e.target.value)}
              className="mt-1 w-full px-4 py-2 rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:ring-2 focus:ring-lousa disabled:opacity-60"
              disabled={salvando || carregandoListas}
            >
              <option value="">Selecione…</option>
              {generos.map((g) => (
                <option key={g.id} value={String(g.id)}>{g.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Orientação sexual <span className="text-red-600">*</span>
            </label>
            <select
              value={orientacaoSexualId}
              onChange={(e) => setOrientacaoSexualId(e.target.value)}
              className="mt-1 w-full px-4 py-2 rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:ring-2 focus:ring-lousa disabled:opacity-60"
              disabled={salvando || carregandoListas}
            >
              <option value="">Selecione…</option>
              {orientacoes.map((o) => (
                <option key={o.id} value={String(o.id)}>{o.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Cor/raça <span className="text-red-600">*</span>
            </label>
            <select
              value={corRacaId}
              onChange={(e) => setCorRacaId(e.target.value)}
              className="mt-1 w-full px-4 py-2 rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:ring-2 focus:ring-lousa disabled:opacity-60"
              disabled={salvando || carregandoListas}
            >
              <option value="">Selecione…</option>
              {coresRacas.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Deficiência <span className="text-red-600">*</span>
            </label>
            <select
              value={deficienciaId}
              onChange={(e) => setDeficienciaId(e.target.value)}
              className="mt-1 w-full px-4 py-2 rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:ring-2 focus:ring-lousa disabled:opacity-60"
              disabled={salvando || carregandoListas}
            >
              <option value="">Selecione…</option>
              {deficiencias.map((d) => (
                <option key={d.id} value={String(d.id)}>{d.nome}</option>
              ))}
            </select>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
              Se não possuir, escolha “Não possuo”.
            </p>
          </div>
        </section>

        <div className="flex flex-col sm:flex-row justify-between gap-5 mt-2">
          <button
            onClick={salvarAlteracoes}
            disabled={salvando}
            className={`${salvando ? "bg-green-900 cursor-not-allowed" : "bg-lousa hover:bg-green-800"} text-white px-5 py-2 rounded-md shadow focus:outline-none focus:ring-2 focus:ring-lousa`}
            aria-label="Salvar alterações no perfil"
          >
            {salvando ? "Salvando..." : "💾 Salvar Alterações"}
          </button>

          {podeGerenciarAssinatura && (
            <button
              onClick={() => setModalAberto(true)}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
              aria-label="Gerenciar assinatura digital"
            >
              ✍️ Gerenciar Assinatura
            </button>
          )}
        </div>
      </div>

      <ModalAssinatura isOpen={modalAberto} onClose={() => setModalAberto(false)} />
    </main>
  );
}
