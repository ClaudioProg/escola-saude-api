// 📁 src/components/ModalEditarPerfil.jsx
import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import Modal from "./Modal";
import { apiPut } from "../services/api";

export default function ModalEditarPerfil({
  isOpen = true,                  // 👈 agora controlável
  usuario,
  onFechar,
  onSalvar,
  enviarComoString = false,       // 👈 se seu backend esperar string
}) {
  const perfisDisponiveis = [
    { label: "usuario", value: "usuario" },
    { label: "instrutor", value: "instrutor" },
    { label: "administrador", value: "administrador" },
  ];

  // normaliza perfil vindo do backend
  const perfilInicial = useMemo(() => {
    if (Array.isArray(usuario?.perfil)) return (usuario.perfil[0] ?? "") || "";
    if (typeof usuario?.perfil === "string") {
      const arr = usuario.perfil.split(",").map((p) => p.trim()).filter(Boolean);
      return arr[0] ?? "";
    }
    return "";
  }, [usuario]);

  const [perfilSelecionado, setPerfilSelecionado] = useState(perfilInicial);
  const [salvando, setSalvando] = useState(false);

  // re-sincroniza se trocar o usuario prop
  useEffect(() => {
    setPerfilSelecionado(perfilInicial);
  }, [perfilInicial]);

  const mudou = perfilSelecionado !== perfilInicial;
  const podeSalvar = mudou && !!perfilSelecionado && !salvando;

  const salvar = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      const payloadPerfil = enviarComoString ? perfilSelecionado : [perfilSelecionado];

      await apiPut(`/api/usuarios/${usuario.id}/perfil`, { perfil: payloadPerfil });

      toast.success("✅ Perfil atualizado com sucesso!");
      onSalvar?.(usuario.id, payloadPerfil);
      onFechar?.();
    } catch (error) {
      const msg =
        error?.data?.mensagem ||
        error?.data?.message ||
        error?.message ||
        "Erro ao atualizar perfil";
      toast.error(`❌ ${msg}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={salvando ? undefined : onFechar}>
      <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
        Editar perfil de {usuario?.nome ?? "usuário"}
      </h2>

      <fieldset className="space-y-3 mb-6">
        <legend className="sr-only">Selecione um perfil</legend>
        {perfisDisponiveis.map((perfil) => (
          <label
            key={perfil.value}
            className="flex items-center gap-2 text-sm text-gray-700 dark:text-white"
          >
            <input
              type="radio"
              name="perfil"
              value={perfil.value}
              checked={perfilSelecionado === perfil.value}
              onChange={() => setPerfilSelecionado(perfil.value)}
              className="accent-green-700"
              disabled={salvando}
            />
            {perfil.label}
          </label>
        ))}
      </fieldset>

      <div className="flex justify-end gap-3">
        <button
          onClick={onFechar}
          disabled={salvando}
          className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 disabled:opacity-60
                     dark:bg-gray-700 dark:hover:bg-gray-600 text-sm"
        >
          Cancelar
        </button>
        <button
          onClick={salvar}
          disabled={!podeSalvar}
          className={`px-4 py-2 rounded text-white text-sm ${
            podeSalvar ? "bg-lousa hover:bg-green-800" : "bg-green-900 opacity-60 cursor-not-allowed"
          }`}
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

ModalEditarPerfil.propTypes = {
  isOpen: PropTypes.bool,
  usuario: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    nome: PropTypes.string,
    perfil: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.string),
    ]),
  }).isRequired,
  onFechar: PropTypes.func.isRequired,
  onSalvar: PropTypes.func,          // (id, novoPerfil) => void
  enviarComoString: PropTypes.bool,
};
