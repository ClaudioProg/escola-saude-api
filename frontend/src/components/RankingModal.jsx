// 📁 src/components/RankingModal.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy, Loader2, CheckCircle, XCircle, CalendarDays, Search, Filter } from "lucide-react";
import { toast } from "react-toastify";
import api from "../services/api";

/* ───────────────── Utils ───────────────── */
const fmt = (v, alt = "—") => (v === 0 || !!v ? String(v) : alt);
const fmtNum = (v, d = 1) => Number(v ?? 0).toFixed(d);
const isReprovado = (s) => String(s?.status || "").toLowerCase() === "reprovado";

function hasAprovExposicao(s) {
  const escrita = String(s?.status_escrita ?? "").toLowerCase();
  const global = String(s?.status ?? "").toLowerCase();
  return escrita === "aprovado" || global === "aprovado_exposicao" || Boolean(s?._exposicao_aprovada);
}
function hasAprovOral(s) {
  const oral = String(s?.status_oral ?? "").toLowerCase();
  const global = String(s?.status ?? "").toLowerCase();
  return oral === "aprovado" || global === "aprovado_oral" || Boolean(s?._oral_aprovada);
}

function normalizarStatusPrincipal(raw) {
  const st = String(raw || "").toLowerCase();
  if (st === "rascunho") return "rascunho";
  if (st === "submetido") return "submetido";
  if (st === "em_avaliacao") return "em avaliação";
  if (["aprovado", "aprovado_exposicao", "aprovado_oral", "aprovado_escrita"].includes(st)) return "aprovado";
  if (st === "reprovado") return "reprovado";
  return st || "—";
}

function StatusBadge({ status }) {
  const label = normalizarStatusPrincipal(status);
  const base =
    "px-2 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 justify-center whitespace-nowrap ring-1";
  switch (label) {
    case "rascunho":
      return (
        <span className={`${base} bg-zinc-100 text-zinc-700 ring-black/5 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-white/10`}>
          Rascunho
        </span>
      );
    case "submetido":
      return <span className={`${base} bg-blue-100 text-blue-700 ring-blue-200/70`}>Submetido</span>;
    case "em avaliação":
      return <span className={`${base} bg-amber-100 text-amber-800 ring-amber-200/70`}>Em avaliação</span>;
    case "aprovado":
      return <span className={`${base} bg-emerald-100 text-emerald-800 ring-emerald-200/70`}>Aprovado</span>;
    case "reprovado":
      return <span className={`${base} bg-rose-100 text-rose-800 ring-rose-200/70`}>Reprovado</span>;
    default:
      return (
        <span className={`${base} bg-zinc-100 text-zinc-700 ring-black/5 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-white/10`}>
          {label}
        </span>
      );
  }
}

