// 📁 src/components/MenuLink.jsx
import React, { forwardRef } from "react";
import PropTypes from "prop-types";
import { NavLink } from "react-router-dom";

function isExternalHref(href) {
  return typeof href === "string" && /^(https?:|mailto:|tel:)/i.test(href);
}

/** Junta classes ignorando falsy */
function cx(...args) {
  return args.filter(Boolean).join(" ");
}

/**
 * MenuLink (premium)
 * - Interno: NavLink (active/pending)
 * - Externo: <a>
 * - Disabled: <span role="link" aria-disabled tabIndex=-1>
 *
 * Compatível com sua API atual.
 */
const MenuLink = forwardRef(function MenuLink(
  {
    to,
    icon,
    rightIcon,
    children,
    end = false,
    className = "",

    // ✅ defaults premium (mantém espírito do seu original)
    baseClassName =
      "group flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all " +
      "hover:bg-white/10 focus:bg-white/10 " +
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",

    activeClassName =
      "bg-white/12 font-semibold shadow-[0_10px_30px_-22px_rgba(0,0,0,0.6)] " +
      "ring-1 ring-white/10",

    pendingClassName = "opacity-80",

    iconClassName = "w-5 h-5",
    rightIconClassName = "w-4 h-4",

    // ✅ extras (não quebram compat)
    disabledClassName = "cursor-not-allowed opacity-60",
    variant = "ghost", // ghost | solid (opcional)
    solidClassName =
      "bg-white/15 hover:bg-white/20 ring-1 ring-white/10 " +
      "shadow-[0_12px_40px_-26px_rgba(0,0,0,0.65)]",

    target,
    rel,
    title,
    disabled = false,
    onClick,
    "aria-label": ariaLabel,
    tabIndex,
    ...rest
  },
  ref
) {
  const isExternal = typeof to === "string" && isExternalHref(to);
  const computedAriaLabel = ariaLabel || title || (typeof children === "string" ? children : undefined);

  const renderIcon = (node, fallbackClass, sizeHidden = true) => {
    if (!node) return null;

    // aceita <Icon /> ou componente (ex: Icon={User})
    if (React.isValidElement(node)) {
      const existing = node.props?.className;
      return React.cloneElement(node, {
        className: existing || fallbackClass,
        "aria-hidden": sizeHidden ? true : node.props?.["aria-hidden"],
      });
    }
    if (typeof node === "function") {
      return React.createElement(node, { className: fallbackClass, "aria-hidden": true });
    }
    return null;
  };

  const IconLeft = renderIcon(icon, iconClassName);
  const IconRight = renderIcon(rightIcon, rightIconClassName);

  const composedBase = cx(
    baseClassName,
    variant === "solid" && solidClassName,
    className
  );

  // Disabled: sem foco e sem click
  if (disabled) {
    return (
      <span
        ref={ref}
        role="link"
        aria-disabled="true"
        data-disabled="true"
        tabIndex={-1}
        className={cx(composedBase, disabledClassName)}
        title={title}
        aria-label={computedAriaLabel}
        {...rest}
      >
        {IconLeft}
        <span className="min-w-0 truncate">{children}</span>
        {IconRight}
      </span>
    );
  }

  // Externo
  if (isExternal) {
    const safeRel = rel || (target === "_blank" ? "noopener noreferrer" : undefined);
    return (
      <a
        ref={ref}
        href={to}
        target={target}
        rel={safeRel}
        className={composedBase}
        aria-label={computedAriaLabel}
        title={title}
        onClick={onClick}
        tabIndex={tabIndex}
        {...rest}
      >
        {IconLeft}
        <span className="min-w-0 truncate">{children}</span>
        {IconRight}
      </a>
    );
  }

  // Interno (NavLink)
  return (
    <NavLink
      ref={ref}
      to={to}
      end={end}
      aria-label={computedAriaLabel}
      title={title}
      onClick={onClick}
      tabIndex={tabIndex}
      className={({ isActive, isPending }) =>
        cx(
          composedBase,
          isActive && activeClassName,
          isPending && pendingClassName
        )
      }
      {...rest}
    >
      {IconLeft}
      <span className="min-w-0 truncate">{children}</span>
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

  // extras premium (opc)
  disabledClassName: PropTypes.string,
  variant: PropTypes.oneOf(["ghost", "solid"]),
  solidClassName: PropTypes.string,

  target: PropTypes.string,
  rel: PropTypes.string,
  title: PropTypes.string,
  "aria-label": PropTypes.string,
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  tabIndex: PropTypes.number,
};

export default MenuLink;
