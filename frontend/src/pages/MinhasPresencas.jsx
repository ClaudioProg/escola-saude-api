// ✅ src/pages/MinhasPresencas.jsx (premium + mobile-first + a11y + anti-fuso + filtros + ministats)
// - ✅ Mantém layout “HeaderHero 3 cores” padronizado
// - ✅ Corrige cores/status conforme padrão memorizado:
//     programado → verde | andamento → amarelo | encerrado → vermelho
// - ✅ Adiciona: busca, filtro por status, ordenação, ministats globais
// - ✅ Anti-fuso: NÃO usa new Date("YYYY-MM-DD") para lógica de datas (compara strings YMD)
// - ✅ UX: empty states melhores, sticky toolbar, live region, acessível

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  RefreshCw,
  Search,
  Filter,
  ArrowDownAZ,
  ArrowUpAZ,
  Layers,
  ShieldCheck,
} from "lucide-react";

import { apiGetMinhasPresencas } from "../services/api";
import BotaoPrimario from "../components/BotaoPrimario";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";
import Footer from "../components/Footer";
import { formatarDataBrasileira } from "../utils/dateTime";

const CERT_THRESHOLD = 75;

/* ───────────────── Header hero padronizado (3 cores / altura e tipografia iguais) ───────────────── */
function HeaderHero({ onRefresh, variant = "sky", loading = false, kpis }) {
  const variants = {
    sky: "from-sky-900 via-cyan-800 to-blue-700",
    violet: "from-violet-900 via-fuchsia-800 to-pink-700",
    amber: "from-amber-900 via-orange-800 to-yellow-700",
    rose: "from-rose-900 via-rose-800 to-pink-700",
    teal: "from-teal-900 via-emerald-800 to-green-700",
    indigo: "from-indigo-900 via-violet-800 to-fuchsia-700",
  };
  const grad = variants[variant] ?? variants.sky;

  function MiniStat({ label, value, icon: Icon }) {
    return (
      <div className="rounded-2xl bg-white/10 p-3 text-white backdrop-blur border border-white/10">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-white/10 p-2 border border-white/10">
            <Icon className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-white/90">
              {label}
            </div>
            <div className="mt-0.5 text-xl font-extrabold tracking-tight">
              {value ?? "—"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <header
      className={`relative isolate overflow-hidden bg-gradient-to-br ${grad} text-white`}
      role="banner"
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      {/* glow sutil padronizado */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(55% 55% at 50% 0%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 32%, rgba(255,255,255,0) 60%)",
        }}
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 md:py-12 min-h-[150px] sm:min-h-[180px]">
        <div className="flex flex-col items-center text-center gap-3 sm:gap-4">
          <div className="inline-flex items-center justify-center gap-2">
            <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Minhas Presenças
            </h1>
          </div>

          <p className="text-sm sm:text-base text-white/90 max-w-2xl">
            Visualize suas presenças por turma, frequência e elegibilidade para
            avaliação/certificado.
          </p>

          {/* Ministats no hero */}
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-3xl">
            <MiniStat label="Turmas" value={kpis?.turmas ?? "—"} icon={Layers} />
            <MiniStat label="Encerradas" value={kpis?.encerradas ?? "—"} icon={ShieldCheck} />
            <MiniStat label="Elegíveis" value={kpis?.elegiveis ?? "—"} icon={Award} />
            <MiniStat label="Frequência ≥ 75%" value={kpis?.acima75 ?? "—"} icon={CheckCircle2} />
          </div>

          <div className="mt-2 sm:mt-3 flex flex-wrap items-center justify-center gap-2">
            <BotaoPrimario
              onClick={onRefresh}
              variante="secundario"
              icone={<RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />}
              aria-label="Atualizar lista de presenças"
              disabled={loading}
            >
              {loading ? "Atualizando..." : "Atualizar"}
            </BotaoPrimario>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* ───────────────── UI helpers ───────────────── */
function Badge({ children, tone = "default", title }) {
  const map = {
    default: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
    warn: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    danger: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
    info: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${map[tone] || map.default}`}
    >
      {children}
    </span>
  );
}

function ProgressBar({ value = 0, threshold = CERT_THRESHOLD }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const ok = pct >= threshold;
  return (
    <div
      className="w-full h-3 bg-slate-200 rounded-full overflow-hidden dark:bg-slate-800"
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${pct.toFixed(1)}%`}
    >
      <div
        className={`h-full ${ok ? "bg-emerald-600 dark:bg-emerald-500" : "bg-rose-600 dark:bg-rose-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ───────────────── helpers anti-fuso / datas-only ───────────────── */
// extrai "YYYY-MM-DD" com segurança
const ymd = (s) => {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
};

// compara datas YMD (string) sem Date
const cmpYmdDesc = (a, b) => (a < b ? 1 : a > b ? -1 : 0);
const cmpYmdAsc = (a, b) => (a > b ? 1 : a < b ? -1 : 0);

/* ───────────────── util: descobrir datas de ausência ───────────────── */
function extrairTodasAsDatas(t) {
  const cand =
    t?.datas?.todas ||
    t?.datas?.encontros ||
    t?.datas?.aulas ||
    t?.encontros ||
    t?.todas_datas ||
    t?.datas_encontros;

  if (Array.isArray(cand) && cand.length) return cand;

  const out = new Set();
  if (t?.datas && typeof t.datas === "object") {
    for (const [k, v] of Object.entries(t.datas)) {
      if (k === "presentes" || k === "ausencias" || k === "ausentes") continue;
      if (Array.isArray(v)) {
        v.forEach((x) => {
          const d = ymd(x);
          if (d) out.add(d);
        });
      }
    }
  }
  return Array.from(out);
}

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  // ✅ padrão memorizado: programado verde | andamento amarelo | encerrado vermelho
  if (s === "programado") return { tone: "success", label: "Programado", bar: "bg-emerald-600" };
  if (s === "andamento") return { tone: "warn", label: "Em andamento", bar: "bg-amber-500" };
  if (s === "encerrado") return { tone: "danger", label: "Encerrado", bar: "bg-rose-600" };
  return { tone: "default", label: status || "—", bar: "bg-slate-400" };
}

/* ───────────────── Página ───────────────── */
export default function MinhasPresencas() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const liveRef = useRef(null);

  // UI
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState("todos"); // todos | programado | andamento | encerrado
  const [ordenarPor, setOrdenarPor] = useState("recentes"); // recentes | antigos | titulo

  const setLive = useCallback((msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  }, []);

  const carregar = useCallback(async () => {
    try {
      setErro("");
      setLoading(true);
      setLive("Carregando suas presenças…");
      const resp = await apiGetMinhasPresencas();

// aceita: { turmas: [...] } OU { data: [...] } OU array direto OU resumo antigo
const turmas =
  Array.isArray(resp) ? resp :
  Array.isArray(resp?.turmas) ? resp.turmas :
  Array.isArray(resp?.data) ? resp.data :
  Array.isArray(resp?.itens) ? resp.itens :
  [];

setData({ ...(resp || {}), turmas });
      setLive("Presenças carregadas.");
    } catch (e) {
      console.error(e);
      const m = e?.message || "Falha ao carregar suas presenças.";
      setErro(m);
      setLive("Falha ao carregar suas presenças.");
    } finally {
      setLoading(false);
    }
  }, [setLive]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const turmas = useMemo(() => data?.turmas || [], [data]);

  // KPIs (para o hero)
  const kpis = useMemo(() => {
    const total = turmas.length;
    let encerradas = 0;
    let elegiveis = 0;
    let acima75 = 0;

    for (const t of turmas) {
      const st = String(t?.status || "").toLowerCase();
      const freq = Math.max(0, Math.min(100, Number(t?.frequencia || 0)));

      if (st === "encerrado") encerradas++;

      // elegível: se backend já manda, respeita; senão heurística segura (encerrado + ≥75)
      const meets75 =
        t?.elegivel_avaliacao === true ||
        (freq >= CERT_THRESHOLD && st === "encerrado");

      if (meets75) elegiveis++;
      if (freq >= CERT_THRESHOLD) acima75++;
    }

    return {
      turmas: String(total),
      encerradas: String(encerradas),
      elegiveis: String(elegiveis),
      acima75: String(acima75),
    };
  }, [turmas]);

  const q = useMemo(() => String(busca || "").trim().toLowerCase(), [busca]);

  const turmasFiltradas = useMemo(() => {
    const base = (turmas || []).filter((t) => {
      const st = String(t?.status || "").toLowerCase();
      if (fStatus !== "todos" && st !== fStatus) return false;

      if (!q) return true;

      const evento = String(t?.evento_titulo || "").toLowerCase();
      const turmaNome = String(t?.turma_nome || "").toLowerCase();
      const idStr = String(t?.turma_id ?? "").toLowerCase();

      return (
        evento.includes(q) ||
        turmaNome.includes(q) ||
        idStr.includes(q)
      );
    });

    const sorted = base.slice().sort((a, b) => {
      if (ordenarPor === "titulo") {
        const A = String(a?.evento_titulo || "").localeCompare(
          String(b?.evento_titulo || ""),
          "pt-BR"
        );
        if (A !== 0) return A;
      }

      const aFim = ymd(a?.periodo?.data_fim) || ymd(a?.periodo?.data_inicio) || "";
      const bFim = ymd(b?.periodo?.data_fim) || ymd(b?.periodo?.data_inicio) || "";

      if (ordenarPor === "antigos") return cmpYmdAsc(aFim, bFim);
      return cmpYmdDesc(aFim, bFim); // recentes
    });

    return sorted;
  }, [turmas, fStatus, q, ordenarPor]);

  /* ───────── estados base ───────── */
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900">
        <HeaderHero onRefresh={carregar} variant="sky" loading kpis={kpis} />
        <main role="main" className="flex-1 px-3 sm:px-4 py-6 max-w-6xl mx-auto">
          <p ref={liveRef} className="sr-only" aria-live="polite" />
          <CarregandoSkeleton titulo="Minhas Presenças" linhas={6} />
        </main>
        <Footer />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900">
        <HeaderHero onRefresh={carregar} variant="sky" kpis={kpis} />
        <main role="main" className="flex-1 px-3 sm:px-4 py-6 max-w-6xl mx-auto">
          <p ref={liveRef} className="sr-only" aria-live="polite" />
          <div
            className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-200"
            role="alert"
            aria-live="assertive"
          >
            {erro}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!turmas.length) {
    return (
      <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900">
        <HeaderHero onRefresh={carregar} variant="sky" kpis={kpis} />
        <main role="main" className="flex-1 px-3 sm:px-4 py-6 max-w-6xl mx-auto">
          <p ref={liveRef} className="sr-only" aria-live="polite" />
          <NadaEncontrado
            titulo="Nenhuma presença encontrada"
            descricao="Você ainda não possui turmas com presença registrada."
          />
        </main>
        <Footer />
      </div>
    );
  }

  /* ───────── render normal ───────── */
  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900">
      <HeaderHero onRefresh={carregar} variant="sky" kpis={kpis} />

      {/* progress bar fininha quando recarrega */}
      {loading && (
        <div className="sticky top-0 z-40 h-1 w-full bg-sky-100 dark:bg-sky-900/30" role="progressbar" aria-label="Carregando">
          <div className="h-full w-1/3 animate-pulse bg-sky-700" />
        </div>
      )}

      <main role="main" id="conteudo" className="flex-1 px-3 sm:px-4 py-6 max-w-6xl mx-auto">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {/* Toolbar sticky (busca + filtros) */}
        <section
          aria-label="Ferramentas"
          className="sticky top-1 z-30 mb-5 rounded-2xl border border-slate-200 bg-white/80 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por evento, turma ou ID…"
                className="w-full rounded-xl border px-9 py-2 text-sm ring-offset-2 focus:outline-none focus:ring-2 focus:ring-sky-700 dark:border-slate-700 dark:bg-slate-950/30"
                aria-label="Buscar presenças"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Filter className="h-4 w-4" /> Filtros:
              </span>

              <select
                value={fStatus}
                onChange={(e) => setFStatus(e.target.value)}
                className="rounded-xl border px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-700 dark:border-slate-700 dark:bg-slate-950/30"
                aria-label="Filtrar por status"
              >
                <option value="todos">Todos</option>
                <option value="programado">Programado</option>
                <option value="andamento">Em andamento</option>
                <option value="encerrado">Encerrado</option>
              </select>

              <select
                value={ordenarPor}
                onChange={(e) => setOrdenarPor(e.target.value)}
                className="rounded-xl border px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-700 dark:border-slate-700 dark:bg-slate-950/30"
                aria-label="Ordenar"
              >
                <option value="recentes">Mais recentes</option>
                <option value="antigos">Mais antigos</option>
                <option value="titulo">Título (A–Z)</option>
              </select>

              <button
                type="button"
                onClick={carregar}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-3 py-2 text-xs font-extrabold text-white hover:bg-sky-800"
                aria-label="Atualizar"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </button>
            </div>
          </div>

          <div className="mt-2 text-xs text-slate-500">
            {turmasFiltradas.length} turma{turmasFiltradas.length === 1 ? "" : "s"} na visualização
          </div>
        </section>

        {!turmasFiltradas.length ? (
          <NadaEncontrado
            titulo="Nenhum resultado"
            descricao="Nenhuma turma corresponde aos filtros atuais."
          />
        ) : (
          <div role="list" className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            <AnimatePresence>
              {turmasFiltradas.map((t, idx) => {
                const st = statusTone(t?.status);

                const total = Number(t.total_encontros || 0);
                const realizados = Number(t.encontros_realizados ?? t?.base?.atual ?? 0);
                const presentes = Number(t.presentes || 0);
                const ausencias = Number(
                  typeof t.ausencias === "number" ? t.ausencias : Math.max(0, realizados - presentes)
                );

                const freq = Math.max(0, Math.min(100, Number(t.frequencia || 0)));

                const meets75 =
                  t.elegivel_avaliacao === true ||
                  (freq >= CERT_THRESHOLD && String(t.status).toLowerCase() === "encerrado");

                // ► datas de ausência
                let datasAusencias = Array.isArray(t?.datas?.ausentes)
                  ? t.datas.ausentes
                  : Array.isArray(t?.datas?.ausencias)
                  ? t.datas.ausencias
                  : null;

                const todasDatas = extrairTodasAsDatas(t);
                if ((!datasAusencias || !datasAusencias.length) && todasDatas?.length) {
                  const presentesSet = new Set((t?.datas?.presentes || []).map((x) => ymd(x)));
                  datasAusencias = todasDatas.map((x) => ymd(x)).filter((d) => d && !presentesSet.has(d));
                }

                const precisaFallbackTexto =
                  (!datasAusencias || datasAusencias.length === 0) && ausencias > 0;

                return (
                  <motion.div
                    role="listitem"
                    key={t.turma_id ?? `${t.evento_titulo}-${idx}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.22, delay: Math.min(0.12, idx * 0.02) }}
                    className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6"
                  >
                    {/* barrinha superior por status */}
                    <div className={`absolute top-0 left-0 right-0 h-1.5 ${st.bar}`} aria-hidden="true" />

                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0 pt-1">
                        <h2 className="text-base sm:text-lg md:text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-snug break-words">
                          {t.evento_titulo}
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                          Turma: <span className="font-semibold">{t.turma_nome || `#${t.turma_id}`}</span>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1 sm:mt-0">
                        <Badge tone={st.tone} title="Status da turma">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          {st.label}
                        </Badge>

                        {meets75 && (
                          <Badge tone="success" title="≥ 75% e turma encerrada (ou liberado pelo sistema)">
                            <Award className="w-3.5 h-3.5" aria-hidden="true" />
                            Elegível
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <CalendarDays className="w-4 h-4" aria-hidden="true" />
                      <span className="truncate">
                        {formatarDataBrasileira(t?.periodo?.data_inicio)}
                        {t?.periodo?.horario_inicio ? ` às ${t.periodo.horario_inicio}` : ""} —{" "}
                        {formatarDataBrasileira(t?.periodo?.data_fim)}
                        {t?.periodo?.horario_fim ? ` às ${t.periodo.horario_fim}` : ""}
                      </span>
                    </div>

                    {/* ministats */}
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-center">
                        <div className="text-xs text-slate-500 dark:text-slate-300">Encontros</div>
                        <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                          {realizados}/{total}
                        </div>
                      </div>

                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/30 p-3 text-center">
                        <div className="text-xs text-emerald-700 dark:text-emerald-200">Presentes</div>
                        <div className="text-lg font-extrabold text-emerald-800 dark:text-emerald-100">
                          {presentes}
                        </div>
                      </div>

                      <div className="rounded-xl bg-rose-50 dark:bg-rose-900/30 p-3 text-center">
                        <div className="text-xs text-rose-700 dark:text-rose-200">Ausências</div>
                        <div className="text-lg font-extrabold text-rose-800 dark:text-rose-100">
                          {ausencias}
                        </div>
                      </div>
                    </div>

                    {/* frequência */}
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600 dark:text-slate-300">Frequência</span>
                        <span
                          className={`font-extrabold ${
                            freq >= CERT_THRESHOLD
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {freq.toFixed(1)}%
                        </span>
                      </div>

                      <ProgressBar value={freq} threshold={CERT_THRESHOLD} />

                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {freq >= CERT_THRESHOLD
                          ? `Requisito de 75% atendido (base: ${realizados} encontro${realizados === 1 ? "" : "s"} realizados).`
                          : `Atenção: abaixo de 75% (base: ${realizados} encontro${realizados === 1 ? "" : "s"} realizados).`}
                      </div>
                    </div>

                    {/* datas */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                        <div className="flex items-center gap-2 mb-2 text-slate-800 dark:text-slate-100">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-sm font-semibold">Datas com Presença</span>
                        </div>

                        {Array.isArray(t?.datas?.presentes) && t.datas.presentes.length ? (
                          <div className="flex flex-wrap gap-2">
                            {t.datas.presentes.map((d) => {
                              const dd = ymd(d);
                              return (
                                <span
                                  key={dd || String(d)}
                                  className="px-2 py-0.5 rounded-md text-xs bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                                >
                                  {dd ? formatarDataBrasileira(dd) : String(d)}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">—</div>
                        )}
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                        <div className="flex items-center gap-2 mb-2 text-slate-800 dark:text-slate-100">
                          <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          <span className="text-sm font-semibold">Datas de Ausência</span>
                        </div>

                        {Array.isArray(datasAusencias) && datasAusencias.length ? (
                          <div className="flex flex-wrap gap-2">
                            {datasAusencias.map((d) => {
                              const dd = ymd(d);
                              return (
                                <span
                                  key={dd || String(d)}
                                  className="px-2 py-0.5 rounded-md text-xs bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
                                >
                                  {dd ? formatarDataBrasileira(dd) : String(d)}
                                </span>
                              );
                            })}
                          </div>
                        ) : precisaFallbackTexto ? (
                          <div className="text-xs text-slate-500">
                            {ausencias === 1 ? "1 ausência (data não informada)" : `${ausencias} ausências (datas não informadas)`}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">—</div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
