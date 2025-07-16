export default function BotaoSecundario({
  children,
  onClick,
  type = "button",
  as = "button", // "button" | "a"
  href,
  target,
  rel,
  className = "",
  disabled = false,
  icon = null,
  "aria-label": ariaLabel,
  tabIndex = 0,
  style = {},
  ...props
}) {
  const baseClasses = `
    bg-gray-200 text-lousa px-4 py-2 rounded-2xl shadow
    hover:bg-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lousa/50
    transition font-medium
    flex items-center justify-center gap-2
    disabled:opacity-60 disabled:cursor-not-allowed
    ${className}
  `;

  const commonProps = {
    "aria-label": ariaLabel,
    tabIndex,
    className: baseClasses,
    role: "button",
    style,
    ...props,
  };

  if (as === "a") {
    return (
      <a href={href} target={target} rel={rel} {...commonProps}>
        {icon && <span className="mr-1">{icon}</span>}
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      {...commonProps}
    >
      {icon && <span className="mr-1">{icon}</span>}
      {children}
    </button>
  );
}
