// ✅ src/components/ThemeToggleButton.jsx
import { Sun, Moon, Monitor } from "lucide-react";
import useEscolaTheme from "../hooks/useEscolaTheme";

export default function ThemeToggleButton({ className = "" }) {
  const { theme, setTheme, effectiveTheme } = useEscolaTheme();

  // clique alterna entre light <-> dark (não passa por "system")
  function onClick() {
    const next = effectiveTheme === "dark" ? "light" : "dark";
    setTheme(next);
  }

  const isDarkEffective = effectiveTheme === "dark";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isDarkEffective ? "Ativar modo claro" : "Ativar modo escuro"}
      className={[
        "inline-flex items-center gap-2 rounded-2xl px-3 py-2 border text-xs font-extrabold transition",
        "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
        "dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5",
        className,
      ].join(" ")}
      title={theme === "system" ? `Sistema (${effectiveTheme})` : `Tema: ${theme}`}
    >
      {isDarkEffective ? <Sun size={18} /> : <Moon size={18} />}
      <span className="hidden sm:inline">{isDarkEffective ? "Claro" : "Escuro"}</span>
      {theme === "system" && <Monitor className="ml-1 h-4 w-4 opacity-70" />}
    </button>
  );
}
