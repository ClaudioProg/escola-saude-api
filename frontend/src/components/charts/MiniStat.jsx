// 📁 src/components/charts/MiniStat.jsx
import React from "react";

/**
 * 💡 MiniStat — componente de métrica simples e elegante.
 * Compatível com mobile, acessível (ARIA), e com gradientes modernos.
 * Agora suporta ícones opcionais e transições suaves.
 */
export default function MiniStat({ label, value, accent = "emerald", icon = null }) {
  const accents = {
    emerald: "from-emerald-600 to-emerald-800",
    violet: "from-violet-600 to-violet-800",
    amber: "from-amber-500 to-amber-700",
    sky: "from-sky-500 to-sky-700",
    rose: "from-rose-600 to-rose-800",
    teal: "from-teal-600 to-teal-800",
    blue: "from-blue-600 to-blue-800",
    indigo: "from-indigo-600 to-indigo-800",
  };

  const grad = accents[accent] || accents.emerald;

  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 text-white bg-gradient-to-br ${grad} shadow-md hover:shadow-lg transition-all duration-300 ease-out focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-white/70`}
      aria-label={`${label}: ${value}`}
      role="region"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        {/* Rótulo + Ícone */}
        <div className="flex items-center gap-2">
          {icon && <span className="text-white/90 text-lg sm:text-xl" aria-hidden>{icon}</span>}
          <p className="text-xs sm:text-sm opacity-90 font-medium tracking-wide">
            {label}
          </p>
        </div>

        {/* Valor principal */}
        <p
          className="text-2xl sm:text-3xl font-extrabold leading-tight drop-shadow-sm text-white select-none"
          aria-live="polite"
        >
          {value ?? "—"}
        </p>
      </div>
    </div>
  );
}
