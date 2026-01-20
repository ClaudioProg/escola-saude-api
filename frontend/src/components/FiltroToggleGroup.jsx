// 📁 src/components/FiltroToggleGroup.jsx
import React, { useMemo, useCallback, useRef, useEffect } from "react";
import PropTypes from "prop-types";

const VARIANTS = {
  padrao: {
    active: "bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-600",
    ring: "focus-visible:ring-emerald-500",
  },
  amareloOuro: {
    active: "bg-amber-500 text-black border-amber-500 hover:bg-amber-600",
    ring: "focus-visible:ring-amber-400",
  },
  azulPetroleo: {
    active: "bg-cyan-800 text-white border-cyan-800 hover:bg-cyan-900",
    ring: "focus-visible:ring-cyan-600",
  },
  laranjaQueimado: {
    active: "bg-orange-600 text-white border-orange-600 hover:bg-orange-700",
    ring: "focus-visible:ring-orange-400",
  },
  // 🆕 extras alinhados ao teu guia
  verde: {
    active: "bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-600",
    ring: "focus-visible:ring-emerald-500",
  },
  vermelhoCoral: {
    active: "bg-rose-600 text-white border-rose-600 hover:bg-rose-700",
    ring: "focus-visible:ring-rose-500",
  },
};

const SIZES = {
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-1.5 text-sm",
  lg: "px-5 py-2 text-base",
};

export default function FiltroToggleGroup({
  opcao = [],
  valorSelecionado,
  aoSelecionar,
  ariaLabel = "Grupo de filtros",
  variant = "amareloOuro",
  size = "md",
  className = "",
  // 🆕
  disabledGroup = false,
  fullWidth = false,
  distribuicao = "center", // "left" | "center" | "between"
}) {
  const v = VARIANTS[variant] || VARIANTS.padrao;
  const sizeCls = SIZES[size] || SIZES.md;

  // Lista somente com opções válidas
  const lista = useMemo(
    () =>
      (Array.isArray(opcao) ? opcao : [])
        .filter((o) => o && typeof o.valor === "string" && (typeof o.rotulo === "string" || typeof o.rotulo === "number"))
        .map((o) => ({ ...o, disabled: Boolean(o.disabled) })),
    [opcao]
  );

  // índices "focáveis"
  const enabledIndexes = useMemo(
    () => lista.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i !== -1),
    [lista]
  );

  const currentIndex = useMemo(() => {
    const i = lista.findIndex((o) => o.valor === valorSelecionado);
    return i >= 0 ? i : enabledIndexes[0] ?? -1;
  }, [lista, valorSelecionado, enabledIndexes]);

  // refs para focar o item quando a seleção muda por teclado
  const btnRefs = useRef([]);
  useEffect(() => {
    // garante array com mesmo length
    btnRefs.current = btnRefs.current.slice(0, lista.length);
  }, [lista.length]);

  const focusIndex = (idx) => {
    const el = btnRefs.current[idx];
    if (el && typeof el.focus === "function") el.focus();
  };

  const selectByIndex = useCallback(
    (idx, focus = true) => {
      if (idx < 0 || idx >= lista.length) return;
      const opt = lista[idx];
      if (!opt || opt.disabled) return;
      if (typeof aoSelecionar === "function") {
        aoSelecionar(opt.valor);
        if (focus) focusIndex(idx);
      }
    },
    [lista, aoSelecionar]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (!enabledIndexes.length || disabledGroup) return;
      const pos = enabledIndexes.indexOf(currentIndex);

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown": {
          e.preventDefault();
          const next = enabledIndexes[(pos + 1) % enabledIndexes.length];
          selectByIndex(next);
          break;
        }
        case "ArrowLeft":
        case "ArrowUp": {
          e.preventDefault();
          const next = enabledIndexes[(pos - 1 + enabledIndexes.length) % enabledIndexes.length];
          selectByIndex(next);
          break;
        }
        case "Home":
          e.preventDefault();
          selectByIndex(enabledIndexes[0]);
          break;
        case "End":
          e.preventDefault();
          selectByIndex(enabledIndexes[enabledIndexes.length - 1]);
          break;
        case " ":
        case "Enter":
          // seleciona o focado
          e.preventDefault();
          selectByIndex(currentIndex, false);
          break;
        default:
          break;
      }
    },
    [enabledIndexes, currentIndex, selectByIndex, disabledGroup]
  );

  const justify =
    distribuicao === "left"
      ? "justify-start"
      : distribuicao === "between"
      ? "justify-between"
      : "justify-center";

  return (
    <div
      className={[
        "mb-6",
        className,
      ].filter(Boolean).join(" ")}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      aria-disabled={disabledGroup || undefined}
    >
      <div className={["flex flex-wrap gap-2", justify, fullWidth ? "w-full" : ""].join(" ")}>
        {lista.map(({ valor, rotulo, disabled }, i) => {
          const ativo = valorSelecionado === valor;
          const tabIndex = ativo ? 0 : -1; // roving tabindex

          return (
            <button
              key={valor}
              ref={(el) => (btnRefs.current[i] = el)}
              type="button"
              role="radio"
              aria-checked={ativo}
              aria-pressed={ativo} // compat
              aria-disabled={disabledGroup || disabled || undefined}
              disabled={disabledGroup || disabled}
              tabIndex={tabIndex}
              onClick={() => !disabled && !disabledGroup && aoSelecionar(valor)}
              className={[
                "rounded-full font-medium border transition-colors duration-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                sizeCls,
                v.ring,
                fullWidth ? "flex-1 min-w-[6rem] text-center" : "",
                disabledGroup || disabled
                  ? "cursor-not-allowed opacity-55 bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-400 border-gray-200 dark:border-zinc-700"
                  : ativo
                  ? v.active
                  : "bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700",
              ].join(" ")}
            >
              {rotulo}
            </button>
          );
        })}
      </div>
    </div>
  );
}

FiltroToggleGroup.propTypes = {
  opcao: PropTypes.arrayOf(
    PropTypes.shape({
      valor: PropTypes.string.isRequired,
      rotulo: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      disabled: PropTypes.bool,
    })
  ).isRequired,
  valorSelecionado: PropTypes.string.isRequired,
  aoSelecionar: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string,
  variant: PropTypes.oneOf([
    "padrao",
    "amareloOuro",
    "azulPetroleo",
    "laranjaQueimado",
    "verde",
    "vermelhoCoral",
  ]),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  className: PropTypes.string,
  /** 🆕 Desabilita o grupo todo */
  disabledGroup: PropTypes.bool,
  /** 🆕 Faz os botões ampliarem para ocupar a largura disponível */
  fullWidth: PropTypes.bool,
  /** 🆕 Alinhamento dos botões no container */
  distribuicao: PropTypes.oneOf(["left", "center", "between"]),
};
