// ModalEditarPerfil.jsx
import { useState } from "react";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import Modal from "./Modal"; // 🧩 seu modal central reutilizável
import { apiPut } from "../services/api"; // ✅ serviço centralizado

export default function ModalEditarPerfil({ usuario, onFechar, onSalvar }) {
  const perfilDisponiveis = [
    { label: "usuario", value: "usuario" },
    { label: "instrutor", value: "instrutor" },
    { label: "administrador", value: "administrador" },
  ];

  const [perfilSelecionado, setPerfilSelecionado] = useState(
    Array.isArray(usuario.perfil)
      ? usuario.perfil
      : (typeof usuario.perfil === "string"
          ? usuario.perfil.split(",").map(p => p.trim())
          : [])
  );

  const [salvando, setSalvando] = useState(false);

  const togglePerfil = (perfil) => {
    // apenas um perfil por vez
    setPerfilSelecionado([perfil]);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await apiPut(`/api/usuarios/${usuario.id}/perfil`, {
        // se seu backend espera array, mantenha assim; se esperar string, use .join(",")
        perfil: perfilSelecionado,
      });

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
            salvando ? "bg-green-900 cursor-not-allowed" : "bg-lousa hover:bg-green-800"
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
