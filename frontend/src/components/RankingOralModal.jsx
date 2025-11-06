// 📁 src/components/RankingOralModal.jsx
import { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X, Mic, CalendarDays, CheckCircle } from "lucide-react";

/* ——— Utils ——— */
const fmtNum = (v, d = 1) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "0,0";
  return n.toFixed(d).replace(".", ",");
};
const aprovadoOral = (s) =>
  String(s?.status_oral || "").toLowerCase() === "aprovado" || Boolean(s?._oral_aprovada);

export default function RankingOralModal({ open, onClose, itens = [] }) {
  const dialogRef = useRef(null);
  const [busca, setBusca] = useState("");
  const [filtroChamada, setFiltroChamada] = useState("__all__");
  const [filtroLinha, setFiltroLinha] = useState("__all__");

  /* ESC + foco */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    setTimeout(() => {
      dialogRef.current?.querySelector?.("[data-autofocus]")?.focus?.();
    }, 0);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /* Somente aprovados em ORAL */
  const aprovados = useMemo(() => itens.filter(aprovadoOral), [itens]);

  /* Filtros (baseados apenas nos aprovados) */
  const opcoesChamadas = useMemo(() => {
    const set = new Set();
    aprovados.forEach((s) => s.chamada_titulo && set.add(s.chamada_titulo.trim()));
    return ["__all__", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [aprovados]);

  const opcoesLinhas = useMemo(() => {
    const set = new Set();
    aprovados.forEach((s) => s.linha_tematica_nome && set.add(s.linha_tematica_nome.trim()));
    return ["__all__", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [aprovados]);

  /* Lista ordenada por NOTA ORAL (desc) — somente aprovados */
  const lista = useMemo(() => {
    const term = busca.trim().toLowerCase();
    return [...aprovados]
      .map((s) => ({ ...s, _nota: Number(s.nota_oral ?? 0) }))
      .filter((s) => {
        const okBusca =
          !term ||
          [s.titulo, s.autor_nome, s.autor_email, s.chamada_titulo, s.linha_tematica_nome]
            .map((v) => (v ? String(v).toLowerCase() : ""))
            .some((t) => t.includes(term));
        const okChamada = filtroChamada === "__all__" || s.chamada_titulo === filtroChamada;
        const okLinha = filtroLinha === "__all__" || s.linha_tematica_nome === filtroLinha;
        return okBusca && okChamada && okLinha;
      })
      .sort((a, b) => b._nota - a._nota || a.id - b.id)
      .map((s, i) => ({ ...s, _rank: i + 1 }));
  }, [aprovados, busca, filtroChamada, filtroLinha]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Ranking de apresentação oral">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <motion.div
        ref={dialogRef}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-900 sm:max-w-5xl sm:rounded-2xl"
      >
        {/* HEADER */}
        <div className="relative">
          <div className="h-2 w-full bg-gradient-to-r from-indigo-600 via-emerald-600 to-teal-500" />
          <div className="flex items-center justify-between px-4 py-4 sm:px-6">
            <div className="flex items-start gap-3 sm:items-center">
              <div className="rounded-lg bg-gradient-to-br from-indigo-600 via-emerald-600 to-teal-500 p-2 text-white shadow">
                <Mic className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-lg font-bold sm:text-xl">Ranking – Apresentação Oral</h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">Ordenado pela maior nota oral</p>
              </div>
            </div>

            <button
              data-autofocus
              onClick={onClose}
              className="inline-flex items-center justify-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
            >
              <X className="h-4 w-4" />
              Fechar
            </button>
          </div>
        </div>

        {/* FILTROS */}
        <div className="px-4 pb-4 sm:px-6">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título, autor, linha…"
              className="w-full rounded-xl border px-3 py-2 text-sm ring-offset-2 focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-800"
              aria-label="Buscar no ranking oral"
            />
            <select
              value={filtroChamada}
              onChange={(e) => {
                setFiltroChamada(e.target.value);
                setFiltroLinha("__all__");
              }}
              className="w-full rounded-xl border px-3 py-2 text-sm ring-offset-2 focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-800"
              aria-label="Filtrar por chamada"
            >
              {opcoesChamadas.map((v) => (
                <option key={v} value={v}>
                  {v === "__all__" ? "Todas as chamadas" : v}
                </option>
              ))}
            </select>
            <select
              value={filtroLinha}
              onChange={(e) => setFiltroLinha(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm ring-offset-2 focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-800"
              aria-label="Filtrar por linha temática"
            >
              {opcoesLinhas.map((v) => (
                <option key={v} value={v}>
                  {v === "__all__" ? "Todas as linhas" : v}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* CARDS (mobile) */}
        <div className="sm:hidden overflow-y-auto px-4 pb-4 max-h-[65vh]">
          {lista.length === 0 && (
            <div className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-600 dark:border-zinc-800">
              Nada encontrado entre os aprovados.
            </div>
          )}
          <ul className="space-y-3">
            {lista.map((s) => (
              <li key={s.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="h-1 w-full bg-gradient-to-r from-indigo-600 via-emerald-600 to-teal-500" />
                <div className="p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Posição</span>
                      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-indigo-600 px-2 text-sm font-bold text-white">
                        {s._rank}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Nota oral</div>
                      <div className="text-2xl font-extrabold leading-none">{fmtNum(s._nota, 1)}</div>
                    </div>
                  </div>

                  <h4 className="mb-2 break-words text-base font-semibold">{s.titulo}</h4>

                  <div className="mb-2 text-sm">
                    <div className="font-medium break-words">{s.autor_nome}</div>
                    <div className="break-all text-[11px] text-zinc-500 dark:text-zinc-400">{s.autor_email}</div>
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                      {s.linha_tematica_nome || "Sem linha temática"}
                    </span>
                    {s.chamada_titulo && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {s.chamada_titulo}
                      </span>
                    )}
                    {/* já é aprovado por definição, mas mantive a pílula */}
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">
                      <CheckCircle className="h-3.5 w-3.5" /> Oral aprovado
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* TABELA (desktop) */}
        <div className="hidden sm:block overflow-y-auto px-4 pb-5 max-h-[65vh]">
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
                  <td colSpan={7} className="py-8 text-center text-zinc-600 dark:text-zinc-400">
                    Nada encontrado entre os aprovados.
                  </td>
                </tr>
              )}
              {lista.map((s, idx) => (
                <tr
                  key={s.id}
                  className={
                    "align-top border-b dark:border-zinc-800 " +
                    (idx % 2 === 0 ? "bg-white/60 dark:bg-zinc-900/40" : "bg-zinc-50/60 dark:bg-zinc-800/30")
                  }
                >
                  <td className="p-2 font-semibold text-zinc-700 dark:text-zinc-200">{s._rank}</td>
                  <td className="p-2 break-words">
                    <div className="font-medium">{s.titulo}</div>
                  </td>
                  <td className="p-2 break-words">
                    <div>{s.autor_nome}</div>
                    <div className="break-all text-[11px] text-zinc-500 dark:text-zinc-400">{s.autor_email}</div>
                  </td>
                  <td className="p-2 break-words">{s.chamada_titulo}</td>
                  <td className="p-2 break-words">{s.linha_tematica_nome || "—"}</td>
                  <td className="p-2 text-center">
                    <span className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-2 py-1 text-sm font-semibold text-white">
                      {fmtNum(s._nota, 1)}
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                      <CheckCircle className="h-3.5 w-3.5" /> Aprovado
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
