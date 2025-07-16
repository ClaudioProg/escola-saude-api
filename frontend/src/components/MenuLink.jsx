import { Link, useLocation } from "react-router-dom";

export default function MenuLink({ to, icon: Icon, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors
        hover:bg-white/10 focus:bg-white/10
        ${isActive ? "bg-white/10 font-semibold" : ""}`}
      aria-current={isActive ? "page" : undefined}
    >
      {Icon && <Icon className="w-5 h-5" />}
      <span>{children}</span>
    </Link>
  );
}
