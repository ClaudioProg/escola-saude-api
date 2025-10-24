// 📁 src/components/RankingModal.jsx
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Trophy,
  Loader2,
  CheckCircle,
  XCircle,
  CalendarDays,
} from "lucide-react";
import api from "../services/api";

/* ───────────── Helpers ───────────── */
const fmt = (v, alt = "—") => (v === 0 || !!v ? String(v) : alt);
const fmtNum = (v, d = 1) => Number(v ?? 0).toFixed(d);

/**
 * Detecta aprovação de EXPOSIÇÃO / pôster.
 * fonte oficial desejada:
 *   status_escrita === "aprovado"
 * fallback legado:
 *   status === "aprovado_exposicao"
 * flag otimista local:
 *   _exposicao_aprovada === true
 */
function hasAprovExposicao(s) {
  const escrita = String(s?.status_escrita ?? "").toLowerCase();
  const global = String(s?.status ?? "").toLowerCase();
  return (
    escrita === "aprovado" ||
    global === "aprovado_exposicao" ||
    Boolean(s?._exposicao_aprovada)
  );
}

/**
 * Detecta aprovação de APRESENTAÇÃO ORAL.
 * fonte oficial desejada:
 *   status_oral === "aprovado"
 * fallback legado:
 *   status === "aprovado_oral"
 * flag otimista local:
 *   _oral_aprovada === true
 */
function hasAprovOral(s) {
  const oral = String(s?.status_oral ?? "").toLowerCase();
  const global = String(s?.status ?? "").toLowerCase();
  return (
    oral === "aprovado" ||
    global === "aprovado_oral" ||
    Boolean(s?._oral_aprovada)
  );
}

function isReprovado(s) {
  return String(s?.status || "").toLowerCase() === "reprovado";
}

function normalizarStatusPrincipal(raw) {
  const st = String(raw || "").toLowerCase();
  if (st === "rascunho") return "rascunho";
  if (st === "submetido") return "submetido";
  if (st === "em_avaliacao") return "em avaliação";
  if (
    st === "aprovado" ||
    st === "aprovado_exposicao" ||
    st === "aprovado_oral" ||
    st === "aprovado_escrita"
  )
    return "aprovado";
  if (st === "reprovado") return "reprovado";
  return st || "—";
}

function StatusBadge({ status }) {
  const label = normalizarStatusPrincipal(status);
  const base =
    "px-2 py-1 rounded-full text-[11px] font-medium inline-flex items-center gap-1 justify-center whitespace-nowrap";
  switch (label) {
    case "rascunho":
      return <span className={`${base} bg-zinc-100 text-zinc-700`}>Rascunho</span>;
    case "submetido":
      return <span className={`${base} bg-blue-100 text-blue-700`}>Submetido</span>;
    case "em avaliação":
      return <span className={`${base} bg-amber-100 text-amber-700`}>Em avaliação</span>;
    case "aprovado":
      return <span className={`${base} bg-emerald-100 text-emerald-700`}>Aprovado</span>;
    case "reprovado":
      return <span className={`${base} bg-rose-100 text-rose-700`}>Reprovado</span>;
    default:
      return <span className={`${base} bg-zinc-100 text-zinc-700`}>{label}</span>;
  }
}

