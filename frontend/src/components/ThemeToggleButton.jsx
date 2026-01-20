// ✅ src/components/ThemeToggleButton.jsx — PREMIUM (2026)
// - Usa o motor único via useEscolaTheme (que agora faz broadcast/DOM apply)
// - Clique rápido alterna light <-> dark (respeita effectiveTheme)
// - Menu acessível: ESC fecha, clique fora fecha, foco/teclado ok
// - Long-press mobile abre menu SEM “vazar” timers
// - Enter/Espaço no botão: mantém comportamento padrão do button

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import useEscolaTheme from "../hooks/useEscolaTheme";

function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

export default function ThemeToggleButton({ className = "" }) {
  const { theme, setTheme, effectiveTheme } = useEscolaTheme();
  const isDarkEffective = effectiveTheme === "dark";

  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const longPressTimerRef = useRef(null);

  const label = useMemo(() => {
    if (theme === "system") return `Sistema (${effectiveTheme})`;
    return theme === "dark" ? "Escuro" : "Claro";
  }, [theme, effectiveTheme]);

  const icon = isDarkEffective ? <Sun size={18} /> : <Moon size={18} />;

  // clique rápido alterna light <-> dark (sempre baseado no efetivo atual)
  const onQuickToggle = useCallback(() => {
    const next = isDarkEffective ? "light" : "dark";
    setTheme(next);
  }, [isDarkEffective, setTheme]);

  // fechar menu
  const closeMenu = useCallback(() => setOpen(false), []);

  // fecha menu ao clicar fora / ESC (captura p/ ser bem robusto)
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeMenu();
      }
    };

    const onPointerDown = (e) => {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(e.target)) closeMenu();
    };

    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, closeMenu]);

  // limpeza do long-press
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };
  }, []);

  const baseBtn = cx(
    "relative inline-flex items-center gap-2 rounded-2xl px-3 py-2",
    "border text-xs font-extrabold transition",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60",
    "active:scale-[0.98] motion-reduce:active:scale-100",
    "min-h-[40px]"
  );

  const skin = cx(
    "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
    "dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5"
  );

  return (
    <div className={cx("relative inline-flex", className)} ref={rootRef}>
      <button
        type="button"
        onClick={onQuickToggle}
        onContextMenu={(e) => {
          // clique direito abre/fecha menu (desktop)
          e.preventDefault();
          setOpen((v) => !v);
        }}
        onPointerDown={() => {
          // long-press abre menu (mobile)
          if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = setTimeout(() => setOpen(true), 420);
        }}
        onPointerUp={() => {
          if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }}
        onPointerCancel={() => {
          if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
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

        {/* hint do menu */}
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
              closeMenu();
            }}
          />
          <MenuItem
            active={theme === "dark"}
            label="Escuro"
            icon={Moon}
            onClick={() => {
              setTheme("dark");
              closeMenu();
            }}
          />
          <MenuItem
            active={theme === "system"}
            label="Sistema"
            icon={Monitor}
            sub={`(agora: ${effectiveTheme})`}
            onClick={() => {
              setTheme("system");
              closeMenu();
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
