export default function BotaoPrimario({
  children,
  onClick,
  type = "button",
  className = "",
  disabled = false,
  icon = null,
  "aria-label": ariaLabel,
  tabIndex = 0,
  style = {},
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      role="button"
      style={{ minWidth: 120, fontSize: "1rem", ...style }}
      className={`
        bg-[#206a7a] hover:bg-[#3489a4] text-white font-semibold
        px-6 py-2 rounded-2xl shadow transition
        focus:outline-none focus:ring-2 focus:ring-[#3489a4] focus:ring-offset-2
        flex items-center justify-center gap-2
        mx-auto disabled:opacity-60 disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    >
      {icon && <span className="mr-1">{icon}</span>}
      {children}
    </button>
  );
}
