// ✅ src/components/ThemeTogglePills.jsx
import { Sun, Moon, Monitor } from "lucide-react";
import useEscolaTheme from "../hooks/useEscolaTheme";

export default function ThemeTogglePills({ variant = "glass", className = "" }) {
  const { theme, setTheme, effectiveTheme } = useEscolaTheme();

  const base =
    variant === "glass"
      ? "bg-white/15 ring-1 ring-white/20 text-white backdrop-blur"
      : "bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10";

  return (
    <div
      className={`inline-flex rounded-2xl p-1 ${base} ${className}`}
      role="group"
      aria-label="Tema"
    >
      <Pill
        active={theme === "light"}
        onClick={() => setTheme("light")}
        icon={<Sun className="h-4 w-4" />}
        label="Claro"
        variant={variant}
      />

      <Pill
        active={theme === "dark"}
        onClick={() => setTheme("dark")}
        icon={<Moon className="h-4 w-4" />}
        label="Escuro"
        variant={variant}
      />

      <Pill
        active={theme === "system"}
        onClick={() => setTheme("system")}
        icon={<Monitor className="h-4 w-4" />}
        label="Sistema"
        variant={variant}
        hint={`Usando ${effectiveTheme === "dark" ? "escuro" : "claro"} do sistema`}
      />
    </div>
  );
}

function Pill({ active, onClick, icon, label, variant, hint }) {
  const cls =
    variant === "glass"
      ? active
        ? "bg-white/25 text-white shadow-sm"
        : "text-white/85 hover:bg-white/15"
      : active
      ? "bg-emerald-600 text-white shadow"
      : "text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/10";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={hint || label}
      className={`
        inline-flex items-center gap-2
        rounded-xl px-3 py-2
        text-xs font-extrabold
        transition
        focus:outline-none
        focus:ring-2 focus:ring-emerald-500/70
        ${cls}
      `}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
