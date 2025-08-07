import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Shield,
  LogOut,
  ChevronDown,
  Users,
} from "lucide-react";

export default function Menuadministrador() {
  const [menuAberto, setMenuAberto] = useState(null);
  const menuRef = useRef();
  const navigate = useNavigate();
  const nome = localStorage.getItem("nome") || "";

  // Fecha o menu se clicar fora
  function handleBlur(e) {
    if (!menuRef.current.contains(e.relatedTarget)) {
      setMenuAberto(null);
    }
  }

  const toggleMenu = (menu) =>
    setMenuAberto((anterior) => (anterior === menu ? null : menu));

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <nav
      className="bg-[#1b4332] text-white p-4 rounded-xl shadow-md mb-10 flex flex-col md:flex-row justify-between items-center"
      role="navigation"
      aria-label="Menu principal do painel administrador"
    >
      {/* 🔰 Saudação do administrador */}
      <div className="flex justify-between items-center bg-lousa text-white px-4 py-2 rounded-xl shadow mb-6 w-full md:w-auto">
        <span>
          Seja bem-vindo(a), <strong>{nome}</strong>
        </span>
        <span className="ml-4 font-semibold hidden md:inline">Painel do administrador</span>
      </div>

      {/* 🔗 Menus de navegação */}
      <div className="flex gap-4 md:gap-6 relative" ref={menuRef}>
        {/* 🔹 usuario */}
        <div className="relative">
          <button
            onClick={() => toggleMenu("usuario")}
            aria-label="Abrir menu usuario"
            className="flex items-center gap-2 text-sm hover:underline focus-visible:ring-2 focus-visible:ring-white rounded transition"
            tabIndex={0}
            onBlur={handleBlur}
          >
            <BookOpen size={16} aria-hidden="true" />
            usuario
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          {menuAberto === "usuario" && (
            <div
              className="absolute bg-white text-black rounded shadow p-2 mt-2 w-48 z-10"
              role="menu"
              aria-label="Menu do usuario"
            >
              <button
                onClick={() => navigate("/eventos")}
                className="block w-full text-left px-2 py-1 hover:bg-gray-100 text-sm"
              >
                Eventos
              </button>
              <button
                onClick={() => navigate("/minhas-inscricoes")}
                className="block w-full text-left px-2 py-1 hover:bg-gray-100 text-sm"
              >
                Meus Cursos
              </button>
              <button
                onClick={() => navigate("/certificados")}
                className="block w-full text-left px-2 py-1 hover:bg-gray-100 text-sm"
              >
                Meus Certificados
              </button>
            </div>
          )}
        </div>

        {/* 🔹 instrutor */}
        <div className="relative">
          <button
            onClick={() => toggleMenu("instrutor")}
            aria-label="Abrir menu instrutor"
            className="flex items-center gap-2 text-sm hover:underline focus-visible:ring-2 focus-visible:ring-white rounded transition"
            tabIndex={0}
            onBlur={handleBlur}
          >
            <Shield size={16} aria-hidden="true" />
            instrutor
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          {menuAberto === "instrutor" && (
            <div
              className="absolute bg-white text-black rounded shadow p-2 mt-2 w-56 z-10"
              role="menu"
              aria-label="Menu do instrutor"
            >
              <button
                onClick={() => navigate("/instrutor")}
                className="block w-full text-left px-2 py-1 hover:bg-gray-100 text-sm"
              >
                Painel do instrutor
              </button>
              <button
                onClick={() => navigate("/agenda-instrutor")}
                className="block w-full text-left px-2 py-1 hover:bg-gray-100 text-sm"
              >
                Agenda
              </button>
            </div>
          )}
        </div>

        {/* 🔹 administrador direto */}
        <div className="relative">
          <button
            onClick={() => navigate("/administrador")}
            className="flex items-center gap-2 text-sm hover:underline focus-visible:ring-2 focus-visible:ring-white rounded transition"
            aria-label="Ir para painel do administrador"
            tabIndex={0}
          >
            <Users size={16} aria-hidden="true" />
            administrador
          </button>
        </div>

        {/* 🔻 Sair */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-red-300 hover:underline focus-visible:ring-2 focus-visible:ring-red-400 rounded transition"
          aria-label="Sair do sistema"
          tabIndex={0}
        >
          <LogOut size={16} aria-hidden="true" />
          Sair
        </button>
      </div>
    </nav>
  );
}
