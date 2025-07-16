// src/pages/GestaoUsuarios.jsx
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Navigate } from "react-router-dom";
import Skeleton from "react-loading-skeleton";

import Breadcrumbs from "../components/Breadcrumbs";
import TabelaUsuarios from "../components/TabelaUsuarios";
import ModalEditarperfil from "../components/ModalEditarperfil";
import useperfilPermitidos from "../hooks/useperfilPermitidos";
import CabecalhoPainel from "../components/CabecalhoPainel";

export default function GestaoUsuarios() {
  const { temAcesso, carregando } = useperfilPermitidos(["administrador"]);
  const [usuarios, setUsuarios] = useState([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);

  useEffect(() => {
    carregarUsuarios();
  }, []);

  async function carregarUsuarios() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3000/api/usuarios", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao buscar usuários");
      const data = await res.json();
      setUsuarios(data);
      setErro("");
    } catch {
      setErro("Erro ao carregar usuários.");
      toast.error("Erro ao carregar usuários.");
    } finally {
      setCarregandoUsuarios(false);
    }
  }

  async function salvarperfil(id, perfil) {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:3000/api/usuarios/${id}/perfil`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ perfil }),
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro?.erro || "Erro ao atualizar perfil");
      }

      setUsuarioSelecionado(null);
      await carregarUsuarios();
    } catch (err) {
      console.error("❌ Erro ao atualizar perfil:", err.message);
      toast.error(`❌ ${err.message}`);
    }
  }

  const usuariosFiltrados = usuarios.filter((u) =>
    u.nome.toLowerCase().includes(busca.toLowerCase()) ||
    u.email.toLowerCase().includes(busca.toLowerCase())
  );

  if (carregando) {
    return <p className="text-center mt-10 text-lousa dark:text-white">Verificando permissões...</p>;
  }

  if (!temAcesso) {
    return <Navigate to="/login" replace />;
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-4 py-6 max-w-screen-lg mx-auto">
      <Breadcrumbs trilha={[{ label: "Painel administrador" }, { label: "Gestão de Usuários" }]} />
      <CabecalhoPainel titulo="👥 Gestão de Usuários" />

      <div className="mb-6 mt-4">
        <input
          type="text"
          placeholder="🔍 Buscar por nome ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-lousa dark:bg-gray-800 dark:text-white"
        />
      </div>

      {carregandoUsuarios ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} height={70} className="rounded-lg" />
          ))}
        </div>
      ) : erro ? (
        <p className="text-red-500 text-center">{erro}</p>
      ) : (
        <TabelaUsuarios
          usuarios={usuariosFiltrados}
          onEditar={(usuario) => setUsuarioSelecionado(usuario)}
        />
      )}

      {usuarioSelecionado && (
        <ModalEditarperfil
          usuario={usuarioSelecionado}
          onFechar={() => setUsuarioSelecionado(null)}
          onSalvar={salvarperfil}
        />
      )}
    </main>
  );
}
