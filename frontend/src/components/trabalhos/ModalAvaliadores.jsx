// 📁 src/components/trabalhos/ModalAvaliadores.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Modal administrativo de resumo dos avaliadores de trabalhos.
//
// Contrato oficial usado:
// - GET /api/submissao/admin/avaliador/resumo
//
// Função:
// - exibir carga de avaliação por avaliador;
// - mostrar pendências, finalizações e total atribuído;
// - permitir busca e ordenação;
// - apoiar decisão administrativa de distribuição de avaliadores.
//
// Diretrizes v2.0:
// - sem /admin/avaliadores/resumo;
// - sem Modal antigo;
// - sem aliases de compatibilidade;
// - sem fullname/display_name/mail/to_do/done;
// - sem toast direto;
// - layout premium real;
// - mobile-first;
// - acessível;
// - dark mode.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from "lucide-react";

import api from "../../services/api";

/* =========================================================================
   Helpers
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function unwrap(response, fallback = null) {
  if (response && typeof response === "object" && "ok" in response && "data" in response) {
    return response.data ?? fallback;
  }

  if (
    response?.data &&
    typeof response.data === "object" &&
    "ok" in response.data &&
    "data" in response.data
  ) {
    return response.data.data ?? fallback;
  }

  return response?.data ?? response ?? fallback;
}

function getMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function norm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function percent(done, total) {
  const finalizadas = toNumber(done);
  const geral = toNumber(total);

  if (geral <= 0) return 0;

  return Math.max(0, Math.min(100, Math.round((finalizadas / geral) * 100)));
}

function normalizarAvaliador(row) {
  return {
    id: Number(row?.id),
    nome: String(row?.nome || "").trim() || `Avaliador #${row?.id || "—"}`,
    email: String(row?.email || "").trim(),
    pendentes: toNumber(row?.pendentes),
    finalizadas: toNumber(row?.finalizadas),
    total_atribuicoes: toNumber(row?.total_atribuicoes),
  };
}

function normalizarResumo(payload) {
  const data = unwrap(payload, payload);

  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.avaliadores)
      ? data.avaliadores
      : Array.isArray(data?.itens)
        ? data.itens
        : Array.isArray(data?.rows)
          ? data.rows
          : [];

  return rows
    .map(normalizarAvaliador)
    .filter((item) => Number.isInteger(item.id) && item.id > 0)
    .map((item) => {
      const total =
        item.total_atribuicoes > 0
          ? item.total_atribuicoes
          : item.pendentes + item.finalizadas;

      return {
        ...item,
        total_atribuicoes: total,
        percentual: percent(item.finalizadas, total),
      };
    });
}

async function fetchResumoAvaliadores() {
  return normalizarResumo(await api.get("/submissao/admin/avaliador/resumo"));
}

/* =========================================================================
   UI
=========================================================================== */

