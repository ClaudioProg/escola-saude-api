// 📁 src/pages/PresencasPorTurma.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import ListaTurmasPresenca from "../components/ListaTurmasPresenca"; // ✅ componente correto
import { toast } from "react-toastify";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";
import { apiGet } from "../services/api";

export default function PresencasPorTurma() {
  const [eventos, setEventos] = useState([]);
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacoesPorTurma, setAvaliacoesPorTurma] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Ref para cancelar fetch ao desmontar/atualizar
  const abortRef = useRef(null);

  const carregarEventosETurmas = useCallback(async () => {
    try {
      setIsLoading(true);

      // cancela requisição anterior, se houver
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      // Endpoint deve devolver um array de eventos, cada um com suas turmas
      const data = await apiGet("/api/administrador/turmas", {
        signal: abortRef.current.signal,
        on401: "silent",
        on403: "silent",
      });

      setEventos(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Erro ao carregar turmas:", err);
        toast.error("❌ Erro ao carregar turmas.");
        setEventos([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarEventosETurmas();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [carregarEventosETurmas]);

  const carregarInscritos = useCallback(async (turmaId) => {
    try {
      const data = await apiGet(`/api/turmas/${turmaId}/inscritos`, { on401: "silent", on403: "silent" });
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      console.error("Erro ao carregar inscritos:", err);
      toast.error("❌ Erro ao carregar inscritos.");
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: [] }));
    }
  }, []);

  const carregarAvaliacoes = useCallback(async (turmaId) => {
    try {
      const data = await apiGet(`/api/avaliacoes/turma/${turmaId}`, { on401: "silent", on403: "silent" });
      setAvaliacoesPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      console.error("Erro ao carregar avaliações:", err);
      toast.error("❌ Erro ao carregar avaliações.");
      setAvaliacoesPorTurma((prev) => ({ ...prev, [turmaId]: [] }));
    }
  }, []);

  const handleTurmaRemovida = useCallback(
    async (_turmaId) => {
      // Recarrega a lista para refletir remoções/contagens
      await carregarEventosETurmas();
    },
    [carregarEventosETurmas]
  );

  return (
    <main className="p-4 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold text-lousa dark:text-white mb-4">
        📋 Registro Manual de Presenças
      </h1>

      {isLoading ? (
        <CarregandoSkeleton />
      ) : eventos.length === 0 ? (
        <NadaEncontrado
          mensagem="Nenhuma turma encontrada."
          sugestao="Verifique se há eventos e turmas cadastrados."
        />
      ) : (
        <ListaTurmasPresenca
          eventos={eventos}
          hoje={new Date()}
          inscritosPorTurma={inscritosPorTurma}
          avaliacoesPorTurma={avaliacoesPorTurma}
          carregarInscritos={carregarInscritos}
          carregarAvaliacoes={carregarAvaliacoes}
          modoadministradorPresencas={true}
          onTurmaRemovida={handleTurmaRemovida}
          mostrarBotaoRemover={true}  // ✅ exibe botão remover no modo admin
        />
      )}
    </main>
  );
}
