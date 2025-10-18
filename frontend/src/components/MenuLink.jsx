// 📁 src/components/MenuLink.jsx
import React, { forwardRef, useMemo } from "react";
import PropTypes from "prop-types";
import { NavLink } from "react-router-dom";

function isExternal(href) {
  return typeof href === "string" && /^(https?:|mailto:|tel:)/i.test(href);
}

/** Junta classes ignorando falsy */
function cx(...args) {
  return args.filter(Boolean).join(" ");
}

const MenuLink = forwardRef(function MenuLink(
  {
    to,
    icon,
    rightIcon,
    children,
    end = false,
    className = "",
    baseClassName = "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors hover:bg-white/10 focus:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
    activeClassName = "bg-white/10 font-semibold",
    pendingClassName = "opacity-70",
    iconClassName = "w-5 h-5",
    rightIconClassName = "w-4 h-4",
    target,
    rel,
    title,
    disabled = false,
    onClick,
    "aria-label": ariaLabel,
    ...rest
  },
  ref
) {
  const external = isExternal(to);
  const computedAriaLabel = ariaLabel || title || (typeof children === "string" ? children : undefined);

  const IconLeft = useMemo(() => {
    // aceita <Icon /> ou um componente (ex: Icon={User})
    if (!icon) return null;
    return React.isValidElement(icon)
      ? React.cloneElement(icon, { className: icon.props.className || iconClassName, "aria-hidden": true })
      : React.createElement(icon, { className: iconClassName, "aria-hidden": true });
  }, [icon, iconClassName]);

  const IconRight = useMemo(() => {
    if (!rightIcon) return null;
    return React.isValidElement(rightIcon)
      ? React.cloneElement(rightIcon, { className: rightIcon.props.className || rightIconClassName, "aria-hidden": true })
      : React.createElement(rightIcon, { className: rightIconClassName, "aria-hidden": true });
  }, [rightIcon, rightIconClassName]);

  // Quando desabilitado, renderiza um <span> com semântica apropriada
  if (disabled) {
    return (
      <span
        ref={ref}
        role="link"
        aria-disabled="true"
        className={cx(baseClassName, "cursor-not-allowed opacity-60", className)}
        title={title}
        aria-label={computedAriaLabel}
        {...rest}
      >
        {IconLeft}
        <span>{children}</span>
        {IconRight}
      </span>
    );
  }

  if (external) {
    const safeRel = rel || (target === "_blank" ? "noopener noreferrer" : undefined);
    return (
      <a
        ref={ref}
        href={to}
        target={target}
        rel={safeRel}
        className={cx(baseClassName, className)}
        aria-label={computedAriaLabel}
        title={title}
        onClick={onClick}
        {...rest}
      >
        {IconLeft}
        <span>{children}</span>
        {IconRight}
      </a>
    );
  }

  // Rotas internas
  return (
    <NavLink
      ref={ref}
      to={to}
      end={end}
      aria-label={computedAriaLabel}
      title={title}
      onClick={onClick}
      className={({ isActive, isPending }) =>
        cx(baseClassName, isActive && activeClassName, isPending && pendingClassName, className)
      }
      {...rest}
    >
      {IconLeft}
      <span>{children}</span>
      {IconRight}
    </NavLink>
  );
});

MenuLink.propTypes = {
  to: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
  /** Aceita componente (ex.: `User`) ou elemento (<User />) */
  icon: PropTypes.oneOfType([PropTypes.elementType, PropTypes.element]),
  rightIcon: PropTypes.oneOfType([PropTypes.elementType, PropTypes.element]),
  children: PropTypes.node,
  end: PropTypes.bool,
  className: PropTypes.string,
  baseClassName: PropTypes.string,
  activeClassName: PropTypes.string,
  pendingClassName: PropTypes.string,
  iconClassName: PropTypes.string,
  rightIconClassName: PropTypes.string,
  target: PropTypes.string,
  rel: PropTypes.string,
  title: PropTypes.string,
  "aria-label": PropTypes.string,
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
};

export default MenuLink;
