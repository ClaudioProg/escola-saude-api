// 📁 src/components/FiltroToggleGroup.jsx
import React, { useMemo, useCallback } from "react";
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
};

const SIZES = {
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-1.5 text-sm",
  lg: "px-5 py-2 text-base",
};

export default function FiltroToggleGroup({
  opcoes = [],
  valorSelecionado,
  aoSelecionar,
  ariaLabel = "Grupo de filtros",
  variant = "amareloOuro", // contraste alto por padrão
  size = "md",
  className = "",
}) {
  const v = VARIANTS[variant] || VARIANTS.padrao;
  const sizeCls = SIZES[size] || SIZES.md;

  // Lista somente com opções válidas
  const lista = useMemo(
    () =>
      (Array.isArray(opcoes) ? opcoes : [])
        .filter((o) => o && typeof o.valor === "string" && typeof o.rotulo === "string")
        .map((o) => ({ ...o, disabled: Boolean(o.disabled) })),
    [opcoes]
  );

  // Índices úteis p/ navegação por teclado (ignorando desabilitadas)
  const enabledIndexes = useMemo(
    () => lista.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i !== -1),
    [lista]
  );

  const currentIndex = useMemo(() => {
    const i = lista.findIndex((o) => o.valor === valorSelecionado);
    return i >= 0 ? i : enabledIndexes[0] ?? -1;
  }, [lista, valorSelecionado, enabledIndexes]);

  const selectByIndex = useCallback(
    (idx) => {
      if (idx < 0 || idx >= lista.length) return;
      const opt = lista[idx];
      if (!opt || opt.disabled) return;
      if (typeof aoSelecionar === "function") aoSelecionar(opt.valor);
    },
    [lista, aoSelecionar]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (!enabledIndexes.length) return;
      let next;
      const pos = enabledIndexes.indexOf(currentIndex);

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          next = enabledIndexes[(pos + 1) % enabledIndexes.length];
          selectByIndex(next);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          next = enabledIndexes[(pos - 1 + enabledIndexes.length) % enabledIndexes.length];
          selectByIndex(next);
          break;
        case "Home":
          e.preventDefault();
          selectByIndex(enabledIndexes[0]);
          break;
        case "End":
          e.preventDefault();
          selectByIndex(enabledIndexes[enabledIndexes.length - 1]);
          break;
        default:
          break;
      }
    },
    [enabledIndexes, currentIndex, selectByIndex]
  );

  return (
    <div
      className={["flex justify-center flex-wrap gap-2 mb-6", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      {lista.map(({ valor, rotulo, disabled }) => {
        const ativo = valorSelecionado === valor;
        const tabIndex = ativo ? 0 : -1; // roving tabindex
        return (
          <button
            key={valor}
            type="button"
            onClick={() => !disabled && aoSelecionar(valor)}
            aria-pressed={ativo}
            aria-disabled={disabled || undefined}
            disabled={disabled}
            tabIndex={tabIndex}
            className={[
              "rounded-full font-medium border transition-colors duration-200",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              sizeCls,
              v.ring,
              disabled
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
  );
}

FiltroToggleGroup.propTypes = {
  opcoes: PropTypes.arrayOf(
    PropTypes.shape({
      valor: PropTypes.string.isRequired,
      rotulo: PropTypes.string.isRequired,
      disabled: PropTypes.bool,
    })
  ).isRequired,
  valorSelecionado: PropTypes.string.isRequired,
  aoSelecionar: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string,
  variant: PropTypes.oneOf(["padrao", "amareloOuro", "azulPetroleo", "laranjaQueimado"]),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  className: PropTypes.string,
};
