// 📁 src/components/RankingModal.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy, Loader2, CheckCircle, XCircle } from "lucide-react";
import api from "../services/api";

const fmt = (v, alt = "—") => (v === 0 || !!v ? String(v) : alt);
const fmtNum = (v, d = 1) => Number(v ?? 0).toFixed(d);

export default function RankingModal({ open, onClose, itens = [], onStatusChange }) {
  const dialogRef = useRef(null);
  const [busca, setBusca] = useState("");
  const [workingId, setWorkingId] = useState(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    // foco no botão fechar para navegação imediata por teclado
    setTimeout(() => dialogRef.current?.querySelector?.("[data-autofocus]")?.focus?.(), 0);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const ordenados = useMemo(() => {
    // nota_media ou fallback (total_geral/4) ou 0
    const lerNota = (s) => {
      // ⚠️ Campos do PG (numeric) chegam como string → sempre converta
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
    };

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
      .sort((a, b) => b._nota - a._nota || a.id - b.id) // maior nota primeiro
      .map((s, i) => ({ ...s, _rank: i + 1 }));
  }, [itens, busca]);

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
        // ⚠️ layout com rolagem: container flex-col, lista flex-1 overflow-y-auto
        className="relative bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-5xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-600" />
            <h3 className="text-lg sm:text-xl font-bold">Ranking por Nota</h3>
          </div>
          <button
            onClick={onClose}
            data-autofocus
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-amber-700 text-white hover:bg-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" /> Fechar
          </button>
        </div>

        {/* Filtro rápido */}
        <div className="p-4 border-b dark:border-zinc-800">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título, autor, linha…"
            className="border rounded-md px-3 py-2 text-sm w-full dark:border-zinc-700 dark:bg-zinc-800"
            aria-label="Buscar no ranking"
          />
        </div>

        {/* Lista rolável */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-amber-600 text-white sticky top-0 z-10">
              <tr>
                <th className="p-2 text-left w-16">#</th>
                <th className="p-2 text-left">Título</th>
                <th className="p-2 text-left">Autor</th>
                <th className="p-2 text-left">Chamada</th>
                <th className="p-2 text-center w-24">Nota</th>
                <th className="p-2 text-center w-40">Status</th>
                <th className="p-2 text-center w-60">Ações</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-zinc-600">
                    Nada encontrado.
                  </td>
                </tr>
              )}
              {ordenados.map((s) => (
                <tr key={s.id} className="border-b dark:border-zinc-800">
                  <td className="p-2 font-semibold text-zinc-700 dark:text-zinc-200">{s._rank}</td>
                  <td className="p-2">
                    <div className="max-w-[44ch] truncate" title={s.titulo}>
                      {s.titulo}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {s.linha_tematica_nome || s.linha_tematica_codigo || "—"}
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="max-w-[28ch] truncate">{s.autor_nome}</div>
                    <div className="text-xs text-zinc-500">{s.autor_email}</div>
                  </td>
                  <td className="p-2">{fmt(s.chamada_titulo)}</td>
                  <td className="p-2 text-center font-bold">{fmtNum(s._nota, 1)}</td>
                  <td className="p-2 text-center">{fmt(s.status)}</td>
                  <td className="p-2">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setStatus(s, "aprovado")}
                        disabled={workingId === s.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                        aria-label={`Aprovar ${s.titulo}`}
                      >
                        {workingId === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        Aprovar
                      </button>
                      <button
                        onClick={() => setStatus(s, "reprovado")}
                        disabled={workingId === s.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
                        aria-label={`Reprovar ${s.titulo}`}
                      >
                        {workingId === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        Reprovar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rodapé (fixo) */}
        <div className="p-3 border-t text-xs text-zinc-500 dark:border-zinc-800">
          Critério: ordenado por nota média (descendente). “Aprovar” define status <code>aprovado_exposicao</code>.
        </div>

        <AnimatePresence />
      </motion.div>
    </div>
  );
}
