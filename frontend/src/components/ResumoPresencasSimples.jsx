import { useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import PropTypes from "prop-types";
import { motion } from "framer-motion";

export default function ResumoPresencasSimples({ turmaId, token }) {
  const [total, setTotal] = useState(0);
  const [presentes, setPresentes] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    const carregarPresencas = async () => {
      try {
        const res = await fetch(
          `http://localhost:3000/api/relatorio-presencas/turma/${turmaId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (!ativo) return;
        setTotal(data.length);
        setPresentes(data.filter((aluno) => aluno.presente).length);
      } catch {
        if (ativo) {
          setTotal(0);
          setPresentes(0);
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    };
    carregarPresencas();
    return () => {
      ativo = false;
    };
  }, [turmaId, token]);

  if (carregando) {
    return (
      <div className="mt-3">
        <Skeleton height={16} width={160} className="mb-2" />
        <Skeleton height={12} width="100%" />
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

  if (!carregando && presentes === 0) {
    return (
      <div className="mt-3">
        <p className="text-sm text-red-600 dark:text-red-400 italic" aria-live="polite">
          Nenhuma presença registrada ainda nesta turma.
        </p>
      </div>
    );
  }

  const porcentagem = total > 0 ? Math.round((presentes / total) * 100) : 0;
  const corBarra =
    porcentagem >= 75
      ? "bg-green-600"
      : porcentagem >= 50
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <motion.div
      className="mt-3"
      aria-label="Resumo de presenças"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <p className="text-sm font-semibold text-lousa mb-1">
        <span aria-live="polite">
          ✅ Presenças: {presentes} de {total} ({porcentagem}%)
        </span>
      </p>
      <div
        className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-3 shadow-inner relative"
        aria-hidden="true"
      >
        <motion.div
          className={`${corBarra} h-3 rounded-full`}
          style={{ width: `${porcentagem}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${porcentagem}%` }}
          transition={{ duration: 0.5 }}
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
  token: PropTypes.string.isRequired,
};