function Button({
  children,
  icon: Icon,
  tone = "slate",
  loading = false,
  className = "",
  ...props
}) {
  const tones = {
    primary:
      "bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700 text-white shadow-lg shadow-emerald-900/20 hover:brightness-110",
    slate:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
    ghost:
      "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  };

  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
        "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-60",
        tones[tone],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="h-4 w-4" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}

function Badge({ children, tone = "slate", icon: Icon }) {
  const tones = {
    slate:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    cyan:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200",
    rose:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center justify-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold",
        tones[tone] || tones.slate
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

function MiniStat({ icon: Icon, label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 dark:border-slate-800",
    emerald: "border-emerald-200 dark:border-emerald-900/50",
    amber: "border-amber-200 dark:border-amber-900/50",
    cyan: "border-cyan-200 dark:border-cyan-900/50",
  };

  return (
    <div
      className={cx(
        "rounded-3xl border bg-white p-4 shadow-sm dark:bg-slate-900/70",
        tones[tone] || tones.slate
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function SortButton({ label, sortKey, currentSort, onSort }) {
  const active = currentSort.key === sortKey;
  const dir = currentSort.dir;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wide"
      title={`Ordenar por ${label}`}
    >
      <span>{label}</span>
      {!active ? <ArrowUpDown className="h-3.5 w-3.5 opacity-70" /> : null}
      {active && dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : null}
      {active && dir === "desc" ? <ArrowDown className="h-3.5 w-3.5" /> : null}
    </button>
  );
}

function ProgressBar({ value }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-600 transition-all"
          style={{ width: `${safe}%` }}
        />
      </div>

      <span className="w-12 text-right text-xs font-black text-slate-700 dark:text-slate-200">
        {safe}%
      </span>
    </div>
  );
}

/* =========================================================================
   Component
=========================================================================== */

export default function ModalAvaliadores({ isOpen, open, onClose }) {
  const modalOpen = Boolean(isOpen ?? open);

  const titleId = useId();
  const descId = useId();

  const closeRef = useRef(null);
  const searchRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState("");
  const [sort, setSort] = useState({
    key: "pendentes",
    dir: "desc",
  });

  const carregar = useCallback(async () => {
    if (!modalOpen) return;

    setLoading(true);
    setErro("");

    try {
      const rows = await fetchResumoAvaliadores();
      setLista(rows);
    } catch (error) {
      setErro(
        getMessage(
          error,
          "Não foi possível carregar o resumo dos avaliadores."
        )
      );
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, [modalOpen]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!modalOpen) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }

      const typing = ["input", "textarea", "select"].includes(
        document.activeElement?.tagName?.toLowerCase()
      );

      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus?.();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    window.setTimeout(() => closeRef.current?.focus?.(), 80);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modalOpen, onClose]);

  const filtrada = useMemo(() => {
    const term = norm(busca);

    let rows = lista.filter((item) => {
      if (!term) return true;

      return `${item.nome} ${item.email}`.toLowerCase().includes(term);
    });

    const dir = sort.dir === "asc" ? 1 : -1;

    rows = [...rows].sort((a, b) => {
      const key = sort.key;

      if (key === "nome" || key === "email") {
        return String(a[key] || "").localeCompare(String(b[key] || ""), "pt-BR", {
          sensitivity: "base",
        }) * dir;
      }

      return (toNumber(a[key]) - toNumber(b[key])) * dir;
    });

    return rows;
  }, [lista, busca, sort]);

  const totais = useMemo(() => {
    const qtd = filtrada.length;
    const pendentes = filtrada.reduce((sum, item) => sum + toNumber(item.pendentes), 0);
    const finalizadas = filtrada.reduce(
      (sum, item) => sum + toNumber(item.finalizadas),
      0
    );
    const total = filtrada.reduce(
      (sum, item) => sum + toNumber(item.total_atribuicoes),
      0
    );

    return {
      qtd,
      pendentes,
      finalizadas,
      total,
      percentual: percent(finalizadas, total),
    };
  }, [filtrada]);

  function toggleSort(key) {
    setSort((current) => {
      if (current.key === key) {
        return {
          key,
          dir: current.dir === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        dir: key === "nome" || key === "email" ? "asc" : "desc",
      };
    });
  }

  if (!modalOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950 sm:h-[92dvh] sm:rounded-[2rem] sm:border sm:border-white/20"          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.98 }}
          transition={{ duration: 0.18 }}
        >
          <header className="relative overflow-hidden border-b border-white/10 bg-slate-950 p-5 text-white sm:p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,.30),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(20,184,166,.25),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(14,165,233,.20),transparent_35%)]" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge tone="emerald" icon={ShieldCheck}>
                    Resumo administrativo
                  </Badge>
                  <Badge tone="cyan" icon={Users}>
                    Avaliadores
                  </Badge>
                </div>

                <h3
                  id={titleId}
                  className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl"
                >
                  <UserCheck className="h-5 w-5" aria-hidden="true" />
                  Avaliadores — resumo de carga
                </h3>

                <p id={descId} className="mt-2 max-w-4xl text-sm leading-relaxed text-white/75">
                  Consulte a distribuição de trabalhos por avaliador para equilibrar pendências,
                  acompanhar finalizações e apoiar novas atribuições.
                </p>

                <div className="relative mt-4 max-w-xl">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
                  <input
                    ref={searchRef}
                    value={busca}
                    onChange={(event) => setBusca(event.target.value)}
                    placeholder="Buscar por nome ou e-mail..."
                    className="h-12 w-full rounded-2xl border border-white/15 bg-white/10 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/60 focus:ring-2 focus:ring-emerald-300"
                    aria-label="Buscar avaliador"
                  />
                </div>
              </div>

              <button
                type="button"
                ref={closeRef}
                onClick={onClose}
                className="rounded-2xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                aria-label="Fechar resumo dos avaliadores"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div aria-live="polite" className="sr-only">
            {loading ? "Carregando avaliadores." : erro ? erro : "Resumo carregado."}
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <MiniStat icon={Users} label="Avaliadores" value={totais.qtd} tone="cyan" />
              <MiniStat icon={AlertCircle} label="Pendentes" value={totais.pendentes} tone="amber" />
              <MiniStat icon={CheckCircle2} label="Finalizadas" value={totais.finalizadas} tone="emerald" />
              <MiniStat icon={BarChart3} label="Total" value={totais.total} tone="slate" />
              <MiniStat icon={TrendingUp} label="Progresso" value={`${totais.percentual}%`} tone="emerald" />
            </div>

            {erro ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                <div className="flex gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                  <span>{erro}</span>
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
                <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Carregando resumo dos avaliadores...
                </p>
              </div>
            ) : !erro && filtrada.length === 0 ? (
              <div className="mt-6 rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                Nenhum avaliador encontrado.
              </div>
            ) : !erro ? (
              <>
                <div className="mt-6 hidden overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:block">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                      <caption className="sr-only">
                        Resumo de carga dos avaliadores
                      </caption>

                      <thead className="bg-slate-950 text-white">
                        <tr>
                          <th className="p-4 text-left">
                            <SortButton
                              label="Nome"
                              sortKey="nome"
                              currentSort={sort}
                              onSort={toggleSort}
                            />
                          </th>
                          <th className="p-4 text-left">
                            <SortButton
                              label="E-mail"
                              sortKey="email"
                              currentSort={sort}
                              onSort={toggleSort}
                            />
                          </th>
                          <th className="p-4 text-center">
                            <SortButton
                              label="Pendentes"
                              sortKey="pendentes"
                              currentSort={sort}
                              onSort={toggleSort}
                            />
                          </th>
                          <th className="p-4 text-center">
                            <SortButton
                              label="Finalizadas"
                              sortKey="finalizadas"
                              currentSort={sort}
                              onSort={toggleSort}
                            />
                          </th>
                          <th className="p-4 text-center">
                            <SortButton
                              label="Total"
                              sortKey="total_atribuicoes"
                              currentSort={sort}
                              onSort={toggleSort}
                            />
                          </th>
                          <th className="p-4 text-center">
                            <SortButton
                              label="Progresso"
                              sortKey="percentual"
                              currentSort={sort}
                              onSort={toggleSort}
                            />
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {filtrada.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-slate-100 transition hover:bg-emerald-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                          >
                            <td className="p-4 align-top">
                              <p className="font-black text-slate-900 dark:text-white">
                                {item.nome}
                              </p>
                            </td>

                            <td className="p-4 align-top text-slate-600 dark:text-slate-300">
                              {item.email || "—"}
                            </td>

                            <td className="p-4 text-center align-top">
                              <Badge tone={item.pendentes > 0 ? "amber" : "slate"}>
                                {item.pendentes}
                              </Badge>
                            </td>

                            <td className="p-4 text-center align-top">
                              <Badge tone="emerald">
                                {item.finalizadas}
                              </Badge>
                            </td>

                            <td className="p-4 text-center align-top">
                              <Badge tone="slate">
                                {item.total_atribuicoes}
                              </Badge>
                            </td>

                            <td className="p-4 align-top">
                              <ProgressBar value={item.percentual} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 lg:hidden">
                  {filtrada.map((item) => (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

                      <div className="space-y-4 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="truncate font-black text-slate-900 dark:text-white">
                              {item.nome}
                            </h4>
                            <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                              {item.email || "E-mail não informado"}
                            </p>
                          </div>

                          <Badge tone={item.pendentes > 0 ? "amber" : "emerald"}>
                            {item.percentual}%
                          </Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <MobileStat label="Pendentes" value={item.pendentes} tone="amber" />
                          <MobileStat label="Finalizadas" value={item.finalizadas} tone="emerald" />
                          <MobileStat label="Total" value={item.total_atribuicoes} tone="slate" />
                        </div>

                        <ProgressBar value={item.percentual} />
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-end">
            <Button tone="ghost" onClick={onClose}>
              Fechar
            </Button>
            <Button tone="slate" icon={RefreshCw} loading={loading} onClick={carregar}>
              Recarregar
            </Button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function MobileStat({ label, value, tone = "slate" }) {
  const tones = {
    slate:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
  };

  return (
    <div className={cx("rounded-2xl border p-3 text-center", tones[tone] || tones.slate)}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

ModalAvaliadores.propTypes = {
  isOpen: PropTypes.bool,
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
};