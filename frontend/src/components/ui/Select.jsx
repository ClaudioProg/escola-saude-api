// ✅ src/components/ui/Select.jsx — v2.0
// Plataforma Escola da Saúde
//
// Select genérico oficial da plataforma.
//
// Revisão premium:
// - componente genérico real de UI;
// - contrato previsível para formulários e filtros;
// - suporte a options simples, objetos e grupos;
// - acessibilidade com label, describedBy, invalid, required e busy;
// - loading claro;
// - estado vazio;
// - clear button acessível;
// - mobile-first;
// - dark mode;
// - visual premium consistente;
// - sem coerção numérica automática insegura;
// - pronto para uso em todos os domínios.

import { useId, useMemo } from "react";
import PropTypes from "prop-types";
import { ChevronDown, Loader2, X } from "lucide-react";

const SIZE_CLASSES = {
  sm: {
    input: "min-h-10 py-2 pl-3 pr-10 text-sm",
    clear: "min-h-10 px-3 py-2 text-xs",
    icon: "h-4 w-4",
  },
  md: {
    input: "min-h-11 py-2.5 pl-3 pr-10 text-sm",
    clear: "min-h-11 px-3 py-2.5 text-sm",
    icon: "h-4 w-4",
  },
  lg: {
    input: "min-h-12 py-3 pl-3.5 pr-11 text-base",
    clear: "min-h-12 px-4 py-3 text-sm",
    icon: "h-5 w-5",
  },
};

