import PropTypes from "prop-types";

export default function DateRangePicker({
  label = "Período",
  value = [null, null],
  onChange,
  disabled = false,
}) {
  const [inicio, fim] = value.map((v) =>
    v instanceof Date ? v.toISOString().substring(0, 10) : v?.substring(0, 10) || ""
  );

  return (
    <div className="flex flex-col text-sm w-full">
      <label className="mb-1 font-medium text-lousa" htmlFor="data-inicio">{label}</label>
      <div className="flex items-center gap-2">
        <input
          id="data-inicio"
          type="date"
          value={inicio}
          onChange={(e) => onChange([e.target.value, value[1]])}
          aria-label="Data inicial"
          disabled={disabled}
          className="flex-1 border border-gray-300 rounded-md p-2 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <span className="text-gray-600 dark:text-gray-300">até</span>
        <input
          id="data-fim"
          type="date"
          value={fim}
          onChange={(e) => onChange([value[0], e.target.value])}
          aria-label="Data final"
          disabled={disabled}
          className="flex-1 border border-gray-300 rounded-md p-2 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
    </div>
  );
}

DateRangePicker.propTypes = {
  label: PropTypes.string,
  value: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)])),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};
