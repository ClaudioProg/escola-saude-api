// ModalEditarPerfil.jsx
import { useState } from "react";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import Modal from "./Modal"; // 🧩 seu modal central reutilizável

export default function ModalEditarPerfil({ usuario, onFechar, onSalvar }) {
  const perfilDisponiveis = [
    { label: "usuario", value: "usuario" },
    { label: "instrutor", value: "instrutor" },
    { label: "administrador", value: "administrador" },
  ];

  const [perfilSelecionado, setPerfilSelecionado] = useState(
    usuario.perfil
      ? usuario.perfil
          .split(",")
          .map((p) => p.trim())
          .filter((p) => perfilDisponiveis.map((p) => p.value).includes(p))
      : []
  );

  const [salvando, setSalvando] = useState(false);

  const togglePerfil = (perfil) => {
    setPerfilSelecionado([perfil]); // sempre apenas um selecionado
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `http://localhost:3000/api/usuarios/${usuario.id}/perfil`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ perfil: perfilSelecionado }),
        }
      );

      if (!res.ok) throw new Error("Erro ao atualizar perfil");

      toast.success("✅ Perfil atualizado com sucesso!");
      onSalvar(usuario.id, perfilSelecionado);
      onFechar();
    } catch (error) {
      toast.error("❌ Erro ao atualizar perfil");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal open={true} onClose={onFechar}>
      <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
        Editar perfil de {usuario.nome}
      </h2>

      <div className="space-y-3 mb-6">
        {perfilDisponiveis.map((perfil) => (
          <label
            key={perfil.value}
            className="flex items-center gap-2 text-sm text-gray-700 dark:text-white"
          >
            <input
              type="radio"
              name="perfil"
              value={perfil.value}
              checked={perfilSelecionado.includes(perfil.value)}
              onChange={() => togglePerfil(perfil.value)}
              className="accent-green-700"
            />
            {perfil.label}
          </label>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onFechar}
          className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-sm"
        >
          Cancelar
        </button>
        <button
          onClick={salvar}
          disabled={salvando}
          className={`px-4 py-2 rounded text-white text-sm ${
            salvando
              ? "bg-green-900 cursor-not-allowed"
              : "bg-lousa hover:bg-green-800"
          }`}
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

ModalEditarPerfil.propTypes = {
  usuario: PropTypes.object.isRequired,
  onFechar: PropTypes.func.isRequired,
  onSalvar: PropTypes.func.isRequired,
};
