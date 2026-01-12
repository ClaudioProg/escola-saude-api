// 📁 src/components/SkeletonEvento.jsx
import PropTypes from "prop-types";

/**
 * SkeletonEvento (Premium)
 * Placeholder animado (shimmer) com dark-mode e acessibilidade.
 *
 * Props:
 * - className?: string
 * - variant?: "card" | "plain"   (default: "card")
 * - lines?: number              (linhas de descrição, default 3)
 */
export default function SkeletonEvento({ className = "", variant = "card", lines = 3 }) {
  const isCard = variant === "card";
  const safeLines = Math.max(1, Math.min(6, Number(lines) || 3));

  return (
    <div
      className={[
        isCard
          ? "max-w-3xl mx-auto mt-6 sm:mt-8 rounded-3xl border overflow-hidden " +
            "border-zinc-200/80 bg-white/70 shadow-[0_18px_55px_-40px_rgba(2,6,23,0.25)] ring-1 ring-black/5 " +
            "dark:border-white/10 dark:bg-zinc-900/50 dark:ring-white/10 " +
            "supports-[backdrop-filter]:backdrop-blur"
          : "max-w-3xl mx-auto mt-6 sm:mt-8",
        className,
      ].join(" ")}
      aria-label="Carregando detalhes do evento"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      {/* Shimmer overlay (respeita reduced motion via tailwind) */}
      <div className="relative">
        <div
          className={[
            "pointer-events-none absolute inset-0",
            "bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.65),transparent)]",
            "dark:bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.12),transparent)]",
            "translate-x-[-100%] motion-safe:animate-[shimmer_1.6s_infinite]",
          ].join(" ")}
          aria-hidden="true"
        />

        {/* conteúdo skeleton */}
        <div className={isCard ? "p-6 sm:p-8" : "p-0"}>
          {/* topo: “badge + meta” */}
          <div className="mb-5 flex items-center gap-3">
            <div className="h-6 w-20 rounded-full bg-zinc-200/70 dark:bg-white/10" />
            <div className="h-4 w-40 rounded-lg bg-zinc-200/60 dark:bg-white/10" />
          </div>

          {/* Título principal */}
          <div className="h-9 w-2/3 mb-4 rounded-2xl bg-zinc-200/70 dark:bg-white/10" />

          {/* Metas (datas/local) */}
          <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="h-10 rounded-2xl bg-zinc-100/80 dark:bg-white/5" />
            <div className="h-10 rounded-2xl bg-zinc-100/80 dark:bg-white/5" />
            <div className="h-10 rounded-2xl bg-zinc-100/80 dark:bg-white/5" />
          </div>

          {/* Linhas de descrição */}
          <div className="space-y-3 mb-6">
            {Array.from({ length: safeLines }).map((_, i) => (
              <div
                key={i}
                className={[
                  "h-4 rounded-xl bg-zinc-200/60 dark:bg-white/10",
                  i === safeLines - 1 ? "w-3/4" : i === 1 ? "w-11/12" : "w-full",
                ].join(" ")}
              />
            ))}
          </div>

          {/* Ações (botões) */}
          <div className="flex flex-wrap gap-2">
            <div className="h-10 w-44 rounded-2xl bg-zinc-100/90 dark:bg-white/10" />
            <div className="h-10 w-36 rounded-2xl bg-zinc-100/90 dark:bg-white/10" />
            <div className="h-10 w-28 rounded-2xl bg-zinc-100/90 dark:bg-white/10" />
          </div>
        </div>
      </div>

      {/* keyframes shimmer */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

SkeletonEvento.propTypes = {
  className: PropTypes.string,
  variant: PropTypes.oneOf(["card", "plain"]),
  lines: PropTypes.number,
};
