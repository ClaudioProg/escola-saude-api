// ✅ src/pages/CertificadosAvulsos.jsx
import { useEffect, useState, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import { RefreshCcw, Plus } from "lucide-react";

import Footer from "../components/Footer";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";
import { apiGet, apiPost, apiGetFile } from "../services/api";

/* ---------------- HeaderHero (novo) ---------------- */
function HeaderHero({ onRefresh, onSubmitClick, carregando }) {
  return (
    <header className="bg-gradient-to-br from-amber-900 via-orange-700 to-rose-600 text-white" role="banner">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center flex flex-col items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Certificados Avulsos</h1>
        <p className="text-sm text-white/90">
          Cadastre, gere o PDF e envie por e-mail certificados fora do fluxo automático.
        </p>
        <div className="flex items-center gap-2">
          <BotaoSecundario
            variant="outline"
            cor="azulPetroleo"
            leftIcon={<RefreshCcw className="w-4 h-4" />}
            onClick={onRefresh}
            disabled={carregando}
            aria-label="Atualizar lista de certificados"
          >
            {carregando ? "Atualizando…" : "Atualizar"}
          </BotaoSecundario>

          <BotaoPrimario
            cor="amareloOuro"
            leftIcon={<Plus className="w-4 h-4" />}
            form="form-cert-avulso"
            type="submit"
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

export default function CertificadosAvulsos() {
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    email: "",
    curso: "",
    carga_horaria: "",
    data_inicio: "",
    data_fim: "",
  });

  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [filtro, setFiltro] = useState("todos");
  const [acaoLoading, setAcaoLoading] = useState({ id: null, tipo: null }); // {id, 'pdf' | 'email'}
  const liveRef = useRef(null); // aria-live

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  useEffect(() => {
    carregarCertificados();
  }, []);

  async function carregarCertificados() {
    try {
      setCarregando(true);
      setLive("Carregando certificados…");
      const data = await apiGet("/api/certificados-avulsos", { on403: "silent" });
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
    } finally {
      setCarregando(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function cadastrarCertificado(e) {
    e.preventDefault();

    // normaliza payload
    const payload = {
      nome: form.nome.trim(),
      cpf: form.cpf.trim(), // CPF ou registro funcional
      email: form.email.trim(),
      curso: form.curso.trim(),
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
      const novo = await apiPost("/api/certificados-avulsos", payload);
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
  }

  async function enviarPorEmail(id) {
    setAcaoLoading({ id, tipo: "email" });
    try {
      toast.info("📤 Enviando…");
      await apiPost(`/api/certificados-avulsos/${id}/enviar`);
      toast.success("✅ E-mail enviado!");
      setLista((prev) => prev.map((item) => (item.id === id ? { ...item, enviado: true } : item)));
    } catch {
      toast.error("❌ Erro ao enviar e-mail.");
    } finally {
      setAcaoLoading({ id: null, tipo: null });
    }
  }

  async function gerarPDF(id) {
    setAcaoLoading({ id, tipo: "pdf" });
    try {
      const { blob, filename } = await apiGetFile(`/api/certificados-avulsos/${id}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `certificado_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("❌ Erro ao gerar PDF.");
    } finally {
      setAcaoLoading({ id: null, tipo: null });
    }
  }

  const enviados = useMemo(() => (lista || []).filter((i) => i.enviado === true).length, [lista]);
  const naoEnviados = useMemo(
    () => (lista || []).filter((i) => i.enviado === false || i.enviado == null).length,
    [lista]
  );

  const listaFiltrada = useMemo(() => {
    return (lista || []).filter((item) => {
      if (filtro === "enviados") return item.enviado === true;
      if (filtro === "nao-enviados") return item.enviado === false || item.enviado == null;
      return true;
    });
  }, [lista, filtro]);

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero
        onRefresh={carregarCertificados}
        onSubmitClick={() => document.getElementById("form-cert-avulso")?.requestSubmit()}
        carregando={carregando}
      />

      {/* barra de carregamento fina no topo */}
      {carregando && (
        <div className="sticky top-0 left-0 w-full h-1 bg-amber-100 z-40" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-label="Carregando dados">
          <div className="h-full bg-rose-600 animate-pulse w-1/3" />
        </div>
      )}

      <main className="flex-1 max-w-6xl mx-auto px-3 sm:px-4 py-6">
        {/* feedback de acessibilidade */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {/* KPIs rápidos */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4 text-center">
            <p className="text-xs text-gray-600 dark:text-gray-300">Total</p>
            <p className="text-2xl font-bold">{lista.length}</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4 text-center">
            <p className="text-xs text-gray-600 dark:text-gray-300">Enviados</p>
            <p className="text-2xl font-bold">{enviados}</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4 text-center">
            <p className="text-xs text-gray-600 dark:text-gray-300">Não enviados</p>
            <p className="text-2xl font-bold">{naoEnviados}</p>
          </div>
        </section>

        {/* Formulário */}
        <form
          id="form-cert-avulso"
          onSubmit={cadastrarCertificado}
          className="grid gap-4 grid-cols-1 md:grid-cols-2 bg-white dark:bg-zinc-800 p-4 shadow rounded-xl"
          aria-label="Cadastro de certificado avulso"
        >
          <div className="md:col-span-2">
            <label htmlFor="nome" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
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
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label htmlFor="cpf" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              CPF / Registro funcional
            </label>
            <input
              id="cpf"
              name="cpf"
              type="text"
              value={form.cpf}
              onChange={handleChange}
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              inputMode="numeric"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
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
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label htmlFor="curso" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Curso <span className="text-rose-600">*</span>
            </label>
            <input
              id="curso"
              name="curso"
              type="text"
              value={form.curso}
              onChange={handleChange}
              required
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label htmlFor="carga_horaria" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
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
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label htmlFor="data_inicio" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Data de início
            </label>
            <input
              id="data_inicio"
              name="data_inicio"
              type="date"
              value={form.data_inicio}
              onChange={handleChange}
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label htmlFor="data_fim" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Data de término
            </label>
            <input
              id="data_fim"
              name="data_fim"
              type="date"
              value={form.data_fim}
              onChange={handleChange}
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <BotaoPrimario type="submit" disabled={salvando} aria-busy={salvando}>
              {salvando ? "Enviando..." : "Cadastrar Certificado"}
            </BotaoPrimario>
          </div>
        </form>

        {/* Filtros + contagem */}
        <section className="max-w-6xl mx-auto mt-6 flex items-center gap-2 flex-wrap">
          <label htmlFor="filtro" className="mr-2 font-semibold text-sm text-lousa dark:text-white">
            Filtrar por envio:
          </label>
          <select
            id="filtro"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="border p-1 rounded dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="todos">Todos</option>
            <option value="enviados">Enviados</option>
            <option value="nao-enviados">Não enviados</option>
          </select>
          <span className="text-xs text-gray-600 dark:text-gray-300 ml-2" aria-live="polite">
            {listaFiltrada.length} registro{listaFiltrada.length !== 1 ? "s" : ""}
          </span>
        </section>

        {/* Tabela */}
        <section
          className="max-w-6xl mx-auto mt-3 bg-white dark:bg-zinc-800 rounded-xl shadow overflow-x-auto"
          aria-label="Lista de certificados avulsos"
        >
          {carregando ? (
            <div className="p-4">
              <CarregandoSkeleton linhas={4} />
            </div>
          ) : listaFiltrada.length === 0 ? (
            <div className="p-6">
              <NadaEncontrado mensagem="Nenhum certificado cadastrado." />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-zinc-700 text-left">
                  <th className="p-2 border-b">Nome</th>
                  <th className="p-2 border-b">Curso</th>
                  <th className="p-2 border-b">E-mail</th>
                  <th className="p-2 border-b text-center">Carga Horária</th>
                  <th className="p-2 border-b text-center">Período</th>
                  <th className="p-2 border-b text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((item) => {
                  const di = item.data_inicio?.slice(0, 10) || "";
                  const df = item.data_fim?.slice(0, 10) || "";
                  const periodo = di ? (df && df !== di ? `${ymdToBR(di)} a ${ymdToBR(df)}` : ymdToBR(di)) : "—";

                  const isEmailLoading = acaoLoading.id === item.id && acaoLoading.tipo === "email";
                  const isPdfLoading = acaoLoading.id === item.id && acaoLoading.tipo === "pdf";

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
                            onClick={() => gerarPDF(item.id)}
                            disabled={isPdfLoading}
                            className={`underline ${isPdfLoading ? "opacity-60 cursor-not-allowed" : "text-blue-700 dark:text-blue-300"}`}
                            aria-label={`Baixar PDF do certificado de ${item.nome}`}
                            title="Baixar PDF"
                          >
                            {isPdfLoading ? "Gerando…" : "PDF"}
                          </button>
                          <button
                            onClick={() => enviarPorEmail(item.id)}
                            disabled={isEmailLoading}
                            className={`underline ${isEmailLoading ? "opacity-60 cursor-not-allowed" : "text-green-700 dark:text-green-300"}`}
                            aria-label={`Enviar certificado de ${item.nome} por e-mail`}
                            title={item.enviado ? "Reenviar e-mail" : "Enviar e-mail"}
                          >
                            {isEmailLoading ? "Enviando…" : item.enviado ? "Reenviar" : "Enviar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