export default function RankingModal({
  open,
  onClose,
  itens = [],
  onStatusChange, // (id, patch) -> parent atualiza submissoes
}) {
  const dialogRef = useRef(null);

  const [busca, setBusca] = useState("");
  const [filtroChamada, setFiltroChamada] = useState("__all__");
  const [filtroLinha, setFiltroLinha] = useState("__all__");

  // loading flags independentes
  const [workingExpoId, setWorkingExpoId] = useState(null);
  const [workingOralId, setWorkingOralId] = useState(null);
  const [workingReprovarId, setWorkingReprovarId] = useState(null);

  /* ───────────── Acessibilidade e foco ───────────── */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);

    // foco inicial no botão "Fechar"
    setTimeout(() => {
      dialogRef.current
        ?.querySelector?.("[data-autofocus]")
        ?.focus?.();
    }, 0);

    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /* ───────────── Nota média com fallback ───────────── */
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

  /* ───────────── Opções de chamadas ───────────── */
  const opcoesChamadas = useMemo(() => {
    const mapa = new Map();
    for (const s of itens) {
      const nome = (s?.chamada_titulo || "").trim();
      if (nome) mapa.set(nome, nome);
    }
    const arr = Array.from(mapa.values()).sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
    return [
      { value: "__all__", label: "Todas as chamadas" },
      ...arr.map((v) => ({ value: v, label: v })),
    ];
  }, [itens]);

  /* ───────────── Opções de linhas temáticas ───────────── */
  const opcoesLinha = useMemo(() => {
    const mapa = new Map();
    for (const s of itens) {
      const nome = (s?.linha_tematica_nome || "").trim();
      const chamada = (s?.chamada_titulo || "").trim();
      if (!nome) continue;
      if (filtroChamada !== "__all__" && chamada !== filtroChamada) continue;
      mapa.set(nome, nome);
    }
    const arr = Array.from(mapa.values()).sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
    return [
      { value: "__all__", label: "Todas as linhas" },
      ...arr.map((v) => ({ value: v, label: v })),
    ];
  }, [itens, filtroChamada]);

  /* ───────────── Lista ordenada e filtrada ───────────── */
  const ordenados = useMemo(() => {
    const term = busca.trim().toLowerCase();
    return [...itens]
      .map((s) => ({ ...s, _nota: lerNota(s) }))
      .filter((s) => {
        const atendeBusca =
          !term ||
          [s.titulo, s.autor_nome, s.autor_email, s.chamada_titulo, s.linha_tematica_nome]
            .map((v) => (v ? String(v).toLowerCase() : ""))
            .some((t) => t.includes(term));

        const atendeChamada =
          filtroChamada === "__all__" ||
          (s.chamada_titulo || "").trim() === filtroChamada;

        const atendeLinha =
          filtroLinha === "__all__" ||
          (s.linha_tematica_nome || "").trim() === filtroLinha;

        return atendeBusca && atendeChamada && atendeLinha;
      })
      .sort((a, b) => b._nota - a._nota || a.id - b.id)
      .map((s, i) => ({ ...s, _rank: i + 1 }));
  }, [itens, busca, filtroChamada, filtroLinha, lerNota]);

  /* ───────────── Ações: Aprovar Exposição ───────────── */
  async function aprovarExposicao(s) {
    if (!s?.id) return;
    if (!confirm(`Aprovar EXPOSIÇÃO de "${s.titulo}"?`)) return;

    // se já está aprovado oral, mantemos
    const jaOral = hasAprovOral(s) || Boolean(s._oral_aprovada);

    try {
      setWorkingExpoId(s.id);

      // patch envia os campos novos + status global retrocompatível
      const patch = {
        status: "aprovado_exposicao",
        status_escrita: "aprovado", // pôster/exposição
        status_oral: jaOral ? "aprovado" : s.status_oral ?? null,
        observacoes_admin: null,
      };

      await api.post(`/admin/submissoes/${s.id}/status`, patch);

      onStatusChange?.(s.id, {
        status: "aprovado_exposicao",
        _exposicao_aprovada: true,
        _oral_aprovada: jaOral,
        status_escrita: "aprovado",
        ...(jaOral ? { status_oral: "aprovado" } : {}),
      });
    } catch (e) {
      console.error("Falha ao aprovar exposição:", e);
      alert("Não foi possível aprovar a exposição.");
    } finally {
      setWorkingExpoId(null);
    }
  }

  /* ───────────── Ações: Aprovar Oral ───────────── */
  async function aprovarOral(s) {
    if (!s?.id) return;
    if (!confirm(`Aprovar APRESENTAÇÃO ORAL de "${s.titulo}"?`)) return;

    const jaExpo = hasAprovExposicao(s) || Boolean(s._exposicao_aprovada);

    try {
      setWorkingOralId(s.id);

      const patch = {
        status: "aprovado_oral",
        status_oral: "aprovado", // fala/apresentação oral
        status_escrita: jaExpo ? "aprovado" : s.status_escrita ?? null,
        observacoes_admin: null,
      };

      await api.post(`/admin/submissoes/${s.id}/status`, patch);

      onStatusChange?.(s.id, {
        status: "aprovado_oral",
        _oral_aprovada: true,
        _exposicao_aprovada: jaExpo,
        status_oral: "aprovado",
        ...(jaExpo ? { status_escrita: "aprovado" } : {}),
      });
    } catch (e) {
      console.error("Falha ao aprovar apresentação oral:", e);
      alert("Não foi possível aprovar a apresentação oral.");
    } finally {
      setWorkingOralId(null);
    }
  }

  /* ───────────── Ações: Reprovar ───────────── */
  async function reprovar(s) {
    if (!s?.id) return;
    if (!confirm(`Reprovar totalmente "${s.titulo}"?`)) return;

    try {
      setWorkingReprovarId(s.id);

      await api.post(`/admin/submissoes/${s.id}/status`, {
        status: "reprovado",
        observacoes_admin: null,
      });

      onStatusChange?.(s.id, {
        status: "reprovado",
        _exposicao_aprovada: false,
        _oral_aprovada: false,
      });
    } catch (e) {
      console.error("Falha ao reprovar:", e);
      alert("Não foi possível alterar o status.");
    } finally {
      setWorkingReprovarId(null);
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
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        ref={dialogRef}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden
          rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-900 sm:max-w-5xl sm:rounded-2xl"
      >
        {/* ---------- HEADER / FILTROS ---------- */}
        <div className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
          {/* título + botão fechar */}
          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-start gap-2 sm:items-center">
              <div className="rounded-lg bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-600 p-2 text-white shadow">
                <Trophy className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-lg font-bold sm:text-xl">
                  Ranking por Nota
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Ordenado pela maior média geral de avaliação
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              data-autofocus
              className="inline-flex items-center justify-center gap-1 rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
            >
              <X className="h-4 w-4" />
              Fechar
            </button>
          </div>

          {/* filtros */}
          <div className="px-4 pb-4 sm:px-6">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por título, autor, linha…"
                className="w-full rounded-xl border px-3 py-2 text-sm ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-600 dark:border-zinc-700 dark:bg-zinc-800"
                aria-label="Buscar no ranking"
              />

              <select
                value={filtroChamada}
                onChange={(e) => {
                  setFiltroChamada(e.target.value);
                  setFiltroLinha("__all__");
                }}
                className="w-full rounded-xl border px-3 py-2 text-sm ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-600 dark:border-zinc-700 dark:bg-zinc-800"
              >
                {opcoesChamadas.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              <select
                value={filtroLinha}
                onChange={(e) => setFiltroLinha(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-600 dark:border-zinc-700 dark:bg-zinc-800"
              >
                {opcoesLinha.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ---------- LISTAGEM ---------- */}
        <div className="flex-1 overflow-y-auto">
          {/* MOBILE: cards */}
          <ul className="space-y-3 px-4 pb-4 sm:hidden">
            {ordenados.length === 0 && (
              <li className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-600 dark:border-zinc-800">
                Nada encontrado.
              </li>
            )}

            {ordenados.map((s) => {
              const wExpo = workingExpoId === s.id;
              const wO = workingOralId === s.id;
              const wR = workingReprovarId === s.id;

              const okExpo = hasAprovExposicao(s) || Boolean(s._exposicao_aprovada);
              const okO = hasAprovOral(s) || Boolean(s._oral_aprovada);
              const algumAprovado = okExpo || okO;

              return (
                <li
                  key={s.id}
                  className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {/* barrinha topo no estilo CardEventoAdministrador */}
                  <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-600" />

                  <div className="p-4">
                    {/* ministats: rank e nota */}
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Posição
                        </span>
                        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-600 px-2 text-sm font-bold text-white">
                          {s._rank}
                        </span>
                      </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Nota
                      </div>
                      <div className="text-2xl font-extrabold leading-none">
                        {fmtNum(s._nota, 1)}
                      </div>
                    </div>
                  </div>

                  {/* título */}
                  <h4 className="mb-2 break-words text-base font-semibold">
                    {s.titulo}
                  </h4>

                  {/* linha temática + chamada */}
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                      {s.linha_tematica_nome || "Sem linha temática"}
                    </span>

                    {s.chamada_titulo && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {s.chamada_titulo}
                      </span>
                    )}
                  </div>

                  {/* aprovações */}
                               <div className="mb-3 flex flex-wrap gap-2">
                    <StatusBadge status={s.status} />
                    {okExpo && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
                        <CheckCircle className="h-3.5 w-3.5" /> Exposição
                      </span>
                    )}
                    {okO && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
                        <CheckCircle className="h-3.5 w-3.5" /> Apresentação oral
                      </span>
                    )}
                  </div>                     

                  {/* autor */}
                  <div className="mb-4">
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Autor
                    </div>
                    <div className="break-words text-sm font-medium">
                      {fmt(s.autor_nome)}
                    </div>
                    <div className="break-all text-[11px] text-zinc-500 dark:text-zinc-400">
                      {fmt(s.autor_email)}
                    </div>
                  </div>

                  {/* ações */}
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => aprovarExposicao(s)}
                        disabled={wExpo}
                        className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                        aria-label={`Aprovar exposição de ${s.titulo}`}
                      >
                        {wExpo ? (
                          <Loader2 className="inline h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="inline h-4 w-4" />
                        )}{" "}
                        Exposição
                      </button>

                      <button
                        onClick={() => aprovarOral(s)}
                        disabled={wO}
                        className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                        aria-label={`Aprovar apresentação oral de ${s.titulo}`}
                      >
                        {wO ? (
                          <Loader2 className="inline h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="inline h-4 w-4" />
                        )}{" "}
                        Oral
                      </button>
                    </div>

                    <button
                      onClick={() => reprovar(s)}
                      disabled={wR}
                      className="w-full rounded-xl bg-rose-600 px-3 py-2 font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                      aria-label={`Reprovar ${s.titulo}`}
                    >
                      {wR ? (
                        <Loader2 className="inline h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="inline h-4 w-4" />
                      )}{" "}
                      Reprovar
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

          {/* DESKTOP: tabela */}
          <div className="hidden sm:block">
            <table className="w-full table-fixed text-sm">
              <thead className="sticky top-0 z-10 bg-amber-600 text-white">
                <tr>
                  <th className="w-10 p-2 text-left align-top">#</th>
                  <th className="w-[28%] p-2 text-left align-top break-words">
                    Título
                  </th>
                  <th className="w-[18%] p-2 text-left align-top break-words">
                    Autor
                  </th>
                  <th className="w-[16%] p-2 text-left align-top break-words">
                    Chamada
                  </th>
                  <th className="w-[16%] p-2 text-left align-top break-words">
                    Linha Temática
                  </th>
                  <th className="w-[14%] p-2 text-center align-top break-words">
                    Aprovações
                  </th>
                  <th className="w-[28%] p-2 text-center align-top break-words">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {ordenados.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-zinc-600 dark:text-zinc-400"
                    >
                      Nada encontrado.
                    </td>
                  </tr>
                )}

                {ordenados.map((s) => {
                  const wExpo = workingExpoId === s.id;
                  const wO = workingOralId === s.id;
                  const wR = workingReprovarId === s.id;

                  const okExpo = hasAprovExposicao(s) || Boolean(s._exposicao_aprovada);
                  const okO = hasAprovOral(s) || Boolean(s._oral_aprovada);
                  const algumAprovado = okExpo || okO;

                  return (
                    <tr
                      key={s.id}
                      className="align-top border-b dark:border-zinc-800"
                    >
                      <td className="p-2 font-semibold text-zinc-700 dark:text-zinc-200">
                        {s._rank}
                        <div className="text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                          Nota {fmtNum(s._nota, 1)}
                        </div>
                      </td>

                      <td className="p-2 break-words">
                        <div className="font-medium">{s.titulo}</div>
                      </td>

                      <td className="p-2 break-words">
                        <div>{s.autor_nome}</div>
                        <div className="break-all text-[11px] text-zinc-500 dark:text-zinc-400">
                          {s.autor_email}
                        </div>
                      </td>

                      <td className="p-2 break-words">
                        {s.chamada_titulo}
                      </td>

                      <td className="p-2 break-words">
                        {s.linha_tematica_nome || "—"}
                      </td>

                      {/* Aprovações */}
                      <td className="p-2 text-center">
  <div className="inline-flex max-w-[9rem] flex-wrap justify-center gap-1.5">
    <StatusBadge status={s.status} />
    {okExpo && (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
        <CheckCircle className="h-3.5 w-3.5" /> Exposição
      </span>
    )}
    {okO && (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
        <CheckCircle className="h-3.5 w-3.5" /> Oral
      </span>
    )}
  </div>
</td>

                      {/* Ações */}
                      <td className="p-2">
                        <div className="flex flex-wrap items-center justify-center gap-2 text-[12px]">
                          <button
                            onClick={() => aprovarExposicao(s)}
                            disabled={wExpo}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                            aria-label={`Aprovar exposição de ${s.titulo}`}
                          >
                            {wExpo ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            Exposição
                          </button>

                          <button
                            onClick={() => aprovarOral(s)}
                            disabled={wO}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                            aria-label={`Aprovar apresentação oral de ${s.titulo}`}
                          >
                            {wO ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            Oral
                          </button>

                          <button
                            onClick={() => reprovar(s)}
                            disabled={wR}
                            className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                            aria-label={`Reprovar ${s.titulo}`}
                          >
                            {wR ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
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

        {/* ---------- Rodapé explicativo ---------- */}
        <div className="border-t px-4 py-3 text-[11px] leading-relaxed text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Em <b>Aprovações</b>, mostramos apenas as modalidades realmente
          aprovadas: <b>Exposição</b> (painel/pôster) e <b>Oral</b>
          (apresentação ao vivo). Se ainda não houver aprovação, o campo
          fica em branco.
        </div>

        <AnimatePresence />
      </motion.div>
    </div>
  );
}