/* Focus trap simples (sem libs) */
function useFocusTrap(open, dialogRef, onClose) {
  useEffect(() => {
    if (!open) return;

    const el = dialogRef.current;
    if (!el) return;

    const focusables = () =>
      Array.from(
        el.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((n) => !n.hasAttribute("disabled") && !n.getAttribute("aria-hidden"));

    const firstFocus = () => focusables()[0]?.focus?.();

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;

      const nodes = focusables();
      if (!nodes.length) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    // foco inicial
    setTimeout(firstFocus, 0);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, dialogRef, onClose]);
}

/* ───────────────── Component ───────────────── */
export default function RankingModal({ open, onClose, itens = [], onStatusChange }) {
  const dialogRef = useRef(null);
  const overlayRef = useRef(null);

  const [busca, setBusca] = useState("");
  const [filtroChamada, setFiltroChamada] = useState("__all__");
  const [filtroLinha, setFiltroLinha] = useState("__all__");

  const [workingExpoId, setWorkingExpoId] = useState(null);
  const [workingOralId, setWorkingOralId] = useState(null);
  const [workingReprovarId, setWorkingReprovarId] = useState(null);

  const [a11yMsg, setA11yMsg] = useState("");

  // trava scroll do body quando modal abre
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [open]);

  // focus trap + ESC
  useFocusTrap(open, dialogRef, onClose);

  // reset leve quando fecha
  useEffect(() => {
    if (open) return;
    setBusca("");
    setFiltroChamada("__all__");
    setFiltroLinha("__all__");
    setWorkingExpoId(null);
    setWorkingOralId(null);
    setWorkingReprovarId(null);
    setA11yMsg("");
  }, [open]);

  /* Nota média com fallbacks */
  const lerNota = useCallback((s) => {
    const nm = Number(s?.nota_media);
    if (!Number.isNaN(nm)) return nm;

    const tg = Number(s?.total_geral);
    if (!Number.isNaN(tg)) return tg / 4;

    const te = Number(s?.total_escrita);
    const to = Number(s?.total_oral);
    if (!Number.isNaN(te) || !Number.isNaN(to)) {
      const soma = (Number.isNaN(te) ? 0 : te) + (Number.isNaN(to) ? 0 : to);
      return soma / 4;
    }
    return 0;
  }, []);

  /* Base SEM reprovados */
  const base = useMemo(() => (Array.isArray(itens) ? itens.filter((s) => !isReprovado(s)) : []), [itens]);

  /* Opções de filtros */
  const opcaoChamadas = useMemo(() => {
    const mapa = new Map();
    for (const s of base) {
      const nome = (s?.chamada_titulo || "").trim();
      if (nome) mapa.set(nome, nome);
    }
    const arr = Array.from(mapa.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return [{ value: "__all__", label: "Todas as chamadas" }, ...arr.map((v) => ({ value: v, label: v }))];
  }, [base]);

  const opcaoLinha = useMemo(() => {
    const mapa = new Map();
    for (const s of base) {
      const nome = (s?.linha_tematica_nome || "").trim();
      const chamada = (s?.chamada_titulo || "").trim();
      if (!nome) continue;
      if (filtroChamada !== "__all__" && chamada !== filtroChamada) continue;
      mapa.set(nome, nome);
    }
    const arr = Array.from(mapa.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return [{ value: "__all__", label: "Todas as linhas" }, ...arr.map((v) => ({ value: v, label: v }))];
  }, [base, filtroChamada]);

  /* Ordenação + rank */
  const ordenados = useMemo(() => {
    const term = busca.trim().toLowerCase();
    const filtered = [];

    for (const s of base) {
      const atendeBusca =
        !term ||
        [s.titulo, s.autor_nome, s.autor_email, s.chamada_titulo, s.linha_tematica_nome]
          .map((v) => (v ? String(v).toLowerCase() : ""))
          .some((t) => t.includes(term));

      const atendeChamada = filtroChamada === "__all__" || (s.chamada_titulo || "").trim() === filtroChamada;
      const atendeLinha = filtroLinha === "__all__" || (s.linha_tematica_nome || "").trim() === filtroLinha;

      if (atendeBusca && atendeChamada && atendeLinha) {
        filtered.push({ ...s, _nota: lerNota(s) });
      }
    }

    filtered.sort((a, b) => b._nota - a._nota || a.id - b.id);

    return filtered.map((s, i) => ({ ...s, _rank: i + 1 }));
  }, [base, busca, filtroChamada, filtroLinha, lerNota]);

  const total = ordenados.length;

  /* ───────────── Ações (com toasts/erros) ───────────── */
  const patchStatus = useCallback(
    async (id, patch, optimistic) => {
      try {
        await api.post(`/admin/submissao/${id}/status`, patch);
        onStatusChange?.(id, optimistic);
        toast.success("✅ Status atualizado.");
        setA11yMsg("Status atualizado com sucesso.");
      } catch (e) {
        const msg = e?.response?.data?.erro || e?.message || "Falha ao atualizar status.";
        toast.error(`❌ ${msg}`);
        setA11yMsg(`Erro ao atualizar status: ${msg}`);
        throw e;
      }
    },
    [onStatusChange]
  );

  async function aprovarExposicao(s) {
    if (!s?.id) return;
    if (!confirm(`Aprovar EXPOSIÇÃO de "${s.titulo}"?`)) return;

    const jaOral = hasAprovOral(s) || Boolean(s._oral_aprovada);

    try {
      setWorkingExpoId(s.id);

      const patch = {
        status: "aprovado_exposicao",
        status_escrita: "aprovado",
        status_oral: jaOral ? "aprovado" : s.status_oral ?? null,
        observacao_admin: null,
      };

      const optimistic = {
        status: "aprovado_exposicao",
        _exposicao_aprovada: true,
        _oral_aprovada: jaOral,
        status_escrita: "aprovado",
        ...(jaOral ? { status_oral: "aprovado" } : {}),
      };

      await patchStatus(s.id, patch, optimistic);
    } finally {
      setWorkingExpoId(null);
    }
  }

  async function aprovarOral(s) {
    if (!s?.id) return;
    if (!confirm(`Aprovar APRESENTAÇÃO ORAL de "${s.titulo}"?`)) return;

    const jaExpo = hasAprovExposicao(s) || Boolean(s._exposicao_aprovada);

    try {
      setWorkingOralId(s.id);

      const patch = {
        status: "aprovado_oral",
        status_oral: "aprovado",
        status_escrita: jaExpo ? "aprovado" : s.status_escrita ?? null,
        observacao_admin: null,
      };

      const optimistic = {
        status: "aprovado_oral",
        _oral_aprovada: true,
        _exposicao_aprovada: jaExpo,
        status_oral: "aprovado",
        ...(jaExpo ? { status_escrita: "aprovado" } : {}),
      };

      await patchStatus(s.id, patch, optimistic);
    } finally {
      setWorkingOralId(null);
    }
  }

  async function reprovar(s) {
    if (!s?.id) return;
    if (!confirm(`Reprovar totalmente "${s.titulo}"?`)) return;

    try {
      setWorkingReprovarId(s.id);

      await patchStatus(
        s.id,
        { status: "reprovado", observacao_admin: null },
        { status: "reprovado", _exposicao_aprovada: false, _oral_aprovada: false }
      );
    } finally {
      setWorkingReprovarId(null);
    }
  }

  const fechar = useCallback(() => onClose?.(), [onClose]);

  const onOverlayMouseDown = (e) => {
    // fecha apenas se clicar no overlay (não nos filhos)
    if (e.target === overlayRef.current) fechar();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ranking-title"
        aria-describedby="ranking-desc"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* live region */}
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {a11yMsg}
        </span>

        <div
          ref={overlayRef}
          className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          onMouseDown={onOverlayMouseDown}
          aria-hidden="true"
        />

        <motion.div
          ref={dialogRef}
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className={[
            "relative w-full",
            "max-h-[92vh] sm:max-h-[86vh]",
            "sm:max-w-6xl",
            "overflow-hidden",
            "rounded-t-3xl sm:rounded-3xl",
            "bg-white/95 dark:bg-zinc-950/70",
            "ring-1 ring-black/5 dark:ring-white/10",
            "shadow-[0_30px_100px_-60px_rgba(0,0,0,0.65)]",
            "backdrop-blur supports-[backdrop-filter]:backdrop-blur",
            "flex flex-col",
          ].join(" ")}
        >
          {/* HEADER */}
          <div className="relative">
            <div className="h-2 w-full bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-500" />

            <div className="px-4 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-gradient-to-br from-amber-600 via-orange-600 to-yellow-500 p-2 text-white shadow">
                    <Trophy className="h-5 w-5" aria-hidden="true" />
                  </div>

                  <div className="min-w-0">
                    <h3 id="ranking-title" className="text-lg sm:text-xl font-extrabold tracking-tight">
                      Ranking por Nota (Geral)
                    </h3>
                    <p id="ranking-desc" className="text-xs text-zinc-600 dark:text-zinc-400">
                      Ordenado pela maior média geral • <b>{total}</b> resultado(s)
                    </p>
                  </div>
                </div>

                <button
                  onClick={fechar}
                  data-autofocus
                  className={[
                    "inline-flex items-center justify-center gap-1",
                    "rounded-2xl px-3 py-2 text-sm font-bold",
                    "bg-amber-700 text-white hover:bg-amber-800",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70",
                    "focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
                  ].join(" ")}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Fechar
                </button>
              </div>

              {/* FILTROS */}
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" aria-hidden="true" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por título, autor, linha…"
                    className={[
                      "w-full rounded-2xl border",
                      "pl-9 pr-3 py-2 text-sm",
                      "bg-white/80 dark:bg-zinc-900/50",
                      "border-zinc-200 dark:border-white/10",
                      "ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-500/70",
                    ].join(" ")}
                    aria-label="Buscar no ranking"
                  />
                </div>

                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" aria-hidden="true" />
                  <select
                    value={filtroChamada}
                    onChange={(e) => {
                      setFiltroChamada(e.target.value);
                      setFiltroLinha("__all__");
                    }}
                    className={[
                      "w-full rounded-2xl border",
                      "pl-9 pr-3 py-2 text-sm",
                      "bg-white/80 dark:bg-zinc-900/50",
                      "border-zinc-200 dark:border-white/10",
                      "ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-500/70",
                    ].join(" ")}
                  >
                    {opcaoChamadas.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <select
                  value={filtroLinha}
                  onChange={(e) => setFiltroLinha(e.target.value)}
                  className={[
                    "w-full rounded-2xl border",
                    "px-3 py-2 text-sm",
                    "bg-white/80 dark:bg-zinc-900/50",
                    "border-zinc-200 dark:border-white/10",
                    "ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-500/70",
                  ].join(" ")}
                >
                  {opcaoLinha.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* chips rápidos */}
              {(filtroChamada !== "__all__" || filtroLinha !== "__all__" || busca.trim()) && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-300">
                  <span className="font-semibold">Filtros:</span>
                  {busca.trim() && (
                    <span className="rounded-full bg-zinc-100 dark:bg-white/10 px-2 py-1">Busca: “{busca.trim()}”</span>
                  )}
                  {filtroChamada !== "__all__" && (
                    <span className="rounded-full bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200 px-2 py-1 inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> {filtroChamada}
                    </span>
                  )}
                  {filtroLinha !== "__all__" && (
                    <span className="rounded-full bg-zinc-100 dark:bg-white/10 px-2 py-1">{filtroLinha}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setBusca("");
                      setFiltroChamada("__all__");
                      setFiltroLinha("__all__");
                    }}
                    className="rounded-full px-2 py-1 font-bold text-amber-700 hover:text-amber-800 dark:text-amber-200 dark:hover:text-amber-100"
                  >
                    Limpar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* LISTA */}
          <div className="flex-1 overflow-y-auto">
            {/* MOBILE: cards */}
            <ul className="space-y-3 px-4 pb-4 sm:hidden">
              {ordenados.length === 0 && (
                <li className="rounded-2xl border border-zinc-200 p-4 text-center text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-300">
                  Nada encontrado.
                </li>
              )}

              {ordenados.map((s) => {
                const wExpo = workingExpoId === s.id;
                const wO = workingOralId === s.id;
                const wR = workingReprovarId === s.id;

                const okExpo = hasAprovExposicao(s) || Boolean(s._exposicao_aprovada);
                const okO = hasAprovOral(s) || Boolean(s._oral_aprovada);

                return (
                  <li
                    key={s.id}
                    className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950/40"
                  >
                    <div className="h-1 w-full bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-500" />
                    <div className="p-4">
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Posição
                          </span>
                          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-600 px-2 text-sm font-extrabold text-white">
                            {s._rank}
                          </span>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Nota</div>
                          <div className="text-2xl font-extrabold leading-none">{fmtNum(s._nota, 1)}</div>
                        </div>
                      </div>

                      <h4 className="mb-2 break-words text-base font-semibold">{s.titulo}</h4>

                      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-white/10">
                          {s.linha_tematica_nome || "Sem linha temática"}
                        </span>
                        {s.chamada_titulo && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                            {s.chamada_titulo}
                          </span>
                        )}
                      </div>

                      <div className="mb-4">
                        <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Autor</div>
                        <div className="break-words text-sm font-medium">{fmt(s.autor_nome)}</div>
                        <div className="break-all text-[11px] text-zinc-500 dark:text-zinc-400">{fmt(s.autor_email)}</div>
                      </div>

                      <div className="mb-3 flex flex-wrap gap-2">
                        <StatusBadge status={s.status} />
                        {okExpo && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                            <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> Exposição
                          </span>
                        )}
                        {okO && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                            <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> Oral
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 text-sm">
                        <div className="flex gap-2">
                          <ActionBtn
                            onClick={() => aprovarExposicao(s)}
                            disabled={wExpo}
                            variant="ok"
                            label="Exposição"
                            icon={wExpo ? Loader2 : CheckCircle}
                            spinning={wExpo}
                          />
                          <ActionBtn
                            onClick={() => aprovarOral(s)}
                            disabled={wO}
                            variant="ok"
                            label="Oral"
                            icon={wO ? Loader2 : CheckCircle}
                            spinning={wO}
                          />
                        </div>

                        <ActionBtn
                          onClick={() => reprovar(s)}
                          disabled={wR}
                          variant="danger"
                          label="Reprovar"
                          icon={wR ? Loader2 : XCircle}
                          spinning={wR}
                          full
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* DESKTOP: tabela */}
            <div className="hidden sm:block">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 z-10 bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-500 text-white">
                  <tr>
                    <th className="w-12 p-2 text-left align-top">#</th>
                    <th className="w-[26%] p-2 text-left align-top break-words">Título</th>
                    <th className="w-[18%] p-2 text-left align-top break-words">Autor</th>
                    <th className="w-[16%] p-2 text-left align-top break-words">Chamada</th>
                    <th className="w-[16%] p-2 text-left align-top break-words">Linha</th>
                    <th className="w-[8%] p-2 text-center align-top">Nota</th>
                    <th className="w-[16%] p-2 text-center align-top break-words">Aprovações</th>
                    <th className="w-[28%] p-2 text-center align-top break-words">Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {ordenados.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-zinc-600 dark:text-zinc-400">
                        Nada encontrado.
                      </td>
                    </tr>
                  )}

                  {ordenados.map((s, idx) => {
                    const wExpo = workingExpoId === s.id;
                    const wO = workingOralId === s.id;
                    const wR = workingReprovarId === s.id;

                    const okExpo = hasAprovExposicao(s) || Boolean(s._exposicao_aprovada);
                    const okO = hasAprovOral(s) || Boolean(s._oral_aprovada);

                    return (
                      <tr
                        key={s.id}
                        className={[
                          "align-top border-b dark:border-white/10",
                          idx % 2 === 0 ? "bg-white/60 dark:bg-zinc-950/20" : "bg-zinc-50/70 dark:bg-zinc-900/40",
                          "hover:bg-amber-50/40 dark:hover:bg-white/5 transition-colors",
                        ].join(" ")}
                      >
                        <td className="p-2 font-semibold text-zinc-700 dark:text-zinc-200">{s._rank}</td>

                        <td className="p-2 break-words">
                          <div className="font-medium text-zinc-900 dark:text-white">{s.titulo}</div>
                        </td>

                        <td className="p-2 break-words">
                          <div className="text-zinc-900 dark:text-white">{fmt(s.autor_nome)}</div>
                          <div className="break-all text-[11px] text-zinc-500 dark:text-zinc-400">{fmt(s.autor_email)}</div>
                        </td>

                        <td className="p-2 break-words">{fmt(s.chamada_titulo)}</td>
                        <td className="p-2 break-words">{fmt(s.linha_tematica_nome)}</td>

                        <td className="p-2 text-center">
                          <span className="inline-flex items-center justify-center rounded-full bg-violet-600 px-2 py-1 text-sm font-extrabold text-white">
                            {fmtNum(s._nota, 1)}
                          </span>
                        </td>

                        <td className="p-2 text-center">
                          <div className="inline-flex max-w-[10rem] flex-wrap justify-center gap-1.5">
                            <StatusBadge status={s.status} />
                            {okExpo && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> Exposição
                              </span>
                            )}
                            {okO && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> Oral
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-2">
                          <div className="flex flex-wrap items-center justify-center gap-2 text-[12px]">
                            <ActionBtn
                              onClick={() => aprovarExposicao(s)}
                              disabled={wExpo}
                              variant="ok"
                              label="Exposição"
                              icon={wExpo ? Loader2 : CheckCircle}
                              spinning={wExpo}
                              compact
                            />
                            <ActionBtn
                              onClick={() => aprovarOral(s)}
                              disabled={wO}
                              variant="ok"
                              label="Oral"
                              icon={wO ? Loader2 : CheckCircle}
                              spinning={wO}
                              compact
                            />
                            <ActionBtn
                              onClick={() => reprovar(s)}
                              disabled={wR}
                              variant="danger"
                              label="Reprovar"
                              icon={wR ? Loader2 : XCircle}
                              spinning={wR}
                              compact
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rodapé */}
          <div className="border-t border-zinc-200/70 dark:border-white/10 px-4 py-3 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            Em <b>Aprovações</b>, mostramos somente as modalidades realmente aprovadas: <b>Exposição</b> (pôster) e{" "}
            <b>Oral</b> (apresentação ao vivo).
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ───────────────── Buttons ───────────────── */
function ActionBtn({ onClick, disabled, variant = "ok", label, icon: Icon, spinning = false, full = false, compact = false }) {
  const base = [
    "inline-flex items-center justify-center gap-1.5",
    compact ? "px-3 py-1.5 rounded-xl" : "px-3 py-2 rounded-2xl",
    "font-semibold",
    compact ? "text-[12px]" : "text-sm",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:opacity-60 disabled:cursor-not-allowed",
    full ? "w-full" : "flex-1",
  ].join(" ");

  const palette =
    variant === "danger"
      ? "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-400/70 ring-offset-white dark:ring-offset-zinc-950"
      : "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-400/70 ring-offset-white dark:ring-offset-zinc-950";

  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${palette}`}>
      {Icon ? <Icon className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} aria-hidden="true" /> : null}
      {label}
    </button>
  );
}
