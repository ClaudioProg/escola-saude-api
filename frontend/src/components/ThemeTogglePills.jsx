// ✅ src/components/ThemeTogglePills.jsx
import { Sun, Moon, Monitor } from "lucide-react";

export default function ThemeTogglePills({ theme, setTheme, variant = "glass" }) {
  const base =
    variant === "glass"
      ? "bg-white/15 ring-1 ring-white/20 text-white"
      : "bg-white dark:bg-zinc-950 border-slate-200 dark:border-white/10";

  return (
    <div
      className={`inline-flex rounded-2xl p-1 ${base}`}
      role="group"
      aria-label="Tema"
    >
      <Pill active={theme === "light"} onClick={() => setTheme("light")} icon={<Sun className="h-4 w-4" />} label="Claro" variant={variant} />
      <Pill active={theme === "dark"} onClick={() => setTheme("dark")} icon={<Moon className="h-4 w-4" />} label="Escuro" variant={variant} />
      <Pill active={theme === "system"} onClick={() => setTheme("system")} icon={<Monitor className="h-4 w-4" />} label="Sistema" variant={variant} />
    </div>
  );
}

function Pill({ active, onClick, icon, label, variant }) {
  const cls =
    variant === "glass"
      ? active
        ? "bg-white/25 text-white"
        : "text-white/85 hover:bg-white/15"
      : active
      ? "bg-emerald-600 text-white"
      : "text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/10";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold transition focus:outline-none focus:ring-2 focus:ring-emerald-500/70 ${cls}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
