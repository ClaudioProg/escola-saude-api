import { useState, useEffect } from "react";
import ListaTurmasAdministrador from "./ListaTurmasAdmin";
import { toast } from "react-toastify";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";

export default function PresencasPorTurma() {
  const [turmas, setTurmas] = useState([]);
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacoesPorTurma, setAvaliacoesPorTurma] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const token = localStorage.getItem("token");

  useEffect(() => {
    async function carregarTurmas() {
      try {
        const res = await fetch("http://localhost:3000/api/administrador/turmas", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setTurmas(data);
      } catch (err) {
        toast.error("❌ Erro ao carregar turmas");
      } finally {
        setIsLoading(false);
      }
    }

    carregarTurmas();
  }, [token]);

  const carregarInscritos = async (turmaId) => {
    try {
      const res = await fetch(`http://localhost:3000/api/turmas/${turmaId}/inscritos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: data }));
    } catch {
      toast.error("❌ Erro ao carregar inscritos");
    }
  };

  const carregarAvaliacoes = async (turmaId) => {
    try {
      const res = await fetch(`http://localhost:3000/api/avaliacoes/turma/${turmaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAvaliacoesPorTurma((prev) => ({ ...prev, [turmaId]: data }));
    } catch {
      toast.error("❌ Erro ao carregar avaliações");
    }
  };

  return (
    <main className="p-4 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold text-lousa mb-4">
        📋 Registro Manual de Presenças
      </h1>

      {isLoading ? (
        <CarregandoSkeleton />
      ) : turmas.length === 0 ? (
        <NadaEncontrado mensagem="Nenhuma turma encontrada." sugestao="Verifique se há eventos cadastrados." />
      ) : (
        <ListaTurmasAdministrador
          turmas={turmas}
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
