// 📁 src/components/MenuLink.jsx
import PropTypes from "prop-types";
import { NavLink } from "react-router-dom";

function isExternal(href) {
  return typeof href === "string" && /^(https?:|mailto:|tel:)/i.test(href);
}

export default function MenuLink({
  to,
  icon: Icon,
  children,
  end = false,            // match exato? (false = ativo também em rotas filhas)
  className = "",
  target,
  rel,
  "aria-label": ariaLabel,
  title,
  iconClassName = "w-5 h-5",
}) {
  const base =
    "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors " +
    "hover:bg-white/10 focus:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40";

  // Links externos
  if (isExternal(to)) {
    const finalRel = rel || (target === "_blank" ? "noopener noreferrer" : undefined);
    return (
      <a
        href={to}
        target={target}
        rel={finalRel}
        className={`${base} ${className}`}
        aria-label={ariaLabel}
        title={title}
      >
        {Icon && <Icon className={iconClassName} aria-hidden="true" />}
        <span>{children}</span>
      </a>
    );
  }

  // Rotas internas
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={ariaLabel}
      title={title}
      className={({ isActive, isPending }) =>
        [
          base,
          isActive ? "bg-white/10 font-semibold" : "",
          isPending ? "opacity-70" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")
      }
    >
      {Icon && <Icon className={iconClassName} aria-hidden="true" />}
      <span>{children}</span>
    </NavLink>
  );
}

MenuLink.propTypes = {
  to: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
  icon: PropTypes.elementType,
  children: PropTypes.node,
  end: PropTypes.bool,
  className: PropTypes.string,
  target: PropTypes.string,
  rel: PropTypes.string,
  "aria-label": PropTypes.string,
  title: PropTypes.string,
  iconClassName: PropTypes.string,
};
