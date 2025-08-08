import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import Breadcrumbs from "./Breadcrumbs";
import BotaoPrimario from "./BotaoPrimario";

export default function EditarInstrutor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const nomeUsuario = localStorage.getItem("nome") || "";

  const [instrutor, setinstrutor] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setCarregando(true);
    fetch(`http://escola-saude-api.onrender.com/api/usuarios/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setinstrutor)
      .catch(() => setErro("Erro ao carregar dados do instrutor."))
      .finally(() => setCarregando(false));
  }, [id, token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setinstrutor(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro("");

    try {
      const res = await fetch(`http://escola-saude-api.onrender.com/api/usuarios/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(instrutor),
      });

      if (!res.ok) throw new Error();

      toast.success("instrutor atualizado com sucesso!");
      setTimeout(() => navigate("/administrador"), 800);
    } catch {
      setErro("Erro ao salvar alterações.");
      toast.error("❌ Erro ao atualizar instrutor.");
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return (
    <div className="max-w-xl mx-auto p-8">
      <div className="animate-pulse h-8 bg-gray-200 rounded mb-6" />
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 rounded" />
        ))}
      </div>
    </div>
  );

  if (!instrutor) return <p className="text-center text-red-500 my-10">{erro}</p>;

  return (
    <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-8">
      <Breadcrumbs />

      <div className="flex justify-between items-center bg-lousa text-white px-4 py-2 rounded-xl shadow mb-6">
        <span>Seja bem-vindo(a), <strong>{nomeUsuario}</strong></span>
        <span className="font-semibold">Painel do administrador</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow"
        role="form"
        aria-label="Edição de instrutor"
      >
        <h2 className="text-2xl font-bold mb-6 text-lousa dark:text-white text-center">
          ✏️ Editar instrutor
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="nome" className="block font-semibold mb-1">Nome Completo</label>
            <input
              id="nome"
              name="nome"
              type="text"
              value={instrutor.nome || ""}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              required
              aria-required="true"
              aria-label="Nome do instrutor"
            />
          </div>

          <div>
            <label htmlFor="email" className="block font-semibold mb-1">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              value={instrutor.email || ""}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              required
              aria-required="true"
              aria-label="E-mail do instrutor"
            />
          </div>

          <BotaoPrimario onClick={handleSubmit} disabled={salvando}>
            {salvando ? "Salvando..." : "💾 Salvar Alterações"}
          </BotaoPrimario>
        </form>
      </motion.div>
    </main>
  );
}
