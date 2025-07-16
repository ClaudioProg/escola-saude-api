import PropTypes from "prop-types";
import { Pencil } from "lucide-react";

export default function TabelaUsuarios({ usuarios, onEditar }) {
  if (!usuarios.length) {
    return (
      <p className="text-center text-gray-600 dark:text-gray-300">
        Nenhum usuário encontrado.
      </p>
    );
  }

  return (
    <ul className="space-y-4 max-w-4xl mx-auto">
      {usuarios.map((usuario) => (
        <li
          key={usuario.id}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow flex justify-between items-center gap-4"
        >
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{usuario.nome}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">{usuario.email}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              perfil:
              {usuario.perfil?.trim() ? (
  <span className="ml-1 font-medium text-gray-700 dark:text-gray-200">
    {usuario.perfil.split(",").map(p => p.trim()).join(", ")}
  </span>
) : (
  <span className="ml-1 italic text-gray-400">Nenhum</span>
)}
            </p>
          </div>
          <button
  onClick={() => onEditar(usuario)}
  className="px-3 py-1 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium flex items-center gap-2 shadow transition-all"
  aria-label={`Editar perfil de ${usuario.nome}`}
>
  <Pencil size={16} />
  Editar
</button>
        </li>
      ))}
    </ul>
  );
}

TabelaUsuarios.propTypes = {
  usuarios: PropTypes.array.isRequired,
  onEditar: PropTypes.func.isRequired,
};
