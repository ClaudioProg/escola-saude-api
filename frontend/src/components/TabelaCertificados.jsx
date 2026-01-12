// 📁 src/components/TabelaCertificados.jsx
import PropTypes from "prop-types";
import { FileText, RotateCw, Loader2, BadgeCheck, BadgeX, Clock3 } from "lucide-react";
import { useMemo, useState, useCallback } from "react";

function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

export default function TabelaCertificados({
  dados = [],
  onRevalidar,
  onDownload,
  className = "",
  loading = false,
  caption = "Lista de certificados emitidos",
  showCaption = false,
}) {
  const [busyId, setBusyId] = useState(null);

  const linhas = useMemo(() => (Array.isArray(dados) ? dados : []), [dados]);
  const vazio = !loading && linhas.length === 0;

  const busyKey = busyId == null ? null : String(busyId);

  const handleDownload = useCallback(
    async (id) => {
      if (!id || typeof onDownload !== "function") return;
      try {
        setBusyId(String(id));
        await Promise.resolve(onDownload(id));
      } finally {
        setBusyId(null);
      }
    },
    [onDownload]
  );

  const handleRevalidar = useCallback(
    async (c) => {
      if (!c?.id || c?.canRevalidate === false || typeof onRevalidar !== "function") return;
      try {
        setBusyId(String(c.id));
        await Promise.resolve(onRevalidar(c.id));
      } finally {
        setBusyId(null);
      }
    },
    [onRevalidar]
  );

  if (vazio) {
    return (
      <div className={cx("mt-4 rounded-2xl border p-4 text-center", "border-zinc-200 bg-white/70 dark:border-white/10 dark:bg-zinc-900/40", className)}>
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200" aria-live="polite">
          📭 Nenhum certificado emitido encontrado.
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Assim que houver emissão, eles aparecerão aqui para download e revalidação (quando disponível).
        </p>
      </div>
    );
  }

  return (
    <section
      className={cx(
        "mt-4 rounded-3xl border overflow-hidden",
        "border-zinc-200 bg-white/70 shadow-[0_18px_55px_-40px_rgba(2,6,23,0.18)] ring-1 ring-black/5",
        "dark:border-white/10 dark:bg-zinc-900/45 dark:ring-white/10",
        "supports-[backdrop-filter]:backdrop-blur",
        className
      )}
      aria-label={caption}
    >
      {/* Header utilitário (caption + count) */}
      <div className={cx("px-4 py-3 border-b", "border-zinc-200/80 bg-zinc-50/60 dark:border-white/10 dark:bg-zinc-950/25")}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {showCaption ? (
              <div className="text-sm font-extrabold text-zinc-900 dark:text-white truncate">{caption}</div>
            ) : (
              <div className="sr-only">{caption}</div>
            )}
            <div className="text-[12px] text-zinc-500 dark:text-zinc-400" aria-live="polite">
              {loading ? "Carregando certificados..." : `${linhas.length} certificado(s)`}
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE (cards) */}
      <div className="sm:hidden p-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={`skm-${i}`} />
            ))}
          </div>
        ) : (
          <ul className="space-y-3" role="list" aria-label="Certificados (modo mobile)">
            {linhas.map((c, idx) => {
              const key =
                c.id ??
                c.codigo ??
                `${c.cpf ?? "sem-cpf"}-${c.turma_id ?? "sem-turma"}-${c.emitido_em ?? idx}`;
              const idStr = c?.id != null ? String(c.id) : "";
              const isBusy = !!idStr && busyKey === idStr;

              return (
                <li
                  key={key}
                  role="listitem"
                  className={cx(
                    "rounded-2xl border p-3",
                    "border-zinc-200 bg-white shadow-sm",
                    "dark:border-white/10 dark:bg-zinc-900/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-zinc-900 dark:text-white truncate">
                        {c.nome || "—"}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        CPF: <span className="font-mono tabular-nums">{formatCpf(c.cpf)}</span>
                      </div>
                    </div>
                    {statusBadgePill(c.status)}
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-zinc-700 dark:text-zinc-200">
                    <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                      <div className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Evento
                      </div>
                      <div className="mt-0.5 font-semibold break-words">{c.evento || "—"}</div>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1 rounded-xl border border-zinc-200/70 bg-zinc-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                        <div className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Emissão
                        </div>
                        <div className="mt-0.5 font-mono tabular-nums">{formatarData(c.emitido_em)}</div>
                      </div>
                      <div className="flex-1 rounded-xl border border-zinc-200/70 bg-zinc-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                        <div className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Status
                        </div>
                        <div className="mt-0.5 font-semibold">{statusText(c.status)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionButton
                      onClick={() => handleDownload(c.id)}
                      title="Baixar PDF"
                      ariaLabel={`Baixar certificado de ${c.nome ?? "usuário"}`}
                      disabled={!c?.id || isBusy}
                      variant="primary"
                      loading={isBusy}
                      icon={FileText}
                    >
                      Baixar
                    </ActionButton>

                    <ActionButton
                      onClick={() => handleRevalidar(c)}
                      title={c.canRevalidate === false ? "Revalidação indisponível" : "Revalidar"}
                      ariaLabel={`Revalidar certificado de ${c.nome ?? "usuário"}`}
                      disabled={c.canRevalidate === false || !c?.id || isBusy}
                      variant="neutral"
                      loading={isBusy}
                      icon={RotateCw}
                    >
                      Revalidar
                    </ActionButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* DESKTOP (tabela) */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full text-sm text-left border-collapse" role="table" aria-label={caption}>
          {!showCaption ? <caption className="sr-only">{caption}</caption> : null}

          <colgroup>
            <col />
            <col className="w-40" />
            <col />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-40" />
          </colgroup>

          <thead className="bg-zinc-950 text-white sticky top-0 z-10">
            <tr>
              <Th>Nome</Th>
              <Th>CPF</Th>
              <Th>Evento</Th>
              <Th>Emissão</Th>
              <Th>Status</Th>
              <Th>Ações</Th>
            </tr>
          </thead>

          <tbody className="bg-white dark:bg-zinc-900/40 text-zinc-900 dark:text-zinc-100">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={`sk-${i}`} />)
              : linhas.map((c, idx) => {
                  const key =
                    c.id ??
                    c.codigo ??
                    `${c.cpf ?? "sem-cpf"}-${c.turma_id ?? "sem-turma"}-${c.emitido_em ?? idx}`;

                  const idStr = c?.id != null ? String(c.id) : "";
                  const isBusy = !!idStr && busyKey === idStr;

                  return (
                    <tr
                      key={key}
                      className={cx(
                        "border-t border-zinc-100 dark:border-white/10 transition-colors",
                        "hover:bg-zinc-50/70 dark:hover:bg-white/5"
                      )}
                    >
                      <Td>{c.nome || "—"}</Td>
                      <Td mono>{formatCpf(c.cpf)}</Td>
                      <Td>{c.evento || "—"}</Td>
                      <Td mono>{formatarData(c.emitido_em)}</Td>
                      <Td>{statusBadgePill(c.status)}</Td>
                      <Td>
                        <div className="flex gap-2 items-center">
                          <IconButton
                            onClick={() => handleDownload(c.id)}
                            label={`Baixar certificado de ${c.nome ?? "usuário"}`}
                            title="Baixar PDF"
                            disabled={!c?.id || isBusy}
                            busy={isBusy}
                          >
                            {isBusy ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <FileText size={18} />}
                          </IconButton>

                          <IconButton
                            onClick={() => handleRevalidar(c)}
                            label={`Revalidar certificado de ${c.nome ?? "usuário"}`}
                            title={c.canRevalidate === false ? "Revalidação indisponível" : "Revalidar"}
                            disabled={c.canRevalidate === false || !c?.id || isBusy}
                            busy={isBusy}
                          >
                            {isBusy ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <RotateCw size={18} />}
                          </IconButton>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ===== Subcomponentes ===== */
function Th({ children, className = "" }) {
  return (
    <th
      className={cx("px-4 py-3 font-extrabold whitespace-nowrap border-b border-white/15", className)}
      scope="col"
    >
      {children}
    </th>
  );
}

function Td({ children, mono = false, className = "" }) {
  return (
    <td
      className={cx(
        "px-4 py-3 align-middle border-b border-zinc-100 dark:border-white/10",
        mono ? "font-mono tabular-nums" : "",
        className
      )}
    >
      {children}
    </td>
  );
}

function IconButton({ children, onClick, label, title, disabled, busy }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-disabled={disabled || undefined}
      title={title}
      className={cx(
        "inline-flex items-center justify-center rounded-xl border px-2.5 py-2 transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60",
        disabled
          ? "border-zinc-200 text-zinc-400 cursor-not-allowed dark:border-white/10 dark:text-zinc-500"
          : "border-zinc-200 text-zinc-900 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/10",
        busy ? "opacity-90" : ""
      )}
    >
      {children}
    </button>
  );
}

function ActionButton({ children, onClick, ariaLabel, title, disabled, variant = "primary", loading, icon: Icon }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-extrabold transition " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60";

  const styles =
    variant === "primary"
      ? "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300"
      : "bg-zinc-900 text-white hover:bg-zinc-950 disabled:bg-zinc-500 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      className={cx(base, styles, disabled ? "cursor-not-allowed opacity-80" : "")}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
      {children}
    </button>
  );
}

/* ===== Skeletons ===== */
function SkeletonRow() {
  return (
    <tr className="border-t border-zinc-100 dark:border-white/10">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 w-4/5 bg-zinc-200/70 dark:bg-white/10 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-white/10 p-3 bg-white dark:bg-zinc-900/40">
      <div className="flex items-start justify-between gap-3">
        <div className="h-4 w-40 rounded bg-zinc-200/70 dark:bg-white/10 animate-pulse" />
        <div className="h-6 w-20 rounded-full bg-zinc-200/60 dark:bg-white/10 animate-pulse" />
      </div>
      <div className="mt-2 h-3 w-44 rounded bg-zinc-200/60 dark:bg-white/10 animate-pulse" />
      <div className="mt-3 grid gap-2">
        <div className="h-12 rounded-xl bg-zinc-100/80 dark:bg-white/5 animate-pulse" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-12 rounded-xl bg-zinc-100/80 dark:bg-white/5 animate-pulse" />
          <div className="h-12 rounded-xl bg-zinc-100/80 dark:bg-white/5 animate-pulse" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <div className="h-10 w-28 rounded-2xl bg-zinc-200/60 dark:bg-white/10 animate-pulse" />
        <div className="h-10 w-28 rounded-2xl bg-zinc-200/60 dark:bg-white/10 animate-pulse" />
      </div>
    </div>
  );
}

/* ===== Utilitários ===== */
function formatCpf(cpf) {
  if (!cpf) return "—";
  const onlyDigits = String(cpf).replace(/\D/g, "");
  if (onlyDigits.length !== 11) return String(cpf);
  return onlyDigits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

/** Evita Date parsing para "YYYY-MM-DD" (política do projeto) */
function formatarData(dataISO) {
  if (!dataISO || typeof dataISO !== "string") return "—";
  const soData = dataISO.includes("T") ? dataISO.split("T")[0] : dataISO;
  const m = soData.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dataISO;
  const [, ano, mes, dia] = m;
  return `${dia}/${mes}/${ano}`;
}

function statusText(statusRaw) {
  const s = (statusRaw || "").toString().toLowerCase();
  if (s === "valido" || s === "válido") return "Válido";
  if (s === "expirado") return "Expirado";
  if (s === "revogado") return "Revogado";
  if (s === "pendente") return "Pendente";
  return statusRaw || "—";
}

/* Badge seguindo padrão premium (pill + ícone) */
function statusBadgePill(statusRaw) {
  const s = (statusRaw || "").toString().toLowerCase();

  const map = {
    valido: {
      text: "Válido",
      cls: "bg-emerald-500/12 text-emerald-900 ring-1 ring-emerald-700/20 dark:bg-emerald-400/10 dark:text-emerald-100 dark:ring-emerald-300/20",
      Icon: BadgeCheck,
      icon: "text-emerald-700 dark:text-emerald-300",
    },
    válido: {
      text: "Válido",
      cls: "bg-emerald-500/12 text-emerald-900 ring-1 ring-emerald-700/20 dark:bg-emerald-400/10 dark:text-emerald-100 dark:ring-emerald-300/20",
      Icon: BadgeCheck,
      icon: "text-emerald-700 dark:text-emerald-300",
    },
    expirado: {
      text: "Expirado",
      cls: "bg-rose-500/12 text-rose-900 ring-1 ring-rose-700/20 dark:bg-rose-400/10 dark:text-rose-100 dark:ring-rose-300/20",
      Icon: BadgeX,
      icon: "text-rose-700 dark:text-rose-300",
    },
    revogado: {
      text: "Revogado",
      cls: "bg-rose-500/12 text-rose-900 ring-1 ring-rose-700/20 dark:bg-rose-400/10 dark:text-rose-100 dark:ring-rose-300/20",
      Icon: BadgeX,
      icon: "text-rose-700 dark:text-rose-300",
    },
    pendente: {
      text: "Pendente",
      cls: "bg-amber-500/14 text-amber-950 ring-1 ring-amber-700/20 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-300/20",
      Icon: Clock3,
      icon: "text-amber-700 dark:text-amber-300",
    },
  };

  const def = map[s] || {
    text: statusRaw || "—",
    cls: "bg-zinc-200/70 text-zinc-900 ring-1 ring-black/10 dark:bg-white/10 dark:text-zinc-100 dark:ring-white/15",
    Icon: Clock3,
    icon: "text-zinc-700 dark:text-zinc-200",
  };

  const I = def.Icon;

  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold", def.cls)} title={def.text}>
      <I className={cx("h-4 w-4", def.icon)} aria-hidden="true" />
      {def.text}
    </span>
  );
}

/* ===== PropTypes ===== */
TabelaCertificados.propTypes = {
  dados: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      nome: PropTypes.string,
      cpf: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      evento: PropTypes.string,
      emitido_em: PropTypes.string,
      status: PropTypes.string,
      turma_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      canRevalidate: PropTypes.bool,
      codigo: PropTypes.string,
    })
  ).isRequired,
  onRevalidar: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  className: PropTypes.string,
  loading: PropTypes.bool,
  caption: PropTypes.string,
  showCaption: PropTypes.bool,
};
