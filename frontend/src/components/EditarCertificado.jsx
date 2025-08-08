import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import Breadcrumbs from "../components/Breadcrumbs";
import BotaoPrimario from "../components/BotaoPrimario";

export default function EditarCertificado() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [certificado, setCertificado] = useState(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const nomeUsuario = localStorage.getItem("nome") || "";

  useEffect(() => {
    fetch(`http://escola-saude-api.onrender.com/api/certificados/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(setCertificado)
      .catch(() => setErro("Erro ao carregar dados do certificado."));
  }, [id, token]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;
    setCertificado(prev => ({ ...prev, [name]: newValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro("");

    try {
      const res = await fetch(`http://escola-saude-api.onrender.com/api/certificados/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(certificado),
      });

      if (!res.ok) throw new Error();

      toast.success("Certificado atualizado com sucesso!");
      setTimeout(() => navigate("/administrador"), 900);
    } catch {
      toast.error("❌ Erro ao atualizar certificado.");
      setErro("Erro ao atualizar certificado.");
    } finally {
      setSalvando(false);
    }
  };

  if (!certificado) {
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
        <h1 className="text-2xl font-bold text-[#1b4332] dark:text-white mb-6">✏️ Editar Certificado</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-semibold mb-1">Nome do usuario</label>
            <input
              type="text"
              value={certificado.nome}
              readOnly
              className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-300 border"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Evento</label>
            <input
              type="text"
              value={certificado.evento}
              readOnly
              className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-300 border"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Data de Emissão</label>
            <input
              type="date"
              name="gerado_em"
              value={certificado.gerado_em?.slice(0, 10) || ""}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded bg-white dark:bg-gray-900 border text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Carga Horária</label>
            <input
              type="number"
              name="carga_horaria"
              value={certificado.carga_horaria || ""}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded bg-white dark:bg-gray-900 border text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Código do Certificado</label>
            <input
              type="text"
              value={certificado.codigo}
              readOnly
              className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-300 border"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Link de Validação</label>
            <input
              type="text"
              value={certificado.link_validacao}
              readOnly
              className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-300 border"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="emitido"
              checked={certificado.emitido || false}
              onChange={handleChange}
              id="emitido"
            />
            <label htmlFor="emitido" className="text-sm">Certificado Emitido</label>
          </div>

          <BotaoPrimario type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : "💾 Salvar Alterações"}
          </BotaoPrimario>
        </form>
      </motion.div>
    </main>
  );
}
