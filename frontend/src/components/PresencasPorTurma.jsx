// 📁 src/pages/PresencasPorTurma.jsx
import { useState, useEffect } from "react";
import ListaTurmasAdministrador from "../components/ListaTurmasAdministrador"; // ✅ caminho correto
import { toast } from "react-toastify";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";
import { apiGet } from "../services/api";

export default function PresencasPorTurma() {
  const [eventos, setEventos] = useState([]); // ✅ era "turmas"
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacoesPorTurma, setAvaliacoesPorTurma] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function carregarEventosETurmas() {
      try {
        const data = await apiGet("/api/administrador/turmas");
        if (!isMounted) return;
        setEventos(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Erro ao carregar turmas:", err);
        toast.error("❌ Erro ao carregar turmas");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    carregarEventosETurmas();
    return () => {
      isMounted = false;
    };
  }, []);

  const carregarInscritos = async (turmaId) => {
    try {
      const data = await apiGet(`/api/turmas/${turmaId}/inscritos`);
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      console.error("Erro ao carregar inscritos:", err);
      toast.error("❌ Erro ao carregar inscritos");
    }
  };

  const carregarAvaliacoes = async (turmaId) => {
    try {
      const data = await apiGet(`/api/avaliacoes/turma/${turmaId}`);
      setAvaliacoesPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      console.error("Erro ao carregar avaliações:", err);
      toast.error("❌ Erro ao carregar avaliações");
    }
  };

  return (
    <main className="p-4 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold text-lousa mb-4">📋 Registro Manual de Presenças</h1>

      {isLoading ? (
        <CarregandoSkeleton />
      ) : eventos.length === 0 ? (
        <NadaEncontrado
          mensagem="Nenhuma turma encontrada."
          sugestao="Verifique se há eventos cadastrados."
        />
      ) : (
        <ListaTurmasAdministrador
          eventos={eventos} // ✅ passa "eventos"
          hoje={new Date()} // ✅ agora; sem parsing de 'yyyy-mm-dd'
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
