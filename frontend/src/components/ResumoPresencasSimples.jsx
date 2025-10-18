// 📁 src/components/ResumoPresencasSimples.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Skeleton from "react-loading-skeleton";
import PropTypes from "prop-types";
import { motion, useReducedMotion } from "framer-motion";
import { apiGet } from "../services/api";

function clamp(n, min, max) {
  const x = Number.isFinite(+n) ? +n : 0;
  return Math.min(Math.max(x, min), max);
}

export default function ResumoPresencasSimples({
  turmaId,
  dataOverride,         // { total, presentes } (pula o fetch se vier)
  autoRefreshMs = 0,    // ex.: 15000 para atualizar a cada 15s
  className = "",
  "data-testid": testId,
}) {
  const [total, setTotal] = useState(0);
  const [presentes, setPresentes] = useState(0);
  const [carregando, setCarregando] = useState(!dataOverride);
  const [erro, setErro] = useState(null);
  const reduceMotion = useReducedMotion();
  const abortRef = useRef(null);
  const refreshTimerRef = useRef(null);

  const efetivarDados = (raw) => {
    if (Array.isArray(raw)) {
      const tot = raw.length;
      const pres = raw.filter((aluno) => !!aluno?.presente).length;
      return { total: tot, presentes: pres };
    }
    if (raw && typeof raw === "object") {
      return { total: Number(raw.total ?? 0), presentes: Number(raw.presentes ?? 0) };
    }
    return { total: 0, presentes: 0 };
  };

  const fetchDados = async () => {
    if (!turmaId) return;
    setErro(null);
    setCarregando(true);

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
      const { total, presentes } = efetivarDados(data);
      const t = clamp(total, 0, Number.MAX_SAFE_INTEGER);
      const p = clamp(presentes, 0, t || 0); // não deixa passar de total
      setTotal(t);
      setPresentes(p);
    } catch (e) {
      if (e?.name !== "AbortError") {
        setErro("Não foi possível carregar as presenças.");
        setTotal(0);
        setPresentes(0);
      }
    } finally {
      setCarregando(false);
    }
  };

  // inicial + autoRefresh
  useEffect(() => {
    if (dataOverride) {
      const { total, presentes } = efetivarDados(dataOverride);
      const t = clamp(total, 0, Number.MAX_SAFE_INTEGER);
      const p = clamp(presentes, 0, t || 0);
      setTotal(t);
      setPresentes(p);
      setCarregando(false);
      setErro(null);
      return; // sem polling quando a fonte é externa
    }
    fetchDados();

    if (autoRefreshMs > 0) {
      refreshTimerRef.current = setInterval(fetchDados, autoRefreshMs);
    }
    return () => {
      abortRef.current?.abort?.();
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaId, autoRefreshMs, !!dataOverride]);

  const porcentagem = useMemo(() => {
    if (!total) return 0;
    return Math.round((presentes / total) * 100);
  }, [presentes, total]);

  const faixa =
    porcentagem >= 75 ? "ok" : porcentagem >= 50 ? "medio" : "ruim";

  const gradiente =
    faixa === "ok"
      ? "from-emerald-500 via-emerald-600 to-emerald-700"
      : faixa === "medio"
      ? "from-amber-500 via-amber-600 to-amber-700"
      : "from-rose-500 via-rose-600 to-rose-700";

  if (carregando) {
    return (
      <div className={`mt-3 ${className}`} role="status" aria-busy="true" aria-live="polite" data-testid={testId}>
        <Skeleton height={16} width={180} className="mb-2" />
        <Skeleton height={12} width="100%" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className={`mt-3 ${className}`} data-testid={testId}>
        <p className="text-sm text-red-600 dark:text-red-400" aria-live="polite">{erro}</p>
        <button
          type="button"
          onClick={fetchDados}
          className="mt-2 text-xs px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className={`mt-3 ${className}`} data-testid={testId}>
        <p className="text-sm text-gray-500 dark:text-gray-400 italic" aria-live="polite">
          Nenhum inscrito nesta turma.
        </p>
      </div>
    );
  }

  if (presentes === 0) {
    return (
      <div className={`mt-3 ${className}`} data-testid={testId}>
        <p className="text-sm text-rose-600 dark:text-rose-400 italic" aria-live="polite">
          Nenhuma presença registrada ainda nesta turma.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className={`mt-3 ${className}`}
      aria-label="Resumo de presenças"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={reduceMotion ? false : { opacity: 1 }}
      transition={reduceMotion ? undefined : { duration: 0.35 }}
      data-testid={testId}
    >
      <p className="text-sm font-semibold text-lousa mb-1">
        <span aria-live="polite">
          ✅ Presenças: {presentes} de {total} ({porcentagem}%)
        </span>
      </p>

      {/* barra acessível */}
      <div
        className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-3 shadow-inner relative overflow-hidden"
        title={`${porcentagem}%`}
      >
        <motion.div
          className={`h-3 rounded-full bg-gradient-to-r ${gradiente}`}
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
        {/* label interna (aparece quando houver espaço) */}
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
    PropTypes.array, // lista de presenças também é aceita (compat)
  ]),
  autoRefreshMs: PropTypes.number,
  className: PropTypes.string,
  "data-testid": PropTypes.string,
};
