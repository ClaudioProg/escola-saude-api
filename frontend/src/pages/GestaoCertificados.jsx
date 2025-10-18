// 📁 frontend/src/pages/GestaoCertificados.jsx
/* eslint-disable no-alert */
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { apiGet, apiPost } from "../services/api";
import { fmtDataHora } from "../utils/data";
import {
  ChevronDown,
  ChevronRight,
  RefreshCcw,
  Trash2,
  Download,
  Award,
} from "lucide-react";

/* ───────── HeaderHero (cor única desta página) ───────── */
function HeaderHero({ onRefresh, loading }) {
  return (
    <header className="bg-amber-700 text-white" role="banner">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-8 md:py-9 min-h-[140px] sm:min-h-[170px]">
        <div className="flex flex-col items-center text-center gap-2.5 sm:gap-3">
          <div className="inline-flex items-center justify-center gap-2">
            <Award className="w-6 h-6" aria-hidden="true" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Gestão de Certificados
            </h1>
          </div>
          <p className="text-sm sm:text-base text-white/90 max-w-2xl">
            Emita, revise e baixe certificados por evento e turma.
          </p>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
              loading
                ? "opacity-60 cursor-not-allowed bg-white/20"
                : "bg-white/15 hover:bg-white/25"
            } text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}
            aria-label="Atualizar árvore de certificados"
            aria-busy={loading ? "true" : "false"}
          >
            <RefreshCcw className="w-4 h-4" aria-hidden="true" />
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      <div
        className="h-px w-full bg-white/25"
        aria-hidden="true"
      />
    </header>
  );
}

