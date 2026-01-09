// 📁 frontend/src/pages/GestaoCertificados.jsx
/* eslint-disable no-alert */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { apiGet, apiPost, makeApiUrl } from "../services/api";
import { fmtDataHora } from "../utils/data";
import { useReducedMotion } from "framer-motion";
import Footer from "../components/Footer";
import {
  ChevronDown,
  ChevronRight,
  RefreshCcw,
  Trash2,
  Download,
  Award,
  AlertTriangle,
} from "lucide-react";

/* ───────────────────────── Date helpers (date-only safe) ───────────────────────── */
const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const onlyHHmm = (s) =>
  typeof s === "string" && /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : null;

const hojeYMD = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function toComparableTime(tsOrYmd, fallbackHHmm = "12:00") {
  // ✅ evita new Date("YYYY-MM-DD") diretamente (pode dar shift)
  const raw = String(tsOrYmd || "");
  if (!raw) return null;

  // Timestamp/ISO com horário -> Date ok
  if (raw.includes("T")) {
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : null;
  }

  // Date-only -> monta com HH:mm seguro
  const d = ymd(raw);
  if (!d) return null;
  const hhmm = onlyHHmm(fallbackHHmm) || "12:00";
  const t = new Date(`${d}T${hhmm}:00`).getTime();
  return Number.isFinite(t) ? t : null;
}

/* ───────────────────────── Helpers de status/cores ───────────────────────── */
/** Preferimos usar t.status vindo do backend; se não houver, inferimos de forma date-safe. */
function inferTurmaStatus(t) {
  const s = String(t?.status || "").toLowerCase();
  if (s === "programado" || s === "andamento" || s === "encerrado") return s;

  // fallback simples por data/hora (date-only safe)
  try {
    const now = Date.now();

    // data_inicio/data_fim podem ser "YYYY-MM-DD" ou ISO completo
    const ini = toComparableTime(t?.data_inicio, "00:00");
    const fim = toComparableTime(t?.data_fim, "23:59");

    if (ini && now < ini) return "programado";
    if (ini && fim && now >= ini && now <= fim) return "andamento";
    if (fim && now > fim) return "encerrado";

    // fallback final por ymd se só houver date-only sem parse
    const di = ymd(t?.data_inicio);
    const df = ymd(t?.data_fim);
    const hoje = hojeYMD();
    if (di && hoje < di) return "programado";
    if (di && df && hoje >= di && hoje <= df) return "andamento";
    if (df && hoje > df) return "encerrado";
  } catch {
    /* noop */
  }
  return "programado";
}

/** Agrega status do evento a partir das turmas: prioridade andamento > programado > encerrado */
function eventoStatus(ev) {
  const turmas = ev?.turmas || [];
  const hasAndamento = turmas.some((t) => inferTurmaStatus(t) === "andamento");
  const hasProgramado = turmas.some((t) => inferTurmaStatus(t) === "programado");
  if (hasAndamento) return "andamento";
  if (hasProgramado) return "programado";
  return "encerrado";
}

/** Barrinha por status (padrão institucional memorizado) */
function statusBarClass(status) {
  switch (status) {
    case "programado":
      return "bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400";
    case "andamento":
      return "bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400";
    case "encerrado":
      return "bg-gradient-to-r from-rose-700 via-rose-600 to-rose-500";
    default:
      return "bg-gradient-to-r from-zinc-700 via-zinc-600 to-zinc-500";
  }
}

/** Badges consistentes */
function Badge({ tone = "zinc", children, className = "" }) {
  const tones = {
    zinc: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    rose: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${tones[tone] || tones.zinc} ${className}`}
    >
      {children}
    </span>
  );
}

/* ───────── HeaderHero (tema único desta página) ───────── */
function HeaderHero({ onRefresh, loading }) {
  return (
    <header
      className="text-white bg-gradient-to-br from-amber-900 via-orange-700 to-rose-600"
      role="banner"
    >
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
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition
              ${loading ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"}
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}
            aria-label="Atualizar árvore de certificados"
            aria-busy={loading ? "true" : "false"}
          >
            <RefreshCcw className="w-4 h-4" aria-hidden="true" />
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      <div className="h-px w-full bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* ───────── Collapser acessível ───────── */
function Collapser({ id, open, onToggle, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1 text-left min-w-0 ${className}`}
      aria-expanded={open}
      aria-controls={id}
    >
      {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
      <span className="min-w-0 break-words">{children}</span>
    </button>
  );
}

