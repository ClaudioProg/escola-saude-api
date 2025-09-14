// 📁 src/components/ui/TituloSecao.jsx
import PropTypes from "prop-types";

/**
 * Título de seção semântico e responsivo.
 * - Usa verde-900 como cor padrão (tema claro) e variação clara no dark-mode.
 * - Suporte a tamanhos (sm, md, lg), alinhamento e classes extras.
 * - Inclui id/aria-level para navegação assistiva.
 */
export default function TituloSecao({
  children,
  size = "md",
  align = "left",
  id,
  className = "",
}) {
  const sizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  const alignments = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  return (
    <h2
      id={id}
      aria-level={2}
      className={[
        "font-semibold border-b-2 pb-2 mb-4",
        sizes[size],
        alignments[align],
        "text-verde-900 border-verde-900/30",
        "dark:text-verde-900/80 dark:border-verde-900/50",
        className,
      ].join(" ")}
    >
      {children}
    </h2>
  );
}

TituloSecao.propTypes = {
  /** Conteúdo do título */
  children: PropTypes.node.isRequired,
  /** Tamanho do texto */
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  /** Alinhamento do título */
  align: PropTypes.oneOf(["left", "center", "right"]),
  /** id opcional para ancoragem/acessibilidade */
  id: PropTypes.string,
  /** Classes adicionais */
  className: PropTypes.string,
};
