// 📁 src/components/ToggleDarkMode.jsx
import { useEffect, useState } from "react";
import PropTypes from "prop-types";

export default function ToggleDarkMode({ className = "" }) {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false; // padrão claro em SSR
    return localStorage.getItem("theme") === "dark"; // sem prefers-color-scheme
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  return (
    <button
      type="button"
      onClick={() => setDarkMode(v => !v)}
      role="switch"
      aria-checked={darkMode}
      aria-label={darkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
      className={`text-sm px-4 py-1.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:scale-105 transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-green-700/40 ${className}`}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden="true">{darkMode ? "☀️" : "🌙"}</span>
        {darkMode ? "Modo Claro" : "Modo Escuro"}
      </span>
    </button>
  );
}
ToggleDarkMode.propTypes = { className: PropTypes.string };
