import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy, Loader2, CheckCircle, XCircle, CalendarDays } from "lucide-react";
import api from "../services/api";

/* ─── Helpers ─── */
const fmt = (v, alt = "—") => (v === 0 || !!v ? String(v) : alt);
const fmtNum = (v, d = 1) => Number(v ?? 0).toFixed(d);

/** Normaliza leitura de aprovações parciais (retrocompatível) */
function hasAprovExposicao(s) {
  const se = String(s?.status_escrita || "").toLowerCase();
  const st = String(s?.status || "").toLowerCase();
  // aceita tanto o legado (aprovado_escrita) quanto o novo (aprovado_exposicao)
  return se === "aprovado" || st === "aprovado_exposicao" || st === "aprovado_escrita";
}
function hasAprovOral(s) {
  const so = String(s?.status_oral || "").toLowerCase();
  const st = String(s?.status || "").toLowerCase();
  return so === "aprovado" || st === "aprovado_oral";
}
function isReprovado(s) {
  return String(s?.status || "").toLowerCase() === "reprovado";
}
/** Detecta “finalizado” com vários nomes comuns + flag local _finalizado */
function isFinalizado(s) {
  return Boolean(
    s?._finalizado ||
      s?.finalizado ||
      s?.avaliacao_finalizada ||
      s?.avaliacaoFinalizada ||
      s?.fechado ||
      s?.encerrado
  );
}

