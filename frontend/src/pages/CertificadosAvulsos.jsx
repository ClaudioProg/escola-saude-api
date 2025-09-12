// ✅ src/pages/CertificadosAvulsos.jsx
import { useEffect, useState, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import { RefreshCcw, Plus } from "lucide-react";

import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import BotaoPrimario from "../components/BotaoPrimario";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";
import { apiGet, apiPost, apiGetFile } from "../services/api";

/* =======================
   Helpers anti-fuso (YYYY-MM-DD)
   ======================= */
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
  const liveRef = useRef(null); // aria-live para feedback de formulário

  useEffect(() => {
    carregarCertificados();
  }, []);

  async function carregarCertificados() {
    try {
      setCarregando(true);
      const data = await apiGet("/api/certificados-avulsos", { on403: "silent" });
      setLista(Array.isArray(data) ? data : []);
    } catch (erro) {
      toast.error("❌ Erro ao carregar certificados.");
      setLista([]);
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
      liveRef.current && (liveRef.current.textContent = "Preencha os campos obrigatórios.");
      return;
    }
    if (!validarEmail(payload.email)) {
      toast.warning("Informe um e-mail válido.");
      liveRef.current && (liveRef.current.textContent = "E-mail inválido.");
      return;
    }
    if (Number.isNaN(payload.carga_horaria) || payload.carga_horaria <= 0) {
      toast.warning("Informe uma carga horária válida (> 0).");
      liveRef.current && (liveRef.current.textContent = "Carga horária inválida.");
      return;
    }
    if (payload.data_inicio && !validYMD(payload.data_inicio)) {
      toast.warning("Data de início inválida.");
      return;
    }
    if (payload.data_fim && !validYMD(payload.data_fim)) {
      toast.warning("Data de término inválida.");
      return;
    }
    if (payload.data_inicio && payload.data_fim && payload.data_fim < payload.data_inicio) {
      toast.warning("A data de término não pode ser anterior à data de início.");
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
      liveRef.current && (liveRef.current.textContent = "Certificado cadastrado com sucesso.");
    } catch (erro) {
      toast.error("❌ Erro ao cadastrar certificado.");
      liveRef.current && (liveRef.current.textContent = "Erro ao cadastrar certificado.");
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

  const listaFiltrada = useMemo(() => {
    return (lista || []).filter((item) => {
      if (filtro === "enviados") return item.enviado === true;
      if (filtro === "nao-enviados") return item.enviado === false || item.enviado === null;
      return true;
    });
  }, [lista, filtro]);

  return (
    <>
      <PageHeader
        title="Certificados Avulsos"
        subtitle="Cadastre, gere o PDF e envie por e-mail certificados fora do fluxo automático."
        breadcrumbs={[
          { label: "Início", href: "/dashboard" },
          { label: "Certificados" },
          { label: "Avulsos", current: true },
        ]}
        actions={[
          {
            label: "Atualizar",
            icon: <RefreshCcw className="w-4 h-4" />,
            onClick: carregarCertificados,
            variant: "ghost",
          },
          {
            label: "Cadastrar",
            icon: <Plus className="w-4 h-4" />,
            form: "form-cert-avulso",
            type: "submit",
          },
        ]}
      />

      <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-3 sm:px-4 py-6">
        {/* feedback de acessibilidade */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {/* Formulário */}
        <form
          id="form-cert-avulso"
          onSubmit={cadastrarCertificado}
          className="grid gap-4 grid-cols-1 md:grid-cols-2 bg-white dark:bg-zinc-800 p-4 shadow rounded-xl max-w-5xl mx-auto"
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
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white"
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
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white"
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
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white"
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
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white"
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
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white"
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
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white"
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
              className="mt-1 w-full border p-2 rounded dark:bg-zinc-700 dark:text-white"
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <BotaoPrimario type="submit" disabled={salvando} aria-busy={salvando}>
              {salvando ? "Enviando..." : "Cadastrar Certificado"}
            </BotaoPrimario>
          </div>
        </form>

        {/* Filtro */}
        <section className="max-w-5xl mx-auto mt-6 flex items-center gap-2">
          <label htmlFor="filtro" className="mr-2 font-semibold text-sm text-lousa dark:text-white">
            Filtrar por envio:
          </label>
          <select
            id="filtro"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="border p-1 rounded dark:bg-zinc-800 dark:text-white"
          >
            <option value="todos">Todos</option>
            <option value="enviados">Enviados</option>
            <option value="nao-enviados">Não enviados</option>
          </select>
          <span className="text-xs text-gray-600 dark:text-gray-300 ml-2">
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
                      <td className="p-2">{item.email}</td>
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
    </>
  );
}
