import { Sun, Moon } from "lucide-react";
import { toggleTheme } from "../theme/theme";
import { useState, useEffect } from "react";

export default function ThemeToggleButton({ className = "" }) {
  // estado só para refletir o ícone/label (o DOM é a fonte da verdade)
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "theme") {
        setIsDark(e.newValue === "dark");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function onClick() {
    const next = toggleTheme();
    setIsDark(next === "dark");
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 border hover:opacity-90 ${className}`}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
      <span className="text-sm">{isDark ? "Claro" : "Escuro"}</span>
    </button>
  );
}
