// ✅ src/components/ui/FiltroToggleGroup.jsx — v2.0
// Plataforma Escola da Saúde
//
// Grupo genérico oficial de filtros/toggles.
//
// Revisão premium:
// - componente genérico real de UI;
// - acessível com radiogroup/radio;
// - navegação por teclado com setas, Home e End;
// - roving tabindex correto;
// - estados disabled, vazio e fullWidth;
// - visual premium consistente;
// - mobile-first;
// - dark mode;
// - contrato limpo preservando as props oficiais atuais.

import { useCallback, useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";

const VARIANTES = {
  padrao: {
    active:
      "border-emerald-700 bg-emerald-700 text-white shadow-sm hover:bg-emerald-800",
    inactive:
      "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
    focus: "focus-visible:ring-emerald-500",
  },
  verde: {
    active:
      "border-emerald-700 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white shadow-sm hover:brightness-110",
    inactive:
      "border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200 dark:hover:bg-emerald-950/60",
    focus: "focus-visible:ring-emerald-500",
  },
  amareloOuro: {
    active:
      "border-amber-500 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 shadow-sm hover:brightness-105",
    inactive:
      "border-amber-200 bg-amber-50/70 text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/60",
    focus: "focus-visible:ring-amber-500",
  },
  azulPetroleo: {
    active:
      "border-cyan-900 bg-gradient-to-br from-cyan-800 via-cyan-900 to-slate-900 text-white shadow-sm hover:brightness-110",
    inactive:
      "border-cyan-200 bg-cyan-50/70 text-cyan-950 hover:bg-cyan-100 dark:border-cyan-900 dark:bg-slate-950/45 dark:text-cyan-200 dark:hover:bg-slate-900",
    focus: "focus-visible:ring-cyan-500",
  },
  laranjaQueimado: {
    active:
      "border-orange-700 bg-gradient-to-br from-orange-600 via-orange-700 to-orange-800 text-white shadow-sm hover:brightness-110",
    inactive:
      "border-orange-200 bg-orange-50/70 text-orange-950 hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200 dark:hover:bg-orange-950/60",
    focus: "focus-visible:ring-orange-500",
  },
  vermelhoCoral: {
    active:
      "border-rose-700 bg-gradient-to-br from-rose-600 via-rose-700 to-rose-800 text-white shadow-sm hover:brightness-110",
    inactive:
      "border-rose-200 bg-rose-50/70 text-rose-950 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/60",
    focus: "focus-visible:ring-rose-500",
  },
};

const TAMANHOS = {
  sm: "min-h-9 px-3 py-1.5 text-xs",
  md: "min-h-10 px-4 py-2 text-sm",
  lg: "min-h-11 px-5 py-2.5 text-base",
};

const DISTRIBUICOES = {
  left: "justify-start",
  center: "justify-center",
  between: "justify-between",
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizarOpcoes(opcoes) {
  return (Array.isArray(opcoes) ? opcoes : [])
    .filter(
      (opcao) =>
        opcao &&
        typeof opcao.valor === "string" &&
        ["string", "number"].includes(typeof opcao.rotulo)
    )
    .map((opcao) => ({
      valor: opcao.valor,
      rotulo: opcao.rotulo,
      disabled: Boolean(opcao.disabled),
      title: opcao.title,
    }));
}

export default function FiltroToggleGroup({
  opcao = [],
  valorSelecionado,
  aoSelecionar,
  ariaLabel = "Grupo de filtros",
  variant = "padrao",
  size = "md",
  className = "",
  disabledGroup = false,
  fullWidth = false,
  distribuicao = "center",
  emptyMessage = "Nenhuma opção disponível.",
}) {
  const buttonRefs = useRef([]);

  const tema = VARIANTES[variant] || VARIANTES.padrao;
  const tamanho = TAMANHOS[size] || TAMANHOS.md;
  const alinhamento = DISTRIBUICOES[distribuicao] || DISTRIBUICOES.center;

  const opcoes = useMemo(() => normalizarOpcoes(opcao), [opcao]);

  const enabledIndexes = useMemo(
    () =>
      opcoes
        .map((item, index) => (item.disabled ? -1 : index))
        .filter((index) => index !== -1),
    [opcoes]
  );

  const selectedIndex = useMemo(
    () => opcoes.findIndex((item) => item.valor === valorSelecionado),
    [opcoes, valorSelecionado]
  );

  const activeRovingIndex = useMemo(() => {
    if (selectedIndex >= 0 && !opcoes[selectedIndex]?.disabled) {
      return selectedIndex;
    }

    return enabledIndexes[0] ?? -1;
  }, [enabledIndexes, opcoes, selectedIndex]);

  const hasOptions = opcoes.length > 0;
  const isDisabled = disabledGroup || enabledIndexes.length === 0;

  useEffect(() => {
    buttonRefs.current = buttonRefs.current.slice(0, opcoes.length);
  }, [opcoes.length]);

  const focusIndex = useCallback((index) => {
    const node = buttonRefs.current[index];

    if (node && typeof node.focus === "function") {
      node.focus();
    }
  }, []);

  const selectByIndex = useCallback(
    (index, shouldFocus = true) => {
      if (isDisabled || index < 0 || index >= opcoes.length) {
        return;
      }

      const option = opcoes[index];

      if (!option || option.disabled) {
        return;
      }

      aoSelecionar?.(option.valor);

      if (shouldFocus) {
        window.requestAnimationFrame(() => focusIndex(index));
      }
    },
    [aoSelecionar, focusIndex, isDisabled, opcoes]
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (isDisabled || !enabledIndexes.length) {
        return;
      }

      const currentPosition = enabledIndexes.includes(activeRovingIndex)
        ? enabledIndexes.indexOf(activeRovingIndex)
        : 0;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        const next = enabledIndexes[(currentPosition + 1) % enabledIndexes.length];
        selectByIndex(next);
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        const next =
          enabledIndexes[
            (currentPosition - 1 + enabledIndexes.length) % enabledIndexes.length
          ];
        selectByIndex(next);
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        selectByIndex(enabledIndexes[0]);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        selectByIndex(enabledIndexes[enabledIndexes.length - 1]);
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectByIndex(activeRovingIndex, false);
      }
    },
    [activeRovingIndex, enabledIndexes, isDisabled, selectByIndex]
  );

  if (!hasOptions) {
    return (
      <div
        className={classNames(
          "rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400",
          className
        )}
        role="status"
        aria-live="polite"
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={classNames("w-full", className)}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={isDisabled || undefined}
      onKeyDown={handleKeyDown}
    >
      <div
        className={classNames(
          "flex flex-wrap gap-2",
          alinhamento,
          fullWidth && "w-full"
        )}
      >
        {opcoes.map((opcaoItem, index) => {
          const ativo = valorSelecionado === opcaoItem.valor;
          const disabled = disabledGroup || opcaoItem.disabled;
          const tabIndex = index === activeRovingIndex && !disabled ? 0 : -1;

          return (
            <button
              key={opcaoItem.valor}
              ref={(node) => {
                buttonRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={ativo}
              aria-disabled={disabled || undefined}
              disabled={disabled}
              tabIndex={tabIndex}
              title={opcaoItem.title || String(opcaoItem.rotulo)}
              onClick={() => {
                if (!disabled) {
                  aoSelecionar?.(opcaoItem.valor);
                }
              }}
              className={classNames(
                "inline-flex items-center justify-center rounded-full border font-black transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "select-none whitespace-nowrap",
                tamanho,
                tema.focus,
                fullWidth && "min-w-[7rem] flex-1 text-center",
                disabled
                  ? "border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500"
                  : ativo
                    ? tema.active
                    : tema.inactive
              )}
            >
              {opcaoItem.rotulo}
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
      title: PropTypes.string,
    })
  ).isRequired,
  valorSelecionado: PropTypes.string,
  aoSelecionar: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string,
  variant: PropTypes.oneOf([
    "padrao",
    "verde",
    "amareloOuro",
    "azulPetroleo",
    "laranjaQueimado",
    "vermelhoCoral",
  ]),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  className: PropTypes.string,
  disabledGroup: PropTypes.bool,
  fullWidth: PropTypes.bool,
  distribuicao: PropTypes.oneOf(["left", "center", "between"]),
  emptyMessage: PropTypes.string,
};