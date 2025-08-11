import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import Breadcrumbs from "../components/Breadcrumbs";
import BotaoPrimario from "../components/BotaoPrimario";
import { apiGet, apiPut, apiDelete } from "../services/api"; // ✅ serviço centralizado

export default function EditarEvento() {
  const { id } = useParams();
  const [evento, setEvento] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const navigate = useNavigate();
  const nome = localStorage.getItem("nome") || "";

  useEffect(() => {
    setCarregando(true);
    apiGet(`/api/eventos/${id}`)
      .then(setEvento)
      .catch(() => setErro("Erro ao carregar evento."))
      .finally(() => setCarregando(false));
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEvento((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      await apiPut(`/api/eventos/${id}`, evento);
      toast.success("✅ Evento atualizado com sucesso!");
      setTimeout(() => navigate("/administrador"), 900);
    } catch {
      toast.error("❌ Não foi possível atualizar o evento.");
      setErro("Não foi possível atualizar o evento.");
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!confirm("Tem certeza que deseja excluir este evento? Esta ação não poderá ser desfeita.")) return;
    try {
      await apiDelete(`/api/eventos/${id}`);
      toast.success("🗑️ Evento excluído com sucesso!");
      navigate("/administrador");
    } catch {
      toast.error("❌ Erro ao excluir evento.");
    }
  };

  if (carregando)
    return (
      <div className="max-w-xl mx-auto p-8">
        <div className="animate-pulse h-8 bg-gray-200 rounded mb-6" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );

  if (erro) return <p className="text-red-500 text-center my-10">{erro}</p>;

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
        aria-label="Edição de evento"
      >
        <h1 className="text-2xl font-bold text-[#1b4332] dark:text-white mb-6">
          ✏️ Editar Evento
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5" aria-label="Formulário de edição de evento">
          <div>
            <label htmlFor="titulo" className="block font-semibold mb-1">
              Título <span className="sr-only">(obrigatório)</span>
            </label>
            <input
              id="titulo"
              type="text"
              name="nome"
              value={evento.nome || ""}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-400"
              required
              aria-required="true"
              aria-label="Título do evento"
            />
          </div>

          <div>
            <label htmlFor="data_inicio" className="block font-semibold mb-1">
              Data de Início <span className="sr-only">(obrigatório)</span>
            </label>
            <input
              id="data_inicio"
              type="date"
              name="data_inicio"
              value={evento.data_inicio?.slice(0, 10) || ""}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-400"
              required
              aria-required="true"
              aria-label="Data de início"
            />
          </div>

          <div>
            <label htmlFor="data_fim" className="block font-semibold mb-1">
              Data de Fim <span className="sr-only">(obrigatório)</span>
            </label>
            <input
              id="data_fim"
              type="date"
              name="data_fim"
              value={evento.data_fim?.slice(0, 10) || ""}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-400"
              required
              aria-required="true"
              aria-label="Data de fim"
            />
          </div>

          <BotaoPrimario type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : "💾 Salvar Alterações"}
          </BotaoPrimario>
        </form>

        <hr className="my-6 border-gray-300 dark:border-gray-600" />

        <button
          type="button"
          onClick={handleExcluir}
          className="text-sm text-red-600 hover:underline mt-2"
        >
          🗑️ Excluir Evento
        </button>
      </motion.div>
    </main>
  );
}
