// 📁 src/components/ui/Botao.jsx
import PropTypes from "prop-types";

export default function Botao({ children, onClick, variant = "primary", type = "button", disabled }) {
  const base = "px-4 py-2 rounded-2xl font-medium transition focus:outline-none";
  
  const variants = {
    primary: "bg-lousa text-textoLousa hover:bg-lousa/90 disabled:bg-lousa/50",
    secondary: "bg-gelo text-lousa hover:bg-gray-200 disabled:opacity-50",
    danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

Botao.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  variant: PropTypes.oneOf(["primary", "secondary", "danger"]),
  type: PropTypes.oneOf(["button", "submit", "reset"]),
  disabled: PropTypes.bool,
};
