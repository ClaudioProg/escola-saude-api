import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import Breadcrumbs from "../components/Breadcrumbs";
import BotaoPrimario from "../components/BotaoPrimario";

export default function EditarUsuario() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [usuario, setUsuario] = useState(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const nomeUsuario = localStorage.getItem("nome") || "";

  useEffect(() => {
    fetch(`http://escola-saude-api.onrender.com/api/usuarios/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(setUsuario)
      .catch(() => setErro("Erro ao carregar dados do usuário."));
  }, [id, token]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setUsuario(prev => ({ ...prev, [name]: checked }));
    } else {
      setUsuario(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePerfilChange = (e) => {
    const value = Array.from(e.target.selectedOptions, (option) => option.value);
    setUsuario((prev) => ({ ...prev, perfil: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro("");

    try {
      const res = await fetch(`http://escola-saude-api.onrender.com/api/usuarios/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(usuario),
      });

      if (!res.ok) throw new Error();

      toast.success("Usuário atualizado com sucesso!");
      setTimeout(() => navigate("/administrador"), 900);
    } catch {
      toast.error("❌ Erro ao atualizar usuário.");
      setErro("Erro ao atualizar usuário.");
    } finally {
      setSalvando(false);
    }
  };

  if (!usuario) {
    return <p className="p-4 text-center text-red-500">{erro || "Carregando..."}</p>;
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-8">
      <Breadcrumbs />

      <div className="flex justify-between items-center bg-lousa text-white px-4 py-2 rounded-xl shadow mb-6">
        <span>Seja bem-vindo(a), <strong>{nomeUsuario}</strong></span>
        <span className="font-semibold">Painel do administrador</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg"
      >
        <h1 className="text-2xl font-bold text-[#1b4332] dark:text-white mb-6">✏️ Editar Usuário</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-semibold mb-1">Nome</label>
            <input
              name="nome"
              type="text"
              value={usuario.nome || ""}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded bg-white dark:bg-gray-900 border text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">E-mail</label>
            <input
              name="email"
              type="email"
              value={usuario.email || ""}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded bg-white dark:bg-gray-900 border text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">CPF</label>
            <input
              name="cpf"
              type="text"
              value={usuario.cpf || ""}
              readOnly
              className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 border"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Perfil</label>
            <select
              multiple
              name="perfil"
              value={usuario.perfil || []}
              onChange={handlePerfilChange}
              className="w-full px-3 py-2 rounded bg-white dark:bg-gray-900 border text-gray-900 dark:text-white"
            >
              <option value="administrador">administrador</option>
              <option value="instrutor">instrutor</option>
              <option value="usuario">usuario</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Segure Ctrl (ou Cmd) para selecionar mais de um.</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="ativo"
              checked={usuario.ativo || false}
              onChange={handleChange}
              id="ativo"
            />
            <label htmlFor="ativo" className="text-sm">Usuário ativo</label>
          </div>

          <BotaoPrimario type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : "💾 Salvar Alterações"}
          </BotaoPrimario>
        </form>
      </motion.div>
    </main>
  );
}
