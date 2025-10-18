// 📁 src/components/Select.jsx
import { useId, useMemo } from "react";
import PropTypes from "prop-types";

const SIZE_CLS = {
  sm: { pad: "p-1.5", text: "text-sm", clear: "px-2 py-1 text-xs" },
  md: { pad: "p-2",   text: "text-sm", clear: "px-2.5 py-1.5 text-xs" },
  lg: { pad: "p-3",   text: "text-base", clear: "px-3 py-1.5 text-sm" },
};

export default function Select({
  label = "Selecionar",
  options = [],
  value,
  onChange,
  placeholder = "Todos",
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
  nullable = true,           // se false, não mostra placeholder como opção
  coerceNumber = false,      // tenta manter números como number
  autoFocus = false,
  onBlur,
  onFocus,
  "data-testid": testId = "select",
}) {
  const uid = useId();
  const sz = SIZE_CLS[size] || SIZE_CLS.md;

  // Normaliza opções:
  // - aceita strings, numbers
  // - aceita objetos { id/value, nome/label/descricao, key, disabled, group }
  // - aceita grupos: { group: "Nome do grupo", options: [...] }
  const normOptions = useMemo(() => {
    if (!Array.isArray(options)) return [];

    const normalizeItem = (opt, idx) => {
      if (opt == null) return { key: `null-${idx}`, value: "", label: "—" };
      if (typeof opt === "string" || typeof opt === "number") {
        return { key: `${opt}-${idx}`, value: opt, label: String(opt) };
      }
      if (opt.group && Array.isArray(opt.options)) {
        return {
          group: String(opt.group),
          options: opt.options.map(normalizeItem),
        };
      }
      const rawVal = opt.id ?? opt.value ?? "";
      const lab =
        opt.nome ?? opt.label ?? opt.descricao ?? String(rawVal || "Sem descrição");
      const key = opt.key ?? rawVal ?? idx;
      return {
        key,
        value: rawVal,
        label: lab,
        disabled: !!opt.disabled,
      };
    };

    return options.map(normalizeItem);
  }, [options]);

  const hasOptions = normOptions.length > 0;
  const isDisabled = disabled || isLoading || !hasOptions;

  const coerce = (v) => {
    if (!coerceNumber) return v;
    // tenta converter para number quando apropriado
    if (v === "" || v === null || v === undefined) return "";
    const n = Number(v);
    return Number.isFinite(n) && String(n) === String(v) ? n : v;
  };

  const handleChange = (e) => onChange?.(coerce(e.target.value));

  // decide se a opção placeholder deve existir
  const showPlaceholderOption = nullable !== false;

  // detecta se há grupos
  const hasGroups = normOptions.some((o) => o?.group && Array.isArray(o.options));

  return (
    <div
      className={`flex flex-col w-full ${className}`}
      role="group"
      aria-label={`Campo de seleção: ${label}`}
      data-testid={testId}
    >
      {label && (
        <label htmlFor={`select-${uid}`} className="mb-1 font-medium text-lousa dark:text-white">
          {label}
          {required ? " *" : ""}
        </label>
      )}

      <div className="flex items-stretch gap-2">
        <select
          id={`select-${uid}`}
          name={name}
          value={value ?? ""}
          onChange={handleChange}
          onBlur={onBlur}
          onFocus={onFocus}
          disabled={isDisabled}
          required={required}
          autoFocus={autoFocus}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={helpText || error ? `select-desc-${uid}` : undefined}
          aria-busy={isLoading ? "true" : undefined}
          className={[
            "border rounded-md transition bg-white dark:bg-zinc-800 dark:text-white outline-none w-full",
            sz.pad,
            sz.text,
            isDisabled
              ? "border-gray-200 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              : "border-gray-300 focus:ring-2 focus:ring-green-700/50",
            error ? "border-red-500 focus:ring-red-500/40" : "",
          ].join(" ")}
        >
          {showPlaceholderOption && (
            <option value="">{isLoading ? "Carregando..." : placeholder}</option>
          )}

          {!hasGroups
            ? (
              hasOptions ? (
                normOptions.map((opt) =>
                  "group" in opt ? null : (
                    <option key={opt.key} value={String(opt.value)} disabled={opt.disabled}>
                      {opt.label}
                    </option>
                  )
                )
              ) : (
                !isLoading && <option disabled>Nenhuma opção disponível</option>
              )
            )
            : (
              normOptions.map((groupOrOpt, gi) =>
                groupOrOpt?.group ? (
                  <optgroup key={`g-${gi}`} label={groupOrOpt.group}>
                    {groupOrOpt.options.map((opt, oi) => (
                      <option key={opt.key ?? `g-${gi}-o-${oi}`} value={String(opt.value)} disabled={opt.disabled}>
                        {opt.label}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  <option key={groupOrOpt.key ?? `o-${gi}`} value={String(groupOrOpt.value)} disabled={groupOrOpt.disabled}>
                    {groupOrOpt.label}
                  </option>
                )
              )
            )}
        </select>

        {clearable && (value ?? "") !== "" && (
          <button
            type="button"
            onClick={() => {
              onChange?.(coerce(""));
              onClear?.();
            }}
            className={[
              "shrink-0 rounded-md border bg-white dark:bg-zinc-800 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-700",
              "border-gray-300 dark:border-zinc-700",
              sz.clear,
            ].join(" ")}
            title="Limpar seleção"
            aria-label="Limpar seleção"
          >
            Limpar
          </button>
        )}
      </div>

      {(helpText || error) && (
        <p
          id={`select-desc-${uid}`}
          className={`mt-1 ${error ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}
        >
          {error || helpText}
        </p>
      )}
    </div>
  );
}

Select.propTypes = {
  label: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      // item simples
      PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        nome: PropTypes.string,
        label: PropTypes.string,
        descricao: PropTypes.string,
        key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        disabled: PropTypes.bool,
      }),
      // agrupado
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
  coerceNumber: PropTypes.bool,
  autoFocus: PropTypes.bool,
  onBlur: PropTypes.func,
  onFocus: PropTypes.func,
  "data-testid": PropTypes.string,
};
