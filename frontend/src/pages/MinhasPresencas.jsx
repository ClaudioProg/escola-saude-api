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
import { formatarDataBrasileira } from "../utils/data";

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

function ProgressBar({ value = 0 }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden dark:bg-slate-800">
      <div
        className="h-full bg-emerald-600 dark:bg-emerald-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function MinhasPresencas() {
  const [data, setData] = useState(null);           // { usuario_id, total_turmas, turmas: [...] }
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

  if (loading) return <CarregandoSkeleton titulo="Minhas Presenças" linhas={6} />;
  if (erro) {
    return (
      <div className="max-w-5xl mx-auto p-4">
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-200">
          {erro}
        </div>
        <div className="mt-3">
          <BotaoPrimario onClick={carregar} icone={<RefreshCw className="w-4 h-4" />}>
            Tentar novamente
          </BotaoPrimario>
        </div>
      </div>
    );
  }

  if (!turmas.length) {
    return (
      <div className="max-w-5xl mx-auto p-4">
        <NadaEncontrado titulo="Nenhuma presença encontrada" descricao="Você ainda não possui turmas com presença registrada." />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Cabeçalho */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">Minhas Presenças</h1>
          <p className="text-slate-600 dark:text-slate-300 text-sm">
            Visualize suas presenças por evento/turma, frequência e elegibilidade para avaliação/certificado.
          </p>
        </div>
        <div className="flex gap-2">
          <BotaoPrimario onClick={carregar} variante="secundario" icone={<RefreshCw className="w-4 h-4" />}>
            Atualizar
          </BotaoPrimario>
        </div>
      </div>

      {/* Lista de cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {turmas.map((t) => {
          const statusTone =
            t.status === "andamento" ? "info" :
            t.status === "encerrado" ? "success" : "default";

          const freq = Number(t.frequencia || 0); // já vem em %
          const meets75 = !!t.elegivel_avaliacao;

          return (
            <motion.div
              key={t.turma_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-4"
            >
              {/* Título */}
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

              {/* Período */}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CalendarDays className="w-4 h-4" />
                <span>
                  {formatarDataBrasileira(t?.periodo?.data_inicio)} {t?.periodo?.horario_inicio ? `às ${t.periodo.horario_inicio}` : ""} —{" "}
                  {formatarDataBrasileira(t?.periodo?.data_fim)} {t?.periodo?.horario_fim ? `às ${t.periodo.horario_fim}` : ""}
                </span>
              </div>

              {/* Métricas principais */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-center">
                  <div className="text-xs text-slate-500 dark:text-slate-300">Total encontros</div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.total_encontros}</div>
                </div>
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/30 p-3 text-center">
                  <div className="text-xs text-emerald-700 dark:text-emerald-200">Presentes</div>
                  <div className="text-lg font-semibold text-emerald-800 dark:text-emerald-100">{t.presentes}</div>
                </div>
                <div className="rounded-xl bg-rose-50 dark:bg-rose-900/30 p-3 text-center">
                  <div className="text-xs text-rose-700 dark:text-rose-200">Ausências</div>
                  <div className="text-lg font-semibold text-rose-800 dark:text-rose-100">{t.ausencias}</div>
                </div>
              </div>

              {/* Frequência */}
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600 dark:text-slate-300">Frequência</span>
                  <span className={`font-semibold ${freq >= 75 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                    {freq.toFixed(1)}%
                  </span>
                </div>
                <ProgressBar value={freq} />
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {freq >= 75 ? "Requisito de 75% atendido." : "Atenção: frequência abaixo de 75%."}
                </div>
              </div>

              {/* Datas do usuário */}
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
                  {t.datas?.ausencias?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {t.datas.ausencias.map((d) => (
                        <span key={d} className="px-2 py-0.5 rounded-md text-xs bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
                          {formatarDataBrasileira(d)}
                        </span>
                      ))}
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
    </div>
  );
}
