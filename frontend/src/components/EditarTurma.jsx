import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import Breadcrumbs from "../components/Breadcrumbs";
import BotaoPrimario from "../components/BotaoPrimario";
import { apiGet, apiPut } from "../services/api"; // ✅ serviço centralizado

export default function EditarTurma() {
  const { id } = useParams();
  const navigate = useNavigate();
  const nome = localStorage.getItem("nome") || "";

  const [turma, setTurma] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setCarregando(true);
    apiGet(`/api/turmas/${id}`)
      .then(setTurma)
      .catch(() => setErro("Erro ao carregar dados da turma."))
      .finally(() => setCarregando(false));
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTurma((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      await apiPut(`/api/turmas/${id}`, turma);
      toast.success("✅ Turma atualizada com sucesso!");
      setTimeout(() => navigate("/administrador"), 1000);
    } catch {
      toast.error("❌ Erro ao atualizar turma.");
      setErro("Erro ao atualizar turma.");
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <div className="animate-pulse h-8 bg-gray-200 rounded mb-6" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!turma) {
    return <p className="p-4 text-center text-red-500">{erro || "Erro ao carregar turma."}</p>;
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-8">
      <Breadcrumbs />

      <div className="flex justify-between items-center bg-lousa text-white px-4 py-2 rounded-xl shadow mb-6">
        <span>Seja bem-vindo(a), <strong>{nome}</strong></span>
        <span className="font-semibold">Painel do administrador</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg"
        role="main"
        aria-label="Edição de turma"
      >
        <h2 className="text-2xl font-bold mb-6 text-center text-[#1b4332] dark:text-white">
          ✏️ Editar Turma
        </h2>

        {erro && <p className="text-red-600 mb-4 text-center">{erro}</p>}

        <form onSubmit={handleSubmit} className="space-y-4" aria-label="Formulário de edição de turma">
          <div>
            <label htmlFor="nome" className="block font-semibold mb-1">Nome da Turma</label>
            <input
              id="nome"
              type="text"
              name="nome"
              value={turma.nome ?? ""}
              onChange={handleChange}
              placeholder="Nome da Turma"
              className="w-full border px-3 py-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-400"
              required
              aria-required="true"
              aria-label="Nome da turma"
            />
          </div>

          <div>
            <label htmlFor="data_inicio" className="block font-semibold mb-1">Data de Início</label>
            <input
              id="data_inicio"
              type="date"
              name="data_inicio"
              value={turma.data_inicio?.slice(0, 10) ?? ""}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-400"
              required
              aria-required="true"
              aria-label="Data de início"
            />
          </div>

          <div>
            <label htmlFor="data_fim" className="block font-semibold mb-1">Data de Fim</label>
            <input
              id="data_fim"
              type="date"
              name="data_fim"
              value={turma.data_fim?.slice(0, 10) ?? ""}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-400"
              required
              aria-required="true"
              aria-label="Data de fim"
            />
          </div>

          <div>
            <label htmlFor="vagas_total" className="block font-semibold mb-1">Total de Vagas</label>
            <input
              id="vagas_total"
              type="number"
              name="vagas_total"
              value={turma.vagas_total ?? ""}
              onChange={handleChange}
              placeholder="Total de Vagas"
              className="w-full border px-3 py-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-400"
              required
              aria-required="true"
              aria-label="Total de vagas"
            />
          </div>

          <BotaoPrimario type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : "💾 Salvar Alterações"}
          </BotaoPrimario>
        </form>
      </motion.div>
    </main>
  );
}
