// 📁 src/components/MenuAdministrador.jsx
import { useState, useRef, useEffect, useMemo, useId } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BookOpen, Shield, LogOut, ChevronDown, Users } from "lucide-react";

export default function MenuAdministrador() {
  const [menuAberto, setMenuAberto] = useState(null); // 'usuario' | 'instrutor' | null
  const menuRef = useRef(null);
  const usuarioMenuRefs = useRef([]);
  const instrutorMenuRefs = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();
  const nome = localStorage.getItem("nome") || "";

  // ids estáveis para aria-controls/labelledby
  const usuarioMenuId = useId();
  const instrutorMenuId = useId();

  // Fecha o dropdown ao mudar de rota
  useEffect(() => {
    setMenuAberto(null);
  }, [location.pathname]);

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

  // -------- Navegação por teclado nos menus (setas/Home/End/Enter/Espaço) --------
  const handleMenuKeyDown = (e, refs) => {
    const items = refs.current.filter(Boolean);
    if (!items.length) return;
    const currentIndex = items.findIndex((el) => el === document.activeElement);

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = items[(currentIndex + 1 + items.length) % items.length];
        next?.focus();
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = items[(currentIndex - 1 + items.length) % items.length];
        prev?.focus();
        break;
      }
      case "Home": {
        e.preventDefault();
        items[0]?.focus();
        break;
      }
      case "End": {
        e.preventDefault();
        items[items.length - 1]?.focus();
        break;
      }
      default:
        break;
    }
  };

  // Foca o primeiro item quando o menu abre
  useEffect(() => {
    if (menuAberto === "usuario") {
      const first = usuarioMenuRefs.current.find(Boolean);
      setTimeout(() => first?.focus(), 0);
    } else if (menuAberto === "instrutor") {
      const first = instrutorMenuRefs.current.find(Boolean);
      setTimeout(() => first?.focus(), 0);
    }
  }, [menuAberto]);

  // Conteúdos dos menus
  const usuarioItems = useMemo(
    () => [
      { label: "Eventos", onClick: () => goTo("/eventos") },
      { label: "Meus Certificados", onClick: () => goTo("/certificados") },
    ],
    [] // navigate embutido em goTo
  );

  const instrutorItems = useMemo(
    () => [
      { label: "Painel do instrutor", onClick: () => goTo("/instrutor") },
      { label: "Agenda", onClick: () => goTo("/agenda-instrutor") },
    ],
    []
  );

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
            aria-controls={usuarioMenuId}
            className="flex items-center gap-2 text-sm hover:underline focus-visible:ring-2 focus-visible:ring-white rounded transition px-1 py-0.5"
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
              id={usuarioMenuId}
              className="absolute bg-white text-black rounded shadow p-2 mt-2 w-48 z-10 right-0 md:left-0 md:right-auto"
              role="menu"
              aria-label="Menu do usuário"
              onKeyDown={(e) => handleMenuKeyDown(e, usuarioMenuRefs)}
            >
              {usuarioItems.map((item, i) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  ref={(el) => (usuarioMenuRefs.current[i] = el)}
                  onClick={item.onClick}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      item.onClick();
                    }
                  }}
                  className="block w-full text-left px-2 py-1 hover:bg-gray-100 text-sm rounded outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  {item.label}
                </button>
              ))}
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
            aria-controls={instrutorMenuId}
            className="flex items-center gap-2 text-sm hover:underline focus-visible:ring-2 focus-visible:ring-white rounded transition px-1 py-0.5"
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
              id={instrutorMenuId}
              className="absolute bg-white text-black rounded shadow p-2 mt-2 w-56 z-10 right-0 md:left-0 md:right-auto"
              role="menu"
              aria-label="Menu do instrutor"
              onKeyDown={(e) => handleMenuKeyDown(e, instrutorMenuRefs)}
            >
              {instrutorItems.map((item, i) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  ref={(el) => (instrutorMenuRefs.current[i] = el)}
                  onClick={item.onClick}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      item.onClick();
                    }
                  }}
                  className="block w-full text-left px-2 py-1 hover:bg-gray-100 text-sm rounded outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 🔹 Administrador direto */}
        <div className="relative">
          <button
            type="button"
            onClick={() => goTo("/administrador")}
            className="flex items-center gap-2 text-sm hover:underline focus-visible:ring-2 focus-visible:ring-white rounded transition px-1 py-0.5"
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
          className="flex items-center gap-2 text-sm text-red-300 hover:underline focus-visible:ring-2 focus-visible:ring-red-400 rounded transition px-1 py-0.5"
          aria-label="Sair do sistema"
        >
          <LogOut size={16} aria-hidden="true" />
          Sair
        </button>
      </div>
    </nav>
  );
}
