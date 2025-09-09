// 📁 src/pages/Cadastro.jsx
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "react-toastify";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import Spinner from "../components/Spinner";
import { apiGetPublic, apiPost } from "../services/api"; // ⬅️ usa somente públicas aqui

export default function Cadastro() {
  // ───────────────────────────────────────────────────────────────
  // Campos básicos
  // ───────────────────────────────────────────────────────────────
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [registro, setRegistro] = useState("");            // opcional (com máscara)
  const [dataNascimento, setDataNascimento] = useState(""); // obrigatório (YYYY-MM-DD)

  // ───────────────────────────────────────────────────────────────
  // Seleções obrigatórias (IDs)
  // ───────────────────────────────────────────────────────────────
  const [unidadeId, setUnidadeId] = useState("");
  const [cargoId, setCargoId] = useState("");
  const [generoId, setGeneroId] = useState("");
  const [orientacaoSexualId, setOrientacaoSexualId] = useState("");
  const [corRacaId, setCorRacaId] = useState("");
  const [escolaridadeId, setEscolaridadeId] = useState("");
  const [deficienciaId, setDeficienciaId] = useState("");

  // Listas
  const [unidades, setUnidades] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [generos, setGeneros] = useState([]);
  const [orientacoes, setOrientacoes] = useState([]);
  const [coresRacas, setCoresRacas] = useState([]);
  const [escolaridades, setEscolaridades] = useState([]);
  const [deficiencias, setDeficiencias] = useState([]);

  // Senha (último bloco)
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  // Erros
  const [erro, setErro] = useState("");
  const [erroNome, setErroNome] = useState("");
  const [erroCpf, setErroCpf] = useState("");
  const [erroEmail, setErroEmail] = useState("");
  const [erroData, setErroData] = useState("");
  const [erroPerfil, setErroPerfil] = useState("");
  const [erroSenha, setErroSenha] = useState("");
  const [erroConfirmarSenha, setErroConfirmarSenha] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    document.getElementById("nome")?.focus();
  }, []);

  // máscara do registro 00.000-0 (aceita digitar só números)
  const maskRegistro = (raw) => {
    const d = String(raw || "").replace(/\D/g, "").slice(0, 6);
    let out = d;
    if (d.length > 2) out = d.slice(0, 2) + "." + d.slice(2);
    if (d.length > 5) out = out.slice(0, 6) + "-" + d.slice(5);
    return out;
  };

  // ───────────────────────────────────────────────────────────────
  // Lookups: somente rotas públicas (sem Authorization)
  // ───────────────────────────────────────────────────────────────
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

        // ordenação local por nome em unidades/cargos
        setUnidades(ok(uni).sort((a, b) => (a.nome || "").localeCompare(b.nome || "")));
        setCargos(ok(car).sort((a, b) => (a.nome || "").localeCompare(b.nome || "")));

        // já vêm na ordem de display_order do backend
        setGeneros(ok(gen));
        setOrientacoes(ok(ori));
        setCoresRacas(ok(cr));
        setEscolaridades(ok(esc));
        setDeficiencias(ok(def));

        if (
          ok(car).length === 0 &&
          ok(gen).length === 0 &&
          ok(ori).length === 0 &&
          ok(cr).length === 0 &&
          ok(esc).length === 0 &&
          ok(def).length === 0
        ) {
          toast.warn("Algumas listas não estão disponíveis no servidor local.");
        }
      } catch (e) {
        console.warn("Falha ao carregar listas", e);
        toast.error("Não foi possível carregar as listas.");
      } finally {
        alive && setLoadingLookups(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ───────────────────────────────────────────────────────────────
  // Máscaras/validações
  // ───────────────────────────────────────────────────────────────
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

  // ───────────────────────────────────────────────────────────────
  // Submit
  // ───────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setErro(""); setErroNome(""); setErroCpf(""); setErroEmail("");
    setErroData(""); setErroPerfil(""); setErroSenha(""); setErroConfirmarSenha("");

    const nomeTrim = nome.trim();
    const emailTrim = email.trim().toLowerCase();
    const cpfNum = cpf.replace(/\D/g, "");

    if (!nomeTrim) { setErroNome("Nome é obrigatório."); return; }
    if (!validarCPF(cpf)) { setErroCpf("CPF inválido. Use 000.000.000-00."); return; }
    if (!validarEmail(emailTrim)) { setErroEmail("E-mail inválido."); return; }
    if (!dataNascimento) { setErroData("Data de nascimento é obrigatória."); return; }

    if (!unidadeId || !cargoId || !generoId || !orientacaoSexualId || !corRacaId || !escolaridadeId || !deficienciaId) {
      setErroPerfil("Preencha todos os campos de perfil.");
      return;
    }

    if (!senhaForteRe.test(senha)) { setErroSenha("A senha precisa ter 8+ caracteres, com maiúscula, minúscula, número e símbolo."); return; }
    if (senha !== confirmarSenha) { setErroConfirmarSenha("As senhas não coincidem."); return; }

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
      registro: registro?.trim() || null, // já pode vir mascarado
    };

    setLoading(true);
    try {
      await apiPost("/usuarios/cadastro", payload);
      toast.success("✅ Cadastro realizado com sucesso!");
      setTimeout(() => navigate("/login"), 800);
    } catch (err) {
      const msg = err?.data?.erro || err?.data?.message || err?.message || "Erro ao criar conta.";
      setErro(msg);
      setSenha("");
      setConfirmarSenha("");
    } finally {
      setLoading(false);
    }
  }

  // ───────────────────────────────────────────────────────────────
  // UI
  // ───────────────────────────────────────────────────────────────
  return (
    <main role="main" className="min-h-screen bg-gelo flex items-center justify-center px-2">
      <form
        onSubmit={handleSubmit}
        className="bg-lousa text-white rounded-2xl shadow-xl p-8 w-full max-w-3xl space-y-4"
        aria-label="Formulário de Cadastro"
      >
        <h2 className="text-2xl font-bold text-center">Criar Conta</h2>

        {erro && <p className="text-red-300 text-sm text-center" aria-live="assertive">{erro}</p>}

        {/* Nome */}
        <div>
          <label htmlFor="nome" className="block text-sm mb-1">Nome completo</label>
          <input
            id="nome"
            type="text"
            placeholder="Nome completo"
            value={nome}
            onChange={(e) => { setNome(e.target.value); setErroNome(""); }}
            className="w-full px-4 py-2 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-lousa focus:outline-none"
            autoComplete="name"
            disabled={loading}
          />
          {erroNome && <p className="text-red-300 text-xs mt-1">{erroNome}</p>}
        </div>

        {/* CPF | E-mail */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">CPF</label>
            <input
              type="text"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => { setCpf(aplicarMascaraCPF(e.target.value)); setErroCpf(""); }}
              maxLength={14}
              className="w-full px-4 py-2 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-lousa focus:outline-none"
              autoComplete="username"
              inputMode="numeric"
              disabled={loading}
            />
            {erroCpf && <p className="text-red-300 text-xs mt-1">{erroCpf}</p>}
          </div>
          <div>
            <label className="block text-sm mb-1">E-mail</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErroEmail(""); }}
              className="w-full px-4 py-2 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-lousa focus:outline-none"
              autoComplete="email"
              disabled={loading}
            />
            {erroEmail && <p className="text-red-300 text-xs mt-1">{erroEmail}</p>}
          </div>
        </section>

        {/* Registro (opcional) | Data de nascimento (obrigatória) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-white/10">
          <div>
            <label className="block text-sm mb-1">Registro (Servidores da Prefeitura)</label>
            <input
              type="text"
              placeholder="Ex.: 00.000-0"
              value={registro}
              onChange={(e) => setRegistro(maskRegistro(e.target.value))}
              className="w-full px-4 py-2 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-lousa focus:outline-none"
              disabled={loading}
            />
            <p className="text-xs text-white/80 mt-1">Você pode digitar só números (<strong>000000</strong>).</p>
          </div>
          <div>
            <label className="block text-sm mb-1">Data de nascimento</label>
            <input
              type="date"
              value={dataNascimento}
              onChange={(e) => { setDataNascimento(e.target.value); setErroData(""); }}
              className="w-full px-4 py-2 rounded bg-white text-gray-800 focus:ring-2 focus:ring-lousa focus:outline-none"
              disabled={loading}
            />
            {erroData && <p className="text-red-300 text-xs mt-1">{erroData}</p>}
          </div>
        </section>

        {/* Unidade | Gênero */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-white/10">
          <div>
            <label className="block text-sm mb-1">Unidade</label>
            <select
              value={unidadeId}
              onChange={(e) => { setUnidadeId(e.target.value); setErroPerfil(""); }}
              className="w-full px-4 py-2 rounded bg-white text-gray-800 focus:ring-2 focus:ring-lousa focus:outline-none disabled:opacity-60"
              disabled={loading || loadingLookups}
            >
              <option value="">{loadingLookups ? "Carregando..." : "Selecione…"}</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>{u.sigla}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Gênero</label>
            <select
              value={generoId}
              onChange={(e) => { setGeneroId(e.target.value); setErroPerfil(""); }}
              className="w-full px-4 py-2 rounded bg-white text-gray-800 focus:ring-2 focus:ring-lousa focus:outline-none disabled:opacity-60"
              disabled={loading || loadingLookups}
            >
              <option value="">{loadingLookups ? "Carregando..." : "Selecione…"}</option>
              {generos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>
        </section>

        {/* Orientação | Cor/raça */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-white/10">
          <div>
            <label className="block text-sm mb-1">Orientação sexual</label>
            <select
              value={orientacaoSexualId}
              onChange={(e) => { setOrientacaoSexualId(e.target.value); setErroPerfil(""); }}
              className="w-full px-4 py-2 rounded bg-white text-gray-800 focus:ring-2 focus:ring-lousa focus:outline-none disabled:opacity-60"
              disabled={loading || loadingLookups}
            >
              <option value="">{loadingLookups ? "Carregando..." : "Selecione…"}</option>
              {orientacoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Cor/raça</label>
            <select
              value={corRacaId}
              onChange={(e) => { setCorRacaId(e.target.value); setErroPerfil(""); }}
              className="w-full px-4 py-2 rounded bg-white text-gray-800 focus:ring-2 focus:ring-lousa focus:outline-none disabled:opacity-60"
              disabled={loading || loadingLookups}
            >
              <option value="">{loadingLookups ? "Carregando..." : "Selecione…"}</option>
              {coresRacas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </section>

        {/* Escolaridade | Deficiência */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-white/10">
          <div>
            <label className="block text-sm mb-1">Escolaridade</label>
            <select
              value={escolaridadeId}
              onChange={(e) => { setEscolaridadeId(e.target.value); setErroPerfil(""); }}
              className="w-full px-4 py-2 rounded bg-white text-gray-800 focus:ring-2 focus:ring-lousa focus:outline-none disabled:opacity-60"
              disabled={loading || loadingLookups}
            >
              <option value="">{loadingLookups ? "Carregando..." : "Selecione…"}</option>
              {escolaridades.map((esc) => <option key={esc.id} value={esc.id}>{esc.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Deficiência</label>
            <select
              value={deficienciaId}
              onChange={(e) => { setDeficienciaId(e.target.value); setErroPerfil(""); }}
              className="w-full px-4 py-2 rounded bg-white text-gray-800 focus:ring-2 focus:ring-lousa focus:outline-none disabled:opacity-60"
              disabled={loading || loadingLookups}
            >
              <option value="">{loadingLookups ? "Carregando..." : "Selecione…"}</option>
              {deficiencias.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
            <p className="text-xs text-white/70 mt-1">Se não possuir, escolha “Não possuo”.</p>
          </div>
        </section>

        {/* CARGO — largura total */}
        <section className="grid grid-cols-1 gap-3 pt-3 border-t border-white/10">
          <div>
            <label className="block text-sm mb-1">Cargo</label>
            <select
              value={cargoId}
              onChange={(e) => { setCargoId(e.target.value); setErroPerfil(""); }}
              className="w-full px-4 py-2 rounded bg-white text-gray-800 focus:ring-2 focus:ring-lousa focus:outline-none disabled:opacity-60"
              disabled={loading || loadingLookups}
            >
              <option value="">{loadingLookups ? "Carregando..." : "Selecione…"}</option>
              {cargos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        </section>

        {erroPerfil && <p className="text-red-300 text-xs">{erroPerfil}</p>}

        {/* SENHA (último) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-white/10">
          <div className="relative">
            <label className="block text-sm mb-1">Senha</label>
            <input
              type={mostrarSenha ? "text" : "password"}
              placeholder="Senha forte"
              value={senha}
              onChange={(e) => { setSenha(e.target.value); setErroSenha(""); }}
              className="w-full px-4 py-2 pr-12 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-lousa focus:outline-none"
              autoComplete="new-password"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              className="absolute top-8 right-3 text-lousa"
              aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              disabled={loading}
            >
              {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            {erroSenha && <p className="text-red-300 text-xs mt-1">{erroSenha}</p>}
            {senha && (
              <div className="mt-2 h-2 bg-gray-300 rounded" aria-label="Força da senha">
                <div
                  className={`h-2 rounded transition-all duration-300 ${
                    forcaSenha === 1 ? "w-1/5 bg-red-500"
                  : forcaSenha === 2 ? "w-2/5 bg-yellow-500"
                  : forcaSenha === 3 ? "w-3/5 bg-blue-500"
                  : "w-full bg-green-500" }`}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm mb-1">Confirmar senha</label>
            <input
              type="password"
              placeholder="Confirmar senha"
              value={confirmarSenha}
              onChange={(e) => { setConfirmarSenha(e.target.value); setErroConfirmarSenha(""); }}
              className="w-full px-4 py-2 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-lousa focus:outline-none"
              autoComplete="new-password"
              disabled={loading}
            />
            {erroConfirmarSenha && <p className="text-red-300 text-xs mt-1">{erroConfirmarSenha}</p>}
          </div>
        </section>

        {/* Botões */}
        <BotaoPrimario
          type="submit"
          className="w-full flex justify-center items-center gap-2"
          disabled={loading || loadingLookups}
          aria-busy={loading}
        >
          {loading ? <Spinner pequeno /> : "Cadastrar"}
        </BotaoPrimario>

        <BotaoSecundario
          type="button"
          onClick={() => navigate("/login")}
          className="w-full mt-2"
          disabled={loading}
        >
          Voltar para login
        </BotaoSecundario>

        <p className="text-xs text-white/70 text-center mt-4">
          Ao se cadastrar, você concorda com o uso dos seus dados para controle de eventos,
          presença e certificação.
        </p>
      </form>
    </main>
  );
}
