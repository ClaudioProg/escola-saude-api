// ✅ src/components/HeaderHero.jsx
import { Sparkles } from "lucide-react";

export default function HeaderHero({
  title,
  subtitle,
  badge = "Plataforma oficial • autenticado",
  icon: Icon = Sparkles,
  gradient = "from-emerald-600 via-teal-600 to-sky-700",
  isDark,        // (compat) opcional
  rightSlot,
  className = "",
}) {
  const showBadge = badge !== false && String(badge || "").trim().length > 0;

  return (
    <header
      className={[
        "relative overflow-hidden rounded-3xl",
        "ring-1 ring-black/5 dark:ring-white/10",
        "shadow-[0_18px_60px_rgba(2,6,23,.10)] dark:shadow-[0_22px_80px_rgba(0,0,0,.55)]",
        className,
      ].join(" ")}
      role="banner"
    >
      {/* Base gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />

      {/* Overlay inteligente (melhora contraste em light e dark) */}
      <div className="absolute inset-0 bg-black/15 dark:bg-black/35" />
      {/* Compat: se ainda passar isDark=true, reforça levemente */}
      {isDark ? <div className="absolute inset-0 bg-black/10" /> : null}

      {/* Premium “seal” line (assinatura do login) */}
      <div className="absolute inset-x-0 top-0">
        <div className="h-[3px] w-full bg-gradient-to-r from-white/0 via-white/60 to-white/0" />
        <div
          className="pointer-events-none absolute inset-x-0 -top-2 h-10 bg-gradient-to-r from-white/0 via-white/28 to-white/0 blur-2xl"
          aria-hidden="true"
        />
      </div>

      {/* Soft grid + dots (discreto) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.18] dark:opacity-[0.22]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.10) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.10] dark:opacity-[0.14]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,.35) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      {/* Ambient blobs (controlados) */}
      <div aria-hidden="true" className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/18 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/14 blur-3xl" />
      <div aria-hidden="true" className="absolute top-10 right-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />

      {/* Content */}
      <div className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 md:py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4 min-w-0">
              {/* Icon tile premium */}
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-3xl bg-white/25 blur-xl" aria-hidden="true" />
                <div className="rounded-3xl bg-white/16 backdrop-blur-md p-3.5 ring-1 ring-white/25 shadow-[0_12px_34px_rgba(0,0,0,.18)]">
                  <Icon className="w-7 h-7 text-white" aria-hidden="true" />
                </div>
              </div>

              <div className="min-w-0">
                {/* Badge pill */}
                {showBadge ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-white/90 text-xs font-extrabold backdrop-blur-md">
                    <Sparkles className="h-4 w-4 opacity-90" aria-hidden="true" />
                    <span className="truncate">{badge}</span>
                  </div>
                ) : null}

                <h1 className="mt-2 text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
                  {title}
                </h1>

                {subtitle ? (
                  <p className="mt-2 text-sm md:text-[15px] text-white/90 max-w-2xl leading-relaxed">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Right slot */}
            {rightSlot ? (
              <div className="shrink-0 w-full sm:w-auto">
                <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md p-2 shadow-[0_12px_34px_rgba(0,0,0,.14)]">
                  {rightSlot}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