/* ───────── Página ───────── */
export default function GestaoCertificados() {
  const reduceMotion = useReducedMotion();

  const [data, setData] = useState([]); // [{evento_id, evento_titulo, turmas:[...]}]
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [openEventos, setOpenEventos] = useState({});
  const [openTurmas, setOpenTurmas] = useState({}); // key `${evento_id}:${turma_id}`

  const liveRef = useRef(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort?.("unmount");
    };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");
      setLive("Carregando árvore de certificados…");

      abortRef.current?.abort?.("new-request");
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const rows = await apiGet(`/certificados-admin/arvore`, { signal: ctrl.signal });
      if (!mountedRef.current) return;

      setData(Array.isArray(rows) ? rows : []);
      setLive("Dados atualizados.");
    } catch (e) {
      if (e?.name === "AbortError") return;
      const msg = e?.message || "Falha ao carregar.";
      if (!mountedRef.current) return;
      setErr(msg);
      toast.error(`❌ ${msg}`);
      setLive("Falha ao carregar.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    if (!window.confirm(`Resetar certificados dos participantes da turma #${turmaId}?`)) return;
    try {
      setLive(`Resetando certificados da turma ${turmaId}…`);
      await apiPost(`/certificados-admin/turmas/${turmaId}/reset`, {});
      toast.success("✅ Reset concluído.");
      await fetchData();
      setLive("Reset concluído.");
    } catch (e) {
      const msg = e?.message || "Falha ao resetar.";
      toast.error(`❌ ${msg}`);
      setLive("Falha ao resetar.");
    }
  };

  const abrirDownload = (certificadoId) => {
    if (!certificadoId) return;
    const href = makeApiUrl(`certificados/${certificadoId}/download`);
    // evita navegação SPA acidental e mantém UX consistente
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white flex flex-col">
      {/* a11y live region */}
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      {/* Header */}
      <HeaderHero onRefresh={fetchData} loading={loading} />

      {/* barra fina (scroll) */}
      {loading && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-amber-100 dark:bg-amber-950/30 z-40"
          role="progressbar"
          aria-label="Carregando árvore de certificados"
        >
          <div className={`h-full bg-amber-600 ${reduceMotion ? "" : "animate-pulse"} w-1/3`} />
        </div>
      )}

      <main id="conteudo" className="flex-1 mx-auto max-w-6xl p-4 sm:px-6 lg:px-8">
        {/* Ministats */}
        <section aria-label="Totais de certificação" className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow p-4">
            <p className="text-xs text-zinc-600 dark:text-zinc-300 mb-1">Presentes</p>
            <p className="text-3xl font-extrabold text-lousa dark:text-white">{totaisGeral.presentes}</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow p-4">
            <p className="text-xs text-zinc-600 dark:text-zinc-300 mb-1">Emitidos</p>
            <p className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300">{totaisGeral.emitidos}</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow p-4">
            <p className="text-xs text-zinc-600 dark:text-zinc-300 mb-1">Pendentes</p>
            <p className="text-3xl font-extrabold text-amber-700 dark:text-amber-300">{totaisGeral.pendentes}</p>
          </div>
        </section>

        {/* Barra de ações (útil no scroll) */}
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-base sm:text-lg font-semibold">Certificados — visão por Evento/Turma</h2>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition
              ${loading ? "opacity-60 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800" : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"}
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500`}
            aria-label="Atualizar árvore de certificados"
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              {loading ? "Atualizando…" : "Atualizar"}
            </span>
          </button>
        </div>

        {!!err && !loading && (
          <div
            className="mb-4 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/25 p-4"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 text-rose-600 dark:text-rose-300" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-semibold text-rose-800 dark:text-rose-200">Não foi possível carregar.</p>
                <p className="text-sm text-rose-800/90 dark:text-rose-200/90 break-words">{err}</p>
                <button
                  type="button"
                  onClick={fetchData}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <RefreshCcw className="w-4 h-4" aria-hidden="true" />
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-sm text-zinc-500">Carregando…</div>
        ) : data.length === 0 ? (
          <div className="text-sm text-zinc-500">Nenhum evento encontrado.</div>
        ) : (
          <div className="grid gap-4">
            {data.map((ev) => {
              const evOpen = !!openEventos[ev.evento_id];
              const evId = `evento-${ev.evento_id}`;
              const evStatus = eventoStatus(ev);

              return (
                <section
                  key={ev.evento_id}
                  className="rounded-2xl border bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm overflow-hidden"
                  aria-labelledby={`${evId}-title`}
                >
                  {/* Barrinha superior por status */}
                  <div className={`h-2 w-full ${statusBarClass(evStatus)}`} aria-hidden="true" />

                  {/* Cabeçalho do Evento */}
                  <div className="flex items-start sm:items-center justify-between gap-3 p-3">
                    <h3 id={`${evId}-title`} className="sr-only">
                      Evento
                    </h3>

                    <Collapser
                      id={evId}
                      open={evOpen}
                      onToggle={() => setOpenEventos((s) => ({ ...s, [ev.evento_id]: !evOpen }))}
                      className="text-base font-semibold"
                    >
                      {ev.evento_titulo}
                    </Collapser>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge tone={evStatus === "andamento" ? "amber" : "zinc"}>
                        {evStatus === "programado" && "Programado"}
                        {evStatus === "andamento" && "Em andamento"}
                        {evStatus === "encerrado" && "Encerrado"}
                      </Badge>
                      <span className="text-[11px] text-zinc-500">{(ev.turmas || []).length} turma(s)</span>
                    </div>
                  </div>

                  {/* Conteúdo do Evento */}
                  {evOpen && (
                    <div id={evId} className="border-t dark:border-zinc-800">
                      {(ev.turmas || []).map((t) => {
                        const key = `${ev.evento_id}:${t.turma_id}`;
                        const tOpen = !!openTurmas[key];
                        const tId = `turma-${ev.evento_id}-${t.turma_id}`;
                        const tStatus = inferTurmaStatus(t);

                        return (
                          <article
                            key={t.turma_id}
                            className="border-b last:border-b-0 dark:border-zinc-800"
                            aria-labelledby={`${tId}-title`}
                          >
                            {/* Cabeçalho da Turma com barrinha */}
                            <div className="overflow-hidden">
                              <div className={`h-1.5 w-full ${statusBarClass(tStatus)}`} aria-hidden="true" />

                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3">
                                <div className="min-w-0">
                                  <h4 id={`${tId}-title`} className="sr-only">
                                    Turma
                                  </h4>

                                  <Collapser
                                    id={tId}
                                    open={tOpen}
                                    onToggle={() => setOpenTurmas((s) => ({ ...s, [key]: !tOpen }))}
                                    className="font-semibold"
                                  >
                                    Turma #{t.turma_id} — {t.turma_nome || "Sem título"}
                                  </Collapser>

                                  <div className="mt-1 text-xs text-zinc-500 break-words">
                                    {t.data_inicio ? fmtDataHora(t.data_inicio) : "—"} →{" "}
                                    {t.data_fim ? fmtDataHora(t.data_fim) : "—"}
                                  </div>

                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                    <Badge tone="zinc">
                                      Presentes: <strong className="ml-1">{t?.totais?.presentes ?? 0}</strong>
                                    </Badge>
                                    <Badge tone="emerald">
                                      Emitidos: <strong className="ml-1">{t?.totais?.emitidos ?? 0}</strong>
                                    </Badge>
                                    <Badge tone="amber">
                                      Pendentes: <strong className="ml-1">{t?.totais?.pendentes ?? 0}</strong>
                                    </Badge>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => doResetTurma(t.turma_id)}
                                    className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 text-sm font-semibold"
                                    title="Resetar certificados desta turma"
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    Resetar turma
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Participantes */}
                            {tOpen && (
                              <div id={tId} className="p-3">
                                {/* Tabela (≥ sm) */}
                                <div className="hidden sm:block overflow-x-auto">
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
                                        const has = Boolean(p?.emitido && p?.certificado_id);
                                        return (
                                          <tr key={p.usuario_id} className="border-t dark:border-zinc-800">
                                            <td className="py-2 pl-3 pr-4">{p?.nome || "—"}</td>
                                            <td className="py-2 pr-4">{p?.email || "—"}</td>
                                            <td className="py-2 pr-4">
                                              {has ? <Badge tone="emerald">Emitido</Badge> : <Badge tone="amber">Pendente</Badge>}
                                            </td>
                                            <td className="py-2 pr-4">
                                              {has ? (
                                                <button
                                                  type="button"
                                                  onClick={() => abrirDownload(p.certificado_id)}
                                                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                                                >
                                                  <Download className="h-4 w-4" aria-hidden="true" />
                                                  Baixar
                                                </button>
                                              ) : (
                                                <span className="text-zinc-400">—</span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}

                                      {(t.participantes || []).length === 0 && (
                                        <tr>
                                          <td className="py-3 pl-3 text-zinc-500" colSpan={4}>
                                            Sem participantes presentes.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Cards (mobile < sm) */}
                                <ul className="sm:hidden space-y-2">
                                  {(t.participantes || []).map((p) => {
                                    const has = Boolean(p?.emitido && p?.certificado_id);
                                    return (
                                      <li
                                        key={p.usuario_id}
                                        className="rounded-xl border bg-white/60 dark:bg-zinc-900/60 dark:border-zinc-800 p-3"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="font-semibold break-words">{p?.nome || "—"}</p>
                                            <p className="text-xs text-zinc-500 break-words">{p?.email || "—"}</p>
                                          </div>
                                          <div className="shrink-0">
                                            {has ? <Badge tone="emerald">Emitido</Badge> : <Badge tone="amber">Pendente</Badge>}
                                          </div>
                                        </div>

                                        <div className="mt-2">
                                          {has ? (
                                            <button
                                              type="button"
                                              onClick={() => abrirDownload(p.certificado_id)}
                                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 text-sm font-semibold"
                                            >
                                              <Download className="h-4 w-4" aria-hidden="true" />
                                              Baixar
                                            </button>
                                          ) : (
                                            <span className="text-sm text-zinc-400">—</span>
                                          )}
                                        </div>
                                      </li>
                                    );
                                  })}

                                  {(t.participantes || []).length === 0 && (
                                    <li className="text-sm text-zinc-500">Sem participantes presentes.</li>
                                  )}
                                </ul>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
