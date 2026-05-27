// ✅ src/components/layout/ThemeToggleButton.jsx — v2.0
// Plataforma Escola da Saúde
//
// Botão oficial de alternância de tema.
//
// Revisão premium:
// - pertence ao domínio layout, não ui;
// - usa o motor oficial useEscolaTheme;
// - alternância rápida claro/escuro;
// - menu acessível com claro, escuro e sistema;
// - fecha com ESC e clique fora;
// - long press mobile para abrir menu;
// - limpeza segura de timers;
// - foco visível;
// - mobile-first;
// - dark mode;
// - visual premium consistente com header/topbar/sidebar.

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import { Check, ChevronDown, Monitor, Moon, Sun } from "lucide-react";

import useEscolaTheme from "../../hooks/useEscolaTheme";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

const THEME_OPTIONS = [
  {
    value: "light",
    label: "Claro",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Escuro",
    icon: Moon,
  },
  {
    value: "system",
    label: "Sistema",
    icon: Monitor,
  },
];

function getThemeLabel(theme, effectiveTheme) {
  if (theme === "system") {
    return `Sistema (${effectiveTheme === "dark" ? "escuro" : "claro"})`;
  }

  return theme === "dark" ? "Escuro" : "Claro";
}

function getNextTheme(effectiveTheme) {
  return effectiveTheme === "dark" ? "light" : "dark";
}

export default function ThemeToggleButton({
  className = "",
  menuAlign = "right",
  showText = true,
}) {
  const { theme, setTheme, effectiveTheme } = useEscolaTheme();

  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const firstMenuItemRef = useRef(null);
  const longPressTimerRef = useRef(null);

  const [open, setOpen] = useState(false);

  const isDarkEffective = effectiveTheme === "dark";
  const CurrentIcon = isDarkEffective ? Sun : Moon;

  const label = useMemo(
    () => getThemeLabel(theme, effectiveTheme),
    [effectiveTheme, theme]
  );

  const quickToggleLabel = isDarkEffective
    ? "Ativar modo claro"
    : "Ativar modo escuro";

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const closeMenu = useCallback(() => {
    setOpen(false);
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const toggleMenu = useCallback(() => {
    setOpen((current) => !current);
  }, []);

  const quickToggle = useCallback(() => {
    setTheme(getNextTheme(effectiveTheme));
  }, [effectiveTheme, setTheme]);

  const selectTheme = useCallback(
    (nextTheme) => {
      setTheme(nextTheme);
      closeMenu();

      window.requestAnimationFrame(() => {
        buttonRef.current?.focus?.();
      });
    },
    [closeMenu, setTheme]
  );

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeMenu();
        buttonRef.current?.focus?.();
      }
    }

    function handlePointerDown(event) {
      const root = rootRef.current;

      if (!root) return;

      if (!root.contains(event.target)) {
        closeMenu();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("pointerdown", handlePointerDown, true);

    const focusFrame = window.requestAnimationFrame(() => {
      firstMenuItemRef.current?.focus?.();
    });

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.cancelAnimationFrame(focusFrame);
    };
  }, [closeMenu, open]);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);

  const handlePointerDown = useCallback(() => {
    clearLongPressTimer();

    longPressTimerRef.current = window.setTimeout(() => {
      setOpen(true);
      longPressTimerRef.current = null;
    }, 420);
  }, [clearLongPressTimer]);

  const handlePointerEnd = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const menuPosition =
    menuAlign === "left"
      ? "left-0"
      : menuAlign === "center"
        ? "left-1/2 -translate-x-1/2"
        : "right-0";

  return (
    <div
      ref={rootRef}
      className={classNames("relative inline-flex", className)}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={quickToggle}
        onContextMenu={(event) => {
          event.preventDefault();
          toggleMenu();
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        aria-label={quickToggleLabel}
        aria-haspopup="menu"
        aria-expanded={open || undefined}
        title={`${label}. Clique para alternar. Clique direito ou toque longo para escolher.`}
        className={classNames(
          "group inline-flex min-h-11 items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black shadow-sm transition",
          "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
          "active:scale-[0.98] motion-reduce:active:scale-100",
          "dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-white/10 dark:focus-visible:ring-offset-slate-950"
        )}
      >
        <span
          className={classNames(
            "grid h-8 w-8 shrink-0 place-items-center rounded-xl border transition",
            "border-slate-200 bg-slate-50 text-slate-700",
            "dark:border-white/10 dark:bg-white/5 dark:text-slate-100",
            isDarkEffective
              ? "shadow-[0_0_0_6px_rgba(16,185,129,0.10)]"
              : "shadow-[0_0_0_6px_rgba(99,102,241,0.10)]"
          )}
          aria-hidden="true"
        >
          <CurrentIcon className="h-4.5 w-4.5" />
        </span>

        {showText && (
          <span className="hidden max-w-24 truncate sm:inline">
            {isDarkEffective ? "Claro" : "Escuro"}
          </span>
        )}

        {theme === "system" && (
          <Monitor className="h-4 w-4 opacity-70" aria-hidden="true" />
        )}

        <ChevronDown
          className={classNames(
            "h-4 w-4 opacity-65 transition-transform",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Selecionar tema da plataforma"
          className={classNames(
            "absolute top-[calc(100%+8px)] z-50 w-48 overflow-hidden rounded-2xl border shadow-xl backdrop-blur",
            "border-slate-200 bg-white/95 text-slate-900",
            "dark:border-white/10 dark:bg-slate-950/95 dark:text-slate-100",
            menuPosition
          )}
        >
          {THEME_OPTIONS.map((option, index) => (
            <ThemeMenuItem
              key={option.value}
              ref={index === 0 ? firstMenuItemRef : undefined}
              active={theme === option.value}
              label={option.label}
              icon={option.icon}
              sub={
                option.value === "system"
                  ? `Agora: ${effectiveTheme === "dark" ? "escuro" : "claro"}`
                  : undefined
              }
              onClick={() => selectTheme(option.value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const ThemeMenuItem = forwardRef(function ThemeMenuItem(
  { active, label, icon: Icon, sub, onClick },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={classNames(
        "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-black transition",
        "hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500",
        "dark:hover:bg-white/10",
        active && "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden="true" />

      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {sub && (
          <span className="block truncate text-[11px] font-semibold opacity-70">
            {sub}
          </span>
        )}
      </span>

      {active && (
        <Check
          className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300"
          aria-hidden="true"
        />
      )}
    </button>
  );
});

ThemeToggleButton.propTypes = {
  className: PropTypes.string,
  menuAlign: PropTypes.oneOf(["left", "right", "center"]),
  showText: PropTypes.bool,
};

ThemeMenuItem.propTypes = {
  active: PropTypes.bool.isRequired,
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  sub: PropTypes.string,
  onClick: PropTypes.func.isRequired,
};