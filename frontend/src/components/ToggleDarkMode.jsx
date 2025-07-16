import { useEffect, useState } from "react";

export default function ToggleDarkMode() {
  const [darkMode, setDarkMode] = useState(() => {
    // Verifica localStorage ou class da raiz
    return (
      localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  return (
    <button
      type="button"
      onClick={() => setDarkMode((v) => !v)}
      className="text-sm px-4 py-1.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:scale-105 transition-transform duration-200"
      aria-pressed={darkMode}
      aria-label={darkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
      role="switch"
      tabIndex={0}
    >
      {darkMode ? "☀️ Modo Claro" : "🌙 Modo Escuro"}
    </button>
  );
}
