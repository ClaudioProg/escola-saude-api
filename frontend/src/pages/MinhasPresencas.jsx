// ✅ src/pages/MinhasPresencas.jsx
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  RefreshCw,
} from "lucide-react";

import { apiGetMinhasPresencas } from "../services/api";
import BotaoPrimario from "../components/BotaoPrimario";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";
import Footer from "../components/Footer";
import { formatarDataBrasileira } from "../utils/data";

const CERT_THRESHOLD = 75;

/* ───────────────── Header hero com variantes de cor ───────────────── */
function HeaderHero({ onRefresh, variant = "sky" }) {
  const variants = {
    // use estes nas outras páginas para variar o visual:
    sky: "from-sky-900 via-sky-800 to-sky-700",
    violet: "from-violet-900 via-violet-800 to-violet-700",
    amber: "from-amber-900 via-amber-800 to-amber-700",
    rose: "from-rose-900 via-rose-800 to-rose-700",
    teal: "from-teal-900 via-teal-800 to-teal-700",
    indigo: "from-indigo-900 via-indigo-800 to-indigo-700",
  };
  const grad = variants[variant] ?? variants.sky;

  return (
    <header className={`bg-gradient-to-br ${grad} text-white`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Minhas Presenças
          </h1>
        </div>
        <p className="text-sm text-white/90">
          Visualize suas presenças por evento/turma, frequência e elegibilidade
          para avaliação/certificado.
        </p>
        <BotaoPrimario
          onClick={onRefresh}
          variante="secundario"
          icone={<RefreshCw className="w-4 h-4" />}
          aria-label="Atualizar lista de presenças"
        >
          Atualizar
        </BotaoPrimario>
      </div>
    </header>
  );
}

/* ───────────────── UI helpers ───────────────── */
function Badge({ children, tone = "default", title }) {
  const map = {
    default: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
    warn: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
    danger: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
    info: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
    brand: "bg-emerald-200 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${map[tone]}`}>
      {children}
    </span>
  );
}

function ProgressBar({ value = 0, threshold = CERT_THRESHOLD }) {
  const pct = Math.max(0, Math.min(100, value));
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

/* ───────────────── util: descobrir datas de ausência ───────────────── */
function extrairTodasAsDatas(t) {
  // fontes comuns
  const cand =
    t?.datas?.todas ||
    t?.datas?.encontros ||
    t?.datas?.aulas ||
    t?.encontros ||
    t?.todas_datas ||
    t?.datas_encontros;

  if (Array.isArray(cand) && cand.length) return cand;

  // varre qualquer array “com cara de data” dentro de t.datas (exceto presentes/ausencias)
  const out = new Set();
  if (t?.datas && typeof t.datas === "object") {
    for (const [k, v] of Object.entries(t.datas)) {
      if (k === "presentes" || k === "ausencias") continue;
      if (Array.isArray(v)) {
        v.forEach((x) => {
          if (typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x)) out.add(x);
        });
      }
    }
  }
  return Array.from(out);
}

export default function MinhasPresencas() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = async () => {
    try {
      setErro("");
      setLoading(true);
      const resp = await apiGetMinhasPresencas();
      setData(resp || { turmas: [] });
    } catch (e) {
      console.error(e);
      setErro(e?.message || "Falha ao carregar suas presenças.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const turmas = useMemo(() => data?.turmas || [], [data]);

  /* estados base */
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900">
        <HeaderHero onRefresh={carregar} variant="sky" />
        <main role="main" className="flex-1 px-4 py-6 max-w-6xl mx-auto">
          <CarregandoSkeleton titulo="Minhas Presenças" linhas={6} />
        </main>
        <Footer />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900">
        <HeaderHero onRefresh={carregar} variant="sky" />
        <main role="main" className="flex-1 px-4 py-6 max-w-6xl mx-auto">
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-200" role="alert" aria-live="assertive">
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
        <HeaderHero onRefresh={carregar} variant="sky" />
        <main role="main" className="flex-1 px-4 py-6 max-w-6xl mx-auto">
          <NadaEncontrado
            titulo="Nenhuma presença encontrada"
            descricao="Você ainda não possui turmas com presença registrada."
          />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900">
      {/* 💙 esta página usa 'sky'; nas outras, trocamos a variante */}
      <HeaderHero onRefresh={carregar} variant="sky" />

      <main role="main" className="flex-1 px-4 py-6 max-w-6xl mx-auto">
        <div role="list" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {turmas.map((t, idx) => {
            const statusTone =
              t.status === "andamento" ? "info" :
              t.status === "encerrado" ? "success" : "default";

            const total = Number(t.total_encontros || 0);
            const presentes = Number(t.presentes || 0);
            const ausenciasCalc = Math.max(0, total - presentes);
            const ausencias = Number(
              typeof t.ausencias === "number" ? t.ausencias : ausenciasCalc
            );

            const freqRaw = typeof t.frequencia === "number"
              ? t.frequencia
              : total > 0 ? (presentes / total) * 100 : 0;
            const freq = Math.max(0, Math.min(100, freqRaw));

            const meets75 =
              (t.elegivel_avaliacao === true) ||
              (freq >= CERT_THRESHOLD && String(t.status).toLowerCase() === "encerrado");

            // ► derivar datas de ausência
            let datasAusencias = Array.isArray(t?.datas?.ausencias) ? t.datas.ausencias : null;
            const todasDatas = extrairTodasAsDatas(t);
            if ((!datasAusencias || !datasAusencias.length) && todasDatas?.length) {
              const presentesSet = new Set((t?.datas?.presentes || []).map(String));
              datasAusencias = todasDatas.filter((d) => !presentesSet.has(String(d)));
            }

            // último fallback textual se temos contagem mas não a(s) data(s)
            const precisaFallbackTexto =
              (!datasAusencias || datasAusencias.length === 0) && ausencias > 0;

            return (
              <motion.div
                role="listitem"
                key={t.turma_id ?? idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.03 }}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {t.evento_titulo}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Turma: <span className="font-medium">{t.turma_nome || `#${t.turma_id}`}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone} title="Status da turma">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="capitalize">{t.status}</span>
                    </Badge>
                    {meets75 && (
                      <Badge tone="brand" title="Elegível para avaliação (≥ 75% e turma encerrada)">
                        <Award className="w-3.5 h-3.5" />
                        Elegível
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <CalendarDays className="w-4 h-4" />
                  <span>
                    {formatarDataBrasileira(t?.periodo?.data_inicio)}{t?.periodo?.horario_inicio ? ` às ${t.periodo.horario_inicio}` : ""} —{" "}
                    {formatarDataBrasileira(t?.periodo?.data_fim)}{t?.periodo?.horario_fim ? ` às ${t.periodo.horario_fim}` : ""}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-center">
                    <div className="text-xs text-slate-500 dark:text-slate-300">Total encontros</div>
                    <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{total}</div>
                  </div>
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/30 p-3 text-center">
                    <div className="text-xs text-emerald-700 dark:text-emerald-200">Presentes</div>
                    <div className="text-lg font-semibold text-emerald-800 dark:text-emerald-100">{presentes}</div>
                  </div>
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-900/30 p-3 text-center">
                    <div className="text-xs text-rose-700 dark:text-rose-200">Ausências</div>
                    <div className="text-lg font-semibold text-rose-800 dark:text-rose-100">{ausencias}</div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-300">Frequência</span>
                    <span className={`font-semibold ${freq >= CERT_THRESHOLD ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                      {freq.toFixed(1)}%
                    </span>
                  </div>
                  <ProgressBar value={freq} threshold={CERT_THRESHOLD} />
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
                    {freq >= CERT_THRESHOLD ? "Requisito de 75% atendido." : "Atenção: frequência abaixo de 75%."}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                    <div className="flex items-center gap-2 mb-2 text-slate-800 dark:text-slate-100">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-medium">Datas com Presença</span>
                    </div>
                    {t.datas?.presentes?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {t.datas.presentes.map((d) => (
                          <span key={d} className="px-2 py-0.5 rounded-md text-xs bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                            {formatarDataBrasileira(d)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">—</div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                    <div className="flex items-center gap-2 mb-2 text-slate-800 dark:text-slate-100">
                      <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <span className="text-sm font-medium">Datas de Ausência</span>
                    </div>
                    {Array.isArray(datasAusencias) && datasAusencias.length ? (
                      <div className="flex flex-wrap gap-2">
                        {datasAusencias.map((d) => (
                          <span key={d} className="px-2 py-0.5 rounded-md text-xs bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
                            {formatarDataBrasileira(d)}
                          </span>
                        ))}
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
        </div>
      </main>

      <Footer />
    </div>
  );
}
