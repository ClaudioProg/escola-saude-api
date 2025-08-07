import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import BotaoPrimario from "../components/BotaoPrimario";

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
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState("todos");

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function carregarCertificados() {
    try {
      const resposta = await axios.get("/api/certificados-avulsos");
      setLista(resposta.data);
    } catch (erro) {
      toast.error("❌ Erro ao carregar certificados.");
    }
  }

  useEffect(() => {
    carregarCertificados();
  }, []);

  async function cadastrarCertificado(e) {
    e.preventDefault();
    setCarregando(true);
    try {
      const resposta = await axios.post("/api/certificados-avulsos", form);
      setLista((prev) => [resposta.data, ...prev]);
      toast.success("✅ Certificado cadastrado.");
      setForm({
        nome: "",
        cpf: "",
        email: "",
        curso: "",
        carga_horaria: "",
        data_inicio: "",
        data_fim: "",
      });
    } catch (erro) {
      toast.error("❌ Erro ao cadastrar certificado.");
    } finally {
      setCarregando(false);
    }
  }

  async function enviarPorEmail(id) {
    try {
      toast.info("📤 Enviando...");
      await axios.post(`/api/certificados-avulsos/${id}/enviar`);
      toast.success("✅ E-mail enviado!");
      setLista((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, enviado: true } : item
        )
      );
    } catch (erro) {
      toast.error("❌ Erro ao enviar e-mail.");
    }
  }

  async function gerarPDF(id) {
    try {
      window.open(`/api/certificados-avulsos/${id}/pdf`, "_blank");
    } catch (erro) {
      toast.error("❌ Erro ao gerar PDF.");
    }
  }

  const listaFiltrada = lista.filter((item) => {
    if (filtro === "enviados") return item.enviado === true;
    if (filtro === "nao-enviados") return item.enviado === false;
    return true;
  });

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Certificados Avulsos</h1>

      <form
  onSubmit={cadastrarCertificado}
  className="grid gap-4 grid-cols-1 md:grid-cols-2 bg-white p-4 shadow rounded-lg"
>
  <input
    type="text"
    name="nome"
    placeholder="Nome"
    value={form.nome}
    onChange={handleChange}
    required
    className="border p-2 rounded col-span-2"
  />
        <input
          type="text"
          name="cpf"
          placeholder="CPF ou Registro Funcional"
          value={form.cpf}
          onChange={handleChange}
          className="border p-2 rounded"
        />
        <input
          type="email"
          name="email"
          placeholder="E-mail"
          value={form.email}
          onChange={handleChange}
          required
          className="border p-2 rounded"
        />
        <input
          type="text"
          name="curso"
          placeholder="Curso"
          value={form.curso}
          onChange={handleChange}
          required
          className="border p-2 rounded"
        />
        <input
          type="number"
          name="carga_horaria"
          placeholder="Carga Horária"
          value={form.carga_horaria}
          onChange={handleChange}
          required
          className="border p-2 rounded"
        />
        <input
          type="date"
          name="data_inicio"
          placeholder="Data Início"
          value={form.data_inicio}
          onChange={handleChange}
          className="border p-2 rounded"
        />
        <input
          type="date"
          name="data_fim"
          placeholder="Data Fim"
          value={form.data_fim}
          onChange={handleChange}
          className="border p-2 rounded"
        />
        <div className="col-span-2 text-right">
          <BotaoPrimario type="submit" disabled={carregando}>
            {carregando ? "Enviando..." : "Cadastrar Certificado"}
          </BotaoPrimario>
        </div>
      </form>

      <hr className="my-6" />

      <div className="mb-4">
        <label htmlFor="filtro" className="mr-2 font-semibold">
          Filtrar por envio:
        </label>
        <select
          id="filtro"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="border p-1 rounded"
        >
          <option value="todos">Todos</option>
          <option value="enviados">Enviados</option>
          <option value="nao-enviados">Não enviados</option>
        </select>
      </div>

<h2 className="text-lg font-semibold mb-2">Certificados Cadastrados</h2>

<div className="overflow-x-auto">
  <table className="w-full text-sm border">
    <thead>
      <tr className="bg-gray-100">
        <th className="p-2 border">Nome</th>
        <th className="p-2 border">Curso</th>
        <th className="p-2 border">E-mail</th>
        <th className="p-2 border">Carga Horária</th>
        <th className="p-2 border">Período</th>
        <th className="p-2 border">Ações</th>
      </tr>
    </thead>
    <tbody>
      {listaFiltrada.length === 0 && (
        <tr>
          <td colSpan={6} className="p-4 text-center text-gray-500">
            Nenhum certificado cadastrado.
          </td>
        </tr>
      )}
      {listaFiltrada.map((item) => {
        const formatarData = (data) => {
          if (!data) return "";
          return new Date(data).toLocaleDateString("pt-BR");
        };

        const periodo = item.data_inicio
          ? item.data_fim && item.data_fim !== item.data_inicio
            ? `${formatarData(item.data_inicio)} a ${formatarData(item.data_fim)}`
            : formatarData(item.data_inicio)
          : "-";

        return (
          <tr key={item.id} className="border-t">
            <td className="p-2">{item.nome}</td>
            <td className="p-2">{item.curso}</td>
            <td className="p-2">{item.email}</td>
            <td className="p-2 text-center">{item.carga_horaria}h</td>
            <td className="p-2 text-center">{periodo}</td>
            <td className="p-2 flex gap-2 justify-center">
              <button
                onClick={() => gerarPDF(item.id)}
                className="text-blue-600 underline"
              >
                PDF
              </button>
              <button
                onClick={() => enviarPorEmail(item.id)}
                className="text-green-600 underline"
              >
                {item.enviado ? "Reenviar" : "Enviar"}
              </button>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>
    </div>
  );
}