const RADIUS_CLASSES = {
  md: "rounded-xl",
  xl: "rounded-2xl",
  "2xl": "rounded-3xl",
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizarOption(option, index) {
  if (option == null) {
    return null;
  }

  if (typeof option === "string" || typeof option === "number") {
    return {
      key: `${String(option)}-${index}`,
      value: String(option),
      label: String(option),
      disabled: false,
    };
  }

  if (option.group && Array.isArray(option.options)) {
    return {
      group: String(option.group),
      options: option.options
        .map((item, itemIndex) => normalizarOption(item, itemIndex))
        .filter(Boolean),
    };
  }

  const rawValue = option.value ?? option.id ?? "";
  const label =
    option.label ??
    option.nome ??
    option.descricao ??
    (rawValue === "" ? "Sem descrição" : String(rawValue));

  return {
    key: String(option.key ?? rawValue ?? `option-${index}`),
    value: String(rawValue),
    label: String(label),
    disabled: Boolean(option.disabled),
  };
}

function normalizarOptions(options) {
  return (Array.isArray(options) ? options : [])
    .map((option, index) => normalizarOption(option, index))
    .filter(Boolean);
}

function hasOptionGroups(options) {
  return options.some((option) => option?.group && Array.isArray(option.options));
}

function getDescribedBy({ helpId, errorId, helpText, error }) {
  return [
    error ? errorId : null,
    helpText ? helpId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;
}

export default function Select({
  label = "Selecionar",
  options = [],
  value,
  onChange,
  placeholder = "Selecione uma opção",
  disabled = false,
  required = false,
  error = "",
  helpText = "",
  isLoading = false,
  className = "",
  name,
  size = "md",
  clearable = false,
  onClear,
  nullable = true,
  autoFocus = false,
  onBlur,
  onFocus,
  leadingIcon,
  floatingLabel = false,
  rounded = "xl",
  emptyLabel = "Nenhuma opção disponível",
  testId = "select",
}) {
  const uid = useId();

  const selectId = `${uid}-select`;
  const helpId = `${uid}-help`;
  const errorId = `${uid}-error`;

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const radiusClass = RADIUS_CLASSES[rounded] || RADIUS_CLASSES.xl;

  const normalizedOptions = useMemo(() => normalizarOptions(options), [options]);

  const hasOptions = normalizedOptions.length > 0;
  const grouped = hasOptionGroups(normalizedOptions);
  const isDisabled = disabled || isLoading || !hasOptions;

  const currentValue = value == null ? "" : String(value);
  const showPlaceholder = nullable !== false;
  const showClear = clearable && currentValue !== "" && !isDisabled;

  const describedBy = getDescribedBy({
    helpId,
    errorId,
    helpText,
    error,
  });

  const handleChange = (event) => {
    const nextValue = event.target.value;
    onChange?.(nextValue === "" ? null : nextValue);
  };

  const handleClear = () => {
    onChange?.(null);
    onClear?.();
  };

  return (
    <div
      className={classNames("w-full", className)}
      data-testid={testId}
    >
      {label && !floatingLabel && (
        <label
          htmlFor={selectId}
          className="mb-1.5 block text-sm font-black text-slate-900 dark:text-white"
        >
          {label}
          {required && (
            <span className="ml-1 text-rose-600 dark:text-rose-300" aria-label="obrigatório">
              *
            </span>
          )}
        </label>
      )}

      <div className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          {leadingIcon && (
            <span
              className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500 dark:text-slate-300"
              aria-hidden="true"
            >
              {leadingIcon}
            </span>
          )}

          {label && floatingLabel && (
            <label
              htmlFor={selectId}
              className={classNames(
                "absolute left-3 top-0 z-10 -translate-y-1/2 rounded-full bg-white px-1.5 text-[11px] font-black text-slate-600 dark:bg-slate-900 dark:text-slate-300",
                leadingIcon && "ml-7"
              )}
            >
              {label}
              {required && (
                <span className="ml-1 text-rose-600 dark:text-rose-300" aria-label="obrigatório">
                  *
                </span>
              )}
            </label>
          )}

          <select
            id={selectId}
            name={name}
            value={currentValue}
            onChange={handleChange}
            onBlur={onBlur}
            onFocus={onFocus}
            disabled={isDisabled}
            required={required}
            autoFocus={autoFocus}
            aria-required={required || undefined}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy}
            aria-busy={isLoading || undefined}
            className={classNames(
              "w-full appearance-none border bg-white text-slate-900 shadow-sm outline-none transition",
              "focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15",
              "disabled:cursor-not-allowed disabled:opacity-60",
              "dark:bg-slate-950 dark:text-slate-100",
              radiusClass,
              sizeClass.input,
              leadingIcon && "pl-10",
              error
                ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15 dark:border-rose-800"
                : "border-slate-200 dark:border-slate-800"
            )}
          >
            {showPlaceholder && (
              <option value="">
                {isLoading ? "Carregando opções..." : placeholder}
              </option>
            )}

            {!grouped &&
              normalizedOptions.map((option) =>
                option.group ? null : (
                  <option
                    key={option.key}
                    value={option.value}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </option>
                )
              )}

            {grouped &&
              normalizedOptions.map((optionOrGroup, groupIndex) =>
                optionOrGroup.group ? (
                  <optgroup
                    key={`group-${optionOrGroup.group}-${groupIndex}`}
                    label={optionOrGroup.group}
                  >
                    {optionOrGroup.options.map((option, optionIndex) => (
                      <option
                        key={option.key || `group-${groupIndex}-option-${optionIndex}`}
                        value={option.value}
                        disabled={option.disabled}
                      >
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  <option
                    key={optionOrGroup.key || `option-${groupIndex}`}
                    value={optionOrGroup.value}
                    disabled={optionOrGroup.disabled}
                  >
                    {optionOrGroup.label}
                  </option>
                )
              )}

            {!hasOptions && !isLoading && (
              <option value="" disabled>
                {emptyLabel}
              </option>
            )}
          </select>

          <span
            className="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 text-slate-500 dark:text-slate-300"
            aria-hidden="true"
          >
            {isLoading ? (
              <Loader2 className={classNames(sizeClass.icon, "animate-spin")} />
            ) : (
              <ChevronDown className={sizeClass.icon} />
            )}
          </span>
        </div>

        {showClear && (
          <button
            type="button"
            onClick={handleClear}
            className={classNames(
              "inline-flex shrink-0 items-center justify-center gap-1.5 border bg-white font-black text-slate-700 shadow-sm transition",
              "hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              "dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900",
              radiusClass,
              sizeClass.clear
            )}
            title="Limpar seleção"
            aria-label="Limpar seleção"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Limpar
          </button>
        )}
      </div>

      {error && (
        <p
          id={errorId}
          className="mt-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
        >
          {error}
        </p>
      )}

      {helpText && !error && (
        <p
          id={helpId}
          className="mt-1.5 text-xs font-medium text-slate-500 dark:text-slate-400"
        >
          {helpText}
        </p>
      )}
    </div>
  );
}

Select.propTypes = {
  label: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        nome: PropTypes.string,
        label: PropTypes.string,
        descricao: PropTypes.string,
        key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        disabled: PropTypes.bool,
      }),
      PropTypes.shape({
        group: PropTypes.string.isRequired,
        options: PropTypes.array.isRequired,
      }),
      PropTypes.string,
      PropTypes.number,
    ])
  ),
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  error: PropTypes.string,
  helpText: PropTypes.string,
  isLoading: PropTypes.bool,
  className: PropTypes.string,
  name: PropTypes.string,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  clearable: PropTypes.bool,
  onClear: PropTypes.func,
  nullable: PropTypes.bool,
  autoFocus: PropTypes.bool,
  onBlur: PropTypes.func,
  onFocus: PropTypes.func,
  leadingIcon: PropTypes.node,
  floatingLabel: PropTypes.bool,
  rounded: PropTypes.oneOf(["md", "xl", "2xl"]),
  emptyLabel: PropTypes.string,
  testId: PropTypes.string,
};