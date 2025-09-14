// 📁 src/components/DateRangePicker.jsx
import PropTypes from "prop-types";

/**
 * DateRangePicker – seletor acessível de intervalo de datas.
 * - Respeita tema claro/escuro e verde-900 como cor de foco.
 * - Valores aceitam Date ou string ISO (AAAA-MM-DD).
 */
export default function DateRangePicker({
  label = "Período",
  value = [null, null],
  onChange,
  disabled = false,
  className = "",
}) {
  const [inicio, fim] = value.map((v) =>
    v instanceof Date
      ? v.toISOString().substring(0, 10)
      : v?.substring(0, 10) || ""
  );

  return (
    <div className={`flex flex-col text-sm w-full ${className}`}>
      {label && (
        <label htmlFor="data-inicio" className="mb-1 font-medium text-green-900 dark:text-green-200">
          {label}
        </label>
      )}

      <div className="flex items-center gap-2">
        <input
          id="data-inicio"
          type="date"
          value={inicio}
          onChange={(e) => onChange([e.target.value, value[1]])}
          aria-label="Data inicial"
          disabled={disabled}
          className="
            flex-1 p-2 rounded-md border border-gray-300
            dark:border-gray-600 dark:bg-zinc-800 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-green-600
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        />
        <span className="text-gray-600 dark:text-gray-300 select-none">até</span>
        <input
          id="data-fim"
          type="date"
          value={fim}
          onChange={(e) => onChange([value[0], e.target.value])}
          aria-label="Data final"
          disabled={disabled}
          className="
            flex-1 p-2 rounded-md border border-gray-300
            dark:border-gray-600 dark:bg-zinc-800 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-green-600
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        />
      </div>
    </div>
  );
}

DateRangePicker.propTypes = {
  label: PropTypes.string,
  value: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)])
  ),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};
