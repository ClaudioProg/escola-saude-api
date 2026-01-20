// 📁 src/components/RankingOralModal.jsx
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, CalendarDays, CheckCircle, Search, Filter } from "lucide-react";

/* ───────────────── Utils ───────────────── */
const fmtNum = (v, d = 1) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "0,0";
  return n.toFixed(d).replace(".", ",");
};

const aprovadoOral = (s) =>
  String(s?.status_oral || "").toLowerCase() === "aprovado" || Boolean(s?._oral_aprovada);

function pathEq(a, b) {
  return String(a || "").trim() === String(b || "").trim();
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

    const focusFirst = () => focusables()[0]?.focus?.();

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
    setTimeout(focusFirst, 0);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, dialogRef, onClose]);
}

export default function RankingOralModal({ open, onClose, itens = [] }) {
  const dialogRef = useRef(null);
  const overlayRef = useRef(null);

  const [busca, setBusca] = useState("");
  const [filtroChamada, setFiltroChamada] = useState("__all__");
  const [filtroLinha, setFiltroLinha] = useState("__all__");
  const [a11yMsg, setA11yMsg] = useState("");

  // trava scroll do body quando abre
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

  // reset suave ao fechar
  useEffect(() => {
    if (open) return;
    setBusca("");
    setFiltroChamada("__all__");
    setFiltroLinha("__all__");
    setA11yMsg("");
  }, [open]);

  /* Somente aprovados em ORAL */
  const aprovados = useMemo(() => (Array.isArray(itens) ? itens.filter(aprovadoOral) : []), [itens]);

  /* Opções de filtros (baseados apenas nos aprovados) */
  const opcaoChamadas = useMemo(() => {
    const set = new Set();
    for (const s of aprovados) {
      const nome = (s?.chamada_titulo || "").trim();
      if (nome) set.add(nome);
    }
    return ["__all__", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [aprovados]);

  const opcaoLinhas = useMemo(() => {
    const set = new Set();
    for (const s of aprovados) {
      const nome = (s?.linha_tematica_nome || "").trim();
      const chamada = (s?.chamada_titulo || "").trim();
      if (!nome) continue;
      if (filtroChamada !== "__all__" && chamada !== filtroChamada) continue;
      set.add(nome);
    }
    return ["__all__", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [aprovados, filtroChamada]);

  /* Lista ordenada por NOTA ORAL (desc) — somente aprovados */
  const lista = useMemo(() => {
    const term = busca.trim().toLowerCase();
    const out = [];

    for (const s of aprovados) {
      const okBusca =
        !term ||
        [s.titulo, s.autor_nome, s.autor_email, s.chamada_titulo, s.linha_tematica_nome]
          .map((v) => (v ? String(v).toLowerCase() : ""))
          .some((t) => t.includes(term));

      const okChamada =
        filtroChamada === "__all__" || pathEq((s?.chamada_titulo || "").trim(), filtroChamada);

      const okLinha =
        filtroLinha === "__all__" || pathEq((s?.linha_tematica_nome || "").trim(), filtroLinha);

      if (okBusca && okChamada && okLinha) {
        out.push({ ...s, _nota: Number(s?.nota_oral ?? 0) });
      }
    }

    out.sort((a, b) => b._nota - a._nota || a.id - b.id);
    return out.map((s, i) => ({ ...s, _rank: i + 1 }));
  }, [aprovados, busca, filtroChamada, filtroLinha]);

  const total = lista.length;

  const fechar = useCallback(() => onClose?.(), [onClose]);

  const onOverlayMouseDown = (e) => {
    if (e.target === overlayRef.current) fechar();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ranking-oral-title"
        aria-describedby="ranking-oral-desc"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* live region discreta */}
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
            <div className="h-2 w-full bg-gradient-to-r from-indigo-600 via-emerald-600 to-teal-500" />

            <div className="px-4 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-emerald-600 to-teal-500 p-2 text-white shadow">
                    <Mic className="h-5 w-5" aria-hidden="true" />
                  </div>

                  <div className="min-w-0">
                    <h3 id="ranking-oral-title" className="text-lg sm:text-xl font-extrabold tracking-tight">
                      Ranking – Apresentação Oral
                    </h3>
                    <p id="ranking-oral-desc" className="text-xs text-zinc-600 dark:text-zinc-400">
                      Ordenado pela maior nota oral • <b>{total}</b> aprovado(s)
                    </p>
                  </div>
                </div>

                <button
                  data-autofocus
                  onClick={fechar}
                  className={[
                    "inline-flex items-center justify-center gap-1",
                    "rounded-2xl px-3 py-2 text-sm font-bold",
                    "bg-indigo-600 text-white hover:bg-indigo-700",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70",
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
                      "ring-offset-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/70",
                    ].join(" ")}
                    aria-label="Buscar no ranking oral"
                  />
                </div>

                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" aria-hidden="true" />
                  <select
                    value={filtroChamada}
                    onChange={(e) => {
                      setFiltroChamada(e.target.value);
                      setFiltroLinha("__all__");
                      setA11yMsg("Filtro de chamada atualizado.");
                    }}
                    className={[
                      "w-full rounded-2xl border",
                      "pl-9 pr-3 py-2 text-sm",
                      "bg-white/80 dark:bg-zinc-900/50",
                      "border-zinc-200 dark:border-white/10",
                      "ring-offset-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/70",
                    ].join(" ")}
                    aria-label="Filtrar por chamada"
                  >
                    {opcaoChamadas.map((v) => (
                      <option key={v} value={v}>
                        {v === "__all__" ? "Todas as chamadas" : v}
                      </option>
                    ))}
                  </select>
                </div>

                <select
                  value={filtroLinha}
                  onChange={(e) => {
                    setFiltroLinha(e.target.value);
                    setA11yMsg("Filtro de linha temática atualizado.");
                  }}
                  className={[
                    "w-full rounded-2xl border",
                    "px-3 py-2 text-sm",
                    "bg-white/80 dark:bg-zinc-900/50",
                    "border-zinc-200 dark:border-white/10",
                    "ring-offset-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/70",
                  ].join(" ")}
                  aria-label="Filtrar por linha temática"
                >
                  {opcaoLinhas.map((v) => (
                    <option key={v} value={v}>
                      {v === "__all__" ? "Todas as linhas" : v}
                    </option>
                  ))}
                </select>
              </div>

              {/* chips rápidos */}
              {(filtroChamada !== "__all__" || filtroLinha !== "__all__" || busca.trim()) && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-300">
                  <span className="font-semibold">Filtros:</span>

                  {busca.trim() && (
                    <span className="rounded-full bg-zinc-100 dark:bg-white/10 px-2 py-1">
                      Busca: “{busca.trim()}”
                    </span>
                  )}

                  {filtroChamada !== "__all__" && (
                    <span className="rounded-full bg-indigo-50 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200 px-2 py-1 inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> {filtroChamada}
                    </span>
                  )}

                  {filtroLinha !== "__all__" && (
                    <span className="rounded-full bg-zinc-100 dark:bg-white/10 px-2 py-1">
                      {filtroLinha}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setBusca("");
                      setFiltroChamada("__all__");
                      setFiltroLinha("__all__");
                      setA11yMsg("Filtros limpos.");
                    }}
                    className="rounded-full px-2 py-1 font-bold text-indigo-700 hover:text-indigo-800 dark:text-indigo-200 dark:hover:text-indigo-100"
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
            <div className="sm:hidden px-4 pb-4">
              {lista.length === 0 && (
                <div className="rounded-2xl border border-zinc-200 p-4 text-center text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-300">
                  Nada encontrado entre os aprovados.
                </div>
              )}

              <ul className="space-y-3">
                {lista.map((s) => (
                  <li
                    key={s.id}
                    className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950/40"
                  >
                    <div className="h-1 w-full bg-gradient-to-r from-indigo-600 via-emerald-600 to-teal-500" />

                    <div className="p-4">
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Posição
                          </span>
                          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-indigo-600 px-2 text-sm font-extrabold text-white">
                            {s._rank}
                          </span>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Nota oral
                          </div>
                          <div className="text-2xl font-extrabold leading-none">{fmtNum(s._nota, 1)}</div>
                        </div>
                      </div>

                      <h4 className="mb-2 break-words text-base font-semibold text-zinc-900 dark:text-white">
                        {s.titulo}
                      </h4>

                      <div className="mb-2 text-sm">
                        <div className="font-medium break-words text-zinc-900 dark:text-white">{s.autor_nome}</div>
                        <div className="break-all text-[11px] text-zinc-500 dark:text-zinc-400">{s.autor_email}</div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-white/10">
                          {s.linha_tematica_nome || "Sem linha temática"}
                        </span>

                        {s.chamada_titulo && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200">
                            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                            {s.chamada_titulo}
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-emerald-800 font-semibold">
                          <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> Oral aprovado
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* DESKTOP: tabela */}
            <div className="hidden sm:block px-4 pb-5">
              <div className="overflow-hidden rounded-3xl ring-1 ring-black/5 dark:ring-white/10">
                <table className="w-full table-fixed text-sm">
                  <thead className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 via-emerald-600 to-teal-500 text-white">
                    <tr>
                      <th className="w-12 p-2 text-left align-top">#</th>
                      <th className="w-[28%] p-2 text-left align-top break-words">Título</th>
                      <th className="w-[18%] p-2 text-left align-top break-words">Autor</th>
                      <th className="w-[18%] p-2 text-left align-top break-words">Chamada</th>
                      <th className="w-[18%] p-2 text-left align-top break-words">Linha Temática</th>
                      <th className="w-[10%] p-2 text-center align-top">Nota oral</th>
                      <th className="w-[12%] p-2 text-center align-top">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {lista.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-zinc-600 dark:text-zinc-400">
                          Nada encontrado entre os aprovados.
                        </td>
                      </tr>
                    )}

                    {lista.map((s, idx) => (
                      <tr
                        key={s.id}
                        className={[
                          "align-top border-b dark:border-white/10",
                          idx % 2 === 0 ? "bg-white/60 dark:bg-zinc-950/20" : "bg-zinc-50/70 dark:bg-zinc-900/40",
                          "hover:bg-indigo-50/30 dark:hover:bg-white/5 transition-colors",
                        ].join(" ")}
                      >
                        <td className="p-2 font-semibold text-zinc-700 dark:text-zinc-200">{s._rank}</td>

                        <td className="p-2 break-words">
                          <div className="font-medium text-zinc-900 dark:text-white">{s.titulo}</div>
                        </td>

                        <td className="p-2 break-words">
                          <div className="text-zinc-900 dark:text-white">{s.autor_nome}</div>
                          <div className="break-all text-[11px] text-zinc-500 dark:text-zinc-400">{s.autor_email}</div>
                        </td>

                        <td className="p-2 break-words">{s.chamada_titulo}</td>
                        <td className="p-2 break-words">{s.linha_tematica_nome || "—"}</td>

                        <td className="p-2 text-center">
                          <span className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-2 py-1 text-sm font-extrabold text-white">
                            {fmtNum(s._nota, 1)}
                          </span>
                        </td>

                        <td className="p-2 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                            <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> Aprovado
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* rodapé leve */}
              <div className="mt-3 text-[11px] text-zinc-600 dark:text-zinc-400">
                Lista contém apenas submissões com <b>status oral</b> aprovado.
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
