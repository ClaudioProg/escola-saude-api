// 📁 src/pages/PresencasPorTurma.jsx
import { useState, useEffect } from "react";
import ListaTurmasAdministrador from "./ListaTurmasAdministrador"; // ✅ nome/arquivo consistentes
import { toast } from "react-toastify";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";
import { apiGet } from "../services/api"; // ✅ serviço centralizado

export default function PresencasPorTurma() {
  const [eventos, setEventos] = useState([]);          // ✅ era "turmas"
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacoesPorTurma, setAvaliacoesPorTurma] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function carregarEventosETurmas() {
      try {
        const data = await apiGet("/api/administrador/turmas");
        setEventos(Array.isArray(data) ? data : []);
      } catch {
        toast.error("❌ Erro ao carregar turmas");
      } finally {
        setIsLoading(false);
      }
    }
    carregarEventosETurmas();
  }, []);

  const carregarInscritos = async (turmaId) => {
    try {
      const data = await apiGet(`/api/turmas/${turmaId}/inscritos`);
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: data }));
    } catch {
      toast.error("❌ Erro ao carregar inscritos");
    }
  };

  const carregarAvaliacoes = async (turmaId) => {
    try {
      const data = await apiGet(`/api/avaliacoes/turma/${turmaId}`);
      setAvaliacoesPorTurma((prev) => ({ ...prev, [turmaId]: data }));
    } catch {
      toast.error("❌ Erro ao carregar avaliações");
    }
  };

  return (
    <main className="p-4 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold text-lousa mb-4">📋 Registro Manual de Presenças</h1>

      {isLoading ? (
        <CarregandoSkeleton />
      ) : eventos.length === 0 ? (
        <NadaEncontrado mensagem="Nenhuma turma encontrada." sugestao="Verifique se há eventos cadastrados." />
      ) : (
        <ListaTurmasAdministrador
          eventos={eventos}                     // ✅ passa "eventos"
          hoje={new Date()}
          inscritosPorTurma={inscritosPorTurma}
          avaliacoesPorTurma={avaliacoesPorTurma}
          carregarInscritos={carregarInscritos}
          carregarAvaliacoes={carregarAvaliacoes}
          modoadministradorPresencas={true}
        />
      )}
    </main>
  );
}
