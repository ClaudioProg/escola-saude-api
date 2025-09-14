// 📁 src/components/ResumoPresencasSimples.jsx
import { useEffect, useMemo, useState } from "react";
import Skeleton from "react-loading-skeleton";
import PropTypes from "prop-types";
import { motion, useReducedMotion } from "framer-motion";
import { apiGet } from "../services/api";

export default function ResumoPresencasSimples({ turmaId }) {
  const [total, setTotal] = useState(0);
  const [presentes, setPresentes] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        setErro(null);
        setCarregando(true);
        const data = await apiGet(`/api/relatorio-presencas/turma/${turmaId}`);

        if (!ativo) return;

        // Aceita array de registros OU objeto agregado { total, presentes }
        if (Array.isArray(data)) {
          const totalCalc = data.length;
          const presentesCalc = data.filter((aluno) => aluno.presente).length;
          setTotal(totalCalc);
          setPresentes(presentesCalc);
        } else if (data && typeof data === "object") {
          setTotal(Number(data.total ?? 0));
          setPresentes(Number(data.presentes ?? 0));
        } else {
          setTotal(0);
          setPresentes(0);
        }
      } catch (e) {
        if (ativo) {
          setErro("Não foi possível carregar as presenças.");
          setTotal(0);
          setPresentes(0);
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [turmaId]);

  const porcentagem = useMemo(() => {
    if (!total) return 0;
    return Math.round((presentes / total) * 100);
  }, [presentes, total]);

  const corBarra =
    porcentagem >= 75 ? "bg-green-600" : porcentagem >= 50 ? "bg-yellow-500" : "bg-red-500";

  if (carregando) {
    return (
      <div className="mt-3" role="status" aria-busy="true" aria-live="polite">
        <Skeleton height={16} width={160} className="mb-2" />
        <Skeleton height={12} width="100%" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="mt-3">
        <p className="text-sm text-red-600 dark:text-red-400" aria-live="polite">
          {erro}
        </p>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="mt-3">
        <p className="text-sm text-gray-500 dark:text-gray-400 italic" aria-live="polite">
          Nenhum inscrito nesta turma.
        </p>
      </div>
    );
  }

  if (presentes === 0) {
    return (
      <div className="mt-3">
        <p className="text-sm text-red-600 dark:text-red-400 italic" aria-live="polite">
          Nenhuma presença registrada ainda nesta turma.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className="mt-3"
      aria-label="Resumo de presenças"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={reduceMotion ? false : { opacity: 1 }}
      transition={reduceMotion ? undefined : { duration: 0.4 }}
    >
      <p className="text-sm font-semibold text-lousa mb-1">
        <span aria-live="polite">
          ✅ Presenças: {presentes} de {total} ({porcentagem}%)
        </span>
      </p>

      <div
        className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-3 shadow-inner relative"
        aria-hidden="true"
        title={`${porcentagem}%`}
      >
        <motion.div
          className={`${corBarra} h-3 rounded-full`}
          style={{ width: `${porcentagem}%` }}
          initial={reduceMotion ? false : { width: 0 }}
          animate={reduceMotion ? false : { width: `${porcentagem}%` }}
          transition={reduceMotion ? undefined : { duration: 0.5 }}
        />
      </div>

      <progress
        value={presentes}
        max={total}
        className="sr-only"
        aria-label="Progresso de presença"
      />
    </motion.div>
  );
}

ResumoPresencasSimples.propTypes = {
  turmaId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};
