// src/pages/PresencasPorTurma.jsx
import { useState, useEffect } from "react";
import { toast } from "react-toastify";

import Breadcrumbs from "../components/Breadcrumbs";
import CabecalhoPainel from "../components/CabecalhoPainel";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";
import ListaTurmasAdministrador from "../components/ListaTurmasAdministrador";
import ResumoPresencasSimples from "../components/ResumoPresencasSimples";

export default function PresencasPorTurma() {
  const [turmas, setTurmas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacoesPorTurma, setAvaliacoesPorTurma] = useState({});
  const [turmaSelecionada, setTurmaSelecionada] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState("presencas");

  const token = localStorage.getItem("token");

  useEffect(() => {
    async function carregarTurmas() {
      try {
        const res = await fetch("http://localhost:3000/api/administrador/turmas", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setTurmas(data);
        setErro(false);
      } catch {
        setErro(true);
        toast.error("❌ Erro ao carregar turmas.");
      } finally {
        setCarregando(false);
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
      toast.error("❌ Erro ao carregar inscritos.");
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
      toast.error("❌ Erro ao carregar avaliações.");
    }
  };

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-2 sm:px-4 py-6">
      <Breadcrumbs />
      <CabecalhoPainel titulo="📋 Gerenciar Presenças" />
      <h1 className="text-2xl font-bold mb-6 text-center text-black dark:text-white">
        📋 Gerenciar Presenças
      </h1>

      {carregando ? (
        <CarregandoSkeleton texto="Carregando turmas..." />
      ) : erro ? (
        <ErroCarregamento mensagem="Erro ao carregar turmas. Tente novamente mais tarde." />
      ) : (
        <>
          <ListaTurmasAdministrador
            turmas={turmas}
            hoje={new Date()}
            inscritosPorTurma={inscritosPorTurma}
            avaliacoesPorTurma={avaliacoesPorTurma}
            carregarInscritos={carregarInscritos}
            carregarAvaliacoes={carregarAvaliacoes}
            modoadministradorPresencas={true}
            onSelecionarTurma={(turma) => {
              setTurmaSelecionada(turma);
              setAbaAtiva("presencas");
            }}
          />

          {turmaSelecionada && (
            <div className="mt-8">
              <div className="flex justify-center gap-4 mb-4">
                <button
                  onClick={() => setAbaAtiva("presencas")}
                  className={`px-4 py-2 rounded-xl font-semibold shadow ${
                    abaAtiva === "presencas"
                      ? "bg-lousa text-white"
                      : "bg-white dark:bg-zinc-800 text-gray-800 dark:text-white"
                  }`}
                >
                  📝 Gerenciar Presenças
                </button>
                <button
                  onClick={() => setAbaAtiva("resumo")}
                  className={`px-4 py-2 rounded-xl font-semibold shadow ${
                    abaAtiva === "resumo"
                      ? "bg-lousa text-white"
                      : "bg-white dark:bg-zinc-800 text-gray-800 dark:text-white"
                  }`}
                >
                  📊 Resumo Simplificado
                </button>
              </div>

              {abaAtiva === "presencas" ? (
                <ListaTurmasAdministrador
                  turmas={[turmaSelecionada]}
                  hoje={new Date()}
                  inscritosPorTurma={inscritosPorTurma}
                  avaliacoesPorTurma={avaliacoesPorTurma}
                  carregarInscritos={carregarInscritos}
                  carregarAvaliacoes={carregarAvaliacoes}
                  modoadministradorPresencas={true}
                />
              ) : (
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow max-w-4xl mx-auto">
                  <ResumoPresencasSimples turmaId={turmaSelecionada.id} token={token} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