export default function RankingModal({
  open,
  onClose,
  itens = [],
  onStatusChange, // (id, novoStatus) -> parent pode atualizar
  onFinalize,     // (id, finalizadoBool) -> opcional (atualiza flag finalização no pai)
}) {
  const dialogRef = useRef(null);
  const [busca, setBusca] = useState("");
  const [filtroChamada, setFiltroChamada] = useState("__all__");
  const [filtroLinha, setFiltroLinha] = useState("__all__");

  // working flags independentes por ação
  const [workingExpoId, setWorkingExpoId] = useState(null);
  const [workingOralId, setWorkingOralId] = useState(null);
  const [workingReprovarId, setWorkingReprovarId] = useState(null);
  const [workingFinalizarId, setWorkingFinalizarId] = useState(null);

  /* ─── Acessibilidade e foco ─── */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    setTimeout(() => dialogRef.current?.querySelector?.("[data-autofocus]")?.focus?.(), 0);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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

  /* ─── Opções de chamadas ─── */
  const opcoesChamadas = useMemo(() => {
    const mapa = new Map();
    for (const s of itens) {
      const nome = (s?.chamada_titulo || "").trim();
      if (nome) mapa.set(nome, nome);
    }
    const arr = Array.from(mapa.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return [{ value: "__all__", label: "Todas as chamadas" }, ...arr.map((v) => ({ value: v, label: v }))];
  }, [itens]);

  /* ─── Opções de linhas temáticas filtradas pela chamada ─── */
  const opcoesLinha = useMemo(() => {
    const mapa = new Map();
    for (const s of itens) {
      const nome = (s?.linha_tematica_nome || "").trim();
      const chamada = (s?.chamada_titulo || "").trim();
      if (!nome) continue;
      if (filtroChamada !== "__all__" && chamada !== filtroChamada) continue;
      mapa.set(nome, nome);
    }
    const arr = Array.from(mapa.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return [{ value: "__all__", label: "Todas as linhas" }, ...arr.map((v) => ({ value: v, label: v }))];
  }, [itens, filtroChamada]);

  /* ─── Lista ordenada e filtrada ─── */
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
          filtroChamada === "__all__" || (s.chamada_titulo || "").trim() === filtroChamada;
        const atendeLinha =
          filtroLinha === "__all__" || (s.linha_tematica_nome || "").trim() === filtroLinha;
        return atendeBusca && atendeChamada && atendeLinha;
      })
      .sort((a, b) => b._nota - a._nota || a.id - b.id)
      .map((s, i) => ({ ...s, _rank: i + 1 }));
  }, [itens, busca, filtroChamada, filtroLinha, lerNota]);

  /* ─── Ações ─── */
  async function aprovarExposicao(s) {
    if (!s?.id) return;
    if (!confirm(`Aprovar **EXPOSIÇÃO** de "${s.titulo}"?`)) return;

    const jaOral = hasAprovOral(s) || Boolean(s._oral_aprovada);

    try {
      setWorkingExpoId(s.id);

      const patch = {
        status: s.status || "aprovado_exposicao",
        status_escrita: "aprovado",
        ...(jaOral ? { status_oral: "aprovado" } : {}),
        observacoes_admin: null,
      };

      await api.post(`/admin/submissoes/${s.id}/status`, patch);

      onStatusChange?.(s.id, {
        status: jaOral ? (s.status || "aprovado_exposicao") : "aprovado_exposicao",
        _exposicao_aprovada: true,
        ...(jaOral ? { _oral_aprovada: true } : {}),
      });
    } catch (e) {
      console.error("Falha ao aprovar exposição:", e);
      alert("Não foi possível aprovar a exposição.");
    } finally {
      setWorkingExpoId(null);
    }
  }

  async function aprovarOral(s) {
    if (!s?.id) return;
    if (!confirm(`Aprovar **APRESENTAÇÃO ORAL** de "${s.titulo}"?`)) return;

    const jaExpo = hasAprovExposicao(s) || Boolean(s._exposicao_aprovada);

    try {
      setWorkingOralId(s.id);

      const patch = {
        status: s.status || "aprovado_oral",
        status_oral: "aprovado",
        ...(jaExpo ? { status_escrita: "aprovado" } : {}),
        observacoes_admin: null,
      };

      await api.post(`/admin/submissoes/${s.id}/status`, patch);

      onStatusChange?.(s.id, {
        status: jaExpo ? (s.status || "aprovado_oral") : "aprovado_oral",
        _oral_aprovada: true,
        ...(jaExpo ? { _exposicao_aprovada: true } : {}),
      });
    } catch (e) {
      console.error("Falha ao aprovar apresentação oral:", e);
      alert("Não foi possível aprovar a apresentação oral.");
    } finally {
      setWorkingOralId(null);
    }
  }

  async function reprovar(s) {
    if (!s?.id) return;
    if (!confirm(`Reprovar totalmente "${s.titulo}"?`)) return;
    try {
      setWorkingReprovarId(s.id);
      await api.post(`/admin/submissoes/${s.id}/status`, {
        status: "reprovado",
        observacoes_admin: null,
      });
      onStatusChange?.(s.id, { status: "reprovado", _exposicao_aprovada: false, _oral_aprovada: false });
    } catch (e) {
      console.error("Falha ao reprovar:", e);
      alert("Não foi possível alterar o status.");
    } finally {
      setWorkingReprovarId(null);
    }
  }

  /** Finalização: apaga pendências visuais e (se existir) marca no backend */
  async function finalizarAvaliacao(s) {
    if (!s?.id) return;
    if (
      !confirm(
        `Finalizar avaliação de "${s.titulo}"?\n• Aprovados permanecem aprovados\n• Reprovados permanecem reprovados\n• Pendências deixam de ser exibidas ao usuário`
      )
    )
      return;

    const attempts = [
      () => api.post(`/admin/submissoes/${s.id}/finalizar`, { finalizado: true }),
      () => api.post(`/admin/submissoes/${s.id}/fechar-avaliacao`, { finalizado: true }),
    ];

    try {
      setWorkingFinalizarId(s.id);
      let ok = false;
      for (const fn of attempts) {
        try {
          await fn();
          ok = true;
          break;
        } catch (err) {
          /* tenta próximo */
        }
      }
      if (!ok) {
        console.warn("Nenhum endpoint de finalização respondeu; aplicando flag local.");
      }
      onFinalize?.(s.id, true);
      onStatusChange?.(s.id, { _finalizado: true });

      alert("Avaliação finalizada. Pendências não serão mais exibidas ao autor.");
    } catch (e) {
      console.error("Falha ao finalizar:", e);
      alert("Não foi possível finalizar a avaliação.");
    } finally {
      setWorkingFinalizarId(null);
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
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden
          rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-900 sm:max-w-5xl sm:rounded-2xl"
      >
        {/* Header sticky */}
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
            >
              <X className="h-4 w-4" /> Fechar
            </button>
          </div>

          {/* Filtros */}
          <div className="px-4 pb-4 sm:px-6">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por título, autor, linha…"
                className="sm:col-span-1 w-full rounded-xl border px-3 py-2 text-sm ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-600 dark:border-zinc-700 dark:bg-zinc-800"
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

        {/* ====== Conteúdo ====== */}
        <div className="flex-1 overflow-y-auto">
          {/* ====== MOBILE (cards) ====== */}
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
              const okO    = hasAprovOral(s)      || Boolean(s._oral_aprovada);
              const reprov = isReprovado(s);
              const final = isFinalizado(s);
              const algumAprovado = okExpo || okO;

              return (
                <li
                  key={s.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {/* Topo: rank + nota */}
                  <div className="mb-2 flex items-center justify-between">
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-600 px-2 text-sm font-bold text-white">
                      {s._rank}
                    </span>
                    <div className="text-right">
                      <div className="text-xs text-zinc-500">Nota</div>
                      <div className="text-2xl font-extrabold leading-none">{fmtNum(s._nota, 1)}</div>
                    </div>
                  </div>

                  {/* Título */}
                  <h4 className="mb-1 line-clamp-3 break-words text-base font-semibold">{s.titulo}</h4>

                  {/* Linha temática + chamada */}
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
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

                  {/* Aprovações (regra nova) */}
                  <div className="mb-3 flex flex-wrap gap-2">
                    {algumAprovado ? (
                      <>
                        {okExpo && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                            <CheckCircle className="h-3.5 w-3.5" /> Exposição
                          </span>
                        )}
                        {okO && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                            <CheckCircle className="h-3.5 w-3.5" /> Apresentação oral
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="rounded-full px-2 py-1 text-xs bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        Pendente
                      </span>
                    )}
                  </div>

                  {/* Autor */}
                  <div className="mb-3">
                    <div className="text-xs text-zinc-500">Autor</div>
                    <div className="break-words font-medium">{fmt(s.autor_nome)}</div>
                    <div className="break-all text-xs text-zinc-500">{fmt(s.autor_email)}</div>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => aprovarExposicao(s)}
                        disabled={wExpo}
                        className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                        aria-label={`Aprovar exposição de ${s.titulo}`}
                      >
                        {wExpo ? <Loader2 className="h-4 w-4 animate-spin inline" /> : <CheckCircle className="h-4 w-4 inline" />}{" "}
                        Aprovar Exposição
                      </button>
                      <button
                        onClick={() => aprovarOral(s)}
                        disabled={wO}
                        className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                        aria-label={`Aprovar apresentação oral de ${s.titulo}`}
                      >
                        {wO ? <Loader2 className="h-4 w-4 animate-spin inline" /> : <CheckCircle className="h-4 w-4 inline" />}{" "}
                        Aprovar Apresentação oral
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => finalizarAvaliacao(s)}
                        disabled={workingFinalizarId === s.id}
                        className="flex-1 rounded-xl bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
                        aria-label={`Finalizar avaliação de ${s.titulo}`}
                        title="Finalizar: oculta pendências ao autor"
                      >
                        {workingFinalizarId === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin inline" />
                        ) : (
                          <CheckCircle className="h-4 w-4 inline" />
                        )}{" "}
                        Finalizar avaliação
                      </button>
                      <button
                        onClick={() => reprovar(s)}
                        disabled={wR}
                        className="flex-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                        aria-label={`Reprovar ${s.titulo}`}
                      >
                        {wR ? <Loader2 className="h-4 w-4 animate-spin inline" /> : <XCircle className="h-4 w-4 inline" />} Reprovar
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* ====== DESKTOP (tabela) ====== */}
          <div className="hidden sm:block">
            <table className="w-full table-fixed text-sm">
              <thead className="sticky top-0 z-10 bg-amber-600 text-white">
                <tr>
                  <th className="w-10 p-2 text-left">#</th>
                  <th className="w-[32%] p-2 text-left">Título</th>
                  <th className="w-[18%] p-2 text-left">Autor</th>
                  <th className="w-[18%] p-2 text-left">Chamada</th>
                  <th className="w-[16%] p-2 text-left">Linha Temática</th>
                  <th className="w-[18%] p-2 text-center">Aprovações</th>
                  <th className="w-[32%] p-2 text-center">Ações</th>
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
                  const wExpo = workingExpoId === s.id;
                  const wO = workingOralId === s.id;
                  const wR = workingReprovarId === s.id;
                  const okExpo = hasAprovExposicao(s) || Boolean(s._exposicao_aprovada);
                  const okO    = hasAprovOral(s)      || Boolean(s._oral_aprovada);
                  const reprov = isReprovado(s);
                  const final = isFinalizado(s);
                  const algumAprovado = okExpo || okO;

                  return (
                    <tr key={s.id} className="align-top border-b dark:border-zinc-800">
                      <td className="p-2 font-semibold text-zinc-700 dark:text-zinc-200">{s._rank}</td>
                      <td className="p-2">
                        <div className="break-words font-medium">{s.titulo}</div>
                      </td>
                      <td className="p-2">
                        <div className="break-words">{s.autor_nome}</div>
                        <div className="break-all text-xs text-zinc-500">{s.autor_email}</div>
                      </td>
                      <td className="p-2">{s.chamada_titulo}</td>
                      <td className="p-2">{s.linha_tematica_nome || "—"}</td>

                      {/* Aprovações (regra nova) */}
                      <td className="p-2 text-center">
                        {algumAprovado ? (
                          <div className="inline-flex flex-wrap gap-1.5 justify-center">
                            {okExpo && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                                <CheckCircle className="h-3.5 w-3.5" /> Exposição
                              </span>
                            )}
                            {okO && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                                <CheckCircle className="h-3.5 w-3.5" /> Apresentação oral
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="rounded-full px-2 py-0.5 text-xs bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                            Pendente
                          </span>
                        )}
                      </td>

                      <td className="p-2">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            onClick={() => aprovarExposicao(s)}
                            disabled={wExpo}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-60"
                            aria-label={`Aprovar exposição de ${s.titulo}`}
                          >
                            {wExpo ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            Aprovar Exposição
                          </button>
                          <button
                            onClick={() => aprovarOral(s)}
                            disabled={wO}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-60"
                            aria-label={`Aprovar apresentação oral de ${s.titulo}`}
                          >
                            {wO ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            Aprovar Apresentação oral
                          </button>
                          <button
                            onClick={() => finalizarAvaliacao(s)}
                            disabled={workingFinalizarId === s.id}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-700 px-3 py-1.5 text-white hover:bg-amber-800 disabled:opacity-60"
                            aria-label={`Finalizar avaliação de ${s.titulo}`}
                            title="Finalizar: oculta pendências ao autor"
                          >
                            {workingFinalizarId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            Finalizar avaliação
                          </button>
                          <button
                            onClick={() => reprovar(s)}
                            disabled={wR}
                            className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-white hover:bg-rose-700 disabled:opacity-60"
                            aria-label={`Reprovar ${s.titulo}`}
                          >
                            {wR ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
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
          Em <b>Aprovações</b> exibimos somente os selos das modalidades realmente <b>aprovadas</b>.
          Se nenhuma estiver aprovada, mostramos um único chip <b>Pendente</b>.
        </div>
        <AnimatePresence />
      </motion.div>
    </div>
  );
}
