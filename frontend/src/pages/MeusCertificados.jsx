/* eslint-disable no-console */
// ✅ src/pages/Certificado.jsx — PREMIUM++++ (página única: Questionário + Avaliação + Certificados)
// - Mobile/PWA-first, a11y forte, dark mode
// - Tabs + ministats + estados claros + UX moderna
// - Questionário: lista disponíveis + modal responder (MCQ + dissertativa) + submit seguro/idempotente
// - Avaliação: lista pendentes + abre ModalAvaliacaoFormulario
// - Certificados: lista elegíveis participante + gerar + baixar + filtros/busca
// - Resiliente: tenta endpoints alternativos e campos alternativos do backend
// - Anti-corrida: abort controller, busy locks, live region, teclas de atalho

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import {
  Layers,
  ClipboardList,
  Award,
  BrainCircuit,
  RefreshCw,
  Search,
  Filter,
  X,
  CalendarDays,
  CircleCheck,
  CircleAlert,
  FilePlus2,
  Download,
  Send,
  ShieldCheck,
  Clock3,
  ChevronRight,
} from "lucide-react";

import Footer from "../components/Footer";
import BotaoPrimario from "../components/BotaoPrimario";
import ModalAvaliacaoFormulario from "../components/ModalAvaliacaoFormulario";
import { apiGet, apiPost, apiGetFile, downloadBlob } from "../services/api";
import { formatarDataBrasileira, formatarParaISO } from "../utils/dateTime";

/* ───────────────────────────────────────────────────────────────
   Utils (premium / resiliente)
─────────────────────────────────────────────────────────────── */
function safeUser() {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "{}") || {};
  } catch {
    return {};
  }
}

function ymdOnly(v) {
  const s = typeof v === "string" ? v.slice(0, 10) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function fmtDateBR(valor) {
  const iso = formatarParaISO(valor);
  return iso ? formatarDataBrasileira(iso) : "—";
}

function pickFirst(obj, keys = []) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

function normalizeText(s) {
  return String(s || "").toLowerCase().trim();
}

async function apiGetFirst(paths = [], opts = {}) {
  let lastErr = null;
  for (const p of paths) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await apiGet(p, opts);
      return r;
    } catch (e) {
      lastErr = e;
      // tenta próximo
    }
  }
  throw lastErr || new Error("Falha ao consultar endpoints.");
}

function clamp(n, a, b) {
  const x = Number(n);
  if (!Number.isFinite(x)) return a;
  return Math.max(a, Math.min(b, x));
}

