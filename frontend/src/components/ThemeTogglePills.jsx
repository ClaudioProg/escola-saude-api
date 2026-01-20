// ✅ src/components/ThemeTogglePills.jsx — PREMIUM (2026)
// - Usa useEscolaTheme (motor único) → atualiza sem F5
// - A11y: role="radiogroup" + itens como "radio" (aria-checked)
// - Thumb animado + feedback visual melhor (focus/hover/active)
// - Mobile-first (tap target) + dark mode impecável

import { useMemo } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import useEscolaTheme from "../hooks/useEscolaTheme";

function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

const THEMES = ["light", "dark", "system"];

export default function ThemeTogglePills({ variant = "glass", className = "" }) {
  const { theme, setTheme, effectiveTheme } = useEscolaTheme();
  const isGlass = variant === "glass";

  const opts = useMemo(
    () => [
      { key: "light", label: "Claro", Icon: Sun, hint: "Tema claro" },
      { key: "dark", label: "Escuro", Icon: Moon, hint: "Tema escuro" },
      { key: "system", label: "Sistema", Icon: Monitor, hint: "Segue o sistema" },
    ],
    []
  );

  // garante consistência mesmo se vier algo fora do esperado
  const safeTheme = THEMES.includes(theme) ? theme : "system";

  const activeIndex = Math.max(
    0,
    opts.findIndex((o) => o.key === safeTheme)
  );

  const shellCls = isGlass
    ? cx(
        "bg-white/15 ring-1 ring-white/20 text-white backdrop-blur",
        "shadow-[0_12px_40px_-26px_rgba(0,0,0,0.55)]"
      )
    : cx(
        "bg-white dark:bg-zinc-950",
        "border border-slate-200 dark:border-white/10",
        "text-slate-900 dark:text-zinc-100",
        "shadow-sm"
      );

  // “thumb” deslizante (visual premium)
  const thumbCls = isGlass
    ? cx(
        "bg-white/25 shadow-sm",
        "ring-1 ring-white/20"
      )
    : cx(
        "bg-emerald-600 shadow",
        "ring-1 ring-emerald-500/30"
      );

  const onKeyDown = (e) => {
    const idx = opts.findIndex((o) => o.key === safeTheme);
    if (idx < 0) return;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = opts[(idx + 1) % opts.length].key;
      setTheme(next);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = opts[(idx - 1 + opts.length) % opts.length].key;
      setTheme(prev);
    } else if (e.key === "Home") {
      e.preventDefault();
      setTheme(opts[0].key);
    } else if (e.key === "End") {
      e.preventDefault();
      setTheme(opts[opts.length - 1].key);
    }
  };

  return (
    <div
      className={cx(
        "relative inline-flex items-stretch rounded-2xl p-1",
        "select-none",
        shellCls,
        className
      )}
      role="radiogroup"
      aria-label="Tema"
      onKeyDown={onKeyDown}
    >
      {/* Thumb (indicador) */}
      <span
        aria-hidden="true"
        className={cx(
          "pointer-events-none absolute top-1 bottom-1 left-1",
          "w-[calc((100%-0.5rem)/3)] rounded-xl",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          thumbCls
        )}
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />

      {opts.map(({ key, label, Icon, hint }) => {
        const active = safeTheme === key;

        const itemBase = cx(
          "relative z-10 flex-1",
          "inline-flex items-center justify-center gap-2",
          "rounded-xl px-3 py-2",
          "text-xs font-extrabold transition",
          "min-h-[40px]", // tap target
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70",
          "active:scale-[0.99] motion-reduce:active:scale-100"
        );

        const itemCls = isGlass
          ? cx(
              "text-white/90",
              active ? "text-white" : "hover:bg-white/10 hover:text-white"
            )
          : cx(
              active ? "text-white" : "text-slate-700 dark:text-zinc-200",
              !active ? "hover:bg-slate-100 dark:hover:bg-white/10" : ""
            );

        const title =
          key === "system"
            ? `Sistema (agora: ${effectiveTheme === "dark" ? "escuro" : "claro"})`
            : hint;

        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active ? "true" : "false"}
            aria-label={`Ativar tema ${label}`}
            title={title}
            onClick={() => setTheme(key)}
            className={cx(itemBase, itemCls)}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sr-only sm:hidden">{label}</span>

            {/* micro-indicador de "system" */}
            {key === "system" && (
              <span className="sr-only">{`(agora: ${effectiveTheme})`}</span>
            )}
          </button>
        );
      })}

      </div>
  );
}
