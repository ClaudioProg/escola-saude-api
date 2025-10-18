// 📁 src/components/ui/TituloSecao.jsx
import PropTypes from "prop-types";

/**
 * Título de seção semântico e responsivo.
 * - Gradiente 3-cores (accent configurável).
 * - Ícone e subtítulo opcionais.
 * - Acessível (aria-level, role="heading").
 * - Tamanhos sm/md/lg/xl e alinhamento flexível.
 */
export default function TituloSecao({
  children,
  subtitle,
  icon = null,
  size = "md",
  align = "left",
  accent = "lousa", // emerald|violet|amber|rose|teal|indigo|petroleo|orange|sky|lousa
  id,
  className = "",
  noBorder = false,
}) {
  const sizes = {
    sm: "text-lg sm:text-xl",
    md: "text-xl sm:text-2xl",
    lg: "text-2xl sm:text-3xl",
    xl: "text-3xl sm:text-4xl",
  };

  const alignments = {
    left: "text-left items-start",
    center: "text-center items-center",
    right: "text-right items-end",
  };

  const accents = {
    emerald: "from-emerald-900 via-emerald-700 to-emerald-500",
    violet: "from-violet-900 via-violet-700 to-violet-500",
    amber: "from-amber-900 via-amber-700 to-amber-500",
    rose: "from-rose-900 via-rose-700 to-rose-500",
    teal: "from-teal-900 via-teal-700 to-teal-500",
    indigo: "from-indigo-900 via-indigo-700 to-indigo-500",
    petroleo: "from-slate-900 via-teal-900 to-slate-700",
    orange: "from-orange-900 via-orange-700 to-orange-500",
    sky: "from-sky-900 via-sky-700 to-sky-500",
    lousa: "from-[#0f2c1f] via-[#114b2d] to-[#166534]",
  };

  const grad = accents[accent] ?? accents.lousa;
  const border = noBorder
    ? ""
    : `after:content-[''] after:block after:h-[3px] after:w-16 sm:after:w-24 after:mt-1 after:rounded-full after:bg-gradient-to-r after:${grad}`;

  return (
    <div
      id={id}
      role="heading"
      aria-level={2}
      className={`flex flex-col ${alignments[align]} mb-6 ${className}`}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="text-verde-900 dark:text-verde-800" aria-hidden>{icon}</span>}
        <h2
          className={[
            "font-bold tracking-tight leading-snug text-transparent bg-clip-text bg-gradient-to-br",
            grad,
            sizes[size],
            "dark:brightness-110",
          ].join(" ")}
        >
          {children}
        </h2>
      </div>

      {subtitle && (
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1 max-w-prose">
          {subtitle}
        </p>
      )}

      {/* Linha decorativa */}
      {!noBorder && <div className={`relative ${border}`} aria-hidden />}
    </div>
  );
}

TituloSecao.propTypes = {
  /** Conteúdo do título */
  children: PropTypes.node.isRequired,
  /** Subtítulo opcional */
  subtitle: PropTypes.node,
  /** Ícone opcional */
  icon: PropTypes.node,
  /** Tamanho do texto */
  size: PropTypes.oneOf(["sm", "md", "lg", "xl"]),
  /** Alinhamento do título */
  align: PropTypes.oneOf(["left", "center", "right"]),
  /** Tema de cor (gradiente) */
  accent: PropTypes.oneOf([
    "emerald",
    "violet",
    "amber",
    "rose",
    "teal",
    "indigo",
    "petroleo",
    "orange",
    "sky",
    "lousa",
  ]),
  /** id opcional para ancoragem/acessibilidade */
  id: PropTypes.string,
  /** Classes adicionais */
  className: PropTypes.string,
  /** Remove linha decorativa */
  noBorder: PropTypes.bool,
};
