// 📁 src/components/ToggleDarkMode.jsx
import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Moon, Sun } from "lucide-react";

/**
 * Componente de alternância entre modo claro/escuro.
 * - Persiste em localStorage
 * - Respeita `prefers-color-scheme` no primeiro carregamento
 * - Anima ícones suavemente
 * - Acessível com ARIA (role="switch")
 */
export default function ToggleDarkMode({ className = "" }) {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return (
    <button
      type="button"
      onClick={() => setDarkMode((v) => !v)}
      role="switch"
      aria-checked={darkMode}
      aria-label={darkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
      title={darkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full shadow-sm font-medium transition-all duration-300
        bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100
        hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-700/40
        ${className}`}
    >
      {darkMode ? (
        <>
          <Sun size={18} className="text-yellow-400 transition-transform rotate-0" aria-hidden="true" />
          <span>Modo Claro</span>
        </>
      ) : (
        <>
          <Moon size={18} className="text-sky-600 transition-transform rotate-0" aria-hidden="true" />
          <span>Modo Escuro</span>
        </>
      )}
    </button>
  );
}

ToggleDarkMode.propTypes = {
  className: PropTypes.string,
};
