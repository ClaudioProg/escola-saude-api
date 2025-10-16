// ✅ src/pages/CertificadosAvulsos.jsx (mobile/a11y + rota de assinaturas corrigida + UX/segurança)
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { RefreshCcw, Plus, Search, X } from "lucide-react";
import { useReducedMotion } from "framer-motion";

import Footer from "../components/Footer";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";
import { apiGet, apiPost, apiGetFile } from "../services/api";

/* ---------------- HeaderHero ---------------- */
function HeaderHero({ onRefresh, onSubmitClick, carregando }) {
  return (
    <header
      className="bg-gradient-to-br from-amber-900 via-orange-700 to-rose-600 text-white"
      role="banner"
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center flex flex-col items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
          Certificados Avulsos
        </h1>
        <p className="text-sm text-white/90">
          Cadastre, gere o PDF e envie por e-mail certificados fora do fluxo automático.
        </p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <BotaoSecundario
            variant="outline"
            cor="azulPetroleo"
            leftIcon={<RefreshCcw className="w-4 h-4" aria-hidden="true" />}
            onClick={onRefresh}
            disabled={carregando}
            aria-label="Atualizar lista de certificados"
          >
            {carregando ? "Atualizando…" : "Atualizar"}
          </BotaoSecundario>

          {/* 🔧 type="button" para evitar submit duplicado */}
          <BotaoPrimario
            cor="amareloOuro"
            leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
            type="button"
            onClick={onSubmitClick}
            aria-label="Cadastrar novo certificado"
          >
            Cadastrar
          </BotaoPrimario>
        </div>
      </div>
    </header>
  );
}

