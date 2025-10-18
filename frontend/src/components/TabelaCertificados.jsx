// 📁 src/components/TabelaCertificados.jsx
import PropTypes from "prop-types";
import { FileText, RotateCw } from "lucide-react";
import { useMemo, useState } from "react";

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

  if (vazio) {
    return (
      <p
        className="text-center text-gray-500 dark:text-gray-300 py-4"
        aria-live="polite"
      >
        📭 Nenhum certificado emitido encontrado.
      </p>
    );
  }

  const handleDownload = async (id) => {
    if (!id || typeof onDownload !== "function") return;
    try {
      setBusyId(id);
      await Promise.resolve(onDownload(id));
    } finally {
      setBusyId(null);
    }
  };

  const handleRevalidar = async (c) => {
    if (!c?.id || c?.canRevalidate === false || typeof onRevalidar !== "function") return;
    try {
      setBusyId(c.id);
      await Promise.resolve(onRevalidar(c.id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className={`overflow-x-auto rounded-md shadow border border-gray-200 dark:border-gray-700 mt-4 ${className}`}
    >
      <table
        className="min-w-full text-sm text-left border-collapse"
        role="table"
        aria-label={caption}
      >
        {showCaption ? (
          <caption className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">
            {caption}
          </caption>
        ) : (
          <caption className="sr-only">{caption}</caption>
        )}

        <colgroup>
          <col /> {/* Nome */}
          <col className="w-40 sm:w-40" /> {/* CPF */}
          <col /> {/* Evento */}
          <col className="w-28 sm:w-28" /> {/* Emissão */}
          <col className="w-28 sm:w-28" /> {/* Status */}
          <col className="w-28 sm:w-28" /> {/* Ações */}
        </colgroup>

        <thead className="bg-lousa text-white sticky top-0 z-10">
          <tr>
            <Th>Nome</Th>
            <Th className="hidden sm:table-cell">CPF</Th>
            <Th>Evento</Th>
            <Th className="hidden sm:table-cell">Emissão</Th>
            <Th className="hidden sm:table-cell">Status</Th>
            <Th>Ações</Th>
          </tr>
        </thead>

        <tbody className="bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-100">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={`sk-${i}`} />)
            : linhas.map((c, idx) => {
                const key =
                  c.id ??
                  c.codigo ??
                  `${c.cpf ?? "sem-cpf"}-${c.turma_id ?? "sem-turma"}-${c.emitido_em ?? idx}`;
                const isBusy = busyId === c.id;

                return (
                  <tr
                    key={key}
                    className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-zinc-700 transition"
                  >
                    <Td>{c.nome || "—"}</Td>
                    <Td mono className="hidden sm:table-cell">
                      {formatCpf(c.cpf)}
                    </Td>
                    <Td>{c.evento || "—"}</Td>
                    <Td mono className="hidden sm:table-cell">
                      {formatarData(c.emitido_em)}
                    </Td>
                    <Td className="hidden sm:table-cell">{statusBadge(c.status)}</Td>

                    <Td>
                      <div className="flex gap-3 items-center">
                        <IconButton
                          onClick={() => handleDownload(c.id)}
                          label={`Baixar certificado de ${c.nome ?? "usuário"}`}
                          title="Baixar PDF"
                          disabled={!c?.id || isBusy}
                        >
                          <FileText size={18} />
                        </IconButton>

                        <IconButton
                          onClick={() => handleRevalidar(c)}
                          label={`Revalidar certificado de ${c.nome ?? "usuário"}`}
                          title={
                            c.canRevalidate === false
                              ? "Revalidação indisponível"
                              : "Revalidar"
                          }
                          disabled={c.canRevalidate === false || !c?.id || isBusy}
                        >
                          <RotateCw size={18} />
                        </IconButton>
                      </div>

                      {/* Em telas muito pequenas, mostramos status/emitido abaixo como meta-info */}
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-300 sm:hidden">
                        <span className="mr-2">Emissão: {formatarData(c.emitido_em)}</span>
                        <span>• {statusText(c.status)}</span>
                      </div>
                    </Td>
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
}

/* ===== Subcomponentes semânticos ===== */
function Th({ children, className = "" }) {
  return (
    <th
      className={`px-4 py-2 font-semibold whitespace-nowrap border-b border-white/20 ${className}`}
      scope="col"
    >
      {children}
    </th>
  );
}
function Td({ children, mono = false, className = "" }) {
  return (
    <td
      className={[
        "px-4 py-2 align-middle border-b border-gray-100 dark:border-gray-700",
        mono ? "font-mono tabular-nums" : "",
        className,
      ].join(" ")}
    >
      {children}
    </td>
  );
}

function IconButton({ children, onClick, label, title, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-disabled={disabled || undefined}
      title={title}
      className={[
        "text-lousa hover:text-lime-600 focus:outline-none focus:ring-2 focus:ring-green-700/40 rounded",
        disabled ? "text-gray-400 cursor-not-allowed hover:text-gray-400" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ===== Skeleton row ===== */
function SkeletonRow() {
  return (
    <tr className="border-t border-gray-100 dark:border-gray-700">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 w-4/5 bg-gray-200/70 dark:bg-zinc-700/70 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

/* ===== Utilitários ===== */
function formatCpf(cpf) {
  if (!cpf) return "—";
  const onlyDigits = String(cpf).replace(/\D/g, "");
  if (onlyDigits.length !== 11) return cpf;
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

/* Badge seguindo o padrão de cores (verde/amarelo/vermelho) */
function statusBadge(statusRaw) {
  const s = (statusRaw || "").toString().toLowerCase();
  const map = {
    valido: {
      text: "Válido",
      cls: "bg-green-100 text-green-800 dark:bg-green-600/30 dark:text-green-300",
    },
    válido: {
      text: "Válido",
      cls: "bg-green-100 text-green-800 dark:bg-green-600/30 dark:text-green-300",
    },
    expirado: {
      text: "Expirado",
      cls: "bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300",
    },
    revogado: {
      text: "Revogado",
      cls: "bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300",
    },
    pendente: {
      text: "Pendente",
      cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-600/30 dark:text-yellow-200",
    },
  };
  const def = map[s] || {
    text: statusRaw || "—",
    cls: "bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-gray-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${def.cls}`}>
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
      emitido_em: PropTypes.string, // ISO ou "YYYY-MM-DD"
      status: PropTypes.string, // "válido" | "expirado" | "pendente" | ...
      turma_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      canRevalidate: PropTypes.bool,
      codigo: PropTypes.string,
    })
  ).isRequired,
  onRevalidar: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  className: PropTypes.string,
  /** exibe linhas de carregamento */
  loading: PropTypes.bool,
  /** caption acessível (visível se showCaption=true) */
  caption: PropTypes.string,
  showCaption: PropTypes.bool,
};
