// ✅ src/pages/PresencaManual.jsx (premium: hero + ministats + busca + a11y + motion + UX mobile)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CheckSquare,
  RefreshCw,
  Search,
  AlertTriangle,
  Loader2,
  Users,
  UserCheck,
  UserX,
} from "lucide-react";

import { apiGet, apiPost } from "../services/api";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";
import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import { formatarCPF } from "../utils/dateTime";

/* ───────────────── helpers anti-UTC (date-only safe) ───────────────── */
const hojeLocalISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const fmtBRDateOnlyFromISO = (iso) => {
  if (!iso || typeof iso !== "string") return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
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
function HeaderHero({ turmaId, hojeISO, onRefresh, carregando }) {
  const dataBR = useMemo(() => fmtBRDateOnlyFromISO(hojeISO), [hojeISO]);

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
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Presença Manual</h1>
        </div>

        <p className="text-sm sm:text-base text-white/90 max-w-2xl">
          Marque presenças do dia na turma selecionada. A operação é idempotente e fica registrada.
        </p>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-sm">
            <span className="font-semibold">Turma</span> #{turmaId || "—"}
          </span>

          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-sm">
            <span className="font-semibold">Data</span> {dataBR}
          </span>

          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/25 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-70 disabled:cursor-not-allowed"
            aria-label="Atualizar lista de inscritos"
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

export default function PresencaManual() {
  const reduceMotion = useReducedMotion();

  const [params] = useSearchParams();
  const turmaId = params.get("turma");
  const navigate = useNavigate();
  const location = useLocation();

  // estado
  const [inscritos, setInscritos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [marcando, setMarcando] = useState(null); // usuario_id em processamento

  // a11y / ux
  const liveRef = useRef(null);
  const inputBuscaRef = useRef(null);
  const abortRef = useRef(null);

  const hojeISO = useMemo(() => hojeLocalISO(), []);
  const hojeBR = useMemo(() => fmtBRDateOnlyFromISO(hojeISO), [hojeISO]);

  const setLive = useCallback((msg) => {
    if (liveRef.current) liveRef.current.textContent = msg || "";
  }, []);

  // gate de sessão: redireciona de forma consistente (usa ?redirect=)
  useEffect(() => {
    if (!getValidToken()) {
      const redirect = `${location.pathname}${location.search}`;
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const turmaIdNum = useMemo(() => Number(turmaId), [turmaId]);
  const turmaValida = useMemo(() => Boolean(turmaId) && !Number.isNaN(turmaIdNum) && turmaIdNum > 0, [turmaId, turmaIdNum]);

  // carregar inscritos
  const carregarInscritos = useCallback(async () => {
    if (!turmaValida) {
      setErro("Turma inválida.");
      setInscritos([]);
      setCarregando(false);
      setLive("Turma inválida.");
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
      setLive("Carregando inscritos…");

      // Se seu apiGet NÃO aceita signal, isso será ignorado (ok).
      const data = await apiGet(`/api/turmas/${turmaIdNum}/inscritos`, {
        signal: abortRef.current?.signal,
      });

      const lista = Array.isArray(data) ? data : [];
      setInscritos(lista);
      setLive(`Inscritos carregados. Total: ${lista.length}.`);
    } catch (e) {
      // abort não deve “poluir” UX
      if (e?.name === "AbortError") return;

      console.error(e);
      toast.error("❌ Erro ao carregar inscritos.");
      setErro("Erro ao carregar inscritos.");
      setInscritos([]);
      setLive("Falha ao carregar inscritos.");
    } finally {
      setCarregando(false);
    }
  }, [setLive, turmaIdNum, turmaValida]);

  useEffect(() => {
    carregarInscritos();
  }, [carregarInscritos]);

  // filtro local por nome/CPF
  const normaliza = useCallback(
    (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase(),
    []
  );

  const filtrados = useMemo(() => {
    const q = normaliza(busca).trim();
    if (!q) return inscritos;

    const qNum = q.replace(/\D/g, "");
    return inscritos.filter((i) => {
      const nome = normaliza(i.nome);
      const cpf = String(i.cpf || "");
      const cpfNum = cpf.replace(/\D/g, "");
      return nome.includes(q) || (qNum && cpfNum.includes(qNum));
    });
  }, [inscritos, busca, normaliza]);

  // mini-stats (do dia)
  const stats = useMemo(() => {
    const total = filtrados.length;
    let presentes = 0;

    for (const i of filtrados) {
      const presencas = Array.isArray(i.data_presenca) ? i.data_presenca : [];
      if (presencas.includes(hojeISO)) presentes += 1;
    }

    return {
      total,
      presentes,
      ausentes: Math.max(0, total - presentes),
    };
  }, [filtrados, hojeISO]);

  // ação: registrar presença
  const registrarPresenca = useCallback(
    async (usuario_id, nome) => {
      if (!turmaValida) return;

      setMarcando(usuario_id);
      setLive(`Registrando presença para ${nome || "usuário"}…`);

      try {
        await apiPost(`/api/presencas/confirmar-simples`, {
          turma_id: turmaIdNum,
          usuario_id,
          data: hojeISO, // backend espera 'data' (date-only)
        });

        toast.success("✅ Presença registrada.");

        // atualização otimista
        setInscritos((prev) =>
          prev.map((i) => {
            if (i.usuario_id !== usuario_id) return i;
            const lista = Array.isArray(i.data_presenca) ? i.data_presenca : [];
            if (lista.includes(hojeISO)) return i;
            return { ...i, data_presenca: [...lista, hojeISO] };
          })
        );

        setLive(`Presença registrada para ${nome || "usuário"}.`);
      } catch (e) {
        console.error(e);
        toast.warning("⚠️ Presença já registrada ou erro no servidor.");
        setLive("Falha ao registrar presença.");
      } finally {
        setMarcando(null);
      }
    },
    [hojeISO, setLive, turmaIdNum, turmaValida]
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

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero turmaId={turmaId} hojeISO={hojeISO} onRefresh={carregarInscritos} carregando={carregando} />

      <main
        id="conteudo"
        role="main"
        className="flex-1 px-3 sm:px-4 py-6"
        aria-busy={carregando ? "true" : "false"}
      >
        {/* live region de feedback */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        <section className="max-w-4xl mx-auto">
          {/* topo (busca + ações) */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/40 backdrop-blur p-3 sm:p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
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
                  onClick={carregarInscritos}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700 disabled:opacity-70 disabled:cursor-not-allowed"
                  aria-label="Atualizar lista de inscritos"
                  title="Atualizar"
                  disabled={carregando}
                >
                  {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Atualizar
                </button>
              </div>

              {/* ministats */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <MiniStat icon={Users} label="Total (filtrado)" value={stats.total} tone="neutral" />
                <MiniStat icon={UserCheck} label={`Presentes em ${hojeBR}`} value={stats.presentes} tone="ok" />
                <MiniStat icon={UserX} label={`Ausentes em ${hojeBR}`} value={stats.ausentes} tone="bad" />
              </div>
            </div>
          </div>

          {/* conteúdo */}
          <div className="mt-5">
            <AnimatePresence mode="wait">
              {carregando ? (
                <motion.div key="loading" {...motionWrap}>
                  <CarregandoSkeleton linhas={6} />
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
                            onClick={carregarInscritos}
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
                  <NadaEncontrado
                    titulo="Turma inválida"
                    subtitulo="Verifique o parâmetro ?turma= na URL."
                  />
                </motion.div>
              ) : (
                <motion.section
                  key="content"
                  {...motionWrap}
                  aria-label={`Lista de inscritos da turma ${turmaId || ""}`}
                  className="rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/40 shadow-sm overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-700 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-extrabold tracking-tight">Inscritos</h2>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Dica: você pode buscar por nome ou CPF. A lista abaixo respeita o filtro.
                      </p>
                    </div>

                    <div className="shrink-0 text-xs text-slate-600 dark:text-slate-300">
                      Exibindo <span className="font-semibold">{filtrados.length}</span>
                    </div>
                  </div>

                  {filtrados.length ? (
                    <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {filtrados.map((inscrito) => {
                        const presencas = Array.isArray(inscrito.data_presenca) ? inscrito.data_presenca : [];
                        const presenteHoje = presencas.includes(hojeISO);
                        const bloqueado = presenteHoje || marcando === inscrito.usuario_id;

                        return (
                          <li key={inscrito.usuario_id} className="p-3 sm:p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">
                                  {inscrito.nome}{" "}
                                  {inscrito.cpf ? (
                                    <span className="font-normal text-slate-600 dark:text-slate-300">
                                      ({formatarCPF(inscrito.cpf)})
                                    </span>
                                  ) : null}
                                </p>

                                <p
                                  className={`mt-1 text-sm ${
                                    presenteHoje
                                      ? "text-emerald-700 dark:text-emerald-400"
                                      : "text-slate-600 dark:text-slate-300"
                                  }`}
                                >
                                  {presenteHoje ? "✅ Presente hoje" : "❌ Ausente hoje"}
                                </p>
                              </div>

                              <div className="shrink-0">
                                <button
                                  type="button"
                                  onClick={() => registrarPresenca(inscrito.usuario_id, inscrito.nome)}
                                  className={`inline-flex items-center justify-center gap-2 text-sm px-3 py-2 rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700 ${
                                    presenteHoje
                                      ? "bg-slate-200 text-slate-700 dark:bg-zinc-700 dark:text-white cursor-not-allowed"
                                      : "bg-amber-700 hover:bg-amber-800 text-white"
                                  }`}
                                  aria-label={`Marcar presença para ${inscrito.nome}`}
                                  disabled={bloqueado}
                                >
                                  {marcando === inscrito.usuario_id ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      Registrando…
                                    </>
                                  ) : presenteHoje ? (
                                    "✔️ Registrado"
                                  ) : (
                                    "Marcar presença"
                                  )}
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="p-6">
                      <NadaEncontrado
                        titulo={busca ? "Nenhum inscrito corresponde à busca" : "Nenhum inscrito encontrado"}
                        subtitulo={
                          busca
                            ? "Tente ajustar o termo ou limpe a busca para ver todos."
                            : "Essa turma ainda não possui inscritos ou a lista está vazia."
                        }
                      />
                    </div>
                  )}
                </motion.section>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
