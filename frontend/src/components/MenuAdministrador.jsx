// 📁 src/components/MenuAdministrador.jsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Shield, LogOut, ChevronDown, Users } from "lucide-react";

export default function MenuAdministrador() {
  const [menuAberto, setMenuAberto] = useState(null); // 'usuario' | 'instrutor' | null
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const nome = localStorage.getItem("nome") || "";

  // Fecha ao clicar fora ou pressionar ESC
  useEffect(() => {
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuAberto(null);
      }
    }
    function onKey(e) {
      if (e.key === "Escape") setMenuAberto(null);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const toggleMenu = (id) => setMenuAberto((prev) => (prev === id ? null : id));
  const goTo = (path) => {
    setMenuAberto(null);
    navigate(path);
  };

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
      {/* 🔰 Saudação */}
      <div className="flex justify-between items-center bg-lousa text-white px-4 py-2 rounded-xl shadow mb-6 w-full md:w-auto">
        <span>
          Seja bem-vindo(a), <strong>{nome}</strong>
        </span>
        <span className="ml-4 font-semibold hidden md:inline">Painel do administrador</span>
      </div>

      {/* 🔗 Menus */}
      <div className="flex gap-4 md:gap-6 relative" ref={menuRef}>
        {/* 🔹 Usuário */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu("usuario")}
            aria-label="Abrir menu do usuário"
            aria-haspopup="menu"
            aria-expanded={menuAberto === "usuario"}
            aria-controls="menu-usuario"
            className="flex items-center gap-2 text-sm hover:underline focus-visible:ring-2 focus-visible:ring-white rounded transition"
          >
            <BookOpen size={16} aria-hidden="true" />
            Usuário
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={`transition-transform ${menuAberto === "usuario" ? "rotate-180" : ""}`}
            />
          </button>

          {menuAberto === "usuario" && (
            <div
              id="menu-usuario"
              className="absolute bg-white text-black rounded shadow p-2 mt-2 w-48 z-10"
              role="menu"
              aria-label="Menu do usuário"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => goTo("/eventos")}
                className="block w-full text-left px-2 py-1 hover:bg-gray-100 text-sm"
              >
                Eventos
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => goTo("/minhas-inscricoes")}
                className="block w-full text-left px-2 py-1 hover:bg-gray-100 text-sm"
              >
                Meus Cursos
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => goTo("/certificados")}
                className="block w-full text-left px-2 py-1 hover:bg-gray-100 text-sm"
              >
                Meus Certificados
              </button>
            </div>
          )}
        </div>

        {/* 🔹 Instrutor */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu("instrutor")}
            aria-label="Abrir menu do instrutor"
            aria-haspopup="menu"
            aria-expanded={menuAberto === "instrutor"}
            aria-controls="menu-instrutor"
            className="flex items-center gap-2 text-sm hover:underline focus-visible:ring-2 focus-visible:ring-white rounded transition"
          >
            <Shield size={16} aria-hidden="true" />
            Instrutor
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={`transition-transform ${menuAberto === "instrutor" ? "rotate-180" : ""}`}
            />
          </button>

          {menuAberto === "instrutor" && (
            <div
              id="menu-instrutor"
              className="absolute bg-white text-black rounded shadow p-2 mt-2 w-56 z-10"
              role="menu"
              aria-label="Menu do instrutor"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => goTo("/instrutor")}
                className="block w-full text-left px-2 py-1 hover:bg-gray-100 text-sm"
              >
                Painel do instrutor
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => goTo("/agenda-instrutor")}
                className="block w-full text-left px-2 py-1 hover:bg-gray-100 text-sm"
              >
                Agenda
              </button>
            </div>
          )}
        </div>

        {/* 🔹 Administrador direto */}
        <div className="relative">
          <button
            type="button"
            onClick={() => goTo("/administrador")}
            className="flex items-center gap-2 text-sm hover:underline focus-visible:ring-2 focus-visible:ring-white rounded transition"
            aria-label="Ir para painel do administrador"
          >
            <Users size={16} aria-hidden="true" />
            Administrador
          </button>
        </div>

        {/* 🔻 Sair */}
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-red-300 hover:underline focus-visible:ring-2 focus-visible:ring-red-400 rounded transition"
          aria-label="Sair do sistema"
        >
          <LogOut size={16} aria-hidden="true" />
          Sair
        </button>
      </div>
    </nav>
  );
}
