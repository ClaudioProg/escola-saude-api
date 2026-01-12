// 📁 src/components/TabelaInstrutor.jsx
import PropTypes from "prop-types";
import { Eye, CheckCircle2, XCircle, Star, Loader2, CalendarDays, Sparkles } from "lucide-react";
import { useMemo, useState, useCallback } from "react";

/* =========================================================================
   🔐 Tipo compartilhado para instrutor (reutilizado em ambos componentes)
   ========================================================================= */
const InstrutorType = PropTypes.shape({
  id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  nome: PropTypes.string,
  email: PropTypes.string,
  eventosMinistrados: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  media_avaliacao: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  possuiAssinatura: PropTypes.bool,
});

function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(Math.max(x, min), max);
}

function toNum(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

/**
 * TabelaInstrutor (grid de cards premium)
 * Props compatíveis:
 * - instrutor?: array (lista)
 * - loading?: boolean (skeleton)
 * - className?: string
 * - onVisualizar?: (instrutorMin) => void
 */
export default function TabelaInstrutor({
  instrutor = [],
  onVisualizar = () => {},
  className = "",
  loading = false,
}) {
  const lista = useMemo(() => (Array.isArray(instrutor) ? instrutor : []), [instrutor]);

  if (loading) {
    return (
      <ul
        className={cx("grid gap-4 sm:grid-cols-2 max-w-5xl mx-auto", className)}
        role="status"
        aria-busy="true"
        aria-label="Carregando instrutores"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <SkeletonInstrutorCard />
          </li>
        ))}
      </ul>
    );
  }

  if (!lista.length) {
    return (
      <div className={cx("max-w-4xl mx-auto mt-2 rounded-2xl border p-4 text-center", className, "border-zinc-200 bg-white/70 dark:border-white/10 dark:bg-zinc-900/40")}>
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200" aria-live="polite">
          Nenhum instrutor encontrado.
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Ajuste os filtros ou tente novamente mais tarde.
        </p>
      </div>
    );
  }

  return (
    <ul
      className={cx("grid gap-4 sm:grid-cols-2 max-w-5xl mx-auto", className)}
      role="list"
      aria-label="Lista de instrutores"
    >
      {lista.map((item, idx) => (
        <li key={item.id ?? `${item.email ?? "sem-email"}-${idx}`}>
          <InstrutorCard data={item} onVisualizar={onVisualizar} />
        </li>
      ))}
    </ul>
  );
}

/* =========================
   Subcomponentes
========================= */

function StarRow({ value }) {
  const num = Number.isFinite(Number(value)) ? clamp(Number(value), 0, 5) : null;

  if (num == null) {
    return <span className="text-sm text-zinc-500 dark:text-zinc-400">— / 5</span>;
  }

  const filled = Math.round(num);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={16}
            className={cx(
              i < filled ? "text-amber-500 fill-amber-500" : "text-zinc-300 dark:text-zinc-600"
            )}
          />
        ))}
      </span>
      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 tabular-nums">
        {num.toFixed(1).replace(".", ",")} / 5
      </span>
    </span>
  );
}
StarRow.propTypes = { value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]) };

function BadgeAssinatura({ ok }) {
  return ok ? (
    <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold
      bg-emerald-500/12 text-emerald-950 ring-1 ring-emerald-700/20
      dark:bg-emerald-400/10 dark:text-emerald-100 dark:ring-emerald-300/20"
    >
      <CheckCircle2 size={14} className="text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
      Assinatura OK
    </span>
  ) : (
    <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold
      bg-rose-500/12 text-rose-950 ring-1 ring-rose-700/20
      dark:bg-rose-400/10 dark:text-rose-100 dark:ring-rose-300/20"
    >
      <XCircle size={14} className="text-rose-700 dark:text-rose-300" aria-hidden="true" />
      Sem assinatura
    </span>
  );
}
BadgeAssinatura.propTypes = { ok: PropTypes.bool };

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border px-3 py-2 bg-white/60 border-zinc-200/80
      dark:bg-white/5 dark:border-white/10"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-white/10">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {label}
        </div>
        <div className="text-sm font-extrabold text-zinc-900 dark:text-white tabular-nums truncate">
          {value}
        </div>
      </div>
    </div>
  );
}
MiniStat.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

