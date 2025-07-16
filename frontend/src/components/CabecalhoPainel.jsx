// src/components/CabecalhoPainel.jsx
import { useEffect, useState } from "react";

const TITULO_POR_PERFIL = {
  administrador: "Painel do administradoristrador",
  instrutor: "Painel do instrutor",
  usuario: "Painel do Usuário",
};

export default function CabecalhoPainel({ perfil = "usuario" }) {
  const [nome, setNome] = useState("");

  useEffect(() => {
    const nomeSalvo = localStorage.getItem("nome") || "";
    setNome(nomeSalvo);
  }, []);

  const titulo = TITULO_POR_PERFIL[perfil] || "Painel";

  return (
    <div
      className="bg-lousa text-white py-3 px-4 rounded-2xl mb-6 flex justify-between items-center"
      role="region"
      aria-label={`Cabeçalho do ${titulo}`}
    >
      <p className="font-medium">
        Seja bem-vindo(a), <span className="font-bold">{nome}</span>
      </p>
      <span className="font-bold">{titulo}</span>
    </div>
  );
}
