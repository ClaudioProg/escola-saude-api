import PropTypes from "prop-types";

export default function BotaoAcao({ label, icon, onClick, cor = "blue", disabled = false }) {
  const cores = {
    blue: "bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-400",
    purple: "bg-purple-700 hover:bg-purple-800 focus-visible:ring-purple-400",
    green: "bg-green-700 hover:bg-green-800 focus-visible:ring-green-400",
    gray: "bg-gray-700 hover:bg-gray-800 focus-visible:ring-gray-400",
    lousa: "bg-lousa hover:brightness-110 focus-visible:ring-lousa",
    red: "bg-red-600 hover:bg-red-700 focus-visible:ring-red-400",
    orange: "bg-orange-500 hover:bg-orange-600 focus-visible:ring-orange-400",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 px-3 py-1 text-white rounded-full text-xs transition focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        cores[cor] || cores.blue
      }`}
      aria-label={label}
    >
      {icon}
      {label}
    </button>
  );
}

BotaoAcao.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.node.isRequired,
  onClick: PropTypes.func.isRequired,
  cor: PropTypes.oneOf(["blue", "purple", "green", "gray", "lousa", "red", "orange"]),
  disabled: PropTypes.bool,
};
