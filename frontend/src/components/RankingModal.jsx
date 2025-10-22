// 📁 src/components/RankingModal.jsx
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy, Loader2, CheckCircle, XCircle, CalendarDays } from "lucide-react";
import api from "../services/api";

/* ─── Helpers ─── */
const fmt = (v, alt = "—") => (v === 0 || !!v ? String(v) : alt);
const fmtNum = (v, d = 1) => Number(v ?? 0).toFixed(d);

export default function RankingModal({ open, onClose, itens = [], onStatusChange }) {
  const dialogRef = useRef(null);
  const [busca, setBusca] = useState("");
  const [workingId, setWorkingId] = useState(null);

  // focus + ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    // foco no botão fechar
    setTimeout(() => dialogRef.current?.querySelector?.("[data-autofocus]")?.focus?.(), 0);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const lerNota = useCallback((s) => {
    // Campos numeric do PG chegam como string
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

  const ordenados = useMemo(() => {
    const term = busca.trim().toLowerCase();
    return [...itens]
      .map((s) => ({ ...s, _nota: lerNota(s) }))
      .filter(
        (s) =>
          !term ||
          [s.titulo, s.autor_nome, s.autor_email, s.chamada_titulo, s.linha_tematica_nome, s.linha_tematica_codigo]
            .map((v) => (v ? String(v).toLowerCase() : ""))
            .some((t) => t.includes(term))
      )
      .sort((a, b) => b._nota - a._nota || a.id - b.id)
      .map((s, i) => ({ ...s, _rank: i + 1 }));
  }, [itens, busca, lerNota]);

  async function setStatus(s, status) {
    if (!s?.id) return;
    const conf = status === "reprovado" ? `Reprovar "${s.titulo}"?` : `Aprovar "${s.titulo}" para Exposição?`;
    if (!confirm(conf)) return;

    try {
      setWorkingId(s.id);
      await api.post(`/admin/submissoes/${s.id}/status`, {
        status: status === "aprovado" ? "aprovado_exposicao" : status,
        observacoes_admin: null,
      });
      onStatusChange?.(s.id, status === "aprovado" ? "aprovado_exposicao" : status);
    } catch (e) {
      console.error("Falha ao alterar status:", e);
      alert("Não foi possível alterar o status.");
    } finally {
      setWorkingId(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Ranking de submissões por nota"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <motion.div
        ref={dialogRef}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="
          relative flex max-h-[92vh] w-full flex-col overflow-hidden
          rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-900 sm:max-w-5xl sm:rounded-2xl
        "
      >
        {/* Header sticky para mobile */}
        <div className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-600" />
              <h3 className="text-lg font-bold sm:text-xl">Ranking por Nota</h3>
            </div>
            <button
              onClick={onClose}
              data-autofocus
              className="inline-flex items-center gap-1 rounded-md bg-amber-700 px-3 py-2 text-white hover:bg-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" /> Fechar
            </button>
          </div>

          {/* Filtro rápido */}
          <div className="px-4 pb-4 sm:px-6">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título, autor, linha…"
              className="w-full rounded-xl border px-3 py-2 text-sm ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-600 dark:border-zinc-700 dark:bg-zinc-800"
              aria-label="Buscar no ranking"
            />
          </div>
        </div>

        {/* Conteúdo rolável */}
        <div className="flex-1 overflow-y-auto">
          {/* ====== Vista MOBILE (cards) ====== */}
          <ul className="space-y-3 px-4 pb-4 sm:hidden">
            {ordenados.length === 0 && (
              <li className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-600 dark:border-zinc-800">
                Nada encontrado.
              </li>
            )}

            {ordenados.map((s) => {
              const working = workingId === s.id;
              return (
                <li
                  key={s.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {/* Linha 1: rank + nota */}
                  <div className="mb-2 flex items-center justify-between">
                    <div className="inline-flex items-center gap-2">
                      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-600 px-2 text-sm font-bold text-white">
                        {s._rank}
                      </span>
                      <span className="text-xs text-zinc-500">#{s.id}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-zinc-500">Nota</div>
                      <div className="text-2xl font-extrabold leading-none">{fmtNum(s._nota, 1)}</div>
                    </div>
                  </div>

                  {/* Título */}
                  <h4 className="mb-1 line-clamp-3 break-words text-base font-semibold">{s.titulo}</h4>

                  {/* Linha temática + chamada */}
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                    {s.linha_tematica_nome || s.linha_tematica_codigo ? (
                      <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                        {s.linha_tematica_nome || s.linha_tematica_codigo}
                      </span>
                    ) : null}
                    {s.chamada_titulo ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {fmt(s.chamada_titulo)}
                      </span>
                    ) : null}
                  </div>

                  {/* Autor */}
                  <div className="mb-3">
                    <div className="text-xs text-zinc-500">Autor</div>
                    <div className="break-words font-medium">{fmt(s.autor_nome)}</div>
                    <div className="break-all text-xs text-zinc-500">{fmt(s.autor_email)}</div>
                  </div>

                  {/* Status */}
                  <div className="mb-3">
                    <div className="text-xs text-zinc-500">Status</div>
                    <div className="break-words">{fmt(s.status)}</div>
                  </div>

                  {/* Ações (toque amplo) */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      onClick={() => setStatus(s, "aprovado")}
                      disabled={working}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      aria-label={`Aprovar ${s.titulo}`}
                    >
                      {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                      Aprovar
                    </button>
                    <button
                      onClick={() => setStatus(s, "reprovado")}
                      disabled={working}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                      aria-label={`Reprovar ${s.titulo}`}
                    >
                      {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Reprovar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* ====== Vista DESKTOP (tabela) ====== */}
          <div className="hidden sm:block">
            <table className="w-full table-fixed text-sm">
              <thead className="sticky top-0 z-10 bg-amber-600 text-white">
                <tr>
                  <th className="w-12 p-2 text-left">#</th>
                  <th className="w-[36%] p-2 text-left">Título</th>
                  <th className="w-[24%] p-2 text-left">Autor</th>
                  <th className="w-[22%] p-2 text-left">Chamada</th>
                  <th className="w-20 p-2 text-center">Nota</th>
                  <th className="w-28 p-2 text-center">Status</th>
                  <th className="w-[16%] p-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {ordenados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-600">
                      Nada encontrado.
                    </td>
                  </tr>
                )}
                {ordenados.map((s) => {
                  const working = workingId === s.id;
                  return (
                    <tr key={s.id} className="align-top border-b dark:border-zinc-800">
                      <td className="p-2 font-semibold text-zinc-700 dark:text-zinc-200">{s._rank}</td>
                      <td className="p-2">
                        <div className="break-words" title={s.titulo}>
                          {s.titulo}
                        </div>
                        <div className="mt-0.5 break-words text-xs text-zinc-500">
                          {s.linha_tematica_nome || s.linha_tematica_codigo || "—"}
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="break-words font-medium">{s.autor_nome}</div>
                        <div className="break-words break-all text-xs text-zinc-500">{s.autor_email}</div>
                      </td>
                      <td className="p-2 break-words">{fmt(s.chamada_titulo)}</td>
                      <td className="p-2 text-center font-bold">{fmtNum(s._nota, 1)}</td>
                      <td className="p-2 break-words text-center">{fmt(s.status)}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            onClick={() => setStatus(s, "aprovado")}
                            disabled={working}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-60"
                            aria-label={`Aprovar ${s.titulo}`}
                          >
                            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            Aprovar
                          </button>
                          <button
                            onClick={() => setStatus(s, "reprovado")}
                            disabled={working}
                            className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-white hover:bg-rose-700 disabled:opacity-60"
                            aria-label={`Reprovar ${s.titulo}`}
                          >
                            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                            Reprovar
                          </button>
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
        <div className="border-t px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800">
          Critério: ordenado por nota média (descendente). “Aprovar” define status <code>aprovado_exposicao</code>.
        </div>

        <AnimatePresence />
      </motion.div>
    </div>
  );
}
