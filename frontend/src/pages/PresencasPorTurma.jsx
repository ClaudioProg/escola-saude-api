// ✅ src/pages/PresencasPorTurma.jsx (premium: hero + ministats + busca + a11y + motion + mobile)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { differenceInMinutes, isBefore } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CheckSquare,
  RefreshCw,
  Search,
  Loader2,
  AlertTriangle,
  Users,
  UserCheck,
  Hourglass,
  UserX,
} from "lucide-react";

import { apiGet, apiPost } from "../services/api";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";
import NadaEncontrado from "../components/NadaEncontrado";
import { formatarCPF, formatarDataBrasileira } from "../utils/dateTime";
import Footer from "../components/Footer";

/* ───────────────── helpers anti-UTC ───────────────── */
const ymd = (s) => {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null;
};
const hms = (s, fb = "00:00") => {
  const [hh, mm] = String(s || fb)
    .split(":")
    .map((n) => parseInt(n, 10) || 0);
  return { hh, mm };
};
const makeLocalDate = (ymdStr, hhmm = "00:00") => {
  const d = ymd(ymdStr);
  const t = hms(hhmm);
  return d ? new Date(d.y, d.mo - 1, d.d, t.hh, t.mm, 0, 0) : new Date(NaN);
};

/* ───────────────── sessão: valida token com JWT URL-safe ───────────────── */
function getValidToken() {
  try {
    const raw = localStorage.getItem("token");
    if (!raw) return null;
    const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(b64 + pad));
    const now = Date.now() / 1000;
    if (payload?.nbf && now < payload.nbf) return null;
    if (payload?.exp && now >= payload.exp) return null;
    return token;
  } catch {
    return null;
  }
}