/* ───────── Collapser acessível ───────── */
function Collapser({ id, open, onToggle, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1 text-left ${className}`}
      aria-expanded={open}
      aria-controls={id}
    >
      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      {children}
    </button>
  );
}

/* ───────── Página ───────── */
export default function GestaoCertificados() {
  const [data, setData] = useState([]); // [{evento_id, evento_titulo, turmas:[...]}]
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [openEventos, setOpenEventos] = useState({});
  const [openTurmas, setOpenTurmas] = useState({}); // key `${evento_id}:${turma_id}`

  const fetchData = async () => {
    try {
      setLoading(true);
      setErr("");
      const rows = await apiGet(`/certificados-admin/arvore`);
      setData(Array.isArray(rows) ? rows : []);
    } catch (e) {
      const msg = e?.message || "Falha ao carregar.";
      setErr(msg);
      toast.error(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totaisGeral = useMemo(() => {
    let presentes = 0,
      emitidos = 0,
      pendentes = 0;
    for (const ev of data) {
      for (const t of ev.turmas || []) {
        presentes += t?.totais?.presentes || 0;
        emitidos += t?.totais?.emitidos || 0;
        pendentes += t?.totais?.pendentes || 0;
      }
    }
    return { presentes, emitidos, pendentes };
  }, [data]);

  const doResetTurma = async (turmaId) => {
    if (!window.confirm(`Resetar certificados dos participantes da turma #${turmaId}?`))
      return;
    try {
      await apiPost(`/certificados-admin/turmas/${turmaId}/reset`, {});
      toast.success("✅ Reset concluído.");
      await fetchData();
    } catch (e) {
      const msg = e?.message || "Falha ao resetar.";
      toast.error(`❌ ${msg}`);
    }
  };

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* Header */}
      <HeaderHero onRefresh={fetchData} loading={loading} />

      <div id="conteudo" className="mx-auto max-w-6xl p-4 sm:px-6 lg:px-8">
        {/* Ministats (sólidos, sem degradê) */}
        <section
          aria-label="Totais de certificação"
          className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow p-4">
            <p className="text-xs text-zinc-600 dark:text-zinc-300 mb-1">Presentes</p>
            <p className="text-3xl font-extrabold text-lousa dark:text-white">
              {totaisGeral.presentes}
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow p-4">
            <p className="text-xs text-zinc-600 dark:text-zinc-300 mb-1">Emitidos</p>
            <p className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300">
              {totaisGeral.emitidos}
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow p-4">
            <p className="text-xs text-zinc-600 dark:text-zinc-300 mb-1">Pendentes</p>
            <p className="text-3xl font-extrabold text-amber-700 dark:text-amber-300">
              {totaisGeral.pendentes}
            </p>
          </div>
        </section>

        {/* Barra de ações (redundante ao hero, mas útil no scroll) */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold">
            Certificados — visão por Evento/Turma
          </h2>
          <button
            onClick={fetchData}
            disabled={loading}
            className="rounded-xl bg-zinc-100 px-3 py-2 text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            aria-label="Atualizar árvore de certificados"
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />{" "}
              {loading ? "Atualizando…" : "Atualizar"}
            </span>
          </button>
        </div>

        {!!err && !loading && (
          <p className="mb-3 text-sm text-rose-600" role="alert">
            {err}
          </p>
        )}

        {loading ? (
          <div className="text-sm text-zinc-500">Carregando…</div>
        ) : data.length === 0 ? (
          <div className="text-sm text-zinc-500">Nenhum evento encontrado.</div>
        ) : (
          <div className="grid gap-3">
            {data.map((ev) => {
              const evOpen = !!openEventos[ev.evento_id];
              const evId = `evento-${ev.evento_id}`;
              return (
                <div
                  key={ev.evento_id}
                  className="rounded-2xl border bg-white dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {/* Evento */}
                  <div className="flex items-center justify-between p-3">
                    <Collapser
                      id={evId}
                      open={evOpen}
                      onToggle={() =>
                        setOpenEventos((s) => ({ ...s, [ev.evento_id]: !evOpen }))
                      }
                      className="text-base font-medium"
                    >
                      {ev.evento_titulo}
                    </Collapser>
                    <div className="text-xs text-zinc-500">
                      {(ev.turmas || []).length} turma(s)
                    </div>
                  </div>

                  {evOpen && (
                    <div id={evId} className="border-t dark:border-zinc-800">
                      {(ev.turmas || []).map((t) => {
                        const key = `${ev.evento_id}:${t.turma_id}`;
                        const tOpen = !!openTurmas[key];
                        const tId = `turma-${ev.evento_id}-${t.turma_id}`;
                        return (
                          <div
                            key={t.turma_id}
                            className="border-b last:border-b-0 dark:border-zinc-800"
                          >
                            {/* Turma header */}
                            <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                              <div className="min-w-0">
                                <Collapser
                                  id={tId}
                                  open={tOpen}
                                  onToggle={() =>
                                    setOpenTurmas((s) => ({ ...s, [key]: !tOpen }))
                                  }
                                  className="font-medium"
                                >
                                  Turma #{t.turma_id} — {t.turma_nome || "Sem título"}
                                </Collapser>
                                <div className="text-xs text-zinc-500">
                                  {t.data_inicio ? fmtDataHora(t.data_inicio) : "—"} →{" "}
                                  {t.data_fim ? fmtDataHora(t.data_fim) : "—"}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 text-xs">
                                <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                                  Presentes:{" "}
                                  <strong>{t?.totais?.presentes ?? 0}</strong>
                                </span>
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                                  Emitidos:{" "}
                                  <strong>{t?.totais?.emitidos ?? 0}</strong>
                                </span>
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                  Pendentes:{" "}
                                  <strong>{t?.totais?.pendentes ?? 0}</strong>
                                </span>

                                <button
                                  onClick={() => doResetTurma(t.turma_id)}
                                  className="ml-2 inline-flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                                  title="Resetar certificados desta turma"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                  Resetar turma
                                </button>
                              </div>
                            </div>

                            {/* Participantes */}
                            {tOpen && (
                              <div id={tId} className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                  <thead>
                                    <tr className="text-left text-zinc-600 dark:text-zinc-300">
                                      <th className="py-2 pl-3 pr-4">Usuário</th>
                                      <th className="py-2 pr-4">Email</th>
                                      <th className="py-2 pr-4">Status</th>
                                      <th className="py-2 pr-4">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(t.participantes || []).map((p) => {
                                      const has = p?.emitido && p?.certificado_id;
                                      const href = has
                                        ? `/api/certificados/${p.certificado_id}/download`
                                        : null;
                                      return (
                                        <tr
                                          key={p.usuario_id}
                                          className="border-t dark:border-zinc-800"
                                        >
                                          <td className="py-2 pl-3 pr-4">
                                            {p?.nome || "—"}
                                          </td>
                                          <td className="py-2 pr-4">
                                            {p?.email || "—"}
                                          </td>
                                          <td className="py-2 pr-4">
                                            {has ? (
                                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                                                Emitido
                                              </span>
                                            ) : (
                                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                                Pendente
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 pr-4">
                                            {has ? (
                                              <a
                                                href={href}
                                                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                                              >
                                                <Download className="h-4 w-4" aria-hidden="true" />
                                                Baixar
                                              </a>
                                            ) : (
                                              <span className="text-zinc-400">—</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    {(t.participantes || []).length === 0 && (
                                      <tr>
                                        <td
                                          className="py-3 pl-3 text-zinc-500"
                                          colSpan={4}
                                        >
                                          Sem participantes presentes.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
