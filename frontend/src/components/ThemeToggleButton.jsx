// ✅ src/components/ThemeToggleButton.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import useEscolaTheme from "../hooks/useEscolaTheme";

function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

export default function ThemeToggleButton({ className = "" }) {
  const { theme, setTheme, effectiveTheme } = useEscolaTheme();
  const isDarkEffective = effectiveTheme === "dark";

  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);

  // clique rápido alterna light <-> dark
  function onClick() {
    const next = isDarkEffective ? "light" : "dark";
    setTheme(next);
  }

  // fecha menu ao clicar fora / ESC
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e) => {
      const el = btnRef.current;
      if (!el) return;
      if (!el.contains(e.target)) setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const label = useMemo(() => {
    if (theme === "system") return `Sistema (${effectiveTheme})`;
    return theme === "dark" ? "Escuro" : "Claro";
  }, [theme, effectiveTheme]);

  const icon = isDarkEffective ? <Sun size={18} /> : <Moon size={18} />;

  const baseBtn = cx(
    "relative inline-flex items-center gap-2 rounded-2xl px-3 py-2",
    "border text-xs font-extrabold transition",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60",
    "active:scale-[0.98] motion-reduce:active:scale-100",
    "min-h-[40px]" // tap target
  );

  const skin = cx(
    "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
    "dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5"
  );

  return (
    <div className={cx("relative inline-flex", className)} ref={btnRef}>
      <button
        type="button"
        onClick={onClick}
        onContextMenu={(e) => {
          // clique direito abre o menu (desktop)
          e.preventDefault();
          setOpen((v) => !v);
        }}
        onPointerDown={(e) => {
          // long-press abre o menu (mobile)
          const t = setTimeout(() => setOpen(true), 420);
          const clear = () => clearTimeout(t);
          window.addEventListener("pointerup", clear, { once: true });
          window.addEventListener("pointercancel", clear, { once: true });
        }}
        aria-label={isDarkEffective ? "Ativar modo claro" : "Ativar modo escuro"}
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
        title={label}
        className={cx(baseBtn, skin)}
      >
        {/* pílula de ícone com glow sutil */}
        <span
          aria-hidden="true"
          className={cx(
            "inline-flex h-8 w-8 items-center justify-center rounded-xl border",
            "border-slate-200 bg-slate-50 text-slate-700",
            "dark:border-white/10 dark:bg-white/5 dark:text-zinc-200",
            isDarkEffective
              ? "shadow-[0_0_0_6px_rgba(16,185,129,0.10)]"
              : "shadow-[0_0_0_6px_rgba(99,102,241,0.10)]"
          )}
        >
          {icon}
        </span>

        <span className="hidden sm:inline truncate">
          {isDarkEffective ? "Claro" : "Escuro"}
        </span>

        {theme === "system" && (
          <Monitor className="ml-1 h-4 w-4 opacity-70" aria-hidden="true" />
        )}

        {/* hint do menu (3 pontinhos) */}
        <span className="ml-1 opacity-60 text-[10px]" aria-hidden="true">
          ⋯
        </span>
      </button>

      {/* Menu (opcional) */}
      {open && (
        <div
          role="menu"
          aria-label="Selecionar tema"
          className={cx(
            "absolute right-0 top-[calc(100%+8px)] z-50 w-44 overflow-hidden rounded-2xl border shadow-xl",
            "border-slate-200 bg-white/95 backdrop-blur",
            "dark:border-white/10 dark:bg-zinc-900/95"
          )}
        >
          <MenuItem
            active={theme === "light"}
            label="Claro"
            icon={Sun}
            onClick={() => {
              setTheme("light");
              setOpen(false);
            }}
          />
          <MenuItem
            active={theme === "dark"}
            label="Escuro"
            icon={Moon}
            onClick={() => {
              setTheme("dark");
              setOpen(false);
            }}
          />
          <MenuItem
            active={theme === "system"}
            label="Sistema"
            icon={Monitor}
            sub={`(agora: ${effectiveTheme})`}
            onClick={() => {
              setTheme("system");
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({ active, label, icon: Icon, sub, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cx(
        "w-full px-3 py-2.5 text-left text-sm font-extrabold transition",
        "flex items-center gap-2",
        "hover:bg-slate-100 dark:hover:bg-white/5",
        active ? "bg-emerald-500/10" : ""
      )}
      aria-pressed={active ? "true" : "false"}
    >
      <Icon className="h-4 w-4 opacity-90" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="truncate">{label}</div>
        {sub && <div className="text-[11px] font-semibold opacity-70 truncate">{sub}</div>}
      </div>
      {active && <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
    </button>
  );
}
