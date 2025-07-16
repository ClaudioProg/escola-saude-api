export default function Select({
  label = "Selecionar",
  options = [],
  value,
  onChange,
  placeholder = "Todos",
  disabled = false,
}) {
  const hasOptions = Array.isArray(options) && options.length > 0;

  return (
    <div
      className="flex flex-col text-sm w-full"
      tabIndex={0}
      role="group"
      aria-label={`Campo de seleção: ${label}`}
    >
      <label
        htmlFor={`select-${label}`}
        className="mb-1 font-medium text-lousa"
      >
        {label}
      </label>

      <select
        id={`select-${label}`}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={!hasOptions || disabled}
        aria-label={label}
        aria-disabled={!hasOptions || disabled}
        className={`border rounded-md p-2 transition bg-white dark:bg-zinc-800 dark:text-white ${
          hasOptions
            ? "border-gray-300"
            : "border-gray-200 text-gray-400 dark:text-gray-500"
        }`}
      >
        <option value="">{placeholder}</option>

        {hasOptions ? (
          options.map((opt, index) => (
            <option
              key={opt.id || opt.value || index}
              value={opt.id ?? opt.value ?? ""}
            >
              {opt.nome || opt.label || opt.descricao || "Sem descrição"}
            </option>
          ))
        ) : (
          <option disabled>Nenhuma opção disponível</option>
        )}
      </select>
    </div>
  );
}