function InstrutorCard({ data, onVisualizar }) {
  const {
    id,
    nome = "—",
    email = "—",
    eventosMinistrados,
    media_avaliacao,
    possuiAssinatura,
  } = data || {};

  const eventosNum = toNum(eventosMinistrados, 0);
  const idStr = id != null ? String(id) : "";

  const [busy, setBusy] = useState(false);

  const handleVisualizar = useCallback(async () => {
    if (!idStr) return;
    try {
      setBusy(true);
      await Promise.resolve(onVisualizar({ id, nome, email }));
    } finally {
      setBusy(false);
    }
  }, [id, idStr, nome, email, onVisualizar]);

  return (
    <article
      className={cx(
        "group relative overflow-hidden rounded-3xl border",
        "border-zinc-200 bg-white/70 shadow-[0_18px_55px_-40px_rgba(2,6,23,0.22)] ring-1 ring-black/5",
        "dark:border-white/10 dark:bg-zinc-900/45 dark:ring-white/10",
        "supports-[backdrop-filter]:backdrop-blur",
        "transition hover:shadow-[0_22px_65px_-45px_rgba(2,6,23,0.35)]"
      )}
      aria-label={`Instrutor: ${nome}`}
    >
      {/* Top bar premium */}
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-600 via-sky-600 to-violet-600" />
      <div
        className="pointer-events-none absolute inset-x-0 -top-6 h-16 bg-[radial-gradient(closest-side,rgba(16,185,129,0.22),transparent)] blur-2xl"
        aria-hidden="true"
      />

      <div className="p-4 sm:p-5">
        {/* Header: nome + badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white break-words">
              {nome}
            </p>
            <p className="mt-0.5 break-all text-xs sm:text-sm text-zinc-600 dark:text-zinc-300">
              {email}
            </p>
          </div>
          <BadgeAssinatura ok={!!possuiAssinatura} />
        </div>

        {/* Mini-stats (premium) */}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <MiniStat icon={CalendarDays} label="Eventos ministrados" value={eventosNum} />
          <div className="rounded-2xl border px-3 py-2 bg-white/60 border-zinc-200/80 dark:bg-white/5 dark:border-white/10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-white/10">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Média de avaliação
                  </div>
                  <div className="mt-0.5">
                    <StarRow value={media_avaliacao} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ação */}
        <div className="mt-4">
          <button
            type="button"
            onClick={handleVisualizar}
            disabled={!idStr || busy}
            className={cx(
              "w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5",
              "text-sm font-extrabold text-white",
              "bg-emerald-600 hover:bg-emerald-700",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60",
              (!idStr || busy) ? "cursor-not-allowed opacity-70 hover:bg-emerald-600" : ""
            )}
            aria-label={`Ver histórico de ${nome}`}
            aria-disabled={!idStr || busy || undefined}
            title={!idStr ? "Indisponível" : "Ver histórico"}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye size={16} aria-hidden="true" />}
            {busy ? "Abrindo..." : "Histórico"}
          </button>
        </div>
      </div>
    </article>
  );
}

function SkeletonInstrutorCard() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white/70 p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/45">
      <div className="h-1.5 w-full -mx-5 -mt-5 mb-4 bg-gradient-to-r from-emerald-600/40 via-sky-600/35 to-violet-600/30" />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.55),transparent)] translate-x-[-100%] motion-safe:animate-[shimmer_1.6s_infinite]"
        aria-hidden="true"
      />
      <div className="h-5 w-44 rounded-xl bg-zinc-200/70 dark:bg-white/10 animate-pulse" />
      <div className="mt-2 h-4 w-60 rounded-xl bg-zinc-200/60 dark:bg-white/10 animate-pulse" />
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="h-14 rounded-2xl bg-zinc-100/80 dark:bg-white/5 animate-pulse" />
        <div className="h-14 rounded-2xl bg-zinc-100/80 dark:bg-white/5 animate-pulse" />
      </div>
      <div className="mt-4 h-11 rounded-2xl bg-zinc-200/60 dark:bg-white/10 animate-pulse" />
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

/* ===== PropTypes ===== */
TabelaInstrutor.propTypes = {
  instrutor: PropTypes.arrayOf(InstrutorType).isRequired,
  onVisualizar: PropTypes.func,
  className: PropTypes.string,
  loading: PropTypes.bool,
};

InstrutorCard.propTypes = {
  data: InstrutorType.isRequired,
  onVisualizar: PropTypes.func.isRequired,
};
