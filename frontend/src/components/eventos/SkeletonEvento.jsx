// ✅ frontend/src/components/eventos/SkeletonEvento.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Skeleton oficial para carregamento de eventos.
//
// Revisão premium:
// - componente específico do domínio eventos;
// - acessível com role="status", aria-busy e aria-live;
// - mobile-first;
// - dark mode;
// - sem CSS inline/keyframes locais;
// - suporte às variações atuais: card | plain | lista;
// - estrutura visual compatível com cards premium de eventos;
// - sem dependência de API, rota, status ou payload;
// - sem aliases de evento/turma.

import PropTypes from "prop-types";

const VARIANTES_ACEITAS = Object.freeze(["card", "plain", "lista"]);

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizarVariant(variant) {
  return VARIANTES_ACEITAS.includes(variant) ? variant : "card";
}

function normalizarLinhas(lines) {
  const value = Number(lines);

  if (!Number.isFinite(value)) return 3;

  return Math.max(1, Math.min(6, Math.trunc(value)));
}

function SkeletonBlock({ className = "" }) {
  return (
    <div
      className={classNames(
        "animate-pulse rounded-2xl bg-slate-200/80 dark:bg-white/10",
        className
      )}
      aria-hidden="true"
    />
  );
}

export default function SkeletonEvento({
  className = "",
  variant = "card",
  lines = 3,
  showActions = true,
  showMedia = false,
  ariaLabel = "Carregando evento",
}) {
  const variantSeguro = normalizarVariant(variant);
  const safeLines = normalizarLinhas(lines);

  const isCard = variantSeguro === "card";
  const isPlain = variantSeguro === "plain";
  const isList = variantSeguro === "lista";

  return (
    <section
      className={classNames(
        isCard &&
          "mx-auto mt-6 max-w-3xl overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/80 shadow-sm ring-1 ring-black/5 dark:border-white/10 dark:bg-slate-900/70 dark:ring-white/10",
        isPlain && "mx-auto mt-6 max-w-3xl",
        isList &&
          "overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70",
        "supports-[backdrop-filter]:backdrop-blur",
        className
      )}
      aria-label={ariaLabel}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <span className="sr-only">
        Carregando informações do evento...
      </span>

      <div
        className={classNames(
          isCard && "p-5 sm:p-6",
          isPlain && "p-0",
          isList && ""
        )}
      >
        {showMedia && (
          <SkeletonBlock className="mb-5 aspect-[16/7] w-full rounded-3xl" />
        )}

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <SkeletonBlock className="h-7 w-24 rounded-full" />
          <SkeletonBlock className="h-5 w-36 rounded-xl" />
          <SkeletonBlock className="h-5 w-28 rounded-xl" />
        </div>

        <SkeletonBlock className="mb-4 h-9 w-4/5 max-w-xl rounded-2xl sm:w-2/3" />

        <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <SkeletonBlock className="h-14" />
          <SkeletonBlock className="h-14" />
          <SkeletonBlock className="h-14" />
        </div>

        <div className="mb-6 space-y-3">
          {Array.from({ length: safeLines }).map((_, index) => (
            <SkeletonBlock
              key={`skeleton-evento-line-${index}`}
              className={classNames(
                "h-4 rounded-xl",
                index === safeLines - 1
                  ? "w-3/4"
                  : index === 1
                    ? "w-11/12"
                    : "w-full"
              )}
            />
          ))}
        </div>

        {showActions && (
          <div className="flex flex-wrap gap-2">
            <SkeletonBlock className="h-11 w-44" />
            <SkeletonBlock className="h-11 w-36" />
            <SkeletonBlock className="h-11 w-28" />
          </div>
        )}
      </div>
    </section>
  );
}

SkeletonBlock.propTypes = {
  className: PropTypes.string,
};

SkeletonEvento.propTypes = {
  className: PropTypes.string,
  variant: PropTypes.oneOf(VARIANTES_ACEITAS),
  lines: PropTypes.number,
  showActions: PropTypes.bool,
  showMedia: PropTypes.bool,
  ariaLabel: PropTypes.string,
};