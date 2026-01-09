// 📁 src/components/MenuAdministrador.jsx
import { useState, useRef, useEffect, useMemo, useId, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Shield, LogOut, ChevronDown, Users, Sparkles } from "lucide-react";

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function isPathActive(pathname, target) {
  if (!target) return false;
  if (target === "/") return pathname === "/";
  return pathname === target || pathname.startsWith(target + "/");
}

export default function MenuAdministrador() {
  const [menuAberto, setMenuAberto] = useState(null); // 'usuario' | 'instrutor' | null
  const menuRef = useRef(null);

  const usuarioMenuRefs = useRef([]);
  const instrutorMenuRefs = useRef([]);

  const navigate = useNavigate();
  const location = useLocation();
  const nome = localStorage.getItem("nome") || "";

  const usuarioMenuId = useId();
  const instrutorMenuId = useId();

  // Fecha o dropdown ao mudar de rota
  useEffect(() => {
    setMenuAberto(null);
  }, [location.pathname]);

  // Fecha ao clicar fora ou pressionar ESC
  useEffect(() => {
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAberto(null);
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

  const toggleMenu = useCallback((id) => {
    setMenuAberto((prev) => (prev === id ? null : id));
  }, []);

  const goTo = useCallback(
    (path) => {
      setMenuAberto(null);
      navigate(path);
    },
    [navigate]
  );

  const handleLogout = useCallback(() => {
    localStorage.clear();
    navigate("/login");
  }, [navigate]);

  // -------- Navegação por teclado nos menus (setas/Home/End) --------
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

  // Foca o primeiro item quando o menu abre (sem setTimeout)
  useEffect(() => {
    if (menuAberto === "usuario") {
      const first = usuarioMenuRefs.current.find(Boolean);
      requestAnimationFrame(() => first?.focus());
    } else if (menuAberto === "instrutor") {
      const first = instrutorMenuRefs.current.find(Boolean);
      requestAnimationFrame(() => first?.focus());
    }
  }, [menuAberto]);

  const usuarioItems = useMemo(
    () => [
      { label: "Eventos", path: "/eventos" },
      { label: "Meus Certificados", path: "/certificados" },
    ],
    []
  );

  const instrutorItems = useMemo(
    () => [
      { label: "Painel do instrutor", path: "/instrutor" },
      { label: "Agenda", path: "/agenda-instrutor" },
    ],
    []
  );

  const activeUsuario = usuarioItems.some((it) => isPathActive(location.pathname, it.path));
  const activeInstrutor = instrutorItems.some((it) => isPathActive(location.pathname, it.path));
  const activeAdmin = isPathActive(location.pathname, "/administrador");

  const ButtonTop = ({ active, onClick, children, ariaLabel }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cls(
        "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold",
        "transition-all active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        active
          ? "bg-white/15 text-white shadow-sm"
          : "text-white/90 hover:bg-white/10"
      )}
    >
      {children}
    </button>
  );

  const Dropdown = ({ id, label, items, refs, width = "w-56" }) => (
    <AnimatePresence>
      {menuAberto === id && (
        <motion.div
          key={id}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.98 }}
          transition={{ duration: 0.16 }}
          role="menu"
          aria-label={label}
          onKeyDown={(e) => handleMenuKeyDown(e, refs)}
          className={cls(
            "absolute z-20 mt-2",
            "right-0 md:left-0 md:right-auto",
            width,
            "rounded-2xl border border-zinc-200/70 dark:border-zinc-800",
            "bg-white/95 dark:bg-zinc-950/90 backdrop-blur",
            "shadow-[0_16px_40px_-24px_rgba(0,0,0,0.55)]",
            "p-2"
          )}
        >
          <div className="px-2 py-1.5 text-[11px] font-extrabold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">
            {label}
          </div>

          <div className="h-px bg-zinc-200/70 dark:bg-zinc-800 my-1" />

          {items.map((item, i) => {
            const isActive = isPathActive(location.pathname, item.path);
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                ref={(el) => (refs.current[i] = el)}
                onClick={() => goTo(item.path)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goTo(item.path);
                  }
                }}
                className={cls(
                  "block w-full text-left rounded-xl px-3 py-2 text-sm font-semibold",
                  "outline-none transition",
                  "focus-visible:ring-2 focus-visible:ring-emerald-600",
                  isActive
                    ? "bg-emerald-600 text-white"
                    : "text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <nav
      className={cls(
        "relative overflow-hidden rounded-3xl mb-10",
        "border border-white/10",
        "bg-gradient-to-br from-[#0b3b2c] via-[#1b4332] to-[#1a1a1a]",
        "text-white shadow-[0_18px_60px_-38px_rgba(0,0,0,0.7)]"
      )}
      role="navigation"
      aria-label="Menu principal do painel administrador"
    >
      {/* Glow */}
      <div className="pointer-events-none absolute -top-28 -right-28 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-fuchsia-400/10 blur-3xl" />

      <div className="relative p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Saudação / identidade */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/10 px-3 py-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 border border-white/10">
                <Sparkles size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="text-sm text-white/80">
                  Seja bem-vindo{nome ? "(a)" : ""},{" "}
                  <span className="font-extrabold text-white break-words">{nome || "Administrador"}</span>
                </div>
                <div className="text-[12px] text-white/70 font-semibold">
                  Painel do administrador
                </div>
              </div>
            </div>
          </div>

          {/* Menus */}
          <div className="flex flex-wrap items-center gap-2 relative" ref={menuRef}>
            {/* Usuário */}
            <div className="relative">
              <ButtonTop
                active={activeUsuario || menuAberto === "usuario"}
                onClick={() => toggleMenu("usuario")}
                ariaLabel="Abrir menu do usuário"
              >
                <BookOpen size={16} aria-hidden="true" />
                Usuário
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className={cls("transition-transform", menuAberto === "usuario" && "rotate-180")}
                />
              </ButtonTop>

              <Dropdown
                id="usuario"
                label="Menu do usuário"
                items={usuarioItems}
                refs={usuarioMenuRefs}
                width="w-56"
              />
            </div>

            {/* Instrutor */}
            <div className="relative">
              <ButtonTop
                active={activeInstrutor || menuAberto === "instrutor"}
                onClick={() => toggleMenu("instrutor")}
                ariaLabel="Abrir menu do instrutor"
              >
                <Shield size={16} aria-hidden="true" />
                Instrutor
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className={cls("transition-transform", menuAberto === "instrutor" && "rotate-180")}
                />
              </ButtonTop>

              <Dropdown
                id="instrutor"
                label="Menu do instrutor"
                items={instrutorItems}
                refs={instrutorMenuRefs}
                width="w-60"
              />
            </div>

            {/* Administrador direto */}
            <ButtonTop
              active={activeAdmin}
              onClick={() => goTo("/administrador")}
              ariaLabel="Ir para painel do administrador"
            >
              <Users size={16} aria-hidden="true" />
              Administrador
            </ButtonTop>

            {/* Sair */}
            <button
              type="button"
              onClick={handleLogout}
              className={cls(
                "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold",
                "text-rose-200 hover:bg-white/10 hover:text-rose-100",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                "transition-all active:scale-[0.99]"
              )}
              aria-label="Sair do sistema"
            >
              <LogOut size={16} aria-hidden="true" />
              Sair
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

MenuAdministrador.propTypes = {};
