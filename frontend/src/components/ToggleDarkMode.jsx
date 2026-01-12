// 📁 src/components/ToggleDarkMode.jsx
import PropTypes from "prop-types";
import { Sun, Moon, Monitor } from "lucide-react";
import useEscolaTheme from "../hooks/useEscolaTheme";

/**
 * ToggleDarkMode — botão institucional de tema (light / dark / system)
 *
 * - Usa a fonte oficial de verdade (useEscolaTheme)
 * - Suporta modo Sistema
 * - Sincroniza entre abas
 * - Acessível (role="switch")
 * - Visual premium
 */
export default function ToggleDarkMode({ className = "", showSystem = false }) {
  const { theme, setTheme, effectiveTheme } = useEscolaTheme();

  const isDark = effectiveTheme === "dark";

  function toggle() {
    // alterna apenas entre claro/escuro
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      title={
        theme === "system"
          ? `Sistema (${effectiveTheme})`
          : isDark
          ? "Modo escuro ativo"
          : "Modo claro ativo"
      }
      className={[
        "inline-flex items-center gap-2 px-4 py-2 rounded-full",
        "font-extrabold text-xs transition-all duration-300",
        "border shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/50",
        isDark
          ? "bg-zinc-900 text-zinc-100 border-white/10 hover:bg-zinc-800"
          : "bg-white text-slate-800 border-slate-200 hover:bg-slate-100",
        "hover:scale-[1.04]",
        className,
      ].join(" ")}
    >
      {isDark ? (
        <Sun
          size={18}
          className="text-amber-400 transition-transform"
          aria-hidden="true"
        />
      ) : (
        <Moon
          size={18}
          className="text-sky-600 transition-transform"
          aria-hidden="true"
        />
      )}

      <span className="hidden sm:inline">
        {isDark ? "Modo Claro" : "Modo Escuro"}
      </span>

      {showSystem && theme === "system" && (
        <Monitor
          size={16}
          className="opacity-70"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

ToggleDarkMode.propTypes = {
  className: PropTypes.string,
  /** Mostra ícone quando estiver em modo Sistema */
  showSystem: PropTypes.bool,
};