/* ===================== Helpers de data/email ===================== */
function ymdToBR(ymd) {
  if (!ymd) return "";
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(ymd);
  return `${m[3]}/${m[2]}/${m[1]}`;
}
function validYMD(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
const validarEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
const onlyDigits = (v = "") => String(v).replace(/\D+/g, "");

const clampLen = (s, n = 200) => String(s || "").slice(0, n).trim();

/* ===================== Página ===================== */
export default function CertificadosAvulsos() {
  const reduceMotion = useReducedMotion();

  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    email: "",
    curso: "",
    carga_horaria: "",
    data_inicio: "",
    data_fim: "",
  });

  // opções avançadas de geração
  const [palestrante, setPalestrante] = useState(false);
  const [usarAssinatura2, setUsarAssinatura2] = useState(false);
  const [assinatura2Id, setAssinatura2Id] = useState("");
  const [assinaturas, setAssinaturas] = useState([]); // [{id, nome}]
  const [assinaturasCarregando, setAssinaturasCarregando] = useState(true);

  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [filtro, setFiltro] = useState(() => localStorage.getItem("cert:filtro") || "todos");
  const [busca, setBusca] = useState(() => localStorage.getItem("cert:busca") || "");
  const [buscaDebounced, setBuscaDebounced] = useState(busca);

  const [acaoLoading, setAcaoLoading] = useState({ id: null, tipo: null }); // {id, 'pdf' | 'email'}

  const liveRef = useRef(null); // aria-live
  const erroRef = useRef(null);

  const setLive = useCallback((msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  }, []);

  useEffect(() => {
    carregarCertificados();
    carregarAssinaturas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregarCertificados = useCallback(async () => {
    try {
      setCarregando(true);
      setLive("Carregando certificados…");
      // 🔧 services/api já prefixa /api
      const data = await apiGet("certificados-avulsos", { on403: "silent" });
      setLista(Array.isArray(data) ? data : []);
      setLive(
        Array.isArray(data) && data.length
          ? `Foram carregados ${data.length} certificado(s).`
          : "Nenhum certificado encontrado."
      );
    } catch (erro) {
      toast.error("❌ Erro ao carregar certificados.");
      setLista([]);
      setLive("Falha ao carregar certificados.");
      setTimeout(() => erroRef.current?.focus(), 0);
    } finally {
      setCarregando(false);
    }
  }, [setLive]);

  // Carrega lista de pessoas com assinatura disponível
  const carregarAssinaturas = useCallback(async () => {
    try {
      setAssinaturasCarregando(true);
      // ✅ backend ajustado: GET /api/assinatura/lista
      const data = await apiGet("assinatura/lista", { on403: "silent" });
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.lista) ? data.lista : []);
      const filtradas = arr
        .filter(
          (a) =>
            (a?.tem_assinatura ?? a?.possui_assinatura ?? !!a?.assinatura ?? !!a?.arquivo_assinatura) ===
            true
        )
        .map((a) => ({ id: a.id ?? a.usuario_id ?? a.pessoa_id, nome: a.nome || a.titulo || "—" }))
        .filter((a) => a.id && a.nome);
      setAssinaturas(filtradas);
    } catch {
      setAssinaturas([]);
    } finally {
      setAssinaturasCarregando(false);
    }
  }, []);

  // persistência de busca/filtro com debounce
  useEffect(() => {
    localStorage.setItem("cert:filtro", filtro);
  }, [filtro]);
  useEffect(() => {
    localStorage.setItem("cert:busca", busca);
    const t = setTimeout(() => setBuscaDebounced(busca.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [busca]);

  function handleChange(e) {
    const { name, value } = e.target;

    if (name === "cpf") {
      const dig = onlyDigits(value).slice(0, 14);
      setForm((prev) => ({ ...prev, cpf: dig }));
      return;
    }

    // pequenas proteções contra inputs gigantes
    const maxMap = {
      nome: 150,
      email: 120,
      curso: 160,
    };
    const v = maxMap[name] ? clampLen(value, maxMap[name]) : value;
    setForm((prev) => ({ ...prev, [name]: v }));
  }

  function handlePasteCPF(e) {
    const text = (e.clipboardData || window.clipboardData)?.getData("text") || "";
    const dig = onlyDigits(text).slice(0, 14);
    e.preventDefault();
    setForm((prev) => ({ ...prev, cpf: dig }));
  }

  const cadastrarCertificado = useCallback(
    async (e) => {
      e.preventDefault();
      if (salvando) return; // evita duplo submit

      const payload = {
        nome: clampLen(form.nome.trim(), 150),
        cpf: onlyDigits(form.cpf),
        email: clampLen(form.email.trim(), 120),
        curso: clampLen(form.curso.trim(), 160),
        carga_horaria: Number(form.carga_horaria),
        data_inicio: form.data_inicio || "",
        data_fim: form.data_fim || form.data_inicio || "",
      };

      // validações
      if (!payload.nome || !payload.email || !payload.curso || !payload.carga_horaria) {
        toast.warning("Preencha todos os campos obrigatórios.");
        setLive("Preencha os campos obrigatórios.");
        return;
      }
      if (!validarEmail(payload.email)) {
        toast.warning("Informe um e-mail válido.");
        setLive("E-mail inválido.");
        return;
      }
      if (Number.isNaN(payload.carga_horaria) || payload.carga_horaria <= 0) {
        toast.warning("Informe uma carga horária válida (> 0).");
        setLive("Carga horária inválida.");
        return;
      }
      if (payload.data_inicio && !validYMD(payload.data_inicio)) {
        toast.warning("Data de início inválida.");
        setLive("Data de início inválida.");
        return;
      }
      if (payload.data_fim && !validYMD(payload.data_fim)) {
        toast.warning("Data de término inválida.");
        setLive("Data de término inválida.");
        return;
      }
      if (payload.data_inicio && payload.data_fim && payload.data_fim < payload.data_inicio) {
        toast.warning("A data de término não pode ser anterior à data de início.");
        setLive("A data de término não pode ser anterior à data de início.");
        return;
      }

      setSalvando(true);
      try {
        const novo = await apiPost("certificados-avulsos", payload);
        setLista((prev) => [novo, ...prev]);
        setFiltro("todos");
        setForm({
          nome: "",
          cpf: "",
          email: "",
          curso: "",
          carga_horaria: "",
          data_inicio: "",
          data_fim: "",
        });
        toast.success("✅ Certificado cadastrado.");
        setLive("Certificado cadastrado com sucesso.");
      } catch (erro) {
        toast.error("❌ Erro ao cadastrar certificado.");
        setLive("Erro ao cadastrar certificado.");
      } finally {
        setSalvando(false);
      }
    },
    [form, salvando, setLive]
  );

  const enviarPorEmail = useCallback(async (id) => {
    setAcaoLoading({ id, tipo: "email" });
    try {
      toast.info("📤 Enviando…");
      await apiPost(`certificados-avulsos/${id}/enviar`);
      toast.success("✅ E-mail enviado!");
      setLista((prev) =>
        prev.map((item) => (item.id === id ? { ...item, enviado: true } : item))
      );
    } catch {
      toast.error("❌ Erro ao enviar e-mail.");
    } finally {
      setAcaoLoading({ id: null, tipo: null });
    }
  }, []);

  const gerarPDF = useCallback(
    async (id) => {
      setAcaoLoading({ id, tipo: "pdf" });
      let href = "";
      try {
        const params = new URLSearchParams();
        if (palestrante) params.set("palestrante", "1");
        if (usarAssinatura2 && assinatura2Id) params.set("assinatura2_id", String(assinatura2Id));

        const url = params.toString()
          ? `certificados-avulsos/${id}/pdf?${params.toString()}`
          : `certificados-avulsos/${id}/pdf`;

        // 🔧 apiGetFile deve lidar com headers e nome do arquivo
        const { blob, filename } = await apiGetFile(url);
        href = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = filename || `certificado_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch {
        toast.error("❌ Erro ao gerar PDF.");
      } finally {
        if (href) window.URL.revokeObjectURL(href);
        setAcaoLoading({ id: null, tipo: null });
      }
    },
    [palestrante, usarAssinatura2, assinatura2Id]
  );

  const enviados = useMemo(
    () => (lista || []).filter((i) => i.enviado === true).length,
    [lista]
  );
  const naoEnviados = useMemo(
    () => (lista || []).filter((i) => i.enviado === false || i.enviado == null).length,
    [lista]
  );

  // busca + filtro por enviado
  const listaFiltrada = useMemo(() => {
    const term = buscaDebounced;
    return (lista || []).filter((item) => {
      if (filtro === "enviados" && item.enviado !== true) return false;
      if (filtro === "nao-enviados" && item.enviado === true) return false;

      if (!term) return true;
      const alvo = `${item.nome} ${item.email} ${item.curso}`.toLowerCase();
      return alvo.includes(term);
    });
  }, [lista, filtro, buscaDebounced]);

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero
        onRefresh={carregarCertificados}
        onSubmitClick={() =>
          document.getElementById("form-cert-avulso")?.requestSubmit()
        }
        carregando={carregando}
      />

      {/* barra de carregamento fina no topo */}
      {carregando && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-amber-100 z-40"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando dados"
          aria-busy="true"
        >
          <div
            className={`h-full bg-rose-600 w-1/3 ${
              reduceMotion ? "" : "animate-pulse"
            }`}
          />
        </div>
      )}

      <main
        id="conteudo"
        className="flex-1 max-w-6xl mx-auto px-3 sm:px-4 py-6"
      >
        {/* feedback de acessibilidade */}
        <p ref={liveRef} className="sr-only" aria-live="polite" role="status" />
        <div ref={erroRef} tabIndex={-1} className="sr-only" />

        {/* KPIs rápidos */}
        <section className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-3 sm:p-4 text-center">
            <p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-300">
              Total
            </p>
            <p className="text-xl sm:text-2xl font-bold">{lista.length}</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-3 sm:p-4 text-center">
            <p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-300">
              Enviados
            </p>
            <p className="text-xl sm:text-2xl font-bold">{enviados}</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-3 sm:p-4 text-center">
            <p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-300">
              Não enviados
            </p>
            <p className="text-xl sm:text-2xl font-bold">{naoEnviados}</p>
          </div>
        </section>

        {/* Filtros (mobile-friendly) */}
        <section
          className="bg-white dark:bg-zinc-800 rounded-xl shadow p-3 sm:p-4 mb-4"
          aria-label="Filtros de listagem"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
            <div className="flex-1">
              <label
                htmlFor="busca"
                className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1"
              >
                Buscar
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search
                    className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500"
                    aria-hidden="true"
                  />
                  <input
                    id="busca"
                    type="search"
                    inputMode="search"
                    placeholder="Nome, e-mail ou curso…"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-8 pr-8 py-2 w-full rounded-md border border-gray-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  {busca && (
                    <button
                      type="button"
                      onClick={() => setBusca("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      aria-label="Limpar busca"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="sm:w-64">
              <label
                htmlFor="filtro"
                className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1"
              >
                Filtrar por envio
              </label>
              <select
                id="filtro"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="w-full border p-2 rounded dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
              >
                <option value="todos">Todos</option>
                <option value="enviados">Enviados</option>
                <option value="nao-enviados">Não enviados</option>
              </select>
            </div>

            {(busca || filtro !== "todos") && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setBusca("");
                    setFiltro("todos");
                  }}
                  className="px-3 py-2 text-sm rounded-md bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </div>

          <p className="mt-2 text-xs text-gray-600 dark:text-gray-300" aria-live="polite">
            {listaFiltrada.length} registro{listaFiltrada.length !== 1 ? "s" : ""} encontrado
            {listaFiltrada.length !== 1 ? "s" : ""}.
          </p>
        </section>

        {/* Formulário */}
        <form
          id="form-cert-avulso"
          onSubmit={cadastrarCertificado}
          className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 bg-white dark:bg-zinc-800 p-3 sm:p-4 shadow rounded-xl"
          aria-label="Cadastro de certificado avulso"
          aria-busy={salvando}
        >
          <div className="md:col-span-2">
            <label
              htmlFor="nome"
              className="block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Nome completo <span className="text-rose-600">*</span>
            </label>
            <input
              id="nome"
              name="nome"
              type="text"
              value={form.nome}
              onChange={handleChange}
              required
              autoComplete="name"
              disabled={salvando}
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label
              htmlFor="cpf"
              className="block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              CPF / Registro funcional
            </label>
            <input
              id="cpf"
              name="cpf"
              type="text"
              value={form.cpf}
              onChange={handleChange}
              onPaste={handlePasteCPF}
              disabled={salvando}
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              placeholder="Apenas números"
              aria-describedby="cpf-help"
            />
            <p id="cpf-help" className="text-[11px] text-zinc-500 mt-1">
              Aceita somente números; formataremos no PDF.
            </p>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              E-mail <span className="text-rose-600">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
              disabled={salvando}
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label
              htmlFor="curso"
              className="block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Curso <span className="text-rose-600">*</span>
            </label>
            <input
              id="curso"
              name="curso"
              type="text"
              value={form.curso}
              onChange={handleChange}
              required
              disabled={salvando}
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label
              htmlFor="carga_horaria"
              className="block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Carga horária (h) <span className="text-rose-600">*</span>
            </label>
            <input
              id="carga_horaria"
              name="carga_horaria"
              type="number"
              min={1}
              step="1"
              value={form.carga_horaria}
              onChange={handleChange}
              required
              disabled={salvando}
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label
              htmlFor="data_inicio"
              className="block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Data de início
            </label>
            <input
              id="data_inicio"
              name="data_inicio"
              type="date"
              value={form.data_inicio}
              onChange={handleChange}
              disabled={salvando}
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label
              htmlFor="data_fim"
              className="block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Data de término
            </label>
            <input
              id="data_fim"
              name="data_fim"
              type="date"
              value={form.data_fim}
              onChange={handleChange}
              disabled={salvando}
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* ===== Opções de geração ===== */}
          <fieldset className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3 mt-1">
            <legend className="sr-only">Opções de geração do certificado</legend>

            {/* 1) Palestrante */}
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white dark:bg-zinc-700 dark:border-zinc-600 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={palestrante}
                onChange={(e) => setPalestrante(e.target.checked)}
              />
              <span className="text-sm">
                Palestrante (gerar certificado de palestrante)
              </span>
            </label>

            {/* 2) Segunda assinatura (toggle + select) */}
            <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white dark:bg-zinc-700 dark:border-zinc-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={usarAssinatura2}
                  onChange={(e) => {
                    setUsarAssinatura2(e.target.checked);
                    if (!e.target.checked) setAssinatura2Id("");
                  }}
                />
                <span className="text-sm">Adicionar 2ª assinatura</span>
              </label>

              <div className={`${usarAssinatura2 ? "" : "opacity-50 pointer-events-none"}`}>
                <label
                  htmlFor="assinatura2"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  Selecionar assinatura
                </label>
                <select
                  id="assinatura2"
                  value={assinatura2Id}
                  onChange={(e) => setAssinatura2Id(e.target.value)}
                  disabled={!usarAssinatura2 || assinaturasCarregando || assinaturas.length === 0}
                  aria-disabled={!usarAssinatura2 || assinaturas.length === 0}
                  className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">
                    {assinaturasCarregando ? "Carregando…" : "— Selecione —"}
                  </option>
                  {assinaturas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500 mt-1">
                  {assinaturasCarregando
                    ? "Buscando assinaturas disponíveis…"
                    : assinaturas.length
                    ? "Mostrando apenas pessoas com assinatura cadastrada."
                    : "Nenhuma assinatura cadastrada encontrada."}
                </p>
              </div>
            </div>
          </fieldset>

          <div className="md:col-span-2 flex justify-end">
            <BotaoPrimario type="submit" disabled={salvando} aria-busy={salvando}>
              {salvando ? "Enviando..." : "Cadastrar Certificado"}
            </BotaoPrimario>
          </div>
        </form>

        {/* Lista / Tabela */}
        <section
          className="max-w-6xl mx-auto mt-6"
          aria-label="Lista de certificados avulsos"
        >
          {carregando ? (
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4">
              <CarregandoSkeleton linhas={4} />
            </div>
          ) : listaFiltrada.length === 0 ? (
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-6">
              <NadaEncontrado mensagem="Nenhum certificado cadastrado." />
            </div>
          ) : (
            <>
              {/* Versão mobile: cards */}
              <div className="grid gap-3 sm:hidden">
                {listaFiltrada.map((item) => {
                  const di = item.data_inicio?.slice(0, 10) || "";
                  const df = item.data_fim?.slice(0, 10) || "";
                  const periodo = di
                    ? df && df !== di
                      ? `${ymdToBR(di)} a ${ymdToBR(df)}`
                      : ymdToBR(di)
                    : "—";

                  const isEmailLoading =
                    acaoLoading.id === item.id && acaoLoading.tipo === "email";
                  const isPdfLoading =
                    acaoLoading.id === item.id && acaoLoading.tipo === "pdf";

                  return (
                    <article
                      key={item.id}
                      className="bg-white dark:bg-zinc-800 rounded-xl shadow p-3"
                      role="group"
                      aria-label={`Certificado de ${item.nome}`}
                    >
                      <header className="mb-2">
                        <h3 className="font-semibold text-sm">{item.nome}</h3>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300">
                          {item.curso}
                        </p>
                      </header>
                      <dl className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <dt className="text-zinc-500">E-mail</dt>
                          <dd className="break-all">{item.email}</dd>
                        </div>
                        <div>
                          <dt className="text-zinc-500">Carga</dt>
                          <dd>{item.carga_horaria}h</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-zinc-500">Período</dt>
                          <dd>{periodo}</dd>
                        </div>
                      </dl>

                      <div className="mt-3 flex gap-4">
                        <button
                          type="button"
                          onClick={() => gerarPDF(item.id)}
                          disabled={isPdfLoading}
                          className={`underline ${
                            isPdfLoading
                              ? "opacity-60 cursor-not-allowed"
                              : "text-blue-700 dark:text-blue-300"
                          }`}
                          aria-label={`Baixar PDF do certificado de ${item.nome}`}
                          title={`Baixar PDF${
                            palestrante ? " (palestrante)" : ""
                          }${
                            usarAssinatura2 && assinatura2Id
                              ? " com 2 assinaturas"
                              : ""
                          }`}
                        >
                          {isPdfLoading ? "Gerando…" : "PDF"}
                        </button>
                        <button
                          type="button"
                          onClick={() => enviarPorEmail(item.id)}
                          disabled={isEmailLoading}
                          className={`underline ${
                            isEmailLoading
                              ? "opacity-60 cursor-not-allowed"
                              : "text-green-700 dark:text-green-300"
                          }`}
                          aria-label={`Enviar certificado de ${item.nome} por e-mail`}
                          title={item.enviado ? "Reenviar e-mail" : "Enviar e-mail"}
                        >
                          {isEmailLoading
                            ? "Enviando…"
                            : item.enviado
                            ? "Reenviar"
                            : "Enviar"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Versão desktop: tabela */}
              <div
                className="hidden sm:block bg-white dark:bg-zinc-800 rounded-xl shadow overflow-x-auto"
                role="region"
                aria-live="off"
                aria-busy={acaoLoading.id != null}
              >
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Tabela de certificados com ações de PDF e envio por e-mail
                  </caption>
                  <thead>
                    <tr className="bg-gray-100 dark:bg-zinc-700 text-left">
                      <th scope="col" className="p-2 border-b">
                        Nome
                      </th>
                      <th scope="col" className="p-2 border-b">
                        Curso
                      </th>
                      <th scope="col" className="p-2 border-b">
                        E-mail
                      </th>
                      <th scope="col" className="p-2 border-b text-center">
                        Carga Horária
                      </th>
                      <th scope="col" className="p-2 border-b text-center">
                        Período
                      </th>
                      <th scope="col" className="p-2 border-b text-center">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaFiltrada.map((item) => {
                      const di = item.data_inicio?.slice(0, 10) || "";
                      const df = item.data_fim?.slice(0, 10) || "";
                      const periodo = di
                        ? df && df !== di
                          ? `${ymdToBR(di)} a ${ymdToBR(df)}`
                          : ymdToBR(di)
                        : "—";

                      const isEmailLoading =
                        acaoLoading.id === item.id && acaoLoading.tipo === "email";
                      const isPdfLoading =
                        acaoLoading.id === item.id && acaoLoading.tipo === "pdf";

                      return (
                        <tr key={item.id} className="border-t dark:border-zinc-700">
                          <td className="p-2">{item.nome}</td>
                          <td className="p-2">{item.curso}</td>
                          <td className="p-2 break-all">{item.email}</td>
                          <td className="p-2 text-center">{item.carga_horaria}h</td>
                          <td className="p-2 text-center">{periodo}</td>
                          <td className="p-2">
                            <div className="flex gap-3 justify-center">
                              <button
                                type="button"
                                onClick={() => gerarPDF(item.id)}
                                disabled={isPdfLoading}
                                className={`underline ${
                                  isPdfLoading
                                    ? "opacity-60 cursor-not-allowed"
                                    : "text-blue-700 dark:text-blue-300"
                                }`}
                                aria-label={`Baixar PDF do certificado de ${item.nome}`}
                                title={`Baixar PDF${
                                  palestrante ? " (palestrante)" : ""
                                }${
                                  usarAssinatura2 && assinatura2Id
                                    ? " com 2 assinaturas"
                                    : ""
                                }`}
                              >
                                {isPdfLoading ? "Gerando…" : "PDF"}
                              </button>
                              <button
                                type="button"
                                onClick={() => enviarPorEmail(item.id)}
                                disabled={isEmailLoading}
                                className={`underline ${
                                  isEmailLoading
                                    ? "opacity-60 cursor-not-allowed"
                                    : "text-green-700 dark:text-green-300"
                                }`}
                                aria-label={`Enviar certificado de ${item.nome} por e-mail`}
                                title={item.enviado ? "Reenviar e-mail" : "Enviar e-mail"}
                              >
                                {isEmailLoading
                                  ? "Enviando…"
                                  : item.enviado
                                  ? "Reenviar"
                                  : "Enviar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