/* ───────────────── HeaderHero padronizado (degradê 3 cores) ───────────────── */
function HeaderHero({ turmaId, onRefresh, carregando }) {
  return (
    <header className="relative isolate overflow-hidden bg-gradient-to-br from-amber-900 via-orange-800 to-rose-700 text-white">
      {/* skip link (a11y) */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-white focus:text-black focus:px-3 focus:py-2 focus:rounded-lg focus:shadow"
      >
        Pular para o conteúdo
      </a>

      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(52% 60% at 50% 0%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 32%, rgba(255,255,255,0) 60%)",
        }}
        aria-hidden="true"
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 md:py-12 min-h-[160px] sm:min-h-[190px] text-center flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-2">
          <CheckSquare className="w-6 h-6" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Presenças por Turma</h1>
        </div>
        <p className="text-sm sm:text-base text-white/90 max-w-2xl">
          Consulte e, quando aplicável, confirme presenças manualmente até <span className="font-semibold">48h</span>{" "}
          após o término.
        </p>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-sm">
            <span className="font-semibold">Turma</span> #{turmaId || "—"}
          </span>

          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/25 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-70 disabled:cursor-not-allowed"
            aria-label="Atualizar lista de presenças"
            title="Atualizar"
            disabled={carregando}
          >
            {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </button>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* ───────────────── ministat card ───────────────── */
function MiniStat({ icon: Icon, label, value, tone = "neutral" }) {
  const tones = {
    neutral:
      "bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white",
    ok:
      "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/60 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100",
    warn:
      "bg-amber-50 dark:bg-amber-900/20 border-amber-200/60 dark:border-amber-800 text-amber-900 dark:text-amber-100",
    bad:
      "bg-rose-50 dark:bg-rose-900/20 border-rose-200/60 dark:border-rose-800 text-rose-900 dark:text-rose-100",
  };

  return (
    <div className={`rounded-2xl border p-3 sm:p-4 text-center shadow-sm ${tones[tone] || tones.neutral}`}>
      <div className="inline-flex items-center justify-center gap-2 text-[11px] sm:text-xs opacity-80">
        {Icon ? <Icon className="w-4 h-4" aria-hidden="true" /> : null}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">{value}</div>
    </div>
  );
}

/* ───────────────── status helpers ───────────────── */
function getStatusFlags(p, agora = new Date()) {
  const inicio = makeLocalDate(p.data_referencia, p.horario_inicio || "00:00");
  const fim = makeLocalDate(p.data_referencia, p.horario_fim || "23:59");
  const expiracao = new Date(fim.getTime() + 48 * 60 * 60 * 1000);
  const passou60min = differenceInMinutes(agora, inicio) > 60;

  const presente = Boolean(p.data_presenca) || Boolean(p.presente);
  const dentroJanelaConfirmacao = passou60min && isBefore(agora, expiracao);

  return { presente, passou60min, expiracao, dentroJanelaConfirmacao };
}

export default function PresencasPorTurma() {
  const reduceMotion = useReducedMotion();

  const { turmaId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [confirmandoId, setConfirmandoId] = useState(null);
  const [busca, setBusca] = useState("");
  const liveRef = useRef(null);
  const inputBuscaRef = useRef(null);
  const abortRef = useRef(null);

  const setLive = useCallback((msg) => {
    if (liveRef.current) liveRef.current.textContent = msg || "";
  }, []);

  // gate de sessão coerente (preserva retorno)
  useEffect(() => {
    if (!getValidToken()) {
      const redirect = `${location.pathname}${location.search}`;
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const turmaIdNum = useMemo(() => Number(turmaId), [turmaId]);
  const turmaValida = useMemo(
    () => Boolean(turmaId) && !Number.isNaN(turmaIdNum) && turmaIdNum > 0,
    [turmaId, turmaIdNum]
  );

  const carregar = useCallback(async () => {
    if (!turmaValida) {
      setErro("ID da turma inválido.");
      setCarregando(false);
      setDados([]);
      setLive("ID da turma inválido.");
      return;
    }

    // cancela requisição anterior (se houver)
    try {
      abortRef.current?.abort?.();
    } catch {
      // noop
    }
    abortRef.current = typeof AbortController !== "undefined" ? new AbortController() : null;

    try {
      setCarregando(true);
      setErro("");
      setLive("Carregando presenças…");

      const data = await apiGet(`/api/relatorio-presencas/turma/${turmaIdNum}`, {
        signal: abortRef.current?.signal,
      });

      const lista = Array.isArray(data?.lista) ? data.lista : Array.isArray(data) ? data : [];
      setDados(lista);
      setLive(`Presenças carregadas. Total: ${lista.length}.`);
    } catch (e) {
      if (e?.name === "AbortError") return;
      console.error(e);
      setErro("Erro ao carregar presenças da turma.");
      toast.error("❌ Erro ao carregar presenças da turma.");
      setDados([]);
      setLive("Falha ao carregar presenças.");
    } finally {
      setCarregando(false);
    }
  }, [setLive, turmaIdNum, turmaValida]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // filtro local (nome/CPF)
  const normaliza = useCallback(
    (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase(),
    []
  );

  const filtrados = useMemo(() => {
    const q = normaliza(busca).trim();
    if (!q) return dados;

    const qdigits = q.replace(/\D/g, "");
    return dados.filter((p) => {
      const nome = normaliza(p.nome);
      const cpf = String(p.cpf || "").replace(/\D/g, "");
      return nome.includes(q) || (qdigits && cpf.includes(qdigits));
    });
  }, [dados, busca, normaliza]);

  // ministats
  const stats = useMemo(() => {
    const agora = new Date();
    let presentes = 0;
    let aguardando = 0;
    let faltas = 0;

    for (const p of filtrados) {
      const { presente, passou60min, dentroJanelaConfirmacao } = getStatusFlags(p, agora);

      if (presente) {
        presentes += 1;
      } else if (!passou60min) {
        aguardando += 1;
      } else if (dentroJanelaConfirmacao) {
        faltas += 1; // falta confirmável
      } else {
        faltas += 1; // expirado também conta
      }
    }

    return { total: filtrados.length, presentes, aguardando, faltas };
  }, [filtrados]);

  const confirmarPresencaManual = useCallback(
    async (usuario_id, turma_id, data_referencia, nome) => {
      try {
        const btnId = `${usuario_id}-${data_referencia}`;
        setConfirmandoId(btnId);
        setLive(`Confirmando presença de ${nome || "usuário"}…`);

        await apiPost("/api/presencas/confirmar-simples", {
          turma_id: Number(turma_id),
          usuario_id,
          data: data_referencia, // unificado (date-only)
        });

        toast.success("✅ Presença confirmada!");
        setLive("Presença confirmada.");

        // update otimista
        setDados((prev) =>
          prev.map((item) =>
            item.usuario_id === usuario_id &&
            item.turma_id === turma_id &&
            item.data_referencia === data_referencia
              ? { ...item, data_presenca: data_referencia, presente: true }
              : item
          )
        );
      } catch (e) {
        console.error(e);
        toast.error("❌ Erro ao confirmar presença.");
        setLive("Falha ao confirmar presença.");
      } finally {
        setConfirmandoId(null);
      }
    },
    [setLive]
  );

  const limparBusca = useCallback(() => {
    setBusca("");
    setLive("Busca limpa.");
    inputBuscaRef.current?.focus?.();
  }, [setLive]);

  const motionWrap = useMemo(
    () => ({
      initial: reduceMotion ? false : { opacity: 0, y: 10 },
      animate: reduceMotion ? {} : { opacity: 1, y: 0 },
      exit: reduceMotion ? {} : { opacity: 0, y: 10 },
      transition: { duration: 0.18 },
    }),
    [reduceMotion]
  );

  const renderStatus = useCallback(
    (p) => {
      const agora = new Date();
      const { presente, passou60min, dentroJanelaConfirmacao } = getStatusFlags(p, agora);

      if (presente) {
        return (
          <span className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 px-2.5 py-1 rounded-full font-semibold text-xs">
            ✅ Presente
          </span>
        );
      }

      if (!passou60min) {
        return (
          <span className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 px-2.5 py-1 rounded-full font-semibold text-xs">
            🟡 Aguardando
          </span>
        );
      }

      if (dentroJanelaConfirmacao) {
        const btnId = `${p.usuario_id}-${p.data_referencia}`;
        const loading = confirmandoId === btnId;

        return (
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <span className="inline-flex items-center gap-2 bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200 px-2.5 py-1 rounded-full font-semibold text-xs">
              🟥 Faltou
            </span>

            <button
              type="button"
              onClick={() =>
                confirmarPresencaManual(p.usuario_id, p.turma_id, p.data_referencia, p.nome)
              }
              className="inline-flex items-center gap-2 text-xs bg-sky-700 text-white px-2.5 py-1.5 rounded-lg hover:bg-sky-800 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-700"
              disabled={loading}
              aria-label={`Confirmar presença de ${p.nome} em ${formatarDataBrasileira(p.data_referencia)}`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Confirmando…
                </>
              ) : (
                "Confirmar"
              )}
            </button>
          </div>
        );
      }

      return (
        <span className="inline-flex items-center gap-2 bg-rose-200 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100 px-2.5 py-1 rounded-full font-semibold text-xs">
          🟥 Faltou (Expirado)
        </span>
      );
    },
    [confirmandoId, confirmarPresencaManual]
  );

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero turmaId={turmaId} onRefresh={carregar} carregando={carregando} />

      <main
        id="conteudo"
        role="main"
        className="flex-1 px-3 sm:px-4 py-6"
        aria-busy={carregando ? "true" : "false"}
      >
        {/* live region acessível */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        <section className="max-w-5xl mx-auto">
          {/* busca + mini-stats */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/40 backdrop-blur p-3 sm:p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search
                    className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    aria-hidden="true"
                  />
                  <input
                    ref={inputBuscaRef}
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por nome ou CPF…"
                    className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-600"
                    aria-label="Buscar por nome ou CPF"
                    inputMode="search"
                    autoComplete="off"
                  />
                  {busca ? (
                    <button
                      type="button"
                      onClick={limparBusca}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg text-xs bg-slate-100 hover:bg-slate-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
                      aria-label="Limpar busca"
                      title="Limpar"
                    >
                      Limpar
                    </button>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={carregar}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700 disabled:opacity-70 disabled:cursor-not-allowed"
                  aria-label="Atualizar presenças"
                  title="Atualizar"
                  disabled={carregando}
                >
                  {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Atualizar
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <MiniStat icon={Users} label="Total (filtrado)" value={stats.total} tone="neutral" />
                <MiniStat icon={UserCheck} label="Presentes" value={stats.presentes} tone="ok" />
                <MiniStat icon={Hourglass} label="Aguardando" value={stats.aguardando} tone="warn" />
                <MiniStat icon={UserX} label="Faltas" value={stats.faltas} tone="bad" />
              </div>
            </div>
          </div>

          {/* conteúdo */}
          <div className="mt-5">
            <AnimatePresence mode="wait">
              {carregando ? (
                <motion.div key="loading" {...motionWrap}>
                  <CarregandoSkeleton texto="Carregando presenças..." linhas={6} />
                </motion.div>
              ) : erro ? (
                <motion.div key="error" {...motionWrap}>
                  <div className="rounded-2xl border border-rose-200/60 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/15 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 mt-0.5" aria-hidden="true" />
                      <div className="flex-1">
                        <ErroCarregamento mensagem={erro} />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={carregar}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-700"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Tentar novamente
                          </button>

                          <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400"
                          >
                            Voltar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : !turmaValida ? (
                <motion.div key="invalid" {...motionWrap}>
                  <NadaEncontrado titulo="Turma inválida" subtitulo="Verifique o ID na rota /turma/:turmaId." />
                </motion.div>
              ) : filtrados?.length ? (
                <motion.section
                  key="content"
                  {...motionWrap}
                  aria-label={`Lista de presenças da turma ${turmaId || ""}`}
                  className="space-y-3"
                >
                  {filtrados.map((p) => (
                    <article
                      key={`${p.usuario_id}-${p.data_referencia}`}
                      className="border border-slate-200 dark:border-zinc-700 p-4 rounded-2xl bg-white dark:bg-zinc-800 shadow-sm"
                      aria-label={`Registro de ${p.nome}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-lousa dark:text-white font-extrabold tracking-tight truncate">
                            {p.nome}
                          </p>

                          <div className="mt-1 flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
                            <p>CPF: {p.cpf ? formatarCPF(p.cpf) : "—"}</p>
                            <p>
                              Data: {formatarDataBrasileira(p.data_referencia)} —{" "}
                              {p.horario_inicio || "—"} às {p.horario_fim || "—"}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 mt-1 sm:mt-0">{renderStatus(p)}</div>
                      </div>
                    </article>
                  ))}
                </motion.section>
              ) : (
                <motion.div key="empty" {...motionWrap}>
                  <NadaEncontrado
                    titulo={busca ? "Nenhum registro corresponde à busca" : "Nenhum registro encontrado"}
                    subtitulo={busca ? "Tente outro termo ou limpe a busca." : "Essa turma não possui registros."}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
