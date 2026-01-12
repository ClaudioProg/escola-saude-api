// ✅ src/components/ThemeTogglePills.jsx
import { useMemo } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import useEscolaTheme from "../hooks/useEscolaTheme";

function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

export default function ThemeTogglePills({ variant = "glass", className = "" }) {
  const { theme, setTheme, effectiveTheme } = useEscolaTheme();

  const isGlass = variant === "glass";

  const shellCls = isGlass
    ? "bg-white/15 ring-1 ring-white/20 text-white backdrop-blur"
    : "bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-zinc-100";

  const opts = useMemo(
    () => [
      { key: "light", label: "Claro", Icon: Sun },
      { key: "dark", label: "Escuro", Icon: Moon },
      { key: "system", label: "Sistema", Icon: Monitor },
    ],
    []
  );

  const activeIndex = Math.max(
    0,
    opts.findIndex((o) => o.key === theme)
  );

  // “thumb” deslizante (visual premium)
  const thumbCls = isGlass
    ? "bg-white/25 shadow-sm"
    : "bg-emerald-600 shadow";

  return (
    <div
      className={cx(
        "relative inline-flex items-stretch rounded-2xl p-1",
        shellCls,
        "select-none",
        className
      )}
      role="group"
      aria-label="Tema"
    >
      {/* Thumb (indicador) */}
      <span
        aria-hidden="true"
        className={cx(
          "pointer-events-none absolute top-1 bottom-1 left-1",
          "w-[calc((100%-0.5rem)/3)] rounded-xl transition-transform duration-200 ease-out",
          thumbCls
        )}
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />

      {opts.map(({ key, label, Icon }) => {
        const active = theme === key;

        // Texto/ícones: no glass sempre branco; no solid muda conforme active
        const itemCls = isGlass
          ? cx(
              "text-white/90 hover:text-white",
              active ? "text-white" : "hover:bg-white/10"
            )
          : cx(
              active ? "text-white" : "text-slate-700 dark:text-zinc-200",
              !active ? "hover:bg-slate-100 dark:hover:bg-white/10" : ""
            );

        return (
          <button
            key={key}
            type="button"
            onClick={() => setTheme(key)}
            aria-pressed={active}
            aria-label={`Ativar tema ${label}`}
            title={
              key === "system"
                ? `Sistema (agora: ${effectiveTheme === "dark" ? "escuro" : "claro"})`
                : label
            }
            className={cx(
              "relative z-10 flex-1",
              "inline-flex items-center justify-center gap-2",
              "rounded-xl px-3 py-2",
              "text-xs font-extrabold transition",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70",
              "min-h-[40px]", // tap target
              itemCls
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sr-only sm:hidden">{label}</span>
          </button>
        );
      })}

      {/* Hint discreto só quando "system" ativo */}
      {theme === "system" && (
        <span
          className={cx(
            "absolute -bottom-5 left-1/2 -translate-x-1/2",
            "text-[11px] font-semibold",
            isGlass ? "text-white/80" : "text-slate-500 dark:text-zinc-400"
          )}
          aria-live="polite"
        >
          Usando {effectiveTheme === "dark" ? "escuro" : "claro"} do sistema
        </span>
      )}
    </div>
  );
}
