// 📁 src/components/Select.jsx
import { useId, useMemo } from "react";
import PropTypes from "prop-types";

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
}) {
  const uid = useId();

  // Normaliza opções: aceita [{id,label}], [{value,label}], strings ou numbers
  const normOptions = useMemo(() => {
    if (!Array.isArray(options)) return [];
    return options.map((opt, idx) => {
      if (opt == null) {
        return { key: `null-${idx}`, value: "", label: "—" };
      }
      if (typeof opt === "string" || typeof opt === "number") {
        return { key: `${opt}-${idx}`, value: String(opt), label: String(opt) };
      }
      const val = opt.id ?? opt.value ?? "";
      const lab = opt.nome ?? opt.label ?? opt.descricao ?? String(val || "Sem descrição");
      const key = opt.key ?? val ?? idx;
      return { key, value: String(val), label: lab };
    });
  }, [options]);

  const hasOptions = normOptions.length > 0;
  const isDisabled = disabled || isLoading || !hasOptions;

  return (
    <div className={`flex flex-col text-sm w-full ${className}`} role="group" aria-label={`Campo de seleção: ${label}`}>
      <label htmlFor={`select-${uid}`} className="mb-1 font-medium text-lousa">
        {label}{required ? " *" : ""}
      </label>

      <select
        id={`select-${uid}`}
        name={name}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={isDisabled}
        required={required}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={helpText || error ? `select-desc-${uid}` : undefined}
        className={[
          "border rounded-md p-2 transition bg-white dark:bg-zinc-800 dark:text-white outline-none",
          isDisabled ? "border-gray-200 text-gray-400 dark:text-gray-500 cursor-not-allowed" : "border-gray-300 focus:ring-2 focus:ring-green-700/50",
          error ? "border-red-500 focus:ring-red-500/40" : "",
        ].join(" ")}
      >
        <option value="">{isLoading ? "Carregando..." : placeholder}</option>

        {hasOptions ? (
          normOptions.map((opt) => (
            <option key={opt.key} value={opt.value}>
              {opt.label}
            </option>
          ))
        ) : (
          !isLoading && <option disabled>Nenhuma opção disponível</option>
        )}
      </select>

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
  options: PropTypes.arrayOf(PropTypes.oneOfType([
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      nome: PropTypes.string,
      label: PropTypes.string,
      descricao: PropTypes.string,
      key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }),
    PropTypes.string,
    PropTypes.number,
  ])),
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
};
