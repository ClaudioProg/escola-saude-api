import PropTypes from "prop-types";
import CardTurma from "./CardTurma";
import { AlertCircle } from "lucide-react";

export default function ListaTurmasEvento({
  turmas = [],
  avaliacoesPorTurma = {},
  carregarInscritos = () => {},
  carregarAvaliacoes = () => {},
  gerarRelatorioPDF = () => {},
  navigate,
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
    <div className="space-y-4 mt-4 w-full max-w-3xl mx-auto" aria-label="Lista de turmas do evento">
      {turmas.map((turma) => (
        <CardTurma
          key={turma.id}
          turma={turma}
          hoje={new Date()}
          inscritos={turma.inscritos}
          avaliacoes={avaliacoesPorTurma[turma.id] || []}
          carregarInscritos={carregarInscritos}
          carregarAvaliacoes={carregarAvaliacoes}
          gerarRelatorioPDF={gerarRelatorioPDF}
          navigate={navigate}
        />
      ))}
    </div>
  );
}

ListaTurmasEvento.propTypes = {
  turmas: PropTypes.array.isRequired,
  avaliacoesPorTurma: PropTypes.object,
  carregarInscritos: PropTypes.func,
  carregarAvaliacoes: PropTypes.func,
  gerarRelatorioPDF: PropTypes.func,
  navigate: PropTypes.func,
};

ListaTurmasEvento.defaultProps = {
  avaliacoesPorTurma: {},
  carregarInscritos: () => {},
  carregarAvaliacoes: () => {},
  gerarRelatorioPDF: () => {},
};
