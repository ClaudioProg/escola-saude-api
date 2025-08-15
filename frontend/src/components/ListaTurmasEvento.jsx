import PropTypes from "prop-types";
import CardTurma from "./CardTurma";
import { AlertCircle } from "lucide-react";

export default function ListaTurmasEvento({
  eventoId,
  turmas = [],
  // ❌ sem default new Date aqui
  hoje,
  inscricoesConfirmadas = [],
  inscrever = () => {},
  inscrevendo = null,
  avaliacoesPorTurma = {},
  carregarInscritos = () => {},
  carregarAvaliacoes = () => {},
  gerarRelatorioPDF = () => {},
  navigate,
  jaInscritoNoEvento = false,
}) {
  if (!Array.isArray(turmas) || turmas.length === 0) {
    return (
      <div
        className="flex flex-col items-center text-gray-500 dark:text-gray-400 p-6"
        aria-label="Nenhuma turma cadastrada"
        role="status"
      >
        <AlertCircle className="w-8 h-8 mb-2" aria-hidden="true" />
        Nenhuma turma cadastrada para este evento.
      </div>
    );
  }

  // 🔢 normaliza IDs confirmados para número (evita includes falhando por tipo)
  const confirmadasNum = inscricoesConfirmadas
    .map((id) => Number(id))
    .filter((n) => !Number.isNaN(n));

  // ⏱️ ordena por data de início com T12:00:00 para evitar off-by-one
  const turmasOrdenadas = [...turmas].sort((a, b) => {
    const ta = a?.data_inicio ? new Date(`${a.data_inicio}T12:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b?.data_inicio ? new Date(`${b.data_inicio}T12:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });

  return (
    <div
      className="space-y-4 mt-4 w-full max-w-3xl mx-auto"
      aria-label="Lista de turmas do evento"
    >
      {turmasOrdenadas.map((turma) => {
        const turmaIdNum = Number(turma.id);
        const bloquear = jaInscritoNoEvento && !confirmadasNum.includes(turmaIdNum);

        return (
          <CardTurma
            key={turma.id}
            turma={turma}
            hoje={hoje}
            carregarInscritos={carregarInscritos}
            carregarAvaliacoes={carregarAvaliacoes}
            gerarRelatorioPDF={gerarRelatorioPDF}
            inscritos={turma.inscritos || []}
            avaliacoes={avaliacoesPorTurma[turma.id] || []}
            inscrever={inscrever}
            inscrevendo={inscrevendo}
            inscricoesConfirmadas={confirmadasNum}
            navigate={navigate}
            bloquearInscricao={bloquear}
          />
        );
      })}
    </div>
  );
}

ListaTurmasEvento.propTypes = {
  eventoId: PropTypes.number.isRequired,
  turmas: PropTypes.array.isRequired,
  hoje: PropTypes.instanceOf(Date), // pode vir, mas não defaultamos aqui
  inscricoesConfirmadas: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.number, PropTypes.string])
  ),
  inscrever: PropTypes.func,
  inscrevendo: PropTypes.number,
  avaliacoesPorTurma: PropTypes.object,
  carregarInscritos: PropTypes.func,
  carregarAvaliacoes: PropTypes.func,
  gerarRelatorioPDF: PropTypes.func,
  navigate: PropTypes.func,
  jaInscritoNoEvento: PropTypes.bool,
};

ListaTurmasEvento.defaultProps = {
  inscricoesConfirmadas: [],
  inscrever: () => {},
  inscrevendo: null,
  avaliacoesPorTurma: {},
  carregarInscritos: () => {},
  carregarAvaliacoes: () => {},
  gerarRelatorioPDF: () => {},
  jaInscritoNoEvento: false,
};
