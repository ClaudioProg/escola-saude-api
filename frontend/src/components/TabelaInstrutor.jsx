// 📁 src/components/TabelaInstrutor.jsx
import PropTypes from "prop-types";
import { Eye, CheckCircle2, XCircle, Star } from "lucide-react";

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

/**
 * TabelaInstrutor (grid de cards)
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
  if (loading) {
    return (
      <ul
        className={`grid gap-4 sm:grid-cols-2 max-w-4xl mx-auto ${className}`}
        role="status"
        aria-busy="true"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="p-4 rounded-2xl shadow bg-white dark:bg-gray-800 animate-pulse"
          >
            <div className="h-5 w-40 bg-gray-200 dark:bg-zinc-700 rounded mb-2" />
            <div className="h-4 w-56 bg-gray-200 dark:bg-zinc-700 rounded mb-4" />
            <div className="space-y-2">
              <div className="h-3 w-32 bg-gray-200 dark:bg-zinc-700 rounded" />
              <div className="h-3 w-40 bg-gray-200 dark:bg-zinc-700 rounded" />
              <div className="h-3 w-44 bg-gray-200 dark:bg-zinc-700 rounded" />
            </div>
            <div className="mt-4 h-9 w-28 bg-gray-200 dark:bg-zinc-700 rounded" />
          </li>
        ))}
      </ul>
    );
  }

  if (!Array.isArray(instrutor) || instrutor.length === 0) {
    return (
      <p
        className="text-center text-gray-600 dark:text-gray-300 py-4"
        aria-live="polite"
      >
        Nenhum instrutor encontrado.
      </p>
    );
  }

  return (
    <ul
      className={`grid gap-4 sm:grid-cols-2 max-w-4xl mx-auto ${className}`}
      role="list"
      aria-label="Lista de instrutores"
    >
      {instrutor.map((item, idx) => (
        <li key={item.id ?? `${item.email ?? "sem-email"}-${idx}`}>
          <InstrutorCard data={item} onVisualizar={onVisualizar} />
        </li>
      ))}
    </ul>
  );
}

function StarRow({ value }) {
  const num = Number.isFinite(Number(value))
    ? Math.max(0, Math.min(5, Number(value)))
    : null;

  if (num == null)
    return (
      <span className="text-sm text-gray-500 dark:text-gray-400">— / 5</span>
    );

  const filled = Math.round(num);
  return (
    <span className="inline-flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={16}
          className={
            i < filled
              ? "text-yellow-500 fill-yellow-500"
              : "text-gray-300 dark:text-gray-500"
          }
          aria-hidden="true"
        />
      ))}
      <span className="text-sm text-gray-600 dark:text-gray-300">
        {num.toFixed(1)} / 5
      </span>
    </span>
  );
}
StarRow.propTypes = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

function BadgeAssinatura({ ok }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-600/30 dark:text-green-300">
      <CheckCircle2 size={14} /> Assinatura
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300">
      <XCircle size={14} /> Sem assinatura
    </span>
  );
}
BadgeAssinatura.propTypes = {
  ok: PropTypes.bool,
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

  const eventosNum =
    typeof eventosMinistrados === "number"
      ? eventosMinistrados
      : Number.isFinite(Number(eventosMinistrados))
      ? Number(eventosMinistrados)
      : 0;

  const handleVisualizar = () => {
    if (!id) return;
    onVisualizar({ id, nome, email });
  };

  return (
    <article
      className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow transition hover:shadow-md focus-within:shadow-md outline-none"
      aria-label={`Instrutor: ${nome}`}
      tabIndex={0}
    >
      <div className="flex flex-col gap-3">
        {/* Header: nome + email */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white text-lg truncate">
              {nome}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 break-all">
              {email}
            </p>
          </div>
          <BadgeAssinatura ok={!!possuiAssinatura} />
        </div>

        {/* Mini-stats */}
        <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
          <p>
            Eventos ministrados:{" "}
            <strong className="font-mono tabular-nums text-gray-800 dark:text-gray-100">
              {eventosNum}
            </strong>
          </p>
          <p className="flex items-center gap-2">
            Média de avaliação: <StarRow value={media_avaliacao} />
          </p>
        </div>

        {/* Ação */}
        <div className="pt-1">
          <button
            onClick={handleVisualizar}
            disabled={!id}
            className={`flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-green-700/40
                       ${!id ? "opacity-60 cursor-not-allowed hover:bg-green-600" : ""}`}
            aria-label={`Ver histórico de ${nome}`}
            aria-disabled={!id || undefined}
            title={!id ? "Indisponível" : "Ver histórico"}
          >
            <Eye size={16} /> Histórico
          </button>
        </div>
      </div>
    </article>
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