/* ───────────────────────────────────────────────────────────────
   HeaderHero (paleta exclusiva e tech)
─────────────────────────────────────────────────────────────── */
function HeaderHero({ nome, kpis, onRefreshAll, refreshing }) {
  const grad = "from-slate-950 via-indigo-950 to-cyan-900";

  function MiniStat({ label, value, icon: Icon, tone = "white" }) {
    const tones = {
      white: "bg-white/10 text-white border-white/10",
      emerald: "bg-emerald-500/15 text-emerald-50 border-emerald-400/15",
      amber: "bg-amber-500/15 text-amber-50 border-amber-400/15",
      sky: "bg-sky-500/15 text-sky-50 border-sky-400/15",
      violet: "bg-violet-500/15 text-violet-50 border-violet-400/15",
    };
    const t = tones[tone] || tones.white;
    return (
      <div className={`rounded-2xl px-3 py-2 backdrop-blur border ${t}`}>
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-white/10 p-2 border border-white/10">
            <Icon className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-wide opacity-90">{label}</div>
            <div className="text-lg font-extrabold leading-tight">{value}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <header className={`bg-gradient-to-br ${grad} text-white`} role="banner">
      {/* Skip-link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/15 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-8 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <Layers className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Pós-curso: Questionário • Avaliação • Certificados
          </h1>
        </div>

        <p className="text-sm text-white/90 max-w-3xl">
          {nome ? `Bem-vindo(a), ${nome}. ` : ""}
          Central única para finalizar tudo após o curso: <strong>questionário de aprendizagem</strong>,{" "}
          <strong>feedback</strong> e <strong>certificados</strong>.
        </p>

        {/* ministats */}
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-4xl">
          <MiniStat label="Questionários" value={kpis?.quiz ?? "—"} icon={BrainCircuit} tone="violet" />
          <MiniStat label="Avaliações" value={kpis?.avaliacao ?? "—"} icon={ClipboardList} tone="amber" />
          <MiniStat label="Certificados" value={kpis?.cert ?? "—"} icon={Award} tone="emerald" />
          <MiniStat label="Ações pendentes" value={kpis?.pendentes ?? "—"} icon={Clock3} />
        </div>

        <div className="mt-2">
          <BotaoPrimario
            onClick={onRefreshAll}
            variante="secundario"
            icone={<RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />}
            aria-label="Atualizar tudo"
            disabled={refreshing}
          >
            {refreshing ? "Atualizando..." : "Atualizar tudo"}
          </BotaoPrimario>
        </div>
      </div>

      <div className="h-px w-full bg-white/15" aria-hidden="true" />
    </header>
  );
}

/* ───────────────────────────────────────────────────────────────
   Tabs (premium)
─────────────────────────────────────────────────────────────── */
function Tabs({ value, onChange, items }) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/70 backdrop-blur p-2">
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => {
          const active = it.value === value;
          return (
            <button
              key={it.value}
              type="button"
              onClick={() => onChange(it.value)}
              className={[
                "rounded-xl px-3 py-2 text-sm font-extrabold flex items-center justify-center gap-2",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60",
                active
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-transparent text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60",
              ].join(" ")}
              aria-current={active ? "page" : undefined}
            >
              <it.icon className="w-4 h-4" aria-hidden="true" />
              <span className="truncate">{it.label}</span>
              {typeof it.badge === "number" ? (
                <span
                  className={[
                    "ml-1 inline-flex items-center justify-center rounded-full text-[11px] font-black px-2 py-0.5",
                    active ? "bg-white/15 text-white dark:bg-zinc-900/15 dark:text-zinc-900" : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
                  ].join(" ")}
                  aria-label={`${it.badge} itens`}
                >
                  {it.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   Badge (reutilizável)
─────────────────────────────────────────────────────────────── */
function Badge({ tone = "zinc", children }) {
  const tones = {
    zinc: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700",
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-amber-200 dark:border-amber-800",
    sky: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200 border-sky-200 dark:border-sky-800",
    violet: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200 border-violet-200 dark:border-violet-800",
    rose: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200 border-rose-200 dark:border-rose-800",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border ${tones[tone] || tones.zinc}`}>
      {children}
    </span>
  );
}

/* ───────────────────────────────────────────────────────────────
   ModalQuestionario (responder dentro da página)
─────────────────────────────────────────────────────────────── */
function ModalQuestionario({ open, onClose, item, onSubmitted }) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  const liveRef = useRef(null);
  const abortRef = useRef(null);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  const turmaId = item?.turma_id;
  const questionarioId = item?.questionario_id;

  const resetAll = () => {
    setQuiz(null);
    setAnswers({});
    setResult(null);
    setLoading(false);
    setSending(false);
    abortRef.current?.abort?.();
  };

  useEffect(() => {
    if (!open) {
      resetAll();
      return;
    }
    // ao abrir: carrega questionário
    const run = async () => {
      if (!turmaId || !questionarioId) return;

      try {
        abortRef.current?.abort?.();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        setLoading(true);
        setLive("Carregando questionário…");

        // inicia tentativa (idempotente)
        try {
          await apiPost(`/api/questionarios/${questionarioId}/iniciar/turma/${turmaId}`, {});
        } catch (e) {
          // ok se já existir; seguimos
        }

        const data = await apiGet(`/api/questionarios/${questionarioId}/responder/turma/${turmaId}`, {
          signal: ctrl.signal,
        });

        setQuiz(data || null);
        setLive("Questionário carregado.");
      } catch (e) {
        if (e?.name === "AbortError") return;
        console.error(e);
        toast.error("❌ Erro ao carregar questionário.");
        setLive("Falha ao carregar questionário.");
        setQuiz(null);
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, turmaId, questionarioId]);

  const questoes = useMemo(() => {
    const q = quiz?.questoes;
    return Array.isArray(q) ? q : [];
  }, [quiz]);

  const totalQuestoes = questoes.length;

  const respondidas = useMemo(() => {
    let n = 0;
    for (const qq of questoes) {
      const id = qq?.id;
      const a = answers?.[id];
      if (!id) continue;
      if (qq?.tipo === "multipla_escolha" && a?.alternativa_id) n++;
      if (qq?.tipo !== "multipla_escolha" && a?.resposta_texto?.trim()) n++;
    }
    return n;
  }, [questoes, answers]);

  const progresso = totalQuestoes > 0 ? Math.round((respondidas / totalQuestoes) * 100) : 0;

  const setAlt = (questaoId, alternativaId) => {
    setAnswers((prev) => ({
      ...prev,
      [questaoId]: { questao_id: questaoId, alternativa_id: alternativaId },
    }));
  };

  const setTexto = (questaoId, texto) => {
    setAnswers((prev) => ({
      ...prev,
      [questaoId]: { questao_id: questaoId, resposta_texto: texto },
    }));
  };

  const enviar = async () => {
    if (!turmaId || !questionarioId) return;

    // monta respostas no formato do backend
    const payload = [];
    for (const qq of questoes) {
      const qid = qq?.id;
      if (!qid) continue;
      const a = answers?.[qid];
      if (!a) continue;

      if (qq?.tipo === "multipla_escolha" && a?.alternativa_id) {
        payload.push({ questao_id: qid, alternativa_id: a.alternativa_id });
      } else if (qq?.tipo !== "multipla_escolha") {
        const txt = String(a?.resposta_texto || "").trim();
        if (txt) payload.push({ questao_id: qid, resposta_texto: txt });
      }
    }

    if (totalQuestoes > 0 && payload.length === 0) {
      toast.warn("Responda pelo menos uma questão.");
      return;
    }

    setSending(true);
    setLive("Enviando respostas…");

    try {
      const r = await apiPost(`/api/questionarios/${questionarioId}/enviar/turma/${turmaId}`, {
        respostas: payload,
      });

      setResult(r || { ok: true });
      toast.success("✅ Questionário enviado!");
      setLive("Questionário enviado.");
      onSubmitted?.();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "❌ Erro ao enviar questionário.");
      setLive("Falha ao enviar questionário.");
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const titulo = quiz?.titulo || item?.questionario_titulo || "Questionário";
  const eventoTitulo = item?.evento_titulo || item?.nome_evento || "Evento";
  const turmaNome = item?.turma_nome || item?.turma_nome || (item?.turma_id ? `Turma #${item.turma_id}` : "Turma");

  return (
    <div className="fixed inset-0 z-[80]">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => (sending ? null : onClose?.())}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center p-3 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          transition={{ duration: 0.22 }}
          className="w-full sm:max-w-3xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Responder questionário"
        >
          {/* live region */}
          <p ref={liveRef} className="sr-only" aria-live="polite" />

          {/* header */}
          <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-violet-700 dark:text-violet-300" aria-hidden="true" />
                  <h3 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white truncate">
                    {titulo}
                  </h3>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1 line-clamp-2">
                  {eventoTitulo} • <span className="font-semibold">{turmaNome}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => (sending ? null : onClose?.())}
                className="rounded-xl p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5 text-zinc-700 dark:text-zinc-200" aria-hidden="true" />
              </button>
            </div>

            {/* progresso */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge tone="violet">
                <CircleCheck className="w-3.5 h-3.5" />
                {respondidas}/{totalQuestoes} respondidas
              </Badge>
              <Badge tone="sky">
                <Clock3 className="w-3.5 h-3.5" />
                Progresso: {progresso}%
              </Badge>
              {result?.nota != null ? (
                <Badge tone={result?.aprovado === true ? "emerald" : "amber"}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Nota: {String(result.nota)}%
                </Badge>
              ) : null}
              {result?.aprovado != null ? (
                <Badge tone={result.aprovado ? "emerald" : "amber"}>
                  {result.aprovado ? <CircleCheck className="w-3.5 h-3.5" /> : <CircleAlert className="w-3.5 h-3.5" />}
                  {result.aprovado ? "Aprovado" : "Não aprovado"}
                </Badge>
              ) : null}
            </div>

            <div className="mt-3 h-2 rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden" aria-hidden="true">
              <div
                className="h-full bg-gradient-to-r from-violet-700 via-indigo-600 to-cyan-600"
                style={{ width: `${clamp(progresso, 0, 100)}%` }}
              />
            </div>
          </div>

          {/* body */}
          <div className="p-4 sm:p-5 max-h-[70vh] overflow-auto">
            {loading ? (
              <div className="grid gap-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-20 rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/60 animate-pulse" />
                ))}
              </div>
            ) : !quiz ? (
              <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-4 text-sm text-amber-900 dark:text-amber-200">
                Não foi possível carregar o questionário. Tente novamente.
              </div>
            ) : (
              <div className="grid gap-4">
                {quiz?.descricao ? (
                  <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 text-sm text-zinc-700 dark:text-zinc-200">
                    {quiz.descricao}
                  </div>
                ) : null}

                {questoes.map((qq, idx) => {
                  const qid = qq.id;
                  const tipo = qq.tipo;
                  const alts = Array.isArray(qq.alternativas) ? qq.alternativas : [];
                  const a = answers?.[qid] || {};

                  return (
                    <div
                      key={qid}
                      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-black tracking-wide uppercase text-zinc-500 dark:text-zinc-400">
                            Questão {idx + 1}
                          </div>
                          <h4 className="mt-1 text-sm sm:text-base font-extrabold text-zinc-900 dark:text-white">
                            {qq.enunciado}
                          </h4>
                        </div>
                        <Badge tone={tipo === "multipla_escolha" ? "sky" : "zinc"}>
                          {tipo === "multipla_escolha" ? "Múltipla escolha" : "Dissertativa"}
                        </Badge>
                      </div>

                      {tipo === "multipla_escolha" ? (
                        <div className="mt-3 grid gap-2">
                          {alts.map((alt) => {
                            const selected = Number(a?.alternativa_id) === Number(alt.id);
                            return (
                              <button
                                key={alt.id}
                                type="button"
                                onClick={() => setAlt(qid, alt.id)}
                                className={[
                                  "w-full text-left rounded-xl border px-3 py-2 text-sm",
                                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60",
                                  selected
                                    ? "border-violet-400 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-700"
                                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/60",
                                  "text-zinc-900 dark:text-zinc-100",
                                ].join(" ")}
                                aria-pressed={selected ? "true" : "false"}
                              >
                                <div className="flex items-start gap-2">
                                  <span
                                    className={[
                                      "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black",
                                      selected ? "bg-violet-700 text-white" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
                                    ].join(" ")}
                                    aria-hidden="true"
                                  >
                                    {alt.ordem ?? "•"}
                                  </span>
                                  <span className="leading-snug">{alt.texto}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-3">
                          <textarea
                            value={a?.resposta_texto ?? ""}
                            onChange={(e) => setTexto(qid, e.target.value)}
                            rows={4}
                            placeholder="Digite sua resposta…"
                            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                          />
                          <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                            Dica: respostas dissertativas podem ser usadas para feedback qualitativo.
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* footer actions */}
          <div className="p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <div className="text-xs text-zinc-600 dark:text-zinc-300">
                {quiz?.min_nota != null ? (
                  <>
                    Nota mínima: <strong>{quiz.min_nota}%</strong>
                  </>
                ) : (
                  "Nota mínima não definida."
                )}
                {quiz?.tentativas_max != null ? (
                  <>
                    {" "}
                    • Tentativas máx.: <strong>{quiz.tentativas_max}</strong>
                  </>
                ) : null}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => (sending ? null : onClose?.())}
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60"
                  disabled={sending}
                >
                  Fechar
                </button>

                <button
                  type="button"
                  onClick={enviar}
                  disabled={sending || loading || !quiz}
                  className={[
                    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold text-white",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70",
                    sending ? "bg-violet-400 cursor-not-allowed" : "bg-violet-700 hover:bg-violet-800",
                    "disabled:opacity-75",
                  ].join(" ")}
                  aria-label="Enviar questionário"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  {sending ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   Card base (premium: barrinha + layout clean)
─────────────────────────────────────────────────────────────── */
function CardBase({ bar, children, ariaBusy }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="relative rounded-2xl border shadow-sm overflow-hidden bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800"
      aria-busy={ariaBusy ? "true" : "false"}
    >
      <div className={`h-1.5 w-full ${bar}`} aria-hidden="true" />
      <div className="p-4">{children}</div>
    </motion.div>
  );
}

/* ───────────────────────────────────────────────────────────────
   Página
─────────────────────────────────────────────────────────────── */
export default function Certificado() {
  const usuario = useMemo(() => safeUser(), []);
  const nome = usuario?.nome || "";

  // data sets
  const [quizzes, setQuizzes] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [certs, setCerts] = useState([]);

  // ui states
  const [tab, setTab] = useState("quiz"); // quiz | avaliacao | cert
  const [loadingAll, setLoadingAll] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState("");

  // search/filter per tab
  const [q, setQ] = useState("");
  const [filtroCert, setFiltroCert] = useState("todos"); // todos | prontos | pendentes
  const [ordCert, setOrdCert] = useState("recentes"); // recentes | antigos | titulo

  // modals
  const [modalAvalOpen, setModalAvalOpen] = useState(false);
  const [avalSelecionada, setAvalSelecionada] = useState(null);

  const [modalQuizOpen, setModalQuizOpen] = useState(false);
  const [quizSelecionado, setQuizSelecionado] = useState(null);

  // concurrency
  const abortRef = useRef(null);
  const mountedRef = useRef(true);
  const liveRef = useRef(null);

  const [busyCert, setBusyCert] = useState(false);
  const [gerandoKey, setGerandoKey] = useState(null);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort?.();
    };
  }, []);

  useEffect(() => {
    document.title = "Pós-curso | Escola da Saúde";
  }, []);

  /* ───────────────── Cert status (resiliente) ───────────────── */
  const getCertState = useCallback((cert) => {
    const jaGerado = Boolean(cert?.ja_gerado || cert?.emitido || cert?.gerado);
    const certId = cert?.certificado_id ?? cert?.id_certificado ?? cert?.certId ?? null;

    const podeGerar =
      cert?.pode_gerar ??
      cert?.elegivel ??
      cert?.liberado ??
      cert?.disponivel ??
      undefined;

    const avaliacaoOk =
      cert?.avaliacao_realizada ??
      cert?.avaliado ??
      cert?.avaliacao_feita ??
      cert?.avaliacao_ok ??
      undefined;

    const freqOk =
      cert?.frequencia_ok ??
      cert?.presenca_ok ??
      cert?.presenca_minima_ok ??
      undefined;

    const motivo = String(cert?.motivo_bloqueio || cert?.motivo || cert?.mensagem || "").trim();

    if (jaGerado || certId) return { status: "pronto", motivo: "" };
    if (podeGerar === false) return { status: "pendente", motivo: motivo || "Ainda não liberado." };
    if (avaliacaoOk === false) return { status: "pendente", motivo: motivo || "Avaliação pendente." };
    if (freqOk === false) return { status: "pendente", motivo: motivo || "Frequência mínima não atingida." };

    if (podeGerar === true) return { status: "geravel", motivo: "" };
    return { status: "geravel", motivo: "" };
  }, []);

  const keyCert = useCallback((c) => `usuario-${c?.evento_id}-${c?.turma_id}`, []);

  /* ───────────────── Loaders (3 blocos) ───────────────── */
  const loadQuiz = useCallback(async (uid, signal) => {
    // tenta endpoints alternativos (caso mount varie)
    const data = await apiGetFirst(
      [
        `/api/questionarios/disponiveis/usuario/${uid}`,
        `/questionarios/disponiveis/usuario/${uid}`,
      ],
      { signal }
    );
    return Array.isArray(data) ? data : Array.isArray(data?.lista) ? data.lista : [];
  }, []);

  const loadAvaliacao = useCallback(async (uid, signal) => {
    const data = await apiGetFirst(
      [
        `/api/avaliacao/disponiveis/${uid}`,
        `/api/avaliacao/disponivel/${uid}`,
        `/api/avaliacao/disponiveis`, // alguns mounts devolvem pelo token
        `/api/avaliacao/disponivel`,
      ],
      { signal, on401: "silent", on403: "silent" }
    );
    return Array.isArray(data) ? data : [];
  }, []);

  const loadCerts = useCallback(async (signal) => {
    const data = await apiGetFirst(
      [
        `/certificados/elegiveis`,
        `/api/certificados/elegiveis`,
        `/api/certificado/elegivel`,
        `/api/certificados/elegivel`,
      ],
      { signal }
    );
    const lista = Array.isArray(data) ? data : Array.isArray(data?.lista) ? data.lista : [];
    // participante apenas (tipo usuario)
    const only = lista.filter((c) => (c?.tipo ?? "usuario") === "usuario");
    // dedupe por (tipo, evento_id, turma_id)
    const seen = new Set();
    const out = [];
    for (const it of only) {
      const k = `usuario-${it?.evento_id}-${it?.turma_id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    return out;
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      if (!usuario?.id) {
        toast.error("❌ Usuário não identificado. Faça login novamente.");
        return;
      }

      abortRef.current?.abort?.();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setErro("");
      setRefreshing(true);
      setLive("Atualizando dados…");

      const uid = Number(usuario.id);

      const [qz, av, cs] = await Promise.all([
        loadQuiz(uid, ctrl.signal),
        loadAvaliacao(uid, ctrl.signal),
        loadCerts(ctrl.signal),
      ]);

      if (!mountedRef.current) return;

      setQuizzes(Array.isArray(qz) ? qz : []);
      setAvaliacoes(Array.isArray(av) ? av : []);
      setCerts(Array.isArray(cs) ? cs : []);

      setLive("Dados atualizados.");
    } catch (e) {
      if (e?.name === "AbortError") return;
      console.error(e);
      setErro("Não foi possível atualizar os dados agora.");
      toast.error("❌ Erro ao atualizar.");
      setLive("Falha ao atualizar.");
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, [usuario?.id, loadQuiz, loadAvaliacao, loadCerts]);

  useEffect(() => {
    const run = async () => {
      setLoadingAll(true);
      await refreshAll();
      if (mountedRef.current) setLoadingAll(false);
    };
    run();

    // Atalhos:
    // 1/2/3 -> trocar tabs | R -> refresh
    const keyHandler = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = ["input", "textarea", "select"].includes(tag);
      if (isTyping) return;

      if (e.key === "1") setTab("quiz");
      if (e.key === "2") setTab("avaliacao");
      if (e.key === "3") setTab("cert");

      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        refreshAll();
      }
    };

    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, [refreshAll]);

  /* ───────────────── KPIs (hero) ───────────────── */
  const kpis = useMemo(() => {
    const quizN = Array.isArray(quizzes) ? quizzes.length : 0;
    const avN = Array.isArray(avaliacoes) ? avaliacoes.length : 0;
    const certN = Array.isArray(certs) ? certs.length : 0;
    return {
      quiz: String(quizN),
      avaliacao: String(avN),
      cert: String(certN),
      pendentes: String(quizN + avN + certN),
    };
  }, [quizzes, avaliacoes, certs]);

  /* ───────────────── Search (shared) ───────────────── */
  const qText = useMemo(() => normalizeText(q), [q]);

  /* ───────────────── Quiz list normalized ───────────────── */
  const quizzesNorm = useMemo(() => {
    const arr = Array.isArray(quizzes) ? quizzes : [];
    return arr
      .map((r) => ({
        ...r,
        turma_id: Number(pickFirst(r, ["turma_id", "turmaId", "turma"]) || 0) || null,
        questionario_id: Number(pickFirst(r, ["questionario_id", "questionarioId", "id"]) || 0) || null,
        evento_id: Number(pickFirst(r, ["evento_id", "eventoId"]) || 0) || null,
        evento_titulo: pickFirst(r, ["evento_titulo", "evento", "nome_evento", "evento_nome"]) || "Evento",
        turma_nome: pickFirst(r, ["turma_nome", "nome_turma", "turma", "turma_nome_exibicao"]) || null,
        data_fim: pickFirst(r, ["data_fim", "df", "fim"]) || null,
        fim_real: pickFirst(r, ["fim_real", "fimReal"]) || null,
        bloqueado: Boolean(r?.bloqueado_por_tentativas),
      }))
      .filter((x) => x.turma_id && x.questionario_id);
  }, [quizzes]);

  const quizzesFiltrados = useMemo(() => {
    const base = quizzesNorm.slice().sort((a, b) => {
      const da = ymdOnly(formatarParaISO(a.data_fim)) || "0000-00-00";
      const db = ymdOnly(formatarParaISO(b.data_fim)) || "0000-00-00";
      return db < da ? -1 : db > da ? 1 : 0;
    });

    if (!qText) return base;

    return base.filter((x) => {
      const t = normalizeText(x.evento_titulo);
      const turma = normalizeText(x.turma_nome || `#${x.turma_id}`);
      const meta = normalizeText(x.questionario_titulo || x.questionario_titulo);
      return t.includes(qText) || turma.includes(qText) || meta.includes(qText);
    });
  }, [quizzesNorm, qText]);

  /* ───────────────── Avaliações ordenadas ───────────────── */
  const avalFiltradas = useMemo(() => {
    const arr = Array.isArray(avaliacoes) ? [...avaliacoes] : [];
    const sorted = arr.sort((a, b) => {
      const da = formatarParaISO(a.data_fim ?? a.df ?? a.fim) || "";
      const db = formatarParaISO(b.data_fim ?? b.df ?? b.fim) || "";
      return db > da ? 1 : db < da ? -1 : 0;
    });

    if (!qText) return sorted;

    return sorted.filter((a) => {
      const titulo = normalizeText(a.nome_evento || a.titulo || a.nome);
      const turma = normalizeText(a.nome_turma || a.turma_nome || `#${a.turma_id ?? a.turma ?? ""}`);
      return titulo.includes(qText) || turma.includes(qText);
    });
  }, [avaliacoes, qText]);

  /* ───────────────── Certificados filtered ───────────────── */
  const certsFiltrados = useMemo(() => {
    const base = (Array.isArray(certs) ? certs : []).filter((c) => {
      const st = getCertState(c);
      if (filtroCert === "prontos") return st.status === "pronto";
      if (filtroCert === "pendentes") return st.status === "pendente";
      return true;
    });

    const searched = !qText
      ? base
      : base.filter((c) => {
          const titulo = normalizeText(c?.evento || c?.evento_titulo || c?.nome_evento);
          const turma = normalizeText(c?.nome_turma || c?.turma_nome || `#${c?.turma_id ?? ""}`);
          const motivo = normalizeText(getCertState(c)?.motivo || "");
          return titulo.includes(qText) || turma.includes(qText) || motivo.includes(qText);
        });

    const getDateKey = (c) => {
      const fim = ymdOnly(formatarParaISO(c?.data_fim ?? c?.df ?? c?.fim)) || "0000-00-00";
      const ini = ymdOnly(formatarParaISO(c?.data_inicio ?? c?.di ?? c?.inicio)) || "0000-00-00";
      return `${fim}|${ini}`;
    };

    return searched.slice().sort((a, b) => {
      if (ordCert === "titulo") {
        const A = String(a?.evento || a?.evento_titulo || a?.nome_evento || "").localeCompare(
          String(b?.evento || b?.evento_titulo || b?.nome_evento || ""),
          "pt-BR"
        );
        if (A !== 0) return A;
      }
      const ka = getDateKey(a);
      const kb = getDateKey(b);
      if (ordCert === "antigos") return ka > kb ? 1 : ka < kb ? -1 : 0;
      return ka < kb ? 1 : ka > kb ? -1 : 0; // recentes
    });
  }, [certs, filtroCert, ordCert, qText, getCertState]);

  /* ───────────────── Actions: abrir modais ───────────────── */
  const abrirAvaliacao = (a) => {
    setAvalSelecionada(a);
    setModalAvalOpen(true);
  };

  const abrirQuiz = (qz) => {
    if (qz?.bloqueado) {
      toast.warn("Limite de tentativas atingido para este questionário.");
      return;
    }
    setQuizSelecionado(qz);
    setModalQuizOpen(true);
  };

  const fecharQuiz = () => {
    setModalQuizOpen(false);
    setQuizSelecionado(null);
  };

  const fecharAvaliacao = () => {
    setModalAvalOpen(false);
    setAvalSelecionada(null);
  };


  const [busyDownload, setBusyDownload] = useState(false); // ✅ novo estado

  const baixarCertificado = useCallback(async (cert) => {
    if (busyDownload) return;
    setBusyDownload(true);
  
    try {
      const id = cert?.certificado_id;
      if (!id) {
        toast.error("Certificado sem ID para download.");
        return;
      }
  
      const { blob, filename } = await apiGetFile(`/certificados/${id}/download`);
  
      const safe = (s) =>
        String(s || "certificado")
          .replace(/[^\w\s-]/g, "")
          .trim()
          .replace(/\s+/g, "_");
  
      const titulo = safe(cert?.evento || cert?.evento_titulo || cert?.nome_evento);
      const turma = cert?.turma_id ? `turma${cert.turma_id}` : "turma";
      const fallback = `certificado_${titulo}_${turma}.pdf`;
  
      downloadBlob(filename || fallback, blob);
      toast.success("📥 Download iniciado!");
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "❌ Não foi possível baixar o PDF.");
    } finally {
      setBusyDownload(false);
    }
  }, [busyDownload]);
  


  /* ───────────────── Cert: gerar ───────────────── */
  const gerarCertificado = async (cert) => {
    if (busyCert) return;

    const st = getCertState(cert);
    if (st.status === "pendente") {
      toast.warn(st.motivo || "Certificado ainda não liberado.");
      return;
    }

    if (!usuario?.id) {
      toast.error("❌ Usuário não identificado. Faça login novamente.");
      return;
    }

    const key = keyCert(cert);
    setBusyCert(true);
    setGerandoKey(key);

    try {
      const body = {
        usuario_id: usuario.id,
        evento_id: cert.evento_id,
        turma_id: cert.turma_id,
        tipo: "usuario",
      };

      const r = await apiPost("/certificados/gerar", body);

      toast.success("🎉 Certificado gerado com sucesso!");

      // refresh autoritativo
      await refreshAll();

      // reforço otimista
      const certificadoId = r?.certificado_id ?? r?.id ?? r?.certificado?.id ?? null;
      const arquivoPdf = r?.arquivo_pdf ?? r?.arquivo ?? r?.certificado?.arquivo_pdf ?? null;

      setCerts((prev) =>
        prev.map((c) =>
          c.evento_id === cert.evento_id && c.turma_id === cert.turma_id
            ? {
                ...c,
                ja_gerado: true,
                certificado_id: c.certificado_id ?? certificadoId ?? c.certificado_id,
                arquivo_pdf: c.arquivo_pdf ?? arquivoPdf ?? c.arquivo_pdf,
              }
            : c
        )
      );
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "❌ Erro ao gerar certificado.");
    } finally {
      setGerandoKey(null);
      setBusyCert(false);
    }
  };

  /* ───────────────── UI: Toolbar ───────────────── */
  const limparBusca = () => setQ("");

  const tabItems = useMemo(
    () => [
      { value: "quiz", label: "Questionário", icon: BrainCircuit, badge: quizzesNorm.length },
      { value: "avaliacao", label: "Avaliação", icon: ClipboardList, badge: avalFiltradas.length },
      { value: "cert", label: "Certificados", icon: Award, badge: certsFiltrados.length },
    ],
    [quizzesNorm.length, avalFiltradas.length, certsFiltrados.length]
  );

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero nome={nome} kpis={kpis} onRefreshAll={refreshAll} refreshing={refreshing} />

      {/* live region */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      {/* barra progress topo */}
      {(loadingAll || refreshing) && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-cyan-100 dark:bg-cyan-900/30 z-40"
          role="progressbar"
          aria-label="Carregando"
        >
          <div className="h-full bg-cyan-700 animate-pulse w-1/3" />
        </div>
      )}

      <main id="conteudo" role="main" className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Tabs */}
        <div className="sticky top-1 z-30 mb-4">
          <Tabs value={tab} onChange={setTab} items={tabItems} />
        </div>

        {/* Toolbar (busca + filtros contextuais) */}
        <section
          aria-label="Ferramentas"
          className="mb-5 rounded-2xl border border-zinc-200 bg-white/80 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Busca */}
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tab === "quiz" ? "Buscar questionários…" : tab === "avaliacao" ? "Buscar avaliações…" : "Buscar certificados…"}
                className="w-full rounded-xl border px-9 py-2 text-sm ring-offset-2 focus:outline-none focus:ring-2 focus:ring-cyan-700 dark:border-zinc-700 dark:bg-zinc-950/30"
                aria-label="Buscar"
              />
              {q ? (
                <button
                  type="button"
                  onClick={limparBusca}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  aria-label="Limpar busca"
                  title="Limpar"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            {/* Filtros específicos do tab */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                <Filter className="h-4 w-4" aria-hidden="true" />
                {tab === "cert" ? "Filtros:" : "Atalhos:"}
              </span>

              {tab === "cert" ? (
                <>
                  <select
                    value={filtroCert}
                    onChange={(e) => setFiltroCert(e.target.value)}
                    className="rounded-xl border px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-700 dark:border-zinc-700 dark:bg-zinc-950/30"
                    aria-label="Filtrar certificados por status"
                  >
                    <option value="todos">Todos</option>
                    <option value="prontos">Somente prontos</option>
                    <option value="pendentes">Somente pendentes</option>
                  </select>

                  <select
                    value={ordCert}
                    onChange={(e) => setOrdCert(e.target.value)}
                    className="rounded-xl border px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-700 dark:border-zinc-700 dark:bg-zinc-950/30"
                    aria-label="Ordenação de certificados"
                  >
                    <option value="recentes">Mais recentes</option>
                    <option value="antigos">Mais antigos</option>
                    <option value="titulo">Título (A–Z)</option>
                  </select>
                </>
              ) : (
                <div className="text-xs text-zinc-500">
                  <span className="font-semibold">1</span> Questionário • <span className="font-semibold">2</span> Avaliação •{" "}
                  <span className="font-semibold">3</span> Certificados • <span className="font-semibold">R</span> Atualizar
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Erro geral */}
        {erro ? (
          <div className="mb-5 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950 p-4 text-sm text-rose-900 dark:text-rose-200">
            {erro}
          </div>
        ) : null}

        {/* Conteúdo por tab */}
        <AnimatePresence mode="wait">
          {tab === "quiz" ? (
            <motion.section
              key="quiz"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
              aria-label="Questionários disponíveis"
            >
              {loadingAll ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-32 rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/60 animate-pulse" />
                  ))}
                </div>
              ) : quizzesFiltrados.length === 0 ? (
                <CardBase bar="bg-gradient-to-r from-violet-700 via-indigo-600 to-cyan-600">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl p-2 bg-violet-100 dark:bg-violet-900/30">
                      <BrainCircuit className="w-5 h-5 text-violet-700 dark:text-violet-200" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                        Nenhum questionário disponível
                      </h2>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
                        Quando estiver elegível (turma encerrada + 75%), o questionário aparecerá aqui.
                      </p>
                    </div>
                  </div>
                </CardBase>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {quizzesFiltrados.map((it) => {
                    const titulo = it?.evento_titulo || "Evento";
                    const turmaTxt = it?.turma_nome || `Turma #${it.turma_id}`;
                    const df = it?.data_fim ? fmtDateBR(it.data_fim) : "—";
                    const bloqueado = Boolean(it?.bloqueado);

                    return (
                      <CardBase
                        key={`${it.questionario_id}-${it.turma_id}`}
                        bar={bloqueado ? "bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400" : "bg-gradient-to-r from-violet-700 via-indigo-600 to-cyan-600"}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-base font-extrabold text-zinc-900 dark:text-white break-words">
                              {titulo}
                            </h3>
                            <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">
                              <span className="font-semibold">{turmaTxt}</span>
                              <span className="mx-2">•</span>
                              Encerramento: <span className="font-semibold">{df}</span>
                            </p>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {bloqueado ? (
                                <Badge tone="amber">
                                  <CircleAlert className="w-3.5 h-3.5" />
                                  Bloqueado por tentativas
                                </Badge>
                              ) : (
                                <Badge tone="violet">
                                  <CircleCheck className="w-3.5 h-3.5" />
                                  Disponível
                                </Badge>
                              )}
                              {it?.tentativas_enviadas != null ? (
                                <Badge tone="sky">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  Enviadas: {it.tentativas_enviadas}
                                </Badge>
                              ) : null}
                              {it?.frequencia != null ? (
                                <Badge tone="zinc">
                                  <Clock3 className="w-3.5 h-3.5" />
                                  Frequência: {it.frequencia}%
                                </Badge>
                              ) : null}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => abrirQuiz(it)}
                            disabled={bloqueado}
                            className={[
                              "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold text-white",
                              "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70",
                              bloqueado ? "bg-zinc-400 dark:bg-zinc-700 cursor-not-allowed" : "bg-violet-700 hover:bg-violet-800",
                            ].join(" ")}
                            aria-label="Responder questionário"
                          >
                            Responder <ChevronRight className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </CardBase>
                    );
                  })}
                </div>
              )}
            </motion.section>
          ) : null}

          {tab === "avaliacao" ? (
            <motion.section
              key="avaliacao"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
              aria-label="Avaliações pendentes"
            >
              {loadingAll ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-28 rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/60 animate-pulse" />
                  ))}
                </div>
              ) : avalFiltradas.length === 0 ? (
                <CardBase bar="bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl p-2 bg-amber-100 dark:bg-amber-900/30">
                      <ClipboardList className="w-5 h-5 text-amber-800 dark:text-amber-200" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                        Nenhuma avaliação pendente
                      </h2>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
                        Assim que um curso encerrar (fim real + horário), a avaliação ficará disponível aqui.
                      </p>
                    </div>
                  </div>
                </CardBase>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {avalFiltradas.map((a, idx) => {
                    const di = a.data_inicio ?? a.di ?? a.inicio;
                    const df = a.data_fim ?? a.df ?? a.fim;
                    const titulo = a.nome_evento || a.titulo || a.nome || "Curso";
                    const turmaId = a.turma_id ?? a.turma ?? "—";

                    return (
                      <CardBase
                        key={`${turmaId}-${idx}`}
                        bar="bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500"
                      >
                        <div className="flex flex-col gap-2">
                          <h3 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white break-words">
                            {titulo}
                          </h3>

                          <p className="text-sm text-zinc-700 dark:text-zinc-300">
                            Turma <span className="font-semibold">#{turmaId}</span>
                            <span className="mx-2">•</span>
                            Início: <span className="font-semibold">{fmtDateBR(di)}</span>
                            <span className="mx-2">—</span>
                            Fim: <span className="font-semibold">{fmtDateBR(df)}</span>
                          </p>

                          <div className="mt-2 flex flex-col sm:flex-row gap-2">
                            <button
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-4 py-2 text-sm font-extrabold hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                              onClick={() => abrirAvaliacao(a)}
                              aria-label={`Avaliar ${titulo}, turma ${turmaId}`}
                            >
                              Avaliar agora <ChevronRight className="w-4 h-4" aria-hidden="true" />
                            </button>

                            <button
                              type="button"
                              onClick={refreshAll}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60"
                              aria-label="Recarregar"
                            >
                              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
                              Recarregar
                            </button>
                          </div>
                        </div>
                      </CardBase>
                    );
                  })}
                </div>
              )}
            </motion.section>
          ) : null}

          {tab === "cert" ? (
            <motion.section
              key="cert"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
              aria-label="Certificados"
            >
              {loadingAll ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-36 rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/60 animate-pulse" />
                  ))}
                </div>
              ) : certsFiltrados.length === 0 ? (
                <CardBase bar="bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-600">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl p-2 bg-emerald-100 dark:bg-emerald-900/30">
                      <Award className="w-5 h-5 text-emerald-800 dark:text-emerald-200" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                        Nenhum certificado elegível
                      </h2>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
                        Certificados aparecem aqui quando o curso encerra e você cumpre as regras (frequência e avaliação quando exigida).
                      </p>
                    </div>
                  </div>
                </CardBase>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {certsFiltrados.map((cert) => {
                    const st = getCertState(cert);
                    const key = keyCert(cert);
                    const gerando = gerandoKey === key;

                    const titulo = cert?.evento || cert?.evento_titulo || cert?.nome_evento || "Evento";
                    const turmaTxt = cert?.nome_turma || cert?.turma_nome || (cert?.turma_id ? `Turma #${cert.turma_id}` : "Turma");
                    const periodo = `${fmtDateBR(cert?.data_inicio ?? cert?.di ?? cert?.inicio)} até ${fmtDateBR(
                      cert?.data_fim ?? cert?.df ?? cert?.fim
                    )}`;

                    const barra =
                      st.status === "pronto"
                        ? "bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-400"
                        : st.status === "pendente"
                        ? "bg-gradient-to-r from-amber-700 via-amber-500 to-amber-400"
                        : "bg-gradient-to-r from-sky-700 via-teal-600 to-cyan-600";

                    const prontoParaDownload = Boolean(cert?.certificado_id) && (cert?.ja_gerado || cert?.certificado_id);

                    return (
                      <CardBase key={key} bar={barra} ariaBusy={gerando}>
                        <div className="flex flex-col gap-2 min-w-0">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white break-words">
                                {titulo}
                              </h3>
                              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                                Turma: <span className="font-semibold">{turmaTxt}</span>
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {st.status === "pronto" && (
                                <Badge tone="emerald">
                                  <CircleCheck className="w-3.5 h-3.5" /> Pronto
                                </Badge>
                              )}
                              {st.status === "pendente" && (
                                <Badge tone="amber">
                                  <CircleAlert className="w-3.5 h-3.5" /> Pendente
                                </Badge>
                              )}
                              {st.status === "geravel" && (
                                <Badge tone="sky">
                                  <FilePlus2 className="w-3.5 h-3.5" /> Disponível
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="w-4 h-4" aria-hidden="true" />
                              {periodo}
                            </span>
                          </div>

                          {st.motivo ? (
                            <div className="text-xs text-amber-800 dark:text-amber-200 bg-amber-100/70 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
                              {st.motivo}
                            </div>
                          ) : null}

                          <div className="mt-2 flex flex-col sm:flex-row gap-2">
                          {prontoParaDownload ? (
 <button
 type="button"
 onClick={() => baixarCertificado(cert)}
 disabled={busyDownload}
 className={[
   "inline-flex items-center justify-center gap-2 rounded-xl text-white text-sm font-extrabold px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300",
   busyDownload ? "bg-emerald-500 cursor-not-allowed opacity-80" : "bg-emerald-700 hover:bg-emerald-800",
 ].join(" ")}
 aria-label={`Baixar certificado de ${titulo}`}
>
    <Download className="w-4 h-4" aria-hidden="true" />
    Baixar
  </button>
) : (
                              <button
                                onClick={() => gerarCertificado(cert)}
                                disabled={gerando || busyCert || st.status === "pendente"}
                                className={[
                                  "inline-flex items-center justify-center gap-2 rounded-xl text-white text-sm font-extrabold px-4 py-2",
                                  st.status === "pendente"
                                    ? "bg-zinc-400 dark:bg-zinc-700 cursor-not-allowed"
                                    : "bg-sky-700 hover:bg-sky-800",
                                  "disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
                                ].join(" ")}
                                aria-label="Gerar certificado de participante"
                              >
                                <FilePlus2 className="w-4 h-4" aria-hidden="true" />
                                {gerando ? "Gerando..." : "Gerar"}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={refreshAll}
                              disabled={refreshing}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 text-sm font-semibold px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
                              aria-label="Recarregar lista"
                            >
                              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
                              Recarregar
                            </button>
                          </div>
                        </div>
                      </CardBase>
                    );
                  })}
                </div>
              )}

              {/* dica */}
              <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 p-4 text-sm text-zinc-700 dark:text-zinc-300">
                <p className="font-extrabold text-zinc-900 dark:text-white mb-1">Dica</p>
                <p>
                  Se aparecer como <strong>Pendente</strong>, normalmente falta concluir a <strong>avaliação</strong> ou atingir a{" "}
                  <strong>frequência mínima</strong>. Assim que estiver liberado, o botão de geração fica disponível.
                </p>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </main>

      {/* Modal: Avaliação (seu componente existente) */}
      <ModalAvaliacaoFormulario
        isOpen={modalAvalOpen}
        onClose={fecharAvaliacao}
        evento={avalSelecionada}
        turma_id={avalSelecionada?.turma_id ?? null}
        recarregar={refreshAll}
      />

      {/* Modal: Questionário (novo, responder aqui) */}
      <ModalQuestionario
        open={modalQuizOpen}
        onClose={fecharQuiz}
        item={quizSelecionado}
        onSubmitted={refreshAll}
      />

      <Footer />
    </div>
  );
}
