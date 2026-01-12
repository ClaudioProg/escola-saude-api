// 📁 src/components/ResumoPresencasSimples.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Skeleton from "react-loading-skeleton";
import PropTypes from "prop-types";
import { motion, useReducedMotion } from "framer-motion";
import { RefreshCw, Users, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiGet } from "../services/api";

function clamp(n, min, max) {
  const x = Number.isFinite(+n) ? +n : 0;
  return Math.min(Math.max(x, min), max);
}

function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

export default function ResumoPresencasSimples({
  turmaId,
  dataOverride, // { total, presentes } OU lista de presenças
  autoRefreshMs = 0, // ex.: 15000
  className = "",
  "data-testid": testId,

  // extras premium (não quebram)
  thresholdOk = 75,
  label = "Presenças",
  showRefresh = true,
}) {
  const [total, setTotal] = useState(0);
  const [presentes, setPresentes] = useState(0);
  const [carregando, setCarregando] = useState(!dataOverride);
  const [erro, setErro] = useState(null);

  const reduceMotion = useReducedMotion();

  const abortRef = useRef(null);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const efetivarDados = useCallback((raw) => {
    if (Array.isArray(raw)) {
      const tot = raw.length;
      const pres = raw.filter((aluno) => !!aluno?.presente).length;
      return { total: tot, presentes: pres };
    }
    if (raw && typeof raw === "object") {
      return { total: Number(raw.total ?? 0), presentes: Number(raw.presentes ?? 0) };
    }
    return { total: 0, presentes: 0 };
  }, []);

  const aplicar = useCallback(
    ({ total: t0, presentes: p0 }) => {
      const t = clamp(t0, 0, Number.MAX_SAFE_INTEGER);
      const p = clamp(p0, 0, t || 0);
      if (!mountedRef.current) return;
      setTotal(t);
      setPresentes(p);
    },
    []
  );

  const fetchDados = useCallback(async () => {
    if (!turmaId) return;
    if (fetchingRef.current) return; // evita overlap
    fetchingRef.current = true;

    if (mountedRef.current) {
      setErro(null);
      setCarregando(true);
    }

    // cancela chamada anterior
    abortRef.current?.abort?.();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const data = await apiGet(`/api/relatorio-presencas/turma/${turmaId}`, {
        signal: ac.signal,
        on401: "silent",
        on403: "silent",
      });

      const parsed = efetivarDados(data);
      aplicar(parsed);
    } catch (e) {
      if (e?.name !== "AbortError") {
        if (mountedRef.current) {
          setErro("Não foi possível carregar as presenças.");
          setTotal(0);
          setPresentes(0);
        }
      }
    } finally {
      fetchingRef.current = false;
      if (mountedRef.current) setCarregando(false);
    }
  }, [turmaId, efetivarDados, aplicar]);

  // inicial + autoRefresh
  useEffect(() => {
    // limpa timer anterior
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (dataOverride) {
      const parsed = efetivarDados(dataOverride);
      aplicar(parsed);
      if (mountedRef.current) {
        setCarregando(false);
        setErro(null);
      }
      return; // sem polling quando a fonte é externa
    }

    fetchDados();

    // auto refresh (timeout recursivo para evitar overlap)
    const tick = () => {
      timerRef.current = setTimeout(async () => {
        await fetchDados();
        tick();
      }, Math.max(1000, autoRefreshMs));
    };

    if (autoRefreshMs > 0) tick();

    return () => {
      abortRef.current?.abort?.();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaId, autoRefreshMs, !!dataOverride]);

  const porcentagem = useMemo(() => {
    if (!total) return 0;
    return Math.round((presentes / total) * 100);
  }, [presentes, total]);

  const faixa = useMemo(() => {
    if (porcentagem >= thresholdOk) return "ok";
    if (porcentagem >= Math.max(1, Math.round(thresholdOk * 0.66))) return "medio";
    return "ruim";
  }, [porcentagem, thresholdOk]);

  const gradiente =
    faixa === "ok"
      ? "from-emerald-500 via-emerald-600 to-emerald-700"
      : faixa === "medio"
      ? "from-amber-500 via-amber-600 to-amber-700"
      : "from-rose-500 via-rose-600 to-rose-700";

  const chip =
    faixa === "ok"
      ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-emerald-700/20"
      : faixa === "medio"
      ? "bg-amber-500/15 text-amber-900 dark:text-amber-200 ring-amber-700/20"
      : "bg-rose-500/15 text-rose-900 dark:text-rose-200 ring-rose-700/20";

  // skeleton
  if (carregando) {
    return (
      <div
        className={cx("mt-3", className)}
        role="status"
        aria-busy="true"
        aria-live="polite"
        data-testid={testId}
      >
        <Skeleton height={14} width={220} className="mb-2" />
        <Skeleton height={12} width="100%" />
      </div>
    );
  }

  // erro
  if (erro) {
    return (
      <div className={cx("mt-3", className)} data-testid={testId}>
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/20 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertTriangle className="h-4 w-4 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <p aria-live="polite">{erro}</p>
            <button
              type="button"
              onClick={fetchDados}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white/70 px-3 py-1.5 text-xs font-extrabold text-rose-800 ring-1 ring-rose-800/10 hover:bg-white dark:bg-white/10 dark:text-rose-100 dark:ring-white/10 dark:hover:bg-white/15"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  // sem inscritos
  if (total === 0) {
    return (
      <div className={cx("mt-3", className)} data-testid={testId}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 italic" aria-live="polite">
          Nenhum inscrito nesta turma.
        </p>
      </div>
    );
  }

  // sem presenças
  if (presentes === 0) {
    return (
      <div className={cx("mt-3", className)} data-testid={testId}>
        <p className="text-sm text-rose-700 dark:text-rose-300 italic" aria-live="polite">
          Nenhuma presença registrada ainda nesta turma.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className={cx("mt-3", className)}
      aria-label="Resumo de presenças"
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={reduceMotion ? false : { opacity: 1, y: 0 }}
      transition={reduceMotion ? undefined : { duration: 0.28 }}
      data-testid={testId}
    >
      {/* header da mini-métrica */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
            <span aria-live="polite">
              {label}: {presentes} de {total} ({porcentagem}%)
            </span>
          </p>

          <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Meta recomendada: {thresholdOk}%
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cx(
              "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-extrabold ring-1",
              chip
            )}
            title={faixa === "ok" ? "Dentro do recomendado" : faixa === "medio" ? "Atenção" : "Baixo"}
          >
            {faixa === "ok" ? "OK" : faixa === "medio" ? "Atenção" : "Baixo"}
          </span>

          {showRefresh && !dataOverride && (
            <button
              type="button"
              onClick={fetchDados}
              className="inline-flex items-center justify-center rounded-xl p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 ring-1 ring-black/5 dark:bg-white/10 dark:hover:bg-white/15 dark:text-zinc-100 dark:ring-white/10"
              title="Atualizar"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* barra acessível */}
      <div
        className="mt-2 w-full rounded-full h-3 shadow-inner relative overflow-hidden bg-zinc-200 dark:bg-white/10"
        title={`${porcentagem}%`}
      >
        {/* marcador da meta */}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-black/20 dark:bg-white/25"
          style={{ left: `${clamp(thresholdOk, 0, 100)}%` }}
          aria-hidden="true"
        />

        <motion.div
          className={cx("h-3 rounded-full bg-gradient-to-r", gradiente)}
          style={{ width: `${porcentagem}%` }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={porcentagem}
          aria-label="Progresso de presença"
          initial={reduceMotion ? false : { width: 0 }}
          animate={reduceMotion ? false : { width: `${porcentagem}%` }}
          transition={reduceMotion ? undefined : { duration: 0.5 }}
        />

        {/* label interna (aparece sempre, mas discreta) */}
        <div className="absolute inset-0 flex items-center">
          <span className="text-[10px] ml-2 text-white/90 drop-shadow-sm select-none">
            {porcentagem}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}

ResumoPresencasSimples.propTypes = {
  turmaId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  dataOverride: PropTypes.oneOfType([
    PropTypes.shape({
      total: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      presentes: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    }),
    PropTypes.array,
  ]),
  autoRefreshMs: PropTypes.number,
  className: PropTypes.string,
  "data-testid": PropTypes.string,

  thresholdOk: PropTypes.number,
  label: PropTypes.string,
  showRefresh: PropTypes.bool,
};
