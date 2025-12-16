// ✅ src/components/HeaderHero.jsx
import { Sparkles } from "lucide-react";

export default function HeaderHero({
  title,
  subtitle,
  badge = "Plataforma oficial • acesso autenticado",
  icon: Icon = Sparkles,
  gradient = "from-emerald-600 via-teal-600 to-sky-700",
  isDark,
  rightSlot,
}) {
  return (
    <header className="relative overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      {isDark ? <div className="absolute inset-0 bg-black/35" /> : null}

      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/25 blur-3xl" />
      <div className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/20 blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/20 backdrop-blur p-3 ring-1 ring-white/25">
              <Icon className="w-7 h-7 text-white" />
            </div>

            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 text-white/90 text-xs font-semibold">
                <Sparkles className="h-4 w-4" />
                <span className="truncate">{badge}</span>
              </div>

              <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {title}
              </h1>

              {subtitle ? (
                <p className="mt-2 text-sm text-white/90 max-w-2xl">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>

          {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
        </div>
      </div>
    </header>
  );
}
