// ✅ src/components/layout/ThemeTogglePills.jsx — v2.0
// Plataforma Escola da Saúde
//
// Seletor segmentado oficial de tema.
//
// Revisão premium:
// - pertence ao domínio layout, não ui;
// - usa o motor oficial useEscolaTheme;
// - exibe diretamente Claro / Escuro / Sistema;
// - acessível com radiogroup/radio;
// - navegação por teclado com setas, Home e End;
// - thumb visual corrigido;
// - mobile-first;
// - dark mode;
// - reduced motion;
// - visual premium consistente com áreas de configuração e aparência.

import { useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { Monitor, Moon, Sun } from "lucide-react";

import useEscolaTheme from "../../hooks/useEscolaTheme";

const THEME_OPTIONS = [
  {
    key: "light",
    label: "Claro",
    Icon: Sun,
    hint: "Tema claro",
  },
  {
    key: "dark",
    label: "Escuro",
    Icon: Moon,
    hint: "Tema escuro",
  },
  {
    key: "system",
    label: "Sistema",
    Icon: Monitor,
    hint: "Segue o tema do sistema",
  },
];

const VALID_THEMES = new Set(["light", "dark", "system"]);

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizarTema(theme) {
  return VALID_THEMES.has(theme) ? theme : "system";
}

function getEffectiveLabel(effectiveTheme) {
  return effectiveTheme === "dark" ? "escuro" : "claro";
}

export default function ThemeTogglePills({
  variant = "glass",
  className = "",
  ariaLabel = "Selecionar tema da plataforma",
  showLabels = true,
}) {
  const { theme, setTheme, effectiveTheme } = useEscolaTheme();

  const safeTheme = normalizarTema(theme);
  const isGlass = variant === "glass";

  const activeIndex = useMemo(() => {
    const index = THEME_OPTIONS.findIndex((option) => option.key === safeTheme);
    return index >= 0 ? index : 2;
  }, [safeTheme]);

  const selectTheme = useCallback(
    (nextTheme) => {
      if (!VALID_THEMES.has(nextTheme)) return;
      setTheme(nextTheme);
    },
    [setTheme]
  );

  const handleKeyDown = useCallback(
    (event) => {
      const currentIndex = THEME_OPTIONS.findIndex(
        (option) => option.key === safeTheme
      );

      const safeIndex = currentIndex >= 0 ? currentIndex : 2;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        const next = THEME_OPTIONS[(safeIndex + 1) % THEME_OPTIONS.length];
        selectTheme(next.key);
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        const previous =
          THEME_OPTIONS[
            (safeIndex - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length
          ];
        selectTheme(previous.key);
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        selectTheme(THEME_OPTIONS[0].key);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        selectTheme(THEME_OPTIONS[THEME_OPTIONS.length - 1].key);
      }
    },
    [safeTheme, selectTheme]
  );

  const shellClass = isGlass
    ? "bg-white/15 text-white ring-1 ring-white/20 shadow-[0_12px_40px_-26px_rgba(0,0,0,0.55)] backdrop-blur"
    : "border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-white/10 dark:bg-slate-950 dark:text-slate-100";

  const thumbClass = isGlass
    ? "bg-white/25 shadow-sm ring-1 ring-white/20"
    : "bg-emerald-700 shadow-sm ring-1 ring-emerald-500/30";

  return (
    <div
      className={classNames(
        "relative inline-grid grid-cols-3 items-stretch rounded-2xl p-1",
        "select-none",
        shellClass,
        className
      )}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      data-theme-current={safeTheme}
      data-theme-effective={effectiveTheme}
    >
      <span
        aria-hidden="true"
        className={classNames(
          "pointer-events-none absolute bottom-1 left-1 top-1 rounded-xl",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          thumbClass
        )}
        style={{
          width: "calc((100% - 0.5rem) / 3)",
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />

      {THEME_OPTIONS.map(({ key, label, Icon, hint }) => {
        const active = safeTheme === key;

        const itemClass = isGlass
          ? classNames(
              "text-white/90",
              active ? "text-white" : "hover:bg-white/10 hover:text-white"
            )
          : classNames(
              active ? "text-white" : "text-slate-700 dark:text-slate-200",
              !active && "hover:bg-slate-100 dark:hover:bg-white/10"
            );

        const title =
          key === "system"
            ? `Sistema: agora usando tema ${getEffectiveLabel(effectiveTheme)}`
            : hint;

        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`Ativar tema ${label}`}
            title={title}
            onClick={() => selectTheme(key)}
            className={classNames(
              "relative z-10 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2",
              "text-xs font-black transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
              "active:scale-[0.99] motion-reduce:active:scale-100",
              itemClass
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />

            {showLabels ? (
              <span className="hidden sm:inline">{label}</span>
            ) : (
              <span className="sr-only">{label}</span>
            )}

            {showLabels && <span className="sr-only sm:hidden">{label}</span>}

            {key === "system" && (
              <span className="sr-only">
                {`Tema efetivo atual: ${getEffectiveLabel(effectiveTheme)}.`}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

ThemeTogglePills.propTypes = {
  variant: PropTypes.oneOf(["glass", "solid"]),
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
  showLabels: PropTypes.bool,
};