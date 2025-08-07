import PropTypes from "prop-types";
import CardTurma from "./CardTurma";
import { AlertCircle } from "lucide-react";

export default function ListaTurmasEvento({
  eventoId,
  turmas = [],
  hoje = new Date(),
  inscricoesConfirmadas = [],
  inscrever = () => {},
  inscrevendo = null,
  avaliacoesPorTurma = {},
  carregarInscritos = () => {},
  carregarAvaliacoes = () => {},
  gerarRelatorioPDF = () => {},
  navigate,
  jaInscritoNoEvento = false, // ✅ nova prop
}) {
  if (!Array.isArray(turmas) || turmas.length === 0) {
    return (
      <div
        className="flex flex-col items-center text-gray-500 dark:text-gray-400 p-6"
        aria-label="Nenhuma turma cadastrada"
      >
        <AlertCircle className="w-8 h-8 mb-2" aria-hidden="true" />
        Nenhuma turma cadastrada para este evento.
      </div>
    );
  }

  return (
    <div
      className="space-y-4 mt-4 w-full max-w-3xl mx-auto"
      aria-label="Lista de turmas do evento"
    >
      {turmas.map((turma) => (
        <CardTurma
          key={turma.id}
          turma={turma}
          hoje={hoje}
          carregarInscritos={carregarInscritos}
          carregarAvaliacoes={carregarAvaliacoes}
          gerarRelatorioPDF={gerarRelatorioPDF}
          inscritos={turma.inscritos}
          avaliacoes={avaliacoesPorTurma[turma.id] || []}
          inscrever={inscrever}
          inscrevendo={inscrevendo}
          inscricoesConfirmadas={inscricoesConfirmadas}
          navigate={navigate}
          bloquearInscricao={
            jaInscritoNoEvento && !inscricoesConfirmadas.includes(turma.id)
          } // ✅ regra clara e direta
        />
      ))}
    </div>
  );
}

ListaTurmasEvento.propTypes = {
  eventoId: PropTypes.number.isRequired,
  turmas: PropTypes.array.isRequired,
  hoje: PropTypes.instanceOf(Date),
  inscricoesConfirmadas: PropTypes.array,
  inscrever: PropTypes.func,
  inscrevendo: PropTypes.number,
  avaliacoesPorTurma: PropTypes.object,
  carregarInscritos: PropTypes.func,
  carregarAvaliacoes: PropTypes.func,
  gerarRelatorioPDF: PropTypes.func,
  navigate: PropTypes.func,
  jaInscritoNoEvento: PropTypes.bool, // ✅ nova validação
};

ListaTurmasEvento.defaultProps = {
  hoje: new Date(),
  inscricoesConfirmadas: [],
  inscrever: () => {},
  inscrevendo: null,
  avaliacoesPorTurma: {},
  carregarInscritos: () => {},
  carregarAvaliacoes: () => {},
  gerarRelatorioPDF: () => {},
  jaInscritoNoEvento: false, // ✅ valor padrão
};
