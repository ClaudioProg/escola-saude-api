// 📁 src/components/ui/TituloSecao.jsx
import PropTypes from "prop-types";

export default function TituloSecao({ children }) {
  return (
    <h2 className="text-xl font-semibold text-lousa border-b-2 border-lousa/30 pb-2 mb-4">
      {children}
    </h2>
  );
}

TituloSecao.propTypes = {
  children: PropTypes.node.isRequired,
};
