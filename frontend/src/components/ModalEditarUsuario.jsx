// 📁 src/components/ModalEditarUsuario.jsx
import { useState } from "react";
import Modal from "react-modal";
import { toast } from "react-toastify";
import { User, Mail, BadgeAsterisk } from "lucide-react";

export default function ModalEditarUsuario({ isOpen, onClose, usuario, onAtualizar }) {
  const [nome, setNome] = useState(usuario.nome || "");
  const [email, setEmail] = useState(usuario.email || "");
  const [cpf, setCpf] = useState(usuario.cpf || "");
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    if (!nome || !email || !cpf) {
      toast.warning("⚠️ Preencha todos os campos.");
      return;
    }

    try {
      setSalvando(true);
      const token = localStorage.getItem("token");

      const res = await fetch(`http://escola-saude-api.onrender.com/api/usuarios/${usuario.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nome, email, cpf }),
      });

      if (!res.ok) throw new Error("Erro ao salvar alterações");

      toast.success("✅ Usuário atualizado com sucesso!");
      onAtualizar(); // Atualiza a lista pai
      onClose();
    } catch (err) {
      toast.error("❌ Erro ao atualizar o usuário.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      ariaHideApp={false}
      className="modal"
      overlayClassName="overlay"
    >
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-lousa dark:text-white">
          ✏️ Editar Usuário
        </h2>

        <div className="relative">
          <User className="absolute left-3 top-3 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Nome completo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full pl-10 py-2 border rounded-md"
          />
        </div>

        <div className="relative">
          <Mail className="absolute left-3 top-3 text-gray-500" size={18} />
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-10 py-2 border rounded-md"
          />
        </div>

        <div className="relative">
          <BadgeAsterisk className="absolute left-3 top-3 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="CPF"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            className="w-full pl-10 py-2 border rounded-md"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={onClose}
            className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-md"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="bg-green-700 text-white hover:bg-green-800 px-4 py-2 rounded-md"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
